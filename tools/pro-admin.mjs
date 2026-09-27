#!/usr/bin/env node
import {generateKeyPairSync} from 'node:crypto';
import {mkdirSync,writeFileSync,readFileSync,existsSync} from 'node:fs';
import {homedir} from 'node:os';
import {resolve,join,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {importIssuer,issueLicense} from '../pro-license.js';
const root=fileURLToPath(new URL('../',import.meta.url));
const dir=resolve(process.env.INVOICE_KIT_ADMIN_DIR || join(homedir(),'.local/share/invoice-kit-admin'));
const inside=relative(root,dir);
if(!inside.startsWith('..') || dir===resolve(root))throw new Error('Private Dateien müssen außerhalb des veröffentlichten Projektordners liegen.');
const privatePath=join(dir,'admin-private.jwk');
const command=process.argv[2];
if(command==='init') {
  const {publicJwk:existing}=await import('../pro-config.js');
  if(existing || existsSync(privatePath))throw new Error('Bereits eingerichtet. Bestehende Schlüssel werden nicht überschrieben.');
  const {privateKey,publicKey}=generateKeyPairSync('ec',{namedCurve:'prime256v1'});
  const privateJwk=privateKey.export({format:'jwk'}),publicJwk=publicKey.export({format:'jwk'});
  const key=await importIssuer(privateJwk,publicJwk);
  const admin=await issueLicense(key,{recipient:process.argv[3] || 'Invoice Kit Admin',role:'admin'});
  mkdirSync(dir,{recursive:true,mode:0o700});
  writeFileSync(privatePath,JSON.stringify(privateJwk,null,2)+'\n',{flag:'wx',mode:0o600});
  writeFileSync(join(dir,'admin.invoicekit-license'),admin+'\n',{flag:'wx',mode:0o600});
  writeFileSync(join(root,'pro-config.js'),'// Öffentlicher Prüfschlüssel. Keine privaten Schlüsseldaten.\nexport const publicJwk = '+JSON.stringify(publicJwk,null,2)+';\n');
  console.log('Admin eingerichtet. Private Dateien:',dir);
} else if(command==='gift' || command==='admin') {
  const {publicJwk}=await import('../pro-config.js');
  const key=await importIssuer(JSON.parse(readFileSync(privatePath,'utf8')),publicJwk);
  const recipient=process.argv[3];if(!recipient)throw new Error('Name fehlt: node tools/pro-admin.mjs gift "Kundenname"');
  const token=await issueLicense(key,{recipient,role:command==='admin'?'admin':'gift'});
  const filename=`${command}-${crypto.randomUUID()}.invoicekit-license`;
  writeFileSync(join(dir,filename),token+'\n',{flag:'wx',mode:0o600});
  console.log('Lizenz erstellt:',join(dir,filename));
} else {
  console.log('Einrichten: node tools/pro-admin.mjs init "Admin-Name"\nVerschenken: node tools/pro-admin.mjs gift "Kundenname"\nAdmin-Lizenz: node tools/pro-admin.mjs admin "Admin-Name"');
}
