# Betrieb mit Docker oder auf einem VPS

RepoLaunch läuft als genau ein Prozess mit einem Worker und einer SQLite-Datei. Nicht horizontal skalieren und nicht auf serverlosen Plattformen betreiben.

## Docker

```sh
git clone https://github.com/ghostfanman/repolaunch.git && cd repolaunch
cp .env.example .env          # Werte setzen, insbesondere optional GITHUB_TOKEN und KI-Variablen
mkdir -p data && sudo chown 1000:1000 data   # Container läuft als Benutzer "node" (UID 1000)
docker compose up -d --build
curl -s http://127.0.0.1:3000/api/health
```

- Persistentes Datenverzeichnis: `./data` auf dem Host, `/data` im Container (`REPOLAUNCH_DATA_DIR`).
- Der Port ist nur an `127.0.0.1` gebunden. Davor gehört ein Reverse Proxy mit TLS.
- `TRUST_PROXY_HOPS=1` ist in `docker-compose.yml` gesetzt, damit die Ratenbegrenzung pro Client wirkt. Nur korrekt, wenn genau ein Proxy davor steht und dieser `X-Forwarded-For` setzt.
- Healthcheck: `GET /api/health`.

## VPS ohne Docker

```sh
# Node.js 24 LTS installieren, dann:
git clone https://github.com/ghostfanman/repolaunch.git /opt/repolaunch
cd /opt/repolaunch
npm ci && npm run build
cp -r .next/static .next/standalone/.next/static
```

systemd-Unit (Beispiel `/etc/systemd/system/repolaunch.service`):

```ini
[Unit]
Description=RepoLaunch
After=network-online.target

[Service]
User=repolaunch
WorkingDirectory=/opt/repolaunch/.next/standalone
EnvironmentFile=/etc/repolaunch.env
Environment=NODE_ENV=production PORT=3000 HOSTNAME=127.0.0.1 REPOLAUNCH_DATA_DIR=/var/lib/repolaunch
ExecStart=/usr/bin/node server.js
Restart=on-failure
NoNewPrivileges=true
ProtectSystem=strict
ReadWritePaths=/var/lib/repolaunch
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

Reverse Proxy (Caddy, Beispiel):

```text
repolaunch.example.org {
  reverse_proxy 127.0.0.1:3000
}
```

Caddy setzt `X-Forwarded-For`; dann `TRUST_PROXY_HOPS=1`.

## Ausgehender Proxy

Hinter einem Unternehmensproxy: `HTTPS_PROXY` setzen und `NODE_USE_ENV_PROXY=1` (Node ab 22.21 bzw. 24.5). Erreichbar sein müssen nur `api.github.com` und, falls KI aktiv, `api.anthropic.com`.

## Backup und Wiederherstellung

Die Datenbank liegt in `REPOLAUNCH_DATA_DIR/repolaunch.sqlite` (WAL-Modus, zusätzlich `-wal` und `-shm`).

Konsistentes Online-Backup bei laufendem Dienst mit dem mitgelieferten Skript (nutzt `node:sqlite`, kein `sqlite3` nötig, prüft danach `PRAGMA integrity_check`):

```sh
# VPS
node /opt/repolaunch/scripts/backup.mjs /var/lib/repolaunch/repolaunch.sqlite /var/backups/repolaunch/repolaunch-$(date +%F).sqlite
# Docker (Ziel liegt im gemounteten ./data)
docker compose exec repolaunch node scripts/backup.mjs /data/repolaunch.sqlite /data/backup-$(date +%F).sqlite
# Alte Backups entfernen
find /var/backups/repolaunch -name 'repolaunch-*.sqlite' -mtime +7 -delete
```

Alternativ mit dem SQLite-Kommandozeilenwerkzeug: `sqlite3 repolaunch.sqlite ".backup 'ziel.sqlite'"`.

Alternativ Dienst stoppen und alle drei Dateien kopieren. Wiederherstellung: Dienst stoppen, Datei zurückkopieren, Dienst starten. Beim Start nimmt der Worker unterbrochene Aufträge wieder auf oder beendet sie nach `MAX_JOB_ATTEMPTS` mit `interrupted`.

Backups enthalten personenbezogene Nutzerangaben bis zu deren Ablauf; Aufbewahrung kurz halten (siehe [data-retention.md](data-retention.md)).

## Aktualisierung

```sh
cd /opt/repolaunch && git pull && npm ci && npm run build && cp -r .next/static .next/standalone/.next/static && sudo systemctl restart repolaunch
```

Schemaänderungen laufen beim Start automatisch (Tabelle `meta`, Schlüssel `schema_version`). Vor jeder Aktualisierung ein Backup ziehen.

## Überwachung

- `GET /api/health` liefert `ok`, aktive Aufträge, KI-Anbieter und Demo-Modus.
- Logs sind JSON-Zeilen auf stdout (`journalctl -u repolaunch` bzw. `docker compose logs`).
- Häufige `rate_limited`-Fehler: `GITHUB_TOKEN` (ohne Scopes) setzen.
