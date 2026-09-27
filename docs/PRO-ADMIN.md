# Pro verwalten und verschenken

## Für den Projektinhaber

Deine private Einrichtung liegt außerhalb des veröffentlichten Projekts:

- `~/.local/share/invoice-kit-admin/admin-private.jwk`: geheimer Signierschlüssel. Niemals veröffentlichen oder Kunden geben.
- `~/.local/share/invoice-kit-admin/admin.invoicekit-license`: persönliche Admin-Freischaltung für den Generator.

Die Dateien erhalten beim Anlegen Dateirechte 600, ein neuer Verwaltungsordner Dateirechte 700. Bewahre eine geschützte Sicherung des Schlüssels auf. Der Browser speichert den Signierschlüssel weder im localStorage noch im App-Cache. Nach Auswahl bleibt er als nicht exportierbarer CryptoKey nur in der Sitzung der Admin-Seite. „Admin sperren“ und das Verlassen der Seite entfernen diesen Zugriff.

1. Öffne den Generator und klicke auf „Pro aktivieren“.
2. Wähle deine Lizenzdatei im Pro-Bereich. Akzeptiert werden `.txt` und `.invoicekit-license`. Alternativ öffne die Datei in einem Texteditor, kopiere ihren vollständigen Inhalt in „Admin- oder Geschenk-Lizenzcode“ und klicke auf „Lizenzcode aktivieren“. Mit „Lizenz auf diesem Gerät merken“ kannst du die Freischaltung lokal behalten.
3. Im Pro-Bereich stehen Kundenstamm, Artikelstamm und Rechnungsarchiv bereit.
4. Öffne [die Admin-Seite](https://ghostfanman.github.io/invoice-kit/admin.html) und wähle `admin-private.jwk`, wenn du eine Lizenz ausstellen möchtest.

Unter Linux ist `.local` ein versteckter Ordner. Strg+H blendet ihn im Dateidialog ein. Auf dem eingerichteten Linux-Mint-Rechner liegt zusätzlich eine TXT-Kopie der persönlichen Admin-Lizenz unter `~/Dokumente/Invoice-Kit/Admin-Lizenz.txt`. Sie lässt sich direkt auswählen oder im Texteditor öffnen. Neue Admin-Downloads heißen ebenfalls `Admin-Lizenz.txt`. Der private Signierschlüssel bleibt separat im privaten Verwaltungsordner.

Die öffentliche Admin-Seite ist ohne passenden Schlüssel gesperrt. Es gibt kein im Quellcode verstecktes Admin-Passwort und keinen ungesicherten Admin-Schalter.

## Eine Pro-Version verschenken

Auf der Admin-Seite den Namen oder die Firma des Kunden eintragen. Optional ein Ablaufdatum wählen, ansonsten gilt das Geschenk unbefristet. „Geschenk-Lizenz herunterladen“ erzeugt eine signierte Datei. Übergib dem Kunden nur diese `.invoicekit-license`-Datei und den [Generator-Link](https://ghostfanman.github.io/invoice-kit/#proPanel). Der Versand erfolgt durch dich, nicht automatisch durch Invoice Kit.

Der Kunde lädt die Datei unter „Pro aktivieren“ oder fügt ihren vollständigen Textinhalt als Lizenzcode ein. Danach steht oben im Formular „Pro aktiv für“ mit dem eingetragenen Namen, bei befristeten Geschenken mit dem letzten gültigen Tag. Es werden weder Rechnung noch Lizenz zu einem Prüfserver geschickt. Die Signaturprüfung erfolgt lokal mit dem veröffentlichten Prüfschlüssel. Das Ablaufdatum gilt einschließlich des gewählten Tages in UTC.

Alternativ lassen sich Lizenzen lokal per Kommandozeile erstellen:

```sh
node tools/pro-admin.mjs gift "Name oder Firma des Kunden"
node tools/pro-admin.mjs admin "Invoice Kit Admin"
```

Die erzeugten Dateien landen im privaten Verwaltungsordner. Ihre Namen werden ausgegeben, der private Schlüssel selbst nicht.

## Neue Installation

Der aktuelle Projektstand enthält bereits einen öffentlichen Prüfschlüssel. Die Einrichtung darf nicht erneut ausgeführt werden, solange bestehende Lizenzen gültig bleiben sollen. Für eine eigenständige neue Installation ohne Schlüssel:

```sh
node tools/pro-admin.mjs init "Admin-Name"
```

Das Werkzeug legt private Dateien außerhalb des Projektordners an und schreibt nur den öffentlichen Schlüssel nach `pro-config.js`. Vorhandene Schlüssel werden nicht überschrieben. `INVOICE_KIT_ADMIN_DIR` kann einen anderen privaten Ordner außerhalb des Web-Roots festlegen. Nur das öffentliche Projekt veröffentlichen. Niemals den privaten Verwaltungsordner als Web-Root verwenden.

## Lokale Pro-Daten

Kunden werden aus den Empfängerfeldern einer geöffneten Rechnung übernommen. Eine vorhandene Rechnungsposition kann als Artikel gespeichert und später als zusätzliche Position eingesetzt werden. Das Rechnungsarchiv speichert bearbeitbare Kopien des Formularzustands, keine Original-PDFs oder revisionssicheren Belege.

Ohne „Pro-Daten auf diesem Gerät speichern“ bestehen Einträge nur bis zum Schließen des Tabs. JSON-Sicherungen ermöglichen einen Gerätewechsel. Beim Import bleiben vorhandene Einträge erhalten; unterschiedliche Fassungen derselben Kennung werden zusätzlich übernommen. Heruntergeladene Sicherungen und Lizenzdateien müssen separat gelöscht werden. Der Export deiner gespeicherten Daten bleibt auch ohne aktive Lizenz möglich.

## Grenzen und Technik

Die Lizenzdaten enthalten Namen, Rolle, Kennung, Ausstellungszeit und gegebenenfalls Ablaufzeit. Sie sind signiert, nicht verschlüsselt. Die Signatur verwendet ECDSA P-256 mit SHA-256 über die Web Crypto API. Referenz: [Signieren und Prüfen mit SubtleCrypto](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/sign).

Ohne Lizenzserver sind keine einmalige Einlösung, Gerätebindung, verifizierte Empfängeridentität oder Fernsperre möglich. Eine Geschenkdatei ist weitergebbar. Das Ablaufdatum hängt von der lokalen Gerätezeit ab. Da das Projekt offen und vollständig im Browser läuft, können technisch versierte Nutzer eine eigene Programmkopie verändern. Die Signatur schützt den regulären Aktivierungsweg gegen gefälschte Lizenzen, sie ist kein manipulationssicherer Kopierschutz und schränkt die MIT-Lizenz des Quellcodes nicht ein.

Ein Verlust des privaten Schlüssels verhindert das Ausstellen weiterer Lizenzen mit dieser Identität. Ein Austausch des öffentlichen Schlüssels würde vorhandene Lizenzen ungültig machen und erfordert eine geplante Migration.

## Tests

`node --test test/*.test.js` prüft gültige Lizenzen, Signaturmanipulation, Rollenänderung, fremde Schlüssel, Ablauf, nicht exportierbare Signierschlüssel, Datenkopien, Importformate und gezielte Löschung.

Mit laufendem lokalen HTTP-Server und Chromium prüft dieser Befehl den vollständigen Admin- und Geschenkablauf:

```sh
INVOICE_KIT_ADMIN_DIR="$HOME/.local/share/invoice-kit-admin" node test/browser-check.mjs
```

Der Test prüft außerdem TXT-Import, eingefügte Admin- und Geschenkcodes, leere und ungültige Eingaben, Tastaturaktivierung und das Leeren des Codefeldes.

Der Test verwendet den Schlüssel lokal zur Ausstellung einer fiktiven Test-Geschenkdatei. Er veröffentlicht keine Lizenz und sendet keine Nachricht. Testdownloads und das temporäre Browserprofil werden anschließend entfernt.
