import {decimalText, num, home, totals, validateInvoice, PAYMENT, needsIBAN, canGiroCode, normalizeVAT} from './core.js';
import {STORAGE_CHOICE, readDraft, clearInvoiceData} from './storage.js';

const $=id=>document.getElementById(id);
const fields=["from","fromStreet","fromZip","fromCity","fromCountry","fromMail","fromPhone","vatId","taxNo","iban","bic","register","managers",
  "to","toStreet","toZip","toCity","toCountry","toMail","toVatId","buyerRef","docType","lang","refNum","refDate","num","date","serviceDate","serviceEnd",
  "paymentMeans","cardLast4","taxCase","exReason","cur","fx","due","skonto","skontoDays","note"];
const checks=["keepNote","qrCode"];
const fieldDefaults=Object.fromEntries(fields.map(f=>[f,$(f).value]));
const KEY=document.body.dataset.storageKey || "invoice-kit-v3";
let validationShown=false;
const RATES={DE:[19,7,0],AT:[20,13,10,0],CH:[8.1,3.8,2.6,0],GB:[20,5,0],FR:[20,10,5.5,2.1],IT:[22,10,5,4],ES:[21,10,4],NL:[21,9,0],BE:[21,12,6],PL:[23,8,5],LU:[17,14,8,3]};
const UNITS={C62:{de:"Stk.",en:"pcs",fr:"pce",it:"pz",es:"ud.",nl:"st.",pl:"szt."},HUR:{de:"Std.",en:"hrs",fr:"h",it:"ore",es:"h",nl:"uur",pl:"godz."},
  DAY:{de:"Tage",en:"days",fr:"jours",it:"giorni",es:"días",nl:"dagen",pl:"dni"},MON:{de:"Monate",en:"months",fr:"mois",it:"mesi",es:"meses",nl:"maanden",pl:"mies."},
  LS:{de:"pauschal",en:"lump sum",fr:"forfait",it:"forfait",es:"global",nl:"forfait",pl:"ryczałt"}};
const LOCALE={de:"de-DE",en:"en-GB",fr:"fr-FR",it:"it-IT",es:"es-ES",nl:"nl-NL",pl:"pl-PL"};
let items=[];

