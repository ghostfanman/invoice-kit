"""Fasst die Ergebnisse von KoSIT, Mustang und veraPDF zu BERICHT.md zusammen.

Aufruf: python3 tools/validation-report.py AUSGABEORDNER KOSIT_TAG CONFIG_TAG CEN_TAG MUSTANG_VERSION
Exit-Code 1, wenn eine Datei abgelehnt wurde oder ein Bericht fehlt.
"""
import datetime
import glob
import hashlib
import os
import re
import subprocess
import sys

out, kosit_tag, config_tag, cen_tag, mustang = sys.argv[1:6]
exports = os.path.join(out, "exports")
VARL = "{http://www.xoev.de/de/validator/varl/1}"


def kosit(name):
    path = os.path.join(out, "kosit", name.removesuffix(".xml") + "-report.xml")
    if not os.path.exists(path):
        return "fehlt", []
    text = open(path, encoding="utf-8").read()
    accepted = re.search(r"<rep:accept\b", text) is not None
    messages = re.findall(r'<rep:message[^>]*level="(error|warning)"[^>]*code="([^"]+)"', text)
    return ("angenommen" if accepted else "abgelehnt"), sorted({f"{level} {code}" for level, code in messages})


mustang_status = dict(line.split() for line in open(os.path.join(out, "mustang", "status.txt")) if line.strip())


def pdfa(name):
    path = os.path.join(out, "mustang", name + ".xml")
    text = open(path, encoding="utf-8").read() if os.path.exists(path) else ""
    m = re.search(r"flavour=(\w+), totalAssertions=(\d+), assertions=\[(.*?)\], isCompliant=(\w+)", text, re.S)
    return f"PDF/A-{m.group(1)} {'konform' if m.group(4) == 'true' else 'nicht konform'} ({m.group(2)} Prüfungen)" if m else "fehlt"


def mustang_notes(name):
    path = os.path.join(out, "mustang", name + ".xml")
    text = open(path, encoding="utf-8").read() if os.path.exists(path) else ""
    return sorted({f"{kind} {rule}" for kind, rule in re.findall(r"<(error|warning|notice)[^>]*>\[([A-Z]+-[A-Z0-9-]+)\]", text)})


def sha(path):
    return hashlib.sha256(open(path, "rb").read()).hexdigest()


java = subprocess.run(["java", "-version"], capture_output=True, text=True).stderr.splitlines()
java = next((line for line in java if "version" in line), "unbekannt")
cases = sorted(os.path.basename(p)[:-4] for p in glob.glob(os.path.join(exports, "*.pdf")))
failed = False
rows = []
for case in cases:
    xml, pdf, embedded = f"{case}.xml", f"{case}.pdf", f"{case}.pdf-embedded.xml"
    k_xml, n_xml = kosit(xml)
    k_pdf, n_pdf = kosit(embedded)
    m_xml, m_pdf, a_pdf = mustang_status.get(xml, "fehlt"), mustang_status.get(pdf, "fehlt"), pdfa(pdf)
    ok = k_xml == k_pdf == "angenommen" and m_xml == m_pdf == "valid" and " konform" in a_pdf
    failed |= not ok
    notes = sorted(set(n_xml) | {f"PDF: {n}" for n in n_pdf} | set(mustang_notes(xml)) | {f"PDF: {n}" for n in mustang_notes(pdf)})
    rows.append(f"| {case} | {k_xml} | {m_xml} | {k_pdf} | {m_pdf} | {a_pdf} | {'ja' if ok else '**nein**'} | {', '.join(notes) or '-'} |")

print(f"""# Prüfbericht der Exportdateien

Erstellt: {datetime.datetime.now(datetime.timezone.utc):%Y-%m-%d %H:%M} UTC · Commit: {subprocess.run(['git', 'rev-parse', '--short', 'HEAD'], capture_output=True, text=True).stdout.strip() or 'unbekannt'}

## Werkzeuge

| Werkzeug | Version | Prüft |
| --- | --- | --- |
| KoSIT-Validator | {kosit_tag} (aus Quellen gebaut) | XML-Schema CII D16B, Schematron EN 16931 (CEN {cen_tag}), Schematron XRechnung 3.0.2 (Regeln 2.6.0) |
| KoSIT-Konfiguration | validator-configuration-xrechnung {config_tag}, CII-Szenarien | XRechnung-XML und eingebettete EN-16931-XML |
| Mustang-CLI | {mustang} | ZUGFeRD-/Factur-X-Struktur, XML-Schema, Schematron EN 16931 und XRechnung |
| veraPDF (in Mustang) | mit Mustang {mustang} | PDF/A-3b |
| Java | {java.strip()} | |

## Ergebnisse

Spalten: XRechnung-XML (KoSIT, Mustang), ZUGFeRD-PDF (KoSIT auf der eingebetteten XML, Mustang, veraPDF).

| Prüffall | XML KoSIT | XML Mustang | PDF-XML KoSIT | PDF Mustang | PDF/A | bestanden | Hinweise |
| --- | --- | --- | --- | --- | --- | --- | --- |
{chr(10).join(rows)}

Hinweise vom Typ `notice BR-DE-21` bei PDFs sind erwartet: Die eingebettete XML deklariert bewusst das Profil EN 16931 (ZUGFeRD), nicht XRechnung.

## Prüfsummen der geprüften Dateien

| Datei | SHA-256 |
| --- | --- |
{chr(10).join(f"| {os.path.basename(p)} | `{sha(p)}` |" for p in sorted(glob.glob(os.path.join(exports, '*.xml')) + glob.glob(os.path.join(exports, '*.pdf'))) if not p.endswith('-embedded.xml'))}
""")
sys.exit(1 if failed or not cases else 0)
