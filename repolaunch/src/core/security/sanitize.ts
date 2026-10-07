// Bereinigung von Texten aus Repositories und Sprachmodellen, bevor sie exportiert oder angezeigt werden.
// Die Oberfläche rendert ohnehin nur Text (kein HTML); diese Funktionen schützen zusätzlich die Markdown-Exporte.

const CONTROL_RE = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u202a-\u202e\u2066-\u2069\u200b\u2028\u2029]/g;

/** Entfernt Steuerzeichen und bidirektionale Überschreibungen (Trojan-Source). Zeilenumbrüche und Tabs bleiben. */
export function stripControl(s: string): string {
  return s.replace(/\r\n?/g, "\n").replace(CONTROL_RE, "");
}

/** Codeblock mit einem Zaun, der länger ist als jede Backtick-Folge im Inhalt. */
export function fencedBlock(content: string, lang = "text"): string {
  const clean = stripControl(content);
  const longest = Math.max(0, ...[...clean.matchAll(/`+/g)].map((m) => m[0].length));
  const fence = "`".repeat(Math.max(3, longest + 1));
  return `${fence}${lang}\n${clean}\n${fence}`;
}

/** Für einzeilige Werte in Fließtext und Tabellen: entfernt Markdown- und HTML-Steuerzeichen. */
export function inlineText(s: string, max = 300): string {
  const clean = stripControl(s).replace(/\s+/g, " ").trim();
  const cut = clean.length > max ? `${clean.slice(0, max)} …` : clean;
  // Ohne [ und ] entsteht kein Link; Klammern bleiben deshalb lesbar.
  return cut.replace(/[\\`*_[\]<>|~]/g, (c) => `\\${c}`).replace(/^#/, "\\#");
}

/** Nur http(s)-Adressen ohne Zugangsdaten sind als Link erlaubt. */
export function safeUrl(u: string | null | undefined): string | null {
  if (!u) return null;
  try {
    const url = new URL(u);
    if ((url.protocol !== "https:" && url.protocol !== "http:") || url.username || url.password) return null;
    return url.toString();
  } catch {
    return null;
  }
}

const SECRET_PATTERNS = [
  /sk-ant-[A-Za-z0-9_-]{10,}/g,
  /\bgh[pousr]_[A-Za-z0-9]{20,}\b/g,
  /\bgithub_pat_[A-Za-z0-9_]{20,}\b/g,
  /\bAKIA[0-9A-Z]{16}\b/g,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?(-----END [A-Z ]*PRIVATE KEY-----|$)/g,
  /\bxox[abpr]-[A-Za-z0-9-]{10,}\b/g,
];

export function redactSecrets(s: string, extraSecrets: string[] = []): { text: string; redacted: number } {
  let count = 0;
  let out = s;
  for (const re of SECRET_PATTERNS) {
    out = out.replace(re, () => {
      count += 1;
      return "[REDACTED]";
    });
  }
  for (const secret of extraSecrets) {
    if (secret && secret.length >= 8 && out.includes(secret)) {
      count += out.split(secret).length - 1;
      out = out.split(secret).join("[REDACTED]");
    }
  }
  return { text: out, redacted: count };
}

const UNSAFE_SCHEME_RE = /^\s*(javascript|vbscript|data|file|blob):/i;

/**
 * Bereinigt erzeugtes Markdown: kein Roh-HTML, keine HTML-Kommentare, keine gefährlichen Link-Ziele.
 * Inhalte in Codeblöcken bleiben unverändert, weil sie als Text dargestellt werden.
 */
export function sanitizeMarkdown(md: string, extraSecrets: string[] = []): { text: string; changes: number } {
  let changes = 0;
  const lines = stripControl(md).split("\n");
  let fence: string | null = null;
  const out = lines.map((line) => {
    const f = line.match(/^\s{0,3}(`{3,}|~{3,})/);
    if (fence) {
      if (f && f[1]![0] === fence[0] && f[1]!.length >= fence.length) fence = null;
      return line;
    }
    if (f) {
      fence = f[1]!;
      return line;
    }
    let l = line;
    // Link- und Bildziele mit gefährlichem Schema neutralisieren
    l = l.replace(/(!?\[[^\]]*\])\(\s*<?([^()\s>]*(?:\([^()]*\)[^()\s>]*)*)>?(?:\s+"[^"]*")?\s*\)/g, (m, label: string, target: string) => {
      if (UNSAFE_SCHEME_RE.test(target)) {
        changes += 1;
        return `${label}(#unsicherer-link-entfernt)`;
      }
      return m;
    });
    // Autolinks <javascript:...>
    l = l.replace(/<\s*(javascript|vbscript|data|file):[^>]*>/gi, () => {
      changes += 1;
      return "";
    });
    // Roh-HTML-Tags und Kommentare als Text darstellen
    l = l.replace(/<(\/?[A-Za-z][A-Za-z0-9-]*\b[^>]*|!--[\s\S]*?--|!--.*)>?/g, (m) => {
      changes += 1;
      return m.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    });
    return l;
  });
  if (fence) out.push(fence);
  const redacted = redactSecrets(out.join("\n"), extraSecrets);
  return { text: redacted.text, changes: changes + redacted.redacted };
}

/** Bereinigt einen Klartext (z. B. Social-Media-Text): Steuerzeichen, Geheimnisse, HTML. */
export function sanitizePlain(s: string, extraSecrets: string[] = []): string {
  return sanitizeMarkdown(s, extraSecrets).text;
}