/* Rechtlich vorgeschriebene Hinweise je Steuerfall (Art. 226 Nr. 11/11a MwSt-Richtlinie, § 14a UStG) */
const TAXTEXT={
  KU:{de:"Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.",en:"No VAT is charged under the small business scheme (Section 19 German VAT Act).",
      fr:"TVA non applicable, régime des petites entreprises (§ 19 UStG allemand).",it:"Operazione senza IVA ai sensi del regime dei piccoli imprenditori (§ 19 UStG tedesca).",
      es:"Sin IVA: régimen de pequeños empresarios (§ 19 UStG alemana).",nl:"Geen btw: kleineondernemersregeling (§ 19 Duitse UStG).",pl:"Bez VAT: zwolnienie dla małych przedsiębiorców (§ 19 niemieckiej UStG)."},
  AE:{de:"Steuerschuldnerschaft des Leistungsempfängers (Reverse Charge).",en:"Reverse charge: VAT to be accounted for by the recipient (Art. 196 Directive 2006/112/EC).",
      fr:"Autoliquidation : TVA due par le preneur (art. 196 directive 2006/112/CE).",it:"Inversione contabile (art. 196 direttiva 2006/112/CE).",
      es:"Inversión del sujeto pasivo (art. 196 Directiva 2006/112/CE).",nl:"Btw verlegd (art. 196 Richtlijn 2006/112/EG).",pl:"Odwrotne obciążenie (art. 196 dyrektywy 2006/112/WE)."},
  K:{de:"Steuerfreie innergemeinschaftliche Lieferung (§ 4 Nr. 1b i. V. m. § 6a UStG).",en:"Exempt intra-Community supply (Art. 138 Directive 2006/112/EC).",
      fr:"Exonération de TVA, livraison intracommunautaire (art. 138 directive 2006/112/CE).",it:"Cessione intracomunitaria non imponibile (art. 138 direttiva 2006/112/CE).",
      es:"Entrega intracomunitaria exenta (art. 138 Directiva 2006/112/CE).",nl:"Vrijgestelde intracommunautaire levering (art. 138 Richtlijn 2006/112/EG).",pl:"Wewnątrzwspólnotowa dostawa towarów zwolniona z VAT (art. 138 dyrektywy 2006/112/WE)."},
  G:{de:"Steuerfreie Ausfuhrlieferung (§ 4 Nr. 1a i. V. m. § 6 UStG).",en:"VAT-exempt export supply (Art. 146 Directive 2006/112/EC).",
      fr:"Exonération de TVA, exportation (art. 146 directive 2006/112/CE).",it:"Esportazione non imponibile (art. 146 direttiva 2006/112/CE).",
      es:"Exportación exenta (art. 146 Directiva 2006/112/CE).",nl:"Vrijgestelde uitvoer (art. 146 Richtlijn 2006/112/EG).",pl:"Eksport zwolniony z VAT (art. 146 dyrektywy 2006/112/WE)."},
  O:{de:"Nicht im Inland steuerbare Leistung. Die Steuer schuldet ggf. der Leistungsempfänger nach dem Recht seines Landes.",en:"Not subject to German VAT; place of supply outside Germany. Any VAT is due by the recipient under local law.",
      fr:"Opération non soumise à la TVA allemande ; lieu de la prestation hors d'Allemagne.",it:"Operazione non soggetta all'IVA tedesca; luogo della prestazione fuori dalla Germania.",
      es:"Operación no sujeta al IVA alemán; lugar de prestación fuera de Alemania.",nl:"Niet onderworpen aan Duitse btw; plaats van dienst buiten Duitsland.",pl:"Transakcja niepodlegająca niemieckiemu VAT; miejsce świadczenia poza Niemcami."}
};
const HINT={
  S:"Normalfall im Inland. Der Steuersatz kann je Position unterschiedlich sein.",
  KU:"Kein Steuerausweis. Der Pflichthinweis wird automatisch gedruckt.",
  EX:"Z. B. Heilbehandlung, Unterricht, Vermietung. Den genauen Paragrafen als Befreiungsgrund angeben.",
  AE:"Die USt-IdNr. des Kunden und deine eigene sind Pflicht. Der Hinweis „Steuerschuldnerschaft des Leistungsempfängers“ wird gedruckt.",
  K:"Warenlieferung an ein Unternehmen in einem anderen EU-Land. Beide USt-IdNrn. sind Pflicht.",
  G:"Warenlieferung in ein Land außerhalb der EU. Deine USt-IdNr. ist für die E-Rechnung Pflicht. Ausfuhrnachweis aufbewahren.",
  O:"Z. B. Beratung oder Software für ein Unternehmen in den USA oder der Schweiz."
};
const L={
  de:{inv:"Rechnung",corr:"Rechnungskorrektur",corrRef:"zu Rechnung Nr. {n} vom {d}",no:"Nr.",date:"Rechnungsdatum",svc:"Leistungsdatum",period:"Leistungszeitraum",due:"Fällig",
    ref:"Ihre Referenz",custVat:"USt-IdNr. des Kunden",desc:"Beschreibung",qty:"Menge",price:"Einzelpreis",vat:"USt.",sum:"Summe",net:"Netto",total:"Gesamt",
    vatOn:"USt. {r} % auf {b}",vatHome:"USt. in {c} (Kurs {x})",skonto:"Bei Zahlung bis {d} ({t} Tage) {p} % Skonto: zu zahlen {a}.",pay:"Zahlbar ohne Abzug bis {d}.",
    keep:"Sie sind gesetzlich verpflichtet, diese Rechnung zwei Jahre aufzubewahren (§ 14b Abs. 1 Satz 5 UStG).",
    vatIdL:"USt-IdNr.",taxNoL:"Steuernr.",reg:"Register",mgr:"Geschäftsführung",qr:"Mit der Banking-App scannen und bezahlen"},
  en:{inv:"Invoice",corr:"Credit note / corrected invoice",corrRef:"for invoice no. {n} dated {d}",no:"No.",date:"Invoice date",svc:"Date of supply",period:"Period of supply",due:"Due date",
    ref:"Your reference",custVat:"Customer VAT No.",desc:"Description",qty:"Qty",price:"Unit price",vat:"VAT",sum:"Amount",net:"Net",total:"Total",
    vatOn:"VAT {r} % on {b}",vatHome:"VAT in {c} (rate {x})",skonto:"If paid by {d} ({t} days), {p} % discount: pay {a}.",pay:"Payable without deduction by {d}.",
    keep:"You are legally required to keep this invoice for two years (Section 14b (1) German VAT Act).",
    vatIdL:"VAT No.",taxNoL:"Tax No.",reg:"Register",mgr:"Managing director",qr:"Scan with your banking app to pay"},
  fr:{inv:"Facture",corr:"Facture rectificative",corrRef:"relative à la facture n° {n} du {d}",no:"N°",date:"Date de facture",svc:"Date de livraison",period:"Période de prestation",due:"Échéance",
    ref:"Votre référence",custVat:"N° TVA du client",desc:"Désignation",qty:"Qté",price:"Prix unitaire",vat:"TVA",sum:"Montant",net:"Total HT",total:"Total TTC",
    vatOn:"TVA {r} % sur {b}",vatHome:"TVA en {c} (taux {x})",skonto:"Escompte de {p} % en cas de paiement avant le {d} ({t} jours) : {a}.",pay:"Payable sans escompte au plus tard le {d}.",
    keep:"Vous êtes légalement tenu de conserver cette facture pendant deux ans (§ 14b UStG allemand).",
    vatIdL:"N° TVA",taxNoL:"N° fiscal",reg:"Registre",mgr:"Gérant",qr:"Scannez avec votre appli bancaire pour payer"},
  it:{inv:"Fattura",corr:"Nota di variazione",corrRef:"relativa alla fattura n. {n} del {d}",no:"N.",date:"Data fattura",svc:"Data della prestazione",period:"Periodo della prestazione",due:"Scadenza",
    ref:"Vostro riferimento",custVat:"P. IVA cliente",desc:"Descrizione",qty:"Qtà",price:"Prezzo unitario",vat:"IVA",sum:"Importo",net:"Imponibile",total:"Totale",
    vatOn:"IVA {r} % su {b}",vatHome:"IVA in {c} (cambio {x})",skonto:"Sconto del {p} % per pagamento entro il {d} ({t} giorni): {a}.",pay:"Pagabile senza sconto entro il {d}.",
    keep:"È obbligatorio conservare la presente fattura per due anni (§ 14b UStG tedesca).",
    vatIdL:"P. IVA",taxNoL:"Cod. fiscale",reg:"Registro imprese",mgr:"Amministratore",qr:"Inquadra con l'app della banca per pagare"},
  es:{inv:"Factura",corr:"Factura rectificativa",corrRef:"de la factura n.º {n} del {d}",no:"N.º",date:"Fecha de factura",svc:"Fecha de la prestación",period:"Período de la prestación",due:"Vencimiento",
    ref:"Su referencia",custVat:"NIF-IVA del cliente",desc:"Descripción",qty:"Cant.",price:"Precio unitario",vat:"IVA",sum:"Importe",net:"Base imponible",total:"Total",
    vatOn:"IVA {r} % sobre {b}",vatHome:"IVA en {c} (tipo de cambio {x})",skonto:"Descuento del {p} % por pago hasta el {d} ({t} días): {a}.",pay:"Pagadero sin descuento hasta el {d}.",
    keep:"Está obligado legalmente a conservar esta factura durante dos años (§ 14b UStG alemana).",
    vatIdL:"NIF-IVA",taxNoL:"N.º fiscal",reg:"Registro",mgr:"Administrador",qr:"Escanee con su app bancaria para pagar"},
  nl:{inv:"Factuur",corr:"Creditnota",corrRef:"bij factuur nr. {n} van {d}",no:"Nr.",date:"Factuurdatum",svc:"Leveringsdatum",period:"Leveringsperiode",due:"Vervaldatum",
    ref:"Uw referentie",custVat:"Btw-nr. klant",desc:"Omschrijving",qty:"Aantal",price:"Prijs per eenheid",vat:"Btw",sum:"Bedrag",net:"Subtotaal",total:"Totaal",
    vatOn:"Btw {r} % over {b}",vatHome:"Btw in {c} (koers {x})",skonto:"Bij betaling vóór {d} ({t} dagen) {p} % korting: te betalen {a}.",pay:"Te betalen zonder aftrek vóór {d}.",
    keep:"U bent wettelijk verplicht deze factuur twee jaar te bewaren (§ 14b Duitse UStG).",
    vatIdL:"Btw-nr.",taxNoL:"Belastingnr.",reg:"Handelsregister",mgr:"Bestuurder",qr:"Scan met je bank-app om te betalen"},
  pl:{inv:"Faktura",corr:"Faktura korygująca",corrRef:"do faktury nr {n} z dnia {d}",no:"Nr",date:"Data wystawienia",svc:"Data dostawy",period:"Okres świadczenia",due:"Termin płatności",
    ref:"Państwa numer referencyjny",custVat:"NIP UE nabywcy",desc:"Opis",qty:"Ilość",price:"Cena jedn.",vat:"VAT",sum:"Wartość",net:"Netto",total:"Razem",
    vatOn:"VAT {r} % od {b}",vatHome:"VAT w {c} (kurs {x})",skonto:"Przy płatności do {d} ({t} dni) rabat {p} %: do zapłaty {a}.",pay:"Płatne bez potrąceń do {d}.",
    keep:"Mają Państwo prawny obowiązek przechowywania tej faktury przez dwa lata (§ 14b niemieckiej UStG).",
    vatIdL:"NIP UE",taxNoL:"Nr podatkowy",reg:"Rejestr",mgr:"Zarząd",qr:"Zeskanuj w aplikacji bankowej, aby zapłacić"}
};

