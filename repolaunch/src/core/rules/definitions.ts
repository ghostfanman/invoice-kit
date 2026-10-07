// Regeldefinitionen. Jede Regel liefert einen Zustand (vorhanden, fehlt, unbekannt, nicht relevant)
// mit Belegen aus dem begrenzten Scan. Gewichte stehen getrennt in config.ts.

import type { MarkdownDoc } from "../analysis/markdown";
import { findHeading, installCommands, introParagraph, sectionRange, snippet } from "../analysis/markdown";
import type { ManifestInfo } from "../analysis/manifests";
import type { Category, Evidence, Language, Localized, ProjectType, RepoSnapshot, UserContext } from "../types";

export interface RuleContext {
  snapshot: RepoSnapshot;
  user: UserContext;
  projectType: ProjectType;
  readme: MarkdownDoc | null;
  readmePath: string | null;
  manifests: ManifestInfo[];
  now: Date;
  lang: Language;
}

export interface RuleOutcome {
  status: "present" | "missing" | "unknown" | "not_relevant";
  evidence: Evidence[];
  /** Zusätzliche Begründung, z. B. warum etwas unbekannt oder nicht relevant ist. */
  note?: Localized;
}

export interface RuleDefinition {
  id: string;
  version: number;
  category: Category;
  /** Regel prüft README-Inhalt. Fehlt die README, wird die Aufgabe in "README erstellen" gebündelt. */
  readmeContent: boolean;
  title: Localized;
  rationale: Localized;
  task: Localized;
  effortMinutes: [number, number];
  impact: Localized;
  evaluate(ctx: RuleContext): RuleOutcome;
}

// ---------- Hilfsfunktionen ----------

const tr = (ctx: { lang: Language }, de: string, en: string) => (ctx.lang === "de" ? de : en);

export function fileUrl(s: RepoSnapshot, path: string, lines?: [number, number]): string {
  const p = path.split("/").map(encodeURIComponent).join("/");
  const anchor = lines ? `#L${lines[0]}-L${lines[1]}` : "";
  return `${s.htmlUrl}/blob/${s.commitSha}/${p}${anchor}`;
}

function apiField(s: RepoSnapshot, label: string, value: string): Evidence {
  return { kind: "field", label, url: s.htmlUrl, snippet: value };
}

function readmeEvidence(ctx: RuleContext, label: string, start: number, end: number): Evidence {
  const path = ctx.readmePath ?? "README.md";
  return {
    kind: "file",
    label,
    path,
    lines: [start, end],
    url: fileUrl(ctx.snapshot, path, [start, end]),
    snippet: ctx.readme ? snippet(ctx.readme, start, end) : undefined,
  };
}

function readmeAbsence(ctx: RuleContext, searched: string): Evidence {
  const path = ctx.readmePath ?? "README.md";
  return { kind: "absence", label: `${path}: ${searched}`, path, url: fileUrl(ctx.snapshot, path) };
}

/** Ergebnis für README-Regeln, wenn die README fehlt oder nicht lesbar ist. */
function readmeUnavailable(ctx: RuleContext): RuleOutcome | null {
  const r = ctx.snapshot.readme;
  if (r.state === "missing") {
    return { status: "missing", evidence: [{ kind: "absence", label: tr(ctx, "GET /repos/{owner}/{repo}/readme: keine README gefunden (404)", "GET /repos/{owner}/{repo}/readme: no README found (404)"), url: ctx.snapshot.htmlUrl }] };
  }
  if (r.state === "unknown" || !ctx.readme) {
    return {
      status: "unknown",
      evidence: [{ kind: "note", label: r.state === "unknown" ? tr(ctx, `README nicht auswertbar: ${r.reason.de}`, `README not evaluable: ${r.reason.en}`) : tr(ctx, "README nicht gelesen", "README not read") }],
      note: { de: "README konnte nicht ausgewertet werden.", en: "The README could not be evaluated." },
    };
  }
  return null;
}

type FileSearch =
  | { state: "present"; path: string }
  | { state: "missing"; searched: string }
  | { state: "unknown"; reason: Localized };

/** Sucht Dateien nach Basisnamen (ohne Groß-/Kleinschreibung) in den gelesenen Verzeichnissen. */
export function findFile(s: RepoSnapshot, baseNames: string[], dirs: string[]): FileSearch {
  const names = baseNames.map((n) => n.toLowerCase());
  for (const e of s.tree.entries) {
    if (e.type !== "blob") continue;
    const idx = e.path.lastIndexOf("/");
    const dir = idx === -1 ? "" : e.path.slice(0, idx).toLowerCase();
    const base = (idx === -1 ? e.path : e.path.slice(idx + 1)).toLowerCase();
    if (dirs.includes(dir) && names.includes(base)) return { state: "present", path: e.path };
  }
  const scanned = s.tree.scannedDirs.map((d) => d.toLowerCase());
  const existingDirs = new Set(s.tree.entries.filter((e) => e.type === "tree").map((e) => e.path.toLowerCase()));
  const unscanned = dirs.filter((d) => d !== "" && existingDirs.has(d) && !scanned.includes(d));
  if (s.tree.truncated || unscanned.length > 0) {
    return {
      state: "unknown",
      reason: s.tree.truncated
        ? { de: "Dateiliste gekürzt", en: "file list truncated" }
        : { de: `Verzeichnis nicht gelesen: ${unscanned.join(", ")}`, en: `directory not read: ${unscanned.join(", ")}` },
    };
  }
  const where = dirs.map((d) => (d === "" ? "/" : `${d}/`)).join(", ");
  return { state: "missing", searched: `${baseNames.join(", ")} in ${where}` };
}

function fileOutcome(ctx: RuleContext, search: FileSearch, label: string): RuleOutcome {
  // label ist ein Dateiname oder Fachbegriff und bleibt unübersetzt.
  if (search.state === "present") {
    return { status: "present", evidence: [{ kind: "file", label, path: search.path, url: fileUrl(ctx.snapshot, search.path) }] };
  }
  if (search.state === "missing") {
    return { status: "missing", evidence: [{ kind: "absence", label: tr(ctx, `Dateiliste @ ${ctx.snapshot.commitSha.slice(0, 7)}: keine Datei ${search.searched}`, `File list @ ${ctx.snapshot.commitSha.slice(0, 7)}: no file ${search.searched}`), url: `${ctx.snapshot.htmlUrl}/tree/${ctx.snapshot.commitSha}` }] };
  }
  return { status: "unknown", evidence: [{ kind: "note", label: search.reason[ctx.lang] }], note: { de: `Nicht prüfbar: ${search.reason.de}.`, en: `Could not be checked: ${search.reason.en}.` } };
}

function linkMatches(doc: MarkdownDoc, pred: (target: string, text: string, image: boolean) => boolean) {
  return doc.links.filter((l) => pred(l.target.toLowerCase(), l.text.toLowerCase(), l.image));
}

