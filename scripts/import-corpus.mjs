#!/usr/bin/env node

/** Build the reader's compact, page-oriented corpus and fetch its source figures. */
import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const work = JSON.parse(await readFile(join(root, 'reference/work.json'), 'utf8'));
const about = JSON.parse(await readFile(join(root, 'reference/about.json'), 'utf8'));
const outputDir = join(root, 'public/data');
const diagramDir = join(root, 'public/diagrams');
const romanNumerals = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII'];
const category = (section) => {
  const id = section.id.toLowerCase();
  if (id.includes('definitions') || /-def[123]$/.test(id)) return 'definitions';
  if (id.includes('postulates')) return 'postulates';
  if (id.includes('common-notions')) return 'common-notions';
  if (id.includes('propositions') || /-prop[123]$/.test(id)) return 'propositions';
  return 'other';
};
const sectionTitle = (section) => section.editorialTitle || section.sourceHeading || 'Other';
const allSections = (book) => book.children || [];
const allItems = (section) => section.children || [];

const diagramRefs = new Map();
for (const book of work.divisions) {
  for (const section of allSections(book)) {
    for (const item of allItems(section)) {
      for (const passage of item.passages || []) {
        if (passage.figure?.image) diagramRefs.set(passage.figure.image, passage.figure.alt || `Diagram for ${item.id}`);
      }
    }
  }
}

await mkdir(diagramDir, { recursive: true });
const origin = 'https://raw.githubusercontent.com/Rookie2401/westerncanon/master/data/euclid-elements/';
let downloaded = 0;
const refs = [...diagramRefs.keys()];
for (let offset = 0; offset < refs.length; offset += 12) {
  await Promise.all(refs.slice(offset, offset + 12).map(async (src) => {
    const filename = src.split('/').at(-1);
    const destination = join(diagramDir, filename);
    try { await access(destination); return; } catch { /* fetch absent asset */ }
    const response = await fetch(new URL(src, origin));
    if (!response.ok) throw new Error(`Could not fetch ${src}: HTTP ${response.status}`);
    await writeFile(destination, Buffer.from(await response.arrayBuffer()));
    downloaded++;
  }));
}

const books = work.divisions.map((book, index) => {
  const grouped = new Map();
  const propositions = [];
  for (const section of allSections(book)) {
    const kind = category(section);
    const entries = allItems(section).map((item) => {
      const paragraphs = [];
      const diagrams = [];
      for (const passage of item.passages || []) {
        // Number labels are included with the text where present so no passage metadata is lost.
        const text = passage.n ? `${passage.n} ${passage.text}` : passage.text;
        if (text !== undefined && text !== '') paragraphs.push(text);
        if (passage.figure?.image) diagrams.push({ src: `diagrams/${passage.figure.image.split('/').at(-1)}`, alt: passage.figure.alt || `Diagram for ${item.id}` });
      }
      return { id: item.id, title: item.editorialTitle || item.sourceHeading || `${sectionTitle(section)} ${item.number ?? ''}`.trim(), paragraphs, diagrams };
    });
    if (kind === 'propositions') {
      propositions.push(...entries);
    } else if (kind === 'definitions' || kind === 'postulates' || kind === 'common-notions') {
      if (!grouped.has(kind)) grouped.set(kind, { id: `${book.id}-${kind}`, kind, title: kind === 'common-notions' ? 'Common Notions' : kind[0].toUpperCase() + kind.slice(1), entries: [], diagrams: [] });
      grouped.get(kind).entries.push(...entries);
      grouped.get(kind).diagrams.push(...entries.flatMap(({ diagrams }) => diagrams));
    } else {
      grouped.set(`${kind}-${section.id}`, { id: section.id, kind: 'other', title: sectionTitle(section), entries, diagrams: entries.flatMap(({ diagrams }) => diagrams) });
    }
  }
  const units = [...grouped.values()];
  // Keep book preliminaries first, followed by the propositions in canonical numeric order.
  const rank = { definitions: 0, postulates: 1, 'common-notions': 2, other: 3 };
  units.sort((a, b) => rank[a.kind] - rank[b.kind]);
  units.push(...propositions.map((entry) => {
    const { diagrams, ...cleanEntry } = entry;
    return { id: entry.id, kind: 'proposition', title: entry.title, entries: [cleanEntry], diagrams };
  }));
  for (const unit of units) {
    if (unit.kind !== 'proposition') unit.entries = unit.entries.map(({ diagrams, ...entry }) => entry);
  }
  return { id: book.id, number: index + 1, roman: book.number || romanNumerals[index], title: book.editorialTitle || `Book ${book.number}`, units };
});

await mkdir(outputDir, { recursive: true });
const corpus = { books, sources: { work, about, repository: 'https://github.com/Rookie2401/westerncanon', sourceDirectory: 'data/euclid-elements', importedAt: 'build time; see source repository history' } };
await writeFile(join(outputDir, 'elements.json'), `${JSON.stringify(corpus)}\n`, 'utf8');
console.log(`Wrote ${books.length} books and ${books.reduce((n, b) => n + b.units.length, 0)} units; ${diagramRefs.size} diagrams (${downloaded} downloaded this run).`);
