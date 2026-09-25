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

def main_script(src):
    """Letzter <script>-Block ohne src (die Werkzeug-Logik)."""
    blocks = re.findall(r"<script>(.*?)</script>", src, re.S)
    return blocks[-1]

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
  <style>{CSS}</style>
{jsonld}
</head>
<body>
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
body = between(src, "<main>", "</main>")
body = body.replace('<section class="card form">', '<section class="ik-card ik-form">')
body = body.replace('<section id="preview" aria-label="Vorschau"></section>', '<section id="preview" aria-label="Rechnungsvorschau"></section>')
tip = f"""
    <div class="ik-tip hide" id="ikTip">Kunde im Ausland? Mit einem Wise-Konto bekommst du lokale Kontodaten in EUR, USD, GBP und weiteren Währungen. Dein Kunde überweist wie im Inland, du sparst teure Auslandsgebühren.
      <a href="{WISE}" target="_blank" rel="sponsored noopener">Zum Wise-Konto<span class="btn-ad">Anzeige</span></a> · <a href="/geld-ins-ausland">Geld ins Ausland: alle Optionen</a></div>"""
anchor = '<div><label>BIC (optional)</label><input id="bic"></div>\n    </div>'
assert anchor in body, "IBAN/BIC-Block nicht gefunden"
body = body.replace(anchor, anchor + tip, 1)
tool1 = ('        <p class="ik-links"><a href="anzeigen.html">Eine E-Rechnung bekommen? Hier öffnen und prüfen →</a></p>\n'
         '        <div class="ik-grid">' + body + '</div>')

js = main_script(src)
js = js.replace('const KEY="invoice-kit-v3";', 'const KEY="wambur-rechnung-v3";')
js = re.sub(r'if\("serviceWorker" in navigator.*?\n', '', js)
js = js.replace('localStorage.getItem("invoice-kit-v2")', 'null')
js += """
/* Wambur: Hinweis auf Konto für Auslandszahlungen nur, wenn er zum Kunden passt */
function ikTip(){try{const s=state();const foreign=(s.toCountry||"DE").toUpperCase()!=="DE"||s.cur!=="EUR"||["AE","K","G","O"].includes(s.taxCase);
  document.getElementById("ikTip").classList.toggle("hide",!foreign)}catch(e){}}
document.addEventListener("input",ikTip);document.addEventListener("change",ikTip);ikTip();
"""
scripts1 = '  <script src="vendor/qrcode.js"></script>\n  <script>' + js + "</script>"

