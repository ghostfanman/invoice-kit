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

**Rechnungen schreiben**
- **ZUGFeRD 2.3 / Factur-X** (Profil EN 16931): PDF/A-3b mit eingebetteter E-Rechnung – für Menschen lesbar, für Buchhaltungssoftware auslesbar
- **XRechnung 3.0** (UN/CEFACT CII) als reine XML-Datei, z. B. für Behörden
- **GiroCode** (EPC-QR-Code): Kunde scannt mit der Banking-App und überweist ohne Tippfehler
- Rechnungssprachen: **Deutsch, Englisch, Französisch, Italienisch, Spanisch, Niederländisch, Polnisch** – inklusive der gesetzlichen Hinweise in der jeweiligen Sprache
- Sieben Steuerfälle mit automatisch gedrucktem Pflichthinweis (siehe unten)
- Unterschiedliche Steuersätze pro Position, Voreinstellungen für DE, AT, CH, GB, FR, IT, ES, NL, BE, PL, LU
- Rechnungskorrektur / Storno, Leistungszeitraum, Skonto, Firmenangaben, Fremdwährung
- Pflichtfeld-Prüfung vor jedem Export, mehrseitige PDFs mit Seitenzahlen

**E-Rechnungen empfangen** ([anzeigen.html](https://ghostfanman.github.io/invoice-kit/anzeigen.html))
- Öffnet XRechnung (CII und UBL) sowie ZUGFeRD-/Factur-X-PDFs und zeigt sie lesbar an
- Prüft die Pflichtangaben für den Vorsteuerabzug und ob die Summen stimmen
- Drucken und eingebettete XML speichern

**Als App**
- Installierbar („Zum Startbildschirm hinzufügen“), funktioniert danach auch offline
- Keine Anmeldung, keine Cloud: alle Daten bleiben im Browser

## Rechtliche Pflichtangaben

| Rechtsgrundlage | Abgedeckt |
| --- | --- |
| § 14 Abs. 4 UStG (Deutschland): Name und Anschrift beider Parteien, Steuernummer oder USt-IdNr., Datum, fortlaufende Nummer, Menge und Art, Leistungszeitpunkt oder -zeitraum, Entgelt nach Steuersätzen, Skonto, Steuersatz und -betrag bzw. Befreiungshinweis, Aufbewahrungshinweis bei Grundstücksleistungen an Privatpersonen | ✅ |
| § 14a UStG / Art. 226 MwSt-Richtlinie (EU): Reverse Charge, innergemeinschaftliche Lieferung (beide USt-IdNrn.), Steuerbefreiungen, Ausfuhr | ✅ |
| Art. 230 MwSt-Richtlinie: Umsatzsteuer bei Fremdwährung in Landeswährung | ✅ |
| § 35a GmbHG, § 80 AktG, § 37a HGB: Registergericht, Registernummer, Geschäftsführung | ✅ |
| Österreich (§ 11 UStG): UID des Kunden ab 10.000 € brutto | ✅ Warnhinweis |
| Schweiz (Art. 26 MWSTG), Vereinigtes Königreich (VAT Notice 700): allgemeine Pflichtangaben | ✅ im PDF |
| Differenzbesteuerung, Reiseleistungen, Gutschriftverfahren, neue Fahrzeuge | ❌ noch nicht |
| Länder mit staatlicher Echtzeit-Freigabe (z. B. Italien SDI, Polen KSeF, Mexiko CFDI, Indien, Saudi-Arabien) | ❌ nicht möglich ohne Anbindung an das staatliche System |

## Geprüfte Qualität

Alle ZUGFeRD-PDFs bestehen die PDF/A-3b-Prüfung (veraPDF, über 42.000 Einzelprüfungen) und die EN-16931-Regeln – getestet in allen sieben Steuerfällen und fünf Sprachen, mit Korrektur, Fremdwährung und 30-Positionen-Rechnungen über mehrere Seiten.

Die erzeugten XRechnungen werden mit dem [Mustang-Validator](https://www.mustangproject.org/) gegen die offiziellen Schematron-Regeln von EN 16931 und XRechnung (KoSIT) geprüft. Getestet sind alle sieben Steuerfälle (Regelbesteuerung mit 19 % und 7 % gemischt, Kleinunternehmer, steuerfrei, Reverse Charge, innergemeinschaftliche Lieferung, Ausfuhr, nicht steuerbar), Rechnungskorrektur, Fremdwährung, Leistungszeitraum, Skonto und Firmenangaben. Eine Beispieldatei liegt bei: [`beispiel-xrechnung.xml`](beispiel-xrechnung.xml).

Tipp: Jede Datei lässt sich zusätzlich kostenlos mit dem offiziellen [KoSIT-Validator](https://github.com/itplr-kosit/validator) prüfen.

## Invoice Kit Pro (in Vorbereitung)

Einmal zahlen, für immer nutzen – kein Abo.

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

MIT. Mitgelieferte Bibliotheken und Schriften: siehe [`vendor/LIZENZEN.txt`](vendor/LIZENZEN.txt).
