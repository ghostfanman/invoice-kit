# RepoLaunch-Audit: repolaunch-fixtures/web-app

> Demo-Modus: Diese Daten stammen aus erfundenen Fixtures, nicht von GitHub.

- Repository: [repolaunch-fixtures/web-app](https://github.com/repolaunch-fixtures/web-app)
- Analysierter Commit: `2222222222222222222222222222222222222222` (Default-Branch `main`)
- Analysezeit: 2026-10-07T12:00:00.000Z

- Projekttyp: Webprodukt / SaaS
- Ziel: SaaS-Kunden
- Regelwerk: `2026.10.0`
- API-Anfragen: 7 (0 × 304), 1672 B
- Sterne (nur Anzeige, nicht bewertet): 7

## Interner Bereitschaftsscore

> Interne Kennzahl dieses Werkzeugs. Kein GitHub- oder Google-Ranking und keine Erfolgswahrscheinlichkeit. Sterne fließen nicht ein.

**36 / 100**, Abdeckung 100 %

Berechnung: Score = Summe der Gewichte erfüllter Regeln / Summe der Gewichte bewerteter Regeln × 100 = 16 / 45 × 100. Unbekannte und nicht relevante Regeln zählen nicht. Abdeckung = bewertete Gewichte / (bewertete + unbekannte Gewichte) = 45 / 45.

| Kategorie | Erfüllt | Bewertet | Unbekannt |
| --- | --- | --- | --- |
| Verständnis | 3 | 12 | 0 |
| Nutzbarkeit | 2 | 8 | 0 |
| Vertrauen | 8 | 14 | 0 |
| Verbreitung und Vermarktung | 3 | 11 | 0 |

## Fünf priorisierte Aufgaben

1. **Website-Feld gesetzt** (`distribution.homepage@1`, Schwere: hoch, Aufwand: 2 bis 10 Min.)
   - Aufgabe: Trage im Repository unter "About" eine Website ein (Demo, Doku oder Produktseite).
   - Erwartete Wirkung (Hypothese): Mehr Besuche der Demo- oder Produktseite.
2. **Aussagekräftige Repository-Beschreibung** (`understanding.description@1`, Schwere: hoch, Aufwand: 5 bis 15 Min.)
   - Aufgabe: Formuliere die Beschreibung als einen Satz: Was ist das Projekt, für wen, welcher Nutzen.
   - Erwartete Wirkung (Hypothese): Besucher erkennen schneller, ob das Projekt zu ihrem Problem passt.
3. **Sicherheitsrichtlinie** (`trust.security_policy@1`, Schwere: hoch, Aufwand: 15 bis 30 Min.)
   - Aufgabe: Lege SECURITY.md an: Meldeweg (z. B. private Sicherheitsmeldung über GitHub), unterstützte Versionen, Reaktionszeit ohne Garantie.
   - Erwartete Wirkung (Hypothese): Höheres Vertrauen bei professionellen Nutzern.
4. **Zielgruppe und Nutzen benannt** (`understanding.audience@1`, Schwere: hoch, Aufwand: 20 bis 60 Min.)
   - Aufgabe: Ergänze einen Abschnitt "Funktionen" oder "Für wen" mit drei bis fünf konkreten Punkten.
   - Erwartete Wirkung (Hypothese): Passende Nutzer erkennen sich wieder, unpassende Anfragen nehmen ab.
5. **Screenshot, Animation oder Demo** (`usability.visual_demo@1`, Schwere: hoch, Aufwand: 20 bis 60 Min.)
   - Aufgabe: Füge einen aktuellen Screenshot, eine kurze Aufnahme oder einen Demo-Link in die README ein.
   - Erwartete Wirkung (Hypothese): Höhere Klickrate auf Demo bzw. Installation, besonders bei Webprodukten.

## Alle Befunde

### Verständnis

#### Aussagekräftige Repository-Beschreibung (`understanding.description@1`)

- Status: **fehlt**, Schwere: hoch, Gewicht: 3
- Begründung: Die Beschreibung erscheint in Suchergebnissen, Vorschauen und Listen. Sie ist oft der erste Kontakt. Beschreibung ist sehr kurz oder wiederholt nur den Namen.
- Aufgabe: Formuliere die Beschreibung als einen Satz: Was ist das Projekt, für wen, welcher Nutzen.
- Aufwand: 5 bis 15 Min.
- Erwartete Wirkung (Hypothese): Besucher erkennen schneller, ob das Projekt zu ihrem Problem passt.
- Belege:

  - [GitHub API: description](https://github.com/repolaunch-fixtures/web-app)
  
    ```text
    Shiftboard
    ```
  

#### README vorhanden (`understanding.readme@1`)

- Status: **vorhanden**, Gewicht: 3
- Begründung: Die README ist laut GitHub meist das Erste, was Besucher sehen. Ohne sie fehlt jede Erklärung.
- Belege:

  - [README.md (129 B)](https://github.com/repolaunch-fixtures/web-app/blob/2222222222222222222222222222222222222222/README.md)

#### Einleitender Absatz in der README (`understanding.intro@1`)

- Status: **fehlt**, Schwere: mittel, Gewicht: 2
- Begründung: Ein kurzer Absatz direkt unter dem Titel erklärt Zweck und Nutzen, bevor Details folgen.
- Aufgabe: Schreibe unter den Titel zwei bis drei Sätze: Problem, Lösung, für wen.
- Aufwand: 15 bis 45 Min.
- Erwartete Wirkung (Hypothese): Weniger Absprünge auf der Repository-Seite, weniger Grundsatzfragen in Issues.
- Belege:

  - [Kurzer Einleitungstext](https://github.com/repolaunch-fixtures/web-app/blob/2222222222222222222222222222222222222222/README.md#L3-L3) (Zeilen 3 bis 3)
  
    ```text
    Shiftboard
    ```
  

#### Zielgruppe und Nutzen benannt (`understanding.audience@1`)

- Status: **fehlt**, Schwere: hoch, Gewicht: 3
- Begründung: Besucher entscheiden schneller, wenn Funktionen, Anwendungsfälle oder die Zielgruppe ausdrücklich genannt sind.
- Aufgabe: Ergänze einen Abschnitt "Funktionen" oder "Für wen" mit drei bis fünf konkreten Punkten.
- Aufwand: 20 bis 60 Min.
- Erwartete Wirkung (Hypothese): Passende Nutzer erkennen sich wieder, unpassende Anfragen nehmen ab.
- Belege:

  - [README.md: keine Überschrift wie Features/Why/Use cases/Funktionen und keine Zielgruppennennung](https://github.com/repolaunch-fixtures/web-app/blob/2222222222222222222222222222222222222222/README.md)

#### Konkretes Nutzungsbeispiel (`understanding.example@1`)

- Status: **fehlt**, Schwere: niedrig, Gewicht: 1
- Begründung: Ein kurzes Beispiel zeigt schneller als jede Beschreibung, wie sich das Projekt anfühlt.
- Aufgabe: Füge ein minimales, lauffähiges Beispiel mit erwarteter Ausgabe hinzu.
- Aufwand: 20 bis 60 Min.
- Erwartete Wirkung (Hypothese): Mehr erfolgreiche erste Nutzungen, weniger Fragen zur Grundbedienung.
- Belege:

  - [README.md: kein Codeblock außer Installationsbefehlen und kein Abschnitt Usage/Example/Verwendung mit Code](https://github.com/repolaunch-fixtures/web-app/blob/2222222222222222222222222222222222222222/README.md)

### Nutzbarkeit

#### Dokumentierter Schnellstart (`usability.quickstart@1`)

- Status: **vorhanden**, Gewicht: 2
- Begründung: Ein klarer erster Schritt (Installation oder Start) ist die Voraussetzung jeder Nutzung.
- Belege:

  - [Abschnitt "Setup"](https://github.com/repolaunch-fixtures/web-app/blob/2222222222222222222222222222222222222222/README.md#L5-L12) (Zeilen 5 bis 12)
  
    ````text
    ## Setup
    
    ```sh
    docker compose up
    ```
    
    Then open http://localhost:8080.
    
    ````
  

#### Voraussetzungen genannt (`usability.prerequisites@1`)

- Status: **fehlt**, Schwere: mittel, Gewicht: 2
- Begründung: Fehlende Angaben zu Laufzeit oder Versionen führen zu fehlgeschlagenen ersten Versuchen.
- Aufgabe: Nenne vor der Installation Laufzeit und Mindestversionen (z. B. Node, Python, Docker).
- Aufwand: 10 bis 20 Min.
- Erwartete Wirkung (Hypothese): Weniger Issues zu Installationsfehlern.
- Belege:

  - [README.md: keine Voraussetzungen/Requirements genannt; kein engines/requires-python/rust-version im Manifest](https://github.com/repolaunch-fixtures/web-app/blob/2222222222222222222222222222222222222222/README.md)

#### Screenshot, Animation oder Demo (`usability.visual_demo@1`)

- Status: **fehlt**, Schwere: hoch, Gewicht: 3
- Begründung: Bei sichtbaren Produkten zeigt ein Bild sofort, was man bekommt. Bei CLIs ist es ein Pluspunkt, kein Muss.
- Aufgabe: Füge einen aktuellen Screenshot, eine kurze Aufnahme oder einen Demo-Link in die README ein.
- Aufwand: 20 bis 60 Min.
- Erwartete Wirkung (Hypothese): Höhere Klickrate auf Demo bzw. Installation, besonders bei Webprodukten.
- Belege:

  - [README.md: kein Bild außer Badges und kein Link auf Demo/Screenshot/Video](https://github.com/repolaunch-fixtures/web-app/blob/2222222222222222222222222222222222222222/README.md)

#### Weiterführende Dokumentation (`usability.docs@1`)

- Status: **fehlt**, Schwere: niedrig, Gewicht: 1
- Begründung: Über den Einstieg hinaus brauchen Nutzer eine Stelle für Details: docs-Ordner, Wiki oder Doku-Seite.
- Aufgabe: Lege einen docs-Ordner oder eine Doku-Seite an und verlinke sie prominent in der README.
- Aufwand: 1 bis 4 Std.
- Erwartete Wirkung (Hypothese): Fortgeschrittene Nutzer bleiben, wiederkehrende Fragen nehmen ab.
- Belege:

  - [Kein docs/-Verzeichnis im Wurzelverzeichnis und kein Doku-Link in der README](https://github.com/repolaunch-fixtures/web-app/tree/2222222222222222222222222222222222222222)

### Vertrauen

#### Lizenzinformation (`trust.license@1`)

- Status: **vorhanden**, Gewicht: 3
- Begründung: Ohne erkennbare Lizenz ist unklar, ob und wie andere das Projekt nutzen dürfen. Das ist keine Rechtsberatung.
- Belege:

  - [GitHub API: license.spdx\_id (GitHub-Lizenzerkennung)](https://github.com/repolaunch-fixtures/web-app)
  
    ```text
    AGPL-3.0 (GNU Affero General Public License v3.0)
    ```
  

#### Erkennbarer Wartungsstatus (`trust.maintenance@1`)

- Status: **vorhanden**, Gewicht: 3
- Begründung: Nutzer prüfen, ob ein Projekt gepflegt wird. Archivierte oder lange inaktive Projekte wirken riskant.
- Belege:

  - [GitHub API: pushed\_at (letzter Push auf einen beliebigen Branch)](https://github.com/repolaunch-fixtures/web-app)
  
    ```text
    2026-07-02T08:00:00Z (vor 97 Tagen)
    ```
  

#### Versionierte Releases oder Tags (`trust.releases@1`)

- Status: **fehlt**, Schwere: niedrig, Gewicht: 1
- Begründung: Releases geben Nutzern stabile Stände und zeigen Fortschritt nachvollziehbar.
- Aufgabe: Veröffentliche ein Release mit Versionsnummer und kurzen Release Notes.
- Aufwand: 20 bis 60 Min.
- Erwartete Wirkung (Hypothese): Mehr produktive Nutzung, weil Nutzer eine Version festlegen können.
- Belege:

  - [GET /releases und GET /tags: keine Einträge](https://github.com/repolaunch-fixtures/web-app/releases)

#### Beitragsrichtlinien (`trust.contributing@1`)

- Status: **fehlt**, Schwere: niedrig, Gewicht: 1
- Begründung: CONTRIBUTING-Dateien verlinkt GitHub automatisch bei Issues und Pull Requests. Sie senken die Einstiegshürde.
- Aufgabe: Lege CONTRIBUTING.md an: Setup, Tests, Stil, Ablauf für Pull Requests.
- Aufwand: 30 bis 90 Min.
- Erwartete Wirkung (Hypothese): Mehr und besser vorbereitete Beiträge.
- Belege:

  - [Dateiliste @ 2222222: keine Datei contributing, contributing.md, contributing.rst, contributing.txt, contributing.adoc in /, .github/, docs/](https://github.com/repolaunch-fixtures/web-app/tree/2222222222222222222222222222222222222222)

#### Sicherheitsrichtlinie (`trust.security_policy@1`)

- Status: **fehlt**, Schwere: hoch, Gewicht: 3
- Begründung: Eine SECURITY.md sagt, wie Schwachstellen vertraulich gemeldet werden. Für Unternehmen ist das oft ein Prüfpunkt.
- Aufgabe: Lege SECURITY.md an: Meldeweg (z. B. private Sicherheitsmeldung über GitHub), unterstützte Versionen, Reaktionszeit ohne Garantie.
- Aufwand: 15 bis 30 Min.
- Erwartete Wirkung (Hypothese): Höheres Vertrauen bei professionellen Nutzern.
- Belege:

  - [Dateiliste @ 2222222: keine Datei security.md, security.txt, security in /, .github/, docs/](https://github.com/repolaunch-fixtures/web-app/tree/2222222222222222222222222222222222222222)

#### Kontakt- oder Supportweg (`trust.contact@1`)

- Status: **vorhanden**, Gewicht: 2
- Begründung: Nutzer brauchen einen Weg für Fragen und Fehlerberichte: Issues, Discussions oder ein Kontaktabschnitt.
- Belege:

  - [GitHub API: has\_issues / has\_discussions](https://github.com/repolaunch-fixtures/web-app)
  
    ```text
    true / false
    ```
  

#### Änderungsprotokoll (`trust.changelog@1`)

- Status: **fehlt**, Schwere: niedrig, Gewicht: 1
- Begründung: Ein Changelog oder Release Notes zeigen, was sich ändert, und erleichtern Updates.
- Aufgabe: Führe CHANGELOG.md oder schreibe Release Notes zu jedem Release.
- Aufwand: 15 bis 45 Min.
- Erwartete Wirkung (Hypothese): Nutzer aktualisieren eher und melden weniger Überraschungen.
- Belege:

  - [Dateiliste @ 2222222: keine Datei changelog.md, changelog, changes.md, history.md, news.md, changelog.rst in /, docs/](https://github.com/repolaunch-fixtures/web-app/tree/2222222222222222222222222222222222222222)

### Verbreitung und Vermarktung

#### Passende Topics (`distribution.topics@1`)

- Status: **fehlt**, Schwere: mittel, Gewicht: 2
- Begründung: Topics machen ein Repository über GitHub-Themenseiten und Suche auffindbar.
- Aufgabe: Vergib drei bis acht präzise Topics (Sprache, Problemfeld, Projekttyp).
- Aufwand: 5 bis 10 Min.
- Erwartete Wirkung (Hypothese): Mehr Besucher über Themenseiten und Suche; keine Garantie für Rankings.
- Belege:

  - [GitHub API: topics](https://github.com/repolaunch-fixtures/web-app)
  
    ```text
    (keine)
    ```
  

#### Website-Feld gesetzt (`distribution.homepage@1`)

- Status: **fehlt**, Schwere: hoch, Gewicht: 3
- Begründung: Das Website-Feld erscheint prominent neben der Beschreibung und führt zu Demo, Doku oder Produktseite.
- Aufgabe: Trage im Repository unter "About" eine Website ein (Demo, Doku oder Produktseite).
- Aufwand: 2 bis 10 Min.
- Erwartete Wirkung (Hypothese): Mehr Besuche der Demo- oder Produktseite.
- Belege:

  - [GitHub API: homepage](https://github.com/repolaunch-fixtures/web-app)
  
    ```text
    (leer)
    ```
  

#### Klarer nächster Schritt oben in der README (`distribution.next_step@1`)

- Status: **vorhanden**, Gewicht: 3
- Begründung: Wer die ersten Zeilen liest, sollte sofort wissen, was als Nächstes zu tun ist: installieren, Demo öffnen oder Doku lesen.
- Belege:

  - [Installationsbefehl im oberen Teil](https://github.com/repolaunch-fixtures/web-app/blob/2222222222222222222222222222222222222222/README.md#L8-L8) (Zeilen 8 bis 8)
  
    ```text
    docker compose up
    ```
  

#### Kommerzielles Angebot benannt (`distribution.commercial_offer@1`)

- Status: **fehlt**, Schwere: hoch, Gewicht: 3
- Begründung: Wer zahlende Kunden sucht, muss sagen, was man kaufen kann und wie man Kontakt aufnimmt.
- Aufgabe: Ergänze einen Abschnitt "Support" oder "Kommerzielle Nutzung" mit Angebot und Kontaktweg. Keine Umsatzversprechen.
- Aufwand: 30 bis 90 Min.
- Erwartete Wirkung (Hypothese): Interessierte Unternehmen melden sich direkt statt abzuwandern.
- Belege:

  - [README.md: kein Abschnitt Support/Enterprise/Pricing/Beratung und kein Angebotslink](https://github.com/repolaunch-fixtures/web-app/blob/2222222222222222222222222222222222222222/README.md)

## Nicht bewertete Regeln

- `usability.cli_reference`: nicht relevant. Für Projekttyp "Webprodukt / SaaS" und Ziel "SaaS-Kunden" nicht relevant (Gewicht 0).
- `usability.api_reference`: nicht relevant. Für Projekttyp "Webprodukt / SaaS" und Ziel "SaaS-Kunden" nicht relevant (Gewicht 0).
- `usability.template_flag`: nicht relevant. Für Projekttyp "Webprodukt / SaaS" und Ziel "SaaS-Kunden" nicht relevant (Gewicht 0).
- `trust.code_of_conduct`: nicht relevant. Für Projekttyp "Webprodukt / SaaS" und Ziel "SaaS-Kunden" nicht relevant (Gewicht 0).
- `distribution.registry`: nicht relevant. Für Projekttyp "Webprodukt / SaaS" und Ziel "SaaS-Kunden" nicht relevant (Gewicht 0).
- `distribution.funding`: nicht relevant. Für Projekttyp "Webprodukt / SaaS" und Ziel "SaaS-Kunden" nicht relevant (Gewicht 0).
- `distribution.contributor_entry`: nicht relevant. Für Projekttyp "Webprodukt / SaaS" und Ziel "SaaS-Kunden" nicht relevant (Gewicht 0).

## Nutzerangaben (nicht belegt)

- Zielgruppe (optional): Kleine Teams mit Schichtbetrieb

## Inhalt dieses Exports

Der Export enthält nur tatsächlich erzeugte Dateien.

- `audit.json`: enthalten
- `audit.md`: enthalten
- `README.suggested.md`: nicht enthalten. Wird nur mit dem optionalen KI-Launch-Paket erzeugt, das nicht ausgeführt wurde.
- `launch-plan.md`: enthalten
- `monetization-plan.md`: enthalten
- `marketing-drafts.md`: nicht enthalten. Wird nur mit dem optionalen KI-Launch-Paket erzeugt, das nicht ausgeführt wurde.
