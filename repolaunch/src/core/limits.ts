// Feste Obergrenzen für die Repository-Erfassung. Alle Werte gelten pro Analyseauftrag.

export interface CollectLimits {
  /** Höchstzahl an HTTP-Anfragen einschließlich Wiederholungen und Weiterleitungen. */
  maxRequests: number;
  /** Höchstmenge aller gelesenen Antwortdaten in Bytes. */
  maxTotalBytes: number;
  /** Höchstgröße einer JSON-Antwort (Metadaten, Dateiliste, Releases). */
  maxResponseBytes: number;
  /** Höchstgröße der README. Größere READMEs werden als "unbekannt" geführt. */
  maxReadmeBytes: number;
  /** Höchstgröße einer zusätzlich gelesenen Textdatei. */
  maxFileBytes: number;
  /** Höchstzahl zusätzlich gelesener Textdateien (Manifeste, CONTRIBUTING usw.). */
  maxFiles: number;
  /** Höchstzahl an Unterverzeichnissen, deren Dateiliste (nicht rekursiv) gelesen wird. */
  maxSubdirs: number;
  /** Höchstzahl gespeicherter Einträge der Dateiliste. */
  maxTreeEntries: number;
  /** Gesamtlaufzeit der Erfassung in Millisekunden. */
  deadlineMs: number;
  /** Zeitlimit einer einzelnen Anfrage in Millisekunden. */
  requestTimeoutMs: number;
  /** Wiederholungen bei Netzwerkfehlern, 5xx und kurzen Retry-After-Werten. */
  maxRetries: number;
  /** Längste Wartezeit, die ein Retry-After-Header auslösen darf. Längere Werte beenden den Auftrag ehrlich. */
  maxRetryWaitMs: number;
}

export const DEFAULT_COLLECT_LIMITS: CollectLimits = {
  maxRequests: 24,
  maxTotalBytes: 1_500_000,
  maxResponseBytes: 512_000,
  maxReadmeBytes: 300_000,
  maxFileBytes: 100_000,
  maxFiles: 8,
  maxSubdirs: 2,
  maxTreeEntries: 1000,
  deadlineMs: 30_000,
  requestTimeoutMs: 10_000,
  maxRetries: 2,
  maxRetryWaitMs: 5_000,
};
