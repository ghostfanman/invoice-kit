#!/usr/bin/env python3
"""Baut die Wambur-Version von Invoice Kit.

Aufruf:  python3 integration/build-wambur.py  [Zielordner]
Ergebnis: <Zielordner>/e-rechnung/  (Standard: dist-wambur/e-rechnung/)
Den Ordner e-rechnung/ unverändert ins Web-Root von wambur.com hochladen.

Die Werkzeug-Logik (Formular, Vorschau, XRechnung, ZUGFeRD, Viewer) wird aus
index.html / anzeigen.html übernommen; nur Hülle, Design und Texte sind Wambur-spezifisch.
"""
import re, shutil, sys, json, html
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = Path(sys.argv[1] if len(sys.argv) > 1 else ROOT / "dist-wambur") / "e-rechnung"
BASE = "https://wambur.com/e-rechnung/"
WISE = "https://wise.prf.hn/click/camref:1110lMwVq"   # Wambur-Partnerlink (von wambur.com übernommen)

def between(s, a, b, start=0):
    i = s.index(a, start) + len(a)
    return s[i:s.index(b, i)]

# ---------------------------------------------------------------- CSS
CSS = """
.ik{--ik-bg:var(--surface,#1e1e20);--ik-panel:var(--panel,#26262a);--ik-line:var(--border,#2f2f34);--ik-text:var(--text,#f1f1f2);
  --ik-muted:var(--muted,#a8a8ad);--ik-accent:var(--primary,#25f4ee);--ik-soft:var(--primary-soft,#10312f);--ik-err:#ff6b81;--ik-warn:#fbbf24;--ik-ok:#4ade80;
  max-width:1300px;margin:0 auto;padding:0 16px;color:var(--ik-text)}
.ik *{box-sizing:border-box}
.ik .ik-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:20px;align-items:start}
@media(max-width:900px){.ik .ik-grid{grid-template-columns:1fr}}
.ik .ik-card{background:var(--ik-bg);border:1px solid var(--ik-line);border-radius:14px;padding:18px}
.ik h2{font-size:12px;margin:20px 0 6px;color:var(--ik-muted);text-transform:uppercase;letter-spacing:.06em;font-weight:700;line-height:1.3}
.ik h2:first-child{margin-top:0}
.ik label{display:block;font-size:12px;color:var(--ik-muted);margin-top:8px}
.ik input,.ik textarea,.ik select{width:100%;padding:9px 10px;border:1px solid var(--ik-line);border-radius:8px;font:inherit;font-size:15px;background:var(--ik-panel);color:var(--ik-text);margin:0}
.ik input:focus,.ik textarea:focus,.ik select:focus{outline:2px solid var(--ik-accent);outline-offset:0;border-color:transparent}
.ik input::placeholder,.ik textarea::placeholder{color:#7c7c84}
.ik input[type=date]{color-scheme:dark}
.ik .missing{border-color:var(--ik-err)!important;background:#3a1d24!important}
.ik textarea{min-height:56px;resize:vertical}
.ik .row{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.ik .row3{display:grid;grid-template-columns:1fr 2fr 1fr;gap:10px}
.ik .mt{margin-top:8px}
.ik .hint{font-size:12px;color:var(--ik-muted);margin:4px 0 0}
.ik .check{display:flex;gap:8px;align-items:flex-start;font-size:13px;color:var(--ik-text);margin-top:10px}
.ik .check input{width:auto;margin-top:3px;accent-color:var(--ik-accent)}
.ik details{margin-top:10px;border:1px dashed var(--ik-line);border-radius:8px;padding:6px 10px}
.ik summary{cursor:pointer;font-size:13px;color:var(--ik-accent);font-weight:600}
.ik .pro-badge{display:inline-flex;align-items:center;gap:8px;margin:0 0 14px;padding:6px 14px;border-radius:999px;background:#f59e0b;color:#1c2230;font-weight:700;font-size:13px;text-decoration:none;max-width:100%;overflow-wrap:anywhere}
.ik .pro-badge::before{content:"✓"}
.ik .pro-badge+h2{margin-top:0}
.ik #proPanel.active{border-color:#f59e0b;border-style:solid}
.ik #proPanel a{color:var(--ik-accent)}
.ik .pro-state{margin:10px 0;font-size:14px}
.ik .pro-state p{margin:0}
.ik .pro-state.active{padding:10px 14px;border-radius:8px;background:rgba(74,222,128,.12);border:1px solid var(--ik-ok);color:var(--ik-text)}
.ik .pro-state.active strong{color:var(--ik-ok)}
.ik .pro-state.active strong::before{content:"✓ "}
.ik table.items{width:100%;border-collapse:collapse;margin:0}
.ik table.items th{font-size:12px;color:var(--ik-muted);text-align:left;font-weight:500;padding:2px 3px;border:0;background:none}
.ik table.items td{padding:3px;border:0}
.ik table.items input,.ik table.items select{padding:7px}
.ik table.items select{min-width:80px}
.ik .hide{display:none!important}
.ik button{cursor:pointer;border:0;border-radius:8px;padding:10px 14px;font:inherit;font-weight:700;font-size:14px}
.ik .primary{background:var(--ik-accent);color:#062523}
.ik .primary:hover{filter:brightness(1.08)}
.ik .ghost{background:var(--ik-soft);color:var(--ik-accent);border:1px solid var(--primary-line,#1d5a57)}
.ik .del{background:none;color:var(--ik-err);padding:4px 8px}
.ik .actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:16px}
.ik #msg{margin-top:12px;font-size:13px;white-space:pre-line}
.ik #msg.ok{color:var(--ik-ok)}.ik #msg.err{color:var(--ik-err)}
.ik #warn{margin-top:8px;font-size:13px;color:var(--ik-warn);white-space:pre-line}
.ik .ik-tip{margin-top:10px;padding:10px 12px;border-radius:10px;background:var(--ik-soft);border:1px solid var(--primary-line,#1d5a57);font-size:13px;color:var(--ik-text)}
.ik .ik-tip a{color:var(--ik-accent);font-weight:700}
.ik .ik-tip .btn-ad{font-size:10px;text-transform:uppercase;letter-spacing:.05em;border:1px solid currentColor;border-radius:4px;padding:0 4px;margin-left:4px;opacity:.8}
.ik .ik-links{display:flex;gap:14px;flex-wrap:wrap;margin:0 0 14px;font-size:14px}
.ik .ik-links a{color:var(--ik-accent)}
/* Rechnungsvorschau bleibt weißes Papier */
.ik #preview{background:#fff;color:#111;padding:40px;min-height:800px;border-radius:14px;font-size:13px;line-height:1.5;box-shadow:var(--shadow,0 14px 34px rgba(0,0,0,.55))}
@media(max-width:640px){.ik #preview{padding:20px}}
.ik #preview *{color:inherit}
.ik #preview h1{font-size:26px;margin:0 0 4px;color:#111;line-height:1.2}
.ik #preview p{margin:10px 0;max-width:none}
.ik #preview .top{display:flex;justify-content:space-between;gap:20px;margin-bottom:30px}
.ik #preview table{width:100%;border-collapse:collapse;margin:20px 0;background:#fff}
.ik #preview th{text-align:left;border:0;border-bottom:2px solid #111;padding:6px 4px;background:#fff;color:#111}
.ik #preview td{border:0;border-bottom:1px solid #ddd;padding:6px 4px;vertical-align:top;background:#fff}
.ik #preview .r{text-align:right;white-space:nowrap}
.ik #preview .tot{width:320px;max-width:100%;margin-left:auto}
.ik #preview .tot div{display:flex;justify-content:space-between;padding:3px 0}
.ik #preview .tot .big{font-weight:700;font-size:16px;border-top:2px solid #111;margin-top:4px;padding-top:6px}
.ik #preview .legal{margin-top:18px;font-weight:600}
.ik #preview .payrow{display:flex;justify-content:space-between;align-items:flex-start;gap:20px}
.ik #preview figure.qr{margin:0;text-align:center;font-size:10px;color:#555;width:120px}
.ik #preview .foot{margin-top:40px;font-size:11px;color:#555;white-space:pre-line;border-top:1px solid #ddd;padding-top:8px}
.ik .pre{white-space:pre-line}
/* Viewer */
.ik #drop{border:2px dashed var(--primary-line,#1d5a57);background:var(--ik-soft);text-align:center;padding:36px 16px;cursor:pointer;border-radius:14px}
.ik #drop.over{border-color:var(--ik-accent)}
.ik #drop strong{font-size:18px;display:block;margin-bottom:6px;color:var(--head,#fff)}
.ik #drop p{margin:0;color:var(--ik-muted)}
.ik #status{font-size:14px;margin:12px 0;white-space:pre-line}
.ik #status.err{color:var(--ik-err)}
.ik .checks{list-style:none;padding:0;margin:0;font-size:14px}
.ik .checks li{padding:5px 0;border-bottom:1px solid var(--ik-line);margin:0}
.ik .checks li::before{display:inline-block;width:22px;font-weight:700}
.ik .checks .ok::before{content:"✓";color:var(--ik-ok)}.ik .checks .bad::before{content:"✗";color:var(--ik-err)}.ik .checks .hint::before{content:"!";color:var(--ik-warn)}
.ik #checkCard h3{margin:0 0 8px;font-size:16px}
.ik #checkCard a{color:var(--ik-accent)}
.ik #inv{background:#fff;color:#111;padding:36px;border-radius:14px;font-size:13px;line-height:1.5}
@media(max-width:640px){.ik #inv{padding:18px}.ik #inv .parties{grid-template-columns:1fr}}
.ik #inv *{color:inherit}
.ik #inv h1{font-size:24px;margin:0 0 4px;color:#111}
.ik #inv h3{font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#666;margin:0 0 4px}
.ik #inv p{margin:10px 0;max-width:none}
.ik #inv .top{display:flex;justify-content:space-between;gap:20px;flex-wrap:wrap;margin-bottom:24px}
.ik #inv .parties{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:10px}
.ik #inv table{width:100%;border-collapse:collapse;margin:16px 0;background:#fff}
.ik #inv th{text-align:left;border:0;border-bottom:2px solid #111;padding:6px 4px;background:#fff;color:#111}
.ik #inv td{border:0;border-bottom:1px solid #ddd;padding:6px 4px;vertical-align:top;background:#fff}
.ik #inv .r{text-align:right;white-space:nowrap}
.ik #inv .tot{width:320px;max-width:100%;margin-left:auto}
.ik #inv .tot div{display:flex;justify-content:space-between;padding:3px 0}
.ik #inv .tot .big{font-weight:700;font-size:16px;border-top:2px solid #111;margin-top:4px;padding-top:6px}
.ik #inv .muted{color:#555}
.ik .table-wrap{overflow-x:auto}
@media print{
  body>*:not(main),main>section:not(.ik-section),.ik .ik-form,.ik .ik-links,.ik #drop,.ik .actions,.ik #status,.ik #checkCard{display:none!important}
  body,main{background:#fff!important;margin:0!important;padding:0!important}
  .ik{padding:0;max-width:none}.ik .ik-grid{display:block}
  .ik #preview,.ik #inv{box-shadow:none;border-radius:0;padding:0}
}
"""

