import {readFileSync,readdirSync,mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {pages,structureErrors,readPage} from './structure.js';
const scratch=mkdtempSync(join(tmpdir(),'invoice-kit-check-'));
try {
  for(const page of pages){const html=readPage(page);assert.deepEqual(structureErrors(html),[],page);
    for(const [i,match] of [...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)].entries()){
      if(match[1].includes('src='))continue;
      if(match[1].includes('application/ld+json')){JSON.parse(match[2]);continue}
      const file=join(scratch,`inline-${i}.js`);writeFileSync(file,match[2]);execFileSync(process.execPath,['--check',file]);
    }
  }
  const files=[];
  const scan=dir=>{for(const entry of readdirSync(dir,{withFileTypes:true})){if(['.git','.agents','.codex','node_modules','dist-wambur','__pycache__','.test-artifacts'].includes(entry.name))continue;const path=join(dir,entry.name);if(entry.isDirectory())scan(path);else files.push(path)}};
  scan('.');
  for(const file of files.filter(f=>/\.(?:m?js)$/.test(f)))execFileSync(process.execPath,['--check',file]);
  for(const file of files.filter(f=>!f.startsWith('vendor/')&&/\.(?:html|js|mjs|md|py|webmanifest)$/.test(f))){
    const text=readFileSync(file,'utf8');assert.ok(!/[\u2013\u2014]|&(?:mdash|ndash);|&#(?:8211|8212);|&#x201[34];/i.test(text),`Gedankenstrich in ${file}`);
  }
  const before=pages.slice(2).map(readPage);
  execFileSync('python3',['integration/build-wambur.py',join(scratch,'build')]);
  assert.deepEqual(pages.slice(2).map(readPage),before,'Wambur-Vorschauen passen nicht zum Buildskript');
  for(const page of ['index.html','anzeigen.html']){
    const built=readFileSync(join(scratch,'build/e-rechnung',page),'utf8');
    assert.equal(readPage('integration/wambur-vorschau-'+page),built.replace('<head>','<head>\n<base href="../">').replace('src="wambur.js"','src="integration/wambur.js"'));
  }
  console.log(`Statische Prüfung bestanden: ${pages.length} HTML-Seiten, alle JavaScript-Dateien, Metadaten, Satzzeichen und reproduzierbarer Wambur-Build.`);
} finally {rmSync(scratch,{recursive:true,force:true})}
