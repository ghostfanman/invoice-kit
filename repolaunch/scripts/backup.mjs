// Konsistentes Online-Backup der SQLite-Datenbank mit dem eingebauten node:sqlite (ohne sqlite3-CLI).
//   node scripts/backup.mjs <quelle.sqlite> <ziel.sqlite>
import { backup, DatabaseSync } from "node:sqlite";

const [src, dest] = process.argv.slice(2);
if (!src || !dest) {
  console.error("Aufruf: node scripts/backup.mjs <quelle.sqlite> <ziel.sqlite>");
  process.exit(2);
}
const db = new DatabaseSync(src, { readOnly: true });
const pages = await backup(db, dest);
db.close();
const copy = new DatabaseSync(dest, { readOnly: true });
const check = copy.prepare("PRAGMA integrity_check").get();
copy.close();
console.log(`Backup ${dest}: ${pages} Seiten, integrity_check=${check.integrity_check}`);
if (check.integrity_check !== "ok") process.exit(1);