faq1 = [
 ("Welche Rechnung schreibe ich, wenn ich im Ausland arbeite, aber in Deutschland steuerpflichtig bin?",
  "Solange du in Deutschland steuerpflichtig bist, gilt das deutsche Umsatzsteuergesetz, egal wo dein Laptop gerade steht. Entscheidend ist, wo dein Kunde sitzt: Firma in Deutschland, Firma in der EU, Firma außerhalb der EU oder Privatperson. Die Tabelle oben zeigt, welchen Steuerfall du im Tool auswählst. Wenn du deinen Wohnsitz in Deutschland aufgibst, ändern sich die Regeln. Das gehört in eine Steuerberatung."),
 ("Was bedeutet Reverse Charge?",
  "Bei Leistungen an Unternehmen in einem anderen EU-Land zahlt nicht du die Umsatzsteuer, sondern dein Kunde in seinem Land. Du stellst die Rechnung ohne Umsatzsteuer aus, mit beiden USt-IdNrn. und dem Hinweis „Steuerschuldnerschaft des Leistungsempfängers“. Das Tool druckt den Hinweis automatisch, auf Wunsch in der Sprache deines Kunden."),
 ("Darf ich Rechnungen auf Englisch schreiben?",
  "Ja. Das Gesetz schreibt keine Sprache vor. Das Finanzamt kann bei Bedarf eine Übersetzung verlangen. Invoice Kit erstellt Rechnungen auf Deutsch, Englisch, Französisch, Italienisch, Spanisch, Niederländisch und Polnisch."),
 ("Muss ich ab 2027 oder 2028 E-Rechnungen schreiben?",
  "Für Rechnungen an Unternehmen in Deutschland ja: ab 2027 bei mehr als 800.000 € Vorjahresumsatz, ab 2028 für alle. Kleinunternehmer nach § 19 UStG sind ausgenommen, müssen E-Rechnungen aber empfangen können. Für Kunden im Ausland gilt die deutsche Pflicht nicht, eine ZUGFeRD-Rechnung ist trotzdem ein normales, lesbares PDF."),
 ("Brauche ich eine USt-IdNr.?",
  "Für Reverse Charge und Lieferungen in die EU ja. Du beantragst sie kostenlos online beim Bundeszentralamt für Steuern. Als Kleinunternehmer ohne EU-Kunden reicht die Steuernummer."),
 ("Wo werden meine Rechnungsdaten gespeichert?",
  "Nur in deinem Browser. Das Tool läuft komplett auf deinem Gerät, es gibt kein Konto und keine Übertragung an einen Server. Für ein Backup kannst du jede Rechnung als Datei sichern."),
]
after1 = f"""    <section class="section">
      <div class="wrap">
        <div class="answer-box"><p><strong>Kurz gesagt:</strong> Solange du in Deutschland steuerpflichtig bist, schreibst du Rechnungen nach deutschem Recht, auch vom Strand in Lissabon aus. Für Firmenkunden in der EU gilt meist Reverse Charge, für Firmen außerhalb der EU ist deine Leistung meist nicht in Deutschland steuerbar. Ab 2028 muss jede Rechnung an deutsche Firmen eine E-Rechnung sein. Das Tool oben erledigt alle drei Fälle und kostet nichts.</p></div>
        <h2>Welcher Steuerfall passt zu deinem Kunden?</h2>
        <p>Für Dienstleistungen wie Design, Entwicklung, Text oder Beratung gilt als Faustregel:</p>
        <div class="table-wrap"><table>
          <thead><tr><th>Dein Kunde</th><th>Beispiel</th><th>Steuerfall im Tool</th><th>Was auf die Rechnung muss</th></tr></thead>
          <tbody>
            <tr><td>Firma in Deutschland</td><td>Agentur in Hamburg</td><td>Normal (19 %) oder Kleinunternehmer</td><td>Umsatzsteuer bzw. Hinweis auf § 19 UStG</td></tr>
            <tr><td>Firma in einem anderen EU-Land</td><td>Startup in Lissabon</td><td>Reverse Charge</td><td>Beide USt-IdNrn., Hinweis „Steuerschuldnerschaft des Leistungsempfängers“</td></tr>
            <tr><td>Firma außerhalb der EU</td><td>Kunde in den USA, UK oder der Schweiz</td><td>Nicht im Inland steuerbar</td><td>Keine Umsatzsteuer, Hinweis wird gedruckt</td></tr>
            <tr><td>Privatperson</td><td>Coaching für eine Kundin in Wien</td><td>Normal (19 %)</td><td>Deutsche Umsatzsteuer; bei digitalen Leistungen an EU-Privatkunden über 10.000 € im Jahr gilt die Steuer des Kundenlandes (OSS)</td></tr>
          </tbody>
        </table></div>
        <p>Für Warenlieferungen gibt es eigene Fälle (innergemeinschaftliche Lieferung, Ausfuhr), die das Tool ebenfalls abdeckt.</p>
        <h2>ZUGFeRD oder XRechnung: welches Format?</h2>
        <p><strong>ZUGFeRD</strong> ist ein normales PDF, in dem die E-Rechnung als Datei steckt. Menschen lesen das PDF, Buchhaltungsprogramme die Daten. Das passt für fast alle Firmenkunden. <strong>XRechnung</strong> ist reines XML und wird vor allem von Behörden verlangt. Beide Formate erstellt das Tool nach den offiziellen Regeln.</p>
        <h2>Damit das Geld auch ankommt</h2>
        <div class="card-grid">
          <div class="card"><h3 class="mt-0">Zahlungen aus dem Ausland</h3><p>Mit lokalen Kontodaten in EUR, USD und GBP überweisen deine Kunden wie im Inland, ohne Auslandsgebühren. <a href="/geld-ins-ausland">Alle Optionen im Vergleich</a>.</p>
            <div class="tool-actions"><a class="btn-accent" href="{WISE}" target="_blank" rel="sponsored noopener">Zum Wise-Konto <span class="btn-ad">Anzeige</span></a></div></div>
          <div class="card"><h3 class="mt-0">Girokonto für unterwegs</h3><p>Ein deutsches Konto, mit dem du weltweit gebührenfrei Geld abhebst, als Basis für Rechnungen an deutsche Kunden. <a href="/dkb">Mehr dazu</a>.</p>
            <div class="tool-actions"><a class="btn-accent" href="/go/dkb" rel="sponsored noopener">DKB-Girokonto ansehen <span class="btn-ad">Anzeige</span></a></div></div>
          <div class="card"><h3 class="mt-0">Rechnung bekommen?</h3><p>Seit 2025 musst du E-Rechnungen empfangen können. Unser Viewer öffnet XRechnung und ZUGFeRD und prüft die Pflichtangaben für deinen Vorsteuerabzug.</p>
            <div class="tool-actions"><a class="tool-more" href="anzeigen.html">E-Rechnung öffnen</a></div></div>
        </div>
        <h2>Häufige Fragen</h2>
{faq_html(faq1)}
        <aside class="med-disclaimer"><span class="callout-eyebrow">Wichtig</span><p>Das Tool und diese Seite ersetzen keine Steuerberatung. Welcher Steuerfall für dich gilt, hängt von deinem Wohnsitz, deinem Kunden und deiner Leistung ab. Im Zweifel frag eine Steuerberaterin oder einen Steuerberater. Das Tool basiert auf dem Open-Source-Projekt <a href="https://github.com/ghostfanman/invoice-kit" target="_blank" rel="noopener">Invoice Kit</a> (MIT-Lizenz).</p></aside>
      </div>
    </section>"""

