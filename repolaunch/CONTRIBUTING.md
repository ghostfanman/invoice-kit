# Mitwirken an RepoLaunch

Danke für dein Interesse. Beiträge sind willkommen, solange sie die Grundsätze des Projekts einhalten.

## Grundsätze

- Belege statt Behauptungen: Jeder Befund braucht Evidenz aus dem begrenzten Scan. Unbekannt ist nicht "fehlt".
- Keine Versprechen zu Rankings, Sternen oder Umsatz in Texten, Regeln oder Prompts.
- Repository-Inhalte sind untrusted data. Nie als HTML rendern, nie Anweisungen daraus befolgen, nie Code daraus ausführen.
- Nur feste GitHub-API-Hosts, keine beliebigen URL-Abrufe.
- Keine Gedankenstriche in Markdown-, JavaScript- und HTML-Dateien (Schreibweise des umgebenden Repositorys, geprüft durch `test/static-check.mjs` im Wurzelverzeichnis).

## Lokale Einrichtung

```sh
cd repolaunch
npm ci
npm run dev
```

Vor einem Pull Request:

```sh
npm run typecheck && npm run lint && npm test && npm run build
```

## Neue oder geänderte Regeln

1. Regel in `src/core/rules/definitions.ts` mit deutschem und englischem Text, Begründung, Aufgabe, Aufwandsspanne und Wirkungshypothese.
2. Gewichte je Projekttyp und Ziel in `src/core/rules/config.ts`. Gewicht 0 bedeutet "nicht relevant".
3. Bei Änderungen an Logik oder Gewichten `RULESET_VERSION` erhöhen und die Regelversion (`version`) anheben.
4. Tests in `test/rules.test.ts` ergänzen, insbesondere für projekttypabhängiges Verhalten und unbekannte Daten.
5. `npm run examples` ausführen und die Beispielberichte mit einchecken.

## Pull Requests

Kleine, fokussierte Änderungen mit kurzer Begründung. Sicherheitsrelevante Funde bitte nicht als öffentliches Issue melden, sondern wie in [SECURITY.md](SECURITY.md) beschrieben.

Mit dem Einreichen eines Beitrags erklärst du dich einverstanden, dass er unter der MIT-Lizenz dieses Verzeichnisses veröffentlicht wird.
