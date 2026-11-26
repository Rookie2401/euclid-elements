import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const goRoot = new URL('../../go-v0/', import.meta.url);
const require = createRequire(new URL('package.json', goRoot));
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!doctype html><html><head></head><body><button id="account"></button><button id="saved"></button></body></html>', {
  url: 'https://rookie2401.github.io/euclid-elements/',
  pretendToBeVisual: true,
});
const { window } = dom;
const roots = [];
const originalAttachShadow = window.Element.prototype.attachShadow;
window.Element.prototype.attachShadow = function attachShadow(options) {
  const root = originalAttachShadow.call(this, { ...options, mode: 'open' });
  roots.push(root);
  return root;
};
window.HTMLDialogElement.prototype.showModal = function showModal() { this.setAttribute('open', ''); };
window.HTMLDialogElement.prototype.close = function close() { this.removeAttribute('open'); };
for (const key of ['window', 'document', 'localStorage', 'location', 'CustomEvent', 'HTMLElement', 'Element', 'Node', 'DOMRect']) {
  globalThis[key] = key === 'window' ? window : key === 'document' ? window.document : key === 'localStorage' ? window.localStorage : key === 'location' ? window.location : window[key];
}
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: window.navigator });
globalThis.requestAnimationFrame = window.requestAnimationFrame.bind(window);
globalThis.cancelAnimationFrame = window.cancelAnimationFrame.bind(window);

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
let resolveMe;
let resolveKnowledge;
let meCalls = 0;
let sessionCalls = 0;
let knowledgeCalls = 0;
let eventCalls = 0;
let heldShardResolve;
let holdFirstShard = false;
const requests = [];
const goPublic = new URL('public/', goRoot);
const localPublic = new URL('public/', root);
const fetchMock = async (input, init = {}) => {
  const url = new URL(input instanceof URL ? input.href : typeof input === 'string' ? input : input.url);
  requests.push({ url: url.href, method: init.method ?? 'GET', body: init.body });
  if (url.protocol === 'file:') {
    const rawPath = fileURLToPath(url);
    try { return new Response(await readFile(rawPath)); } catch { return new Response('missing', { status: 404 }); }
  }
  if (url.hostname === 'rookie2401.github.io' && url.pathname.startsWith('/biblia/lexicon/')) {
    const path = url.pathname.slice('/biblia/lexicon/'.length);
    const mapped = new URL(`public/lexicon/${path}`, goRoot);
    try {
      const bytes = await readFile(fileURLToPath(mapped));
      if (holdFirstShard && url.pathname.endsWith('.json.gz') && !heldShardResolve) {
        await new Promise((resolve) => { heldShardResolve = () => resolve(); });
      }
      return new Response(bytes);
    } catch { return new Response('missing', { status: 404 }); }
  }
  if (url.origin === 'https://go-v0.onrender.com') {
    if (url.pathname === '/me' && init.method !== 'POST') {
      meCalls++;
      if (meCalls === 1) return new Promise((resolve) => { resolveMe = () => resolve(json({ error: 'unauthorized', message: 'Expired session.' }, 401)); });
      return json({ account: { email: 'learner@example.test' } });
    }
    if (url.pathname === '/sessions' && init.method === 'POST') {
      sessionCalls++;
      const body = JSON.parse(init.body);
      if (body.password === 'incorrect') return json({ error: 'invalid-credentials', message: 'The email or password was not accepted.' }, 401);
      return json({ token: 'mock-session-token', learnerId: 'mock-learner', expiresAt: '2099-01-01T00:00:00.000Z' }, 201);
    }
    if (url.pathname === '/enrolments' && init.method === 'GET') return json({ enrolments: [] });
    if (url.pathname === '/enrolments' && init.method === 'POST') return json({ enrolment: { enrolmentId: 'mock-enrolment', languageId: 'el', varietyId: 'el-att' } }, 201);
    if (url.pathname === '/knowledge') {
      knowledgeCalls++;
      if (init.headers?.Authorization === 'Bearer mock-session-token') {
        const unitId = url.searchParams.get('unitIds')?.split(',')[0];
        return new Promise((resolve) => { resolveKnowledge = () => resolve(json({ knowledge: [{ unitId, level: 'new', encounters: 999 }] })); });
      }
      return json({ knowledge: [] });
    }
    if (url.pathname === '/events' && init.method === 'POST') { eventCalls++; return json({ stored: 1, duplicates: 0, outcomes: [] }, 201); }
    if (url.pathname === '/sessions/current' && init.method === 'DELETE') return json(null, 204);
    return json({}, 200);
  }
  return new Response('not found', { status: 404 });
};
window.fetch = fetchMock;
globalThis.fetch = fetchMock;