# ---------------------------------------------------------------- Seitenhülle
def page(title, desc, canonical, crumb, h1, lead, tool_html, after_html, scripts, jsonld):
    return f"""<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#121212">
  <title>{html.escape(title)}</title>
  <meta name="description" content="{html.escape(desc)}">
  <meta name="robots" content="index,follow,max-image-preview:large">
  <link rel="canonical" href="{canonical}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Wambur">
  <meta property="og:title" content="{html.escape(title)}">
  <meta property="og:description" content="{html.escape(desc)}">
  <meta property="og:url" content="{canonical}">
  <meta property="og:locale" content="de_DE">
  <link rel="icon" href="/favicon.ico" sizes="any">
  <link rel="icon" type="image/png" sizes="32x32" href="/assets/icon-32.png">
  <link rel="icon" type="image/png" sizes="192x192" href="/assets/icon-192.png">
  <link rel="stylesheet" href="/styles.css">
  <link rel="stylesheet" href="accessibility.css">
  <style>{CSS}</style>
{jsonld}
</head>
<body data-storage-key="wambur-rechnung-v3" data-no-service-worker="true">
  <div id="site-header-slot"></div>
  <main id="main">
    <section class="hero">
      <div class="hero-slides" aria-hidden="true"></div>
      <div class="wrap">
        <nav class="breadcrumb" aria-label="Brotkrumen">{crumb}</nav>
        <h1>{h1}</h1>
        <p class="lead">{lead}</p>
        <p class="page-meta"><a href="/ueber-uns">Unsere Recherchegrundsätze</a> <span>·</span> <a href="/affiliate-offenlegung">Transparenz &amp; Werbung</a></p>
        <div class="page-share" data-share-slot=""><button type="button" class="share-btn" disabled aria-label="Teilen wird geladen"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.6" y1="13.5" x2="15.4" y2="17.5"></line><line x1="15.4" y1="6.5" x2="8.6" y2="10.5"></line></svg><span>Diese Seite teilen</span></button></div>
      </div>
    </section>
    <section class="section ik-section">
      <div class="ik">
{tool_html}
      </div>
    </section>
{after_html}
  </main>
  <script src="/site-layout.js"></script>
{scripts}
</body>
</html>
"""

