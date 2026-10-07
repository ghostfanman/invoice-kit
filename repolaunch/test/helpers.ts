import { collectSnapshot } from "@/core/github/collector";
import { FIXTURE_OWNER, fixtureTransport, type FixtureRepo } from "@/core/github/fixture-transport";
import { GitHubHttp } from "@/core/github/http";
import { DEFAULT_COLLECT_LIMITS } from "@/core/limits";
import type { Goal, Language, RepoSnapshot } from "@/core/types";
import { FIXTURE_REPOS } from "@/fixtures/repos";

export const NOW = new Date("2026-10-07T12:00:00Z");

export async function fixtureSnapshot(name: string, goal: Goal = "users", fixtures: FixtureRepo[] = FIXTURE_REPOS): Promise<RepoSnapshot> {
  const http = new GitHubHttp({ limits: DEFAULT_COLLECT_LIMITS, transport: fixtureTransport(fixtures), sleep: async () => {} });
  return collectSnapshot(http, { owner: FIXTURE_OWNER, repo: name, goal, source: "fixture", fixtureName: name }, DEFAULT_COLLECT_LIMITS, () => NOW);
}

export function user(goal: Goal = "users", language: Language = "de") {
  return { goal, language };
}

export function cloneFixture(name: string, patch: (f: FixtureRepo) => void): FixtureRepo[] {
  const copy = structuredClone(FIXTURE_REPOS.find((f) => f.name === name)!);
  patch(copy);
  return [copy];
}
