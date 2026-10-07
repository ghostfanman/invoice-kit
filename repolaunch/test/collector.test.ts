import { describe, expect, it } from "vitest";
import { collectSnapshot } from "@/core/github/collector";
import { FIXTURE_OWNER, fixtureTransport } from "@/core/github/fixture-transport";
import { GitHubHttp, type Transport } from "@/core/github/http";
import { DEFAULT_COLLECT_LIMITS } from "@/core/limits";
import { cloneFixture, fixtureSnapshot } from "./helpers";

function http(transport: Transport) {
  return new GitHubHttp({ limits: DEFAULT_COLLECT_LIMITS, transport, sleep: async () => {} });
}

describe("Repository-Erfassung", () => {
  it("liest Metadaten, Commit-SHA, Dateiliste, README, Releases und ausgewählte Dateien", async () => {
    const s = await fixtureSnapshot("cli-tool");
    expect(s.commitSha).toBe("1".repeat(40));
    expect(s.defaultBranch).toBe("main");
    expect(s.analyzedAt).toBe("2026-10-07T12:00:00.000Z");
    expect(s.readme.state).toBe("present");
    expect(s.files["package.json"]?.state).toBe("present");
    expect(s.files["pyproject.toml"]?.state).toBe("missing");
    expect(s.releases.items[0]?.tag).toBe("v1.4.0");
    expect(s.tree.scannedDirs).toEqual(["", ".github"]);
    expect(s.stats.requests).toBeLessThanOrEqual(DEFAULT_COLLECT_LIMITS.maxRequests);
    expect(s.goodFirstIssues.state).toBe("not_checked");
  });

  it("unterscheidet fehlend von unbekannt bei nicht gelesenen Verzeichnissen", async () => {
    // docs/ existiert, wird aber wegen maxSubdirs nicht gelesen
    const fixtures = cloneFixture("cli-tool", (f) => {
      f.tree.push({ path: "docs", type: "tree" }, { path: "doc", type: "tree" });
    });
    const s = await collectSnapshot(
      new GitHubHttp({ limits: { ...DEFAULT_COLLECT_LIMITS, maxSubdirs: 1 }, transport: fixtureTransport(fixtures) }),
      { owner: FIXTURE_OWNER, repo: "cli-tool", goal: "users", source: "fixture" },
      { ...DEFAULT_COLLECT_LIMITS, maxSubdirs: 1 },
    );
    expect(s.tree.scannedDirs).toEqual(["", ".github"]);
    expect(s.files["docs/README.md"]?.state).toBe("unknown");
    expect(s.files["Cargo.toml"]?.state).toBe("missing");
  });

  it("meldet nicht vorhanden oder privat bei 404", async () => {
    await expect(fixtureSnapshot("does-not-exist")).rejects.toMatchObject({ code: "not_found_or_private" });
  });

  it("lehnt private Repositories ab", async () => {
    const fixtures = cloneFixture("cli-tool", (f) => {
      f.repo.private = true;
      f.repo.visibility = "private";
    });
    await expect(fixtureSnapshot("cli-tool", "users", fixtures)).rejects.toMatchObject({ code: "private_unsupported" });
  });

  it("meldet leere Repositories", async () => {
    const base = fixtureTransport(cloneFixture("cli-tool", () => {}));
    const transport: Transport = async (url, init) => (url.includes("/commits/") ? new Response("", { status: 409 }) : base(url, init));
    await expect(collectSnapshot(http(transport), { owner: FIXTURE_OWNER, repo: "cli-tool", goal: "users", source: "fixture" }, DEFAULT_COLLECT_LIMITS)).rejects.toMatchObject({ code: "empty_repository" });
  });

  it("führt fehlende README als missing und zu große als unknown", async () => {
    const noReadme = cloneFixture("cli-tool", (f) => {
      delete f.readme;
    });
    expect((await fixtureSnapshot("cli-tool", "users", noReadme)).readme.state).toBe("missing");
    const big = cloneFixture("cli-tool", (f) => {
      f.readme = { path: "README.md", text: "a".repeat(DEFAULT_COLLECT_LIMITS.maxReadmeBytes + 10) };
    });
    const s = await fixtureSnapshot("cli-tool", "users", big);
    expect(s.readme.state).toBe("unknown");
    expect(s.notes.length).toBeGreaterThan(0);
  });

  it("fragt Einstiegsaufgaben nur beim Ziel Mitwirkende ab", async () => {
    const fixtures = cloneFixture("cli-tool", (f) => {
      f.goodFirstIssues = [{ number: 1, title: "x" }, { number: 2, title: "pr", pull_request: {} }];
    });
    const s = await fixtureSnapshot("cli-tool", "contributors", fixtures);
    expect(s.goodFirstIssues).toEqual({ state: "present", count: 1 });
  });

  it("speichert Sterne nur zur Anzeige", async () => {
    const s = await fixtureSnapshot("library");
    expect(s.display.stars).toBe(1200);
    expect(JSON.stringify(s.meta)).not.toContain("1200");
  });
});
