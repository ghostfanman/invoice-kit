// Prüft KI-Entwürfe gegen den gelesenen Stand: Befehle gegen Manifeste und README, Pfade gegen die
// Dateiliste, Links gegen bekannte Hosts, auffällige Behauptungen gegen die Quelltexte.

import type { ManifestInfo } from "../analysis/manifests";
import { isInstallCommand, parseMarkdown } from "../analysis/markdown";
import type { Localized } from "../types";
import type { AiSection, VerificationNote } from "./types";

export interface VerifyContext {
  owner: string;
  repo: string;
  readmeText: string;
  sourceText: string;
  manifests: ManifestInfo[];
  treePaths: string[];
  scannedDirs: string[];
  homepageHost: string | null;
}

const L = (de: string, en: string): Localized => ({ de, en });
const norm = (s: string) => s.replace(/^\s*\$\s*/, "").replace(/\s+/g, " ").trim();

const REGISTRY_HOSTS = ["npmjs.com", "www.npmjs.com", "pypi.org", "crates.io", "pkg.go.dev", "packagist.org", "rubygems.org", "hub.docker.com", "docs.github.com", "choosealicense.com", "img.shields.io", "shields.io", "docs.rs", "jsr.io"];

function pyNorm(n: string): string {
  return n.toLowerCase().replace(/[-_.]+/g, "-");
}

function packageArgs(rest: string): string[] {
  return rest.split(/\s+/).filter((t) => t && !t.startsWith("-") && !["global", "add", "install", "i", "tool", "pip", "--"].includes(t));
}

