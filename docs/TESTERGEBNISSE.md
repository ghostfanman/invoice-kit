# Lokaler Prüflauf vom 27. September 2026

Umgebung: Node.js 24.19.0, Python 3.12, Chromium im Headless-Betrieb und lokaler HTTP-Server auf 127.0.0.1:8765. Die Tests verwendeten ausschließlich fiktive Rechnungsdaten.

| Befehl oder Prüfung | Ergebnis |
| --- | --- |
| `node --test test/*.test.js` | 40 Tests bestanden, keine Fehler, keine übersprungenen Tests |
| `node test/static-check.mjs` | Fünf HTML-Seiten, Labelzuordnungen, eindeutige IDs, JSON-Metadaten, Syntax und Wambur-Reproduzierbarkeit bestanden |
| `node --check` für alle Haupt-, Integrations-, Test- und Vendor-Skripte | Bestanden |
| `python3 -m py_compile integration/build-wambur.py` | Bestanden |
| `python3 integration/build-wambur.py` | Ausgabe und beide eingecheckten Vorschauen erzeugt |
| `node test/browser-check.mjs` | 56 CII-Varianten, UBL, PDF mit zwei Seiten, XML-Anhang über Names und AF, Escaping, Labels, Fokus, Speicherwahl, Offline-Dateien und Wambur-Vorschauen bestanden |
| Mobile Ansicht mit 390 Pixeln Breite | Kein horizontaler Überlauf der gesamten Seite; breite Tabellen separat scrollbar |
| `pdftotext .test-artifacts/rechnung.pdf -` | Text, Beträge, Zahlungsart und Seitenzahlen des Test-PDFs lesbar |
| `git diff --check` | Keine Fehler |
| Satzzeichenkontrolle | Keine Gedankenstriche in den bearbeiteten Projekttexten und generierten Vorschauen |

Screenshots: `.test-artifacts/generator.png`, `.test-artifacts/generator-mobil.png` und `.test-artifacts/viewer.png`. Test-PDF, Test-XML, Screenshots, Browserprofile, Buildausgabe und Python-Cache werden nicht committed.

Die ersten Prüfläufe fanden Fehler im Testaufruf für asynchrone Browserauswertung, zurückbleibende Feldfehler nach einem Import, die Verkäuferkennung bei nicht steuerbaren Rechnungen und mobilen Tabellenüberlauf. Die abschließenden Läufe wurden nach den Korrekturen vollständig wiederholt.

KoSIT, Mustang und veraPDF wurden in diesem Prüflauf nicht ausgeführt. Es liegen keine externen Konformitätsberichte für diesen Stand vor. Die erforderlichen getrennten Prüfungen beschreibt [VALIDIERUNG.md](VALIDIERUNG.md). Ein vollständiger manueller Screenreader-Test wurde ebenfalls nicht durchgeführt.

## Pro-Erweiterung

Die zusätzlichen Tests prüfen signierte Admin- und Geschenk-Lizenzen, manipulierte Rollen und Inhalte, fremde Schlüssel, Ablaufzeiten und die Trennung zwischen Entwurfs- und Pro-Daten. Der lokale Browserlauf mit `INVOICE_KIT_ADMIN_DIR` prüft die Admin-Entsperrung, den Download einer fiktiven Geschenk-Lizenz, deren Aktivierung, Kundenstamm, Artikelstamm, Archiv, Speicherung nach Zustimmung und das Laden nach einem Seitenwechsel. Eine Gesamtlöschung beendet auch eine noch laufende Lizenzaktivierung.

Der private Admin-Schlüssel und die persönliche Admin-Lizenz liegen außerhalb des Web-Roots. Die Dateirechte wurden geprüft: Verwaltungsordner 700, beide Dateien 600. Ins Repository kommt ausschließlich der öffentliche Prüfschlüssel. Der zusätzliche Screenshot liegt unter `.test-artifacts/pro.png`.

## Lizenzimport unter Linux Mint

Der erneute Prüflauf nach Ergänzung der Code-Eingabe bestand alle 40 Node-Tests, die statische Prüfung einschließlich JavaScript-Syntax, Python-Kompilierung und Wambur-Build. Im lokalen Chromium wurden zusätzlich der Admin-Download als TXT, der TXT-Import, bisherige Lizenzdateien, eingefügte Admin- und Geschenkcodes, leere und ungültige Codes sowie die Aktivierung per Enter geprüft. Das Codefeld wird nach erfolgreicher Aktivierung und Gesamtlöschung geleert. Die Gesamtlöschung verhindert auch eine noch laufende Code-Aktivierung.

Der erste Tastaturtest enthielt einen unvollständig simulierten Enter-Tastendruck. Nach Korrektur des Testereignisses bestand der gesamte Browserlauf einschließlich der 56 CII-Varianten, UBL, PDF und Offline-Prüfungen. Der Screenshot der neuen Aktivierung liegt unter `.test-artifacts/pro-code.png`.

## Pro-Anzeige

Prüflauf nach Ergänzung der sichtbaren Pro-Anzeige am 27. September 2026: 41 Node-Tests bestanden, darunter der neue Test für den Anzeigetext mit und ohne Ablaufdatum. Die statische Prüfung, `python3 -m py_compile integration/build-wambur.py`, der Wambur-Build mit aktualisierten Vorschauen und `git diff --check` bestanden. Der Service-Worker-Cache heißt jetzt `invoice-kit-v8`.