def ld(obj):
    return '  <script type="application/ld+json">\n' + json.dumps(obj, ensure_ascii=False, indent=2) + "\n  </script>"

def faq_html(items):
    return '<div class="faq">\n' + "\n".join(
        f'  <details><summary>{q}</summary><div class="faq-a">{a}</div></details>' for q, a in items) + "\n</div>"

def faq_ld(items):
    strip = lambda s: re.sub(r"<[^>]+>", "", s)
    return {"@context": "https://schema.org", "@type": "FAQPage", "mainEntity": [
        {"@type": "Question", "name": strip(q), "acceptedAnswer": {"@type": "Answer", "text": strip(a)}} for q, a in items]}

def crumbs_ld(items):
    return {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
        {"@type": "ListItem", "position": i + 1, "name": n, "item": u} for i, (n, u) in enumerate(items)]}

# ================================================================ 1) Rechnung schreiben
src = (ROOT / "index.html").read_text(encoding="utf-8")
body = between(src, "<main>", "</main>").replace('<section class="card form">', '<section class="ik-card ik-form">')
body = body.replace('<h2>Zahlung</h2>', f'<h2>Zahlung</h2><aside class="ik-tip hide" id="ikTip">Zahlungen aus dem Ausland: <a href="{WISE}" target="_blank" rel="sponsored noopener">Wise-Konto ansehen <span class="btn-ad">Anzeige</span></a> · <a href="/geld-ins-ausland">Optionen im Vergleich</a></aside>')
tool1 = '<p class="ik-links"><a href="anzeigen.html">E-Rechnung öffnen und auf Plausibilität prüfen</a></p><div class="ik-grid">' + body + '</div>'
vsrc = (ROOT / "anzeigen.html").read_text(encoding="utf-8")
vbody = between(vsrc, "<main>", "</main>")
vbody = re.sub(r'\s*<section class="info card".*?</section>', "", vbody, flags=re.S)
vbody = vbody.replace('<div class="card" id="drop"', '<div id="drop"').replace('<div class="card" id="checkCard">', '<div class="ik-card" id="checkCard">')
tool2 = '<p class="ik-links"><a href="./">Eigene Rechnung schreiben</a></p>' + vbody
faq = [
    ("Wo bleiben meine Daten?", "Rechnungsdaten werden ausschließlich lokal im Browser verarbeitet. Du kannst den Entwurf auf diesem Gerät speichern oder als JSON herunterladen. Auf gemeinsam genutzten Geräten können gespeicherte Daten für andere sichtbar bleiben. Die Löschfunktion entfernt lokale Invoice-Kit-Entwürfe und Einstellungen. Heruntergeladene Dateien musst du separat löschen."),
    ("Was prüft Invoice Kit?", "Das Formular prüft Eingaben und berechnet Beträge. Der Viewer führt eine Plausibilitätsprüfung durch. Eine vollständige Validierung nach XML-Schema, Schematron, EN 16931 oder PDF/A findet im Browser nicht statt."),
    ("Wie prüfe ich die erzeugte Rechnung?", "Prüfe XRechnung mit dem KoSIT-Validator und passender Konfiguration. Mustang prüft ZUGFeRD/Factur-X und die eingebettete XML, veraPDF das PDF/A-Profil. Verwende die Programme lokal und bewahre Prüfberichte zusammen mit der geprüften Datei auf."),
    ("Welcher Steuerfall passt?", "Das Tool bietet Regelbesteuerung, Kleinunternehmer, steuerfreie Leistungen, Reverse Charge, innergemeinschaftliche Lieferung, Ausfuhr und nicht steuerbare Leistungen. Welcher Fall zutrifft, hängt von der konkreten Leistung und den beteiligten Parteien ab. Kläre Unsicherheiten mit einer Steuerberatung."),
]
after = '<section class="section"><div class="wrap"><h2>Hinweise zur Nutzung</h2>' + faq_html(faq) + '<p>Basis: <a href="https://github.com/ghostfanman/invoice-kit">Invoice Kit</a>, MIT-Lizenz. Keine Steuerberatung.</p></div></section>'
common_ld = ld(faq_ld(faq))
pages = {
    "index.html": page("E-Rechnung erstellen | Wambur", "Rechnungen lokal im Browser erstellen: CII-XML, ZUGFeRD-PDF, mehrere Sprachen und Zahlungsarten.", BASE,
        '<a href="/">Start</a> › E-Rechnung erstellen', "E-Rechnung erstellen", "Rechnungen schreiben und lokal als XML oder PDF speichern.", tool1, after,
        '<script src="vendor/qrcode.js"></script>\n<script type="module" src="generator.js"></script><script type="module" src="pro-app.js"></script><script type="module" src="wambur.js"></script>', common_ld),
    "anzeigen.html": page("E-Rechnung öffnen | Wambur", "CII, UBL und eingebettete XML in ZUGFeRD-PDFs lokal anzeigen und auf Plausibilität prüfen.", BASE + "anzeigen.html",
        '<a href="/">Start</a> › <a href="./">E-Rechnung erstellen</a> › E-Rechnung öffnen', "E-Rechnung öffnen", "Die Datei bleibt auf deinem Gerät. Der Viewer führt eine Plausibilitätsprüfung durch.", tool2, after,
        '<script type="module" src="viewer.js"></script>', common_ld),
}
# Nur bekannte Ausgabedateien überschreiben, keine fremden Zielordner löschen.
(OUT / "vendor").mkdir(parents=True, exist_ok=True)
assets = ["generator.js", "viewer.js", "core.js", "viewer-check.js", "storage.js", "zugferd.js", "accessibility.css", "pro-app.js", "pro-data.js", "pro-license.js", "pro-config.js", "admin.html", "admin.js", "admin.css"]
for name, content in pages.items():
    (OUT / name).write_text(content, encoding="utf-8")
    preview = content
    # Dynamisch nachgeladene Bibliotheken werden relativ zur Dokumentbasis aufgelöst.
    preview = preview.replace('<head>', '<head>\n<base href="../">')
    preview = preview.replace('src="wambur.js"', 'src="integration/wambur.js"')
    (ROOT / "integration" / ("wambur-vorschau-" + name)).write_text(preview, encoding="utf-8")
shutil.copy(ROOT / "integration" / "wambur.js", OUT / "wambur.js")
for name in assets:
    shutil.copy(ROOT / name, OUT / name)
for name in ["pdf-lib.min.js", "fontkit.umd.min.js", "fonts.js", "qrcode.js", "LIZENZEN.txt"]:
    shutil.copy(ROOT / "vendor" / name, OUT / "vendor" / name)
shutil.copy(ROOT / "LICENSE", OUT / "LICENSE.txt")
print("Fertig:", OUT)
print("Wambur-Vorschauen in integration/ aktualisiert.")
