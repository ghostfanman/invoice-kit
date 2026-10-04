"""Setzt die KoSIT-Prüfkonfiguration für XRechnung (CII) aus den offiziellen Quellen zusammen.

Entspricht dem Ziel "compile" in build.xml von validator-configuration-xrechnung, beschränkt auf die
CII-Szenarien, weil Invoice Kit nur CII erzeugt. Die EN-16931-Regeln stammen als fertiges XSLT aus dem
CEN-Release, die XRechnung-Regeln und das CII-Schema aus der KoSIT-Paketregistry.

Aufruf: python3 tools/kosit-config.py CACHE CONFIG_TAG CEN_TAG ZIEL
"""
import datetime
import glob
import io
import os
import re
import shutil
import sys
import zipfile

cache, config_tag, cen_tag, target = sys.argv[1:5]
config = os.path.join(cache, f"config-{config_tag}")
build = open(os.path.join(config, "build.xml"), encoding="utf-8").read()
props = dict(re.findall(r'<property name="([^"]+)"\s+value="([^"]*)"', build))


def prop(name):
    value = props[name]
    while "${" in value:
        value = re.sub(r"\$\{([^}]+)\}", lambda m: props[m.group(1)], value)
    return value


version = prop("xrechnung.version")
res = os.path.join(target, "resources")
shutil.rmtree(target, ignore_errors=True)
for d in ("cii/16b/xsd", "cii/16b/xsl", f"xrechnung/{version}/xsl", "xsd"):
    os.makedirs(os.path.join(res, d))

# CII-Schema D16B (uncoupled), Dateien flach wie im offiziellen Build
with zipfile.ZipFile(os.path.join(cache, "D16B_SCRDM__Subset__CII-D16B.zip")) as outer:
    inner = next(n for n in outer.namelist() if n.endswith("CII uncoupled.zip"))
    with zipfile.ZipFile(io.BytesIO(outer.read(inner))) as z:
        for n in z.namelist():
            base = os.path.basename(n)
            if base.startswith("CrossIndustryInvoice") and base.endswith(".xsd"):
                open(os.path.join(res, "cii/16b/xsd", base), "wb").write(z.read(n))

shutil.copy(os.path.join(cache, f"cen-{cen_tag}", "cii/xslt/EN16931-CII-validation.xslt"),
            os.path.join(res, "cii/16b/xsl/EN16931-CII-validation.xsl"))

schematron = f"xrechnung-{version}-schematron-{prop('xr.schematron.version.major.minor')}.{props['xr.schematron.version.patch']}.zip"
with zipfile.ZipFile(os.path.join(cache, schematron)) as z:
    open(os.path.join(res, f"xrechnung/{version}/xsl/XRechnung-CII-validation.xsl"), "wb").write(
        z.read("schematron/cii/XRechnung-CII-validation.xsl"))

for name in ("default-report.xsl", "xrechnung-report.xsl"):
    shutil.copy(os.path.join(config, "src", name), res)
shutil.copy(os.path.join(config, "src", "report.xsd"), os.path.join(res, "xsd"))

scenarios = open(os.path.join(config, "scenarios.xml"), encoding="utf-8").read()
parts = re.split(r"(<scenario>.*?</scenario>)", scenarios, flags=re.S)
scenarios = "".join(p for p in parts if not (p.startswith("<scenario>") and "resources/ubl" in p))
# Platzhalter wie im Ziel "compile-scenario" ersetzen: <filter token="..." value="${...}"/>
props["build.date"] = datetime.date.today().isoformat()
tokens = {t: re.sub(r"\$\{([^}]+)\}", lambda m: prop(m.group(1)), v) for t, v in re.findall(r'<filter token="([^"]+)" value="([^"]*)"', build)}
tokens.setdefault("xrechnung.cvd.version.major.minor", prop("xrechnung.cvd.version.major.minor"))
scenarios = re.sub(r"@([\w.]+)@", lambda m: tokens[m.group(1)], scenarios)
open(os.path.join(target, "scenarios.xml"), "w", encoding="utf-8").write(scenarios)
missing = [loc for loc in re.findall(r"<location>(.*?)</location>", scenarios) if not os.path.exists(os.path.join(target, loc))]
left = re.findall(r"@[\w.]+@", scenarios)
if missing or left:
    sys.exit(f"Konfiguration unvollständig: {missing + left}")
print(f"KoSIT-Konfiguration XRechnung {version}: {scenarios.count('<scenario>')} CII-Szenarien in {target}")
