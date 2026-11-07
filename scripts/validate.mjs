import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('../public/', import.meta.url));
const corpus = JSON.parse(await fs.readFile(path.join(root,'data/elements.json'),'utf8'));
const expected = [48,14,37,16,25,33,39,27,36,115,39,18,18];
const definitionCounts = [23,2,11,7,18,5,22,0,0,16,28,0,0];
assert.equal(corpus.books.length,13,'All thirteen books must be present');
const ids = new Set();
let propositions = 0, diagrams = 0, paragraphs = 0;
const outputEntries = new Map();
for (const [index,book] of corpus.books.entries()) {
  assert.equal(book.number,index+1);
  assert.equal(book.units.filter(u=>u.kind==='proposition').length,expected[index],`Book ${index+1} proposition count`);
  const definitions = book.units.filter(u=>u.kind==='definitions');
  assert.equal(definitions.length,definitionCounts[index] ? 1 : 0,`Book ${index+1} grouped definitions page`);
  if(definitions.length) assert.equal(definitions[0].entries.length,definitionCounts[index],`Book ${index+1} definition count`);
  assert.equal(book.units.filter(u=>u.kind==='postulates').length,index===0 ? 1 : 0);
  assert.equal(book.units.filter(u=>u.kind==='common-notions').length,index===0 ? 1 : 0);
  for (const kind of ['definitions','postulates','common-notions']) {
    assert(book.units.filter(u=>u.kind===kind).length<=1,`Book ${index+1}: ${kind} must be grouped`);
  }
  for(const unit of book.units) {
    assert(!ids.has(unit.id),`Duplicate navigation id: ${unit.id}`); ids.add(unit.id);
    assert(unit.entries.length,`Empty unit: ${unit.id}`);
    if(unit.kind==='proposition') propositions++;
    for(const entry of unit.entries) {
      assert(!outputEntries.has(entry.id),`Duplicate text entry ${entry.id}`);
      outputEntries.set(entry.id,entry.paragraphs);
      assert(entry.paragraphs.some(p=>typeof p==='string'&&p.trim()),`Missing text: ${entry.id}`);
      for(const p of entry.paragraphs) {assert(!p.includes('\uFFFD'),`Broken Unicode in ${entry.id}`); paragraphs++;}
    }
    for(const diagram of unit.diagrams??[]) {
      assert(!diagram.src.startsWith('/')&&!diagram.src.includes('..'),'Local subpath-safe diagram');
      const bytes=await fs.readFile(path.join(root,diagram.src));
      assert(bytes.length>20,`Missing diagram ${diagram.src}`);
      assert(diagram.alt?.length>5,`Diagram alt text ${diagram.src}`);
      diagrams++;
    }
  }
}
assert.equal(propositions,465);
const source = JSON.parse(await fs.readFile(new URL('../reference/work.json',import.meta.url),'utf8'));
let sourceEntries = 0;
for(const book of source.divisions) for(const section of book.children) for(const entry of section.children) {
  const original = entry.passages.map(p=>p.n ? `${p.n} ${p.text}` : p.text).filter(p=>p!==undefined&&p!=='');
  assert.deepEqual(outputEntries.get(entry.id),original,`Text preservation ${entry.id}`);
  sourceEntries++;
}
assert.equal(outputEntries.size,sourceEntries,'Every source text entry is represented exactly once');
const html=await fs.readFile(path.join(root,'index.html'),'utf8');
for(const match of html.matchAll(/(?:src|href)=["']([^"']+)["']/g)) {
  const resource=match[1];
  if(/^(https?:|#|mailto:)/.test(resource)) continue;
  assert(!resource.startsWith('/'),`Root-relative URL breaks Pages: ${resource}`);
  await fs.access(path.join(root,resource.split('?')[0]));
}
for(const name of ['reader.js','golearn.js']) {
  const result=spawnSync(process.execPath,['--check',path.join(root,name)],{encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);
}
console.log(JSON.stringify({books:13,propositions,paragraphs,diagramPlacements:diagrams,uniqueUnitIds:ids.size,relativeAssets:'pass',javascriptSyntax:'pass'},null,2));
