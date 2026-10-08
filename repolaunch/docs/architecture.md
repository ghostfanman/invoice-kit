# Architektur und Entscheidungen

## Überblick

```text
Browser (React, nur Textdarstellung)
   |  POST /api/jobs            -> Auftrag, geheimer Schlüssel
   |  GET  /api/jobs/:id        (Authorization: Bearer <schlüssel>)
   |  POST /api/jobs/:id/ai     (consent: true)
   |  GET  /api/jobs/:id/export -> ZIP
   |  DELETE /api/jobs/:id
   v
Next.js Route Handler (src/app/api)  ->  Service (src/server/service.ts)
                                          |  Validierung (zod), Limits, Zugriffsschlüssel
                                          v
                                   SQLite (src/server/db.ts, jobs.ts)
                                          ^
                                          |  claimNext / complete / fail / heartbeat
                                   Worker (src/server/app.ts), genau einer pro Prozess
                                          |
               +--------------------------+---------------------------+
               v                                                      v
  Kern: Erfassung (src/core/github)                     Kern: KI-Paket (src/core/ai)
  GitHubHttp: nur api.github.com, seriell,              LlmProvider: AnthropicProvider | FakeProvider
  Budgets, ETag, Retry-After                            Offenlegung, Budget, Schema, Bereinigung, Prüfung
               v
  Kern: Audit (src/core/rules, analysis, monetization, launch-plan)
               v
  Kern: Berichte und Export (src/core/report)
```

Der Kern (`src/core`) kennt weder Next.js noch SQLite und ist vollständig mit Fixtures testbar.

## Entscheidungen

| Thema | Entscheidung | Begründung |
| --- | --- | --- |
| Ort | Eigenes privates Repository `ghostfanman/repolaunch` | Zunächst als Unterprojekt in `invoice-kit` entwickelt; Umzug am 8. Oktober 2026 freigegeben, per `git subtree split` samt Historie |
| Laufzeit | Ein Node-Prozess (`next start` bzw. `server.js` standalone) mit einem Worker | Vorgabe "einzelner Prozess"; serielle GitHub-Anfragen; keine serverlosen Annahmen |
| Datenbank | `node:sqlite` mit WAL | Keine nativen Builds, Backup per Datei-Snapshot, ausreichend für ein MVP |
| Worker-Start | `instrumentation.ts` beim Serverstart, zusätzlich beim ersten API-Zugriff | Funktioniert mit `next start` und standalone |
| Wiederaufnahme | Herzschlag alle 5 s; beim Start und alle 10 min: laufende Aufträge ohne Herzschlag zurück in die Warteschlange, nach `MAX_JOB_ATTEMPTS` Abbruch mit `interrupted`; jeder Schritt als Ereignis protokolliert | Nachvollziehbar, begrenzt, keine Endlosschleifen |
| Zugriff | 96-Bit-ID plus 256-Bit-Schlüssel, gespeichert nur als SHA-256 über `id:schlüssel`, Vergleich in konstanter Zeit | Hochentropisch, keine Konten, keine öffentlichen Listen |
| Schlüsseltransport | URL-Fragment `#k=` im Browser, `Authorization: Bearer` an die API | Fragmente erreichen keine Server- oder Proxy-Logs |
| GitHub-Zugriff | Nur `https://api.github.com`, feste Pfadmuster, Weiterleitungen nur dorthin (max. 2), keine `download_url` | Kein SSRF, keine privaten IPs, keine unkontrollierten Redirects |
| Erfassungsumfang | Metadaten, Commit-SHA, Wurzelbaum, `.github` und `docs` (je nicht rekursiv), README, Releases oder Tags, bis zu 8 Textdateien | "Kein rekursiver Vollscan"; Budgets: 24 Anfragen, 1,5 MB, 30 s |
| Unbekannt vs. fehlt | Dateien in nicht gelesenen Verzeichnissen oder bei gekürzter Liste gelten als unbekannt | Ehrliche Befunde; Score schließt Unbekanntes aus und zeigt die Abdeckung |
| Regeln | Code für die Prüfung, Gewichte getrennt in `config.ts`, versioniert (`RULESET_VERSION`), überschreibbar per JSON | Konfigurierbar, nachvollziehbar, projekttyp- und zielabhängig |
| Score | Summe erfüllter Gewichte / Summe bewerteter Gewichte; Formel, Kategorien, Abdeckung und ausgeschlossene Regeln werden angezeigt | Interner Bereitschaftsscore, kein Ranking; Sterne sind nicht im Regelkontext |
| KI | Optional; ein Provider (Anthropic, Standardmodell `claude-opus-5-5`, Effort `medium`), deterministischer Testadapter | Audit funktioniert ohne Schlüssel; Provider austauschbar über `LlmProvider` |
| KI-Sicherheit | Offenlegung vor Zustimmung, Injection-Zeilen entfernt, Daten als untrusted markiert, striktes Schema, Bereinigung, Prüfung von Befehlen, Pfaden, Links und Behauptungen | Keine erfundenen Installationsbefehle oder Eigenschaften ohne Kennzeichnung |
| Darstellung | React rendert nur Text; Vorschauen als `<pre>`; ESLint verbietet `dangerouslySetInnerHTML` | Kein XSS durch Repository- oder KI-Inhalte |
| Sprache | Texte zentral in `src/i18n/messages.ts`; Regeltexte zweisprachig; Routen `/` und `/en` mit eigenem `lang` | WCAG 3.1.1 |
| Abrechnung | Keine | Preise sind Testhypothesen (siehe Validierungsplan) |

## Datenmodell

- `jobs`: Status (`queued`, `running`, `done`, `failed`), Eingabe, Ablaufzeit, Versuche, Herzschlag, Fehlercode, Regelwerk, Commit-SHA, Analysezeit, Schnappschuss und Audit als JSON, KI-Status, KI-Anfrage (inklusive Zustimmungszeit), KI-Ergebnis, KI-Läufe.
- `job_events`: Verlauf je Auftrag (angelegt, gestartet, wiederaufgenommen, fertig, Fehler, KI-Schritte), ohne Inhalte.
- `http_cache`: ETag und Antwortkörper öffentlicher API-Antworten, höchstens 24 Stunden.

## API-Fehlercodes

`invalid_request`, `invalid_repo` (mit Detail), `demo_disabled`, `rate_limited_client` (mit `Retry-After`), `queue_full`, `not_found`, `consent_required`, `ai_not_configured`, `ai_limit`, `not_ready`.

Auftragsfehler: `not_found_or_private`, `private_unsupported`, `access_blocked`, `rate_limited`, `github_api_error`, `timeout`, `limit_exceeded`, `redirect_rejected`, `invalid_response`, `auth_config`, `empty_repository`, `interrupted`, `internal_error`.

KI-Fehler: `timeout`, `refusal`, `invalid_output`, `truncated`, `rate_limited`, `auth`, `provider_error`, `budget_exceeded`, `not_configured`, `interrupted`.

## Später

Siehe [roadmap.md](roadmap.md). Diese Punkte sind bewusst nicht implementiert.
