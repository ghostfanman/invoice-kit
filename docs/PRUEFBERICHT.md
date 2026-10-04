# Prüfbericht der Exportdateien

Erstellt: 2026-10-04 19:26 UTC · Commit: 07cca4f

## Werkzeuge

| Werkzeug | Version | Prüft |
| --- | --- | --- |
| KoSIT-Validator | v1.6.3 (aus Quellen gebaut) | XML-Schema CII D16B, Schematron EN 16931 (CEN validation-1.3.16), Schematron XRechnung 3.0.2 (Regeln 2.6.0) |
| KoSIT-Konfiguration | validator-configuration-xrechnung v2026-08-31, CII-Szenarien | XRechnung-XML und eingebettete EN-16931-XML |
| Mustang-CLI | 2.26.0 | ZUGFeRD-/Factur-X-Struktur, XML-Schema, Schematron EN 16931 und XRechnung |
| veraPDF (in Mustang) | mit Mustang 2.26.0 | PDF/A-3b |
| Java | openjdk version "21.0.11" 2026-04-21 | |

## Ergebnisse

Spalten: XRechnung-XML (KoSIT, Mustang), ZUGFeRD-PDF (KoSIT auf der eingebetteten XML, Mustang, veraPDF).

| Prüffall | XML KoSIT | XML Mustang | PDF-XML KoSIT | PDF Mustang | PDF/A | bestanden | Hinweise |
| --- | --- | --- | --- | --- | --- | --- | --- |
| ausfuhr | angenommen | valid | angenommen | valid | PDF/A-3b konform (29022 Prüfungen) | ja | PDF: notice BR-DE-21 |
| englisch | angenommen | valid | angenommen | valid | PDF/A-3b konform (28959 Prüfungen) | ja | PDF: notice BR-DE-21 |
| fremdwaehrung-chf-inland | angenommen | valid | angenommen | valid | PDF/A-3b konform (2050 Prüfungen) | ja | PDF: notice BR-DE-21 |
| fremdwaehrung-usd | angenommen | valid | angenommen | valid | PDF/A-3b konform (1976 Prüfungen) | ja | PDF: notice BR-DE-21 |
| gemischte-steuersaetze | angenommen | valid | angenommen | valid | PDF/A-3b konform (30069 Prüfungen) | ja | PDF: notice BR-DE-21 |
| geschenk | angenommen | valid | angenommen | valid | PDF/A-3b konform (2238 Prüfungen) | ja | PDF: notice BR-DE-21 |
| innergemeinschaftlich | angenommen | valid | angenommen | valid | PDF/A-3b konform (29038 Prüfungen) | ja | PDF: notice BR-DE-21 |
| kleinunternehmer | angenommen | valid | angenommen | valid | PDF/A-3b konform (28961 Prüfungen) | ja | PDF: notice BR-DE-21 |
| korrektur-negative-menge | angenommen | valid | angenommen | valid | PDF/A-3b konform (2022 Prüfungen) | ja | PDF: notice BR-DE-21 |
| korrektur-negativer-preis | angenommen | valid | angenommen | valid | PDF/A-3b konform (2242 Prüfungen) | ja | PDF: notice BR-DE-21 |
| leistungszeitraum | angenommen | valid | angenommen | valid | PDF/A-3b konform (29061 Prüfungen) | ja | PDF: notice BR-DE-21, PDF: warning PEPPOL-EN16931-R008 |
| mehrseitig | angenommen | valid | angenommen | valid | PDF/A-3b konform (37715 Prüfungen) | ja | PDF: notice BR-DE-21 |
| nicht-steuerbar | angenommen | valid | angenommen | valid | PDF/A-3b konform (29024 Prüfungen) | ja | PDF: notice BR-DE-21 |
| nullbetrag | angenommen | valid | angenommen | valid | PDF/A-3b konform (1971 Prüfungen) | ja | PDF: notice BR-DE-21 |
| reverse-charge | angenommen | valid | angenommen | valid | PDF/A-3b konform (29029 Prüfungen) | ja | PDF: notice BR-DE-21 |
| skonto | angenommen | valid | angenommen | valid | PDF/A-3b konform (29035 Prüfungen) | ja | PDF: notice BR-DE-21 |
| standard | angenommen | valid | angenommen | valid | PDF/A-3b konform (28999 Prüfungen) | ja | PDF: notice BR-DE-21 |
| steuerfrei | angenommen | valid | angenommen | valid | PDF/A-3b konform (28961 Prüfungen) | ja | PDF: notice BR-DE-21 |
| werbezweck-kleinunternehmer | angenommen | valid | angenommen | valid | PDF/A-3b konform (1960 Prüfungen) | ja | PDF: notice BR-DE-21 |
| zahlung-bar | angenommen | valid | angenommen | valid | PDF/A-3b konform (1946 Prüfungen) | ja | PDF: notice BR-DE-21 |
| zahlung-karte | angenommen | valid | angenommen | valid | PDF/A-3b konform (1946 Prüfungen) | ja | PDF: notice BR-DE-21 |
| zahlung-ueberweisung | angenommen | valid | angenommen | valid | PDF/A-3b konform (1986 Prüfungen) | ja | PDF: notice BR-DE-21 |

