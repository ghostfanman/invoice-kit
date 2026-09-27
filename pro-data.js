export const emptyLibrary=()=>({version:1,customers:[],articles:[],archive:[]});
export const customerFields=['to','toStreet','toZip','toCity','toCountry','toMail','toVatId','buyerRef'];
export function customerFromInvoice(s){
  if(!s.to?.trim())throw new Error('Bitte zuerst den Kundennamen im Rechnungsformular eintragen.');
  return Object.fromEntries(customerFields.map(key=>[key,String(s[key]??'')]));
}
export function validateLibrary(value){
  if(!value||value.version!==1)throw new Error('Unbekanntes Pro-Sicherungsformat.');
  const out=emptyLibrary();
  for(const type of ['customers','articles','archive']) {
    if(!Array.isArray(value[type])||value[type].length>1000)throw new Error('Pro-Sicherung ungültig oder zu groß.');
    const ids=new Set();
    out[type]=value[type].map(entry=>{
      if(!entry||typeof entry.id!=='string'||entry.id.length>80||ids.has(entry.id)||typeof entry.label!=='string'||!entry.label.trim()||entry.label.length>240||!entry.data||typeof entry.data!=='object'||Array.isArray(entry.data))throw new Error('Ungültiger Eintrag in der Pro-Sicherung.');
      ids.add(entry.id);
      if(type==='archive'&&(!Array.isArray(entry.data.items)||entry.data.items.length>1000||entry.data.items.some(i=>!i||typeof i!=='object'||Array.isArray(i))))throw new Error('Ungültige archivierte Rechnung.');
      const data=type==='customers'?customerFromInvoice(entry.data):structuredClone(entry.data);
      if(type==='articles'&&typeof data.desc!=='string')throw new Error('Artikelbeschreibung fehlt.');
      return {id:entry.id,label:entry.label,data};
    });
  }
  return out;
}
export function addEntry(library,type,label,data){
  if(!['customers','articles','archive'].includes(type)||library[type].length>=1000)throw new Error('Maximal 1000 Einträge je Bereich. Bitte zuerst sichern und aufräumen.');
  const next=structuredClone(library);next[type].push({id:crypto.randomUUID(),label:label.slice(0,240),data:structuredClone(data)});
  return validateLibrary(next);
}