const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&apos;"}[c]));
const today=()=>new Date().toISOString().slice(0,10);
const fmt=(s,o)=>s.replace(/\{(\w)\}/g,(_,k)=>o[k]??"");

function state(){const s={items:items.map(item=>({...item}))};fields.forEach(f=>s[f]=$(f).value.trim());checks.forEach(c=>s[c]=$(c).checked);s.cur=s.cur.toUpperCase();return s}


function legalText(s,t){
  if(t.tc==="EX")return s.exReason;
  const x=TAXTEXT[t.tc];return x?(x[s.lang]||x.de):"";
}

/* EPC-QR-Code (GiroCode) nach EPC069-12, Version 002 */
function epcPayload(s,t){
  const iban=(s.iban||"").replace(/\s/g,"").toUpperCase();
  if(!canGiroCode(s,t))return "";
  const clean=v=>String(v||"").replace(/[\r\n]+/g," ").trim();
  return ["BCD","002","1","SCT",clean(s.bic).replace(/\s/g,"").toUpperCase(),clean(s.from).slice(0,70),iban,"EUR"+t.gross.toFixed(2),"","",
    clean(`Rechnung ${s.num}`).slice(0,140)].join("\n");
}
function qrMatrix(text){
  if(!text||typeof qrcode!=="function")return null;
  qrcode.stringToBytes=qrcode.stringToBytesFuncs["UTF-8"];
  const q=qrcode(0,"M");q.addData(text,"Byte");q.make();
  const n=q.getModuleCount(),m=[];for(let r=0;r<n;r++){m.push([]);for(let c=0;c<n;c++)m[r].push(q.isDark(r,c))}return m;
}

/* Gemeinsames Rechnungsmodell für Vorschau und PDF */
function view(s){
  const t=totals(s),lang=L[s.lang]?s.lang:"de",T=L[lang],loc=LOCALE[lang];
  const cur=/^[A-Z]{3}$/.test(s.cur)?s.cur:"EUR";
  const money=(n,c=cur)=>{try{return new Intl.NumberFormat(loc,{style:"currency",currency:c}).format(n||0)}catch(e){return (n||0).toFixed(2)+" "+c}};
  const dt=iso=>iso?new Date(iso+"T12:00:00").toLocaleDateString(loc):"";
  const nr=n=>n.toLocaleString(loc);
  const addr=(st,zip,city,c)=>[st,[zip,city].filter(Boolean).join(" "),c&&c.toUpperCase()!==(s.fromCountry||"").toUpperCase()?c.toUpperCase():""].filter(Boolean);
  const meta=[[T.no,s.num],[T.date,dt(s.date)],s.serviceEnd?[T.period,`${dt(s.serviceDate)} bis ${dt(s.serviceEnd)}`]:[T.svc,dt(s.serviceDate)],[T.due,dt(t.dueDate)]];
  const legal=[legalText(s,t),s.keepNote?T.keep:""].filter(Boolean);
  const totalsRows=[[T.net,money(t.net)]].concat(t.tc==="S"?t.breakdown.map(b=>[fmt(T.vatOn,{r:nr(b.rate),b:money(b.basis)}),money(b.tax)]):[]);
  const fxRow=t.fxNeeded&&t.fx?[fmt(T.vatHome,{c:home(s),x:t.fx}),money(t.taxHome,home(s))]:null;
  const payText=(PAYMENT[s.paymentMeans]||"")+". "+fmt(T.pay,{d:dt(t.dueDate)})+(t.sk?" "+fmt(T.skonto,{d:dt(t.skDate),t:t.skDays,p:nr(t.sk),a:money(t.skPay)}):"");
  const foot=[[s.from,addr(s.fromStreet,s.fromZip,s.fromCity,"").join(", "),s.vatId?`${T.vatIdL}: ${s.vatId}`:"",s.taxNo?`${T.taxNoL}: ${s.taxNo}`:""].filter(Boolean).join(" · "),
    [s.register?`${T.reg}: ${s.register}`:"",s.managers?`${T.mgr}: ${s.managers}`:""].filter(Boolean).join(" · "),
    [needsIBAN(s.paymentMeans)&&s.iban?`IBAN: ${s.iban}`:"",needsIBAN(s.paymentMeans)&&s.bic?`BIC: ${s.bic}`:""].filter(Boolean).join(" · ")].filter(Boolean);
  return {t,T,lang,loc,money,
    title:s.docType==="384"?T.corr:T.inv, corrRef:s.docType==="384"?fmt(T.corrRef,{n:s.refNum,d:dt(s.refDate)}):"",
    meta, seller:[s.from,...addr(s.fromStreet,s.fromZip,s.fromCity,""),s.fromMail,s.fromPhone].filter(Boolean),
    buyer:[s.to,...addr(s.toStreet,s.toZip,s.toCity,s.toCountry),s.toVatId?`${T.custVat}: ${s.toVatId}`:"",s.buyerRef?`${T.ref}: ${s.buyerRef}`:""].filter(Boolean),
    head:[T.desc,T.qty,T.price].concat(t.tc==="S"?[T.vat]:[]).concat([T.sum]),
    rows:t.lines.map(l=>[l.desc,`${nr(l.qty)} ${(UNITS[l.unit]||{})[lang]||""}`.trim(),money(l.price)].concat(t.tc==="S"?[`${nr(l.rate)} %`]:[]).concat([money(l.total)])),
    totalsRows,grand:[T.total,money(t.gross)],fxRow,legal,payText,note:s.note,foot,qr:epcPayload(s,t),qrLabel:T.qr};
}

