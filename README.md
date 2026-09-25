# 🧾 Invoice Kit – E-Rechnung ohne Abo, ohne Cloud

**XRechnung und PDF-Rechnung in 60 Sekunden. Unbegrenzt, kostenlos, Open Source.**
Läuft komplett in deinem Browser – keine Anmeldung, kein Server, deine Daten bleiben bei dir.

👉 **Direkt loslegen:** https://ghostfanman.github.io/invoice-kit/

## Warum Invoice Kit?

Ab **1. Januar 2027** müssen Unternehmen mit über 800.000 € Vorjahresumsatz E-Rechnungen ausstellen, ab **1. Januar 2028** alle Unternehmen im deutschen B2B-Geschäft. Ein normales PDF gilt dann nicht mehr als ordnungsgemäße Rechnung.

Die meisten Anbieter lösen das mit einem Cloud-Abo oder einer Gratis-Version mit 3 Rechnungen pro Monat. Invoice Kit geht einen anderen Weg:

| | Invoice Kit | typische Rechnungssoftware |
| --- | --- | --- |
| Preis | kostenlos, Pro als Einmalkauf | Abo, 8–50 € pro Monat |
| Rechnungen | unbegrenzt | oft 3 pro Monat gratis |
| Konto | nicht nötig | Pflicht |
| Deine Daten | nur in deinem Browser | auf fremden Servern |
| Quellcode | offen einsehbar | geschlossen |

## Funktionen

- **E-Rechnung im Format XRechnung 3.0** (UN/CEFACT CII, EN 16931) als XML-Datei
- PDF-Rechnung über die Druckfunktion
- Regelbesteuerung (19 % / 7 %) oder Kleinunternehmer nach § 19 UStG
- Pflichtfeld-Prüfung vor dem Export, fehlende Angaben werden markiert
- Einheiten (Stück, Stunden, Tage, Monate, pauschal)
- Automatisches Speichern im Browser, Sichern und Laden als JSON
- Nächste Rechnungsnummer mit einem Klick
- Offline nutzbar: `index.html` herunterladen und doppelklicken

## Geprüfte Qualität

Die erzeugten XRechnungen werden mit dem [Mustang-Validator](https://www.mustangproject.org/) gegen die offiziellen Schematron-Regeln von EN 16931 und XRechnung (KoSIT) geprüft – mit Regelbesteuerung, Kleinunternehmer-Fall und Sonderfällen (nur Steuernummer, Auslandskunde, Sonderzeichen, krumme Beträge). Eine Beispieldatei liegt bei: [`beispiel-xrechnung.xml`](beispiel-xrechnung.xml).

Tipp: Jede Datei lässt sich zusätzlich kostenlos mit dem offiziellen [KoSIT-Validator](https://github.com/itplr-kosit/validator) prüfen.

## Invoice Kit Pro (in Vorbereitung)

Einmal zahlen, für immer nutzen – kein Abo.

- ZUGFeRD / Factur-X: PDF mit eingebetteter E-Rechnung
- Kunden- und Artikelstamm
- Eigenes Logo und Rechnungsdesigns
- Angebote, Gutschriften und Mahnungen
- Rechnungsarchiv mit Export für den Steuerberater

👉 [Pro-Version vormerken](https://github.com/ghostfanman/invoice-kit/issues/new?title=Pro-Interesse) – wer sich einträgt, bekommt den Einführungspreis.

## Für Steuerkanzleien, Verbände und Agenturen

Invoice Kit gibt es auch im eigenen Branding (White-Label) – ideal, um Mandanten oder Mitgliedern vor der E-Rechnungspflicht ein einfaches, datenschutzfreundliches Werkzeug an die Hand zu geben. Anfragen bitte über ein [Issue](https://github.com/ghostfanman/invoice-kit/issues/new?title=White-Label-Anfrage).

## Unterstützen

- ⭐ Gib dem Projekt einen Stern – das hilft anderen, es zu finden
- Erzähl anderen Selbständigen davon
- Fehler gefunden? [Issue eröffnen](https://github.com/ghostfanman/invoice-kit/issues)

## Hinweis

Invoice Kit ist ein Hilfsmittel und keine Steuerberatung. Die Nutzung erfolgt ohne Gewähr; im Zweifel bitte eine Steuerberaterin oder einen Steuerberater fragen.

## Lizenz

MIT
