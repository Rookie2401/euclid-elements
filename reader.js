// Euclid's Elements, laid out as Biblia is: a library page (a tree that opens division → book → its sections and propositions),
// a reading page (a slim header with the way back, where you are, and settings; the text; a pager fixed at the foot), and a
// settings page. Routes: #/ (library), #/read/<book>/<unit> (reading), #/settings. Older links (#book-1/<unit>) still open.
const $ = (id) => document.getElementById(id);
const app = $('app');
const ROMANS = ['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII','XIII'];
const STORAGE = { position:'ecclesia.euclid.position', size:'ecclesia.euclid.size', theme:'ecclesia.euclid.theme', marks:'ecclesia.euclid.marks', open:'ecclesia.euclid.open', spacing:'ecclesia.euclid.spacing' };
/** The library's top level, as Biblia's testaments → divisions: the work, then the four traditional parts of the Elements. */
const DIVISIONS = [
  { id:'plane', title:'Plane Geometry', native:'Ἐπίπεδα', books:[1,2,3,4,5,6] },
  { id:'arithmetic', title:'Arithmetic', native:'Ἀριθμητικά', books:[7,8,9] },
  { id:'incommensurables', title:'Incommensurables', native:'Ἄλογα', books:[10] },
  { id:'solid', title:'Solid Geometry', native:'Στερεά', books:[11,12,13] },
];
const SECTION_NATIVE = { definitions:'Ὅροι', postulates:'Αἰτήματα', 'common-notions':'Κοιναὶ ἔννοιαι' };
const SECTION_NOUN = { definitions:'definitions', postulates:'postulates', 'common-notions':'common notions' };
const ICON = {
  back:'<path d="M15 6l-6 6 6 6"/>',
  chev:'<path d="M9 6l6 6-6 6"/>',
  account:'<circle cx="12" cy="8.5" r="3.5"/><path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6"/>',
  settings:'<path d="M4 7h10M18 7h2M4 12h2M10 12h10M4 17h8M16 17h4"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="12" r="2"/><circle cx="14" cy="17" r="2"/>',
};
const svg = (name) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${ICON[name]}</svg>`;

let books = [], flatUnits = [], sources = {}, currentIndex = -1, saveTimer, currentSites;
// GoLearn's bridge keeps hold of these two buttons and writes their labels ("Sign in to GoLearn", "Saved words (3)"), so they
// live for the whole visit and are moved into whichever page shows them.
const accountButton = Object.assign(document.createElement('button'), { type:'button', className:'linkbtn', id:'account-open', textContent:'Sign in to GoLearn' });
const savedButton = Object.assign(document.createElement('button'), { type:'button', className:'btn', id:'saved-open', textContent:'Saved words' });

// ───────────────────────────── small helpers ─────────────────────────────
function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === false || v === null) continue;
    if (k === 'class') el.className = v; else if (k === 'html') el.innerHTML = v; else if (k.startsWith('on')) el.addEventListener(k.slice(2), v); else el.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of children.flat()) if (c !== undefined && c !== null && c !== false) el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  return el;
}
const EL_UNITS = ['', 'α', 'β', 'γ', 'δ', 'ε', 'ϛ', 'ζ', 'η', 'θ'], EL_TENS = ['', 'ι', 'κ', 'λ', 'μ', 'ν', 'ξ', 'ο', 'π', 'ϟ'], EL_HUNDREDS = ['', 'ρ', 'σ', 'τ', 'υ', 'φ', 'χ', 'ψ', 'ω', 'ϡ'];
/** Greek (Milesian) numeral with the keraia, as Biblia writes chapter numbers. */
const greekNumeral = (n) => (n >= 1 && n <= 999 ? `${EL_HUNDREDS[Math.floor(n / 100)]}${EL_TENS[Math.floor((n % 100) / 10)]}${EL_UNITS[n % 10]}ʹ` : String(n));
const store = { get(k) { try { return localStorage.getItem(k); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch { /* storage may be off */ } } };
const roman = (book, i = books.indexOf(book)) => book.roman || ROMANS[i];
const isProp = (unit) => unit.kind === 'proposition';
const propNumber = (unit) => Number(unit.id.match(/(?:prop|proposition)[-:]?(\d+)$/i)?.[1] || unit.title?.match(/\d+/)?.[0] || 0);
const unitName = (unit) => (isProp(unit) ? `Proposition ${propNumber(unit)}` : unit.title || 'Definitions');
const unitNative = (unit) => (isProp(unit) ? greekNumeral(propNumber(unit)) : SECTION_NATIVE[unit.kind] || '');
const bookNative = (book) => `Στοιχείων ${greekNumeral(book.number)}`;
const unitHref = (book, unit) => `#/read/${book.number}/${encodeURIComponent(unit.id)}`;
const firstWords = (unit, n = 64) => { const t = unit.entries?.[0]?.paragraphs?.[0] || ''; return t.length > n ? `${t.slice(0, t.lastIndexOf(' ', n) > 20 ? t.lastIndexOf(' ', n) : n)} …` : t; };
const propCount = (book) => (book.units || []).filter(isProp).length;

