# Validierungsplan

## Hypothese

Maintainer zahlen eher für überprüfbare, umsetzbare Verbesserungen als für generische KI-Texte. Erfolg heißt qualifizierte Nutzung und gegebenenfalls Anfragen oder zahlende Kunden. Sterne sind höchstens ein ergänzendes Signal.

## Geschäftsmodell (Testhypothesen, keine Abrechnung im MVP)

| Stufe | Inhalt | Preis (unvalidierte Hypothese) |
| --- | --- | --- |
| Basisaudit | Regelbasierter Audit, fünf Aufgaben, Export | kostenlos |
| Betreutes Launch-Paket | Einmalig: Audit, KI-Entwürfe, persönliche Durchsicht und Priorisierung | 49 bis 99 Euro |
| Pro-Hosting (später) | Komfort, KI-Kontingente, Verlauf, Teamfunktionen | 12 bis 19 Euro pro Monat |

Der Audit-Kern bleibt MIT-lizenziert und vollständig im offenen Repository. Bezahlt wird Komfort und Betreuung, nicht der Quellcode.

## Pilot

- Zehn freiwillige Pilotnutzer aus der primären Zielgruppe: einzelne Maintainer von Entwicklerwerkzeugen, Bibliotheken, CLI-Tools, Vorlagen und kleinen SaaS-Projekten.
- Vorläufiges Investitionskriterium: mindestens drei bezahlte Pilotpakete (49 bis 99 Euro, Abwicklung manuell per Rechnung, nicht über die Anwendung).
- Je Pilot ein qualitatives Interview von 30 Minuten vor und eines 30 Tage nach dem Audit.

## Erfassung (manuell, anonymisiert)

Eine Tabelle außerhalb der Anwendung, ohne Namen, mit Pilot-Kürzel (P01 bis P10):

| Feld | Beschreibung |
| --- | --- |
| Projekttyp, Ziel | wie im Audit gewählt |
| Audit abgeschlossen | ja/nein, Fehlercode falls nein |
| KI-Paket genutzt | ja/nein, Abschnitte, geschätzte Kosten aus dem Export |
| Akzeptierte Vorschläge | Anzahl der fünf Aufgaben, die der Pilot als sinnvoll bewertet |
| Durchgeführte Änderungen | nach 30 Tagen: welche Befunde im erneuten Audit "vorhanden" sind (Vergleich der Befund-IDs) |
| Ungeprüfte KI-Stellen | Anzahl und ob sie tatsächlich falsch waren |
| Zahlungsbereitschaft | Interviewaussage und tatsächliche Zahlung |
| Akquisezeit | Minuten vom Erstkontakt bis zum abgeschlossenen Audit |
| KI-Kosten | Summe der geschätzten Kosten je Pilot, abgeglichen mit der Anbieterabrechnung |
| Freitext | wichtigste Rückmeldung |

Kein Werbetracking, keine Analyse-Skripte. Die Anwendung liefert die nötigen Daten bereits im Export (`audit.json`: Befunde, Regelwerk, Commit, Kosten).

## Interviewleitfaden (Auszug)

1. Was hast du zuletzt getan, um dein Projekt bekannter oder nutzbarer zu machen? Was hat es gekostet?
2. Welche der fünf Aufgaben hättest du ohnehin gemacht, welche waren neu?
3. Waren die Belege nachvollziehbar? Wo hat das Werkzeug falsch gelegen?
4. Hast du KI-Entwürfe übernommen? Was musstest du ändern?
5. Was wäre dir eine betreute Durchsicht wert, und wofür genau?

## Entscheidungsregeln nach dem Pilot

- Weniger als drei bezahlte Pakete: Hypothese vorerst verworfen; nur offener Kern weiterpflegen.
- Drei oder mehr: GitHub-App-Variante und Verlauf (siehe Roadmap) priorisieren.
- Wenn ungeprüfte KI-Stellen häufig falsch waren: KI-Paket zurückstellen, regelbasierten Teil ausbauen.
