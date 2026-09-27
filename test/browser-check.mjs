// Chromium-Integration ohne npm-Pakete. Vorher den lokalen HTTP-Server starten.
import {spawn} from 'node:child_process';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync,readFileSync,readdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import assert from 'node:assert/strict';
import {invoice} from './fixture.js';
const origin=process.env.INVOICE_KIT_TEST_ORIGIN || 'http://127.0.0.1:8765';
const profile=mkdtempSync(join(tmpdir(),'invoice-kit-chrome-'));
const port=process.env.INVOICE_KIT_CDP_PORT || String(10000+Math.floor(Math.random()*40000));
const chrome=spawn(process.env.CHROMIUM || 'chromium',['--headless','--no-sandbox','--disable-dev-shm-usage','--no-first-run',`--user-data-dir=${profile}`,`--remote-debugging-port=${port}`,'about:blank'],{stdio:'ignore'});
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let ws;const pending=new Map();let id=0;const browserErrors=[];
try {
  let target;
  for(let i=0;i<100;i++){try{const response=await fetch(`http://127.0.0.1:${port}/json/new?about:blank`,{method:'PUT'});target=await response.json();break}catch{await pause(100)}}
  assert.ok(target,'Chromium konnte nicht gestartet werden');
  ws=new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject});
  ws.onmessage=event=>{const m=JSON.parse(event.data);if(m.id){const p=pending.get(m.id);if(!p)return;pending.delete(m.id);clearTimeout(p.timer);m.error?p.reject(new Error(JSON.stringify(m.error))):p.resolve(m.result)}else if(m.method==='Runtime.exceptionThrown')browserErrors.push(m.params.exceptionDetails.text+': '+m.params.exceptionDetails.exception?.description)};
  const cmd=(method,params={})=>new Promise((resolve,reject)=>{const key=++id;const timer=setTimeout(()=>{pending.delete(key);reject(new Error(`Timeout: ${method}`))},30000);pending.set(key,{resolve,reject,timer});ws.send(JSON.stringify({id:key,method,params}))});
  const evaluate=async expression=>{const r=await cmd('Runtime.evaluate',{expression,replMode:true,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value};
  const go=async path=>{await cmd('Page.navigate',{url:origin+path});for(let i=0;i<100;i++){await pause(50);if(await evaluate('document.readyState === "complete"'))break}};
  await cmd('Runtime.enable');await cmd('Page.enable');await cmd('Network.enable');
  await cmd('Emulation.setDeviceMetricsOverride',{width:1440,height:1100,deviceScaleFactor:1,mobile:false});
  await go('/');
  await evaluate('window.g=await import("./generator.js")');
  assert.equal(await evaluate('localStorage.getItem("invoice-kit-v3")'),null,'Standardmäßig kein Entwurf im Speicher');
  await evaluate('await import("./pro-app.js")');
  assert.deepEqual(await evaluate('[document.getElementById("proBadge").hidden,document.getElementById("proNav").textContent,document.getElementById("proSummary").textContent]'),
    [true,'Pro aktivieren','Invoice Kit Pro: aktivieren und verwenden'],'Ohne Lizenz keine Pro-Anzeige');
  assert.deepEqual(await evaluate('[document.getElementById("proActivation").hidden,document.getElementById("proDeactivate").hidden,document.getElementById("proLicenseStatus").textContent,document.getElementById("proLicenseStatus").classList.contains("active")]'),
    [false,true,'Pro ist nicht aktiviert.',false],'Ohne Lizenz Codefeld statt Aktiv-Status');
  await evaluate(`g.load(${JSON.stringify(invoice())})`);
  assert.equal(await evaluate('g.check()'),true);
  assert.equal(await evaluate('document.querySelectorAll("#preview svg").length'),1);
  assert.deepEqual(await evaluate(`(()=>{const ids=[...document.querySelectorAll('[id]')].map(e=>e.id);return {duplicate:ids.length!==new Set(ids).size,unlabelled:[...document.querySelectorAll('input,select,textarea')].filter(e=>!e.labels?.length).map(e=>e.id),badLabels:[...document.querySelectorAll('label')].filter(e=>!e.control).map(e=>e.htmlFor)}})()`),{duplicate:false,unlabelled:[],badLabels:[]});
  await evaluate(`document.getElementById('fromMail').value='ungueltig';g.check()`);
  assert.equal(await evaluate('document.activeElement.id'),'fromMail');
  assert.equal(await evaluate('document.getElementById("fromMail").getAttribute("aria-invalid")'),'true');
  await evaluate(`g.load(${JSON.stringify(invoice())});document.getElementById('saveDraft').click()`);
  assert.equal(await evaluate('JSON.parse(localStorage.getItem("invoice-kit-v3")).num'),'2026-001');
  await evaluate(`localStorage.setItem('foreign-app','keep');document.getElementById('saveDraft').click()`);
  assert.equal(await evaluate('localStorage.getItem("invoice-kit-v3")'),null);
  await evaluate(`document.getElementById('saveDraft').click();document.getElementById('clearData').click()`);
  assert.equal(await evaluate('localStorage.getItem("invoice-kit-storage-enabled")'),null);
  assert.equal(await evaluate('localStorage.getItem("foreign-app")'),'keep');
  const variants=[];
  for(const paymentMeans of ['58','30','48','10']) {
    const s=invoice({paymentMeans,cardLast4:'1234'});await evaluate(`g.load(${JSON.stringify(s)})`);
    const xml=await evaluate('g.buildXML(g.state())');assert.ok(xml.includes(`<ram:TypeCode>${paymentMeans}</ram:TypeCode>`));
    assert.equal(xml.includes('<ram:IBANID>'),['58','30'].includes(paymentMeans));
    assert.equal(xml.includes('<ram:ApplicableTradeSettlementFinancialCard>'),paymentMeans==='48');
    assert.equal(await evaluate('document.querySelectorAll("#preview svg").length'),paymentMeans==='58'?1:0);
    assert.ok(await evaluate(`document.getElementById('preview').textContent.includes(${JSON.stringify({'58':'SEPA-Überweisung','30':'Überweisung','48':'Kartenzahlung','10':'Barzahlung'}[paymentMeans])})`));
    variants.push(xml);
  }
  for(const taxCase of ['S','KU','EX','AE','K','G','O'])for(const lang of ['de','en','fr','it','es','nl','pl']){
    const s=invoice({taxCase,lang,exReason:'Steuerbefreit',toVatId:'ATU12345678',toCountry:'AT'});
    variants.push(await evaluate(`g.buildXML(${JSON.stringify(s)})`));
  }
  for(const extra of [{cur:'USD',fx:'0.92',paymentMeans:'30'},{docType:'384',refNum:'alt',refDate:'2026-09-01',items:[{desc:'Korrektur',qty:1,price:-100,rate:19,unit:'C62'}]},{skonto:'2',skontoDays:'7',serviceEnd:'2026-09-30'}])variants.push(await evaluate(`g.buildXML(${JSON.stringify(invoice(extra))})`));
  await evaluate(`g.load(${JSON.stringify(invoice())});await navigator.serviceWorker.ready`);
  mkdirSync('.test-artifacts',{recursive:true});
  writeFileSync('.test-artifacts/generator.png',Buffer.from((await cmd('Page.captureScreenshot',{format:'png',captureBeyondViewport:false})).data,'base64'));
  await cmd('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  assert.ok(await evaluate('document.documentElement.scrollWidth<=390'),'Mobile Breite: '+JSON.stringify(await evaluate(`({width:document.documentElement.scrollWidth,inner:innerWidth,overflow:[...document.querySelectorAll('body *')].filter(e=>e.getBoundingClientRect().right>395&&!e.closest('.table-scroll')).slice(0,20).map(e=>[e.tagName,e.id,e.className,e.getBoundingClientRect().width])})`)));
  writeFileSync('.test-artifacts/generator-mobil.png',Buffer.from((await cmd('Page.captureScreenshot',{format:'png'})).data,'base64'));
  await cmd('Emulation.setDeviceMetricsOverride',{width:1440,height:1100,deviceScaleFactor:1,mobile:false});
  // Mehrseitiges PDF, danach identische XML aus dem Anhang zurücklesen.
  const large=invoice({items:Array.from({length:35},(_,i)=>({desc:`Beratung Position ${i+1}`,qty:1,price:100,rate:i%2?7:19,unit:'HUR'}))});
  const pdfResult=await evaluate(`await (async()=>{
    for(const src of ['vendor/pdf-lib.min.js','vendor/fontkit.umd.min.js','vendor/fonts.js'])await new Promise((ok,err)=>{const s=document.createElement('script');s.src=src;s.onload=ok;s.onerror=err;document.head.append(s)});
    const s=${JSON.stringify(large)},xml=g.buildXML(s,'en16931');
    const {buildZugferd}=await import('./zugferd.js');const bytes=await buildZugferd(s,g.view(s),xml,g.qrMatrix);
    const doc=await PDFLib.PDFDocument.load(bytes);return {bytes:Array.from(bytes),xml,pages:doc.getPageCount()};
  })()`);
  assert.ok(pdfResult.pages>1,`PDF: ${pdfResult.pages} Seiten, ${pdfResult.bytes.length} Bytes, XML-Positionen ${(pdfResult.xml.match(/IncludedSupplyChainTradeLineItem>/g)||[]).length/2}`);writeFileSync('.test-artifacts/rechnung.pdf',Buffer.from(pdfResult.bytes));writeFileSync('.test-artifacts/rechnung.xml',pdfResult.xml);
  // Vorhandene Legacy-Entwürfe werden geladen, ohne Opt-in neu zu speichern.
  await evaluate(`localStorage.setItem('invoice-kit-v2',JSON.stringify(${JSON.stringify(invoice({num:'ALT-002'}))}));location.reload()`);
  await pause(300);await evaluate('window.g=await import("./generator.js")');assert.equal(await evaluate('document.getElementById("num").value'),'ALT-002');assert.equal(await evaluate('document.getElementById("saveDraft").checked'),false);
  await go('/anzeigen.html');await evaluate('window.v=await import("./viewer.js");window.vc=await import("./viewer-check.js")');
  const results=await evaluate(`(${JSON.stringify(variants)}).map(xml=>vc.checks(v.parseXml(xml)).filter(c=>c.cls==='bad'))`);assert.deepEqual(results,variants.map(()=>[]));
  await evaluate(`v.render(v.parseXml(${JSON.stringify(pdfResult.xml)}));document.getElementById('result').classList.remove('hide')`);
  const extracted=await evaluate(`(await v.xmlFromPdf(new Uint8Array(${JSON.stringify(pdfResult.bytes)}))).text`);assert.equal(extracted,pdfResult.xml);
  assert.equal(await evaluate(`await (async()=>{const doc=await PDFLib.PDFDocument.load(new Uint8Array(${JSON.stringify(pdfResult.bytes)}));doc.catalog.delete(PDFLib.PDFName.of('Names'));const bytes=await doc.save();return (await v.xmlFromPdf(bytes)).text})()`),pdfResult.xml);
  writeFileSync('.test-artifacts/viewer.png',Buffer.from((await cmd('Page.captureScreenshot',{format:'png'})).data,'base64'));
  const xss=variants[0].replace('<ram:ID>2026-001</ram:ID>','<ram:ID>&lt;img src=x onerror=alert(1)&gt;</ram:ID>').replace('20260927','&lt;img src=x onerror=alert(1)&gt;').replace('<ram:InvoiceCurrencyCode>EUR</ram:InvoiceCurrencyCode>','<ram:InvoiceCurrencyCode>&lt;img src=x onerror=alert(1)&gt;</ram:InvoiceCurrencyCode>');
  await evaluate(`v.render(v.parseXml(${JSON.stringify(xss)}))`);assert.equal(await evaluate('document.querySelectorAll("#inv img,#inv script").length'),0);
  const ubl=`<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"><cbc:ID>UBL-1</cbc:ID><cbc:IssueDate>2026-09-27</cbc:IssueDate><cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode><cac:LegalMonetaryTotal><cbc:LineExtensionAmount>0</cbc:LineExtensionAmount><cbc:TaxExclusiveAmount>0</cbc:TaxExclusiveAmount><cbc:TaxInclusiveAmount>0</cbc:TaxInclusiveAmount><cbc:PayableAmount>0</cbc:PayableAmount></cac:LegalMonetaryTotal><cac:InvoiceLine><cbc:ID>1</cbc:ID><cbc:InvoicedQuantity unitCode="C62">1</cbc:InvoicedQuantity><cbc:LineExtensionAmount>0</cbc:LineExtensionAmount><cac:Item><cbc:Name>Test</cbc:Name></cac:Item><cac:Price><cbc:PriceAmount>0</cbc:PriceAmount></cac:Price></cac:InvoiceLine></Invoice>`;
  assert.deepEqual(await evaluate(`(()=>{const x=v.parseXml(${JSON.stringify(ubl)});v.render(x);return [x.syntax,x.id,x.lines[0].price,x.totals.gross,x.totals.tax]})()`),['UBL','UBL-1',0,0,null]);
  await evaluate('document.getElementById("drop").focus()');assert.equal(await evaluate('document.activeElement.getAttribute("role")'),'button');
  // Optionale Admin-Prüfung: private Dateien bleiben außerhalb des Web-Roots.
  if(process.env.INVOICE_KIT_ADMIN_DIR){
    const adminDir=process.env.INVOICE_KIT_ADMIN_DIR,downloads=join(profile,'downloads');mkdirSync(downloads);
    await cmd('Page.setDownloadBehavior',{behavior:'allow',downloadPath:downloads});
    const waitFor=async expression=>{for(let i=0;i<100;i++){if(await evaluate(expression))return;await pause(50)}throw new Error('Pro-Bedingung nicht erfüllt: '+expression+'; '+JSON.stringify(await evaluate('({focus:document.activeElement.id,error:document.getElementById("proCodeError")?.textContent,status:document.getElementById("proStatus")?.textContent})'))) };
    const upload=async(selector,path)=>{const {root}=await cmd('DOM.getDocument');const {nodeId}=await cmd('DOM.querySelector',{nodeId:root.nodeId,selector});await cmd('DOM.setFileInputFiles',{nodeId,files:[path]})};
    await go('/admin.html');await waitFor('document.getElementById("adminKey").onchange!==null');
    assert.equal(await evaluate('document.getElementById("adminTools").hidden'),true);
    await upload('#adminKey',join(adminDir,'admin-private.jwk'));await waitFor('!document.getElementById("adminTools").hidden');
    assert.equal(await evaluate(`Object.keys(localStorage).some(k=>/private|issuer/.test(k))`),false);
    await evaluate(`document.getElementById('giftRecipient').value='Geschenkkunde Test';document.querySelector('#giftForm button').click()`);
    let giftPath;
    for(let i=0;i<100;i++){const name=readdirSync(downloads).find(n=>n.endsWith('.invoicekit-license'));if(name){giftPath=join(downloads,name);break}await pause(50)}
    assert.ok(giftPath,'Geschenk-Lizenz wurde heruntergeladen');
    const gift=readFileSync(giftPath,'utf8');
    assert.equal(await evaluate(`(await (await import('./pro-license.js')).verifyLicense(${JSON.stringify(gift)},(await import('./pro-config.js')).publicJwk)).role`),'gift');
    await evaluate(`document.getElementById('ownLicense').click()`);
    const adminTxt=join(downloads,'Admin-Lizenz.txt');
    for(let i=0;i<100&&!readdirSync(downloads).includes('Admin-Lizenz.txt');i++)await pause(50);
    const adminCode=readFileSync(adminTxt,'utf8');
    await evaluate(`document.getElementById('adminLock').click()`);assert.equal(await evaluate('document.getElementById("adminTools").hidden'),true);
    await go('/#proPanel');await evaluate('window.g=await import("./generator.js");await import("./pro-app.js")');
    // Fehler direkt am Codefeld, ohne Freischaltung oder Speicherung.
    for(const invalid of ['', 'IKPRO1.ungueltig.ungueltig']){
      await evaluate(`document.getElementById('proLicenseCode').value=${JSON.stringify(invalid)};document.getElementById('proActivateCode').click()`);
      await waitFor('document.getElementById("proLicenseCode").getAttribute("aria-invalid")==="true"');
      assert.equal(await evaluate('document.activeElement.id'),'proLicenseCode');
      assert.equal(await evaluate('document.getElementById("proFeatures").hidden'),true);
      assert.ok(await evaluate('document.getElementById("proCodeError").textContent.length>0'));
    }
    await evaluate(`document.getElementById('proLicenseCode').value=${JSON.stringify(' \n'+adminCode+'\n ')};document.getElementById('proActivateCode').focus()`);
    await cmd('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,text:'\r',unmodifiedText:'\r'});
    await cmd('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
    await waitFor('!document.getElementById("proAdminLink").hidden');
    // Nach der Aktivierung ersetzt der Aktiv-Status das Codefeld und erhält den Fokus.
    assert.deepEqual(await evaluate('[document.activeElement.id,document.getElementById("proActivation").hidden,document.getElementById("proDeactivate").hidden,document.getElementById("proLicenseStatus").textContent,document.getElementById("proLicenseStatus").classList.contains("active")]'),
      ['proLicenseStatus',true,false,'Pro-Version aktiv. Lizenzcode aktiv für Invoice Kit Admin (Admin-Lizenz), unbefristet.',true]);
    // Aktives Pro ist auch bei zugeklapptem Bereich sichtbar, ein Klick auf den Hinweis öffnet ihn.
    await evaluate('document.getElementById("proPanel").open=false');
    assert.deepEqual(await evaluate('[document.getElementById("proBadge").hidden,document.getElementById("proBadge").textContent,document.getElementById("proNav").textContent,document.getElementById("proSummary").textContent.includes("ist aktiv")]'),
      [false,'Pro-Version aktiv · Lizenzcode aktiv für Invoice Kit Admin','Pro aktiv',true]);
    await evaluate('document.getElementById("proBadge").click()');assert.equal(await evaluate('document.getElementById("proPanel").open'),true);
    assert.equal(await evaluate('document.getElementById("proLicenseCode").value'),'', 'Code nach Aktivierung geleert');
    assert.equal(await evaluate('document.getElementById("proCodeError").textContent'),'');
    assert.equal(await evaluate('localStorage.getItem("invoice-kit-pro-license")'),null);
    writeFileSync('.test-artifacts/pro-code.png',Buffer.from((await cmd('Page.captureScreenshot',{format:'png'})).data,'base64'));
    await evaluate(`document.getElementById('proDeactivate').click()`);
    assert.deepEqual(await evaluate('[document.activeElement.id,document.getElementById("proActivation").hidden,document.getElementById("proDeactivate").hidden,document.getElementById("proBadge").hidden]'),['proLicenseCode',false,true,true],'Deaktivieren zeigt wieder das Codefeld');
    await upload('#proLicenseFile',adminTxt);await waitFor('!document.getElementById("proAdminLink").hidden');
    await evaluate(`document.getElementById('proDeactivate').click();document.getElementById('proLicenseCode').value=${JSON.stringify(gift)};document.getElementById('proActivateCode').click()`);
    await waitFor('!document.getElementById("proFeatures").hidden');
    assert.equal(await evaluate('document.getElementById("proAdminLink").hidden'),true);
    await evaluate(`document.getElementById('proDeactivate').click()`);
    await upload('#proLicenseFile',giftPath);await waitFor('!document.getElementById("proFeatures").hidden');
    assert.equal(await evaluate('document.getElementById("proAdminLink").hidden'),true);
    assert.equal(await evaluate('localStorage.getItem("invoice-kit-pro-license")'),null);
    await evaluate(`g.load(${JSON.stringify(invoice())});document.getElementById('proSaveCustomer').click()`);await waitFor('document.getElementById("proCustomers").options.length===2');
    await evaluate(`document.getElementById('proSaveArticle').click()`);await waitFor('document.getElementById("proArticles").options.length===2');
    await evaluate(`document.getElementById('proSaveInvoice').click()`);await waitFor('document.getElementById("proArchive").options.length===2');
    assert.equal(await evaluate('localStorage.getItem("invoice-kit-pro-data")'),null);
    await evaluate(`document.getElementById('proSaveData').click();document.getElementById('proRemember').click()`);
    assert.equal(await evaluate('JSON.parse(localStorage.getItem("invoice-kit-pro-data")).archive.length'),1);
    await go('/#proPanel');await evaluate('window.g=await import("./generator.js");await import("./pro-app.js")');await waitFor('!document.getElementById("proFeatures").hidden');
    await evaluate(`document.getElementById('proArticles').selectedIndex=1;document.getElementById('proUseArticle').click()`);await waitFor('g.state().items.length===2');
    assert.equal(await evaluate('document.getElementById("proLicenseStatus").textContent'),'Pro-Version aktiv. Lizenzcode aktiv für Geschenkkunde Test (Geschenk-Lizenz), unbefristet.');
    await evaluate(`document.getElementById('proDeactivate').click()`);await upload('#proLicenseFile',join(adminDir,'admin.invoicekit-license'));await waitFor('!document.getElementById("proAdminLink").hidden');
    writeFileSync('.test-artifacts/pro.png',Buffer.from((await cmd('Page.captureScreenshot',{format:'png'})).data,'base64'));
    await evaluate(`document.getElementById('clearData').click()`);assert.equal(await evaluate('document.getElementById("proFeatures").hidden'),true);
    assert.deepEqual(await evaluate('[document.getElementById("proBadge").hidden,document.getElementById("proNav").textContent,document.getElementById("proActivation").hidden,document.getElementById("proLicenseStatus").textContent]'),[true,'Pro aktivieren',false,'Pro ist nicht aktiviert.'],'Pro-Anzeige nach Gesamtlöschung entfernt');
    assert.equal(await evaluate('localStorage.getItem("invoice-kit-pro-data")'),null);assert.equal(await evaluate('localStorage.getItem("invoice-kit-pro-license")'),null);
    await upload('#proLicenseFile',giftPath);await evaluate(`document.getElementById('clearData').click()`);await pause(100);
    assert.equal(await evaluate('document.getElementById("proFeatures").hidden'),true,'Gesamtlöschung beendet auch eine laufende Aktivierung');
    await evaluate(`document.getElementById('proLicenseCode').value=${JSON.stringify(adminCode)};document.getElementById('proActivateCode').click();document.getElementById('clearData').click()`);await pause(100);
    assert.equal(await evaluate('document.getElementById("proFeatures").hidden'),true,'Gesamtlöschung beendet auch die Code-Aktivierung');
    assert.equal(await evaluate('document.getElementById("proLicenseCode").value'),'');
    console.log('Pro-Browsertest bestanden: Admin-Schlüssel, TXT- und Geschenkdatei, gültige und ungültige Lizenzcodes, Tastaturaktivierung, Rollen, Kunden, Artikel, Archiv, Speicherwahl, Wiederherstellung und Löschung.');
  }
  // App-Dateien einschließlich PDF-Bibliotheken sind auch ohne Netzwerk verfügbar.
  await cmd('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0});
  await go('/');await evaluate('window.g=await import("./generator.js")');assert.ok(await evaluate('document.querySelector("#preview h1").textContent'));
  assert.ok(await evaluate(`await (async()=>{for(const f of ['vendor/fonts.js','vendor/pdf-lib.min.js','vendor/fontkit.umd.min.js','zugferd.js','viewer.js','pro-app.js','pro-config.js','pro-license.js','pro-data.js']){const r=await fetch(f);if(!r.ok)return false}return true})()`));
  await cmd('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1});
  await go('/integration/wambur-vorschau-index.html');assert.ok(await evaluate('document.querySelector("#preview h1").textContent'));
  await go('/integration/wambur-vorschau-anzeigen.html');assert.equal(await evaluate('document.querySelector("#drop").tabIndex'),0);
  assert.deepEqual(browserErrors,[]);
  console.log(`Browsertest bestanden: ${variants.length} CII-Varianten, UBL, mehrseitiges PDF (${pdfResult.pages} Seiten), XML-Anhang, Escaping, Speicherwahl, Labels, Tastaturfokus, Offline-Dateien und Wambur-Vorschauen. Screenshots: .test-artifacts/`);
} finally {
  ws?.close();chrome.kill();await new Promise(resolve=>{if(chrome.exitCode!==null)resolve();else{chrome.once('exit',resolve);setTimeout(resolve,2000)}});rmSync(profile,{recursive:true,force:true});
}
