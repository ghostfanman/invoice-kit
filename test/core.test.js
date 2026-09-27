import test from 'node:test';
import assert from 'node:assert/strict';
import {num,cents,r2,productCents,totals,validIBAN,validEmail,validVAT,validCountry,validCurrency,validateInvoice,canGiroCode,addDays} from '../core.js';
import {invoice} from './fixture.js';
const fields = s => validateInvoice(s).map(e=>e.field);
test('IBAN: MOD-97, Länge, Länderformat und Leerzeichen',()=>{
  for(const value of ['DE89 3704 0044 0532 0130 00','GB82WEST12345698765432','FR1420041010050500013M02606','AT611904300234573201']) assert.equal(validIBAN(value),true,value);
  for(const value of ['DE88370400440532013000','DE8937040044053201300','ZZ89370400440532013000','','DE00!']) assert.equal(validIBAN(value),false,value);
});
test('E-Mail-Adressen: gültige Formen und typische Fehler',()=>{
  for(const value of ['a@example.de','name+rechnung@sub.example.org',"o'neil@example.co.uk"]) assert.ok(validEmail(value),value);
  for(const value of ['a@','@example.org','a b@example.org','a..b@example.org','.a@example.org','a@-example.org','a@example..org','a@example.org<script>']) assert.equal(validEmail(value),false,value);
});
test('USt-ID-Grundformate nach Land',()=>{
  for(const value of ['DE123456789','ATU12345678','FRAB123456789','NL123456789B01','PL1234567890','IT12345678901','CHE-123.456.789 MWST','EL123456789','GB123456789']) assert.ok(validVAT(value),value);
  for(const value of ['DE123','AT123456789','FRI0123456789','XX123456789','NL123456789','']) assert.equal(validVAT(value),false,value);
});
test('Zahlen: fehlend, Null, Komma, ungültige Anhänge',()=>{
  assert.equal(num(''),null);assert.equal(num(' '),null);assert.equal(num(null),null);assert.equal(num('0'),0);assert.equal(num('1,25'),1.25);
  for(const v of ['12abc','Infinity','NaN','1.000,20'])assert.equal(num(v),null);
});
test('Cent-Rundung ist dezimal und symmetrisch',()=>{
  assert.equal(r2(1.005),1.01);assert.equal(r2(-1.005),-1.01);assert.equal(r2(2.675),2.68);
  assert.equal(productCents('0.1','0.2'),2);assert.equal(cents(null),null);
  assert.equal(productCents('3','0.335'),101);
});
test('Gemischte Steuersätze und gerundete Positionssummen',()=>{
  const t=totals(invoice({items:[{qty:3,price:.335,rate:19},{qty:2,price:10,rate:7}]}));
  assert.equal(t.net,21.01);assert.equal(t.tax,1.59);assert.equal(t.gross,22.60);
  assert.deepEqual(t.breakdown,[{rate:19,basis:1.01,tax:.19},{rate:7,basis:20,tax:1.4}]);
});
test('Skonto: Betrag, Null, 100 Prozent, Frist und Grenzfehler',()=>{
  assert.equal(totals(invoice({skonto:'2',skontoDays:'7'})).skPay,116.62);
  assert.equal(totals(invoice({skonto:'100',skontoDays:'0'})).skPay,0);
  assert.deepEqual(validateInvoice(invoice({skonto:'0'})),[]);
  for(const value of ['-1','100.01','kaputt'])assert.ok(fields(invoice({skonto:value})).includes('skonto'));
  for(const value of ['', '-1','1.5','15'])assert.ok(fields(invoice({skonto:'2',skontoDays:value})).includes('skontoDays'));
});
test('Alle steuerfreien Fälle',()=>{
  for(const taxCase of ['KU','EX','AE','K','G','O']){const t=totals(invoice({taxCase}));assert.equal(t.tax,0);assert.equal(t.gross,100)}
});
test('Rechnungskorrekturen erlauben negative Mengen und Preise',()=>{
  for(const item of [{qty:-1,price:100},{qty:1,price:-100}]) {
    const s=invoice({items:[{...invoice().items[0],...item}]});assert.ok(fields(s).some(f=>/^item-/.test(f)));
    s.docType='384';s.refNum='2026-000';s.refDate='2026-09-01';assert.deepEqual(validateInvoice(s),[]);assert.equal(totals(s).gross,-119);
  }
});
test('Nullpreis gültig, fehlender Preis und Nullmenge ungültig',()=>{
  const s=invoice();s.items[0].price=0;assert.deepEqual(validateInvoice(s),[]);
  s.items[0].price='';assert.ok(fields(s).includes('item-0-price'));
  s.items[0].qty=0;assert.ok(fields(s).includes('item-0-qty'));
});
test('Länder und Währungen werden anhand lokaler Codelisten geprüft',()=>{
  assert.ok(validCountry('DE'));assert.ok(validCountry('US'));assert.equal(validCountry('ZZ'),false);
  assert.ok(validCurrency('CHF'));assert.ok(validCurrency('USD'));assert.equal(validCurrency('ABC'),false);
});
test('Fremdwährung, Umrechnung und Zahlungsarten',()=>{
  const s=invoice({cur:'USD',fx:'0.92',paymentMeans:'30'});assert.deepEqual(validateInvoice(s),[]);assert.equal(totals(s).taxHome,17.48);
  assert.ok(fields({...s,fx:''}).includes('fx'));assert.ok(fields({...s,paymentMeans:'58'}).includes('paymentMeans'));
  for(const paymentMeans of ['10','48']) assert.deepEqual(validateInvoice(invoice({paymentMeans,iban:'',cardLast4:'1234'})),[]);
  assert.ok(fields(invoice({paymentMeans:'48',cardLast4:'1234567812345678'})).includes('cardLast4'));
  assert.ok(fields(invoice({paymentMeans:'59'})).includes('paymentMeans'));
});
test('GiroCode nur bei gültiger EUR-SEPA-Überweisung',()=>{
  const s=invoice();assert.ok(canGiroCode(s,totals(s)));
  for(const change of [{paymentMeans:'10'},{paymentMeans:'48'},{paymentMeans:'30'},{cur:'USD'},{iban:'DE88370400440532013000'},{qrCode:false}])assert.equal(Boolean(canGiroCode({...s,...change},totals(s))),false);
  assert.equal(canGiroCode(s,{gross:0}),false);assert.equal(canGiroCode(s,{gross:-1}),false);
});
test('Anschriften, Leistungszeitraum, Zahlungsfristen und echte Datumswerte',()=>{
  assert.ok(fields(invoice({toStreet:''})).includes('toStreet'));
  assert.ok(fields(invoice({serviceEnd:'2026-09-01'})).includes('serviceEnd'));
  assert.ok(fields(invoice({date:'2026-02-30'})).includes('date'));
  for(const due of ['','-1','1.5','36501','abc'])assert.ok(fields(invoice({due})).includes('due'));
  assert.deepEqual(validateInvoice(invoice({due:'0'})),[]);assert.equal(addDays('2024-02-28',1),'2024-02-29');
});
test('Berechnung verwendet ausschließlich das übergebene Modell',()=>{
  const s=invoice();const before=structuredClone(s);totals(s);validateInvoice(s);assert.deepEqual(s,before);
  assert.equal(totals(invoice({items:[]})).gross,0);
});
test('XML-Zahlen behalten kleine Dezimalwerte ohne Exponentialschreibweise',async()=>{
  const {decimalText}=await import('../core.js');assert.equal(decimalText(1e-7),'0.0000001');assert.equal(decimalText(-1e-7),'-0.0000001');assert.equal(decimalText(0),'0');assert.equal(decimalText(1e21),'1000000000000000000000');
});
