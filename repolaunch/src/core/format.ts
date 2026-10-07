import type { Language } from "./types";

/** Aufwandsspanne in Minuten als lesbarer Text ohne Gedankenstriche. */
export function formatEffort([min, max]: [number, number], lang: Language): string {
  const to = lang === "de" ? "bis" : "to";
  if (min >= 60 && max >= 60 && min % 30 === 0 && max % 30 === 0) {
    const h = (m: number) => (m / 60).toLocaleString(lang === "de" ? "de-DE" : "en-US", { maximumFractionDigits: 1 });
    return `${h(min)} ${to} ${h(max)} ${lang === "de" ? "Std." : "h"}`;
  }
  return `${min} ${to} ${max} ${lang === "de" ? "Min." : "min"}`;
}
