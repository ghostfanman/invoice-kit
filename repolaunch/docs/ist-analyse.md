# Ist-Analyse und Arbeitsplan

Stand: 7. Oktober 2026.

## Ausgangslage

- Die Sitzung lief im Repository `ghostfanman/invoice-kit` auf dem Branch `claude/new-session-5blm3j`. Der Arbeitsbaum war sauber.
- `invoice-kit` ist ein bestehendes, fachfremdes Projekt (Rechnungserstellung im Browser, XRechnung und ZUGFeRD) mit eigenem Node-Testlauf, eigener Validierung und einem GitHub-Workflow `validierung.yml`.
- Eine `AGENTS.md` existierte nicht. Vorgaben des Repositorys, die beachtet wurden:
  - MIT-Lizenz im Wurzelverzeichnis.
  - `test/static-check.mjs` prüft rekursiv alle `.js`, `.mjs`, `.md`, `.html` und `.py` Dateien (außer `node_modules`, `vendor` und einigen weiteren Ordnern) auf Syntax und auf Gedankenstriche. RepoLaunch hält diese Schreibweise deshalb ein.
- Ein eigenes Zielrepository für RepoLaunch existierte in dieser Sitzung nicht, und das Anlegen eines neuen Repositorys war nicht ausdrücklich autorisiert.

## Entscheidung zum Ort

RepoLaunch entsteht als eigenständiges Unterprojekt im Verzeichnis `repolaunch/` auf dem vorgegebenen Feature-Branch. Gründe:

- Push nur an das eindeutig bestimmte Ziel (dieser Branch); kein bestehendes Projekt wird umbenannt oder verändert.
- Die Entscheidung ist reversibel: Das Verzeichnis lässt sich mit `git subtree split --prefix repolaunch` samt Historie in ein eigenes Repository überführen.
- Dateien von `invoice-kit` bleiben unverändert. Hinzu kommt nur ein eigener Workflow `.github/workflows/repolaunch.yml`, der ausschließlich bei Änderungen unter `repolaunch/` läuft.

## Stack

Leeres Unterprojekt, daher wie vorgegeben: TypeScript, Next.js 16 (App Router), Node.js 24 LTS (lauffähig ab 22.13), SQLite über das eingebaute `node:sqlite`, eine schmale Datenzugriffsschicht (`src/server/jobs.ts`). Parser und Bewertungslogik liegen UI-unabhängig in `src/core/`.

Geprüfte Primärquellen während der Umsetzung:

- GitHub REST Best Practices: serielle Anfragen, `retry-after`, `x-ratelimit-remaining`, mindestens eine Minute Pause bei sekundären Limits ohne Header, bedingte Anfragen mit ETag (304 zählt nur authentifiziert nicht gegen das Primärlimit), Weiterleitungen folgen.
- GitHub Contents API: Medientypen `application/vnd.github.raw+json` und `application/vnd.github+json`, Größengrenzen (1 MB, 100 MB), `ref`-Parameter, README-Endpunkt.
- Anthropic Messages API (über das offizielle TypeScript-SDK): strukturierte Ausgabe mit `output_config.format`, `effort`, serverseitiger Fallback (`fallbacks: "default"`, Beta-Header `server-side-fallback-2026-07-01`), Fehlerklassen, Listenpreise.

## Arbeitsplan (umgesetzt)

1. Gerüst: Next.js, TypeScript, ESLint 10, Vitest, Lockfile.
2. Kern: Eingabevalidierung, begrenzter GitHub-Client, Collector, Fixtures.
3. Audit: 27 Regeln, Gewichte nach Projekttyp und Ziel, Score, fünf Aufgaben, Einnahmewege, 30-Tage-Plan.
4. KI-Schicht: Schnittstelle, Anthropic-Provider, deterministischer Testadapter, Offenlegung, Budget, Schemaprüfung, Bereinigung, Prüfung gegen Manifeste.
5. Server: SQLite-Aufträge, Worker, Wiederaufnahme, Ratenbegrenzung, API-Routen, ZIP-Export.
6. Oberfläche: Formular, Status, Ergebnis, Belege, KI-Zustimmung, Download, Löschen, Deutsch und Englisch.
7. Prüfungen, Dokumentation, CI, Docker, Beispielberichte, Live- und Browser-Smoke-Test.