Hinweise vom Typ `notice BR-DE-21` bei PDFs sind erwartet: Die eingebettete XML deklariert bewusst das Profil EN 16931 (ZUGFeRD), nicht XRechnung.

## Prüfsummen der geprüften Dateien

| Datei | SHA-256 |
| --- | --- |
| ausfuhr.pdf | `a06f4d978314451e3d137d6e7d83a4ecc4fdcd370003f1ccd51569595cc61f8b` |
| ausfuhr.xml | `6ae99d46f50b8827aabea6d94e5ec91dd06a619a2439172e269faca1e1dbe8f5` |
| englisch.pdf | `baab6d4bf58a58cca7fef57f475020ad5c53c6ee2c6e1672c6aca46b6211a52b` |
| englisch.xml | `3698b16a97500ad7deefbd3371c9e10b619e1d51f7733c02738e9a80d7a68d6f` |
| fremdwaehrung-chf-inland.pdf | `a9bde92dae8d075a023872c2bd0ec84d612047b123efdb1573b22d225818460f` |
| fremdwaehrung-chf-inland.xml | `456b329fd186c8d42217b13174478d42dafe4aa0a249b4f44c24f402c024f0f3` |
| fremdwaehrung-usd.pdf | `96580fe028d7ea9e91a2ef3ab74133f96ce53bf6de58bff537773022f280fca0` |
| fremdwaehrung-usd.xml | `e29583ffd991475d210d58a6ab8be5995dd56dc09350ceab8123b50be1f236b3` |
| gemischte-steuersaetze.pdf | `54f62b27e68267d222a8c2224ac3242e87ae64eacbcf5e81101a0d7faf5b8e1a` |
| gemischte-steuersaetze.xml | `f7152f946c76be9ed737d06b574ba2e2f39beb963080169b67dafb3c82e6d9e0` |
| geschenk.pdf | `bea8c4ce72a3440d584e9e0884ff14235d144a31286e41c5dc7aeee96eaf3654` |
| geschenk.xml | `8cda344dc5faaf196859e9b95675b245c6330f3e60dbe06a7c11c2a89fbf4fec` |
| innergemeinschaftlich.pdf | `f0e457e7f23c8e3ea0fb94fbcc34fc3980a9c8129a1b9426aa53b3a96fa3bc35` |
| innergemeinschaftlich.xml | `4ca9875381415a326454f8504ca5391fb25b286b848a8af6647e0e7d5fc14a39` |
| kleinunternehmer.pdf | `45d284eb2731c39e7082cc618c22c32d7500fbc7dc70b0b1dd017acc5902d88b` |
| kleinunternehmer.xml | `736f6e316ae795f25b0bf6c6725524758a390bebb7088d2aa82f5dbf8bfd219f` |
| korrektur-negative-menge.pdf | `a2f5ed79c4ae05b9153642c3b77ea05d0785d41383e2c2bcc5318d2d978da180` |
| korrektur-negative-menge.xml | `479a552a4c4b210c20c9bf3d399be1f52db6aabf586582ec26c0d07f110da428` |
| korrektur-negativer-preis.pdf | `63403e2bae94e5d422b85ede83ac1099d8b9f9ee2f901d3fe44af33300d46132` |
| korrektur-negativer-preis.xml | `353391318c04220d9e7859e268224767a938587372082b5b90117f351aa65e18` |
| leistungszeitraum.pdf | `f3fc2e2c30aee4309d6e912fa74c9679b6b8ac199891131612bc7893f0e1d1b4` |
| leistungszeitraum.xml | `2d6040f101871a53343430c71291eb16a0b8c3e7c749ec12122a0dbaa9dc64ea` |
| mehrseitig.pdf | `f1dd10ac5bd2b7b766d4065326c1fabfc203ea4c21681a3d10287f28f92c9079` |
| mehrseitig.xml | `ce4a4ad2aff5c3cec3637149a707652eb9b808c3dfee74ed9cf809503883c384` |
| nicht-steuerbar.pdf | `c312924917a55d7efecda872402a91d29eab05247dfc2d0fbad0568a26bde970` |
| nicht-steuerbar.xml | `4b0a8d988dac071cca228d6a02c6e23a54e0770790c890109aaccbc351ec8c7a` |
| nullbetrag.pdf | `6ec8bdf59a8c28ed8ca5bb6bde9372d7811687688a3156c210810aa86e92a607` |
| nullbetrag.xml | `49f9a361d1e72a3cc6518f2b79eef6a61b9eb577a08b807bde255a10413665ef` |
| reverse-charge.pdf | `63095bae4b47ae8d949e59f29f8de8db28005366a16eb0e4da810960aae221e7` |
| reverse-charge.xml | `ffed45db2e18439ac61d71d6a979274d76a89469f61d5654a52992ce73c2c946` |
| skonto.pdf | `1fd39a876064f1eaa09577ee9fdb68d7ec5fd0948941f1e055452537230f94ca` |
| skonto.xml | `687495a96237c0c2a6216f8714012e756f3bdc017ee1a66e219d96f5733d2aa1` |
| standard.pdf | `4c2f1b3d1db0e0c57a078a528f41e7962c0284cf235c7da8e2acbd5795a7d3b6` |
| standard.xml | `3698b16a97500ad7deefbd3371c9e10b619e1d51f7733c02738e9a80d7a68d6f` |
| steuerfrei.pdf | `f763f9bfaeae83ad2385d29e9182a02b812653593364824eecf1b2c0d50dd587` |
| steuerfrei.xml | `8fa09184b639f5f98efc47b69039993c909975556b81ef35a334e6347d6e3e52` |
| werbezweck-kleinunternehmer.pdf | `57276e3016ba0baa3080018e3e6aca047be58fabf6f4a1ae4684664c4f381f97` |
| werbezweck-kleinunternehmer.xml | `242335330e7c39d90e1f71147f78c2556d99749c3f3d6fa04e5c2af84f21edac` |
| zahlung-bar.pdf | `b073aab8374a7b8550d81c622915b2b1129a8463021ea368b43f49d02b1078b9` |
| zahlung-bar.xml | `55e3f9432fb1c5d5a43839ff1a5e74a092fc815f04aeb34fcd152f2615b784b3` |
| zahlung-karte.pdf | `68a1ef5288459dcea0ec997089effd11ed1ba4149c3ff063ebf849a647d74b8c` |
| zahlung-karte.xml | `7b94b69bc2f17e0668a7d16cb5db7c34c5da5980ca8aff7a76686a9c9a282851` |
| zahlung-ueberweisung.pdf | `50120fa55fb2a4a1dad58c0d4225ff646f9a9093fe015c87282f7de0502594dc` |
| zahlung-ueberweisung.xml | `aaff37567464a79b80af739dd4b51ca79acca48d640595f626358223bae885b4` |

