// Transport, der GitHub-API-Antworten aus Fixtures liefert. Für Tests und den gekennzeichneten Demo-Modus.
// Er durchläuft denselben Client und Collector wie Live-Anfragen.

import type { Transport } from "./http";

export interface FixtureTreeEntry {
  path: string;
  type: "blob" | "tree";
  size?: number;
}

export interface FixtureRepo {
  /** Kurzname, z. B. "cli-tool". Owner ist immer FIXTURE_OWNER. */
  name: string;
  title: string;
  repo: Record<string, unknown>;
  sha: string;
  tree: FixtureTreeEntry[];
  subtrees?: Record<string, FixtureTreeEntry[]>;
  readme?: { path: string; text: string };
  files?: Record<string, string>;
  releases?: unknown[];
  tags?: unknown[];
  goodFirstIssues?: unknown[];
}

export const FIXTURE_OWNER = "repolaunch-fixtures";

function json(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json", ...headers } });
}

function treeSha(fixture: FixtureRepo, dir: string): string {
  // Deterministische Pseudo-SHA je Verzeichnis.
  const seed = `${fixture.name}:${dir}`;
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h.toString(16).padStart(8, "0").repeat(5);
}

export function fixtureTransport(fixtures: FixtureRepo[]): Transport {
  return async (url) => {
    const u = new URL(url);
    const m = u.pathname.match(/^\/repos\/([^/]+)\/([^/]+)(\/.*)?$/);
    if (!m || decodeURIComponent(m[1] ?? "") !== FIXTURE_OWNER) return json({ message: "Not Found" }, 404);
    const fixture = fixtures.find((f) => f.name === decodeURIComponent(m[2] ?? ""));
    if (!fixture) return json({ message: "Not Found" }, 404);
    const rest = m[3] ?? "";

    if (rest === "") return json({ ...fixture.repo, full_name: `${FIXTURE_OWNER}/${fixture.name}` });
    if (rest.startsWith("/commits/")) return new Response(fixture.sha, { status: 200 });
    if (rest.startsWith("/git/trees/")) {
      const sha = rest.slice("/git/trees/".length);
      if (sha === fixture.sha) {
        return json({
          sha,
          truncated: false,
          tree: fixture.tree.map((e) => ({ ...e, sha: e.type === "tree" ? treeSha(fixture, e.path) : "0".repeat(40) })),
        });
      }
      for (const [dir, entries] of Object.entries(fixture.subtrees ?? {})) {
        if (treeSha(fixture, dir) === sha) {
          return json({ sha, truncated: false, tree: entries.map((e) => ({ ...e, sha: "0".repeat(40) })) });
        }
      }
      return json({ message: "Not Found" }, 404);
    }
    if (rest === "/readme") {
      if (!fixture.readme) return json({ message: "Not Found" }, 404);
      const bytes = Buffer.from(fixture.readme.text, "utf8");
      return json({
        type: "file",
        encoding: "base64",
        path: fixture.readme.path,
        name: fixture.readme.path.split("/").pop(),
        size: bytes.byteLength,
        content: bytes.toString("base64"),
      });
    }
    if (rest === "/releases") return json(fixture.releases ?? []);
    if (rest === "/tags") return json(fixture.tags ?? []);
    if (rest === "/issues") return json(fixture.goodFirstIssues ?? []);
    if (rest.startsWith("/contents/")) {
      const path = rest.slice("/contents/".length).split("/").map(decodeURIComponent).join("/");
      const text = fixture.files?.[path];
      if (text === undefined) return json({ message: "Not Found" }, 404);
      return new Response(text, { status: 200, headers: { "content-type": "text/plain" } });
    }
    return json({ message: "Not Found" }, 404);
  };
}
