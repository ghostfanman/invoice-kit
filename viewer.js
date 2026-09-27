import {num as parseNumber, validDate} from './core.js';
import {checks} from './viewer-check.js';

const $=id=>document.getElementById(id);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const TYPES={"380":"Rechnung","381":"Gutschrift","383":"Belastungsanzeige","384":"Rechnungskorrektur","386":"Vorauszahlungsrechnung","389":"Gutschrift (Gutschriftverfahren)","326":"Teilrechnung","875":"Teilrechnung (Bau)","876":"Teilschlussrechnung (Bau)","877":"Schlussrechnung (Bau)","751":"Rechnungsinformation"};
const UNITS={C62:"Stk.",H87:"Stk.",XPP:"Stk.",EA:"Stk.",HUR:"Std.",MIN:"Min.",DAY:"Tage",WEE:"Wochen",MON:"Monate",ANN:"Jahre",LS:"pauschal",KGM:"kg",GRM:"g",TNE:"t",MTR:"m",KMT:"km",MTK:"m²",MTQ:"m³",LTR:"l",KWH:"kWh",SET:"Satz",PR:"Paar"};
const CATS={S:"Normalsatz",Z:"Nullsatz",E:"steuerbefreit",AE:"Reverse Charge",K:"innergemeinschaftliche Lieferung",G:"Ausfuhr",O:"nicht steuerbar",L:"Kanarische Inseln",M:"Ceuta/Melilla"};
const MEANS={"10":"Bar","30":"Überweisung","42":"Zahlung auf Bankkonto","48":"Kartenzahlung","49":"Lastschrift","57":"Dauerauftrag","58":"SEPA-Überweisung","59":"SEPA-Lastschrift","68":"Online-Zahlung","97":"Verrechnung","ZZZ":"sonstige"};
let lastXml="",lastName="rechnung.xml";

/* --- XML-Helfer (namespace-unabhängig über localName) --- */
const num=value=>/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(String(value??"").trim())?parseNumber(value):null;
const ch=(el,name)=>el?Array.from(el.children).filter(c=>c.localName===name):[];
const node=(el,path)=>{let cur=el;for(const p of path.split("/")){cur=ch(cur,p)[0];if(!cur)return null}return cur};
const nodes=(el,path)=>{const parts=path.split("/"),last=parts.pop();const parent=parts.length?node(el,parts.join("/")):el;return ch(parent,last)};
const tx=(el,path)=>{const n=path?node(el,path):el;return n?n.textContent.trim():""};
const optional=(el,path)=>node(el,path) ? num(tx(el,path)) : 0;
const adjustments=(el,path,flag,amount,wanted)=>{
  const values=nodes(el,path).filter(n=>["true","1"].includes(tx(n,flag))===wanted).map(n=>num(tx(n,amount)));
  return values.every(n=>n!==null)?values.reduce((a,b)=>a+b,0):null;
};
const d8=s=>s&&/^\d{8}$/.test(s)?`${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}`:s;

