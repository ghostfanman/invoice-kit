/* Reine Geschäftslogik. Keine DOM-, Netzwerk- oder Speicherzugriffe. */
export const isMissing = value => value == null || String(value).trim() === '';
export function num(value) {
  if (isMissing(value)) return null;
  const text = String(value).trim().replace(',', '.');
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(text)) return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}
function decimal(value) {
  const n = num(value);
  if (n === null) throw new TypeError('Ungültige Zahl');
  const [base, exp = '0'] = String(n).toLowerCase().split('e');
  const places = (base.split('.')[1] || '').length - Number(exp);
  const coefficient = BigInt(base.replace('.', ''));
  return places < 0 ? [coefficient * 10n ** BigInt(-places), 0] : [coefficient, places];
}
export function decimalText(value) {
  const [coefficient, scale] = decimal(value);
  const sign = coefficient < 0n ? '-' : '';
  const digits = String(coefficient < 0n ? -coefficient : coefficient).padStart(scale + 1, '0');
  return sign + (scale ? digits.slice(0, -scale) + '.' + digits.slice(-scale) : digits);
}
// Dezimale Multiplikation und kaufmännische Rundung, auch für negative Korrekturen.
export function productCents(...values) {
  let coefficient = 1n, scale = 0;
  for (const value of values) { const [c, s] = decimal(value); coefficient *= c; scale += s; }
  const divisor = 10n ** BigInt(scale);
  const signed = coefficient * 100n, absolute = signed < 0n ? -signed : signed;
  const rounded = (absolute + divisor / 2n) / divisor * (signed < 0n ? -1n : 1n);
  const result = Number(rounded);
  if (!Number.isSafeInteger(result)) throw new RangeError('Betrag ist zu groß');
  return result;
}
export const cents = n => num(n) === null ? null : productCents(n);
export const r2 = n => productCents(n) / 100;
export function validDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value || '') && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}
export function addDays(iso, days) {
  if (!validDate(iso) || !Number.isInteger(days) || Math.abs(days) > 36500) return '';
  const date = new Date(iso + 'T12:00:00Z'); date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
const HOME = {CH:'CHF',GB:'GBP',PL:'PLN',SE:'SEK',DK:'DKK',CZ:'CZK',HU:'HUF',RO:'RON',NO:'NOK'};
export const home = s => HOME[(s.fromCountry || 'DE').toUpperCase()] || 'EUR';
// Unentgeltliche Rechnung: Positionen zeigen den Warenwert, ein Nachlass von 100 % je Steuersatz
// (Nachlass auf Belegebene, EN 16931 BG-20) setzt Netto, Steuer und Zahlbetrag auf null.
export const FREE = Object.freeze({gift:'Geschenk',promo:'Werbezweck'});
export const isFree = s => Object.hasOwn(FREE, s.free || '');
export function totals(s) {
  const tc = s.taxCase, number = v => num(v) ?? 0, free = isFree(s);
  const lines = (s.items || []).map(it => {
    const qty = number(it.qty), price = number(it.price), rate = tc === 'S' ? number(it.rate) : 0;
    return {...it, qty, price, rate, total: productCents(qty, price) / 100};
  });
  const groups = new Map();
  for (const line of lines) groups.set(line.rate, (groups.get(line.rate) || 0) + cents(line.total));
  const byRate = (a,b) => b.rate - a.rate;
  const allowances = free ? [...groups].filter(([, basis]) => basis !== 0).map(([rate, basis]) => ({rate, amount: basis / 100})).sort(byRate) : [];
  const breakdown = [...groups].map(([rate, basis]) => free ? {rate, basis: 0, tax: 0} : {rate, basis: basis / 100,
    tax: tc === 'S' ? productCents(basis / 100, rate, 0.01) / 100 : 0}).sort(byRate);
  const lineCents = lines.reduce((a,l) => a + cents(l.total), 0);
  const allowanceCents = allowances.reduce((a,x) => a + cents(x.amount), 0);
  const netCents = lineCents - allowanceCents;
  const taxCents = breakdown.reduce((a,b) => a + cents(b.tax), 0);
  if (!Number.isSafeInteger(netCents + taxCents)) throw new RangeError('Gesamtbetrag ist zu groß');
  const net = netCents / 100, tax = taxCents / 100, gross = (netCents + taxCents) / 100;
  const sk = free ? 0 : number(s.skonto), skDays = number(s.skontoDays), fx = number(s.fx);
  const discount = productCents(gross, sk, 0.01);
  return {tc, free, lines, lineTotal: lineCents / 100, allowances, allowance: allowanceCents / 100, breakdown, net, tax, gross,
    dueDate:free ? '' : addDays(s.date, number(s.due)), sk, skDays,
    skDate:addDays(s.date,skDays), skPay:(netCents + taxCents - discount) / 100,
    fxNeeded:s.cur !== home(s) && tax !== 0, fx, taxHome:productCents(tax,fx) / 100};
}
export const normalizeIBAN = value => String(value || '').replace(/\s/g, '').toUpperCase();
const IBAN_LENGTHS = {AD:24,AE:23,AL:28,AT:20,AZ:28,BA:20,BE:16,BG:22,BH:22,BI:27,BR:29,BY:28,CH:21,CR:22,CY:28,CZ:24,DE:22,DJ:27,DK:18,DO:28,EE:20,EG:29,ES:24,FI:18,FK:18,FO:18,FR:27,GB:22,GE:22,GI:23,GL:18,GR:27,GT:28,HR:21,HU:28,IE:22,IL:23,IQ:23,IS:26,IT:27,JO:30,KW:30,KZ:20,LB:28,LC:32,LI:21,LT:20,LU:20,LV:21,LY:25,MC:27,MD:24,ME:22,MK:19,MN:20,MR:27,MT:31,MU:30,NI:28,NL:18,NO:15,OM:23,PK:24,PL:28,PS:29,PT:25,QA:29,RO:24,RS:22,RU:33,SA:24,SC:31,SD:18,SE:24,SI:19,SK:24,SM:27,SO:23,ST:25,SV:28,TL:23,TN:24,TR:26,UA:29,VA:22,VG:24,XK:20};
export function validIBAN(value) {
  const iban = normalizeIBAN(value);
  if (!/^[A-Z]{2}\d{2}[A-Z\d]+$/.test(iban) || IBAN_LENGTHS[iban.slice(0,2)] !== iban.length) return false;
  let remainder = 0;
  for (const char of iban.slice(4) + iban.slice(0,4)) {
    for (const digit of /[A-Z]/.test(char) ? String(char.charCodeAt(0)-55) : char) remainder = (remainder * 10 + Number(digit)) % 97;
  }
  return remainder === 1;
}
export function validEmail(value) {
  const text = String(value || '').trim();
  if (text.length > 254) return false;
  const parts = text.split('@');
  if (parts.length !== 2 || !parts[0] || parts[0].length > 64 || /(^\.|\.$|\.\.)/.test(parts[0])) return false;
  if (!/^[A-Za-z\d.!#$%&'*+\/=?^_`{|}~-]+$/.test(parts[0])) return false;
  const labels = parts[1].split('.');
  return labels.length > 1 && labels.every(l => /^[A-Za-z\d](?:[A-Za-z\d-]{0,61}[A-Za-z\d])?$/.test(l)) && /^[A-Za-z]{2,63}$/.test(labels.at(-1));
}
// Grundformate, keine Bestätigung der Registrierung oder Vergabe.
const VAT = {AT:/^ATU\d{8}$/,BE:/^BE[01]\d{9}$/,BG:/^BG\d{9,10}$/,CY:/^CY\d{8}[A-Z]$/,CZ:/^CZ\d{8,10}$/,DE:/^DE\d{9}$/,DK:/^DK\d{8}$/,EE:/^EE\d{9}$/,EL:/^EL\d{9}$/,ES:/^ES[A-Z\d]\d{7}[A-Z\d]$/,FI:/^FI\d{8}$/,FR:/^FR[A-HJ-NP-Z\d]{2}\d{9}$/,HR:/^HR\d{11}$/,HU:/^HU\d{8}$/,IE:/^IE(?:\d{7}[A-Z]{1,2}|\d[A-Z+*]\d{5}[A-Z])$/,IT:/^IT\d{11}$/,LT:/^LT(?:\d{9}|\d{12})$/,LU:/^LU\d{8}$/,LV:/^LV\d{11}$/,MT:/^MT\d{8}$/,NL:/^NL\d{9}B\d{2}$/,PL:/^PL\d{10}$/,PT:/^PT\d{9}$/,RO:/^RO\d{2,10}$/,SE:/^SE\d{12}$/,SI:/^SI\d{8}$/,SK:/^SK\d{10}$/,GB:/^GB(?:\d{9}|\d{12}|GD\d{3}|HA\d{3})$/,XI:/^XI(?:\d{9}|\d{12})$/,CH:/^CHE\d{9}(?:MWST|TVA|IVA)?$/,NO:/^NO\d{9}MVA$/};
export const normalizeVAT = v => String(v || '').replace(/[\s.-]/g,'').toUpperCase();
export const validVAT = v => { const text = normalizeVAT(v); return VAT[text.slice(0,2)]?.test(text) || false; };
// ISO-Codelisten: lokale Momentaufnahme, Quellen und Umfang in docs/VALIDIERUNG.md.
const COUNTRIES = new Set('AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW'.split(' '));
const CURRENCIES = new Set('AED AFN ALL AMD ANG AOA ARS AUD AWG AZN BAM BBD BDT BGN BHD BIF BMD BND BOB BOV BRL BSD BTN BWP BYN BZD CAD CDF CHE CHF CHW CLF CLP CNY COP COU CRC CUP CVE CZK DJF DKK DOP DZD EGP ERN ETB EUR FJD FKP GBP GEL GHS GIP GMD GNF GTQ GYD HKD HNL HTG HUF IDR ILS INR IQD IRR ISK JMD JOD JPY KES KGS KHR KMF KPW KRW KWD KYD KZT LAK LBP LKR LRD LSL LYD MAD MDL MGA MKD MMK MNT MOP MRU MUR MVR MWK MXN MXV MYR MZN NAD NGN NIO NOK NPR NZD OMR PAB PEN PGK PHP PKR PLN PYG QAR RON RSD RUB RWF SAR SBD SCR SDG SEK SGD SHP SLE SOS SRD SSP STN SVC SYP SZL THB TJS TMT TND TOP TRY TTD TWD TZS UAH UGX USD USN UYI UYU UYW UZS VED VES VND VUV WST XAF XAG XAU XBA XBB XBC XBD XCD XCG XDR XOF XPD XPF XPT XSU XUA YER ZAR ZMW ZWG'.split(' '));
export const validCountry = v => COUNTRIES.has(String(v).toUpperCase());
export const validCurrency = v => CURRENCIES.has(String(v).toUpperCase());
export const PAYMENT = Object.freeze({'58':'SEPA-Überweisung','30':'Überweisung (IBAN, auch Fremdwährung)','48':'Kartenzahlung','10':'Barzahlung'});
export const needsIBAN = code => code === '58' || code === '30';
export function canGiroCode(s, t) { return s.qrCode && s.paymentMeans === '58' && s.cur === 'EUR' && validIBAN(s.iban) && t.gross > 0 && t.gross <= 999999999.99; }

export function validateInvoice(s) {
  const errors = [], add = (field,message) => errors.push({field,message}), free = isFree(s);
  const required = {from:'Name des Absenders',fromStreet:'Straße des Absenders',fromZip:'PLZ des Absenders',fromCity:'Ort des Absenders',fromCountry:'Land des Absenders',fromMail:'E-Mail des Absenders',fromPhone:'Telefon des Absenders',to:'Name des Empfängers',toStreet:'Straße des Empfängers',toZip:'PLZ des Empfängers',toCity:'Ort des Empfängers',toCountry:'Land des Empfängers',toMail:'E-Mail des Empfängers',num:'Rechnungsnummer',date:'Rechnungsdatum',serviceDate:'Leistungsdatum',cur:'Währung'};
  // Bei unentgeltlichen Rechnungen entfallen Zahlungsziel, Zahlungsart und Bankverbindung.
  if (!free) required.due = 'Zahlungsziel';
  if (s.docType === '384') Object.assign(required,{refNum:'Nummer der korrigierten Rechnung',refDate:'Datum der korrigierten Rechnung'});
  if (s.taxCase === 'EX') required.exReason = 'Befreiungsgrund';
  if (['AE','K','G'].includes(s.taxCase)) required.vatId = 'USt-IdNr. des Absenders';
  if (['AE','K'].includes(s.taxCase)) required.toVatId = 'USt-IdNr. des Empfängers';
  if (!free && needsIBAN(s.paymentMeans)) required.iban = 'IBAN';
  if (!free && s.paymentMeans === '48') required.cardLast4 = 'Letzte vier Kartenziffern';
  for (const [key,label] of Object.entries(required)) if (isMissing(s[key])) add(key,`${label}: bitte ausfüllen.`);
  if (!isMissing(s.free) && !free) add('free','Bitte eine unterstützte Berechnung wählen.');
  if (free && s.docType === '384') add('free','Unentgeltlich geht nur bei einer Rechnung, nicht bei einer Rechnungskorrektur.');
  if (!free) {
    if (!Object.hasOwn(PAYMENT,s.paymentMeans)) add('paymentMeans','Bitte eine unterstützte Zahlungsart wählen.');
    if (s.paymentMeans === '58' && s.cur !== 'EUR') add('paymentMeans','SEPA benötigt EUR. Für Fremdwährung bitte Überweisung, Karte oder Barzahlung wählen.');
    if (s.paymentMeans === '48' && !isMissing(s.cardLast4) && !/^\d{4}$/.test(s.cardLast4)) add('cardLast4','Bitte genau die letzten vier Kartenziffern eingeben.');
  }
  for (const key of ['fromMail','toMail']) if (!isMissing(s[key]) && !validEmail(s[key])) add(key,'Bitte eine gültige E-Mail-Adresse eingeben, z. B. name@firma.de.');
  if (!free && needsIBAN(s.paymentMeans) && !isMissing(s.iban) && !validIBAN(s.iban)) add('iban','IBAN: Länderformat, Länge oder MOD-97-Prüfziffer ist ungültig.');
  if (!s.vatId && !s.taxNo) add('taxNo','Bitte Steuernummer oder USt-IdNr. des Absenders angeben.');
  for (const key of ['vatId','toVatId']) if (!isMissing(s[key]) && !validVAT(s[key])) add(key,'USt-IdNr.: Grundformat für dieses Land ungültig oder nicht unterstützt. Es findet keine Online-Prüfung statt.');
  for (const key of ['fromCountry','toCountry']) if (!isMissing(s[key]) && !validCountry(s[key])) add(key,'Bitte einen gültigen ISO-Ländercode eingeben, z. B. DE, AT oder CH.');
  if (!isMissing(s.cur) && !validCurrency(s.cur)) add('cur','Bitte einen gültigen ISO-Währungscode eingeben, z. B. EUR, CHF oder USD.');
  for (const key of ['date','serviceDate','serviceEnd',...(s.docType === '384' ? ['refDate'] : [])]) if (!isMissing(s[key]) && !validDate(s[key])) add(key,'Bitte ein gültiges Datum eingeben.');
  if (s.serviceEnd && s.serviceEnd < s.serviceDate) add('serviceEnd','Das Ende des Leistungszeitraums liegt vor dem Beginn.');
  if (s.docType === '384' && s.refDate > s.date) add('refDate','Die ursprüngliche Rechnung darf nicht nach der Korrektur datiert sein.');
  const due = num(s.due), sk = num(s.skonto);
  if (!free) {
    if (due !== null && (!Number.isInteger(due) || due < 0 || due > 36500)) add('due','Zahlungsziel: bitte ganze Tage von 0 bis 36500 eingeben.');
    if (!isMissing(s.due) && due === null) add('due','Zahlungsziel: bitte eine gültige Zahl eingeben.');
    if (!isMissing(s.skonto) && (sk === null || sk < 0 || sk > 100 || r2(sk) !== sk)) add('skonto','Skonto muss zwischen 0 und 100 Prozent liegen, mit höchstens zwei Nachkommastellen.');
    if (sk > 0 || !isMissing(s.skontoDays)) {
      const days = num(s.skontoDays);
      if (!Number.isInteger(days) || days < 0 || days > due || days > 36500) add('skontoDays','Skontofrist: ganze Tage ab 0, höchstens bis zum Zahlungsziel.');
    }
  }
  if (!['380','384'].includes(s.docType)) add('docType','Bitte Rechnung oder Rechnungskorrektur wählen.');
  if (!['S','KU','EX','AE','K','G','O'].includes(s.taxCase)) add('taxCase','Bitte einen unterstützten Steuerfall wählen.');
  if (!s.items?.length) add('add','Bitte mindestens eine Position hinzufügen.');
  for (const [i,item] of (s.items || []).entries()) {
    const field = key => `item-${i}-${key}`;
    if (isMissing(item.desc)) add(field('desc'),`Position ${i+1}: bitte eine Beschreibung eingeben.`);
    for (const key of ['qty','price',...(s.taxCase === 'S' ? ['rate'] : [])]) {
      const n = num(item[key]);
      if (n === null || Math.abs(n) > 1e9) add(field(key),`Position ${i+1}: ${key === 'qty' ? 'Menge' : key === 'price' ? 'Preis' : 'Steuersatz'} fehlt oder ist ungültig (maximal 1 Milliarde).`);
      else if (key === 'rate' ? n < 0 || n > 100 : (key === 'qty' && n === 0) || (s.docType !== '384' && n < 0)) add(field(key),`Position ${i+1}: ${key === 'rate' ? 'Steuersatz muss zwischen 0 und 100 liegen.' : 'Menge muss ungleich 0 sein; negative Mengen und Preise sind nur bei Korrekturen erlaubt.'}`);
    }
    if (!['C62','HUR','DAY','MON','LS'].includes(item.unit)) add(field('unit'),`Position ${i+1}: bitte eine unterstützte Einheit wählen.`);
  }
  try {
    if (totals(s).fxNeeded && !(num(s.fx) > 0)) add('fx','Bitte einen positiven Umrechnungskurs in die Landeswährung eingeben.');
  } catch { add('items','Die Beträge sind zu groß für eine sichere Berechnung.'); }
  return errors;
}
