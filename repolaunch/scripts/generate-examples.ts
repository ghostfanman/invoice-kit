// Erzeugt die Beispielberichte in docs/examples aus den erfundenen Fixtures (ohne KI, reproduzierbar).
//   npm run examples

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { collectSnapshot } from "@/core/github/collector";
import { FIXTURE_OWNER, fixtureTransport } from "@/core/github/fixture-transport";
import { GitHubHttp } from "@/core/github/http";
import { DEFAULT_COLLECT_LIMITS } from "@/core/limits";
import { buildExport } from "@/core/report/export";
import { runAudit } from "@/core/rules/engine";
import type { UserContext } from "@/core/types";
import { FIXTURE_REPOS } from "@/fixtures/repos";

const NOW = new Date("2026-10-07T12:00:00Z");

const EXAMPLES: { dir: string; fixture: string; user: UserContext }[] = [
  { dir: "cli-tool", fixture: "cli-tool", user: { goal: "users", language: "de" } },
  { dir: "web-app", fixture: "web-app", user: { goal: "saas_customers", language: "de", audience: "Kleine Teams mit Schichtbetrieb" } },
];

for (const ex of EXAMPLES) {
  const http = new GitHubHttp({ limits: DEFAULT_COLLECT_LIMITS, transport: fixtureTransport(FIXTURE_REPOS) });
  const snapshot = await collectSnapshot(http, { owner: FIXTURE_OWNER, repo: ex.fixture, goal: ex.user.goal, source: "fixture", fixtureName: ex.fixture }, DEFAULT_COLLECT_LIMITS, () => NOW);
  const audit = runAudit(snapshot, ex.user, { now: NOW });
  const bundle = buildExport(snapshot, audit, ex.user, null);
  const out = path.resolve("docs/examples", ex.dir);
  mkdirSync(out, { recursive: true });
  for (const [name, text] of Object.entries(bundle.contents)) writeFileSync(path.join(out, name), text.endsWith("\n") ? text : `${text}\n`);
  console.log(`${ex.dir}: Score ${audit.score.value}, ${audit.tasks.length} Aufgaben, Dateien: ${Object.keys(bundle.contents).join(", ")}`);
}