function parseCII(r){
  const doc=node(r,"ExchangedDocument"),tr=node(r,"SupplyChainTradeTransaction");
  const ag=node(tr,"ApplicableHeaderTradeAgreement"),dl=node(tr,"ApplicableHeaderTradeDelivery"),st=node(tr,"ApplicableHeaderTradeSettlement");
  const party=p=>p&&{id:tx(p,"ID"),name:tx(p,"Name"),street:[tx(p,"PostalTradeAddress/LineOne"),tx(p,"PostalTradeAddress/LineTwo")].filter(Boolean).join(", "),
    zip:tx(p,"PostalTradeAddress/PostcodeCode"),city:tx(p,"PostalTradeAddress/CityName"),country:tx(p,"PostalTradeAddress/CountryID"),
    vat:(ch(p,"SpecifiedTaxRegistration").map(t=>node(t,"ID")).find(i=>i&&i.getAttribute("schemeID")==="VA")||{}).textContent||"",
    taxNo:(ch(p,"SpecifiedTaxRegistration").map(t=>node(t,"ID")).find(i=>i&&i.getAttribute("schemeID")==="FC")||{}).textContent||"",
    legal:tx(p,"SpecifiedLegalOrganization/ID"),mail:tx(p,"URIUniversalCommunication/URIID"),
    contact:[tx(p,"DefinedTradeContact/PersonName"),tx(p,"DefinedTradeContact/TelephoneUniversalCommunication/CompleteNumber"),tx(p,"DefinedTradeContact/EmailURIUniversalCommunication/URIID")].filter(Boolean).join(" · ")};
  const sum=node(st,"SpecifiedTradeSettlementHeaderMonetarySummation");
  const pm=node(st,"SpecifiedTradeSettlementPaymentMeans");
  return {syntax:"CII",profile:tx(r,"ExchangedDocumentContext/GuidelineSpecifiedDocumentContextParameter/ID"),
    id:tx(doc,"ID"),type:tx(doc,"TypeCode"),date:d8(tx(doc,"IssueDateTime/DateTimeString")),notes:nodes(doc,"IncludedNote").map(n=>tx(n,"Content")).filter(Boolean),
    seller:party(node(ag,"SellerTradeParty")),buyer:party(node(ag,"BuyerTradeParty")),buyerRef:tx(ag,"BuyerReference"),
    delivery:d8(tx(dl,"ActualDeliverySupplyChainEvent/OccurrenceDateTime/DateTimeString")),
    period:[d8(tx(st,"BillingSpecifiedPeriod/StartDateTime/DateTimeString")),d8(tx(st,"BillingSpecifiedPeriod/EndDateTime/DateTimeString"))],
    currency:tx(st,"InvoiceCurrencyCode"),
    payment:{means:tx(pm,"TypeCode"),iban:tx(pm,"PayeePartyCreditorFinancialAccount/IBANID"),bic:tx(pm,"PayeeSpecifiedCreditorFinancialInstitution/BICID"),
      terms:nodes(st,"SpecifiedTradePaymentTerms").map(t=>tx(t,"Description")).filter(Boolean).join("\n"),due:d8(tx(st,"SpecifiedTradePaymentTerms/DueDateDateTime/DateTimeString")),ref:tx(st,"PaymentReference")},
    taxes:nodes(st,"ApplicableTradeTax").map(t=>({basis:num(tx(t,"BasisAmount")),tax:num(tx(t,"CalculatedAmount")),cat:tx(t,"CategoryCode"),rate:num(tx(t,"RateApplicablePercent")),reason:tx(t,"ExemptionReason")})),
    totals:{lines:num(tx(sum,"LineTotalAmount")),net:num(tx(sum,"TaxBasisTotalAmount")),tax:num((nodes(sum,"TaxTotalAmount").find(n=>!n.getAttribute("currencyID")||n.getAttribute("currencyID")===tx(st,"InvoiceCurrencyCode"))||{}).textContent),
      gross:num(tx(sum,"GrandTotalAmount")),allowance:optional(sum,"AllowanceTotalAmount"),charge:optional(sum,"ChargeTotalAmount"),rounding:optional(sum,"RoundingAmount"),prepaid:optional(sum,"TotalPrepaidAmount"),due:num(tx(sum,"DuePayableAmount"))},
    ref:tx(st,"InvoiceReferencedDocument/IssuerAssignedID"),
    lines:nodes(tr,"IncludedSupplyChainTradeLineItem").map(l=>{const q=node(l,"SpecifiedLineTradeDelivery/BilledQuantity");return {
      id:tx(l,"AssociatedDocumentLineDocument/LineID"),name:tx(l,"SpecifiedTradeProduct/Name"),desc:tx(l,"SpecifiedTradeProduct/Description"),
      qty:num(q&&q.textContent),unit:q&&q.getAttribute("unitCode"),price:num(tx(l,"SpecifiedLineTradeAgreement/NetPriceProductTradePrice/ChargeAmount")),
      baseQty:node(l,"SpecifiedLineTradeAgreement/NetPriceProductTradePrice/BasisQuantity")?num(tx(l,"SpecifiedLineTradeAgreement/NetPriceProductTradePrice/BasisQuantity")):1,
      allowance:adjustments(l,"SpecifiedLineTradeSettlement/SpecifiedTradeAllowanceCharge","ChargeIndicator/Indicator","ActualAmount",false),charge:adjustments(l,"SpecifiedLineTradeSettlement/SpecifiedTradeAllowanceCharge","ChargeIndicator/Indicator","ActualAmount",true),
      rate:num(tx(l,"SpecifiedLineTradeSettlement/ApplicableTradeTax/RateApplicablePercent")),total:num(tx(l,"SpecifiedLineTradeSettlement/SpecifiedTradeSettlementLineMonetarySummation/LineTotalAmount"))}})};
}
function parseUBL(r){
  const credit=r.localName==="CreditNote";
  const party=p=>p&&{id:tx(p,"PartyIdentification/ID"),name:tx(p,"PartyName/Name")||tx(p,"PartyLegalEntity/RegistrationName"),street:[tx(p,"PostalAddress/StreetName"),tx(p,"PostalAddress/AdditionalStreetName")].filter(Boolean).join(", "),
    zip:tx(p,"PostalAddress/PostalZone"),city:tx(p,"PostalAddress/CityName"),country:tx(p,"PostalAddress/Country/IdentificationCode"),
    vat:(ch(p,"PartyTaxScheme").find(t=>tx(t,"TaxScheme/ID")==="VAT")?tx(ch(p,"PartyTaxScheme").find(t=>tx(t,"TaxScheme/ID")==="VAT"),"CompanyID"):""),
    taxNo:(ch(p,"PartyTaxScheme").find(t=>tx(t,"TaxScheme/ID")!=="VAT")?tx(ch(p,"PartyTaxScheme").find(t=>tx(t,"TaxScheme/ID")!=="VAT"),"CompanyID"):""),
    legal:tx(p,"PartyLegalEntity/CompanyID"),mail:tx(p,"EndpointID"),
    contact:[tx(p,"Contact/Name"),tx(p,"Contact/Telephone"),tx(p,"Contact/ElectronicMail")].filter(Boolean).join(" · ")};
  const pm=node(r,"PaymentMeans"),mt=node(r,"LegalMonetaryTotal"),cur=tx(r,"DocumentCurrencyCode");
  const taxTotal=nodes(r,"TaxTotal").find(t=>{const a=node(t,"TaxAmount");return a&&(!a.getAttribute("currencyID")||a.getAttribute("currencyID")===cur)})||node(r,"TaxTotal");
  return {syntax:"UBL",profile:tx(r,"CustomizationID"),id:tx(r,"ID"),type:tx(r,credit?"CreditNoteTypeCode":"InvoiceTypeCode")||(credit?"381":"380"),date:tx(r,"IssueDate"),
    notes:nodes(r,"Note").map(n=>tx(n)).filter(Boolean),seller:party(node(r,"AccountingSupplierParty/Party")),buyer:party(node(r,"AccountingCustomerParty/Party")),buyerRef:tx(r,"BuyerReference"),
    delivery:tx(r,"Delivery/ActualDeliveryDate"),period:[tx(r,"InvoicePeriod/StartDate"),tx(r,"InvoicePeriod/EndDate")],currency:cur,
    payment:{means:tx(pm,"PaymentMeansCode"),iban:tx(pm,"PayeeFinancialAccount/ID"),bic:tx(pm,"PayeeFinancialAccount/FinancialInstitutionBranch/ID"),
      terms:tx(r,"PaymentTerms/Note"),due:tx(r,"DueDate")||tx(pm,"PaymentDueDate"),ref:tx(pm,"PaymentID")},
    taxes:nodes(taxTotal,"TaxSubtotal").map(t=>({basis:num(tx(t,"TaxableAmount")),tax:num(tx(t,"TaxAmount")),cat:tx(t,"TaxCategory/ID"),rate:num(tx(t,"TaxCategory/Percent")),reason:tx(t,"TaxCategory/TaxExemptionReason")})),
    totals:{lines:num(tx(mt,"LineExtensionAmount")),net:num(tx(mt,"TaxExclusiveAmount")),tax:num(tx(taxTotal,"TaxAmount")),gross:num(tx(mt,"TaxInclusiveAmount")),allowance:optional(mt,"AllowanceTotalAmount"),charge:optional(mt,"ChargeTotalAmount"),rounding:optional(mt,"PayableRoundingAmount"),prepaid:optional(mt,"PrepaidAmount"),due:num(tx(mt,"PayableAmount"))},
    ref:tx(r,"BillingReference/InvoiceDocumentReference/ID"),
    lines:nodes(r,credit?"CreditNoteLine":"InvoiceLine").map(l=>{const q=node(l,credit?"CreditedQuantity":"InvoicedQuantity");return {
      id:tx(l,"ID"),name:tx(l,"Item/Name"),desc:tx(l,"Item/Description"),qty:num(q&&q.textContent),unit:q&&q.getAttribute("unitCode"),
      price:num(tx(l,"Price/PriceAmount")),baseQty:node(l,"Price/BaseQuantity")?num(tx(l,"Price/BaseQuantity")):1,
      allowance:adjustments(l,"AllowanceCharge","ChargeIndicator","Amount",false),charge:adjustments(l,"AllowanceCharge","ChargeIndicator","Amount",true),rate:num(tx(l,"Item/ClassifiedTaxCategory/Percent")),total:num(tx(l,"LineExtensionAmount"))}})};
}
function parseXml(text){
  if(/<!DOCTYPE|<!ENTITY/i.test(text))throw new Error("XML mit DTD oder Entity-Deklarationen wird nicht unterstützt.");
  const dom=new DOMParser().parseFromString(text,"application/xml");
  if(dom.getElementsByTagName("parsererror").length)throw new Error("Die Datei ist kein gültiges XML.");
  const r=dom.documentElement;
  if(r.localName==="CrossIndustryInvoice")return parseCII(r);
  if(r.localName==="Invoice"||r.localName==="CreditNote")return parseUBL(r);
  throw new Error(`Unbekanntes Format (<${r.localName}>). Erwartet wird XRechnung/ZUGFeRD (CII) oder UBL.`);
}

