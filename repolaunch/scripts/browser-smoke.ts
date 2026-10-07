// Browser-Smoke-Test gegen einen laufenden Server mit REPOLAUNCH_DEMO=1 und AI_PROVIDER=fake.
// Prüft Kernablauf, Download, Löschen, mobile Breite und axe-core (WCAG 2.2 A/AA) auf Start- und Ergebnisseite.
//
//   BASE_URL=http://127.0.0.1:3100 npm run smoke:browser

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { unzipSync } from "fflate";
import { chromium, type Page } from "playwright-core";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3100";
const OUT = path.resolve(".smoke-artifacts");
const EXECUTABLE = process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
mkdirSync(OUT, { recursive: true });

const axeSource = readFileSync(path.resolve("node_modules/axe-core/axe.min.js"), "utf8");
const results: string[] = [];
let failed = false;

function check(ok: boolean, label: string) {
  results.push(`${ok ? "OK  " : "FAIL"} ${label}`);
  if (!ok) failed = true;
}

async function axe(page: Page, label: string) {
  await page.addScriptTag({ content: axeSource });
  const r = (await page.evaluate(async () => {
    // @ts-expect-error axe wird zur Laufzeit injiziert
    const res = await window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] } });
    return res.violations.map((v: { id: string; impact: string; nodes: unknown[] }) => `${v.id} (${v.impact}, ${v.nodes.length})`);
  })) as string[];
  check(r.length === 0, `axe ${label}: ${r.length === 0 ? "keine Verstöße" : r.join(", ")}`);
}

async function noHorizontalScroll(page: Page, label: string) {
  const ok = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  let detail = "";
  if (!ok) {
    // String-Auswertung, damit der TS-Transpiler keine Hilfsfunktionen einfügt.
    detail = (await page.evaluate(`(() => {
      const vw = window.innerWidth;
      const over = (el) => el.getBoundingClientRect().right > vw + 1 || el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflowX === "visible";
      const roots = new Set();
      for (const el of document.querySelectorAll("body *")) {
        if (el.getBoundingClientRect().right <= vw + 1) continue;
        let top = el;
        for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) if (p.getBoundingClientRect().right > vw + 1) top = p;
        roots.add(top);
      }
      return "scrollWidth=" + document.documentElement.scrollWidth + " body=" + document.body.scrollWidth + " " + [...roots].slice(0, 6).map((el) => el.tagName.toLowerCase() + "." + el.className + "#" + el.id + ":" + Math.round(el.getBoundingClientRect().right)).join(", ");
    })()`)) as string;
  }
  check(ok, `keine horizontale Scrollleiste (${label})${detail ? `: ${detail}` : ""}`);
}

async function main() {
  const browser = await chromium.launch({ executablePath: EXECUTABLE });
  const context = await browser.newContext({ acceptDownloads: true, viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  page.on("dialog", (d) => void d.accept());

  // Startseite
  await page.goto(`${BASE}/`);
  check((await page.locator("h1").textContent()) === "RepoLaunch", "Startseite lädt");
  check((await page.getAttribute("html", "lang")) === "de", "html lang=de");
  await axe(page, "Startseite");

  // Ungültige Eingabe zeigt Fehler am Feld
  await page.getByLabel("GitHub-Repository").fill("https://example.com/a/b");
  await page.getByRole("button", { name: "Analyse starten" }).click();
  check((await page.getByLabel("GitHub-Repository").getAttribute("aria-invalid")) === "true", "Feldfehler bei fremdem Host");

  // Demo-Audit
  await page.getByRole("button", { name: /Demo starten: CLI-Tool/ }).click();
  await page.waitForURL(/\/report\/[A-Za-z0-9_-]{16}#k=/);
  await page.getByRole("heading", { name: "Fünf priorisierte Aufgaben" }).waitFor({ timeout: 20000 });
  check(await page.getByText("Demo-Modus: Diese Daten stammen aus erfundenen Fixtures").isVisible(), "Demo-Hinweis sichtbar");
  check((await page.locator("ol.tasks > li").count()) === 5, "fünf priorisierte Aufgaben");
  check(await page.getByText("Kein GitHub- oder Google-Ranking").isVisible(), "Score-Hinweis sichtbar");
  for (const d of await page.locator("details").all()) await d.evaluate((el) => ((el as HTMLDetailsElement).open = true));
  await page.screenshot({ path: path.join(OUT, "report-desktop.png"), fullPage: true });
  await axe(page, "Ergebnisseite");

  // KI-Paket mit Testadapter: ohne Zustimmung gesperrt
  const start = page.getByRole("button", { name: "KI-Entwürfe erstellen" });
  check(await start.isDisabled(), "KI-Start ohne Zustimmung gesperrt");
  await page.getByLabel(/Ich stimme zu/).check();
  await start.click();
  await page.getByText("KI-Entwürfe erstellt").waitFor({ timeout: 20000 });
  check(true, "KI-Entwürfe mit Testadapter erstellt");

  // Export
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Export als ZIP herunterladen" }).click()]);
  const zipPath = path.join(OUT, download.suggestedFilename());
  await download.saveAs(zipPath);
  const names = Object.keys(unzipSync(readFileSync(zipPath))).map((n) => n.split("/").pop());
  check(["audit.json", "audit.md", "README.suggested.md", "launch-plan.md", "monetization-plan.md", "marketing-drafts.md"].every((n) => names.includes(n)), `ZIP enthält ${names.join(", ")}`);

  // Fragment mit Schlüssel bleibt nach Sprung zu einem Befund erhalten
  await page.locator("ol.tasks a").first().click();
  check(/#k=/.test(page.url()), "Schlüssel bleibt im URL-Fragment");

  // Mobile Breite
  await page.setViewportSize({ width: 360, height: 800 });
  await noHorizontalScroll(page, "Ergebnisseite 360 px");
  await page.screenshot({ path: path.join(OUT, "report-mobile.png"), fullPage: false });

  // Löschen
  await page.getByRole("button", { name: "Ergebnis jetzt löschen" }).click();
  await page.getByText("Das Ergebnis wurde gelöscht.").waitFor();
  check(true, "Löschen über den Zugriffsschlüssel");

  // Englische Startseite
  await page.goto(`${BASE}/en`);
  check((await page.getAttribute("html", "lang")) === "en", "html lang=en");
  await noHorizontalScroll(page, "Startseite EN 360 px");
  await axe(page, "Startseite EN");

  // Link ohne Schlüssel
  await page.goto(`${BASE}/report/AAAAAAAAAAAAAAAA`);
  check(await page.getByText("Dieser Link enthält keinen Zugriffsschlüssel").isVisible(), "ehrlicher Zustand ohne Schlüssel");

  await browser.close();
  writeFileSync(path.join(OUT, "browser-smoke.txt"), results.join("\n") + "\n");
  console.log(results.join("\n"));
  if (failed) process.exit(1);
}

main().catch((err) => {
  console.error(results.join("\n"));
  console.error(err);
  process.exit(1);
});
