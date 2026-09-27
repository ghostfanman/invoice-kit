import test from 'node:test';
import assert from 'node:assert/strict';
import {clearInvoiceData,readDraft} from '../storage.js';
function storage(entries){const data=new Map(entries);return {get length(){return data.size},key:i=>[...data.keys()][i],getItem:k=>data.get(k)??null,removeItem:k=>data.delete(k),data};}
test('Ältere Entwürfe bleiben ladbar, beschädigte werden übersprungen',()=>{
  const s=storage([['invoice-kit-v3','{broken'],['invoice-kit-v2','{"items":[],"num":"alt"}']]);assert.equal(readDraft(s).num,'alt');
});
test('Löschung entfernt eigene Entwürfe und Einstellungen, keine fremden Daten',()=>{
  const s=storage([['invoice-kit-v3','a'],['invoice-kit-v2','b'],['invoice-kit-storage-enabled','yes'],['wambur-rechnung-v3','c'],['foreign-app','keep']]);clearInvoiceData(s);assert.deepEqual([...s.data],[['foreign-app','keep']]);
});
