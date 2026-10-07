# Roadmap: nur Architektur, noch nicht implementiert

Diese Punkte folgen erst nach Pilotvalidierung (siehe [validation-plan.md](validation-plan.md)).

## GitHub App für ausgewählte Repositories

- Installation nur auf vom Nutzer ausgewählten Repositories, minimale Rechte: `Metadata: read`, `Contents: read`; für Vorschläge zusätzlich `Contents: write` und `Pull requests: write`, getrennt aktivierbar.
- Installations-Token kurzlebig, serverseitig, nie im Browser.
- Der vorhandene `GitHubHttp`-Client bleibt; nur die Token-Quelle ändert sich.

## Vorschläge als geprüfte Pull Requests

- Ein Branch je Vorschlag, eine Datei je Befund (z. B. `SECURITY.md`, README-Abschnitt), mit Verweis auf Befund-ID und Belege.
- Ungeprüfte Stellen bleiben im PR-Text markiert. Nie automatisches Merge; der Maintainer entscheidet.

## Wiederkehrende Scans

- Geplante Audits je Repository, Vergleich der Befund-IDs zwischen Commits (neu erfüllt, neu fehlend, unbekannt geworden).
- Auslöser auch bei neuen Releases (Webhook `release`), nicht nur zeitgesteuert.
- Voraussetzung: dauerhafte Speicherung mit Einwilligung und Konto; aktuelle TTL-Logik bleibt für anonyme Audits.

## Repository-Traffic

- Nur mit gesonderter Autorisierung des Owners und den dafür nötigen Rechten (Traffic-Endpunkte erfordern Push-Zugriff).
- GitHub liefert nur ein kurzes Zeitfenster (derzeit 14 Tage). Historische Verläufe entstehen nur durch fortlaufende autorisierte Erfassung, täglich gespeichert.
- Fehlende Tage werden als "unbekannt" geführt, nie als null.

## Website- und Umsatzmetriken

- Nur vom Kunden freiwillig verbundene Quellen (z. B. Analytics-Export, Zahlungsanbieter-Report), mit klarer Zweckbindung.
- Keine GitHub-interne UTM-Attribution und keine individuelle Besucheridentität. Aussagen bleiben aggregiert und als Korrelation gekennzeichnet.

## Abrechnung, Teams, private Repositories

- Erst nach bestandenem Investitionskriterium (mindestens drei bezahlte Pilotpakete).
- Private Repositories nur über die GitHub App, mit gesonderter Datenverarbeitungsvereinbarung und ohne KI-Verarbeitung ohne erneute Zustimmung.

## Öffentliches Verzeichnis

- Erst nach nachgewiesener Nachfrage und nur mit ausdrücklicher Zustimmung des Maintainers. Keine ungefragten Profile.