Der Browsertest ohne `INVOICE_KIT_ADMIN_DIR` bestand. Er prüft zusätzlich, dass ohne Lizenz weder Hinweis noch geänderter Titel erscheinen. Der Admin-Teil des Browsertests enthält neue Prüfungen für die aktive Anzeige, wurde für diesen Lauf aber nicht ausgeführt, weil er den privaten Admin-Schlüssel braucht. Den aktiven Zustand prüfte stattdessen eine nicht eingecheckte Kopie mit einem eigens erzeugten Testschlüssel, im Generator und in der Wambur-Vorschau: Hinweis mit Name und Ablaufdatum, geänderter Titel und Kopfzeilenlink auch bei zugeklapptem Bereich, Öffnen per Klick auf den Hinweis und Entfernen der Anzeige durch die Gesamtlöschung. Dabei traten keine JavaScript-Fehler auf.

## Aktiv-Status nach der Lizenzaktivierung

Prüflauf am 27. September 2026 nach dem Umbau der Aktiv-Anzeige: 41 Node-Tests bestanden, darunter der erweiterte Test für Hinweis- und Statustext mit Admin- und Geschenk-Lizenz, jeweils mit und ohne Ablaufdatum. Die statische Prüfung einschließlich Wambur-Build und `git diff --check` bestanden. Der Service-Worker-Cache heißt jetzt `invoice-kit-v9`.

Der Browsertest bestand ohne und mit Admin-Teil. Für den Admin-Teil diente wie zuvor eine nicht eingecheckte Kopie mit einem eigens erzeugten Testschlüssel. Der private Admin-Schlüssel wurde nicht verwendet. Neu geprüft: Ohne Lizenz sind Codefeld und Hinweis „Pro ist nicht aktiviert.“ sichtbar, der Knopf zum Deaktivieren nicht. Nach der Aktivierung ersetzt ein grünes Statusfeld mit „Pro-Version aktiv“ und „Lizenzcode aktiv für“ das Codefeld und erhält den Fokus. Der Statustext nennt Admin- und Geschenk-Lizenzen korrekt. Nach dem Deaktivieren und nach der Gesamtlöschung erscheint wieder das Codefeld. Screenshots des aktiven Zustands im Generator und in der Wambur-Vorschau zeigten keine Darstellungsfehler.

## Unentgeltliche Rechnungen

Prüflauf am 27. September 2026 nach Ergänzung der Berechnung „Unentgeltlich: Geschenk“ und „Unentgeltlich: Werbezweck“: 42 Node-Tests bestanden. Der neue Test prüft gemischte Steuersätze mit einem Nachlass je Steuersatz, das Auslassen einer Steuergruppe ohne Betrag, Netto, Steuer und Zahlbetrag 0,00, fehlende Fälligkeit, keinen GiroCode, den Wegfall von IBAN, Zahlungsziel, Zahlungsart und Skonto in der Eingabeprüfung, die Sperre bei Rechnungskorrekturen, unbekannte Auswahlwerte, Kleinunternehmer und die unveränderte normale Berechnung. Statische Prüfung einschließlich Wambur-Build bestanden. Service-Worker-Cache `invoice-kit-v10`.

Der Browsertest bestand mit 60 statt 56 CII-Varianten. Die vier neuen Varianten (Geschenk mit zwei Steuersätzen, Werbezweck als Kleinunternehmer, nicht steuerbar in Englisch, innergemeinschaftliche Lieferung) bestehen alle Plausibilitätsprüfungen des Viewers. Zusätzlich geprüft: Export ohne IBAN und Zahlungsziel möglich, Zahlungsangaben ausgeblendet, kein QR-Code, Vorschau mit Summe der Positionen, Nachlass, „Zu zahlen“ und Hinweis, ohne Fälligkeit und Bankverbindung, XML mit Zahlungsart 1, zwei Nachlässen und passenden Summen, einseitiges PDF (`.test-artifacts/rechnung-geschenk.pdf`) und Anzeige von Summe der Positionen, Nachlässen und Zahlungsart im Viewer. Screenshot der Vorschau: `.test-artifacts/geschenk.png`.

Eine externe Prüfung mit KoSIT, Mustang oder veraPDF fand für unentgeltliche Rechnungen nicht statt.

## Lizenz merken

Anlass: Nach dem Neuladen war Pro wieder deaktiviert. Ein Browsertest lokal und auf wambur.com bestätigte, dass das nur ohne Haken bei „Lizenz auf diesem Gerät merken“ geschieht. Mit Haken blieb die Lizenz in beiden Umgebungen aktiv. Der Haken lag aber unauffällig unter dem Codefeld. Jetzt sitzt er im Statusfeld, und das Feld nennt bei aktiver Lizenz „Gilt nur bis zum Neuladen der Seite.“ oder „Auf diesem Gerät gespeichert.“ Schlägt das Speichern fehl, wird der Haken wieder entfernt.

Prüflauf am 27. September 2026: 42 Node-Tests und die statische Prüfung bestanden, Service-Worker-Cache `invoice-kit-v11`. Der Browsertest bestand ohne und mit Admin-Teil (Kopie mit eigens erzeugtem Testschlüssel). Neu geprüft: Haken im Statusfeld, Wechsel des Hinweises beim Setzen und Entfernen ohne Neuladen, Speichern und Entfernen der Lizenz im Browser, Hinweis „Auf diesem Gerät gespeichert.“ nach dem Neuladen mit gemerkter Lizenz.