const sessionKey = 'biblia:session';
window.localStorage.setItem(sessionKey, JSON.stringify({ serviceUrl: 'https://go-v0.onrender.com', token: 'old-token', learnerId: 'old-learner', email: 'learner@example.test', deviceId: 'mock-device' }));
const module = await import(new URL('public/golearn.js', root).href + `?test=${Date.now()}`);
const bridge = await module.initGoLearn({ accountButton: window.document.querySelector('#account'), savedButton: window.document.querySelector('#saved') });

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
const until = async (predicate, label, timeout = 5000) => {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeout) throw new Error(`Timed out waiting for ${label}. Requests: ${JSON.stringify(requests.map((row) => row.url))}`);
    await tick();
  }
};
const cardRoot = () => roots.find((root) => root.host?.hasAttribute('data-golearn-host')) ?? roots.at(-1);

// A tap during analyser/index startup is retained, then opens with real analyser-generated details.
holdFirstShard = true;
const cardTarget = window.document.createElement('span');
window.document.body.append(cardTarget);
const euclidContext = { reference: 'Book I · Definitions' };
window.document.dispatchEvent(new window.CustomEvent('euclid:word', { detail: { word: 'λόγος', context: euclidContext, element: cardTarget } }));
await until(() => !!heldShardResolve, 'first Greek shard request');
assert.equal(cardRoot()?.querySelector('.card') ?? null, null, 'the card must wait until the required shard is available');
const secondTarget = window.document.createElement('span');
window.document.body.append(secondTarget);
window.document.dispatchEvent(new window.CustomEvent('euclid:word', { detail: { word: 'καί', context: euclidContext, element: secondTarget } }));
await until(() => !!cardRoot()?.querySelector('.card'), 'second rapid word card');
assert.match(cardRoot().textContent, /καί/u, 'the newer tap should win while the first tap waits on a shard');
heldShardResolve(); heldShardResolve = undefined; holdFirstShard = false;
await until(() => !!cardRoot()?.querySelector('.card'), 'first word card');
const card = cardRoot();
assert.match(card.textContent, /καί/u, 'late completion from the first tap must not replace the newer card');
assert.ok(card.textContent.includes('Wiktionary'), 'card sources should name the shared Greek index source');