/* ---------- Formular ---------- */
function syncForm(){
  const tc=$("taxCase").value;
  $("cardBox").classList.toggle("hide",$("paymentMeans").value!=="48");
  $("iban").required=needsIBAN($("paymentMeans").value);
  $("taxHint").textContent=HINT[tc];
  $("exBox").classList.toggle("hide",tc!=="EX");
  $("refBox").classList.toggle("hide",$("docType").value!=="384");
  document.querySelectorAll(".rateCol").forEach(e=>e.classList.toggle("hide",tc!=="S"));
  const s=state(),t=totals(s);
  $("fxBox").classList.toggle("hide",!t.fxNeeded);
  $("fxLabel").textContent=`Kurs: 1 ${s.cur} = ? ${home(s)} *`;
  $("rateList").innerHTML=(RATES[(s.fromCountry||"DE").toUpperCase()]||[0]).map(r=>`<option value="${r}">`).join("");
}
function defRate(){const r=RATES[($("fromCountry").value||"DE").toUpperCase()];return r?r[0]:0}
function renderItems(){
  const hideRate=$("taxCase").value!=="S";
  $("items").innerHTML=items.map((it,i)=>`<tr>
    <td style="width:36%"><label class="sr-only" for="item-${i}-desc">Leistung, Position ${i+1}</label><input id="item-${i}-desc" data-i="${i}" data-k="desc" value="${esc(it.desc)}" placeholder="Leistung"></td>
    <td><label class="sr-only" for="item-${i}-qty">Menge, Position ${i+1}</label><input id="item-${i}-qty" data-i="${i}" data-k="qty" type="number" step="any" value="${esc(it.qty)}"></td>
    <td><label class="sr-only" for="item-${i}-unit">Einheit, Position ${i+1}</label><select id="item-${i}-unit" data-i="${i}" data-k="unit">${Object.entries(UNITS).map(([c,l])=>`<option value="${c}"${it.unit===c?" selected":""}>${l.de}</option>`).join("")}</select></td>
    <td><label class="sr-only" for="item-${i}-price">Einzelpreis netto, Position ${i+1}</label><input id="item-${i}-price" data-i="${i}" data-k="price" type="number" step="any" value="${esc(it.price)}"></td>
    <td class="rateCol${hideRate?" hide":""}"><label class="sr-only" for="item-${i}-rate">Umsatzsteuer in Prozent, Position ${i+1}</label><input id="item-${i}-rate" data-i="${i}" data-k="rate" type="number" step="any" list="rateList" value="${esc(it.rate)}" style="width:70px"></td>
    <td><button class="del" data-del="${i}" aria-label="Position ${i+1} entfernen" title="Entfernen">✕</button></td></tr>`).join("");
}

/* ---------- Vorschau ---------- */
function qrSvg(text){
  const m=qrMatrix(text);if(!m)return "";const n=m.length,q=4;let p="";
  m.forEach((row,r)=>row.forEach((d,c)=>{if(d)p+=`M${c+q} ${r+q}h1v1h-1z`}));
  return `<svg viewBox="0 0 ${n+2*q} ${n+2*q}" width="110" height="110" shape-rendering="crispEdges" role="img" aria-label="GiroCode"><rect width="100%" height="100%" fill="#fff"/><path d="${p}" fill="#000"/></svg>`;
}
function update(){
  const s=state(); let v;
  try {syncForm();v=view(s)} catch {msg("Die Beträge sind zu groß oder ungültig. Bitte Eingaben prüfen.",false);return;}
  $("preview").innerHTML=`
    <div class="top"><div><h1>${esc(v.title)}</h1>${v.corrRef?`<div>${esc(v.corrRef)}</div>`:""}
      ${v.meta.map(([k,x])=>`<div>${esc(k)}: ${esc(x)}</div>`).join("")}</div>
    <div style="text-align:right">${v.seller.map((x,i)=>i?`<div>${esc(x)}</div>`:`<strong>${esc(x)}</strong>`).join("")}</div></div>
    <div>${v.buyer.map((x,i)=>i?`<div>${esc(x)}</div>`:`<strong>${esc(x)}</strong>`).join("")}</div>
    <div class="table-scroll"><table><thead><tr>${v.head.map((h,i)=>`<th${i?' class="r"':""}>${esc(h)}</th>`).join("")}</tr></thead><tbody>
    ${v.rows.map(r=>`<tr>${r.map((c,i)=>`<td${i?' class="r"':""}>${esc(c)}</td>`).join("")}</tr>`).join("")}
    </tbody></table></div>
    <div class="tot">${v.totalsRows.map(([k,x])=>`<div><span>${esc(k)}</span><span>${esc(x)}</span></div>`).join("")}
      <div class="big"><span>${esc(v.grand[0])}</span><span>${esc(v.grand[1])}</span></div>
      ${v.fxRow?`<div><span>${esc(v.fxRow[0])}</span><span>${esc(v.fxRow[1])}</span></div>`:""}</div>
    ${v.legal.map(x=>`<p class="legal">${esc(x)}</p>`).join("")}
    <div class="payrow"><p>${esc(v.payText)}</p>${v.qr?`<figure class="qr">${qrSvg(v.qr)}<figcaption>${esc(v.qrLabel)}</figcaption></figure>`:""}</div>
    <p class="pre">${esc(v.note)}</p>
    <div class="foot">${v.foot.map(esc).join("\n")}</div>`;
  $("warn").textContent=warnings(s,v.t).join("\n");
  if(validationShown)validate(s);
  if($("saveDraft").checked)try{localStorage.setItem(KEY,JSON.stringify(s))}catch{ $("storageStatus").textContent="Der Browser konnte den Entwurf nicht speichern. Bitte als JSON sichern."; }
}

