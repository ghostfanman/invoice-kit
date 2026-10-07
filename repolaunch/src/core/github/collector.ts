// Erfasst einen begrenzten Schnappschuss eines öffentlichen Repositorys.
// Kein rekursiver Scan, keine Ausführung von Code, nur ausgewählte Textdateien.

import type { CollectLimits } from "../limits";
import type { FileState, Goal, Localized, ReleaseInfo, RepoMeta, RepoSnapshot, TreeEntry } from "../types";
import { CollectError, ResponseTooLargeError } from "./errors";
import type { GitHubHttp } from "./http";

/** Dateien, deren Inhalt gelesen wird (Name ohne Groß-/Kleinschreibung). Reihenfolge = Priorität. */
const CONTENT_CANDIDATES = [
  "package.json",
  "pyproject.toml",
  "Cargo.toml",
  "go.mod",
  "composer.json",
  "action.yml",
  "action.yaml",
  ".github/FUNDING.yml",
  "docs/README.md",
  "docs/index.md",
];

/** Unterverzeichnisse, deren Dateiliste nicht rekursiv gelesen wird. */
const SUBDIR_CANDIDATES = [".github", "docs", "doc"];

const SHA_RE = /^[0-9a-f]{40}$/;

const L = (de: string, en: string): Localized => ({ de, en });

interface RawTreeEntry {
  path?: unknown;
  type?: unknown;
  size?: unknown;
  sha?: unknown;
}

export interface CollectRequest {
  owner: string;
  repo: string;
  goal: Goal;
  source: "github" | "fixture";
  fixtureName?: string;
}

