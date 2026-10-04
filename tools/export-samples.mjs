// Erzeugt die echten Exportdateien (XRechnung-XML und ZUGFeRD-PDF) für alle Prüffälle über Chromium.
// Aufruf: node tools/export-samples.mjs [Zielordner]  (vorher den lokalen HTTP-Server starten)
import {spawn} from 'node:child_process';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {invoice} from '../test/fixture.js';

const out=process.argv[2] || '.test-artifacts/exports';
const origin=process.env.INVOICE_KIT_TEST_ORIGIN || 'http://127.0.0.1:8765';

const many=Array.from({length:45},(_,i)=>({desc:`Position ${i+1} mit längerer Beschreibung für den Seitenumbruch`,qty:String(i%3+1),price:String(10+i*1.37),rate:i%2?'7':'19',unit:'C62'}));
export const CASES={
  'standard':invoice(),
  'gemischte-steuersaetze':invoice({items:[{desc:'Beratung',qty:'2.5',price:'80',rate:'19',unit:'HUR'},{desc:'Buch',qty:'3',price:'0.335',rate:'7',unit:'C62'},{desc:'Porto',qty:'1',price:'0',rate:'0',unit:'LS'}]}),
  'kleinunternehmer':invoice({taxCase:'KU',vatId:'',taxNo:'12/345/67890'}),
  'steuerfrei':invoice({taxCase:'EX',exReason:'Steuerfreie Heilbehandlung nach § 4 Nr. 14 UStG'}),
  'reverse-charge':invoice({taxCase:'AE',toCountry:'AT',toZip:'1010',toCity:'Wien',toVatId:'ATU12345678'}),
  'innergemeinschaftlich':invoice({taxCase:'K',toCountry:'FR',toZip:'75001',toCity:'Paris',toVatId:'FR12345678901'}),
  'ausfuhr':invoice({taxCase:'G',toCountry:'CH',toZip:'8001',toCity:'Zürich'}),
  'nicht-steuerbar':invoice({taxCase:'O',toCountry:'US',toZip:'10001',toCity:'New York'}),
  'korrektur-negative-menge':invoice({docType:'384',refNum:'2026-000',refDate:'2026-09-01',items:[{desc:'Gutschrift Beratung',qty:'-1',price:'100',rate:'19',unit:'HUR'}]}),
  'korrektur-negativer-preis':invoice({docType:'384',refNum:'2026-000',refDate:'2026-09-01',items:[{desc:'Preisminderung',qty:'2',price:'-15.5',rate:'19',unit:'C62'},{desc:'Nachberechnung',qty:'1',price:'10',rate:'7',unit:'C62'}]}),
  'nullbetrag':invoice({items:[{desc:'Kostenlose Erstberatung',qty:'1',price:'0',rate:'19',unit:'HUR'}]}),
  'geschenk':invoice({free:'gift',items:[{desc:'A',qty:'3',price:'0.335',rate:'19',unit:'C62'},{desc:'B',qty:'2',price:'10',rate:'7',unit:'C62'}]}),
  'werbezweck-kleinunternehmer':invoice({free:'promo',taxCase:'KU',vatId:'',taxNo:'12/345/67890'}),
  'skonto':invoice({skonto:'2',skontoDays:'7',due:'30'}),
  'fremdwaehrung-usd':invoice({cur:'USD',fx:'0.92',paymentMeans:'30',toCountry:'US',toZip:'10001',toCity:'New York',taxCase:'O'}),
  'fremdwaehrung-chf-inland':invoice({cur:'CHF',fx:'1.05',paymentMeans:'30'}),
  'zahlung-ueberweisung':invoice({paymentMeans:'30'}),
  'zahlung-karte':invoice({paymentMeans:'48',cardLast4:'1234'}),
  'zahlung-bar':invoice({paymentMeans:'10'}),
  'leistungszeitraum':invoice({serviceDate:'2026-09-01',serviceEnd:'2026-09-30',buyerRef:'04011000-12345-67',note:'Vielen Dank für Ihren Auftrag.'}),
  'englisch':invoice({lang:'en'}),
  'mehrseitig':invoice({items:many}),
};

if(import.meta.url===`file://${process.argv[1]}`){
  rmSync(out,{recursive:true,force:true});mkdirSync(out,{recursive:true});
  const profile=mkdtempSync(join(tmpdir(),'invoice-kit-export-'));
  const port=String(10000+Math.floor(Math.random()*40000));
  const chrome=spawn(process.env.CHROMIUM || 'chromium',['--headless','--no-sandbox','--disable-dev-shm-usage','--no-first-run',`--user-data-dir=${profile}`,`--remote-debugging-port=${port}`,'about:blank'],{stdio:'ignore',detached:true});
  const pause=ms=>new Promise(r=>setTimeout(r,ms));
  let ws;const pending=new Map();let id=0;
  try{
    let target;
    for(let i=0;i<100;i++){try{target=await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`,{method:'PUT'})).json();break}catch{await pause(100)}}
    if(!target)throw new Error('Chromium konnte nicht gestartet werden');
    ws=new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((ok,err)=>{ws.onopen=ok;ws.onerror=err});
    ws.onmessage=e=>{const m=JSON.parse(e.data);const p=m.id&&pending.get(m.id);if(!p)return;pending.delete(m.id);m.error?p.reject(new Error(JSON.stringify(m.error))):p.resolve(m.result)};
    const cmd=(method,params={})=>new Promise((resolve,reject)=>{const key=++id;pending.set(key,{resolve,reject});ws.send(JSON.stringify({id:key,method,params}))});
    const evaluate=async expression=>{const r=await cmd('Runtime.evaluate',{expression,replMode:true,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value};
    await cmd('Runtime.enable');await cmd('Page.navigate',{url:origin+'/'});
    for(let i=0;i<100;i++){await pause(50);try{if(await evaluate('document.readyState==="complete"'))break}catch{}}
    await evaluate(`window.g=await import("./generator.js");for(const src of ['vendor/pdf-lib.min.js','vendor/fontkit.umd.min.js','vendor/fonts.js'])await new Promise((ok,err)=>{const s=document.createElement('script');s.src=src;s.onload=ok;s.onerror=err;document.head.append(s)});window.z=await import('./zugferd.js')`);
    for(const [name,s] of Object.entries(CASES)){
      const r=await evaluate(`await (async()=>{const s=${JSON.stringify(s)};g.load(s);if(!g.check())throw new Error('Formularprüfung: '+document.getElementById('msg').textContent);const st=g.state();
        const pdf=await z.buildZugferd(st,g.view(st),g.buildXML(st,'en16931'),g.qrMatrix);return {xml:g.buildXML(st),pdf:Array.from(pdf)}})()`);
      writeFileSync(join(out,`${name}.xml`),r.xml);writeFileSync(join(out,`${name}.pdf`),Buffer.from(r.pdf));
      console.log(`${name}: XML ${r.xml.length} Zeichen, PDF ${r.pdf.length} Bytes`);
    }
  }finally{ws?.close();try{process.kill(-chrome.pid,'SIGTERM')}catch{chrome.kill()}await new Promise(ok=>{if(chrome.exitCode!==null)ok();else{chrome.once("exit",ok);setTimeout(ok,10000)}});try{rmSync(profile,{recursive:true,force:true,maxRetries:10,retryDelay:200})}catch{/* Chromium-Hilfsprozesse schreiben noch: temporäres Profil bleibt liegen */}}
}
