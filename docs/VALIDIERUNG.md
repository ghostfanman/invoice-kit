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

## Externe Validatoren, lokal auszuführen

Für einen belastbaren Nachweis müssen die tatsächlich exportierten Dateien geprüft werden. Speichere pro Prüflauf die Dateien, ihren SHA-256-Hash, Toolversionen, Regelwerkversionen, vollständige Befehle und Prüfberichte. Verwende lokale Programme und lade Rechnungsdaten nicht zu einem Webvalidator hoch.

1. **KoSIT:** Die XML-Datei mit dem [KoSIT-Validator](https://github.com/itplr-kosit/validator) und einer passenden [XRechnung-Konfiguration](https://github.com/itplr-kosit/validator-configuration-xrechnung) prüfen. Die Konfiguration muss zum deklarierten Profil passen. Schema- und Schematron-Fehler getrennt erfassen.
2. **Mustang:** Das ZUGFeRD-/Factur-X-PDF und seine eingebettete XML mit [Mustangproject](https://www.mustangproject.org/) prüfen. Profil, Einbettung und Rechnungsregeln anhand des vollständigen Berichts beurteilen.
3. **veraPDF:** Das PDF mit [veraPDF](https://verapdf.org/) gegen das deklarierte PDF/A-3b-Profil prüfen. PDF/A-Konformität allein bestätigt keine korrekte Rechnung oder XML.

Zu prüfen sind insbesondere alle sieben Steuerfälle, gemischte Steuersätze, Korrekturen mit negativen Mengen beziehungsweise Preisen, Nullbeträge, unentgeltliche Rechnungen mit Nachlass auf Belegebene und Zahlungsart 1, Skonto, Fremdwährungen, alle Zahlungsarten und mehrseitige PDFs. Negative Preise bei Korrekturen werden im XML in positive Preise mit entsprechendem Mengenvorzeichen umgewandelt.

Diese externen Prüfungen sind nicht Teil des Node-Testlaufs. Ohne zugehörige Berichte darf kein Release als vollständig nach EN 16931, XRechnung, ZUGFeRD oder PDF/A validiert bezeichnet werden. Die Metadaten im PDF beschreiben das angestrebte Profil, keinen unabhängigen Prüfbeleg.

## Referenzen für die Implementierung

- [UNCL 4461 bei OpenPeppol](https://docs.peppol.eu/poacc/billing/3.0/codelist/UNCL4461/): Zahlungsartcodes.
- [BR-51](https://docs.peppol.eu/poacc/billing/3.0/rules/ubl-tc434/BR-51/): Beschränkung der dargestellten Kartennummer. Invoice Kit erfasst nur die letzten vier Ziffern.
- [ISO-3166-Codeliste](https://docs.peppol.eu/poacc/billing/3.0/codelist/ISO3166/) und [ISO-4217-Codeliste](https://docs.peppol.eu/poacc/billing/3.0/codelist/ISO4217/): Grundlage der lokalen Codeprüfung.
- [Europäische Kommission zu USt-IdNrn.](https://taxation-customs.ec.europa.eu/taxation/vat/vat-directive/vat-identification-numbers_en): länderspezifische Nummernformate und Abgrenzung zur Registrierungsprüfung.

## Manuelle Accessibility-Prüfung

Der Strukturtest ersetzt keine vollständige Accessibility-Prüfung. Prüfe zusätzlich Zoom, mobile Ansicht und die Bedienung mit einem Screenreader. Die Oberfläche bietet sichtbare Labels, Tastaturfokus, Statusmeldungen, feldbezogene Fehlermeldungen und eine per Tastatur bedienbare Dateiauswahl. Kleine Standardtexte verwenden dunkle Schrift auf hellem Hintergrund; die Wambur-Integration verwendet helle Beschriftungen auf dunklen Flächen.