/* --- ZUGFeRD / Factur-X: eingebettete XML aus dem PDF holen --- */
const scriptLoads=new Map();
function loadScript(src){if(scriptLoads.has(src))return scriptLoads.get(src);const promise=new Promise((ok,err)=>{const e=document.createElement("script");e.src=src;e.onload=ok;e.onerror=()=>{e.remove();scriptLoads.delete(src);err(new Error(src))};document.head.appendChild(e)});scriptLoads.set(src,promise);return promise;}
async function xmlFromPdf(bytes){
  await loadScript("vendor/pdf-lib.min.js");
  const {PDFDocument,PDFName,PDFArray,PDFDict,decodePDFRawStream,PDFRawStream}=PDFLib;
  const pdf=await PDFDocument.load(bytes,{ignoreEncryption:true,updateMetadata:false});
  const found=[];
  const str=o=>o?(o.decodeText?o.decodeText():String(o)):"";
  const visited=new Set();
  const walk=tree=>{if(!(tree instanceof PDFDict)||visited.has(tree))return;visited.add(tree);
    const names=tree.lookup(PDFName.of("Names"));
    if(names instanceof PDFArray)for(let i=0;i<names.size();i+=2){const spec=names.lookup(i+1);if(spec instanceof PDFDict)found.push({name:str(names.lookup(i))||str(spec.lookup(PDFName.of("UF")))||str(spec.lookup(PDFName.of("F"))),spec})}
    const kids=tree.lookup(PDFName.of("Kids"));if(kids instanceof PDFArray)for(let i=0;i<kids.size();i++)walk(kids.lookup(i))};
  const namesDict=pdf.catalog.lookup(PDFName.of("Names"));
  if(namesDict instanceof PDFDict)walk(namesDict.lookup(PDFName.of("EmbeddedFiles")));
  const associated=pdf.catalog.lookup(PDFName.of("AF"));
  if(associated instanceof PDFArray)for(let i=0;i<associated.size();i++){const spec=associated.lookup(i);if(spec instanceof PDFDict)found.push({name:str(spec.lookup(PDFName.of("UF")))||str(spec.lookup(PDFName.of("F"))),spec})}
  const pref=["factur-x.xml","zugferd-invoice.xml","xrechnung.xml","ZUGFeRD-invoice.xml"];
  found.sort((a,b)=>(pref.indexOf(b.name)>-1)-(pref.indexOf(a.name)>-1));
  const hit=found.find(f=>/\.xml$/i.test(f.name));
  if(!hit)throw new Error("Dieses PDF enthält keine unterstützte eingebettete XML-Rechnung.");
  const embedded=hit.spec.lookup(PDFName.of("EF"));
  if(!(embedded instanceof PDFDict))throw new Error("Der XML-Anhang enthält keinen lesbaren Dateistream.");
  const stream=embedded.lookup(PDFName.of("F"))||embedded.lookup(PDFName.of("UF"));
  if(!stream)throw new Error("Der XML-Anhang ist leer oder beschädigt.");
  const data=stream instanceof PDFRawStream?decodePDFRawStream(stream).decode():stream.getContents();
  return {name:hit.name,text:new TextDecoder("utf-8").decode(data)};
}

