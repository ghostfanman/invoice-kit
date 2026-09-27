# Lokaler Prüflauf vom 27. September 2026

Umgebung: Node.js 24.19.0, Python 3.12, Chromium im Headless-Betrieb und lokaler HTTP-Server auf 127.0.0.1:8765. Die Tests verwendeten ausschließlich fiktive Rechnungsdaten.

| Befehl oder Prüfung | Ergebnis |
| --- | --- |
| `node --test test/*.test.js` | 31 Tests bestanden, keine Fehler, keine übersprungenen Tests |
| `node test/static-check.mjs` | Vier HTML-Seiten, Labelzuordnungen, eindeutige IDs, JSON-Metadaten, Syntax und Wambur-Reproduzierbarkeit bestanden |
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
