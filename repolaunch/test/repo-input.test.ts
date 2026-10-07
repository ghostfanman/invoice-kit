import { describe, expect, it } from "vitest";
import { parseRepoInput } from "@/core/repo-input";

describe("URL-Validierung", () => {
  it.each([
    ["owner/repo", "owner", "repo"],
    ["https://github.com/owner/repo", "owner", "repo"],
    ["https://github.com/owner/repo/", "owner", "repo"],
    ["  https://GitHub.com/Some-Owner/my.repo_name  ", "Some-Owner", "my.repo_name"],
    ["a/b", "a", "b"],
  ])("akzeptiert %s", (input, owner, repo) => {
    const r = parseRepoInput(input);
    expect(r).toEqual({ ok: true, owner, repo, canonicalUrl: `https://github.com/${owner}/${repo}` });
  });

  it.each([
    ["", "empty"],
    [42, "empty"],
    ["x".repeat(201), "too_long"],
    ["http://github.com/owner/repo", "wrong_scheme"],
    ["github.com/owner/repo", "wrong_scheme"],
    ["ftp://github.com/owner/repo", "wrong_scheme"],
    ["https://gitlab.com/owner/repo", "wrong_host"],
    ["https://www.github.com/owner/repo", "wrong_host"],
    ["https://github.com.evil.com/owner/repo", "wrong_host"],
    ["https://api.github.com/repos/owner/repo", "wrong_host"],
    ["https://user:pass@github.com/owner/repo", "credentials"],
    ["https://github.com@evil.com/owner/repo", "credentials"],
    ["https://github.com:443/owner/repo", "port"],
    ["https://github.com/owner/repo?tab=readme", "query_or_fragment"],
    ["https://github.com/owner/repo#readme", "query_or_fragment"],
    ["https://github.com/owner/repo/tree/main", "extra_path"],
    ["owner/repo/issues", "extra_path"],
    ["https://github.com/owner/repo.git", "git_suffix"],
    ["-owner/repo", "invalid_owner"],
    ["own--er/repo", "invalid_owner"],
    ["o".repeat(40) + "/repo", "invalid_owner"],
    ["owner/..", "invalid_repo"],
    ["owner/", "invalid_repo"],
    ["owner/re po", "non_ascii"],
    ["оwner/repo", "non_ascii"],
    ["owner/repo‮", "non_ascii"],
    ["https://github.com/owner", "invalid_repo"],
    ["javascript:alert(1)", "wrong_scheme"],
    ["file:///etc/passwd", "wrong_scheme"],
    ["http://169.254.169.254/latest", "wrong_scheme"],
  ])("lehnt %s ab (%s)", (input, error) => {
    expect(parseRepoInput(input)).toEqual({ ok: false, error });
  });
});