// ───────────────────────────── settings ─────────────────────────────
function themeMode() { const t = store.get(STORAGE.theme); return t === 'light' || t === 'dark' ? t : 'auto'; }
function applyTheme() {
  const mode = themeMode();
  const dark = mode === 'dark' || (mode === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#211e1a' : '#f1e8d7');
}
function greekSize() { const s = Number(store.get(STORAGE.size)); return s >= 1.1 && s <= 2.1 ? s : 1.28; }
function lineSpacing() { const s = Number(store.get(STORAGE.spacing)); return s >= 1.5 && s <= 2.3 ? s : 1.8; }
function applyType() {
  document.documentElement.style.setProperty('--greek-size', `${greekSize()}rem`);
  document.documentElement.style.setProperty('--greek-leading', String(lineSpacing()));
}
function marksOn() { return store.get(STORAGE.marks) !== 'off'; }
function applyMarks() { document.documentElement.setAttribute('data-level-marks', marksOn() ? 'on' : 'off'); }
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', applyTheme);
applyTheme(); applyType(); applyMarks();

/** Which library rows are open (a list of ids), remembered on the device; the four parts are open until closed. */
function openSet() { try { const v = JSON.parse(store.get(STORAGE.open) || 'null'); if (Array.isArray(v)) return new Set(v); } catch { /* fall through */ } return new Set(['elements', ...DIVISIONS.map((d) => d.id)]); }
function saveOpen(set) { store.set(STORAGE.open, JSON.stringify([...set])); }
function lastPosition() { try { return JSON.parse(store.get(STORAGE.position) || 'null'); } catch { return null; } }
function positionIndex(p) { return p ? flatUnits.findIndex((x) => String(x.book.number) === String(p.book) && x.unit.id === p.unit) : -1; }

// ───────────────────────────── shared chrome ─────────────────────────────
function topbar(current) {
  return h('header', { class: 'topbar' },
    h('a', { href: '#/', class: 'topbar__title', 'aria-label': 'Euclid, the library' }, 'Euclid'),
    h('div', { class: 'topbar__spacer' }),
    h('button', { type: 'button', class: 'iconbtn', 'aria-label': 'GoLearn account', title: 'GoLearn account', html: svg('account'), onclick: () => accountButton.click() }),
    h('a', { href: '#/settings', class: `iconbtn${current === 'settings' ? ' iconbtn--active' : ''}`, 'aria-label': 'Settings', title: 'Settings', ...(current === 'settings' ? { 'aria-current': 'page' } : {}), html: svg('settings') }));
}
function collapsible(open, inner) {
  const box = h('div', { class: 'collapsible', 'data-open': String(open) }, h('div', { class: 'collapsible__inner', ...(open ? {} : { inert: true }) }, inner));
  return box;
}
/** One folding row of the library: a head (chevron, English title, Greek title, count) over its children. */
function libGroup(level, id, title, native, meta, children, opened, current = false) {
  const head = h('button', { type: 'button', class: 'lib__head', 'aria-expanded': String(opened.has(id)) },
    h('span', { class: `lib__chev${opened.has(id) ? ' lib__chev--open' : ''}`, 'aria-hidden': 'true', html: svg('chev') }),
    h('span', { class: 'lib__title' }, title),
    native ? h('span', { class: 'lib__native', lang: 'grc' }, native) : null,
    h('span', { class: 'lib__meta' }, meta));
  let body;
  const group = h('div', { class: `lib__group lib__group--${level}${current ? ' lib__group--current' : ''}`, 'data-id': id }, head);
  const build = () => h('div', { class: 'lib__children' }, children());
  // the children are made when first opened: Book X alone has 116 rows
  body = collapsible(opened.has(id), opened.has(id) ? build() : '');
  group.append(body);
  head.addEventListener('click', () => {
    const open = !opened.has(id);
    if (open) opened.add(id); else opened.delete(id);
    saveOpen(opened);
    const inner = body.firstElementChild;
    if (open && !inner.childElementCount) inner.append(build());
    body.dataset.open = String(open);
    inner.toggleAttribute('inert', !open);
    head.setAttribute('aria-expanded', String(open));
    head.firstElementChild.classList.toggle('lib__chev--open', open);
  });
  return group;
}

// ───────────────────────────── the library (home) ─────────────────────────────
function renderHome() {
  currentIndex = -1; publishUnit(undefined);
  document.title = 'Euclid’s Elements — Ecclesia';
  const opened = openSet();
  const at = lastPosition();
  const atIndex = positionIndex(at);
  const here = atIndex >= 0 ? flatUnits[atIndex] : undefined;
  const entryFor = (book, unit) => {
    const isAt = here && here.unit === unit;
    const preview = isProp(unit) ? firstWords(unit) : `${unit.entries?.length || 0} ${SECTION_NOUN[unit.kind] || 'entries'}`;
    return h('a', { href: unitHref(book, unit), role: 'listitem', class: `entry${isAt ? ' entry--at' : ''}${isProp(unit) ? ' entry--prop' : ''}`, 'aria-label': `Book ${roman(book)}, ${unitName(unit)}`, ...(isAt ? { 'aria-current': 'location' } : {}) },
      h('span', { class: 'entry__num' }, unitName(unit)),
      h('span', { class: 'entry__native', lang: 'grc' }, unitNative(unit)),
      h('span', { class: 'entry__preview', ...(isProp(unit) ? { lang: 'grc' } : {}) }, preview));
  };
  const bookGroup = (book) => libGroup(3, `book-${book.number}`, `Book ${roman(book)}`, bookNative(book), `${propCount(book)} props`,
    () => h('div', { class: 'entrylist', role: 'list', 'aria-label': `Book ${roman(book)} contents` }, h('p', { class: 'lib__subtitle' }, book.title), (book.units || []).map((u) => entryFor(book, u))),
    opened, here?.book === book);
  const divisionGroup = (d) => libGroup(2, d.id, d.title, d.native, `${d.books.length} ${d.books.length === 1 ? 'book' : 'books'}`,
    () => d.books.map((n) => books.find((b) => b.number === n)).filter(Boolean).map(bookGroup), opened, !!here && d.books.includes(here.book.number));
  const tree = h('nav', { class: 'lib', 'aria-label': 'Books' },
    libGroup(1, 'elements', 'The Elements', 'Στοιχεῖα', `${books.length} books`, () => DIVISIONS.map(divisionGroup), opened));
  const accountLine = h('p', { class: 'accountline' }, accountButton);
  const cont = here ? h('a', { class: 'home__continue', href: unitHref(here.book, here.unit) },
    h('span', { class: 'home__continue-label' }, 'Continue reading'),
    h('div', { class: 'home__continue-ref' }, `Book ${roman(here.book)} · ${unitName(here.unit)}`),
    h('div', { class: 'home__continue-sub', lang: 'grc' }, `${bookNative(here.book)} · ${unitNative(here.unit)}`)) : null;
  const about = h('div', { class: 'home__about' },
    h('p', {}, 'Text: Heiberg’s edition (1883–88, public domain), in the Perseus Digital Library / OpenGreekAndLatin transcription (CC BY-SA 4.0), with the diagrams of Heiberg’s edition. Every word is read by GoLearn’s Greek analyser; nothing here has been reviewed by a classicist. ', h('a', { href: '#/settings' }, 'Sources and limits')),
    h('p', {}, 'Part of ', h('a', { href: '../' }, 'Ecclesia'), '’s library.'));
  app.replaceChildren(h('div', {}, topbar('home'), h('main', { class: 'page home route-fade' },
    h('h1', { class: 'home__title' }, h('span', { class: 'gr', lang: 'grc' }, 'Εὐκλείδου Στοιχεῖα'), 'Euclid’s Elements'),
    h('p', { class: 'home__subtitle' }, 'The Greek text of Heiberg’s edition, with GoLearn’s analysis of every word underneath.'),
    h('div', { class: 'home__rule' }), accountLine, cont, tree, about)));
  window.scrollTo(0, 0);
}

// ───────────────────────────── the reading page ─────────────────────────────
function activateWordMarkup(paragraph, text, reference, sites) {
  // Greek words become buttons for GoLearn's card; everything else stays text.
  const source = String(text ?? '');
  const chunks = source.match(/[\p{Script=Greek}\p{M}]+(?:[’'ʼ][\p{Script=Greek}\p{M}]+)?[’'ʼ]?|[^\p{Script=Greek}\p{M}]+/gu) || [source];
  let offset = 0;
  for (const chunk of chunks) {
    if (/\p{Script=Greek}/u.test(chunk)) {
      const start = source.indexOf(chunk, offset); offset = Math.max(offset, start) + chunk.length;
      const button = h('button', { type: 'button', class: 'greek-word', 'data-word': chunk, 'aria-label': `Look up ${chunk}` }, chunk);
      sites.push({ el: button, sentence: source, start, end: start + chunk.length, surface: chunk });
      button.addEventListener('click', () => document.dispatchEvent(new CustomEvent('euclid:word', { detail: { word: chunk, context: { sentence: source, start, end: start + chunk.length, reference }, element: button } })));
      paragraph.append(button);
    } else { paragraph.append(chunk); offset += chunk.length; }
  }
}
function publishUnit(detail) { currentSites = detail; document.dispatchEvent(new CustomEvent('euclid:unit', { detail })); }

function renderReader(index) {
  index = Math.max(0, Math.min(flatUnits.length - 1, index));
  const { book, unit } = flatUnits[index];
  const sameBook = currentIndex >= 0 && flatUnits[currentIndex]?.book === book;
  currentIndex = index;
  const bookUnits = book.units || [];
  const place = bookUnits.indexOf(unit) + 1;
  const reference = `Book ${roman(book)} · ${unitName(unit)}`;
  document.title = `${reference} — Euclid’s Elements`;

  const header = h('header', { class: 'reader__header' },
    h('div', { class: 'reader__header-inner' },
      h('a', { href: '#/', class: 'iconbtn', 'aria-label': 'The library', title: 'The library', html: svg('back') }),
      h('div', { class: 'reader__headbtn' },
        h('span', { class: 'reader__crumb' }, isProp(unit) ? `Book ${roman(book)} · ${propNumber(unit)} / ${propCount(book)}` : `Book ${roman(book)} · ${unitName(unit)}`),
        h('span', { class: 'reader__chapter', lang: 'grc' }, `${bookNative(book)} · ${unitNative(unit)}`)),
      h('div', { class: 'topbar__spacer' }),
      h('button', { type: 'button', class: 'iconbtn', 'aria-label': 'GoLearn account', title: 'GoLearn account', html: svg('account'), onclick: () => accountButton.click() }),
      h('a', { href: '#/settings', class: 'iconbtn', 'aria-label': 'Settings', title: 'Settings', html: svg('settings') })),
    h('div', { class: 'reader__progress', 'aria-hidden': 'true' }, h('span', { style: `width:${((index + 1) / flatUnits.length * 100).toFixed(2)}%` })));

  const sites = [];
  const col = h('main', { class: 'reader__col' },
    h('div', { class: 'reader__title' }, reference),
    h('div', { class: 'period' }, isProp(unit) ? 'Read as Euclid’s Greek (Heiberg’s text); the heading is editorial.' : `Read as Euclid’s Greek (Heiberg’s text). ${book.title}.`));
  if (place === 1 && !sameBook) col.append(h('p', { class: 'book-subtitle' }, `Book ${roman(book)}: ${book.title}`));
  for (const diagram of unit.diagrams || []) {
    const img = h('img', { src: new URL(`./${diagram.src}`, document.baseURI).href, alt: diagram.alt || 'Geometric diagram from Heiberg’s edition', loading: 'lazy' });
    const caption = h('p', { class: 'diagram-caption' }, diagram.citation || diagram.alt || 'Heiberg, Elements');
    const wrap = h('div', { class: 'diagram-wrap', role: 'button', tabindex: '0', 'aria-label': `Enlarge diagram: ${diagram.alt || 'geometric diagram'}` }, img, caption);
    img.addEventListener('error', () => { wrap.replaceChildren('Diagram image unavailable.'); wrap.className = 'diagram-wrap diagram-missing'; wrap.removeAttribute('role'); wrap.removeAttribute('tabindex'); });
    const enlarge = () => { $('large-diagram').src = img.src; $('large-diagram').alt = img.alt; $('diagram-caption').textContent = caption.textContent; $('diagram-dialog').showModal(); };
    wrap.addEventListener('click', enlarge);
    wrap.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); enlarge(); } });
    col.append(wrap);
  }
  const prose = h('div', { class: 'prose', lang: 'grc' });
  for (const entry of unit.entries || []) {
    const article = h('article', { class: 'entry-text', id: entry.id });
    if (!isProp(unit)) article.append(h('h3', {}, entry.title || ''));
    for (const text of entry.paragraphs || []) { const p = h('p'); activateWordMarkup(p, text, reference, sites); article.append(p); }
    prose.append(article);
  }
  col.append(prose);

  const prev = flatUnits[index - 1], next = flatUnits[index + 1];
  const navBtn = (dir, target) => target
    ? h('a', { class: `reader__nav-btn reader__nav-btn--${dir}`, href: unitHref(target.book, target.unit) }, h('span', { class: 'reader__nav-dir' }, dir === 'prev' ? 'Previous' : 'Next'), h('span', { class: 'reader__nav-ref' }, target.book === book ? unitName(target.unit) : `Book ${roman(target.book)} · ${unitName(target.unit)}`))
    : h('span', { class: `reader__nav-btn reader__nav-btn--${dir} is-disabled`, 'aria-disabled': 'true' }, h('span', { class: 'reader__nav-dir' }, dir === 'prev' ? 'Previous' : 'Next'));
  const nav = h('nav', { class: 'reader__nav', 'aria-label': 'Previous and next' }, h('div', { class: 'reader__nav-inner' }, navBtn('prev', prev), navBtn('next', next)));

  app.replaceChildren(h('div', { class: 'reader' }, header, col, nav));
  window.scrollTo(0, 0);
  publishUnit({ key: `${book.number}/${unit.id}`, sites });
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => store.set(STORAGE.position, JSON.stringify({ book: book.number, unit: unit.id, title: reference })), 350);
}

