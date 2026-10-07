// Fehlerarten der Repository-Erfassung. Sie werden im UI ehrlich unterschieden.

export type CollectErrorCode =
  /** GitHub antwortet 404: Repository existiert nicht oder ist privat. Öffentlich nicht unterscheidbar. */
  | "not_found_or_private"
  /** Die API meldet ein privates Repository (nur mit Token sichtbar). Im MVP nicht unterstützt. */
  | "private_unsupported"
  /** 403 ohne Ratenlimit oder 451: Zugriff gesperrt. */
  | "access_blocked"
  | "rate_limited"
  | "github_api_error"
  | "timeout"
  | "limit_exceeded"
  | "redirect_rejected"
  | "invalid_response"
  /** 401: konfiguriertes Token ungültig. */
  | "auth_config"
  /** Leeres Repository ohne Commits. */
  | "empty_repository";

export class CollectError extends Error {
  readonly code: CollectErrorCode;
  readonly status?: number;
  readonly retryAfterSeconds?: number;
  readonly resetAt?: string;

  constructor(
    code: CollectErrorCode,
    message: string,
    extra: { status?: number; retryAfterSeconds?: number; resetAt?: string } = {},
  ) {
    super(message);
    this.name = "CollectError";
    this.code = code;
    this.status = extra.status;
    this.retryAfterSeconds = extra.retryAfterSeconds;
    this.resetAt = extra.resetAt;
  }
}

/** Antwort größer als erlaubt. Für einzelne Dateien führt das zu "unbekannt", nicht zum Abbruch. */
export class ResponseTooLargeError extends Error {
  constructor(readonly limit: number) {
    super(`Antwort größer als ${limit} Bytes`);
    this.name = "ResponseTooLargeError";
  }
}
