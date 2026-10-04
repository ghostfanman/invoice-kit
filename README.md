# Invoice Kit: Rechnungen lokal im Browser

Invoice Kit erstellt CII-XML für XRechnung und ZUGFeRD-/Factur-X-PDFs mit eingebetteter XML. Der Viewer liest CII, UBL und XML-Anhänge in PDFs. Alle Rechnungsdaten werden ausschließlich lokal im Browser verarbeitet. Es gibt kein Benutzerkonto und keinen Server für Rechnungsdaten.

[Generator öffnen](https://ghostfanman.github.io/invoice-kit/) · [Viewer öffnen](https://ghostfanman.github.io/invoice-kit/anzeigen.html)

## Funktionen

- Rechnungsvorschau, XML-Export, PDF-Export, Drucken sowie JSON-Sicherung und Import.
- Sieben Rechnungssprachen, mehrere Steuersätze, steuerfreie Fälle, Rechnungskorrekturen, Leistungszeiträume, Skonto und Fremdwährungen.
- Unentgeltliche Rechnungen für Geschenke und Werbezwecke: Unter „Zahlung“ → „Berechnung“ auswählbar. Die Positionen zeigen den Warenwert, ein Nachlass von 100 % je Steuersatz setzt den Zahlbetrag auf 0,00. Zahlungsart, Zahlungsziel, Bankverbindung und GiroCode entfallen, im XML steht Zahlungsart 1 (nicht festgelegt). Ob die Zuwendung steuerliche Folgen hat, klärt das Werkzeug nicht.
- SEPA-Überweisung (Code 58), Überweisung mit IBAN einschließlich Fremdwährung (30), Kartenzahlung (48) und Barzahlung (10).
- Bei Kartenzahlung werden ausschließlich die letzten vier Kartenziffern erfasst. Lastschriften sind mangels Mandatsdaten nicht vorgesehen.
- Ein GiroCode erscheint nur für eine positive EUR-SEPA-Überweisung mit gültiger IBAN-Prüfziffer.
- Eingabeprüfung mit deutschen Meldungen an den betroffenen Feldern, zugeordneten Labels und sichtbarem Tastaturfokus.
- Installierbare Offline-App. Nach erfolgreicher Service-Worker-Installation stehen auch die PDF-Bibliotheken offline bereit. Ein neuer Cache-Name liefert eine zusammengehörige neue App-Version aus.

Die Auswahl des Steuerfalls und die sachliche Richtigkeit einer Rechnung bleiben beim Nutzer. Das Projekt ersetzt keine Steuerberatung.

## Datenschutz und Entwürfe

Standardmäßig speichert das Tool neue Rechnungen nur im Arbeitsspeicher des geöffneten Tabs. Mit „Entwurf auf diesem Gerät speichern“ werden Änderungen im localStorage gespeichert. Auf gemeinsam genutzten Geräten können andere Personen diese Daten sehen.

Bestehende Entwürfe aus den Versionen 2 und 3 sowie der Wambur-Version bleiben lesbar. Ein alter Entwurf wird geladen, aber erst nach ausdrücklicher Speicherwahl weitergeschrieben. Das Abwählen entfernt die gespeicherten Entwürfe und deren Speicherwahl. „Alle lokal gespeicherten Invoice-Kit-Daten löschen“ entfernt ebenfalls diese Daten, ohne fremde Website-Daten zu löschen. Die aktuell geöffnete Rechnung bleibt bis zum Schließen im Arbeitsspeicher. Bereits heruntergeladene Dateien musst du separat löschen.

Der Service Worker speichert ausschließlich bekannte lokale App-Dateien. Er löscht nur alte Caches mit dem Präfix `invoice-kit-`. Rechnungsdateien, eingegebene Daten und fremde Seiten werden nicht gecacht oder übertragen.

## Lokal starten und testen

Voraussetzungen: Node.js ab Version 22 und Python 3. Es sind keine npm-Abhängigkeiten erforderlich.

```sh
python3 -m http.server 8765 --bind 127.0.0.1
```

Öffne anschließend `http://127.0.0.1:8765/`. JavaScript-Module benötigen einen HTTP-Server; direktes Öffnen per `file://` reicht nicht.

```sh
node --test test/*.test.js
node test/static-check.mjs
python3 -m py_compile integration/build-wambur.py
python3 integration/build-wambur.py
git diff --check
```

`static-check.mjs` prüft die Syntax aller JavaScript-Dateien mit `node --check`, HTML-IDs, Labelziele, JSON-Metadaten, die vereinbarte Schreibweise und die Reproduzierbarkeit der Wambur-Vorschauen. Der Node-Test-Runner prüft unter anderem IBAN-Prüfziffern, E-Mail- und USt-ID-Formate, Cent-Rundung, gemischte Steuersätze, Skonto, Korrekturen, Fremdwährungen, Zahlungsarten, Viewer-Summen, Speicherlöschung und Service-Worker-Verhalten.

Mit installiertem Chromium und laufendem lokalen HTTP-Server:

```sh
node test/browser-check.mjs
```

Der Browsertest prüft Generator, Viewer, PDF mit eingebetteter XML, Offline-Betrieb, Speicherwahl, Tastaturzugang und das Escaping von XML-Inhalten. Screenshots und Testdateien liegen im ignorierten Ordner `.test-artifacts/`.

## Konformitätsprüfung der Exporte

Die Exporte werden mit den offiziellen Validatoren geprüft: KoSIT-Validator mit der XRechnung-Konfiguration (XML-Schema CII D16B, Schematron EN 16931 und XRechnung 3.0.2), Mustang (ZUGFeRD/Factur-X) und veraPDF (PDF/A-3b). Geprüft werden 22 Fälle mit allen Steuerfällen, gemischten Steuersätzen einschließlich 0 %, Korrekturen, Nullbeträgen, unentgeltlichen Rechnungen, Skonto, Fremdwährungen, allen Zahlungsarten, Leistungszeitraum und mehrseitigem PDF. Jede XRechnung, jedes PDF und jede eingebettete XML wird angenommen. Das Ergebnis mit Werkzeugversionen und SHA-256-Prüfsummen steht in [docs/PRUEFBERICHT.md](docs/PRUEFBERICHT.md).

```sh
tools/validate-exports.sh
```

Das Skript erzeugt die Prüffälle über Chromium, baut die Validatoren aus festen Versionen mit geprüften Prüfsummen und endet nur dann erfolgreich, wenn alle Dateien angenommen werden. Es braucht Java 17 oder neuer, Maven und Git. Die Werkzeuge liegen danach im ignorierten Ordner `.validators/`. Der GitHub-Workflow `Validierung` führt Tests und Konformitätsprüfung bei jedem Push aus.

Verbleibende Grenzen: Die Prüfung belegt die Konformität der getesteten Fälle, nicht jeder denkbaren Eingabe. Der Viewer prüft fremde Rechnungen auf Plausibilität, nicht vollständig nach Schematron. Eine gültige Datei bestätigt keinen Anspruch auf Vorsteuerabzug und nicht die sachliche Richtigkeit. USt-IdNrn. werden nur anhand lokaler Grundformate geprüft, ohne Online-Abfrage.

## Projektstruktur und Wambur

`core.js` enthält reine Berechnungs- und Validierungsfunktionen als ES-Modul für Browser und Node.js. `generator.js` bedient Formular, Vorschau und XML-Export; `zugferd.js` erhält das Rechnungsmodell und XML explizit. `viewer.js` liest und zeigt Rechnungen, `viewer-check.js` prüft die Summen. `storage.js` verwaltet ausschließlich eigene Entwurfschlüssel.

```sh
python3 integration/build-wambur.py
```

Das Skript erzeugt `dist-wambur/e-rechnung/` und aktualisiert die eingecheckten Vorschauen `integration/wambur-vorschau-index.html` und `integration/wambur-vorschau-anzeigen.html`. Die Vorschauen verwenden die Projektwurzel als Dokumentbasis. Der Strukturtest vergleicht sie mit der Buildausgabe. Hauptversion und Integration verwenden dieselben JavaScript-Module. Die Integration registriert keinen Service Worker auf der Wambur-Origin und benötigt dort die vorhandene Seitenhülle (`/styles.css`, `/site-layout.js`). Der Build überschreibt nur bekannte Ausgabedateien und löscht keine fremden Verzeichnisse.

## Lizenz

MIT. Mitgelieferte Bibliotheken und Schriften: [vendor/LIZENZEN.txt](vendor/LIZENZEN.txt).

## Pro für Admin und beschenkte Kunden

Pro bietet einen lokalen Kundenstamm, wiederverwendbare Artikel und ein Archiv bearbeitbarer Rechnungskopien. Das Archiv ist keine unveränderbare oder revisionssichere Aufbewahrung. Die bisherigen Basisfunktionen bleiben ohne Lizenz nutzbar. Logos, Angebote und Mahnungen gehören derzeit nicht zum Funktionsumfang.

Im Generator unter „Pro aktivieren“ den Lizenzcode einfügen und „Lizenzcode aktivieren“ anklicken. Alternativ eine `.txt`- oder `.invoicekit-license`-Datei auswählen. Der Code ist der vollständige Textinhalt der Lizenzdatei. Eine Admin-Lizenz schaltet die gleichen Pro-Funktionen frei wie eine Geschenk-Lizenz und zeigt zusätzlich den Verwaltungslink. Solange Pro aktiv ist, steht oben im Formular „Pro-Version aktiv · Lizenzcode aktiv für“ mit dem Namen aus der Lizenz, bei befristeten Lizenzen mit Ablaufdatum. Im Pro-Bereich ersetzt dann ein grünes Statusfeld mit Name, Lizenzart und Gültigkeit das Codefeld. Darin sitzt der Haken „Lizenz auf diesem Gerät merken“. Ohne ihn gilt die Freischaltung nur bis zum Neuladen der Seite, und das Statusfeld sagt das dazu. Mit Haken steht dort „Auf diesem Gerät gespeichert.“ Für eine andere Lizenz zuerst „Pro auf diesem Gerät deaktivieren“ wählen. Auch der Titel des Pro-Bereichs und der Kopfzeilenlink zeigen den Status, bei zugeklapptem Bereich ebenso. Ein Klick auf den Hinweis öffnet den Pro-Bereich. Das Ausstellen weiterer Lizenzen erfordert den separaten privaten Admin-Schlüssel. Eine Lizenz allein berechtigt nicht zum Signieren.

Lizenzen und Pro-Daten werden nur nach eigener Auswahl auf dem Gerät gespeichert. Die Funktion zum Löschen aller Invoice-Kit-Daten entfernt auch gemerkte Lizenzen, Kunden, Artikel und Archivkopien. Das Abwählen der normalen Entwurfsspeicherung betrifft nur Rechnungsentwürfe. Pro-Sicherungen lassen sich als JSON exportieren und ergänzend importieren.

Einrichtung, Geschenkvergabe und Grenzen des Offline-Verfahrens: [docs/PRO-ADMIN.md](docs/PRO-ADMIN.md).