/* ---------- Pflichtprüfung ---------- */
function clearErrors(){
  document.querySelectorAll(".field-error").forEach(e=>e.remove());
  document.querySelectorAll('[aria-invalid="true"]').forEach(e=>{e.removeAttribute("aria-invalid");e.classList.remove("missing");
    const ids=(e.getAttribute("aria-describedby")||"").split(" ").filter(id=>!id.startsWith("error-"));
    if(ids.length)e.setAttribute("aria-describedby",ids.join(" "));else e.removeAttribute("aria-describedby");});
}
function validate(s){
  clearErrors();
  const errors=validateInvoice(s);
  errors.forEach(({field,message},i)=>{
    const el=$(field);if(!el)return;
    el.classList.add("missing");el.setAttribute("aria-invalid","true");
    const error=document.createElement("span");error.id=`error-${i}`;error.className="field-error";error.textContent=message;
    el.setAttribute("aria-describedby",[el.getAttribute("aria-describedby"),error.id].filter(Boolean).join(" "));
    if(el.tagName==="TBODY")el.closest("table").after(error);else el.after(error);
  });
  return errors.map(e=>e.message);
}
function warnings(s,t){
  const w=[],fc=(s.fromCountry||"").toUpperCase(),tcC=(s.toCountry||"").toUpperCase();
  const EU=["AT","BE","BG","CY","CZ","DE","DK","EE","ES","FI","FR","GR","HR","HU","IE","IT","LT","LU","LV","MT","NL","PL","PT","RO","SE","SI","SK"];
  if(fc==="AT"&&t.gross>10000&&!s.toVatId) w.push("Österreich: Über 10.000 € brutto ist die UID des Kunden Pflicht.");
  if((t.tc==="AE"||t.tc==="K")&&tcC===fc) w.push("Hinweis: Reverse Charge / innergemeinschaftliche Lieferung betrifft meist Kunden in einem anderen Land.");
  if(t.tc==="K"&&!EU.includes(tcC)) w.push("Innergemeinschaftliche Lieferung gilt nur für Kunden in der EU.");
  if(t.tc==="G"&&EU.includes(tcC)) w.push("Ausfuhrlieferung gilt nur für Lieferungen außerhalb der EU.");
  if(fc!=="DE") w.push("XRechnung ist das deutsche Format. Für "+fc+" gelten ggf. eigene E-Rechnungsregeln: das PDF enthält die allgemeinen Pflichtangaben.");
  if(t.tc==="S"&&t.tax===0&&t.net!==0) w.push("Steuersatz 0 %: Wenn die Leistung steuerfrei ist, wähle besser einen passenden Steuerfall.");
  return w;
}

