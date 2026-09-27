import test from 'node:test';
import assert from 'node:assert/strict';
import {pages,structureErrors,readPage} from './structure.js';
for(const page of pages)test(`${page}: eindeutige IDs, gültige Labelziele und Labels für alle Felder`,()=>assert.deepEqual(structureErrors(readPage(page)),[]));
test('Strukturtest erkennt defekte Zuordnungen und doppelte IDs',()=>{
  assert.equal(structureErrors('<input id="a"><input id="a"><label for="b">Fehler</label>').length,4);
});
