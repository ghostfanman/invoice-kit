import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync,existsSync} from 'node:fs';
const source=readFileSync(new URL('../sw.js',import.meta.url),'utf8');
function harness(){
  const events={},deleted=[],added=[];let fetched=0,claimed=false;
  const cache={addAll:async paths=>added.push(...paths),match:async()=>({offline:true})};
  const context={URL,Set,self:{registration:{scope:'https://example.org/invoice-kit/'},addEventListener:(name,fn)=>events[name]=fn,skipWaiting:async()=>{},clients:{claim:async()=>{claimed=true}}},caches:{open:async()=>cache,keys:async()=>['invoice-kit-v2','invoice-kit-v4','invoice-kit-v7','other-app-v1','wambur-assets'],delete:async name=>deleted.push(name)},fetch:async()=>{fetched++;return {network:true}}};
  vm.runInNewContext(source,context);
  return {events,deleted,added,cache,get claimed(){return claimed},get fetched(){return fetched}};
}
test('Aktivierung löscht ausschließlich alte Invoice-Kit-Caches',async()=>{
  const h=harness();let pending;h.events.activate({waitUntil:p=>pending=p});await pending;
  assert.deepEqual(h.deleted,['invoice-kit-v2','invoice-kit-v4']);assert.ok(h.claimed);
});
test('Installation wartet auf sämtliche Offline-Abhängigkeiten',async()=>{
  const h=harness();let pending;h.events.install({waitUntil:p=>pending=p});await pending;
  for(const file of ['generator.js','core.js','viewer.js','storage.js','viewer-check.js','zugferd.js','accessibility.css','vendor/pdf-lib.min.js','vendor/fontkit.umd.min.js','vendor/fonts.js','vendor/qrcode.js'])assert.ok(h.added.includes(file),file);
  for(const file of h.added)assert.ok(existsSync(new URL('../'+file,import.meta.url)),file);
});
test('Fetch behandelt nur bekannte lokale App-Dateien, nie Rechnungs-URLs',async()=>{
  const h=harness();
  for(const url of ['https://example.org/other.html','https://example.org/invoice-kit/customer.xml','https://example.org/invoice-kit/index.html?invoice=secret','https://third.example/index.html']) {
    let intercepted=false;h.events.fetch({request:{url,method:'GET'},respondWith:()=>intercepted=true});assert.equal(intercepted,false);
  }
  let pending;h.events.fetch({request:{url:'https://example.org/invoice-kit/index.html',method:'GET'},respondWith:p=>pending=p});assert.deepEqual(await pending,{offline:true});assert.equal(h.fetched,0);
});
