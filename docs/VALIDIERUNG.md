# Prüfungen und Grenzen

## Lokal reproduzierbare Prüfungen

Die Befehle in der README prüfen die Programmlogik, nicht die rechtliche Eignung einer konkreten Rechnung. Alle Fixtures verwenden fiktive Rechnungsdaten.

| Bereich | Automatischer Prüfumfang |
| --- | --- |
| Zahlen | Fehlende Werte und 0 getrennt, strikte Zahlenkonvertierung, dezimale Cent-Rundung, Summen über gerundete Positionen und Steuergruppen |
| Formular | Vollständige Anschriften, Datumswerte, Leistungszeitraum, Zahlungsziel, Skonto von 0 bis 100 Prozent, Vorzeichen und erforderliche Zahlungsdaten |
| Identifikatoren | IBAN-Länge und MOD-97, übliche E-Mail-Formate, USt-ID-Grundformate der EU sowie CH, GB, XI und NO, lokale Länder- und Währungslisten |
| Zahlung | UNCL-4461-Codes 10, 30, 48 und 58, letzte vier Kartenziffern, GiroCode nur für EUR-SEPA mit gültiger IBAN. Unentgeltliche Rechnungen: Code 1 ohne Konto und Fälligkeit |
| Unentgeltlich | Nachlass auf Belegebene (BG-20) je Steuersatz in Höhe der Positionssumme, Positionssumme minus Nachlässe gleich Netto 0,00, Steuergruppen mit Basis und Steuer 0,00, nicht bei Rechnungskorrekturen |
| Viewer | CII und UBL, vollständige Adressen, fehlende Beträge, Positionssummen mit Preisbasis und Zu-/Abschlägen, Kopf-Nachlässe und -Zuschläge, Steuergruppen, Brutto, Vorauszahlung und Rundungsbetrag |
| Datenschutz | Speicherwahl, Migration alter Entwürfe, gezielte Löschung eigener Schlüssel, Cache-Präfix und vollständige Offline-Abhängigkeiten |
| Oberfläche | Eindeutige IDs, gültige Labelziele, Labels an allen Feldern; dynamische Positionsfelder zusätzlich im Browsertest |
| Integration | Syntax aller Skripte, JSON-Metadaten und reproduzierbare Wambur-Vorschauen |

Geldbeträge werden intern auf Cent-Basis verglichen. Der Generator verwendet zwei Nachkommastellen für Rechnungsbeträge, auch bei Fremdwährungen. Besondere nationale Regeln oder abweichende Währungsunterteilungen werden dadurch nicht bestätigt. Steuergruppen werden aus den auf Cent gerundeten Positionen gebildet. Skonto wird als gerundeter Nachlass vom Bruttobetrag berechnet.

Die Länder- und Währungslisten sind lokale Momentaufnahmen. Die E-Mail-Prüfung unterstützt gebräuchliche ASCII-Adressen mit vollständiger Domain, keine vollständige RFC-Mailbox-Syntax. USt-ID-Prüfungen bestätigen keine Vergabe, keine Registrierung und keine steuerliche Berechtigung. Unbekannte Grundformate werden als nicht unterstützt gemeldet. Die IBAN-Prüfung bestätigt keine Existenz oder Erreichbarkeit eines Bankkontos.

Der Viewer verarbeitet unterstützte Strukturen und ignoriert nicht dargestellte Zusatzfelder. Er ersetzt keine Prüfung aller Geschäftsregeln. XML mit DTD oder Entity-Deklarationen wird abgelehnt. Bei ungültigen oder fehlenden Zahlen darf eine Summenprüfung nicht als erfolgreich erscheinen. Formatierte Datums- und Währungswerte werden vor der HTML-Ausgabe ebenfalls escaped.

## Externe Validatoren

`tools/validate-exports.sh` prüft die tatsächlich exportierten Dateien lokal, ohne Rechnungsdaten hochzuladen:

1. **Export:** `tools/export-samples.mjs` lädt jeden Prüffall über Chromium in den Generator, führt die Formularprüfung aus und speichert die XRechnung-XML sowie das ZUGFeRD-PDF so, wie der Nutzer sie erhält.
2. **KoSIT:** [KoSIT-Validator](https://github.com/itplr-kosit/validator) v1.6.3 mit [validator-configuration-xrechnung](https://github.com/itplr-kosit/validator-configuration-xrechnung) v2026-08-31 (XRechnung 3.0.2, XRechnung-Schematron 2.6.0, CEN-Regeln 1.3.16). `tools/kosit-config.py` setzt die CII-Szenarien wie das offizielle Ziel `compile` aus den Originalquellen zusammen. Geprüft werden die XRechnung-XML und die aus jedem PDF extrahierte EN-16931-XML. Schema- und Schematron-Ergebnis stehen getrennt im Bericht.
3. **Mustang:** [Mustangproject](https://www.mustangproject.org/) 2.26.0 prüft PDF-Struktur, Einbettung, Profil sowie XML-Schema und Schematron.
4. **veraPDF:** Das in Mustang enthaltene [veraPDF](https://verapdf.org/) prüft jedes PDF gegen PDF/A-3b.

Alle Downloads sind auf Versionen und SHA-256-Prüfsummen festgelegt. Das Skript schreibt nach `.test-artifacts/validation/` die Exportdateien, alle Einzelberichte und `BERICHT.md` mit Werkzeugversionen, Ergebnissen und Prüfsummen. Der eingecheckte Stand steht in [PRUEFBERICHT.md](PRUEFBERICHT.md). Der GitHub-Workflow `Validierung` führt den Lauf bei jedem Push und Pull Request aus.

Die Prüffälle decken alle sieben Steuerfälle, gemischte Steuersätze einschließlich 0 %, Korrekturen mit negativen Mengen und Preisen, Nullbeträge, unentgeltliche Rechnungen mit Nachlass auf Belegebene und Zahlungsart 1, Skonto, Fremdwährungen mit und ohne Umrechnung, alle Zahlungsarten, Leistungszeitraum mit Leitweg-ID und mehrseitige PDFs ab. Negative Preise bei Korrekturen werden im XML in positive Preise mit entsprechendem Mengenvorzeichen umgewandelt. Ein Nullsatz im Normalfall wird als Kategorie Z (BR-Z) ausgewiesen, nicht als S mit 0 % (BR-S-05).

Erwartete Hinweise: Die PDFs deklarieren das Profil EN 16931 und erhalten daher von den XRechnung-Regeln in Mustang den Hinweis BR-DE-21. Bei einem Leistungszeitraum bleibt `ApplicableHeaderTradeDelivery` leer, weil das CII-Schema das Element verlangt und kein Lieferdatum vorliegt. Die Factur-X-Regeln melden dazu die Warnung PEPPOL-EN16931-R008, keinen Fehler.

Die Prüfung belegt die Konformität der Prüffälle mit den genannten Regelwerkversionen. Neue Regelwerkversionen erfordern einen neuen Lauf mit angepassten Versionen im Skript.

## Referenzen für die Implementierung

- [UNCL 4461 bei OpenPeppol](https://docs.peppol.eu/poacc/billing/3.0/codelist/UNCL4461/): Zahlungsartcodes.
- [BR-51](https://docs.peppol.eu/poacc/billing/3.0/rules/ubl-tc434/BR-51/): Beschränkung der dargestellten Kartennummer. Invoice Kit erfasst nur die letzten vier Ziffern.
- [ISO-3166-Codeliste](https://docs.peppol.eu/poacc/billing/3.0/codelist/ISO3166/) und [ISO-4217-Codeliste](https://docs.peppol.eu/poacc/billing/3.0/codelist/ISO4217/): Grundlage der lokalen Codeprüfung.
- [Europäische Kommission zu USt-IdNrn.](https://taxation-customs.ec.europa.eu/taxation/vat/vat-directive/vat-identification-numbers_en): länderspezifische Nummernformate und Abgrenzung zur Registrierungsprüfung.

## Manuelle Accessibility-Prüfung

Der Strukturtest ersetzt keine vollständige Accessibility-Prüfung. Prüfe zusätzlich Zoom, mobile Ansicht und die Bedienung mit einem Screenreader. Die Oberfläche bietet sichtbare Labels, Tastaturfokus, Statusmeldungen, feldbezogene Fehlermeldungen und eine per Tastatur bedienbare Dateiauswahl. Kleine Standardtexte verwenden dunkle Schrift auf hellem Hintergrund; die Wambur-Integration verwendet helle Beschriftungen auf dunklen Flächen.
