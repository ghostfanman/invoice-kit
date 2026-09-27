import {publicJwk} from './pro-config.js';
import {importIssuer,issueLicense} from './pro-license.js';
import {validDate} from './core.js';
const $=id=>document.getElementById(id);
let issuer=null,sequence=0;
const status=text=>{$('adminStatus').textContent=text};
function lock(){sequence++;issuer=null;$('adminKey').value='';$('adminTools').hidden=true;$('adminLock').disabled=true;status('Admin ist gesperrt.');}
function download(token,name){const url=URL.createObjectURL(new Blob([token+'\n'],{type:'text/plain'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('adminKey').onchange=async()=>{
  const file=$('adminKey').files[0];lock();if(!file)return;const current=sequence;
  try {
    if(file.size>10000)throw new Error('Die Schlüsseldatei ist zu groß.');
    const key=await importIssuer(JSON.parse(await file.text()),publicJwk);
    if(current!==sequence)return;issuer=key;$('adminTools').hidden=false;$('adminLock').disabled=false;status('Admin entsperrt. Der Schlüssel wird nicht im Browser gespeichert.');
  }catch{if(current===sequence)status('Der Schlüssel konnte nicht geprüft werden. Bitte deine originale admin-private.jwk auswählen.');}
};
$('adminLock').onclick=lock;
$('ownLicense').onclick=async()=>{
  const current=sequence;if(!issuer)return;
  try{const token=await issueLicense(issuer,{recipient:'Invoice Kit Admin',role:'admin'});if(current===sequence){download(token,'Admin-Lizenz.txt');status('Admin-Lizenz als TXT-Datei erstellt. Lade sie im Pro-Bereich oder füge dort ihren Inhalt als Lizenzcode ein.');}}catch{status('Die Admin-Lizenz konnte nicht erstellt werden.');}
};
$('giftForm').onsubmit=async event=>{
  event.preventDefault();if(!issuer)return;const current=sequence;
  try {
    const date=$('giftUntil').value;
    if(date&&!validDate(date))throw new Error('Bitte ein gültiges Ablaufdatum wählen.');
    const expiresAt=date?Date.parse(date+'T00:00:00Z')+86400000:null;
    if(expiresAt!==null&&expiresAt<=Date.now())throw new Error('Das Ablaufdatum liegt in der Vergangenheit.');
    const token=await issueLicense(issuer,{recipient:$('giftRecipient').value,expiresAt});
    if(current!==sequence)return;
    download(token,'geschenk-'+crypto.randomUUID()+'.invoicekit-license');
    status('Geschenk-Lizenz erstellt. Übergib die Datei persönlich an '+$('giftRecipient').value.trim()+'.');
  }catch(error){status(error.message);}
};
window.addEventListener('pagehide',lock);
