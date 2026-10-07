// Erkennung von Textstellen, die wie Anweisungen an KI-Systeme aussehen.
// Repository-Inhalte sind untrusted data: Treffer werden markiert und vor einer KI-Verarbeitung entfernt.

import type { InjectionFlag, RepoSnapshot } from "../types";

const PATTERNS: { id: string; re: RegExp }[] = [
  { id: "ignore-instructions", re: /\b(ignore|disregard|forget|override)\b[^.\n]{0,40}\b(previous|prior|above|all|earlier|system)\b[^.\n]{0,20}\b(instructions?|prompts?|rules|messages)\b/i },
  { id: "ignore-instructions-de", re: /\b(ignorier\w*|vergiss|missachte\w*|überschreib\w*)\b[^.\n]{0,40}\b(anweisung\w*|vorgaben|regeln|prompts?)\b/i },
  { id: "role-override", re: /\b(you are now|act as|pretend to be|from now on you|du bist jetzt|ab jetzt bist du)\b/i },
  { id: "system-prompt", re: /\b(system prompt|systemprompt|developer message|hidden instructions?|versteckte anweisung\w*)\b/i },
  { id: "secret-request", re: /\b(api[_ -]?key|secret|token|password|passwort|credential|zugangsdaten|schlüssel)\b[^.\n]{0,60}\b(print|reveal|show|output|send|leak|exfiltrat\w*|ausgeben|gib\b|zeige|sende|verrate)\b|\b(print|reveal|show|output|send|leak|ausgeben|gib|zeige|sende|verrate)\b[^.\n]{0,60}\b(api[_ -]?key|secret|token|password|passwort|credential|zugangsdaten|schlüssel|env(ironment)? variables?|umgebungsvariable\w*)\b/i },
  { id: "env-var-name", re: /\b(ANTHROPIC_API_KEY|OPENAI_API_KEY|GITHUB_TOKEN|AWS_SECRET_ACCESS_KEY)\b/ },
  { id: "tool-call", re: /\b(call|invoke|use|execute|run)\s+(the\s+)?(tool|function|browser|shell|command)\b.{0,40}\b(curl|wget|http|fetch)\b/i },
  { id: "chat-markup", re: /(<\|im_start\|>|<\|system\|>|\[INST\]|<<SYS>>|<\/?(system|assistant|instructions?)>)/i },
];

export function scanText(path: string, text: string): InjectionFlag[] {
  const flags: InjectionFlag[] = [];
  text.split(/\r?\n/).forEach((line, idx) => {
    for (const p of PATTERNS) {
      if (p.re.test(line)) {
        flags.push({ path, line: idx + 1, pattern: p.id, excerpt: line.trim().slice(0, 160) });
        break;
      }
    }
  });
  return flags;
}

/** Durchsucht alle gelesenen Texte (Beschreibung, README, Dateien) nach Anweisungsmustern. */
export function detectInjection(snapshot: RepoSnapshot): InjectionFlag[] {
  const flags: InjectionFlag[] = [];
  if (snapshot.meta.description) flags.push(...scanText("(description)", snapshot.meta.description));
  if (snapshot.readme.state === "present") flags.push(...scanText(snapshot.readme.path, snapshot.readme.text));
  for (const f of Object.values(snapshot.files)) {
    if (f.state === "present") flags.push(...scanText(f.path, f.text));
  }
  return flags.slice(0, 50);
}

/** Ersetzt markierte Zeilen, bevor Inhalte an ein Sprachmodell gehen. */
export function redactFlaggedLines(text: string, path: string): { text: string; removed: number } {
  const flagged = new Set(scanText(path, text).map((f) => f.line));
  if (flagged.size === 0) return { text, removed: 0 };
  const lines = text.split(/\r?\n/).map((l, i) => (flagged.has(i + 1) ? "[entfernt: mögliche Anweisung an KI-Systeme / removed: possible instruction to AI systems]" : l));
  return { text: lines.join("\n"), removed: flagged.size };
}

/** Ersetzt einen einzelnen Wert vollständig, falls er Anweisungsmuster enthält (für strukturierte Felder). */
export function redactValue(value: string | null, path: string): { value: string | null; removed: number } {
  if (!value) return { value, removed: 0 };
  const flags = scanText(path, value);
  return flags.length > 0 ? { value: "[entfernt: mögliche Anweisung an KI-Systeme / removed: possible instruction to AI systems]", removed: flags.length } : { value, removed: 0 };
}