const BADGE_RE = /(shields\.io|badge|badgen\.net|\/badges?\/|codecov\.io|coveralls|travis-ci|circleci|github\.com\/[^/]+\/[^/]+\/actions\/workflows|\.svg(\?|$)|img\.shields)/;
const REGISTRY_RE = /(npmjs\.com\/package|npmjs\.org\/package|pypi\.org\/project|crates\.io\/crates|pkg\.go\.dev|packagist\.org\/packages|rubygems\.org\/gems|hub\.docker\.com|ghcr\.io|marketplace\.visualstudio\.com|github\.com\/marketplace|jsr\.io\/@|nuget\.org\/packages|formulae\.brew\.sh)/;
const FUNDING_RE = /(github\.com\/sponsors|opencollective\.com|patreon\.com|ko-fi\.com|buymeacoffee\.com|liberapay\.com|polar\.sh|thanks\.dev)/;

function daysSince(iso: string | null, now: Date): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : Math.floor((now.getTime() - t) / 86_400_000);
}

// ---------- Regeln ----------

export const RULES: RuleDefinition[] = [
  {
    id: "understanding.description",
    version: 1,
    category: "understanding",
    readmeContent: false,
    title: { de: "Aussagekräftige Repository-Beschreibung", en: "Meaningful repository description" },
    rationale: {
      de: "Die Beschreibung erscheint in Suchergebnissen, Vorschauen und Listen. Sie ist oft der erste Kontakt.",
      en: "The description appears in search results, previews and lists. It is often the first contact.",
    },
    task: {
      de: "Formuliere die Beschreibung als einen Satz: Was ist das Projekt, für wen, welcher Nutzen.",
      en: "Write the description as one sentence: what the project is, who it is for, what it does for them.",
    },
    effortMinutes: [5, 15],
    impact: {
      de: "Besucher erkennen schneller, ob das Projekt zu ihrem Problem passt.",
      en: "Visitors recognise faster whether the project fits their problem.",
    },
    evaluate(ctx) {
      const d = ctx.snapshot.meta.description?.trim() ?? "";
      const ev = apiField(ctx.snapshot, "GitHub API: description", d || tr(ctx, "(leer)", "(empty)"));
      const sameAsName = d.toLowerCase().replace(/[^a-z0-9]/g, "") === ctx.snapshot.repo.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (d.length >= 25 && !sameAsName) return { status: "present", evidence: [ev] };
      return {
        status: "missing",
        evidence: [ev],
        note: d
          ? { de: "Beschreibung ist sehr kurz oder wiederholt nur den Namen.", en: "Description is very short or only repeats the name." }
          : { de: "Keine Beschreibung gesetzt.", en: "No description set." },
      };
    },
  },
  {
    id: "understanding.readme",
    version: 1,
    category: "understanding",
    readmeContent: false,
    title: { de: "README vorhanden", en: "README present" },
    rationale: {
      de: "Die README ist laut GitHub meist das Erste, was Besucher sehen. Ohne sie fehlt jede Erklärung.",
      en: "According to GitHub, the README is often the first item visitors see. Without it there is no explanation.",
    },
    task: {
      de: "Lege eine README.md an: Zweck, Zielgruppe, Installation, Beispiel, Lizenz, Kontakt.",
      en: "Create a README.md: purpose, audience, installation, example, license, contact.",
    },
    effortMinutes: [60, 180],
    impact: {
      de: "Ohne README bleiben die meisten Besucher nicht; mit README steigt die Zahl ernsthafter Nutzungsversuche.",
      en: "Without a README most visitors leave; with one, serious usage attempts increase.",
    },
    evaluate(ctx) {
      const r = ctx.snapshot.readme;
      if (r.state === "present") {
        return { status: "present", evidence: [{ kind: "file", label: `${r.path} (${r.size} B)`, path: r.path, url: fileUrl(ctx.snapshot, r.path) }] };
      }
      if (r.state === "missing") return readmeUnavailable(ctx)!;
      return { status: "unknown", evidence: [{ kind: "note", label: tr(ctx, `README nicht auswertbar: ${r.reason.de}`, `README not evaluable: ${r.reason.en}`) }], note: r.reason };
    },
  },
  {
    id: "understanding.intro",
    version: 1,
    category: "understanding",
    readmeContent: true,
    title: { de: "Einleitender Absatz in der README", en: "Introductory paragraph in the README" },
    rationale: {
      de: "Ein kurzer Absatz direkt unter dem Titel erklärt Zweck und Nutzen, bevor Details folgen.",
      en: "A short paragraph right below the title explains purpose and benefit before details follow.",
    },
    task: {
      de: "Schreibe unter den Titel zwei bis drei Sätze: Problem, Lösung, für wen.",
      en: "Below the title, write two or three sentences: problem, solution, for whom.",
    },
    effortMinutes: [15, 45],
    impact: {
      de: "Weniger Absprünge auf der Repository-Seite, weniger Grundsatzfragen in Issues.",
      en: "Fewer bounces from the repository page and fewer basic questions in issues.",
    },
    evaluate(ctx) {
      const u = readmeUnavailable(ctx);
      if (u) return u;
      const intro = introParagraph(ctx.readme!);
      if (intro && intro.text.length >= 60) return { status: "present", evidence: [readmeEvidence(ctx, tr(ctx, "Einleitung", "Introduction"), intro.start, intro.end)] };
      return {
        status: "missing",
        evidence: intro ? [readmeEvidence(ctx, tr(ctx, "Kurzer Einleitungstext", "Short introduction"), intro.start, intro.end)] : [readmeAbsence(ctx, tr(ctx, "kein Fließtext vor dem ersten Codeblock bzw. zweiten Abschnitt", "no prose before the first code block or second section"))],
      };
    },
  },
  {
    id: "understanding.audience",
    version: 1,
    category: "understanding",
    readmeContent: true,
    title: { de: "Zielgruppe und Nutzen benannt", en: "Audience and benefits stated" },
    rationale: {
      de: "Besucher entscheiden schneller, wenn Funktionen, Anwendungsfälle oder die Zielgruppe ausdrücklich genannt sind.",
      en: "Visitors decide faster when features, use cases or the target audience are stated explicitly.",
    },
    task: {
      de: "Ergänze einen Abschnitt \"Funktionen\" oder \"Für wen\" mit drei bis fünf konkreten Punkten.",
      en: "Add a \"Features\" or \"Who is this for\" section with three to five concrete points.",
    },
    effortMinutes: [20, 60],
    impact: {
      de: "Passende Nutzer erkennen sich wieder, unpassende Anfragen nehmen ab.",
      en: "The right users recognise themselves, unsuitable requests decrease.",
    },
    evaluate(ctx) {
      const u = readmeUnavailable(ctx);
      if (u) return u;
      const doc = ctx.readme!;
      const h = findHeading(doc, [/(features?|why|motivation|use ?cases?|who (is )?(this|it) for|benefits|highlights|funktionen|warum|anwendungsf(ä|ae)lle|vorteile|zielgruppe|für wen|fuer wen)/i]);
      if (h) {
        const [s, e] = sectionRange(doc, h);
        return { status: "present", evidence: [readmeEvidence(ctx, tr(ctx, `Abschnitt "${h.text}"`, `Section "${h.text}"`), s, Math.min(e, s + 8))] };
      }
      const line = doc.proseLines.find((p) => /\b(for|für|fuer)\s+(developers|teams|maintainers|engineers|designers|data scientists|admins|sres?|anyone|people who|entwickler\w*|teams|admins|nutzer\w*|alle, die)/i.test(p.text));
      if (line) return { status: "present", evidence: [readmeEvidence(ctx, tr(ctx, "Zielgruppe im Text genannt", "Audience mentioned in the text"), line.line, line.line)] };
      return { status: "missing", evidence: [readmeAbsence(ctx, tr(ctx, "keine Überschrift wie Features/Why/Use cases/Funktionen und keine Zielgruppennennung", "no heading such as Features/Why/Use cases and no audience mentioned"))] };
    },
  },
  {
    id: "understanding.example",
    version: 1,
    category: "understanding",
    readmeContent: true,
    title: { de: "Konkretes Nutzungsbeispiel", en: "Concrete usage example" },
    rationale: {
      de: "Ein kurzes Beispiel zeigt schneller als jede Beschreibung, wie sich das Projekt anfühlt.",
      en: "A short example shows faster than any description what using the project feels like.",
    },
    task: {
      de: "Füge ein minimales, lauffähiges Beispiel mit erwarteter Ausgabe hinzu.",
      en: "Add a minimal, runnable example including the expected output.",
    },
    effortMinutes: [20, 60],
    impact: {
      de: "Mehr erfolgreiche erste Nutzungen, weniger Fragen zur Grundbedienung.",
      en: "More successful first uses and fewer questions about basic usage.",
    },
    evaluate(ctx) {
      const u = readmeUnavailable(ctx);
      if (u) return u;
      const doc = ctx.readme!;
      const h = findHeading(doc, [/^(usage|examples?|demo|how to use|tutorial|quick example|verwendung|beispiele?|nutzung|anwendung|benutzung)\b/i]);
      if (h) {
        const [s, e] = sectionRange(doc, h);
        const block = doc.codeBlocks.find((b) => b.startLine > s && b.startLine <= e);
        if (block) return { status: "present", evidence: [readmeEvidence(ctx, tr(ctx, `Abschnitt "${h.text}" mit Codebeispiel`, `Section "${h.text}" with code example`), block.startLine, block.endLine)] };
      }
      const nonInstall = doc.codeBlocks.find((b) => b.content.split("\n").some((l) => l.trim() && !installCommands({ ...doc, codeBlocks: [{ ...b, content: l }] }).length && !/^\s*(\$\s*)?(cd|ls|#)\b/.test(l)));
      if (nonInstall) return { status: "present", evidence: [readmeEvidence(ctx, tr(ctx, "Codebeispiel", "Code example"), nonInstall.startLine, nonInstall.endLine)] };
      return { status: "missing", evidence: [readmeAbsence(ctx, tr(ctx, "kein Codeblock außer Installationsbefehlen und kein Abschnitt Usage/Example/Verwendung mit Code", "no code block other than install commands and no Usage/Example section with code"))] };
    },
  },
  {
    id: "usability.quickstart",
    version: 1,
    category: "usability",
    readmeContent: true,
    title: { de: "Dokumentierter Schnellstart", en: "Documented quickstart" },
    rationale: {
      de: "Ein klarer erster Schritt (Installation oder Start) ist die Voraussetzung jeder Nutzung.",
      en: "A clear first step (installation or start) is the precondition for any usage.",
    },
    task: {
      de: "Ergänze einen Abschnitt \"Installation\" oder \"Schnellstart\" mit den exakten Befehlen.",
      en: "Add an \"Installation\" or \"Quickstart\" section with the exact commands.",
    },
    effortMinutes: [15, 45],
    impact: {
      de: "Mehr Besucher probieren das Projekt tatsächlich aus.",
      en: "More visitors actually try the project.",
    },
    evaluate(ctx) {
      const u = readmeUnavailable(ctx);
      if (u) return u;
      const doc = ctx.readme!;
      const h = findHeading(doc, [/^(install(ation|ing)?|getting started|get started|quick ?start|setup|set ?up|running locally|run locally|schnellstart|erste schritte|einrichtung|loslegen|lokal starten)\b/i]);
      if (h) {
        const [s, e] = sectionRange(doc, h);
        return { status: "present", evidence: [readmeEvidence(ctx, tr(ctx, `Abschnitt "${h.text}"`, `Section "${h.text}"`), s, Math.min(e, s + 10))] };
      }
      const cmds = installCommands(doc);
      if (cmds.length > 0) return { status: "present", evidence: [readmeEvidence(ctx, tr(ctx, "Installationsbefehl", "Install command"), cmds[0]!.line, cmds[0]!.line)] };
      return { status: "missing", evidence: [readmeAbsence(ctx, tr(ctx, "keine Überschrift Installation/Getting Started/Quickstart/Setup/Schnellstart und kein Installationsbefehl", "no Installation/Getting Started/Quickstart/Setup heading and no install command"))] };
    },
  },
  {
    id: "usability.prerequisites",
    version: 1,
    category: "usability",
    readmeContent: true,
    title: { de: "Voraussetzungen genannt", en: "Prerequisites stated" },
    rationale: {
      de: "Fehlende Angaben zu Laufzeit oder Versionen führen zu fehlgeschlagenen ersten Versuchen.",
      en: "Missing runtime or version information leads to failed first attempts.",
    },
    task: {
      de: "Nenne vor der Installation Laufzeit und Mindestversionen (z. B. Node, Python, Docker).",
      en: "State runtime and minimum versions (e.g. Node, Python, Docker) before the installation steps.",
    },
    effortMinutes: [10, 20],
    impact: {
      de: "Weniger Issues zu Installationsfehlern.",
      en: "Fewer issues about installation failures.",
    },
    evaluate(ctx) {
      const u = readmeUnavailable(ctx);
      if (u) return u;
      const doc = ctx.readme!;
      const h = findHeading(doc, [/(prerequisites|requirements|dependencies|system requirements|voraussetzungen|anforderungen|systemvoraussetzungen)/i]);
      if (h) return { status: "present", evidence: [readmeEvidence(ctx, tr(ctx, `Abschnitt "${h.text}"`, `Section "${h.text}"`), h.line, Math.min(h.line + 6, doc.lines.length))] };
      const line = doc.proseLines.find((p) => /\b(requires?|required|needs|benötigt|erfordert|voraussetzung\w*)\b.{0,60}\b(node(\.js)?|python|go|rust|java|jdk|docker|php|ruby|\.net|deno|bun|version|postgres\w*|redis)\b/i.test(p.text));
      if (line) return { status: "present", evidence: [readmeEvidence(ctx, tr(ctx, "Voraussetzung im Text", "Prerequisite in the text"), line.line, line.line)] };
      const m = ctx.manifests.find((x) => x.runtimeRequirement);
      if (m) {
        return {
          status: "present",
          evidence: [{ kind: "file", label: `Manifest ${m.path}: ${m.runtimeRequirement}`, path: m.path, url: fileUrl(ctx.snapshot, m.path), snippet: m.runtimeRequirement ?? undefined }],
          note: { de: "Nur im Manifest angegeben, nicht in der README.", en: "Only stated in the manifest, not in the README." },
        };
      }
      return { status: "missing", evidence: [readmeAbsence(ctx, tr(ctx, "keine Voraussetzungen/Requirements genannt; kein engines/requires-python/rust-version im Manifest", "no prerequisites/requirements stated; no engines/requires-python/rust-version in the manifest"))] };
    },
  },
  {
    id: "usability.visual_demo",
    version: 1,
    category: "usability",
    readmeContent: true,
    title: { de: "Screenshot, Animation oder Demo", en: "Screenshot, animation or demo" },
    rationale: {
      de: "Bei sichtbaren Produkten zeigt ein Bild sofort, was man bekommt. Bei CLIs ist es ein Pluspunkt, kein Muss.",
      en: "For visual products an image immediately shows what you get. For CLIs it is a plus, not a must.",
    },
    task: {
      de: "Füge einen aktuellen Screenshot, eine kurze Aufnahme oder einen Demo-Link in die README ein.",
      en: "Add a current screenshot, a short recording or a demo link to the README.",
    },
    effortMinutes: [20, 60],
    impact: {
      de: "Höhere Klickrate auf Demo bzw. Installation, besonders bei Webprodukten.",
      en: "Higher click-through to demo or installation, especially for web products.",
    },
    evaluate(ctx) {
      const u = readmeUnavailable(ctx);
      if (u) return u;
      const doc = ctx.readme!;
      const img = linkMatches(doc, (t, _x, image) => image && !BADGE_RE.test(t))[0];
      if (img) return { status: "present", evidence: [readmeEvidence(ctx, tr(ctx, "Bild in der README", "Image in the README"), img.line, img.line)] };
      const demo = linkMatches(doc, (t, x) => /(demo|screenshot|asciinema|video|youtube|vimeo|loom|\.gif|\.mp4|live|playground)/.test(`${t} ${x}`))[0];
      if (demo) return { status: "present", evidence: [readmeEvidence(ctx, tr(ctx, "Demo-Link", "Demo link"), demo.line, demo.line)] };
      return { status: "missing", evidence: [readmeAbsence(ctx, tr(ctx, "kein Bild außer Badges und kein Link auf Demo/Screenshot/Video", "no image other than badges and no demo/screenshot/video link"))] };
    },
  },
  {
    id: "usability.docs",
    version: 1,
    category: "usability",
    readmeContent: false,
    title: { de: "Weiterführende Dokumentation", en: "Further documentation" },
    rationale: {
      de: "Über den Einstieg hinaus brauchen Nutzer eine Stelle für Details: docs-Ordner, Wiki oder Doku-Seite.",
      en: "Beyond getting started, users need a place for details: docs folder, wiki or documentation site.",
    },
    task: {
      de: "Lege einen docs-Ordner oder eine Doku-Seite an und verlinke sie prominent in der README.",
      en: "Create a docs folder or documentation site and link it prominently from the README.",
    },
    effortMinutes: [60, 240],
    impact: {
      de: "Fortgeschrittene Nutzer bleiben, wiederkehrende Fragen nehmen ab.",
      en: "Advanced users stay and recurring questions decrease.",
    },
    evaluate(ctx) {
      const dir = ctx.snapshot.tree.entries.find((e) => e.type === "tree" && /^(docs?|documentation|website)$/i.test(e.path));
      if (dir) return { status: "present", evidence: [{ kind: "file", label: tr(ctx, `Verzeichnis ${dir.path}/`, `Directory ${dir.path}/`), path: dir.path, url: `${ctx.snapshot.htmlUrl}/tree/${ctx.snapshot.commitSha}/${encodeURIComponent(dir.path)}` }] };
      if (ctx.readme) {
        const link = linkMatches(ctx.readme, (t, x) => /(docs?\b|documentation|readthedocs|\/wiki|handbook|dokumentation|guide)/.test(`${t} ${x}`) && !BADGE_RE.test(t))[0];
        if (link) return { status: "present", evidence: [readmeEvidence(ctx, tr(ctx, "Link zur Dokumentation", "Link to documentation"), link.line, link.line)] };
      }
      if (ctx.snapshot.readme.state === "unknown") return { status: "unknown", evidence: [{ kind: "note", label: tr(ctx, "README nicht auswertbar", "README not evaluable") }] };
      return { status: "missing", evidence: [{ kind: "absence", label: tr(ctx, "Kein docs/-Verzeichnis im Wurzelverzeichnis und kein Doku-Link in der README", "No docs/ directory at the root and no documentation link in the README"), url: `${ctx.snapshot.htmlUrl}/tree/${ctx.snapshot.commitSha}` }] };
    },
  },
  {
    id: "usability.cli_reference",
    version: 1,
    category: "usability",
    readmeContent: true,
    title: { de: "Befehle und Optionen dokumentiert", en: "Commands and options documented" },
    rationale: {
      de: "CLI-Nutzer suchen Befehle, Flags und Beispiele. Ohne Referenz bleibt nur das Ausprobieren.",
      en: "CLI users look for commands, flags and examples. Without a reference only trial and error remains.",
    },
    task: {
      de: "Ergänze eine Übersicht der wichtigsten Befehle und Optionen und verweise auf --help.",
      en: "Add an overview of the main commands and options and point to --help.",
    },
    effortMinutes: [20, 60],
    impact: {
      de: "Mehr wiederkehrende Nutzung, weniger Fragen zu Parametern.",
      en: "More repeat usage and fewer questions about parameters.",
    },
    evaluate(ctx) {
      const u = readmeUnavailable(ctx);
      if (u) return u;
      const doc = ctx.readme!;
      const h = findHeading(doc, [/(options|commands|flags|cli|reference|arguments|befehle|optionen|parameter)/i]);
      const flags = doc.lines.findIndex((l) => /(^|\s|`)--[a-z][\w-]+/.test(l));
      if (h && flags !== -1) return { status: "present", evidence: [readmeEvidence(ctx, tr(ctx, `Abschnitt "${h.text}"`, `Section "${h.text}"`), h.line, Math.min(h.line + 8, doc.lines.length))] };
      const help = doc.lines.findIndex((l) => /--help\b/.test(l));
      if (help !== -1) return { status: "present", evidence: [readmeEvidence(ctx, tr(ctx, "Verweis auf --help", "Reference to --help"), help + 1, help + 1)] };
      return { status: "missing", evidence: [readmeAbsence(ctx, tr(ctx, "kein Abschnitt Options/Commands/Befehle mit Flags und kein Verweis auf --help", "no Options/Commands section with flags and no reference to --help"))] };
    },
  },
  {
    id: "usability.api_reference",
    version: 1,
    category: "usability",
    readmeContent: true,
    title: { de: "API-Referenz", en: "API reference" },
    rationale: {
      de: "Bibliotheksnutzer brauchen eine Übersicht der öffentlichen Funktionen oder einen Link zur Referenz.",
      en: "Library users need an overview of public functions or a link to the reference.",
    },
    task: {
      de: "Ergänze einen Abschnitt \"API\" mit den wichtigsten Funktionen oder verlinke eine generierte Referenz.",
      en: "Add an \"API\" section with the main functions or link a generated reference.",
    },
    effortMinutes: [30, 120],
    impact: {
      de: "Schnellere Integration, weniger Rückfragen zu Signaturen.",
      en: "Faster integration and fewer questions about signatures.",
    },
    evaluate(ctx) {
      const u = readmeUnavailable(ctx);
      if (u) return u;
      const doc = ctx.readme!;
      const h = findHeading(doc, [/^(api|reference|methods|functions|exports|api reference|referenz|funktionen)\b/i]);
      if (h) {
        const [s, e] = sectionRange(doc, h);
        return { status: "present", evidence: [readmeEvidence(ctx, tr(ctx, `Abschnitt "${h.text}"`, `Section "${h.text}"`), s, Math.min(e, s + 8))] };
      }
      const link = linkMatches(doc, (t) => /(docs\.rs|pkg\.go\.dev|readthedocs|typedoc|jsdoc|javadoc|\/api\b|api-reference)/.test(t))[0];
      if (link) return { status: "present", evidence: [readmeEvidence(ctx, tr(ctx, "Link zur API-Referenz", "Link to API reference"), link.line, link.line)] };
      return { status: "missing", evidence: [readmeAbsence(ctx, tr(ctx, "kein Abschnitt API/Reference und kein Link auf eine API-Referenz", "no API/Reference section and no link to an API reference"))] };
    },
  },
  {
    id: "usability.template_flag",
    version: 1,
    category: "usability",
    readmeContent: false,
    title: { de: "Als Template-Repository nutzbar", en: "Usable as template repository" },
    rationale: {
      de: "Mit der Template-Einstellung bietet GitHub \"Use this template\" an; das senkt die Hürde für Vorlagen deutlich.",
      en: "With the template setting GitHub offers \"Use this template\", which clearly lowers the barrier for templates.",
    },
    task: {
      de: "Aktiviere in den Repository-Einstellungen \"Template repository\".",
      en: "Enable \"Template repository\" in the repository settings.",
    },
    effortMinutes: [2, 5],
    impact: {
      de: "Mehr Projekte werden aus der Vorlage erzeugt.",
      en: "More projects are generated from the template.",
    },
    evaluate(ctx) {
      const ev = apiField(ctx.snapshot, "GitHub API: is_template", String(ctx.snapshot.meta.isTemplate));
      return { status: ctx.snapshot.meta.isTemplate ? "present" : "missing", evidence: [ev] };
    },
  },
  {
    id: "trust.license",
    version: 1,
    category: "trust",
    readmeContent: false,
    title: { de: "Lizenzinformation", en: "License information" },
    rationale: {
      de: "Ohne erkennbare Lizenz ist unklar, ob und wie andere das Projekt nutzen dürfen. Das ist keine Rechtsberatung.",
      en: "Without a recognisable license it is unclear whether and how others may use the project. This is not legal advice.",
    },
    task: {
      de: "Wähle eine Lizenz bewusst (z. B. über choosealicense.com) und lege eine LICENSE-Datei an. Im Zweifel rechtlich beraten lassen.",
      en: "Choose a license deliberately (e.g. via choosealicense.com) and add a LICENSE file. Seek legal advice if in doubt.",
    },
    effortMinutes: [10, 30],
    impact: {
      de: "Unternehmen und Mitwirkende können das Projekt überhaupt erst einsetzen.",
      en: "Companies and contributors can only adopt the project once this is clear.",
    },
    evaluate(ctx) {
      const lic = ctx.snapshot.meta.license;
      if (lic?.spdxId && lic.spdxId !== "NOASSERTION") {
        return { status: "present", evidence: [apiField(ctx.snapshot, tr(ctx, "GitHub API: license.spdx_id (GitHub-Lizenzerkennung)", "GitHub API: license.spdx_id (GitHub license detection)"), `${lic.spdxId} (${lic.name ?? ""})`)] };
      }
      const file = findFile(ctx.snapshot, ["license", "license.md", "license.txt", "licence", "licence.md", "copying", "copying.md", "unlicense"], [""]);
      if (file.state === "present") {
        return {
          ...fileOutcome(ctx, file, tr(ctx, "Lizenzdatei", "License file")),
          note: { de: "Lizenzdatei vorhanden, aber von GitHub nicht automatisch erkannt (NOASSERTION). Inhalt nicht juristisch geprüft.", en: "License file present but not recognised automatically by GitHub (NOASSERTION). Content not legally reviewed." },
        };
      }
      const out = fileOutcome(ctx, file, tr(ctx, "Lizenzdatei", "License file"));
      return { ...out, evidence: [apiField(ctx.snapshot, "GitHub API: license", "null"), ...out.evidence] };
    },
  },
  {
    id: "trust.maintenance",
    version: 1,
    category: "trust",
    readmeContent: false,
    title: { de: "Erkennbarer Wartungsstatus", en: "Recognisable maintenance status" },
    rationale: {
      de: "Nutzer prüfen, ob ein Projekt gepflegt wird. Archivierte oder lange inaktive Projekte wirken riskant.",
      en: "Users check whether a project is maintained. Archived or long inactive projects look risky.",
    },
    task: {
      de: "Mache den Status sichtbar: aktuelle Commits oder Releases, oder ein ehrlicher Hinweis \"nur Wartung\" bzw. \"nicht mehr gepflegt\" in der README.",
      en: "Make the status visible: recent commits or releases, or an honest \"maintenance only\" or \"unmaintained\" note in the README.",
    },
    effortMinutes: [10, 30],
    impact: {
      de: "Klarer Status erhöht Vertrauen und reduziert enttäuschte Erwartungen.",
      en: "A clear status increases trust and reduces disappointed expectations.",
    },
    evaluate(ctx) {
      const m = ctx.snapshot.meta;
      if (m.archived) {
        return {
          status: "missing",
          evidence: [apiField(ctx.snapshot, "GitHub API: archived", "true")],
          note: { de: "Das Repository ist archiviert. Vermarktung ist nur sinnvoll, wenn es wieder gepflegt wird.", en: "The repository is archived. Promotion only makes sense if it is maintained again." },
        };
      }
      const days = daysSince(m.pushedAt, ctx.now);
      if (days === null) return { status: "unknown", evidence: [{ kind: "note", label: tr(ctx, "pushed_at fehlt", "pushed_at missing") }] };
      const ev = [apiField(ctx.snapshot, tr(ctx, "GitHub API: pushed_at (letzter Push auf einen beliebigen Branch)", "GitHub API: pushed_at (last push to any branch)"), tr(ctx, `${m.pushedAt} (vor ${days} Tagen)`, `${m.pushedAt} (${days} days ago)`))];
      const rel = ctx.snapshot.releases.items[0];
      if (rel?.publishedAt) ev.push({ kind: "field", label: tr(ctx, `Letztes Release ${rel.tag}`, `Latest release ${rel.tag}`), url: rel.htmlUrl || undefined, snippet: rel.publishedAt });
      return { status: days <= 365 ? "present" : "missing", evidence: ev };
    },
  },
  {
    id: "trust.releases",
    version: 1,
    category: "trust",
    readmeContent: false,
    title: { de: "Versionierte Releases oder Tags", en: "Versioned releases or tags" },
    rationale: {
      de: "Releases geben Nutzern stabile Stände und zeigen Fortschritt nachvollziehbar.",
      en: "Releases give users stable versions and show progress transparently.",
    },
    task: {
      de: "Veröffentliche ein Release mit Versionsnummer und kurzen Release Notes.",
      en: "Publish a release with a version number and short release notes.",
    },
    effortMinutes: [20, 60],
    impact: {
      de: "Mehr produktive Nutzung, weil Nutzer eine Version festlegen können.",
      en: "More production use because users can pin a version.",
    },
    evaluate(ctx) {
      const r = ctx.snapshot.releases;
      if (r.state === "unknown") return { status: "unknown", evidence: [{ kind: "note", label: tr(ctx, `Releases nicht lesbar: ${r.reason?.de ?? "unbekannt"}`, `Releases not readable: ${r.reason?.en ?? "unknown"}`) }] };
      if (r.items.length > 0) {
        const x = r.items[0]!;
        return { status: "present", evidence: [{ kind: "field", label: `Release ${x.tag}`, url: x.htmlUrl || undefined, snippet: `${x.name ?? x.tag}, ${x.publishedAt ?? tr(ctx, "ohne Datum", "no date")}` }] };
      }
      if (r.tagsFound) return { status: "present", evidence: [{ kind: "field", label: tr(ctx, "Tags vorhanden, aber keine GitHub Releases", "Tags present but no GitHub releases"), url: `${ctx.snapshot.htmlUrl}/tags` }] };
      return { status: "missing", evidence: [{ kind: "absence", label: tr(ctx, "GET /releases und GET /tags: keine Einträge", "GET /releases and GET /tags: no entries"), url: `${ctx.snapshot.htmlUrl}/releases` }] };
    },
  },
  {
    id: "trust.contributing",
    version: 1,
    category: "trust",
    readmeContent: false,
    title: { de: "Beitragsrichtlinien", en: "Contribution guidelines" },
    rationale: {
      de: "CONTRIBUTING-Dateien verlinkt GitHub automatisch bei Issues und Pull Requests. Sie senken die Einstiegshürde.",
      en: "GitHub links CONTRIBUTING files automatically on issues and pull requests. They lower the barrier to entry.",
    },
    task: {
      de: "Lege CONTRIBUTING.md an: Setup, Tests, Stil, Ablauf für Pull Requests.",
      en: "Add CONTRIBUTING.md: setup, tests, style, pull request process.",
    },
    effortMinutes: [30, 90],
    impact: {
      de: "Mehr und besser vorbereitete Beiträge.",
      en: "More and better prepared contributions.",
    },
    evaluate(ctx) {
      const f = findFile(ctx.snapshot, ["contributing", "contributing.md", "contributing.rst", "contributing.txt", "contributing.adoc"], ["", ".github", "docs"]);
      if (f.state !== "present" && ctx.readme) {
        const h = findHeading(ctx.readme, [/^(contributing|contribute|contribution|mitwirken|beitragen|beiträge)\b/i]);
        if (h) {
          return {
            status: "present",
            evidence: [readmeEvidence(ctx, tr(ctx, `README-Abschnitt "${h.text}"`, `README section "${h.text}"`), h.line, Math.min(h.line + 4, ctx.readme.lines.length))],
            note: { de: "Nur als README-Abschnitt; eine CONTRIBUTING-Datei würde GitHub zusätzlich verlinken.", en: "Only as README section; a CONTRIBUTING file would additionally be linked by GitHub." },
          };
        }
      }
      return fileOutcome(ctx, f, tr(ctx, "Beitragsrichtlinien", "Contribution guidelines"));
    },
  },
  {
    id: "trust.security_policy",
    version: 1,
    category: "trust",
    readmeContent: false,
    title: { de: "Sicherheitsrichtlinie", en: "Security policy" },
    rationale: {
      de: "Eine SECURITY.md sagt, wie Schwachstellen vertraulich gemeldet werden. Für Unternehmen ist das oft ein Prüfpunkt.",
      en: "A SECURITY.md explains how to report vulnerabilities privately. For companies this is often a checklist item.",
    },
    task: {
      de: "Lege SECURITY.md an: Meldeweg (z. B. private Sicherheitsmeldung über GitHub), unterstützte Versionen, Reaktionszeit ohne Garantie.",
      en: "Add SECURITY.md: reporting channel (e.g. GitHub private vulnerability reporting), supported versions, response time without guarantee.",
    },
    effortMinutes: [15, 30],
    impact: {
      de: "Höheres Vertrauen bei professionellen Nutzern.",
      en: "Higher trust among professional users.",
    },
    evaluate(ctx) {
      return fileOutcome(ctx, findFile(ctx.snapshot, ["security.md", "security.txt", "security"], ["", ".github", "docs"]), tr(ctx, "Sicherheitsrichtlinie", "Security policy"));
    },
  },
  {
    id: "trust.contact",
    version: 1,
    category: "trust",
    readmeContent: false,
    title: { de: "Kontakt- oder Supportweg", en: "Contact or support channel" },
    rationale: {
      de: "Nutzer brauchen einen Weg für Fragen und Fehlerberichte: Issues, Discussions oder ein Kontaktabschnitt.",
      en: "Users need a channel for questions and bug reports: issues, discussions or a contact section.",
    },
    task: {
      de: "Aktiviere Issues oder Discussions oder nenne in der README, wo Fragen hingehören.",
      en: "Enable issues or discussions, or state in the README where questions belong.",
    },
    effortMinutes: [5, 20],
    impact: {
      de: "Feedback erreicht dich, statt dass Nutzer still abspringen.",
      en: "Feedback reaches you instead of users leaving silently.",
    },
    evaluate(ctx) {
      const m = ctx.snapshot.meta;
      const ev: Evidence[] = [apiField(ctx.snapshot, "GitHub API: has_issues / has_discussions", `${m.hasIssues} / ${m.hasDiscussions}`)];
      if (m.hasIssues || m.hasDiscussions) return { status: "present", evidence: ev };
      if (ctx.readme) {
        const h = findHeading(ctx.readme, [/(support|contact|kontakt|community|help|hilfe|questions|fragen|feedback)/i]);
        if (h) return { status: "present", evidence: [...ev, readmeEvidence(ctx, tr(ctx, `Abschnitt "${h.text}"`, `Section "${h.text}"`), h.line, h.line)] };
        const mail = linkMatches(ctx.readme, (t) => t.startsWith("mailto:"))[0];
        if (mail) return { status: "present", evidence: [...ev, readmeEvidence(ctx, tr(ctx, "E-Mail-Link", "Email link"), mail.line, mail.line)] };
      }
      return { status: "missing", evidence: [...ev, { kind: "absence", label: tr(ctx, "Kein Abschnitt Support/Kontakt/Community und kein mailto-Link in der README", "No Support/Contact/Community section and no mailto link in the README") }] };
    },
  },
  {
    id: "trust.code_of_conduct",
    version: 1,
    category: "trust",
    readmeContent: false,
    title: { de: "Verhaltenskodex", en: "Code of conduct" },
    rationale: {
      de: "Ein Verhaltenskodex signalisiert neuen Mitwirkenden, wie Zusammenarbeit abläuft.",
      en: "A code of conduct signals to new contributors how collaboration works.",
    },
    task: {
      de: "Lege CODE_OF_CONDUCT.md an und nenne einen Kontakt für Meldungen.",
      en: "Add CODE_OF_CONDUCT.md and name a contact for reports.",
    },
    effortMinutes: [10, 20],
    impact: {
      de: "Neue Mitwirkende fühlen sich sicherer, einen ersten Beitrag zu leisten.",
      en: "New contributors feel safer making a first contribution.",
    },
    evaluate(ctx) {
      return fileOutcome(ctx, findFile(ctx.snapshot, ["code_of_conduct.md", "code-of-conduct.md", "code_of_conduct", "code_of_conduct.txt"], ["", ".github", "docs"]), tr(ctx, "Verhaltenskodex", "Code of conduct"));
    },
  },
  {
    id: "trust.changelog",
    version: 1,
    category: "trust",
    readmeContent: false,
    title: { de: "Änderungsprotokoll", en: "Changelog" },
    rationale: {
      de: "Ein Changelog oder Release Notes zeigen, was sich ändert, und erleichtern Updates.",
      en: "A changelog or release notes show what changes and make updates easier.",
    },
    task: {
      de: "Führe CHANGELOG.md oder schreibe Release Notes zu jedem Release.",
      en: "Keep a CHANGELOG.md or write release notes for each release.",
    },
    effortMinutes: [15, 45],
    impact: {
      de: "Nutzer aktualisieren eher und melden weniger Überraschungen.",
      en: "Users update more readily and report fewer surprises.",
    },
    evaluate(ctx) {
      const f = findFile(ctx.snapshot, ["changelog.md", "changelog", "changes.md", "history.md", "news.md", "changelog.rst"], ["", "docs"]);
      if (f.state === "present") return fileOutcome(ctx, f, tr(ctx, "Änderungsprotokoll", "Changelog"));
      const withNotes = ctx.snapshot.releases.items.find((r) => r.hasNotes);
      if (withNotes) return { status: "present", evidence: [{ kind: "field", label: tr(ctx, `Release Notes zu ${withNotes.tag}`, `Release notes for ${withNotes.tag}`), url: withNotes.htmlUrl || undefined }] };
      return fileOutcome(ctx, f, tr(ctx, "Änderungsprotokoll", "Changelog"));
    },
  },
  {
    id: "distribution.topics",
    version: 1,
    category: "distribution",
    readmeContent: false,
    title: { de: "Passende Topics", en: "Relevant topics" },
    rationale: {
      de: "Topics machen ein Repository über GitHub-Themenseiten und Suche auffindbar.",
      en: "Topics make a repository discoverable via GitHub topic pages and search.",
    },
    task: {
      de: "Vergib drei bis acht präzise Topics (Sprache, Problemfeld, Projekttyp).",
      en: "Add three to eight precise topics (language, problem domain, project type).",
    },
    effortMinutes: [5, 10],
    impact: {
      de: "Mehr Besucher über Themenseiten und Suche; keine Garantie für Rankings.",
      en: "More visitors via topic pages and search; no ranking guarantee.",
    },
    evaluate(ctx) {
      const t = ctx.snapshot.meta.topics;
      const ev = apiField(ctx.snapshot, "GitHub API: topics", t.length ? t.join(", ") : tr(ctx, "(keine)", "(none)"));
      return { status: t.length >= 3 ? "present" : "missing", evidence: [ev], note: t.length > 0 && t.length < 3 ? { de: `Nur ${t.length} Topic(s).`, en: `Only ${t.length} topic(s).` } : undefined };
    },
  },
  {
    id: "distribution.homepage",
    version: 1,
    category: "distribution",
    readmeContent: false,
    title: { de: "Website-Feld gesetzt", en: "Website field set" },
    rationale: {
      de: "Das Website-Feld erscheint prominent neben der Beschreibung und führt zu Demo, Doku oder Produktseite.",
      en: "The website field appears prominently next to the description and leads to demo, docs or product page.",
    },
    task: {
      de: "Trage im Repository unter \"About\" eine Website ein (Demo, Doku oder Produktseite).",
      en: "Set a website under \"About\" in the repository (demo, docs or product page).",
    },
    effortMinutes: [2, 10],
    impact: {
      de: "Mehr Besuche der Demo- oder Produktseite.",
      en: "More visits to the demo or product page.",
    },
    evaluate(ctx) {
      const h = ctx.snapshot.meta.homepage?.trim() ?? "";
      const valid = /^https?:\/\/[^\s]+$/i.test(h);
      const ev = apiField(ctx.snapshot, "GitHub API: homepage", h || tr(ctx, "(leer)", "(empty)"));
      if (valid) return { status: "present", evidence: [ev] };
      return { status: "missing", evidence: [ev], note: h ? { de: "Wert ist keine gültige http(s)-Adresse.", en: "Value is not a valid http(s) URL." } : undefined };
    },
  },
  {
    id: "distribution.next_step",
    version: 1,
    category: "distribution",
    readmeContent: true,
    title: { de: "Klarer nächster Schritt oben in der README", en: "Clear next step near the top of the README" },
    rationale: {
      de: "Wer die ersten Zeilen liest, sollte sofort wissen, was als Nächstes zu tun ist: installieren, Demo öffnen oder Doku lesen.",
      en: "Readers of the first lines should immediately know what to do next: install, open a demo or read the docs.",
    },
    task: {
      de: "Setze in die ersten Zeilen einen Installationsbefehl oder einen gut sichtbaren Link \"Demo\" bzw. \"Loslegen\".",
      en: "Place an install command or a visible \"Demo\" or \"Get started\" link within the first lines.",
    },
    effortMinutes: [5, 20],
    impact: {
      de: "Höherer Anteil an Besuchern, die den ersten Schritt tatsächlich gehen.",
      en: "A higher share of visitors actually take the first step.",
    },
    evaluate(ctx) {
      const u = readmeUnavailable(ctx);
      if (u) return u;
      const doc = ctx.readme!;
      const limit = Math.max(40, Math.ceil(doc.lines.length * 0.4));
      const cmd = installCommands(doc).find((c) => c.line <= limit);
      if (cmd) return { status: "present", evidence: [readmeEvidence(ctx, tr(ctx, "Installationsbefehl im oberen Teil", "Install command near the top"), cmd.line, cmd.line)] };
      const link = linkMatches(doc, (t, x, image) => !image && /(demo|try|get started|getting started|docs|documentation|download|install|loslegen|ausprobieren|live|app\b|öffnen|open)/.test(`${x} ${t}`) && !BADGE_RE.test(t)).find((l) => l.line <= limit);
      if (link) return { status: "present", evidence: [readmeEvidence(ctx, tr(ctx, "Handlungslink im oberen Teil", "Call-to-action link near the top"), link.line, link.line)] };
      return { status: "missing", evidence: [readmeAbsence(ctx, tr(ctx, `kein Installationsbefehl und kein Demo-/Start-/Doku-Link in den ersten ${limit} Zeilen`, `no install command and no demo/start/docs link in the first ${limit} lines`))] };
    },
  },
  {
    id: "distribution.registry",
    version: 1,
    category: "distribution",
    readmeContent: true,
    title: { de: "Verweis auf Paketregister", en: "Link to package registry" },
    rationale: {
      de: "Ein Link oder Badge zum Paketregister zeigt, dass eine installierbare Version existiert. Die Veröffentlichung selbst wurde nicht extern geprüft.",
      en: "A registry link or badge shows that an installable version exists. Publication itself was not verified externally.",
    },
    task: {
      de: "Falls veröffentlicht: verlinke die Registry-Seite (npm, PyPI, crates.io usw.) in der README. Falls nicht: Veröffentlichung prüfen.",
      en: "If published: link the registry page (npm, PyPI, crates.io etc.) in the README. If not: consider publishing.",
    },
    effortMinutes: [5, 60],
    impact: {
      de: "Einfachere Installation über bekannte Paketmanager.",
      en: "Easier installation via familiar package managers.",
    },
    evaluate(ctx) {
      const privateManifest = ctx.manifests.find((m) => m.isPrivate);
      if (privateManifest && ctx.manifests.every((m) => m.isPrivate)) {
        return {
          status: "not_relevant",
          evidence: [{ kind: "file", label: tr(ctx, `${privateManifest.path}: als nicht veröffentlichbar markiert`, `${privateManifest.path}: marked as not publishable`), path: privateManifest.path, url: fileUrl(ctx.snapshot, privateManifest.path) }],
          note: { de: "Paket ist als privat markiert und nicht für ein Register gedacht.", en: "Package is marked private and not intended for a registry." },
        };
      }
      const u = readmeUnavailable(ctx);
      if (u) return u;
      const link = linkMatches(ctx.readme!, (t) => REGISTRY_RE.test(t))[0];
      if (link) return { status: "present", evidence: [readmeEvidence(ctx, tr(ctx, "Registry-Link", "Registry link"), link.line, link.line)] };
      return { status: "missing", evidence: [readmeAbsence(ctx, tr(ctx, "kein Link zu npm, PyPI, crates.io, pkg.go.dev, Packagist, RubyGems, Docker Hub, GHCR oder Marketplace", "no link to npm, PyPI, crates.io, pkg.go.dev, Packagist, RubyGems, Docker Hub, GHCR or Marketplace"))] };
    },
  },
  {
    id: "distribution.funding",
    version: 1,
    category: "distribution",
    readmeContent: false,
    title: { de: "Finanzierungsmöglichkeit sichtbar", en: "Funding option visible" },
    rationale: {
      de: "Wer Sponsoren sucht, muss einen Weg zum Unterstützen anbieten. GitHub zeigt FUNDING.yml als Sponsor-Button an.",
      en: "Projects seeking sponsors need a way to support them. GitHub displays FUNDING.yml as a sponsor button.",
    },
    task: {
      de: "Lege .github/FUNDING.yml an. GitHub Sponsors setzt Teilnahmeberechtigung und Einrichtung durch dich voraus.",
      en: "Add .github/FUNDING.yml. GitHub Sponsors requires eligibility and setup by you.",
    },
    effortMinutes: [15, 60],
    impact: {
      de: "Unterstützungswillige finden einen Weg; Umsatz ist nicht garantiert.",
      en: "Willing supporters find a way; revenue is not guaranteed.",
    },
    evaluate(ctx) {
      const f = findFile(ctx.snapshot, ["funding.yml"], [".github"]);
      if (f.state === "present") {
        const file = ctx.snapshot.files[f.path];
        return { status: "present", evidence: [{ kind: "file", label: ".github/FUNDING.yml", path: f.path, url: fileUrl(ctx.snapshot, f.path), snippet: file?.state === "present" ? file.text.slice(0, 300) : undefined }] };
      }
      if (ctx.readme) {
        const link = linkMatches(ctx.readme, (t) => FUNDING_RE.test(t))[0];
        if (link) return { status: "present", evidence: [readmeEvidence(ctx, tr(ctx, "Sponsoring-Link", "Sponsoring link"), link.line, link.line)] };
      }
      return fileOutcome(ctx, f, "FUNDING.yml");
    },
  },
  {
    id: "distribution.commercial_offer",
    version: 1,
    category: "distribution",
    readmeContent: true,
    title: { de: "Kommerzielles Angebot benannt", en: "Commercial offer stated" },
    rationale: {
      de: "Wer zahlende Kunden sucht, muss sagen, was man kaufen kann und wie man Kontakt aufnimmt.",
      en: "Projects seeking paying customers need to say what can be bought and how to get in touch.",
    },
    task: {
      de: "Ergänze einen Abschnitt \"Support\" oder \"Kommerzielle Nutzung\" mit Angebot und Kontaktweg. Keine Umsatzversprechen.",
      en: "Add a \"Support\" or \"Commercial use\" section with the offer and contact channel. No revenue promises.",
    },
    effortMinutes: [30, 90],
    impact: {
      de: "Interessierte Unternehmen melden sich direkt statt abzuwandern.",
      en: "Interested companies get in touch directly instead of leaving.",
    },
    evaluate(ctx) {
      const u = readmeUnavailable(ctx);
      if (u) return u;
      const doc = ctx.readme!;
      const h = findHeading(doc, [/(commercial|enterprise|pricing|paid support|professional support|consulting|hire|services|sponsor|preise|kommerziell|beratung|dienstleistung)/i]);
      if (h) return { status: "present", evidence: [readmeEvidence(ctx, tr(ctx, `Abschnitt "${h.text}"`, `Section "${h.text}"`), h.line, Math.min(h.line + 4, doc.lines.length))] };
      const link = linkMatches(doc, (t, x) => /(pricing|contact sales|book a (call|demo)|hire|consulting|preise|beratung|kontakt)/.test(`${x} ${t}`))[0];
      if (link) return { status: "present", evidence: [readmeEvidence(ctx, tr(ctx, "Link zum Angebot", "Link to the offer"), link.line, link.line)] };
      return { status: "missing", evidence: [readmeAbsence(ctx, tr(ctx, "kein Abschnitt Support/Enterprise/Pricing/Beratung und kein Angebotslink", "no Support/Enterprise/Pricing/Consulting section and no offer link"))] };
    },
  },
  {
    id: "distribution.contributor_entry",
    version: 1,
    category: "distribution",
    readmeContent: false,
    title: { de: "Einstiegsaufgaben für Mitwirkende", en: "Entry tasks for contributors" },
    rationale: {
      de: "Offene Issues mit dem Label \"good first issue\" geben neuen Mitwirkenden einen konkreten Startpunkt.",
      en: "Open issues labelled \"good first issue\" give new contributors a concrete starting point.",
    },
    task: {
      de: "Markiere zwei bis fünf kleine, gut beschriebene Issues mit \"good first issue\".",
      en: "Label two to five small, well described issues with \"good first issue\".",
    },
    effortMinutes: [20, 60],
    impact: {
      de: "Mehr erste Beiträge von neuen Mitwirkenden.",
      en: "More first contributions from new contributors.",
    },
    evaluate(ctx) {
      const g = ctx.snapshot.goodFirstIssues;
      if (g.state === "not_checked") return { status: "unknown", evidence: [{ kind: "note", label: tr(ctx, "Nicht abgefragt (nur beim Ziel \"mehr Mitwirkende\")", "Not queried (only for the goal \"more contributors\")") }] };
      if (g.state === "unknown") return { status: "unknown", evidence: [{ kind: "note", label: tr(ctx, `Issues nicht lesbar: ${g.reason?.de ?? ""}`, `Issues not readable: ${g.reason?.en ?? ""}`) }] };
      return {
        status: g.state,
        evidence: [{ kind: g.state === "present" ? "field" : "absence", label: tr(ctx, `Offene Issues mit Label "good first issue": ${g.count}${g.reason ? ` (${g.reason.de})` : ""}`, `Open issues labelled "good first issue": ${g.count}${g.reason ? ` (${g.reason.en})` : ""}`), url: `${ctx.snapshot.htmlUrl}/issues?q=is%3Aopen+label%3A%22good+first+issue%22` }],
      };
    },
  },
];

export function ruleById(id: string): RuleDefinition | undefined {
  return RULES.find((r) => r.id === id);
}

export function localize(l: Localized, lang: Language): string {
  return l[lang];
}
