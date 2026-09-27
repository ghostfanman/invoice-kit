import {publicJwk} from './pro-config.js';
import {verifyLicense} from './pro-license.js';
import {emptyLibrary,validateLibrary,addEntry,customerFromInvoice} from './pro-data.js';
import {state,load,check} from './generator.js';
const $=id=>document.getElementById(id);
const keys={license:'invoice-kit-pro-license',data:'invoice-kit-pro-data',save:'invoice-kit-pro-save'};
let token='',claims=null,library=emptyLibrary(),sequence=0;
const message=text=>{$('proStatus').textContent=text};
const saveMessage=()=> $('proSaveData').checked?'Auf diesem Gerät gespeichert.':'Nur für diese Sitzung gespeichert. Für später bitte die Pro-Daten sichern.';
function render(){
  const enabled=!!claims&&(claims.expiresAt===null||Date.now()<claims.expiresAt);
  $('proFeatures').hidden=!enabled;
  $('proAdminLink').hidden=claims?.role!=='admin';
  $('proLicenseStatus').textContent=enabled?`Pro aktiv für ${claims.recipient} (${claims.role==='admin'?'Admin':'Geschenk'}). ${claims.expiresAt===null?'Unbefristet.':'Gültig bis '+new Date(claims.expiresAt-1).toLocaleDateString('de-DE',{timeZone:'UTC'})+'.'}`:'Pro ist nicht aktiviert.';
  for(const [type,id] of [['customers','proCustomers'],['articles','proArticles'],['archive','proArchive']]){
    const select=$(id),selected=select.value;select.replaceChildren(new Option('Bitte auswählen',''));
    for(const entry of library[type])select.add(new Option(entry.label,entry.id));select.value=selected;
  }
}
async function permitted(){
  const current=sequence;
  try{const verified=await verifyLicense(token,publicJwk);if(current!==sequence)return false;claims=verified;return true}
  catch{if(current===sequence){claims=null;render();message('Bitte zuerst eine gültige Pro-Lizenz laden.')}return false}
}
function persist(next){
  if($('proSaveData').checked)localStorage.setItem(keys.data,JSON.stringify(next));
  library=next;render();
}
function download(name,text){const url=URL.createObjectURL(new Blob([text],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
async function activate(text,current=++sequence){
  const verified=await verifyLicense(text,publicJwk);
  if(current!==sequence)return;
  token=text.trim();claims=verified;
  if($('proRemember').checked)localStorage.setItem(keys.license,token);
  render();message('Pro wurde freigeschaltet. Deine Rechnung bleibt unverändert.');
}
$('proLicenseFile').onchange=async()=>{
  const file=$('proLicenseFile').files[0];$('proLicenseFile').value='';if(!file)return;const current=++sequence;
  try{if(file.size>8000)throw new Error('Die Lizenzdatei ist zu groß.');await activate(await file.text(),current)}catch(error){if(current===sequence)message(error.message)}
};
$('proRemember').onchange=()=>{
  try{if($('proRemember').checked&&token)localStorage.setItem(keys.license,token);else localStorage.removeItem(keys.license)}catch{message('Die Lizenz konnte nicht gespeichert werden. Sie bleibt in dieser Sitzung aktiv.');}
};
$('proDeactivate').onclick=()=>{sequence++;token='';claims=null;$('proRemember').checked=false;try{localStorage.removeItem(keys.license)}catch{}render();message('Pro deaktiviert. Gespeicherte Pro-Daten bleiben erhalten und lassen sich nach erneuter Aktivierung öffnen.');};
$('proSaveData').onchange=()=>{
  try{
    if($('proSaveData').checked){localStorage.setItem(keys.data,JSON.stringify(library));localStorage.setItem(keys.save,'yes')}
    else{localStorage.removeItem(keys.data);localStorage.removeItem(keys.save)}
    message(saveMessage());
  }catch{$('proSaveData').checked=false;message('Speichern fehlgeschlagen. Sichere die Pro-Daten als Datei.');}
};
function action(id,fn){$(id).onclick=async()=>{if(!await permitted())return;try{await fn()}catch(error){message(error.message)}};}
const selected=(type,id)=>{const entry=library[type].find(e=>e.id===$(id).value);if(!entry)throw new Error('Bitte zuerst einen gespeicherten Eintrag auswählen.');return entry;};
action('proSaveCustomer',()=>{const data=customerFromInvoice(state());persist(addEntry(library,'customers',data.to,data));message('Kunde übernommen. '+saveMessage());});
action('proUseCustomer',()=>{load({...state(),...selected('customers','proCustomers').data});message('Kunde in die Rechnung übernommen.');});
action('proSaveArticle',()=>{
  const index=Number($('proItemNumber').value)-1,s=state(),item=s.items[index];
  if(!Number.isInteger(index)||!item||!item.desc?.trim())throw new Error('Bitte eine vorhandene Position mit Beschreibung auswählen.');
  persist(addEntry(library,'articles',String(item.desc),item));message('Artikel übernommen. '+saveMessage());
});
action('proUseArticle',()=>{const s=state();s.items.push(structuredClone(selected('articles','proArticles').data));load(s);message('Artikel als neue Rechnungsposition eingefügt.');});
action('proSaveInvoice',()=>{if(!check()){message('Bitte zuerst die markierten Rechnungsangaben korrigieren.');return}const s=state();persist(addEntry(library,'archive',`${s.num} · ${s.to} · ${s.date}`,s));message('Rechnung als bearbeitbare Kopie archiviert. '+saveMessage());});
action('proUseInvoice',()=>{load(structuredClone(selected('archive','proArchive').data));message('Archivierte Rechnung geladen. Änderungen betreffen nur die geöffnete Kopie.');});
for(const [type,select,button] of [['customers','proCustomers','proDeleteCustomer'],['articles','proArticles','proDeleteArticle'],['archive','proArchive','proDeleteInvoice']])action(button,()=>{
  const entry=selected(type,select),next=structuredClone(library);next[type]=next[type].filter(e=>e.id!==entry.id);persist(next);message('Eintrag gelöscht. '+saveMessage());
});
$('proBackup').onclick=()=>download('invoice-kit-pro-sicherung.json',JSON.stringify(library,null,2));
$('proRestore').onchange=async()=>{
  const file=$('proRestore').files[0];$('proRestore').value='';const current=sequence;if(!file||!await permitted())return;
  try{
    if(file.size>5000000)throw new Error('Die Pro-Sicherung darf höchstens 5 MB groß sein.');
    const imported=validateLibrary(JSON.parse(await file.text())),next=structuredClone(library);
    if(current!==sequence)return;
    for(const type of ['customers','articles','archive']){
      for(const entry of imported[type]){
        const existing=next[type].find(e=>e.id===entry.id);
        if(!existing)next[type].push(entry);
        else if(JSON.stringify(existing)!==JSON.stringify(entry))next[type].push({...entry,id:crypto.randomUUID()});
      }
    }
    persist(validateLibrary(next));message('Sicherung ergänzt. Vorhandene Einträge bleiben erhalten. '+saveMessage());
  }catch(error){message(error.message)}
};
$('clearData').addEventListener('click',()=>{sequence++;token='';claims=null;library=emptyLibrary();$('proRemember').checked=false;$('proSaveData').checked=false;render();message('Pro-Lizenz und Pro-Daten wurden auch aus dieser Sitzung entfernt.');});
window.addEventListener('storage',event=>{
  if(event.key===null||event.key===keys.license&&event.newValue===null){sequence++;token='';claims=null;$('proRemember').checked=false;render()}
  if(event.key===null||event.key===keys.data&&event.newValue===null){library=emptyLibrary();$('proSaveData').checked=false;render()}
});
try{
  const saved=localStorage.getItem(keys.data);if(saved)library=validateLibrary(JSON.parse(saved));
  $('proSaveData').checked=localStorage.getItem(keys.save)==='yes';
  const remembered=localStorage.getItem(keys.license);if(remembered){$('proRemember').checked=true;activate(remembered).catch(error=>message(error.message))}
}catch{message('Gespeicherte Pro-Daten konnten nicht geladen werden. Die Daten wurden nicht überschrieben.');}
render();
// Hash-Link öffnet den Pro-Bereich auch nach einer Navigation innerhalb der Seite.
function openPanel(){if(location.hash==='#proPanel')$('proPanel').open=true}
window.addEventListener('hashchange',openPanel);openPanel();
setInterval(()=>{if(claims?.expiresAt!==null&&claims&&Date.now()>=claims.expiresAt){claims=null;render();message('Die Pro-Lizenz ist abgelaufen. Die Basisfunktionen bleiben verfügbar.')}},30000);
