// Euclid's Elements, laid out as Biblia is: a library page (a tree that opens division → book → its sections and propositions),
// a reading page (a slim header with the way back, where you are, and settings; the text; a pager fixed at the foot), and a
// settings and account pages. Routes: #/ (library), #/read/<book>/<unit> (reading), #/settings, #/account. Older links (#book-1/<unit>) still open.
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
  book:'<path d="M3 5.5c3.2-.9 6.2-.2 9 1.8v14c-2.8-2-5.8-2.7-9-1.8zM21 5.5c-3.2-.9-6.2-.2-9 1.8v14c2.8-2 5.8-2.7 9-1.8z"/>',
  layers:'<path d="m12 3 9 5-9 5-9-5 9-5zm-9 9 9 5 9-5M3 16l9 5 9-5"/>',
  licences:'<path d="M6 3h9l4 4v14H6zM15 3v5h4M9 12h7M9 16h7"/>',
  reset:'<path d="M3 12a9 9 0 1 0 2.6-6.4L3 8m0-5v5h5"/>',
  account:'<circle cx="12" cy="8.5" r="3.5"/><path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6"/>',
  settings:'<path d="M4 7h10M18 7h2M4 12h2M10 12h10M4 17h8M16 17h4"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="12" r="2"/><circle cx="14" cy="17" r="2"/>',
};
const svg = (name) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${ICON[name]}</svg>`;

let books = [], flatUnits = [], sources = {}, currentIndex = -1, saveTimer, currentSites, goLearnBridge;
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
function greekSize() {
  const s = Number(store.get(STORAGE.size));
  if (s >= 16 && s <= 36) return s;
  // Migrate Euclid's earlier rem preference to Biblia's pixel setting.
  if (s >= 1.1 && s <= 2.1) return Math.round(s * 16);
  return 22;
}
function lineSpacing() { const s = Number(store.get(STORAGE.spacing)); return s >= 1.4 && s <= 2.6 ? s : 1.85; }
function applyType() {
  document.documentElement.style.setProperty('--greek-size', `${greekSize()}px`);
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
    h('a', { href: '#/account', class: `iconbtn${current === 'account' ? ' iconbtn--active' : ''}`, 'aria-label': 'GoLearn account', title: 'GoLearn account', ...(current === 'account' ? { 'aria-current': 'page' } : {}), html: svg('account') }),
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
      h('a', { href: '#/account', class: 'iconbtn', 'aria-label': 'GoLearn account', title: 'GoLearn account', html: svg('account') }),
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
  const labelled = (caption, control) => h('div', { class: 'field' }, h('span', { class: 'cap' }, caption), control);
  const pills = (label, options, current, onPick) => {
    const wrap = h('div', { class: 'pills', role: 'group', 'aria-label': label });
    const buttons = options.map(([value, text]) => h('button', {
      type: 'button', class: 'pill', 'aria-pressed': String(value === current), 'data-value': value,
      onclick: () => { onPick(value); for (const button of buttons) button.setAttribute('aria-pressed', String(button.dataset.value === value)); },
    }, text));
    wrap.append(...buttons);
    return wrap;
  };
  const slider = (id, caption, min, max, step, value, format, onInput) => {
    const output = h('span', { class: 'slider__value', 'aria-hidden': 'true' }, format(value));
    const input = h('input', { type: 'range', id, min, max, step, value, 'aria-valuetext': format(value), oninput: (event) => {
      const next = Number(event.target.value); output.textContent = format(next); event.target.setAttribute('aria-valuetext', format(next)); onInput(next);
    } });
    return h('div', { class: 'field field--slider' }, h('label', { class: 'cap', for: id }, caption, output), input);
  };
  const disclosure = (id, iconName, title, subtitle, ...body) => h('details', { class: 'card settings-disclosure', id },
    h('summary', {}, h('span', { class: 'settings-disclosure__icon', html: svg(iconName) }),
      h('span', { class: 'settings-disclosure__copy' }, h('span', { class: 'settings-disclosure__title' }, title), h('span', { class: 'settings-disclosure__subtitle' }, subtitle)),
      h('span', { class: 'settings-disclosure__arrow', html: svg('chev') })),
    h('div', { class: 'settings-disclosure__body' }, ...body));
  const reset = h('button', { type: 'button', class: 'btn', id: 'settings-reset', onclick: () => {
    for (const key of [STORAGE.theme, STORAGE.size, STORAGE.spacing, STORAGE.marks]) { try { localStorage.removeItem(key); } catch { /* storage may be blocked */ } }
    applyTheme(); applyType(); applyMarks(); renderSettings();
  } }, h('span', { html: svg('reset') }), 'Reset settings');
  const reading = h('section', { class: 'card settings-reading', id: 'settings-reading', 'aria-labelledby': 'settings-reading-heading' },
    h('div', { class: 'settings-reading__intro' }, h('span', { html: svg('book') }), h('h2', { class: 'settings-reading__heading', id: 'settings-reading-heading' }, 'Reading')),
    h('div', { class: 'settings-row' }, labelled('Theme', pills('Theme', [['auto', 'Auto'], ['light', 'Light'], ['dark', 'Dark']], themeMode(), (mode) => { store.set(STORAGE.theme, mode); applyTheme(); }))),
    h('div', { class: 'settings-row settings-row--slider' }, slider('set-greek-size', 'Greek text size', 16, 36, 1, greekSize(), (n) => `${n} px`, (n) => { store.set(STORAGE.size, String(n)); applyType(); })),
    h('div', { class: 'settings-row settings-row--slider' }, slider('set-line-height', 'Line spacing', 1.4, 2.6, 0.05, lineSpacing(), (n) => n.toFixed(2), (n) => { store.set(STORAGE.spacing, String(n)); applyType(); })),
    h('div', { class: 'settings-reader-footer' }, h('label', { class: 'toggle' },
      h('input', { type: 'checkbox', id: 'set-level-marks', ...(marksOn() ? { checked: true } : {}), onchange: (event) => { store.set(STORAGE.marks, event.target.checked ? 'on' : 'off'); applyMarks(); } }),
      h('span', {}, 'Mark words by familiarity', h('span', { class: 'help' }, ' Available when signed in.'))), reset));
  const offline = disclosure('settings-offline', 'layers', 'Offline reading', 'Pages open from the current connection.',
    h('p', {}, 'This edition loads the reader and each part of the Elements from the connection where it was opened. It is not yet installed for offline use.'),
    h('p', { class: 'muted' }, 'Kept on this device: your place in the Elements, which parts of the library are open, these settings, your sign-in, and words saved on this device.'));
  const sourceCard = disclosure('settings-sources', 'licences', 'Sources & Licences', 'Text edition, analysis, diagrams, and typography.',
    h('p', {}, 'Greek text: Johan Ludvig Heiberg’s 1883–88 edition, from the Perseus Digital Library and OpenGreekAndLatin transcription as adapted in WesternCanon. Heiberg’s edition is public domain; the digital transcription is CC BY-SA 4.0.'),
    h('p', {}, 'Analysis: GoLearn’s Classical Greek analyser and Wiktionary-derived form index. Diagrams come from Heiberg’s printed edition. Nothing has been reviewed by a classicist.'),
    h('p', { class: 'muted' }, 'Type: EB Garamond for Latin and Greek, under the SIL Open Font License 1.1.'),
    h('p', { class: 'muted' }, h('a', { href: './fonts/EB-Garamond-OFL.txt', target: '_blank', rel: 'noopener' }, 'EB Garamond licence')));
  const footer = h('footer', { class: 'settings-legal-footer' }, h('nav', { class: 'settings-links', 'aria-label': 'Information and legal pages' },
    h('a', { href: '#/sources' }, 'Sources & limits'), ' · ', h('a', { href: '#/terms/settings' }, 'Terms'), ' · ', h('a', { href: '#/privacy/settings' }, 'Privacy')));
  app.replaceChildren(h('div', { class: 'settings' }, topbar('settings'), h('main', { class: 'screen' }, h('h1', {}, 'Settings'), reading, offline, sourceCard, footer)));
  window.scrollTo(0, 0);
}

function renderSources() {
  currentIndex = -1; publishUnit(undefined);
  document.title = 'Sources and limits — Euclid’s Elements';
  const about = sources?.about || {};
  app.replaceChildren(h('div', {}, topbar(), h('main', { class: 'screen' }, h('h1', {}, 'Sources and limits'),
    h('section', { class: 'card' }, h('h2', {}, 'Text and analysis'),
      h('p', {}, 'Greek text of Euclid’s ', h('i', {}, 'Elements'), ', based on Johan Ludvig Heiberg’s 1883–88 edition. The transcription derives from the Perseus Digital Library and OpenGreekAndLatin canonical-greekLit project (CTS urn:cts:greekLit:tlg1799.tlg001) as adapted in the WesternCanon corpus.'),
      h('p', {}, 'Heiberg’s edition is public domain. The digital transcription is distributed under CC BY-SA 4.0. English book and section headings, and the four parts of the library, are editorial aids.'),
      about.edition ? h('p', { class: 'muted' }, `Edition: ${about.edition}.`) : null),
    h('section', { class: 'card' }, h('h2', {}, 'Diagrams and limits'),
      h('p', {}, 'The edition includes 459 diagram placements represented by 450 image files, plus 34 source markers for which the printed edition has no figure.'),
      h('p', {}, 'Word analysis comes from GoLearn’s Classical Greek analyser and Wiktionary-derived form index. It has not been reviewed by a classicist.')),
    h('section', { class: 'card' }, h('h2', {}, 'Type'), h('p', {}, 'EB Garamond for Latin and Greek, under the SIL Open Font License 1.1.')),
    h('p', {}, h('a', { class: 'btn', href: '#/' }, 'Library')))));
  window.scrollTo(0, 0);
}

async function renderAccountRoute() {
  currentIndex = -1; publishUnit(undefined);
  document.title = 'Account — Euclid’s Elements';
  if (!goLearnBridge?.renderAccount) {
    app.replaceChildren(h('div', {}, topbar('account'), h('main', { class: 'screen' }, h('h1', {}, 'Account'), h('p', { class: 'status error' }, 'The GoLearn account could not be opened.'))));
    return;
  }
  app.replaceChildren(h('div', {}, topbar('account'), h('main', { class: 'screen' }, h('p', { class: 'status' }, 'Checking your GoLearn sign-in…'))));
  await goLearnBridge.ready;
  if (decodeURIComponent(location.hash.slice(1)).split('/')[1] !== 'account') return;
  app.replaceChildren(goLearnBridge.renderAccount(topbar('account'), () => { location.hash = '#/'; }));
  window.scrollTo(0, 0);
}

async function renderLegalRoute(which, fromSettings) {
  currentIndex = -1; publishUnit(undefined);
  if (!goLearnBridge?.renderLegal) return;
  await goLearnBridge.ready;
  const hash = decodeURIComponent(location.hash.slice(1));
  if (!hash.startsWith(`/${which}`)) return;
  document.title = `${which === 'privacy' ? 'Privacy Policy' : 'Terms of use'} — Euclid’s Elements`;
  app.replaceChildren(goLearnBridge.renderLegal(topbar(), which, fromSettings));
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
  if (hash === '/sources') { renderSources(); return; }
  if (hash === '/account') { void renderAccountRoute(); return; }
  if (hash === '/privacy' || hash === '/privacy/settings') { void renderLegalRoute('privacy', hash.endsWith('/settings')); return; }
  if (hash === '/terms' || hash === '/terms/settings') { void renderLegalRoute('terms', hash.endsWith('/settings')); return; }
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
  const module = await import('./golearn.js?v=biblia-account-settings-1');
  if (module.initGoLearn) goLearnBridge = await module.initGoLearn({ wordEvent: 'euclid:word', currentUnit: () => currentSites, accountButton, savedButton });
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
