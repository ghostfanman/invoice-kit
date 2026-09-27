import {cents, productCents, validCountry, validCurrency, validDate, validIBAN, needsIBAN} from './core.js';

// Bewusst eine Plausibilitätsprüfung, keine Schema- oder Schematron-Validierung.
export function checks(v) {
  const result = [], add = (ok,t,level='bad') => result.push({cls:ok?'ok':level,t});
  const present = n => typeof n === 'number' && Number.isFinite(n);
  const sum = values => values.every(present) ? values.reduce((a,b) => a + cents(b),0) : null;
  const equal = (a,b) => a !== null && b !== null && a === b;
  for (const [key,label] of [['seller','Rechnungssteller'],['buyer','Empfänger']]) {
    const p = v[key];
    add(p && ['name','street','zip','city','country'].every(k => String(p[k] || '').trim()) && validCountry(p.country),`${label}: vollständige Anschrift mit Name, Straße, PLZ, Ort und gültigem Land`);
  }
  if(v.taxes.length && v.taxes.every(t=>t.cat==='O')) add(v.seller && (v.seller.id || v.seller.taxNo),'Kennung des Rechnungsstellers bei nicht steuerbarem Umsatz vorhanden');
  else add(v.seller && (v.seller.vat || v.seller.taxNo),'Steuernummer oder USt-IdNr. des Rechnungsstellers vorhanden');
  add(v.id,'Rechnungsnummer vorhanden'); add(validDate(v.date),'Rechnungsdatum gültig');
  add(validCurrency(v.currency),'Währungscode gültig');
  add(validDate(v.delivery) || (validDate(v.period[0]) && validDate(v.period[1]) && v.period[0] <= v.period[1]),'Leistungsdatum oder vollständiger Leistungszeitraum vorhanden','hint');
  add(v.lines.length && v.lines.every(l => l.name && present(l.qty) && l.qty !== 0),'Beschreibung und Menge bei allen Positionen vorhanden');
  add(v.lines.length && v.lines.every(l => present(l.price) && present(l.total)),'Positionspreise und Positionsbeträge vorhanden (0,00 ist zulässig)');
  for (const [i,l] of v.lines.entries()) {
    const base = l.baseQty;
    // Basisquantity, Positionszu- und -abschläge werden berücksichtigt.
    const expected = present(l.qty) && present(l.price) && base > 0 && present(l.allowance) && present(l.charge)
      ? productCents(l.qty, l.price / base) - cents(l.allowance) + cents(l.charge) : null;
    add(equal(expected,cents(l.total)),`Position ${i+1}: Menge × Preis / Preisbasis mit Zu- und Abschlägen stimmt auf Cent-Basis`);
  }
  const t = v.totals;
  add(['lines','net','tax','gross','due'].every(k => present(t[k])),'Positions-, Netto-, Steuer-, Brutto- und Zahlbetrag vorhanden (0,00 ist zulässig)');
  add(equal(sum(v.lines.map(l => l.total)),cents(t.lines)),'Summe der Positionen stimmt mit der Positionssumme überein');
  const net = present(t.lines) && present(t.allowance) && present(t.charge) ? cents(t.lines) - cents(t.allowance) + cents(t.charge) : null;
  add(equal(net,cents(t.net)),'Positionssumme minus Nachlässe plus Zuschläge ergibt Netto');
  add(v.taxes.length && v.taxes.every(t => present(t.basis) && present(t.tax) && (t.cat !== 'S' || present(t.rate))),'Steuerbasis und Steuerbetrag je Steuergruppe vorhanden');
  add(equal(sum(v.taxes.map(t => t.basis)),cents(t.net)),'Steuerbemessungsgrundlagen ergeben den Nettobetrag');
  for (const [i,tax] of v.taxes.entries()) {
    const expected = present(tax.basis) && (present(tax.rate) || tax.cat === 'O') ? productCents(tax.basis,tax.rate ?? 0,0.01) : null;
    add(equal(expected,cents(tax.tax)),`Steuergruppe ${i+1}: Steuerbetrag stimmt auf Cent-Basis`);
  }
  add(equal(sum(v.taxes.map(t => t.tax)),cents(t.tax)),'Steuerbeträge ergeben die Gesamtsteuer');
  add(equal(sum([t.net,t.tax]),cents(t.gross)),'Netto plus Steuer ergibt Brutto');
  const due = present(t.gross) && present(t.prepaid) && present(t.rounding) ? cents(t.gross) - cents(t.prepaid) + cents(t.rounding) : null;
  add(equal(due,cents(t.due)),'Brutto minus Vorauszahlung plus Rundungsbetrag ergibt Zahlbetrag');
  const exempt = v.taxes.filter(t => t.cat && !['S','Z'].includes(t.cat));
  if (exempt.length) add(exempt.every(t => t.reason),'Befreiungsgrund oder Hinweis auf Reverse Charge vorhanden');
  if (v.taxes.some(t => ['AE','K'].includes(t.cat))) add(v.buyer?.vat,'USt-IdNr. des Empfängers vorhanden');
  if (needsIBAN(v.payment.means)) add(validIBAN(v.payment.iban),'IBAN-Format und Prüfziffer der Bankverbindung plausibel');
  return result;
}