function stripVersion(pkg: string): string {
  if (pkg.startsWith("@")) {
    const at = pkg.indexOf("@", 1);
    return at === -1 ? pkg : pkg.slice(0, at);
  }
  return pkg.split(/[@=<>~!;[]/)[0] ?? pkg;
}

export function verifyCommand(line: string, ctx: VerifyContext): { status: "verified" | "unverified"; reason: Localized } | null {
  const cmd = norm(line);
  if (!cmd || cmd.startsWith("#") || /^(todo|\.\.\.)/i.test(cmd)) return null;
  const readmeLines = ctx.readmeText.split(/\r?\n/).map(norm);
  if (readmeLines.includes(cmd)) return { status: "verified", reason: L("Wörtlich in der aktuellen README enthalten.", "Present verbatim in the current README.") };

  const byEco = (eco: ManifestInfo["ecosystem"]) => ctx.manifests.find((m) => m.ecosystem === eco);
  let m: RegExpMatchArray | null;

  if ((m = cmd.match(/^(?:sudo\s+)?(?:npm\s+(?:i|install|add)|pnpm\s+(?:add|i|install)|yarn\s+(?:global\s+)?add|bun\s+(?:add|install))\b(.*)$/i))) {
    const pkgs = packageArgs(m[1] ?? "").map(stripVersion);
    const npm = byEco("npm");
    if (pkgs.length === 0) {
      return npm
        ? { status: "verified", reason: L("Lokale Installation; package.json vorhanden.", "Local install; package.json present.") }
        : { status: "unverified", reason: L("Keine package.json gelesen.", "No package.json read.") };
    }
    if (npm?.name && !npm.isPrivate && pkgs.every((p) => p === npm.name)) return { status: "verified", reason: L(`Paketname entspricht ${npm.path}.`, `Package name matches ${npm.path}.`) };
    return { status: "unverified", reason: L("Paketname nicht durch ein gelesenes Manifest belegt.", "Package name not evidenced by a manifest that was read.") };
  }
  if ((m = cmd.match(/^npx\s+(?:-y\s+|--yes\s+)?(\S+)/i))) {
    const pkg = stripVersion(m[1] ?? "");
    const npm = byEco("npm");
    if (npm && (pkg === npm.name || npm.binNames.includes(pkg))) return { status: "verified", reason: L("Paket- oder Befehlsname aus package.json.", "Package or command name from package.json.") };
    return { status: "unverified", reason: L("npx-Ziel nicht durch package.json belegt.", "npx target not evidenced by package.json.") };
  }
  if ((m = cmd.match(/^(?:npm\s+run|pnpm(?:\s+run)?|yarn(?:\s+run)?|bun\s+run)\s+(\S+)/i)) || (m = cmd.match(/^npm\s+(test|start)\b/i))) {
    const script = m[1] ?? "";
    const npm = byEco("npm");
    if (npm?.scripts.includes(script)) return { status: "verified", reason: L(`Skript "${script}" in package.json.`, `Script "${script}" in package.json.`) };
    return { status: "unverified", reason: L(`Skript "${script}" nicht in package.json gefunden.`, `Script "${script}" not found in package.json.`) };
  }
  if ((m = cmd.match(/^(?:pip3?\s+install|pipx\s+install|uv\s+(?:add|tool\s+install|pip\s+install)|poetry\s+add)\b(.*)$/i))) {
    const pkgs = packageArgs(m[1] ?? "").map((p) => pyNorm(stripVersion(p)));
    const py = byEco("python");
    if (py?.name && pkgs.length > 0 && pkgs.every((p) => p === pyNorm(py.name!))) return { status: "verified", reason: L("Paketname entspricht pyproject.toml.", "Package name matches pyproject.toml.") };
    return { status: "unverified", reason: L("Paketname nicht durch pyproject.toml belegt.", "Package name not evidenced by pyproject.toml.") };
  }
  if ((m = cmd.match(/^cargo\s+(?:install|add)\b(.*)$/i))) {
    const pkgs = packageArgs(m[1] ?? "");
    const c = byEco("cargo");
    if (c?.name && pkgs.length > 0 && pkgs.every((p) => p === c.name)) return { status: "verified", reason: L("Crate-Name entspricht Cargo.toml.", "Crate name matches Cargo.toml.") };
    return { status: "unverified", reason: L("Crate-Name nicht durch Cargo.toml belegt.", "Crate name not evidenced by Cargo.toml.") };
  }
  if ((m = cmd.match(/^go\s+(?:install|get)\s+(\S+)/i))) {
    const mod = (m[1] ?? "").split("@")[0] ?? "";
    const g = byEco("go");
    if (g?.name && (mod === g.name || mod.startsWith(`${g.name}/`))) return { status: "verified", reason: L("Modulpfad entspricht go.mod.", "Module path matches go.mod.") };
    return { status: "unverified", reason: L("Modulpfad nicht durch go.mod belegt.", "Module path not evidenced by go.mod.") };
  }
  if ((m = cmd.match(/^composer\s+require\s+(\S+)/i))) {
    const c = byEco("composer");
    if (c?.name && stripVersion(m[1] ?? "") === c.name) return { status: "verified", reason: L("Paketname entspricht composer.json.", "Package name matches composer.json.") };
    return { status: "unverified", reason: L("Paketname nicht durch composer.json belegt.", "Package name not evidenced by composer.json.") };
  }
  if ((m = cmd.match(/^git\s+clone\s+(\S+)/i))) {
    const url = (m[1] ?? "").replace(/\.git$/, "").replace(/\/$/, "").toLowerCase();
    if (url === `https://github.com/${ctx.owner}/${ctx.repo}`.toLowerCase()) return { status: "verified", reason: L("Klon-Adresse des analysierten Repositorys.", "Clone URL of the analysed repository.") };
    return { status: "unverified", reason: L("Klon-Adresse weicht vom analysierten Repository ab.", "Clone URL differs from the analysed repository.") };
  }
  if (isInstallCommand(cmd)) {
    return { status: "unverified", reason: L("Installationsbefehl nicht wörtlich in der README und nicht aus Manifesten ableitbar.", "Install command not verbatim in the README and not derivable from manifests.") };
  }
  const first = cmd.split(" ")[0] ?? "";
  if (ctx.manifests.some((x) => x.binNames.includes(first))) {
    return { status: "verified", reason: L("Befehlsname aus dem Manifest; Optionen nicht geprüft.", "Command name from the manifest; options not checked.") };
  }
  return { status: "unverified", reason: L("Befehl nicht in README oder Manifesten belegt.", "Command not evidenced in README or manifests.") };
}

export function verifyPath(target: string, ctx: VerifyContext): { status: "verified" | "unverified"; reason: Localized } | null {
  if (/^(https?:|mailto:|#|\/\/)/i.test(target) || target.startsWith("#")) return null;
  const clean = target.replace(/^\.\//, "").replace(/[?#].*$/, "").replace(/\/$/, "");
  if (!clean || clean.startsWith("/") || clean.includes("..")) {
    return { status: "unverified", reason: L("Pfad außerhalb des Repositorys oder absolut.", "Path outside the repository or absolute.") };
  }
  const lower = clean.toLowerCase();
  if (ctx.treePaths.some((p) => p.toLowerCase() === lower)) return { status: "verified", reason: L("Pfad existiert im gelesenen Stand.", "Path exists in the scanned state.") };
  const dir = lower.includes("/") ? lower.slice(0, lower.lastIndexOf("/")) : "";
  const top = lower.split("/")[0] ?? "";
  if (dir && !ctx.treePaths.some((p) => p.toLowerCase() === top)) {
    return { status: "unverified", reason: L("Pfad existiert im gelesenen Stand nicht.", "Path does not exist in the scanned state.") };
  }
  if (!ctx.scannedDirs.map((d) => d.toLowerCase()).includes(dir)) {
    return { status: "unverified", reason: L("Verzeichnis wurde nicht gelesen; Pfad nicht prüfbar.", "Directory was not read; path cannot be checked.") };
  }
  return { status: "unverified", reason: L("Pfad existiert im gelesenen Stand nicht.", "Path does not exist in the scanned state.") };
}

const CLAIM_PATTERNS: { re: RegExp; key: (m: RegExpMatchArray) => string }[] = [
  { re: /\b\d+([.,]\d+)?\s?(x|×|%|times|mal)\s+(faster|quicker|smaller|lighter|less|more|schneller|kleiner|leichter|weniger|mehr)\b/gi, key: (m) => m[0] },
  { re: /\b(faster|quicker|schneller)\s+(than|als)\b/gi, key: (m) => m[0] },
  { re: /\bbenchmarks?\b/gi, key: () => "benchmark" },
  { re: /\b(trusted by|used by|loved by|vertrauen auf|genutzt von)\b/gi, key: (m) => m[0] },
  { re: /\b\d[\d.,]*\+?\s+(?:[\p{L}-]+\s+){0,2}(users|downloads|customers|companies|teams|stars|installs|developers|nutzer\p{L}*|kunden|unternehmen|installationen|entwickler\p{L}*)\b/giu, key: (m) => m[0] },
  { re: /\b(gdpr|dsgvo|hipaa|soc ?2|iso ?27001|pci[- ]dss)\b/gi, key: (m) => m[0] },
  { re: /\b(end-to-end[- ]encrypted|ende-zu-ende-verschlüsselt|security[- ]audited|sicherheitsgeprüft|audited|zertifiziert|certified|compliant|konform)\b/gi, key: (m) => m[0] },
  { re: /\b(testimonial|„[^“]{10,}“\s*[\u2013-]|"[^"]{10,}"\s*(\u2014|-)\s*[A-Z])/g, key: (m) => m[0] },
];

export function findUnverifiedClaims(text: string, ctx: VerifyContext): string[] {
  const source = ctx.sourceText.toLowerCase();
  const out: string[] = [];
  for (const p of CLAIM_PATTERNS) {
    for (const m of text.matchAll(p.re)) {
      const key = p.key(m).toLowerCase().trim();
      if (!source.includes(key)) out.push(p.key(m).trim());
    }
  }
  return [...new Set(out)].slice(0, 30);
}

export function verifyLink(url: string, ctx: VerifyContext): { status: "verified" | "unverified"; reason: Localized } | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  const host = u.hostname.toLowerCase();
  if (host === "github.com" && u.pathname.toLowerCase().startsWith(`/${ctx.owner}/${ctx.repo}`.toLowerCase())) return { status: "verified", reason: L("Link auf das analysierte Repository.", "Link to the analysed repository.") };
  if (ctx.homepageHost && host === ctx.homepageHost) return { status: "verified", reason: L("Host aus dem Website-Feld.", "Host from the website field.") };
  if (REGISTRY_HOSTS.includes(host)) return { status: "verified", reason: L("Bekannter Register- oder Dokumentationshost.", "Known registry or documentation host.") };
  if (ctx.sourceText.includes(url)) return { status: "verified", reason: L("Link stammt aus den Quellen.", "Link comes from the sources.") };
  return { status: "unverified", reason: L("Link nicht durch die gelesenen Quellen belegt.", "Link not evidenced by the sources that were read.") };
}

/** Prüft ein Markdown-Dokument und gibt Hinweise sowie eine annotierte Fassung zurück. */
export function verifyMarkdown(section: AiSection, md: string, ctx: VerifyContext, lang: "de" | "en"): { notes: VerificationNote[]; annotated: string } {
  const notes: VerificationNote[] = [];
  const doc = parseMarkdown(md);
  const unverifiedByBlockEnd = new Map<number, string[]>();
  for (const block of doc.codeBlocks) {
    for (const line of block.content.split("\n")) {
      const r = verifyCommand(line, ctx);
      if (!r) continue;
      notes.push({ section, kind: "command", value: norm(line).slice(0, 200), status: r.status, reason: r.reason });
      if (r.status === "unverified") {
        const list = unverifiedByBlockEnd.get(block.endLine) ?? [];
        list.push(norm(line).slice(0, 200));
        unverifiedByBlockEnd.set(block.endLine, list);
      }
    }
  }
  for (const link of doc.links) {
    const r = /^https?:/i.test(link.target) ? verifyLink(link.target, ctx) : verifyPath(link.target, ctx);
    if (!r) continue;
    notes.push({ section, kind: /^https?:/i.test(link.target) ? "link" : "path", value: link.target.slice(0, 200), status: r.status, reason: r.reason });
  }
  for (const claim of findUnverifiedClaims(md, ctx)) {
    notes.push({ section, kind: "claim", value: claim, status: "unverified", reason: L("Aussage nicht in den gelesenen Quellen belegt.", "Statement not evidenced in the sources that were read.") });
  }
  const marker = lang === "de" ? "UNGEPRÜFT" : "UNVERIFIED";
  const annotatedLines: string[] = [];
  doc.lines.forEach((l, i) => {
    annotatedLines.push(l);
    const list = unverifiedByBlockEnd.get(i + 1);
    if (list) {
      annotatedLines.push("");
      for (const c of list) annotatedLines.push(`> ${marker}: \`${c.replace(/`/g, "'")}\` ${lang === "de" ? "ist nicht durch README oder Manifeste belegt." : "is not evidenced by the README or manifests."}`);
    }
  });
  return { notes, annotated: annotatedLines.join("\n") };
}

export function verifyPlainText(section: AiSection, text: string, ctx: VerifyContext): VerificationNote[] {
  const notes: VerificationNote[] = [];
  for (const claim of findUnverifiedClaims(text, ctx)) {
    notes.push({ section, kind: "claim", value: claim, status: "unverified", reason: L("Aussage nicht in den gelesenen Quellen belegt.", "Statement not evidenced in the sources that were read.") });
  }
  for (const m of text.matchAll(/https?:\/\/[^\s)>\]]+/g)) {
    const r = verifyLink(m[0], ctx);
    if (r) notes.push({ section, kind: "link", value: m[0].slice(0, 200), status: r.status, reason: r.reason });
  }
  return notes;
}