// ───────────────────────────── settings ─────────────────────────────
function renderSettings() {
  currentIndex = -1; publishUnit(undefined);
  document.title = 'Settings — Euclid’s Elements';
  const pill = (label, pressed, onclick) => h('button', { type: 'button', class: 'pill', 'aria-pressed': String(pressed), onclick }, label);
  const themes = h('div', { class: 'pills', role: 'group', 'aria-label': 'Theme' });
  const drawThemes = () => themes.replaceChildren(...['auto', 'light', 'dark'].map((m) => pill(m, themeMode() === m, () => { store.set(STORAGE.theme, m); applyTheme(); drawThemes(); })));
  drawThemes();
  const range = (label, value, min, max, step, unit, set) => {
    const cap = h('span', { class: 'cap' });
    const show = (v) => { cap.textContent = `${label} · ${unit(v)}`; };
    const input = h('input', { type: 'range', min, max, step, value, oninput: (e) => { set(Number(e.target.value)); show(Number(e.target.value)); } });
    show(value);
    return h('label', { class: 'field' }, cap, input);
  };
  const sample = h('p', { class: 'settings__sample', lang: 'grc' }, 'σημεῖόν ἐστιν, οὗ μέρος οὐθέν.');
  const marks = h('label', { class: 'toggle' },
    h('input', { type: 'checkbox', ...(marksOn() ? { checked: true } : {}), onchange: (e) => { store.set(STORAGE.marks, e.target.checked ? 'on' : 'off'); applyMarks(); } }),
    h('span', {}, 'Mark the words by how well I know them (only while signed in)'));
  const section = (title, ...body) => h('section', { class: 'card' }, h('h2', {}, title), ...body);
  const about = sources?.about || {};
  app.replaceChildren(h('div', { class: 'settings' }, topbar('settings'), h('main', { class: 'page screen' },
    h('h1', {}, 'Settings'),
    section('Reading',
      h('div', { class: 'field' }, h('span', { class: 'cap' }, 'Theme'), themes),
      range('Greek size', Math.round(greekSize() * 16), 18, 34, 1, (v) => `${v}px`, (v) => { store.set(STORAGE.size, String(v / 16)); applyType(); }),
      range('Line spacing', lineSpacing(), 1.5, 2.3, 0.05, (v) => v.toFixed(2), (v) => { store.set(STORAGE.spacing, String(v)); applyType(); }),
      sample, marks,
      h('button', { type: 'button', class: 'btn', onclick: () => { for (const k of [STORAGE.theme, STORAGE.size, STORAGE.spacing, STORAGE.marks]) { try { localStorage.removeItem(k); } catch { /* ignore */ } } applyTheme(); applyType(); applyMarks(); renderSettings(); } }, 'Reset settings')),
    section('Account',
      h('p', {}, 'Sign in with your GoLearn account to record the words you look up and mark; they reach GoReview from the same account. Until you do, this is a reader only.'),
      h('div', { class: 'settings__row' }, accountButton, savedButton)),
    section('Sources & licences',
      h('p', {}, 'Greek text of the ', h('i', {}, 'Elements'), ', based on Johan Ludvig Heiberg’s 1883–88 edition. The transcription derives from the Perseus Digital Library and OpenGreekAndLatin canonical-greekLit project (CTS urn:cts:greekLit:tlg1799.tlg001) as adapted in the WesternCanon corpus.'),
      h('p', {}, 'Heiberg’s edition is public domain. The digital transcription is distributed under ', h('a', { href: 'https://creativecommons.org/licenses/by-sa/4.0/', target: '_blank', rel: 'noreferrer' }, 'CC BY-SA 4.0'), '. The source follows Heiberg’s editorial exclusions, omitting passages he marked for deletion. English book and section headings, and the four parts of the library, are editorial aids.'),
      h('p', {}, 'The edition includes 459 diagram placements represented by 450 image files, plus 34 source markers for which the printed edition has no figure.'),
      h('p', {}, 'Word analysis: GoLearn’s Greek analyser and its form index (Wiktionary-derived). It has not been reviewed by a classicist.'),
      h('p', { class: 'source-line' }, 'Source data: ', h('a', { href: 'https://github.com/Rookie2401/westerncanon', target: '_blank', rel: 'noreferrer' }, 'Rookie2401/westerncanon'), '. Reader: ', h('a', { href: 'https://github.com/Rookie2401/euclid-elements', target: '_blank', rel: 'noreferrer' }, 'Rookie2401/euclid-elements'), '.'),
      about.edition ? h('p', { class: 'source-line' }, `Edition: ${about.edition}.`) : null),
    h('p', { class: 'settings__back' }, h('a', { href: '../' }, '← Ecclesia')))));
  window.scrollTo(0, 0);
}

