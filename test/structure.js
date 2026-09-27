import {readFileSync} from 'node:fs';
export const pages=['index.html','anzeigen.html','integration/wambur-vorschau-index.html','integration/wambur-vorschau-anzeigen.html'];
export function structureErrors(html){
  // Statische HTML-Struktur, Skriptinhalte und Kommentare sind keine DOM-Knoten.
  html=html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<!--[\s\S]*?-->/g,'');
  const tags=[...html.matchAll(/<([a-z][\w-]*)\b([^>]*?)>/gi)].map(m=>({tag:m[1],attrs:Object.fromEntries([...m[2].matchAll(/([\w-]+)\s*=\s*"([^"]*)"/g)].map(a=>[a[1],a[2]]))}));
  const errors=[],ids=new Map(),labels=new Set();
  for(const {tag,attrs:a} of tags)if(a.id){if(ids.has(a.id))errors.push(`Doppelte ID: ${a.id}`);ids.set(a.id,tag)}
  for(const {tag,attrs:a} of tags)if(tag==='label'){
    if(!a.for||!['input','select','textarea','button','output','meter','progress'].includes(ids.get(a.for)))errors.push(`Ungültiges label-for: ${a.for}`);
    labels.add(a.for);
  }
  for(const {tag,attrs:a} of tags)if(['input','select','textarea'].includes(tag)&&!labels.has(a.id))errors.push(`Feld ohne Label: ${a.id}`);
  return errors;
}
export const readPage=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