export async function collectSnapshot(
  http: GitHubHttp,
  req: CollectRequest,
  limits: CollectLimits,
  now: () => Date = () => new Date(),
): Promise<RepoSnapshot> {
  const notes: Localized[] = [];
  const base = `/repos/${enc(req.owner)}/${enc(req.repo)}`;

  try {
    // 1. Metadaten
    const repoRes = await http.getJson<Record<string, unknown>>(base);
    if (repoRes.status === 404 || !repoRes.data) {
      throw new CollectError("not_found_or_private", "Repository nicht gefunden oder nicht öffentlich", { status: 404 });
    }
    const r = repoRes.data;
    if (r.private === true || (typeof r.visibility === "string" && r.visibility !== "public")) {
      throw new CollectError("private_unsupported", "Private Repositories werden im MVP nicht analysiert");
    }
    const fullName = str(r.full_name) ?? `${req.owner}/${req.repo}`;
    const [owner = req.owner, repo = req.repo] = fullName.split("/");
    if (fullName.toLowerCase() !== `${req.owner}/${req.repo}`.toLowerCase()) {
      notes.push(L(`Repository wurde umbenannt oder verschoben; analysiert wurde ${fullName}.`, `Repository was renamed or moved; analysed ${fullName}.`));
    }
    const canonicalBase = `/repos/${enc(owner)}/${enc(repo)}`;
    const defaultBranch = str(r.default_branch);
    if (!defaultBranch) throw new CollectError("invalid_response", "Default-Branch fehlt in der API-Antwort");
    const meta = parseMeta(r);

    // 2. Commit-SHA des Default-Branches
    const shaRes = await http.get(`${canonicalBase}/commits/${encPath(defaultBranch)}`, "application/vnd.github.sha", 200);
    if (shaRes.status === 409) throw new CollectError("empty_repository", "Repository enthält keine Commits");
    if (shaRes.status !== 200) throw new CollectError("github_api_error", "Commit des Default-Branches nicht lesbar", { status: shaRes.status });
    const commitSha = new TextDecoder().decode(shaRes.body).trim();
    if (!SHA_RE.test(commitSha)) throw new CollectError("invalid_response", "Ungültige Commit-SHA");

    // 3. Dateiliste der Wurzel (nicht rekursiv) und ausgewählter Unterverzeichnisse
    const entries: TreeEntry[] = [];
    const scannedDirs: string[] = [];
    let truncated = false;
    const rootTree = await http.getJson<{ tree?: RawTreeEntry[]; truncated?: boolean }>(`${canonicalBase}/git/trees/${commitSha}`);
    if (rootTree.status !== 200 || !rootTree.data || !Array.isArray(rootTree.data.tree)) {
      throw new CollectError("github_api_error", "Dateiliste nicht lesbar", { status: rootTree.status });
    }
    truncated ||= rootTree.data.truncated === true;
    scannedDirs.push("");
    const subtreeShas = new Map<string, string>();
    for (const e of rootTree.data.tree) {
      const entry = toEntry(e, "");
      if (!entry) continue;
      if (entries.length < limits.maxTreeEntries) entries.push(entry);
      else truncated = true;
      if (entry.type === "tree" && typeof e.sha === "string" && SHA_RE.test(e.sha)) subtreeShas.set(entry.path.toLowerCase(), e.sha);
    }
    let subdirsRead = 0;
    for (const dir of SUBDIR_CANDIDATES) {
      if (subdirsRead >= limits.maxSubdirs) break;
      const sha = subtreeShas.get(dir);
      if (!sha) continue;
      const actual = entries.find((x) => x.path.toLowerCase() === dir)?.path ?? dir;
      const sub = await http.getJson<{ tree?: RawTreeEntry[]; truncated?: boolean }>(`${canonicalBase}/git/trees/${sha}`);
      subdirsRead += 1;
      if (sub.status !== 200 || !sub.data || !Array.isArray(sub.data.tree)) {
        notes.push(L(`Dateiliste von ${actual}/ nicht lesbar.`, `File list of ${actual}/ not readable.`));
        continue;
      }
      scannedDirs.push(actual);
      truncated ||= sub.data.truncated === true;
      for (const e of sub.data.tree) {
        const entry = toEntry(e, actual);
        if (!entry) continue;
        if (entries.length < limits.maxTreeEntries) entries.push(entry);
        else truncated = true;
      }
    }
    if (truncated) notes.push(L("Dateiliste gekürzt; nicht gefundene Dateien gelten als unbekannt.", "File list truncated; files not found count as unknown."));

    // 4. README
    const readme = await readReadme(http, canonicalBase, commitSha, limits);
    if (readme.state === "unknown") notes.push(L(`README nicht auswertbar: ${readme.reason.de}`, `README not evaluable: ${readme.reason.en}`));

    // 5. Releases und Tags
    const releases = await readReleases(http, canonicalBase);

    // 6. Ausgewählte Textdateien
    const files: Record<string, FileState> = {};
    let fetched = 0;
    for (const candidate of CONTENT_CANDIDATES) {
      const entry = entries.find((e) => e.type === "blob" && e.path.toLowerCase() === candidate.toLowerCase());
      if (!entry) {
        const dir = candidate.includes("/") ? candidate.slice(0, candidate.lastIndexOf("/")) : "";
        const dirScanned = scannedDirs.some((d) => d.toLowerCase() === dir.toLowerCase());
        files[candidate] = dirScanned && !truncated
          ? { state: "missing", path: candidate }
          : { state: "unknown", path: candidate, reason: L("Verzeichnis nicht gelesen", "directory not read") };
        continue;
      }
      if (fetched >= limits.maxFiles) {
        files[entry.path] = { state: "unknown", path: entry.path, reason: L("Dateibudget erschöpft", "file budget exhausted") };
        continue;
      }
      if ((entry.size ?? 0) > limits.maxFileBytes) {
        files[entry.path] = { state: "unknown", path: entry.path, reason: L(`größer als ${limits.maxFileBytes} Bytes`, `larger than ${limits.maxFileBytes} bytes`) };
        continue;
      }
      fetched += 1;
      files[entry.path] = await readTextFile(http, canonicalBase, entry.path, commitSha, limits.maxFileBytes);
    }

    // 7. Einstiegsaufgaben für Mitwirkende, nur wenn das Ziel es erfordert
    let goodFirstIssues: RepoSnapshot["goodFirstIssues"] = { state: "not_checked", count: 0 };
    if (req.goal === "contributors") {
      if (!meta.hasIssues) {
        goodFirstIssues = { state: "missing", count: 0, reason: L("Issues sind deaktiviert", "issues are disabled") };
      } else {
        try {
          const gfi = await http.getJson<unknown[]>(`${canonicalBase}/issues?labels=good%20first%20issue&state=open&per_page=10`);
          if (gfi.status === 200 && Array.isArray(gfi.data)) {
            const count = gfi.data.filter((i) => i && typeof i === "object" && !("pull_request" in (i as object))).length;
            goodFirstIssues = { state: count > 0 ? "present" : "missing", count };
          } else {
            goodFirstIssues = { state: "unknown", count: 0, reason: L(`Status ${gfi.status}`, `status ${gfi.status}`) };
          }
        } catch (err) {
          if (err instanceof CollectError && (err.code === "rate_limited" || err.code === "timeout")) throw err;
          goodFirstIssues = { state: "unknown", count: 0, reason: L("nicht lesbar", "not readable") };
        }
      }
    }

    http.close();
    return {
      schemaVersion: 1,
      source: req.source,
      fixtureName: req.fixtureName,
      owner,
      repo,
      fullName,
      htmlUrl: `https://github.com/${owner}/${repo}`,
      defaultBranch,
      commitSha,
      analyzedAt: now().toISOString(),
      meta,
      display: { stars: typeof r.stargazers_count === "number" ? r.stargazers_count : null },
      tree: { entries, scannedDirs, truncated },
      readme,
      files,
      releases,
      goodFirstIssues,
      stats: { ...http.stats },
      notes,
    };
  } finally {
    http.close();
  }
}