// ───────────────────────────── routing ─────────────────────────────
function route() {
  const hash = decodeURIComponent(location.hash.slice(1));
  const legacy = hash.match(/^book-(\d+)(?:\/(.+))?$/);
  if (legacy) { // links from before the library page
    const b = books.find((x) => String(x.number) === legacy[1]);
    const u = b && ((b.units || []).find((x) => x.id === legacy[2]) || b.units?.[0]);
    if (b && u) { location.replace(unitHref(b, u)); return; }
  }
  const read = hash.match(/^\/read\/(\d+)\/(.+)$/);
  if (read) {
    let index = flatUnits.findIndex((x) => String(x.book.number) === read[1] && x.unit.id === read[2]);
    if (index < 0) index = flatUnits.findIndex((x) => String(x.book.number) === read[1]);
    if (index >= 0) { renderReader(index); return; }
  }
  if (hash === '/settings') { renderSettings(); return; }
  renderHome();
}
document.addEventListener('keydown', (e) => {
  if (currentIndex < 0 || document.querySelector('dialog[open]') || e.altKey || e.ctrlKey || e.metaKey || e.target.matches('input,textarea,select')) return;
  const go = (i) => { const t = flatUnits[i]; if (t) location.hash = unitHref(t.book, t.unit).slice(1); };
  if (e.key === 'ArrowLeft') go(currentIndex - 1);
  if (e.key === 'ArrowRight') go(currentIndex + 1);
});
window.addEventListener('hashchange', route);

try {
  const module = await import('./golearn.js?v=biblia-golearn-4');
  if (module.initGoLearn) await module.initGoLearn({ wordEvent: 'euclid:word', currentUnit: () => currentSites, accountButton, savedButton });
} catch (error) { console.info('GoLearn account and word tools are not available yet.', error); }
try {
  const response = await fetch('./data/elements.json');
  if (!response.ok) throw new Error(`The text file returned ${response.status}.`);
  const data = await response.json();
  books = data.books || []; sources = data.sources || {};
  if (!books.length) throw new Error('No books were found in the text file.');
  books.forEach((book) => (book.units || []).forEach((unit) => flatUnits.push({ book, unit })));
  route();
} catch (error) {
  app.replaceChildren(h('p', { class: 'status error', role: 'status' }, 'The Greek text could not be opened. Please refresh the page, or check that the Elements data file is available.'));
  console.error(error);
}