/* ---------- XRechnung 3.0 (UN/CEFACT CII) ---------- */
function buildXML(s,profile="xrechnung"){
  const t=totals(s),tc=t.tc,cur=s.cur;
  const cat={S:"S",KU:"E",EX:"E",AE:"AE",K:"K",G:"G",O:"O"}[tc];
  const reason=tc==="S"?"":legalText({...s,lang:"de"},t);
  const d=iso=>`<udt:DateTimeString format="102">${iso.replaceAll("-","")}</udt:DateTimeString>`;
  const a=n=>n.toFixed(2), q=decimalText;
  const noVA=tc==="O";                         // BR-O-02: bei "nicht steuerbar" keine USt-IdNrn. im XML
  const rateEl=r=>cat==="O"?"":`<ram:RateApplicablePercent>${decimalText(r)}</ram:RateApplicablePercent>`;
  const vat=normalizeVAT;
  const party=(o)=>`${o.id?`
      <ram:ID>${esc(o.id)}</ram:ID>`:""}
      <ram:Name>${esc(o.name)}</ram:Name>${o.desc?`
      <ram:Description>${esc(o.desc)}</ram:Description>`:""}${o.legal?`
      <ram:SpecifiedLegalOrganization><ram:ID>${esc(o.legal)}</ram:ID></ram:SpecifiedLegalOrganization>`:""}${o.contact||""}
      <ram:PostalTradeAddress>
        <ram:PostcodeCode>${esc(o.zip)}</ram:PostcodeCode>${o.street?`
        <ram:LineOne>${esc(o.street)}</ram:LineOne>`:""}
        <ram:CityName>${esc(o.city)}</ram:CityName>
        <ram:CountryID>${esc(o.country.toUpperCase())}</ram:CountryID>
      </ram:PostalTradeAddress>${o.mail?`
      <ram:URIUniversalCommunication><ram:URIID schemeID="EM">${esc(o.mail)}</ram:URIID></ram:URIUniversalCommunication>`:""}${o.tax||""}`;
  const sellerTax=(s.taxNo?`
      <ram:SpecifiedTaxRegistration><ram:ID schemeID="FC">${esc(s.taxNo)}</ram:ID></ram:SpecifiedTaxRegistration>`:"")+(s.vatId&&!noVA?`
      <ram:SpecifiedTaxRegistration><ram:ID schemeID="VA">${esc(vat(s.vatId))}</ram:ID></ram:SpecifiedTaxRegistration>`:"");
  const buyerTax=s.toVatId&&!noVA?`
      <ram:SpecifiedTaxRegistration><ram:ID schemeID="VA">${esc(vat(s.toVatId))}</ram:ID></ram:SpecifiedTaxRegistration>`:"";
  const sellerId=(!s.vatId||noVA)?(s.taxNo||vat(s.vatId)):"";   // BR-CO-26
  const sellerContact=`
      <ram:DefinedTradeContact>
        <ram:PersonName>${esc(s.managers||s.from)}</ram:PersonName>
        <ram:TelephoneUniversalCommunication><ram:CompleteNumber>${esc(s.fromPhone)}</ram:CompleteNumber></ram:TelephoneUniversalCommunication>
        <ram:EmailURIUniversalCommunication><ram:URIID>${esc(s.fromMail)}</ram:URIID></ram:EmailURIUniversalCommunication>
      </ram:DefinedTradeContact>`;
  const lines=t.lines.map((l,i)=>`
    <ram:IncludedSupplyChainTradeLineItem>
      <ram:AssociatedDocumentLineDocument><ram:LineID>${i+1}</ram:LineID></ram:AssociatedDocumentLineDocument>
      <ram:SpecifiedTradeProduct><ram:Name>${esc(l.desc)}</ram:Name></ram:SpecifiedTradeProduct>
      <ram:SpecifiedLineTradeAgreement><ram:NetPriceProductTradePrice><ram:ChargeAmount>${q(Math.abs(l.price))}</ram:ChargeAmount></ram:NetPriceProductTradePrice></ram:SpecifiedLineTradeAgreement>
      <ram:SpecifiedLineTradeDelivery><ram:BilledQuantity unitCode="${esc(l.unit||"C62")}">${q(l.price<0?-l.qty:l.qty)}</ram:BilledQuantity></ram:SpecifiedLineTradeDelivery>
      <ram:SpecifiedLineTradeSettlement>
        <ram:ApplicableTradeTax><ram:TypeCode>VAT</ram:TypeCode><ram:CategoryCode>${cat}</ram:CategoryCode>${rateEl(l.rate)}</ram:ApplicableTradeTax>
        <ram:SpecifiedTradeSettlementLineMonetarySummation><ram:LineTotalAmount>${a(l.total)}</ram:LineTotalAmount></ram:SpecifiedTradeSettlementLineMonetarySummation>
      </ram:SpecifiedLineTradeSettlement>
    </ram:IncludedSupplyChainTradeLineItem>`).join("");
  const taxes=t.breakdown.map(b=>`
      <ram:ApplicableTradeTax>
        <ram:CalculatedAmount>${a(b.tax)}</ram:CalculatedAmount>
        <ram:TypeCode>VAT</ram:TypeCode>${reason?`
        <ram:ExemptionReason>${esc(reason)}</ram:ExemptionReason>`:""}
        <ram:BasisAmount>${a(b.basis)}</ram:BasisAmount>
        <ram:CategoryCode>${cat}</ram:CategoryCode>
        <ram:RateApplicablePercent>${decimalText(b.rate)}</ram:RateApplicablePercent>
      </ram:ApplicableTradeTax>`).join("");   // BR-DE-14: Satz im Kopf immer angeben (bei O = 0)
  const payText=`${PAYMENT[s.paymentMeans]}. Zahlbar ohne Abzug bis ${t.dueDate.split("-").reverse().join(".")}.`;
  const skontoLine=t.sk?`#SKONTO#TAGE=${t.skDays}#PROZENT=${t.sk.toFixed(2)}#\n`:"";
  const period=s.serviceEnd?`
      <ram:BillingSpecifiedPeriod>
        <ram:StartDateTime>${d(s.serviceDate)}</ram:StartDateTime>
        <ram:EndDateTime>${d(s.serviceEnd)}</ram:EndDateTime>
      </ram:BillingSpecifiedPeriod>`:"";
  const shipTo=tc==="K"?`
      <ram:ShipToTradeParty>
        <ram:Name>${esc(s.to)}</ram:Name>
        <ram:PostalTradeAddress><ram:PostcodeCode>${esc(s.toZip)}</ram:PostcodeCode>${s.toStreet?`<ram:LineOne>${esc(s.toStreet)}</ram:LineOne>`:""}<ram:CityName>${esc(s.toCity)}</ram:CityName><ram:CountryID>${esc(s.toCountry.toUpperCase())}</ram:CountryID></ram:PostalTradeAddress>
      </ram:ShipToTradeParty>`:"";
  const delivery=s.serviceEnd?"":`
      <ram:ActualDeliverySupplyChainEvent><ram:OccurrenceDateTime>${d(s.serviceDate)}</ram:OccurrenceDateTime></ram:ActualDeliverySupplyChainEvent>`;
  const notes=[s.note,s.keepNote?L.de.keep:""].filter(Boolean);
  const taxCur=t.fxNeeded&&home(s)!==cur;
  return `<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100" xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100" xmlns:qdt="urn:un:unece:uncefact:data:standard:QualifiedDataType:100" xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100">
  <rsm:ExchangedDocumentContext>
    <ram:BusinessProcessSpecifiedDocumentContextParameter><ram:ID>urn:fdc:peppol.eu:2017:poacc:billing:01:1.0</ram:ID></ram:BusinessProcessSpecifiedDocumentContextParameter>
    <ram:GuidelineSpecifiedDocumentContextParameter><ram:ID>${profile==="en16931"?"urn:cen.eu:en16931:2017":"urn:cen.eu:en16931:2017#compliant#urn:xeinkauf.de:kosit:xrechnung_3.0"}</ram:ID></ram:GuidelineSpecifiedDocumentContextParameter>
  </rsm:ExchangedDocumentContext>
  <rsm:ExchangedDocument>
    <ram:ID>${esc(s.num)}</ram:ID>
    <ram:TypeCode>${s.docType==="384"?"384":"380"}</ram:TypeCode>
    <ram:IssueDateTime>${d(s.date)}</ram:IssueDateTime>${notes.map(n=>`
    <ram:IncludedNote><ram:Content>${esc(n)}</ram:Content></ram:IncludedNote>`).join("")}
  </rsm:ExchangedDocument>
  <rsm:SupplyChainTradeTransaction>${lines}
    <ram:ApplicableHeaderTradeAgreement>
      <ram:BuyerReference>${esc(s.buyerRef||s.num)}</ram:BuyerReference>
      <ram:SellerTradeParty>${party({id:sellerId,name:s.from,desc:s.managers?`Geschäftsführung: ${s.managers}`:"",legal:s.register,contact:sellerContact,
        street:s.fromStreet,zip:s.fromZip,city:s.fromCity,country:s.fromCountry,mail:s.fromMail,tax:sellerTax})}
      </ram:SellerTradeParty>
      <ram:BuyerTradeParty>${party({name:s.to,street:s.toStreet,zip:s.toZip,city:s.toCity,country:s.toCountry,mail:s.toMail,tax:buyerTax})}
      </ram:BuyerTradeParty>
    </ram:ApplicableHeaderTradeAgreement>
    <ram:ApplicableHeaderTradeDelivery>${shipTo}${delivery}
    </ram:ApplicableHeaderTradeDelivery>
    <ram:ApplicableHeaderTradeSettlement>${taxCur?`
      <ram:TaxCurrencyCode>${esc(home(s))}</ram:TaxCurrencyCode>`:""}
      <ram:InvoiceCurrencyCode>${esc(cur)}</ram:InvoiceCurrencyCode>
      <ram:SpecifiedTradeSettlementPaymentMeans>
        <ram:TypeCode>${esc(s.paymentMeans)}</ram:TypeCode>${s.paymentMeans==="48"?`
        <ram:ApplicableTradeSettlementFinancialCard><ram:ID>${esc(s.cardLast4)}</ram:ID></ram:ApplicableTradeSettlementFinancialCard>`:""}${needsIBAN(s.paymentMeans)?`
        <ram:PayeePartyCreditorFinancialAccount><ram:IBANID>${esc(vat(s.iban))}</ram:IBANID></ram:PayeePartyCreditorFinancialAccount>${s.bic?`
        <ram:PayeeSpecifiedCreditorFinancialInstitution><ram:BICID>${esc(vat(s.bic))}</ram:BICID></ram:PayeeSpecifiedCreditorFinancialInstitution>`:""}`:""}
      </ram:SpecifiedTradeSettlementPaymentMeans>${taxes}${period}
      <ram:SpecifiedTradePaymentTerms>
        <ram:Description>${esc(skontoLine+payText)}</ram:Description>
        <ram:DueDateDateTime>${d(t.dueDate)}</ram:DueDateDateTime>
      </ram:SpecifiedTradePaymentTerms>
      <ram:SpecifiedTradeSettlementHeaderMonetarySummation>
        <ram:LineTotalAmount>${a(t.net)}</ram:LineTotalAmount>
        <ram:TaxBasisTotalAmount>${a(t.net)}</ram:TaxBasisTotalAmount>
        <ram:TaxTotalAmount currencyID="${esc(cur)}">${a(t.tax)}</ram:TaxTotalAmount>${taxCur?`
        <ram:TaxTotalAmount currencyID="${esc(home(s))}">${a(t.taxHome)}</ram:TaxTotalAmount>`:""}
        <ram:GrandTotalAmount>${a(t.gross)}</ram:GrandTotalAmount>
        <ram:DuePayableAmount>${a(t.gross)}</ram:DuePayableAmount>
      </ram:SpecifiedTradeSettlementHeaderMonetarySummation>${s.docType==="384"?`
      <ram:InvoiceReferencedDocument>
        <ram:IssuerAssignedID>${esc(s.refNum)}</ram:IssuerAssignedID>
        <ram:FormattedIssueDateTime><qdt:DateTimeString format="102">${s.refDate.replaceAll("-","")}</qdt:DateTimeString></ram:FormattedIssueDateTime>
      </ram:InvoiceReferencedDocument>`:""}
    </ram:ApplicableHeaderTradeSettlement>
  </rsm:SupplyChainTradeTransaction>
</rsm:CrossIndustryInvoice>
`;
}