function parseMeta(r: Record<string, unknown>): RepoMeta {
  const license = r.license && typeof r.license === "object" ? (r.license as Record<string, unknown>) : null;
  return {
    description: str(r.description)?.slice(0, 1000) ?? null,
    topics: Array.isArray(r.topics) ? r.topics.filter((t): t is string => typeof t === "string").slice(0, 30) : [],
    homepage: str(r.homepage)?.slice(0, 500) || null,
    archived: r.archived === true,
    disabled: r.disabled === true,
    fork: r.fork === true,
    isTemplate: r.is_template === true,
    hasIssues: r.has_issues === true,
    hasDiscussions: r.has_discussions === true,
    pushedAt: str(r.pushed_at),
    createdAt: str(r.created_at),
    license: license ? { spdxId: str(license.spdx_id), name: str(license.name) } : null,
  };
}

async function readReadme(http: GitHubHttp, base: string, sha: string, limits: CollectLimits): Promise<FileState> {
  try {
    const maxJson = Math.ceil(limits.maxReadmeBytes * 1.4) + 8_000;
    const res = await http.getJson<{ path?: unknown; size?: unknown; content?: unknown; encoding?: unknown }>(`${base}/readme?ref=${sha}`, maxJson);
    if (res.status === 404) return { state: "missing", path: "README" };
    if (res.status !== 200 || !res.data) return { state: "unknown", path: "README", reason: L(`Status ${res.status}`, `status ${res.status}`) };
    const path = str(res.data.path) ?? "README";
    const size = typeof res.data.size === "number" ? res.data.size : 0;
    if (size > limits.maxReadmeBytes) return { state: "unknown", path, reason: L(`größer als ${limits.maxReadmeBytes} Bytes`, `larger than ${limits.maxReadmeBytes} bytes`) };
    if (res.data.encoding !== "base64" || typeof res.data.content !== "string") {
      return { state: "unknown", path, reason: L("Inhalt nicht im erwarteten Format", "content not in expected format") };
    }
    const text = decodeText(Buffer.from(res.data.content, "base64"));
    if (text === null) return { state: "unknown", path, reason: L("kein gültiger UTF-8-Text", "not valid UTF-8 text") };
    return { state: "present", path, text, size, truncated: false };
  } catch (err) {
    if (err instanceof ResponseTooLargeError) return { state: "unknown", path: "README", reason: L("Antwort zu groß", "response too large") };
    throw err;
  }
}

