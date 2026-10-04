#!/usr/bin/env bash
# Prüft die echten Exportdateien mit KoSIT (XRechnung 3.0.2 / EN 16931), Mustang (ZUGFeRD/Factur-X)
# und dem in Mustang enthaltenen veraPDF (PDF/A-3b). Alle Werkzeuge laufen lokal, keine Rechnungsdaten
# verlassen den Rechner. Voraussetzungen: Java 17+, Maven, Git, Node.js 22+, Python 3, Chromium.
#
#   tools/validate-exports.sh            # erzeugt die Prüffälle und prüft sie
#   CHROMIUM=/pfad/zu/chrome tools/validate-exports.sh
#
# Ergebnis: .test-artifacts/validation/ mit Exportdateien, Einzelberichten und BERICHT.md.
# Exit-Code 0 nur, wenn jede Datei von jedem Validator angenommen wird.
set -euo pipefail
cd "$(dirname "$0")/.."

CACHE=${INVOICE_KIT_VALIDATORS:-.validators}
OUT=.test-artifacts/validation
KOSIT_TAG=v1.6.3
CONFIG_TAG=v2026-08-31            # validator-configuration-xrechnung: XRechnung 3.0.2, Schematron 2.6.0, CEN 1.3.16
CEN_TAG=validation-1.3.16
MUSTANG=2.26.0
REGISTRY=https://projekte.kosit.org/api/v4/projects/356/packages/maven/de/xeinkauf

mkdir -p "$CACHE"
fetch() { # url datei sha256
  if [ ! -f "$CACHE/$2" ]; then curl -sSfL "$1" -o "$CACHE/$2.part"; mv "$CACHE/$2.part" "$CACHE/$2"; fi
  echo "$3  $CACHE/$2" | sha256sum -c --quiet - || { rm -f "$CACHE/$2"; echo "Prüfsumme falsch: $2" >&2; exit 2; }
}
clone() { [ -d "$CACHE/$2" ] || git -c advice.detachedHead=false clone -q --depth 1 --branch "$3" "$1" "$CACHE/$2"; }

echo "== Werkzeuge bereitstellen"
fetch "https://repo1.maven.org/maven2/org/mustangproject/Mustang-CLI/$MUSTANG/Mustang-CLI-$MUSTANG.jar" "Mustang-CLI-$MUSTANG.jar" 42d7868cb68264874a7b8cab4c3587b03b23ccc7cd72373da917f66758bb9736
fetch "$REGISTRY/xrechnung-3.0.2-schematron/2.6.0/xrechnung-3.0.2-schematron-2.6.0.zip" xrechnung-3.0.2-schematron-2.6.0.zip ca5e07afd04e72cd283d581590ffff3a15f4aac9d2f40c993345d78e67ea22b4
fetch "$REGISTRY/D16B_SCRDM__Subset__CII/D16B/D16B_SCRDM__Subset__CII-D16B.zip" D16B_SCRDM__Subset__CII-D16B.zip 3c938995d7ae96ea9a08e6f6bbe1a609682872a302411b2bf102f937e589a206
clone https://github.com/itplr-kosit/validator.git "kosit-$KOSIT_TAG" "$KOSIT_TAG"
clone https://github.com/itplr-kosit/validator-configuration-xrechnung.git "config-$CONFIG_TAG" "$CONFIG_TAG"
clone https://github.com/ConnectingEurope/eInvoicing-EN16931.git "cen-$CEN_TAG" "$CEN_TAG"
echo "0b234dea2bbfee739b7761e607a992c17fab88773014ef56355b6158cfb1cc53  $CACHE/cen-$CEN_TAG/cii/xslt/EN16931-CII-validation.xslt" | sha256sum -c --quiet -

KOSIT_JAR=$(ls "$CACHE/kosit-$KOSIT_TAG"/target/validator-*-standalone.jar 2>/dev/null | head -1 || true)
if [ -z "$KOSIT_JAR" ]; then
  echo "== KoSIT-Validator $KOSIT_TAG bauen"
  (cd "$CACHE/kosit-$KOSIT_TAG" && mvn -q -B -DskipTests package)
  KOSIT_JAR=$(ls "$CACHE/kosit-$KOSIT_TAG"/target/validator-*-standalone.jar | head -1)
fi

# KoSIT-Konfiguration wie im offiziellen build.xml (Ziel "compile") für die CII-Szenarien zusammensetzen.
CFG="$CACHE/xrechnung-config-$CONFIG_TAG"
if [ ! -f "$CFG/scenarios.xml" ]; then
  echo "== KoSIT-Konfiguration $CONFIG_TAG zusammensetzen"
  python3 tools/kosit-config.py "$CACHE" "$CONFIG_TAG" "$CEN_TAG" "$CFG"
fi

echo "== Exportdateien erzeugen"
rm -rf "$OUT" && mkdir -p "$OUT/kosit" "$OUT/mustang"
SERVER=
if ! curl -s -o /dev/null http://127.0.0.1:8765/; then
  python3 -m http.server 8765 --bind 127.0.0.1 >/dev/null 2>&1 & SERVER=$!
  trap '[ -n "$SERVER" ] && kill $SERVER' EXIT
  for _ in $(seq 50); do curl -s -o /dev/null http://127.0.0.1:8765/ && break; sleep 0.1; done
fi
node tools/export-samples.mjs "$OUT/exports"

mustang() { java -jar "$CACHE/Mustang-CLI-$MUSTANG.jar" "$@" --disable-file-logging 2>/dev/null; }
echo "== Eingebettete XML aus den PDFs extrahieren"
for pdf in "$OUT"/exports/*.pdf; do
  mustang --action extract --source "$pdf" --out "${pdf%.pdf}.pdf-embedded.xml" >/dev/null
done

echo "== KoSIT"
java -jar "$KOSIT_JAR" -s "$CFG/scenarios.xml" -r "$CFG" -o "$OUT/kosit" "$OUT"/exports/*.xml > "$OUT/kosit/ausgabe.txt" 2>&1 || true
grep -v JAVA_TOOL_OPTIONS "$OUT/kosit/ausgabe.txt" | tail -n 4

echo "== Mustang und veraPDF"
fail=0
declare -A MUS
for f in "$OUT"/exports/*.pdf "$OUT"/exports/*.xml; do
  case $f in *.pdf-embedded.xml) continue;; esac
  name=$(basename "$f")
  mustang --action validate --source "$f" > "$OUT/mustang/$name.xml" || true
  status=$(grep -o '<summary status="[a-z]*"/>' "$OUT/mustang/$name.xml" | tail -1 | sed 's/.*"\(.*\)".*/\1/')
  MUS[$name]=${status:-fehlt}
  [ "${MUS[$name]}" = valid ] || { echo "Mustang: $name ${MUS[$name]}"; fail=1; }
done

echo "== Bericht"
for name in "${!MUS[@]}"; do echo "$name ${MUS[$name]}"; done | sort > "$OUT/mustang/status.txt"
python3 tools/validation-report.py "$OUT" "$KOSIT_TAG" "$CONFIG_TAG" "$CEN_TAG" "$MUSTANG" > "$OUT/BERICHT.md" || fail=1
[ $fail = 0 ] && echo "Alle Exportdateien wurden von KoSIT, Mustang und veraPDF angenommen." || { echo "Prüfung fehlgeschlagen, siehe $OUT/BERICHT.md" >&2; exit 1; }
