# Datenaufbewahrung

## Was gespeichert wird

| Daten | Ort | Dauer |
| --- | --- | --- |
| Auftrag: Eingabe (Repository, Ziel, Sprache, optionale Zielgruppe und Merkmale), Status, Ereignisse | SQLite `jobs`, `job_events` | bis Ablauf (`JOB_TTL_HOURS`, Standard 72 Stunden) oder Löschung |
| Schnappschuss: öffentliche Metadaten, Dateiliste, README und ausgewählte Textdateien (begrenzt) | SQLite `jobs.snapshot_json` | wie oben |
| Audit-Ergebnis und KI-Ergebnis | SQLite `jobs.audit_json`, `jobs.ai_result_json` | wie oben |
| Zugriffsschlüssel | nur als SHA-256-Hash | wie oben |
| ETag-Cache öffentlicher GitHub-Antworten | SQLite `http_cache` | höchstens 24 Stunden |
| Ratenbegrenzung | Arbeitsspeicher des Prozesses | bis Fensterende oder Neustart |

Nicht gespeichert werden: Konten, E-Mail-Adressen, IP-Adressen in der Datenbank, Cookies, Tracking-Daten, Klartext-Schlüssel.

## Löschung

- Jederzeit über den Ergebnislink ("Ergebnis jetzt löschen" oder `DELETE /api/jobs/:id` mit Schlüssel). Ereignisse werden mitgelöscht.
- Automatisch: Der Worker löscht alle zehn Minuten abgelaufene Aufträge und alte Cache-Einträge. Abgelaufene Aufträge sind schon vor der physischen Löschung nicht mehr abrufbar.
- SQLite gibt Speicherplatz nicht sofort frei. Für eine sofortige Bereinigung der Datei: `sqlite3 data/repolaunch.sqlite "VACUUM;"` bei gestopptem Dienst.
- Backups (siehe [operations.md](operations.md)) enthalten Daten bis zu ihrer eigenen Löschung. Backup-Aufbewahrung daher kurz halten, Empfehlung höchstens 7 Tage.

## Logs

Strukturierte JSON-Logs auf stdout enthalten Zeit, Ereignis, Auftrags-ID, Pfadmuster der GitHub-API (ohne Owner und Repo), Status, Dauer und Fehlercodes. Keine Schlüssel, Tokens, Inhalte oder Nutzerangaben. Die Aufbewahrung der Logs bestimmt der Betreiber.

## KI-Verarbeitung

Nur nach ausdrücklicher Zustimmung im Ergebnis. Übermittelt werden genau die vorher angezeigten Inhaltsgruppen an den angezeigten Anbieter (Standard: Anthropic, `api.anthropic.com`). Dort gelten dessen Bedingungen zur Datenverarbeitung.

## Pilotdaten

Für den Validierungsplan werden Pilotaufzeichnungen manuell und anonymisiert außerhalb der Anwendung geführt, siehe [validation-plan.md](validation-plan.md).
