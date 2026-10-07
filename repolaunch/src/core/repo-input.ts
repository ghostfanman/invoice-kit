// Validierung der Repository-Eingabe. Akzeptiert ausschließlich "owner/repo"
// oder "https://github.com/owner/repo" (optional mit abschließendem Schrägstrich).

export type RepoInputError =
  | "empty"
  | "too_long"
  | "non_ascii"
  | "wrong_scheme"
  | "wrong_host"
  | "credentials"
  | "port"
  | "query_or_fragment"
  | "extra_path"
  | "git_suffix"
  | "invalid_owner"
  | "invalid_repo";

export type RepoInputResult =
  | { ok: true; owner: string; repo: string; canonicalUrl: string }
  | { ok: false; error: RepoInputError };

const OWNER_RE = /^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$/;
const REPO_RE = /^[A-Za-z0-9._-]{1,100}$/;

export function isValidOwner(owner: string): boolean {
  return OWNER_RE.test(owner);
}

export function isValidRepoName(repo: string): boolean {
  return REPO_RE.test(repo) && repo !== "." && repo !== ".." && !repo.endsWith(".git");
}

export function parseRepoInput(raw: unknown): RepoInputResult {
  if (typeof raw !== "string") return { ok: false, error: "empty" };
  const input = raw.trim();
  if (input.length === 0) return { ok: false, error: "empty" };
  if (input.length > 200) return { ok: false, error: "too_long" };
  // Nur druckbares ASCII ohne Leerzeichen: verhindert Homoglyphen und versteckte Zeichen.
  if (!/^[\x21-\x7e]+$/.test(input)) return { ok: false, error: "non_ascii" };

  let path: string;
  if (input.includes("://") || /^[a-z][a-z0-9+.-]*:/i.test(input) || input.toLowerCase().startsWith("github.com")) {
    if (!input.startsWith("https://")) return { ok: false, error: "wrong_scheme" };
    const rest = input.slice("https://".length);
    const slash = rest.indexOf("/");
    const authority = slash === -1 ? rest : rest.slice(0, slash);
    if (authority.includes("@")) return { ok: false, error: "credentials" };
    if (authority.includes(":")) return { ok: false, error: "port" };
    if (authority.toLowerCase() !== "github.com") return { ok: false, error: "wrong_host" };
    path = slash === -1 ? "" : rest.slice(slash + 1);
  } else {
    path = input;
  }
  if (/[?#]/.test(path)) return { ok: false, error: "query_or_fragment" };
  if (path.endsWith("/")) path = path.slice(0, -1);
  const parts = path.split("/");
  if (parts.length > 2) return { ok: false, error: "extra_path" };
  const [owner = "", repo = ""] = parts;
  if (!isValidOwner(owner)) return { ok: false, error: "invalid_owner" };
  if (repo.endsWith(".git")) return { ok: false, error: "git_suffix" };
  if (!isValidRepoName(repo)) return { ok: false, error: "invalid_repo" };
  return { ok: true, owner, repo, canonicalUrl: `https://github.com/${owner}/${repo}` };
}
