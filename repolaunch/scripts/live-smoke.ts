// Live-Smoke-Test gegen ein öffentliches, eigenes Test-Repository (nur Lesezugriff, ohne KI).
//   LIVE_REPO=owner/repo npm run smoke:live
// Optional GITHUB_TOKEN (ohne Scopes) für höhere Ratenlimits; hinter einem Proxy NODE_USE_ENV_PROXY=1.

import { collectSnapshot } from "@/core/github/collector";
import { CollectError } from "@/core/github/errors";
import { GitHubHttp } from "@/core/github/http";
import { DEFAULT_COLLECT_LIMITS } from "@/core/limits";
import { parseRepoInput } from "@/core/repo-input";
import { buildExport } from "@/core/report/export";
import { runAudit } from "@/core/rules/engine";

const input = parseRepoInput(process.env.LIVE_REPO ?? "ghostfanman/invoice-kit");
if (!input.ok) {
  console.error(`Ungültiges LIVE_REPO: ${input.error}`);
  process.exit(2);
}
const user = { goal: "users" as const, language: "de" as const };
const http = new GitHubHttp({
  limits: DEFAULT_COLLECT_LIMITS,
  token: process.env.GITHUB_TOKEN || undefined,
  logger: { request: (e) => console.log(`GET ${e.path} -> ${e.status} (${e.ms} ms)`) },
});
try {
  const snapshot = await collectSnapshot(http, { owner: input.owner, repo: input.repo, goal: user.goal, source: "github" }, DEFAULT_COLLECT_LIMITS);
  const audit = runAudit(snapshot, user);
  const bundle = buildExport(snapshot, audit, user, null);
  console.log(`Repository: ${snapshot.fullName} @ ${snapshot.commitSha} (${snapshot.defaultBranch})`);
  console.log(`Analysezeit: ${snapshot.analyzedAt}, Anfragen: ${snapshot.stats.requests}, Bytes: ${snapshot.stats.bytes}`);
  console.log(`Projekttyp: ${audit.classification.used}, interner Bereitschaftsscore: ${audit.score.value}, Abdeckung: ${Math.round(audit.score.coverage * 100)} %`);
  for (const t of audit.tasks) console.log(`  ${t.rank}. ${t.title} [${t.findingId}] (${t.effort})`);
  console.log(`Export: ${bundle.filename}, ${bundle.zip.byteLength} Bytes, Dateien: ${Object.keys(bundle.contents).join(", ")}`);
  if (audit.tasks.length === 0 || audit.tasks.some((t) => !audit.findings.find((f) => f.id === t.findingId)?.evidence.length)) process.exit(1);
} catch (err) {
  if (err instanceof CollectError) console.error(`Erfassung fehlgeschlagen: ${err.code} ${err.message}${err.resetAt ? ` (Reset ${err.resetAt})` : ""}`);
  else console.error(err);
  process.exit(1);
}