/* --- Prüfung der Pflichtangaben --- */
/* --- Darstellung --- */
function render(v){
  const cur=v.currency||"EUR";
  const money=n=>n===null||n===undefined?"fehlt":esc((()=>{try{return new Intl.NumberFormat("de-DE",{style:"currency",currency:cur}).format(n)}catch{return n.toFixed(2)+" "+cur}})());
  const dt=s=>esc(validDate(s)?new Date(s+"T12:00:00").toLocaleDateString("de-DE"):(s||""));
  const party=(p,label)=>p?`<div><h3>${label}</h3><strong>${esc(p.name)}</strong><div class="pre">${esc([p.street,[p.zip,p.city].filter(Boolean).join(" "),p.country].filter(Boolean).join("\n"))}</div>
    ${p.vat?`<div>USt-IdNr.: ${esc(p.vat)}</div>`:""}${p.taxNo?`<div>Steuernr.: ${esc(p.taxNo)}</div>`:""}${p.legal?`<div>Register: ${esc(p.legal)}</div>`:""}
    ${p.contact?`<div class="muted">${esc(p.contact)}</div>`:""}${p.mail&&!(p.contact||"").includes(p.mail)?`<div class="muted">${esc(p.mail)}</div>`:""}</div>`:"";
  const svc=v.period[0]?`Leistungszeitraum: ${dt(v.period[0])} bis ${dt(v.period[1])}`:v.delivery?`Leistungsdatum: ${dt(v.delivery)}`:"";
  $("inv").innerHTML=`
    <div class="top"><div><h1>${esc(TYPES[v.type]||"Rechnung")}</h1><div>Nr. ${esc(v.id)}</div><div>Datum: ${dt(v.date)}</div>${svc?`<div>${svc}</div>`:""}
      ${v.payment.due?`<div>Fällig: ${dt(v.payment.due)}</div>`:""}${v.ref?`<div>Bezug: Rechnung ${esc(v.ref)}</div>`:""}${v.buyerRef?`<div>Käuferreferenz: ${esc(v.buyerRef)}</div>`:""}</div>
      <div class="muted" style="text-align:right;font-size:12px">Format: ${esc(v.syntax)}<br>${esc(v.profile)}</div></div>
    <div class="parties">${party(v.seller,"Von")}${party(v.buyer,"An")}</div>
    <div class="table-wrap"><table><thead><tr><th>#</th><th>Beschreibung</th><th class="r">Menge</th><th class="r">Einzelpreis</th><th class="r">USt.</th><th class="r">Summe</th></tr></thead><tbody>
    ${v.lines.map(l=>`<tr><td>${esc(l.id)}</td><td><strong>${esc(l.name)}</strong>${l.desc?`<div class="muted pre">${esc(l.desc)}</div>`:""}</td><td class="r">${l.qty===null?"":l.qty.toLocaleString("de-DE")} ${esc(UNITS[l.unit]||l.unit||"")}</td>
      <td class="r">${money(l.price)}</td><td class="r">${l.rate===null?"":l.rate.toLocaleString("de-DE")+" %"}</td><td class="r">${money(l.total)}</td></tr>`).join("")}
    </tbody></table></div>
    <div class="tot"><div><span>Netto</span><span>${money(v.totals.net)}</span></div>
      ${v.taxes.map(t=>`<div><span>${t.cat==="S"||t.cat==="Z"?`USt. ${t.rate===null?"fehlt":t.rate.toLocaleString("de-DE")} % auf ${money(t.basis)}`:esc(CATS[t.cat]||t.cat)}</span><span>${money(t.tax)}</span></div>`).join("")}
      <div class="big"><span>Gesamt</span><span>${money(v.totals.gross)}</span></div>
      ${v.totals.prepaid?`<div><span>Bereits bezahlt</span><span>${money(v.totals.prepaid)}</span></div>`:""}
      ${v.totals.due!==v.totals.gross?`<div><strong>Zu zahlen</strong><strong>${money(v.totals.due)}</strong></div>`:""}</div>
    ${v.taxes.filter(t=>t.reason).map(t=>`<p><strong>${esc(t.reason)}</strong></p>`).join("")}
    <p>${esc(MEANS[v.payment.means]||"")}${v.payment.iban?` · IBAN: ${esc(v.payment.iban)}`:""}${v.payment.bic?` · BIC: ${esc(v.payment.bic)}`:""}${v.payment.ref?` · Verwendungszweck: ${esc(v.payment.ref)}`:""}</p>
    ${v.payment.terms?`<p class="pre">${esc(v.payment.terms.replace(/#SKONTO#TAGE=(\d+)#PROZENT=([\d.]+)#[^\n]*/g,(m,t,p)=>`Skonto: ${parseFloat(p).toLocaleString("de-DE")} % bei Zahlung innerhalb von ${t} Tagen`))}</p>`:""}
    ${v.notes.map(n=>`<p class="pre muted">${esc(n)}</p>`).join("")}`;
  $("checks").innerHTML=checks(v).map(c=>`<li class="${c.cls}">${esc(c.t)}</li>`).join("");
}

let openSequence=0;
async function open(file){
  const sequence=++openSequence;
  $("status").className="";$("status").textContent="Wird gelesen …";$("result").classList.add("hide");
  try{
    const buf=new Uint8Array(await file.arrayBuffer());
    const isPdf=buf[0]===0x25&&buf[1]===0x50&&buf[2]===0x44&&buf[3]===0x46;
    let text,name=file.name.replace(/\.[^.]+$/,"")+".xml";
    if(isPdf){const r=await xmlFromPdf(buf);text=r.text;name=r.name}else text=new TextDecoder("utf-8").decode(buf);
    if(sequence!==openSequence)return;
    const v=parseXml(text);lastXml=text;lastName=name;
    render(v);$("result").classList.remove("hide");
    $("status").textContent=isPdf?`ZUGFeRD/Factur-X-PDF erkannt, eingebettete Datei: ${name}`:`E-Rechnung erkannt (${v.syntax}).`;
  }catch(e){if(sequence!==openSequence)return;console.error(e);$("status").className="err";$("status").textContent=e.message||String(e)}
}
const drop=$("drop");
drop.onclick=e=>{if(e.target!==$("file"))$("file").click()};
drop.onkeydown=e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();$("file").click()}};
$("file").onchange=e=>{if(e.target.files[0])open(e.target.files[0])};
["dragenter","dragover"].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.add("over")}));
["dragleave","drop"].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.remove("over")}));
drop.addEventListener("drop",e=>{const f=e.dataTransfer.files[0];if(f)open(f)});
$("dlXml").onclick=()=>{const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([lastXml],{type:"application/xml"}));a.download=lastName;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)};
if(!document.body.dataset.noServiceWorker&&"serviceWorker" in navigator&&(location.protocol==="https:"||location.hostname==="localhost"||location.hostname==="127.0.0.1"))navigator.serviceWorker.register("sw.js").catch(()=>{});

export {parseXml, render, xmlFromPdf};
