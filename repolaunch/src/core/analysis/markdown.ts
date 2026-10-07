// Leichter, deterministischer Markdown-Leser für Belege mit Zeilennummern.
// Er interpretiert keinen Inhalt als Anweisung und rendert kein HTML.

export interface Heading {
  level: number;
  text: string;
  line: number;
}

export interface CodeBlock {
  lang: string;
  startLine: number;
  endLine: number;
  content: string;
}

export interface MdLink {
  text: string;
  target: string;
  line: number;
  image: boolean;
}

export interface MarkdownDoc {
  lines: string[];
  headings: Heading[];
  codeBlocks: CodeBlock[];
  links: MdLink[];
  /** Zeilen außerhalb von Codeblöcken. */
  proseLines: { line: number; text: string }[];
}

export function parseMarkdown(text: string): MarkdownDoc {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const headings: Heading[] = [];
  const codeBlocks: CodeBlock[] = [];
  const links: MdLink[] = [];
  const proseLines: { line: number; text: string }[] = [];
  let fence: { marker: string; lang: string; start: number; body: string[] } | null = null;

  lines.forEach((raw, idx) => {
    const lineNo = idx + 1;
    const fenceMatch = raw.match(/^\s{0,3}(`{3,}|~{3,})\s*([\w+-]*)/);
    if (fence) {
      if (fenceMatch && fenceMatch[1]!.startsWith(fence.marker[0]!) && fenceMatch[1]!.length >= fence.marker.length && raw.trim() === fenceMatch[1]) {
        codeBlocks.push({ lang: fence.lang, startLine: fence.start, endLine: lineNo, content: fence.body.join("\n") });
        fence = null;
      } else {
        fence.body.push(raw);
      }
      return;
    }
    if (fenceMatch) {
      fence = { marker: fenceMatch[1]!, lang: (fenceMatch[2] ?? "").toLowerCase(), start: lineNo, body: [] };
      return;
    }
    proseLines.push({ line: lineNo, text: raw });
    const h = raw.match(/^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/);
    if (h) headings.push({ level: h[1]!.length, text: stripInline(h[2] ?? ""), line: lineNo });
    const htmlH = raw.match(/<h([1-6])[^>]*>(.*?)<\/h\1>/i);
    if (htmlH) headings.push({ level: Number(htmlH[1]), text: stripInline(htmlH[2] ?? ""), line: lineNo });
    for (const m of raw.matchAll(/(!?)\[([^\]]*)\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g)) {
      links.push({ image: m[1] === "!", text: m[2] ?? "", target: m[3] ?? "", line: lineNo });
    }
    for (const m of raw.matchAll(/<img\b[^>]*\bsrc\s*=\s*["']?([^"'\s>]+)/gi)) {
      links.push({ image: true, text: "", target: m[1] ?? "", line: lineNo });
    }
    for (const m of raw.matchAll(/<a\b[^>]*\bhref\s*=\s*["']?([^"'\s>]+)/gi)) {
      links.push({ image: false, text: "", target: m[1] ?? "", line: lineNo });
    }
  });
  if (fence) {
    const f = fence as { lang: string; start: number; body: string[] };
    codeBlocks.push({ lang: f.lang, startLine: f.start, endLine: lines.length, content: f.body.join("\n") });
  }
  return { lines, headings, codeBlocks, links, proseLines };
}

function stripInline(s: string): string {
  return s.replace(/<[^>]+>/g, "").replace(/[`*_~]/g, "").replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").trim();
}

export function findHeading(doc: MarkdownDoc, patterns: RegExp[]): Heading | undefined {
  return doc.headings.find((h) => patterns.some((p) => p.test(h.text)));
}

/** Liefert einen gekürzten Ausschnitt [start, end] (1-basiert, inklusive). */
export function snippet(doc: MarkdownDoc, start: number, end: number, maxChars = 400): string {
  const text = doc.lines.slice(Math.max(0, start - 1), Math.min(doc.lines.length, end)).join("\n");
  return text.length > maxChars ? `${text.slice(0, maxChars)} …` : text;
}

/** Abschnitt unter einer Überschrift bis zur nächsten gleich- oder höherrangigen Überschrift. */
export function sectionRange(doc: MarkdownDoc, heading: Heading): [number, number] {
  const next = doc.headings.find((h) => h.line > heading.line && h.level <= heading.level);
  return [heading.line, next ? next.line - 1 : doc.lines.length];
}

/** Erster zusammenhängender Fließtext-Absatz nach dem Titel, vor dem ersten Codeblock. */
export function introParagraph(doc: MarkdownDoc): { text: string; start: number; end: number } | null {
  const firstCode = doc.codeBlocks[0]?.startLine ?? Number.POSITIVE_INFINITY;
  const secondHeading = doc.headings[1]?.line ?? Number.POSITIVE_INFINITY;
  const limit = Math.min(firstCode, secondHeading === Number.POSITIVE_INFINITY ? doc.lines.length + 1 : secondHeading);
  let best: { text: string; start: number; end: number } | null = null;
  let current: { parts: string[]; start: number; end: number } | null = null;
  const flush = () => {
    if (current) {
      const text = current.parts.join(" ").trim();
      if (!best || text.length > best.text.length) best = { text, start: current.start, end: current.end };
    }
    current = null;
  };
  for (const { line, text } of doc.proseLines) {
    if (line >= limit) break;
    const t = text.trim();
    const isProse = t.length > 0 && !/^(#|!\[|\[!\[|<|\||[-*+]\s|>\s?$)/.test(t) && !/^\[.*\]\(.*\)$/.test(t);
    if (isProse) {
      if (!current) current = { parts: [], start: line, end: line };
      current.parts.push(t);
      current.end = line;
    } else {
      flush();
    }
  }
  flush();
  return best;
}

const INSTALL_CMD_RE = /^\s*(?:\$\s*)?(?:sudo\s+)?(npm\s+(?:i|install|add)\b|pnpm\s+(?:add|i|install)\b|yarn\s+(?:global\s+)?add\b|bun\s+(?:add|install)\b|npx\s|pip3?\s+install\b|pipx\s+install\b|uv\s+(?:add|tool\s+install|pip\s+install)\b|poetry\s+add\b|cargo\s+(?:install|add)\b|go\s+(?:install|get)\b|brew\s+install\b|apt(?:-get)?\s+install\b|gem\s+install\b|composer\s+require\b|docker\s+(?:run|pull|compose\s+up)\b|docker-compose\s+up\b|git\s+clone\b|curl\s.*\|\s*(?:sh|bash)\b|dotnet\s+(?:add|tool\s+install)\b)/i;

export function isInstallCommand(line: string): boolean {
  return INSTALL_CMD_RE.test(line);
}

export function installCommands(doc: MarkdownDoc): { line: number; command: string }[] {
  const out: { line: number; command: string }[] = [];
  for (const block of doc.codeBlocks) {
    block.content.split("\n").forEach((l, i) => {
      if (isInstallCommand(l)) out.push({ line: block.startLine + 1 + i, command: l.trim() });
    });
  }
  return out;
}
