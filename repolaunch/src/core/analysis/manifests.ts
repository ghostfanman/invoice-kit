// Liest Paketmanifeste rein textuell. Es wird nichts installiert oder ausgeführt.

import type { RepoSnapshot } from "../types";

export interface ManifestInfo {
  ecosystem: "npm" | "python" | "cargo" | "go" | "composer" | "github-action";
  path: string;
  name: string | null;
  isPrivate: boolean;
  hasBin: boolean;
  binNames: string[];
  isLibrary: boolean;
  scripts: string[];
  dependencies: string[];
  runtimeRequirement: string | null;
}

/** Sehr kleiner TOML-Leser für Abschnitte und einfache Schlüssel. Ausreichend für Name, Skripte und Versionen. */
export function parseSimpleToml(text: string): Map<string, Map<string, string>> {
  const sections = new Map<string, Map<string, string>>();
  let current = "";
  sections.set(current, new Map());
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/\s+#.*$/, "").trim();
    if (!line || line.startsWith("#")) continue;
    const sec = line.match(/^\[\[?\s*([^\]]+?)\s*\]\]?$/);
    if (sec) {
      current = sec[1]!;
      if (line.startsWith("[[")) current = `${current}[]`;
      if (!sections.has(current)) sections.set(current, new Map());
      continue;
    }
    const kv = line.match(/^("?[\w.-]+"?)\s*=\s*(.+)$/);
    if (kv) {
      const key = kv[1]!.replace(/"/g, "");
      const value = kv[2]!.trim().replace(/^["']|["']$/g, "");
      sections.get(current)!.set(key, value);
    }
  }
  return sections;
}

export function readManifests(snapshot: RepoSnapshot): ManifestInfo[] {
  const out: ManifestInfo[] = [];
  for (const file of Object.values(snapshot.files)) {
    if (file.state !== "present") continue;
    const lower = file.path.toLowerCase();
    try {
      if (lower === "package.json") out.push(parsePackageJson(file.path, file.text));
      else if (lower === "pyproject.toml") out.push(parsePyproject(file.path, file.text));
      else if (lower === "cargo.toml") out.push(parseCargo(file.path, file.text));
      else if (lower === "go.mod") out.push(parseGoMod(file.path, file.text, snapshot));
      else if (lower === "composer.json") out.push(parseComposer(file.path, file.text));
      else if (lower === "action.yml" || lower === "action.yaml") out.push(parseAction(file.path, file.text));
    } catch {
      // Ungültige Manifeste werden ignoriert; die Regeln behandeln fehlende Angaben als unbekannt.
    }
  }
  return out;
}

function parsePackageJson(path: string, text: string): ManifestInfo {
  const pkg = JSON.parse(text) as Record<string, unknown>;
  const bin = pkg.bin;
  const name = typeof pkg.name === "string" ? pkg.name : null;
  const binNames = typeof bin === "string" ? (name ? [name.replace(/^@[^/]+\//, "")] : []) : bin && typeof bin === "object" ? Object.keys(bin) : [];
  const deps = { ...(obj(pkg.dependencies)), ...(obj(pkg.devDependencies)) };
  const engines = obj(pkg.engines);
  return {
    ecosystem: "npm",
    path,
    name,
    isPrivate: pkg.private === true,
    hasBin: binNames.length > 0,
    binNames,
    isLibrary: Boolean(pkg.main || pkg.exports || pkg.module || pkg.types || pkg.typings) && binNames.length === 0,
    scripts: Object.keys(obj(pkg.scripts)),
    dependencies: Object.keys(deps),
    runtimeRequirement: typeof engines.node === "string" ? `node ${engines.node}` : null,
  };
}

function parsePyproject(path: string, text: string): ManifestInfo {
  const t = parseSimpleToml(text);
  const project = t.get("project");
  const poetry = t.get("tool.poetry");
  const scripts = [...(t.get("project.scripts")?.keys() ?? []), ...(t.get("tool.poetry.scripts")?.keys() ?? [])];
  const requires = project?.get("requires-python") ?? null;
  return {
    ecosystem: "python",
    path,
    name: project?.get("name") ?? poetry?.get("name") ?? null,
    isPrivate: false,
    hasBin: scripts.length > 0,
    binNames: scripts,
    isLibrary: scripts.length === 0,
    scripts: [],
    dependencies: [],
    runtimeRequirement: requires ? `python ${requires}` : null,
  };
}

function parseCargo(path: string, text: string): ManifestInfo {
  const t = parseSimpleToml(text);
  const pkg = t.get("package");
  const hasBinSection = t.has("bin[]");
  const hasLib = t.has("lib");
  const rustVersion = pkg?.get("rust-version");
  return {
    ecosystem: "cargo",
    path,
    name: pkg?.get("name") ?? null,
    isPrivate: pkg?.get("publish") === "false",
    hasBin: hasBinSection,
    binNames: hasBinSection ? [t.get("bin[]")?.get("name") ?? pkg?.get("name") ?? "bin"] : [],
    isLibrary: hasLib || !hasBinSection,
    scripts: [],
    dependencies: [...(t.get("dependencies")?.keys() ?? [])],
    runtimeRequirement: rustVersion ? `rust ${rustVersion}` : null,
  };
}

function parseGoMod(path: string, text: string, snapshot: RepoSnapshot): ManifestInfo {
  const mod = text.match(/^module\s+(\S+)/m)?.[1] ?? null;
  const goVersion = text.match(/^go\s+(\S+)/m)?.[1] ?? null;
  const rootNames = snapshot.tree.entries.map((e) => e.path.toLowerCase());
  const hasMain = rootNames.includes("main.go") || rootNames.includes("cmd");
  return {
    ecosystem: "go",
    path,
    name: mod,
    isPrivate: false,
    hasBin: hasMain,
    binNames: hasMain && mod ? [mod.split("/").pop() ?? mod] : [],
    isLibrary: !hasMain,
    scripts: [],
    dependencies: [],
    runtimeRequirement: goVersion ? `go ${goVersion}` : null,
  };
}

function parseComposer(path: string, text: string): ManifestInfo {
  const c = JSON.parse(text) as Record<string, unknown>;
  const bin = Array.isArray(c.bin) ? c.bin.filter((b): b is string => typeof b === "string") : [];
  const req = obj(c.require);
  return {
    ecosystem: "composer",
    path,
    name: typeof c.name === "string" ? c.name : null,
    isPrivate: false,
    hasBin: bin.length > 0,
    binNames: bin,
    isLibrary: c.type === "library" || (c.type === undefined && bin.length === 0),
    scripts: Object.keys(obj(c.scripts)),
    dependencies: Object.keys(req),
    runtimeRequirement: typeof req.php === "string" ? `php ${req.php}` : null,
  };
}

function parseAction(path: string, text: string): ManifestInfo {
  const name = text.match(/^name:\s*["']?(.+?)["']?\s*$/m)?.[1] ?? null;
  return {
    ecosystem: "github-action",
    path,
    name,
    isPrivate: false,
    hasBin: false,
    binNames: [],
    isLibrary: false,
    scripts: [],
    dependencies: [],
    runtimeRequirement: null,
  };
}

function obj(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}