title1 = "Rechnung schreiben als Freelancer: E-Rechnung kostenlos, auch ins Ausland | Wambur"
desc1 = "Kostenloser Rechnungsgenerator für Freelancer und digitale Nomaden: ZUGFeRD und XRechnung, Reverse Charge, Rechnung auf Englisch, GiroCode. Ohne Anmeldung, Daten bleiben auf deinem Gerät."
crumb1 = '<a href="/">Start</a> › <a href="/ortsunabhaengig-arbeiten">Ortsunabhängig arbeiten</a> › E-Rechnung schreiben'
jsonld1 = "\n".join([
    ld(crumbs_ld([("Start", "https://wambur.com/"), ("Ortsunabhängig arbeiten", "https://wambur.com/ortsunabhaengig-arbeiten"), ("E-Rechnung schreiben", BASE)])),
    ld({"@context": "https://schema.org", "@type": "WebApplication", "name": "E-Rechnung schreiben (Wambur)", "url": BASE,
        "applicationCategory": "BusinessApplication", "operatingSystem": "Web", "inLanguage": "de", "isAccessibleForFree": True,
        "offers": {"@type": "Offer", "price": "0", "priceCurrency": "EUR"},
        "featureList": ["ZUGFeRD 2.3 / Factur-X", "XRechnung 3.0", "Reverse Charge", "Rechnung auf Englisch und 5 weiteren Sprachen", "GiroCode", "Daten bleiben im Browser"],
        "publisher": {"@id": "https://wambur.com/#organization"}}),
    ld(faq_ld(faq1))])
lead1 = "ZUGFeRD-PDF oder XRechnung mit allen Pflichtangaben, auch für Kunden im Ausland und auf Englisch. Kostenlos, ohne Anmeldung, deine Daten bleiben auf deinem Gerät."

