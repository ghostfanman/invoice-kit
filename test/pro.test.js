import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {importIssuer,issueLicense,verifyLicense,activeLabel} from '../pro-license.js';
import {emptyLibrary,addEntry,validateLibrary,customerFromInvoice} from '../pro-data.js';
import {clearDrafts,clearInvoiceData} from '../storage.js';
import {invoice} from './fixture.js';
function pair(){const k=generateKeyPairSync('ec',{namedCurve:'prime256v1'});return {privateJwk:k.privateKey.export({format:'jwk'}),publicJwk:k.publicKey.export({format:'jwk'})}}
const keys=pair(),issuer=await importIssuer(keys.privateJwk,keys.publicJwk);
test('Pro: gültige Admin- und Geschenk-Lizenzen',async()=>{
  for(const role of ['admin','gift']){const token=await issueLicense(issuer,{recipient:'Kunde Ä & <Test>',role});const claims=await verifyLicense(token,keys.publicJwk);assert.equal(claims.role,role);assert.equal(claims.recipient,'Kunde Ä & <Test>');assert.equal(claims.expiresAt,null)}
});
test('Pro: Manipulation, fremder Herausgeber und Rollenänderung werden abgelehnt',async()=>{
  const token=await issueLicense(issuer,{recipient:'Kunde'}),parts=token.split('.');
  const altered=JSON.parse(Buffer.from(parts[1],'base64url'));altered.role='admin';parts[1]=Buffer.from(JSON.stringify(altered)).toString('base64url');
  await assert.rejects(verifyLicense(parts.join('.'),keys.publicJwk));
  await assert.rejects(verifyLicense(token,pair().publicJwk));
  await assert.rejects(importIssuer(pair().privateJwk,keys.publicJwk));
  for(const invalid of ['', 'true', 'IKPRO1.a.a', 'x'.repeat(9000),token+'.extra'])await assert.rejects(verifyLicense(invalid,keys.publicJwk));
});
test('Pro: Anzeigetext für aktives Pro',()=>{
  const claims={recipient:'Kunde Ä',expiresAt:null};
  assert.equal(activeLabel(claims),'Pro aktiv für Kunde Ä');
  // Ablaufdatum wie in admin.js: Mitternacht UTC nach dem gewählten Tag, angezeigt wird der gewählte Tag.
  const expiresAt=Date.parse('2026-10-01T00:00:00Z');
  assert.equal(activeLabel({...claims,expiresAt},expiresAt-1),'Pro aktiv für Kunde Ä, gültig bis 30.9.2026');
  assert.equal(activeLabel({...claims,expiresAt},expiresAt),null);
  assert.equal(activeLabel(null),null);
});
test('Pro: Ablauf und zukünftiges Ausstellungsdatum',async()=>{
  const now=Date.now(),token=await issueLicense(issuer,{recipient:'Kunde',expiresAt:now+1000},now);
  assert.equal((await verifyLicense(token,keys.publicJwk,now+999)).role,'gift');
  await assert.rejects(verifyLicense(token,keys.publicJwk,now+1000),/abgelaufen/);
  await assert.rejects(verifyLicense(token,keys.publicJwk,now-600000));
  await assert.rejects(issueLicense(issuer,{recipient:'Kunde',expiresAt:now-1},now));
  await assert.rejects(issueLicense(issuer,{recipient:'  '}));
});
test('Pro: importierter Admin-Schlüssel ist nicht wieder exportierbar',async()=>{
  assert.equal(issuer.extractable,false);await assert.rejects(crypto.subtle.exportKey('jwk',issuer));
});
test('Pro: Kunden enthalten keine fremden Rechnungs- oder Bankdaten',()=>{
  const customer=customerFromInvoice(invoice());assert.equal(customer.to,'Testkunde');assert.equal(customer.iban,undefined);assert.equal(customer.items,undefined);assert.equal(customer.from,undefined);
});
test('Pro: Bibliothek kopiert Daten und importiert nur unterstützte Strukturen',()=>{
  const original=emptyLibrary(),s=invoice();let next=addEntry(original,'customers','Testkunde',customerFromInvoice(s));next=addEntry(next,'articles','Beratung',s.items[0]);next=addEntry(next,'archive','Rechnung',s);
  s.items[0].price=1000;assert.equal(next.archive[0].data.items[0].price,'100');assert.equal(original.customers.length,0);
  assert.deepEqual(validateLibrary(JSON.parse(JSON.stringify(next))),next);
  assert.throws(()=>validateLibrary({version:2}));assert.throws(()=>validateLibrary({...next,customers:[next.customers[0],next.customers[0]]}));assert.throws(()=>validateLibrary({...next,archive:[{id:'a',label:'a',data:{}}]}));
});
test('Pro: Entwurf abwählen erhält Pro-Lizenz; Gesamtlöschung entfernt sie',()=>{
  const data=new Map([['invoice-kit-v3','draft'],['invoice-kit-pro-license','signed'],['invoice-kit-pro-data','data'],['foreign','keep']]);
  const storage={get length(){return data.size},key:i=>[...data.keys()][i],removeItem:k=>data.delete(k)};
  clearDrafts(storage);assert.equal(data.has('invoice-kit-v3'),false);assert.equal(data.get('invoice-kit-pro-license'),'signed');
  clearInvoiceData(storage);assert.deepEqual([...data],[['foreign','keep']]);
});
test('Pro: veröffentlichte Konfiguration enthält keinen privaten Schlüssel',async()=>{
  const {publicJwk}=await import('../pro-config.js');assert.equal(publicJwk.kty,'EC');assert.equal(publicJwk.crv,'P-256');assert.equal(publicJwk.d,undefined);
  const source=readFileSync(new URL('../admin.html',import.meta.url),'utf8');assert.ok(source.includes("connect-src 'none'"));
});