// The account page is Biblia's own screen in GoReview's look (a hero, then warm tiles), saying Euclid's name. The reader draws it only
// once the saved-session check is done, so an old /me 401 cannot race the sign-in form.
let sessionChecked = false;
void bridge.ready.then(() => { sessionChecked = true; });
await tick();
assert.equal(sessionChecked, false, 'the saved-session check is still running');
resolveMe();
await until(() => sessionChecked, 'saved-session check');
assert.equal(bridge.signedIn(), false, 'the session the service refused is dropped');
let left = 0;
const page = bridge.renderAccount(window.document.createElement('div'), () => { left++; });
window.document.body.append(page);
assert.deepEqual([...page.querySelector('.acct-hero').children].map((node) => node.textContent), ['Welcome', 'Euclid'], 'the hero: a kicker over the reader’s name');
assert.equal(page.querySelector('#account-welcome > summary').textContent, 'Welcome to Euclid');
assert.doesNotMatch(page.textContent, /Biblia/u, 'the page speaks of Euclid, not of the reader it was written for');
assert.ok(page.querySelector('#account-form.acct-tile'), 'sign-in is a tile');
assert.equal(page.querySelector('.card, .btn'), null, 'no boxed card or boxed button is left on the page');
const email = page.querySelector('#account-email');
const password = page.querySelector('#account-password');
const formStatus = () => page.querySelector('#account-form .status')?.textContent ?? '';
email.value = 'learner@example.test'; password.value = 'incorrect';
page.querySelector('#account-form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
await until(() => formStatus().includes('not accepted'), 'visible sign-in server error');
assert.equal(password.value, '', 'the password field is emptied after each attempt');
password.value = 'mock-password';
page.querySelector('#account-form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
await until(() => bridge.signedIn(), 'successful mocked sign-in');
await until(() => window.document.querySelector('#account').textContent.includes('learner@example.test'), 'the library’s account line names the account');
await until(() => left === 1, 'the page hands back to the library after sign-in');
page.remove();
const signedInPage = bridge.renderAccount(window.document.createElement('div'), () => {});
window.document.body.append(signedInPage);
assert.equal(signedInPage.querySelector('.acct-hero__kicker').textContent, 'Your account');
assert.deepEqual([...signedInPage.querySelectorAll('.account-tile__title')].map((node) => node.textContent), ['Sign out', 'Download my data', 'Delete account']);
signedInPage.remove();
for (const [which, fromAbout, back] of [['terms', true, '#/about'], ['privacy', false, '#/account']]) {
  const legal = bridge.renderLegal(window.document.createElement('div'), which, fromAbout);
  assert.ok(legal.querySelector(`a[href="${back}"]`), `the ${which} page leads back to ${back}`);
  assert.ok(legal.querySelector('.legal-text').textContent.length > 500);
}

// Verify knowledge can load, a mark posts through the recorder, and an older pending GET cannot undo the mark.
const knowledgeBefore = knowledgeCalls;
window.document.dispatchEvent(new window.CustomEvent('euclid:word', { detail: { word: 'λόγος', context: euclidContext, element: cardTarget } }));
await until(() => knowledgeCalls > knowledgeBefore, 'new-session knowledge request');
const signedInCard = cardRoot();
signedInCard.querySelector('.deeperBtn')?.click();
const formDetails = signedInCard.querySelector('[data-layer="morphology"]')?.textContent ?? '';
const paradigmDetails = signedInCard.querySelector('[data-layer="forms"]')?.textContent ?? '';
assert.match(formDetails, /NOUN|noun|Nominative|Case/u, 'the Form layer should name the analysed grammar');
assert.match(paradigmDetails, /\b28 forms\b/u, 'the All forms layer should report its actual generated cell count');
assert.match(paradigmDetails, /λόγου/u, 'the All forms layer should contain the generated genitive singular form');
const eventCallsBeforeMark = eventCalls;
const mark = signedInCard.querySelector('[data-mark="recognized"]');
assert.ok(mark, 'the card should expose its real knowledge-level controls');
mark.click();
await until(() => eventCalls > eventCallsBeforeMark && typeof resolveKnowledge === 'function', 'mock knowledge read and mark append');
resolveKnowledge();
await until(() => signedInCard.querySelector('.feedback')?.textContent.includes('Synced to GoLearn'), 'mock mark acknowledgement');
await tick();
assert.equal(signedInCard.querySelector('[data-mark="recognized"]').getAttribute('aria-pressed'), 'true', 'stale knowledge results cannot clear a newly recorded mark');
assert.doesNotMatch(signedInCard.querySelector('.encounters').textContent, /999/u, 'stale knowledge must not replace the profile after a mark');
assert.equal(sessionCalls, 2, 'one failed and one successful POST /sessions were sent to the mock only');
const recorded = requests.filter((row) => row.url.endsWith('/events') && row.method === 'POST').flatMap((row) => JSON.parse(row.body).events);
assert.ok(recorded.length >= 2, 'lookup and mark should be recorded to the account event stream');
for (const event of recorded) {
  assert.equal(event.languageId, 'el');
  assert.equal(event.payload.variety.varietyId, 'el-att', 'Euclid learning events use Classical Attic Greek');
  if (event.kind === 'SelectionLookedUp') {
    assert.equal(event.payload.language.varietyId, 'el-att');
    assert.equal(event.payload.readerId, 'euclid-elements', 'lookup events identify the Euclid reader');
  }
  assert.equal(event.subject.sourceRef.kind, 'ebook');
  assert.equal(event.subject.sourceRef.title, 'Euclid, Elements');
  assert.match(event.subject.sourceRef.locator, /Book/u);
}

console.log(JSON.stringify({ checks: ['analyser-ready lookup', 'Greek details/paradigm', 'shard-source attribution', 'session-check sign-in gate', 'account page in the new look', 'visible server failure', 'mock sign-in', 'signed-in tiles', 'legal pages', 'mock knowledge + mark', 'stale knowledge read guard', 'Euclid provenance and Attic variety'], requests: requests.length, externalWrites: 0 }, null, 2));
dom.window.close();