# ================================================================ 2) E-Rechnung öffnen
vsrc = (ROOT / "anzeigen.html").read_text(encoding="utf-8")
vbody = between(vsrc, "<main>", "</main>")
vbody = re.sub(r'\s*<section class="info card".*?</section>', "", vbody, flags=re.S)
vbody = vbody.replace('<div class="card" id="drop"', '<div id="drop"').replace('<div class="card" id="checkCard">', '<div class="ik-card" id="checkCard" style="margin-bottom:16px">')
vbody = vbody.replace('<h3 style="margin:0 0 8px">', "<h3>")
tool2 = '        <p class="ik-links"><a href="./">← Eigene Rechnung schreiben</a></p>\n' + vbody
vjs = main_script(vsrc)
vjs = re.sub(r'if\("serviceWorker" in navigator.*?\n', '', vjs)
scripts2 = "  <script>" + vjs + "</script>"
faq2 = [
 ("Muss ich als Freelancer E-Rechnungen empfangen können?",
  "Ja. Seit 1. Januar 2025 muss jedes Unternehmen in Deutschland E-Rechnungen annehmen können, auch Kleinunternehmer und Freelancer, die gerade im Ausland arbeiten. Eine E-Mail-Adresse und ein Programm zum Öffnen reichen dafür."),
 ("Wie bewahre ich E-Rechnungen auf?",
  "Im Original, also die XML- oder ZUGFeRD-Datei selbst, acht Jahre lang und unveränderbar. Ein Ausdruck allein reicht nicht. Ein fester Ordner im Cloud-Speicher mit Versionierung ist ein pragmatischer Anfang."),
 ("Was prüft der Pflichtangaben-Check?",
  "Ob die Angaben aus § 14 UStG vorhanden sind, die du für den Vorsteuerabzug brauchst, und ob die Summen zusammenpassen. Fehlt etwas, fordere beim Absender eine korrigierte Rechnung an. Eine technische Voll-Validierung ersetzt der Check nicht."),
 ("Wird meine Rechnung hochgeladen?",
  "Nein. Die Datei wird nur in deinem Browser gelesen und nirgendwohin übertragen."),
]
after2 = f"""    <section class="section">
      <div class="wrap">
        <h2>Häufige Fragen</h2>
{faq_html(faq2)}
        <aside class="med-disclaimer"><span class="callout-eyebrow">Wichtig</span><p>Der Check ist eine Plausibilitätsprüfung und keine Steuerberatung. Basis ist das Open-Source-Projekt <a href="https://github.com/ghostfanman/invoice-kit" target="_blank" rel="noopener">Invoice Kit</a> (MIT-Lizenz).</p></aside>
      </div>
    </section>"""
title2 = "E-Rechnung öffnen und prüfen: XRechnung & ZUGFeRD kostenlos | Wambur"
desc2 = "XRechnung und ZUGFeRD kostenlos öffnen, lesen und drucken. Prüft die Pflichtangaben für den Vorsteuerabzug. Keine Datei verlässt dein Gerät."
crumb2 = '<a href="/">Start</a> › <a href="/ortsunabhaengig-arbeiten">Ortsunabhängig arbeiten</a> › <a href="./">E-Rechnung schreiben</a> › E-Rechnung öffnen'
jsonld2 = "\n".join([
    ld(crumbs_ld([("Start", "https://wambur.com/"), ("Ortsunabhängig arbeiten", "https://wambur.com/ortsunabhaengig-arbeiten"),
                  ("E-Rechnung schreiben", BASE), ("E-Rechnung öffnen", BASE + "anzeigen.html")])),
    ld(faq_ld(faq2))])

# ================================================================ Ausgabe
if OUT.exists():
    shutil.rmtree(OUT)
(OUT / "vendor").mkdir(parents=True)
(OUT / "index.html").write_text(page(title1, desc1, BASE, crumb1, "E-Rechnung schreiben: kostenlos, auch für Kunden im Ausland", lead1, tool1, after1, scripts1, jsonld1), encoding="utf-8")
(OUT / "anzeigen.html").write_text(page(title2, desc2, BASE + "anzeigen.html", crumb2, "E-Rechnung öffnen und prüfen",
    "XRechnung oder ZUGFeRD bekommen? Hier öffnen, lesen, drucken und auf Pflichtangaben prüfen. Die Datei bleibt auf deinem Gerät.",
    tool2, after2, scripts2, jsonld2), encoding="utf-8")
shutil.copy(ROOT / "zugferd.js", OUT / "zugferd.js")
for f in ["pdf-lib.min.js", "fontkit.umd.min.js", "fonts.js", "qrcode.js", "LIZENZEN.txt"]:
    shutil.copy(ROOT / "vendor" / f, OUT / "vendor" / f)
shutil.copy(ROOT / "LICENSE", OUT / "LICENSE.txt") if (ROOT / "LICENSE").exists() else None
print("Fertig:", OUT)
for p in sorted(OUT.rglob("*")):
    if p.is_file():
        print(f"  {p.relative_to(OUT.parent)}  {p.stat().st_size:,} B")
