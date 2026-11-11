// GoLearn's word marks on the page: a signed-in reader paints every Greek word of the unit on screen with the level the
// learner's account reports (New = light blue, Seen/Recognized/Familiar = underlines, Known = nothing), and signing out clears them.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const goRoot = new URL('../../go-v0/', import.meta.url);
const require = createRequire(new URL('package.json', goRoot));
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!doctype html><html><head></head><body><button id="account"></button><button id="saved"></button><p id="text"></p></body></html>', {
  url: 'https://rookie2401.github.io/euclid-elements/',
  pretendToBeVisual: true,
});
const { window } = dom;
window.Element.prototype.attachShadow = ((attach) => function attachShadow(options) { return attach.call(this, { ...options, mode: 'open' }); })(window.Element.prototype.attachShadow);
window.HTMLDialogElement.prototype.showModal = function showModal() { this.setAttribute('open', ''); };
window.HTMLDialogElement.prototype.close = function close() { this.removeAttribute('open'); };
for (const key of ['window', 'document', 'localStorage', 'location', 'CustomEvent', 'HTMLElement', 'Element', 'Node', 'DOMRect']) {
  globalThis[key] = key === 'window' ? window : key === 'document' ? window.document : key === 'localStorage' ? window.localStorage : key === 'location' ? window.location : window[key];
}
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: window.navigator });
globalThis.requestAnimationFrame = window.requestAnimationFrame.bind(window);
globalThis.cancelAnimationFrame = window.cancelAnimationFrame.bind(window);

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const asked = new Set();
// What the account knows: one word marked Known by the learner, one met twice (Seen), one Recognized; the rest have no row (New).
const rowFor = (unitId) => {
  if (/^lemma:el:καί/u.test(unitId)) return { unitId, level: 'known', encounters: 40, selfMark: { mark: 'known', at: '2026-11-01T00:00:00.000Z' } };
  if (unitId === 'form:el:λογος' || /^lemma:el:λόγος/u.test(unitId)) return { unitId, level: 'seen', encounters: 2 };
  if (/^(form:el:ευθεια|lemma:el:εὐθ)/u.test(unitId)) return { unitId, level: 'recognized', encounters: 5 };
  return undefined;
};
const fetchMock = async (input, init = {}) => {
  const url = new URL(input instanceof URL ? input.href : typeof input === 'string' ? input : input.url);
  if (url.protocol === 'file:') {
    try { return new Response(await readFile(fileURLToPath(url))); } catch { return new Response('missing', { status: 404 }); }
  }
  if (url.hostname === 'rookie2401.github.io' && url.pathname.startsWith('/biblia/lexicon/')) {
    try { return new Response(await readFile(fileURLToPath(new URL(`public/lexicon/${url.pathname.slice('/biblia/lexicon/'.length)}`, goRoot)))); } catch { return new Response('missing', { status: 404 }); }
  }
  if (url.origin === 'https://go-v0.onrender.com') {
    if (url.pathname === '/me') return json({ account: { email: 'learner@example.test' } });
    if (url.pathname === '/knowledge') {
      const ids = url.searchParams.get('unitIds')?.split(',') ?? [];
      ids.forEach((id) => asked.add(id));
      return json({ knowledge: ids.map(rowFor).filter(Boolean) });
    }
    if (url.pathname === '/sessions/current' && init.method === 'DELETE') return json(null, 204);
    return json({}, 200);
  }
  return new Response('not found', { status: 404 });
};
window.fetch = fetchMock;
globalThis.fetch = fetchMock;
window.localStorage.setItem('biblia:session', JSON.stringify({ serviceUrl: 'https://go-v0.onrender.com', token: 'mock-session-token', learnerId: 'mock-learner', email: 'learner@example.test', deviceId: 'mock-device' }));

const module = await import(new URL('public/golearn.js', root).href + `?test=${Date.now()}`);
await module.initGoLearn({ accountButton: window.document.querySelector('#account'), savedButton: window.document.querySelector('#saved') });

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
const until = async (predicate, label, timeout = 8000) => {
  const start = Date.now();
  while (!predicate()) { if (Date.now() - start > timeout) throw new Error(`Timed out waiting for ${label}.`); await tick(); }
};

// The reader hands over the unit's words exactly as reader.js builds them.
const sentence = 'καὶ ὁ λόγος τῆς εὐθείας γραμμῆς';
const paragraph = window.document.querySelector('#text');
const sites = [];
let offset = 0;
for (const surface of sentence.split(' ')) {
  const el = window.document.createElement('button');
  el.className = 'greek-word'; el.textContent = surface;
  const start = sentence.indexOf(surface, offset); offset = start + surface.length;
  sites.push({ el, sentence, start, end: offset, surface });
  paragraph.append(el, ' ');
}
window.document.dispatchEvent(new window.CustomEvent('euclid:unit', { detail: { key: '1/test', sites } }));
const level = (surface) => sites.find((site) => site.surface === surface).el.getAttribute('data-level');
await until(() => sites.some((site) => site.el.hasAttribute('data-level')), 'the words to be painted');

assert.ok([...asked].some((id) => id.startsWith('lemma:el:')), 'words are asked about by their lemma as well as their form');
assert.equal(level('καὶ'), 'known', 'a word the learner marked Known carries no highlight');
assert.equal(level('λόγος'), 'seen', 'a word met before is underlined as Seen');
assert.equal(level('εὐθείας'), 'recognized', 'a Recognized word carries the lighter underline');
assert.equal(level('γραμμῆς'), 'new', 'a word never met is highlighted as New');

const css = await readFile(new URL('public/reader.css', root), 'utf8');
assert.match(css, /\.greek-word\[data-level="new"\] \{ background-color: rgba\(173, 216, 230/u, 'New is light blue');
for (const mark of ['seen', 'recognized', 'familiar']) assert.match(css, new RegExp(`\\.greek-word\\[data-level="${mark}"\\] \\{ text-decoration: underline`, 'u'));
assert.doesNotMatch(css, /data-level="known"/u, 'Known words are drawn with nothing');

const painted = Object.fromEntries(sites.map((site) => [site.surface, site.el.getAttribute('data-level')]));

// Signing out takes the marks away.
window.document.querySelector('#account').click();
await until(() => [...window.document.querySelectorAll('[data-account-body] button')].some((b) => b.textContent === 'Sign out'), 'the sign-out button');
[...window.document.querySelectorAll('[data-account-body] button')].find((b) => b.textContent === 'Sign out').click();
await until(() => sites.every((site) => !site.el.hasAttribute('data-level')), 'the marks to clear after sign-out');

console.log(JSON.stringify({ painted, unitIdsAsked: asked.size, signOutClears: true }, null, 2));
window.close();
process.exit(0);
