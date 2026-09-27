import test from 'node:test';
import assert from 'node:assert/strict';
import {checks} from '../viewer-check.js';
function fixture(){return {seller:{name:'Firma',street:'Weg 1',zip:'10115',city:'Berlin',country:'DE',vat:'DE123456789'},buyer:{name:'Kunde',street:'Weg 2',zip:'10115',city:'Berlin',country:'DE'},id:'1',date:'2026-09-27',delivery:'2026-09-27',period:['',''],currency:'EUR',lines:[{name:'Leistung',qty:1,price:100,total:100,allowance:0,charge:0,baseQty:1}],taxes:[{basis:100,tax:19,rate:19,cat:'S'}],totals:{lines:100,net:100,tax:19,gross:119,due:119,prepaid:0,rounding:0,allowance:0,charge:0},payment:{means:'10'}}}
const bad = v => checks(v).filter(c=>c.cls==='bad');
test('Viewer akzeptiert stimmige Cent-Summen',()=>assert.deepEqual(bad(fixture()),[]));
test('Viewer unterscheidet fehlende Beträge und Null',()=>{
  const v=fixture();v.lines[0].price=0;v.lines[0].total=0;v.taxes[0].basis=0;v.taxes[0].tax=0;for(const k of Object.keys(v.totals))v.totals[k]=0;
  assert.deepEqual(bad(v),[]);v.totals.net=null;assert.ok(bad(v).length);v.lines[0].total=null;assert.ok(bad(v).some(c=>c.t.includes('Positionspreise')));
});
test('Viewer prüft jedes Adressfeld und Land',()=>{
  for(const party of ['seller','buyer'])for(const field of ['name','street','zip','city','country']){const v=fixture();v[party][field]='';assert.ok(bad(v).some(c=>c.t.includes('Anschrift')))}
});
test('Viewer erkennt einen Cent Abweichung bei Position, Netto, Steuer, Brutto und Zahlbetrag',()=>{
  for(const field of ['lines','net','tax','gross','due']){const v=fixture();v.totals[field]+=.01;assert.ok(bad(v).length,field)}
  const v=fixture();v.lines[0].total+=.01;assert.ok(bad(v).length);
});
test('Viewer berücksichtigt Preisbasis, Nachlass, Zuschlag, Vorauszahlung und Rundung',()=>{
  const v=fixture();v.lines[0]={...v.lines[0],qty:10,price:100,baseQty:10,allowance:5,charge:2,total:97};
  v.totals={lines:97,net:90,tax:17.1,gross:107.1,allowance:10,charge:3,prepaid:7,rounding:.01,due:100.11};v.taxes[0]={basis:90,tax:17.1,rate:19,cat:'S'};assert.deepEqual(bad(v),[]);
});