async function readReleases(http: GitHubHttp, base: string): Promise<RepoSnapshot["releases"]> {
  try {
    const res = await http.getJson<unknown[]>(`${base}/releases?per_page=5`);
    if (res.status !== 200 || !Array.isArray(res.data)) {
      return { state: "unknown", items: [], tagsFound: null, reason: L(`Status ${res.status}`, `status ${res.status}`) };
    }
    const items: ReleaseInfo[] = res.data.flatMap((raw) => {
      if (!raw || typeof raw !== "object") return [];
      const x = raw as Record<string, unknown>;
      const tag = str(x.tag_name);
      if (!tag) return [];
      return [{
        tag: tag.slice(0, 200),
        name: str(x.name)?.slice(0, 200) ?? null,
        publishedAt: str(x.published_at),
        prerelease: x.prerelease === true,
        htmlUrl: safeGithubUrl(str(x.html_url)) ?? "",
        hasNotes: typeof x.body === "string" && x.body.trim().length > 20,
      }];
    });
    if (items.length > 0) return { state: "present", items, tagsFound: true };
    const tags = await http.getJson<unknown[]>(`${base}/tags?per_page=1`);
    const tagsFound = tags.status === 200 && Array.isArray(tags.data) ? tags.data.length > 0 : null;
    return { state: tagsFound ? "present" : tagsFound === false ? "missing" : "unknown", items: [], tagsFound };
  } catch (err) {
    if (err instanceof ResponseTooLargeError) return { state: "unknown", items: [], tagsFound: null, reason: L("Antwort zu groß", "response too large") };
    throw err;
  }
}

async function readTextFile(http: GitHubHttp, base: string, path: string, sha: string, maxBytes: number): Promise<FileState> {
  try {
    const res = await http.get(`${base}/contents/${encPath(path)}?ref=${sha}`, "application/vnd.github.raw+json", maxBytes);
    if (res.status === 404) return { state: "missing", path };
    if (res.status !== 200) return { state: "unknown", path, reason: L(`Status ${res.status}`, `status ${res.status}`) };
    const text = decodeText(res.body);
    if (text === null) return { state: "unknown", path, reason: L("kein gültiger UTF-8-Text", "not valid UTF-8 text") };
    return { state: "present", path, text, size: res.body.byteLength, truncated: false };
  } catch (err) {
    if (err instanceof ResponseTooLargeError) return { state: "unknown", path, reason: L("Datei zu groß", "file too large") };
    if (err instanceof CollectError && err.code !== "github_api_error" && err.code !== "invalid_response") throw err;
    return { state: "unknown", path, reason: L("nicht lesbar", "not readable") };
  }
}

function decodeText(bytes: Uint8Array): string | null {
  if (bytes.includes(0)) return null;
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes).replace(/^﻿/, "");
  } catch {
    return null;
  }
}

function toEntry(e: RawTreeEntry, dir: string): TreeEntry | null {
  if (typeof e.path !== "string" || e.path.length === 0 || e.path.length > 255) return null;
  if (e.type !== "blob" && e.type !== "tree" && e.type !== "commit") return null;
  return {
    path: dir ? `${dir}/${e.path}` : e.path,
    type: e.type,
    size: typeof e.size === "number" ? e.size : undefined,
  };
}

function str(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}

function enc(s: string): string {
  return encodeURIComponent(s);
}

function encPath(p: string): string {
  return p.split("/").map(encodeURIComponent).join("/");
}

function safeGithubUrl(u: string | null): string | null {
  if (!u) return null;
  try {
    const url = new URL(u);
    return url.protocol === "https:" && url.hostname === "github.com" ? url.toString() : null;
  } catch {
    return null;
  }
}
