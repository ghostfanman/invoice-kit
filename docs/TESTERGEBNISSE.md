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