/* ---------- Aktionen ---------- */
function download(name,text,type){const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([text],{type}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
function msg(text,ok){$("msg").textContent=text;$("msg").className=ok?"ok":"err"}
function check(){validationShown=true;const miss=validate(state());if(miss.length){msg("Bitte korrigiere folgende Angaben:\n• "+miss.join("\n• "),false);const first=document.querySelector('[aria-invalid="true"]');first?.closest("details")?.setAttribute("open","");first?.focus();return false}return true}

$("xml").onclick=()=>{
  if(!check())return;const s=state();
  download(`XRechnung-${s.num.replace(/[^\w.-]+/g,"_")}.xml`,buildXML(s),"application/xml");
  msg("E-Rechnung erstellt. Schicke die XML-Datei per E-Mail an deinen Kunden und bewahre das Original auf.",true);
};
$("print").onclick=()=>{if(check()){msg("",true);window.print()}};
const scriptLoads=new Map();
function loadScript(src){if(scriptLoads.has(src))return scriptLoads.get(src);const promise=new Promise((ok,err)=>{const e=document.createElement("script");e.src=src;e.onload=ok;e.onerror=()=>{e.remove();scriptLoads.delete(src);err(new Error(src))};document.head.appendChild(e)});scriptLoads.set(src,promise);return promise;}
$("zugferd").onclick=async()=>{
  if(!check())return;const s=state();
  msg("PDF wird erstellt …",true);
  try{
    for(const f of ["vendor/pdf-lib.min.js","vendor/fontkit.umd.min.js","vendor/fonts.js"])await loadScript(f);
    const {buildZugferd}=await import("./zugferd.js");
    const bytes=await buildZugferd(s,view(s),buildXML(s,"en16931"),qrMatrix);
    download(`Rechnung-${s.num.replace(/[^\w.-]+/g,"_")}.pdf`,bytes,"application/pdf");
    msg("ZUGFeRD-Rechnung erstellt: ein normales PDF zum Lesen mit eingebetteter E-Rechnung (EN 16931). Bitte das Original aufbewahren und bei Bedarf extern validieren.",true);
  }catch(e){console.error(e);msg("Das PDF konnte nicht erstellt werden: "+e.message,false)}
};
document.addEventListener("input",e=>{const t=e.target;if(t.dataset.i!==undefined)items[t.dataset.i][t.dataset.k]=t.value;t.classList?.remove("missing");update()});
document.addEventListener("change",e=>{const t=e.target;if(t.dataset.i!==undefined)items[t.dataset.i][t.dataset.k]=t.value;
  if(t.id==="taxCase"||t.id==="fromCountry")renderItems();update()});
document.addEventListener("click",e=>{if(e.target.dataset.del!==undefined){items.splice(+e.target.dataset.del,1);renderItems();update()}});
$("add").onclick=()=>{items.push({desc:"",qty:1,unit:"C62",price:0,rate:defRate()});renderItems();update()};
$("export").onclick=()=>download(`rechnung-${$("num").value||"entwurf"}.json`,JSON.stringify(state(),null,2),"application/json");
$("importBtn").onclick=()=>$("importFile").click();
$("importFile").onchange=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{try{load(JSON.parse(r.result))}catch(err){msg("Datei konnte nicht gelesen werden.",false)}};r.readAsText(f)};
$("reset").onclick=()=>{const s=state();
  ["to","toStreet","toZip","toCity","toMail","toVatId","buyerRef","note","refNum","refDate","serviceEnd","fx","cardLast4"].forEach(k=>s[k]="");
  s.toCountry="DE";s.docType="380";s.keepNote=false;s.num=nextNum(s.num);s.date=today();s.serviceDate=today();
  s.items=[{desc:"",qty:1,unit:"C62",price:0,rate:defRate()}];load(s);msg("",true)};
function nextNum(n){const m=String(n).match(/(\d+)$/);return m?n.replace(/\d+$/,String(+m[1]+1).padStart(m[1].length,"0")):new Date().getFullYear()+"-001"}
function load(s){
  if(!s||typeof s!=="object"||!Array.isArray(s.items)||s.items.length>1000||s.items.some(i=>!i||typeof i!=="object"))throw new Error("Ungültiger Entwurf");
  validationShown=false;clearErrors();msg("",true);
  s={...s,paymentMeans:s.paymentMeans||"58",cardLast4:s.cardLast4||""};
  if(s.small==="1"&&!s.taxCase)s.taxCase="KU";           // Übernahme aus Version 2
  fields.forEach(f=>{$(f).value=s[f]??fieldDefaults[f]});checks.forEach(c=>$(c).checked=s[c]===undefined?c==="qrCode":!!s[c]);
  if(!$("taxCase").value)$("taxCase").value="S";if(!$("docType").value)$("docType").value="380";if(!$("lang").value)$("lang").value="de";
  const r=s.vat?num(s.vat):defRate();
  items=(s.items||[]).map(i=>({unit:"C62",rate:r,...i}));renderItems();update()}

if(!document.body.dataset.noServiceWorker&&"serviceWorker" in navigator&&(location.protocol==="https:"||location.hostname==="localhost"||location.hostname==="127.0.0.1"))navigator.serviceWorker.register("sw.js").catch(()=>{});
$("saveDraft").onchange=()=>{
  try {
    if($("saveDraft").checked){localStorage.setItem(STORAGE_CHOICE,"yes");update();$("storageStatus").textContent="Der Entwurf wird auf diesem Gerät gespeichert.";}
    else {clearInvoiceData(localStorage);$("storageStatus").textContent="Gespeicherte Entwürfe wurden entfernt. Die aktuelle Rechnung bleibt bis zum Schließen geöffnet.";}
  }catch{$("storageStatus").textContent="Der Browser erlaubt keinen Zugriff auf den lokalen Speicher.";}
};
$("clearData").onclick=()=>{
  $("saveDraft").checked=false;
  try{clearInvoiceData(localStorage);$("storageStatus").textContent="Alle lokal gespeicherten Invoice-Kit-Entwürfe und Einstellungen wurden gelöscht. Die geöffnete Rechnung bleibt im Arbeitsspeicher.";}
  catch{$("storageStatus").textContent="Löschen fehlgeschlagen. Bitte den Website-Speicher in den Browsereinstellungen löschen.";}
};
let saved=null;try{saved=readDraft(localStorage,KEY);$("saveDraft").checked=localStorage.getItem(STORAGE_CHOICE)==="yes";}catch{}
if(saved&&!$("saveDraft").checked)$("storageStatus").textContent="Ein vorhandener Entwurf wurde geladen. Weitere Änderungen werden erst nach deiner Zustimmung gespeichert. Mit der Löschfunktion entfernst du den gespeicherten Entwurf.";
const initialDraft={num:new Date().getFullYear()+"-001",date:today(),serviceDate:today(),taxCase:"S",
  items:[{desc:"Webdesign: Landingpage",qty:1,unit:"LS",price:850,rate:19},{desc:"Beratung",qty:3,unit:"HUR",price:90,rate:19}],
  note:"Vielen Dank für Ihren Auftrag!"};
try{load(saved||initialDraft)}catch{$("saveDraft").checked=false;load(initialDraft);$("storageStatus").textContent="Der gespeicherte Entwurf ist beschädigt. Er wurde nicht überschrieben. Du kannst ihn über die Löschfunktion entfernen.";}

export {state, load, buildXML, view, qrMatrix, epcPayload, check};
