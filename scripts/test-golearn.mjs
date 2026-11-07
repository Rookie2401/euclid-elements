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
    if (url.pathname === '/enrolments' && init.method === 'POST') return json({ enrolment: { enrolmentId: 'mock-enrolment', languageId: 'el', varietyId: 'el-koi' } }, 201);
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
await module.initGoLearn({ accountButton: window.document.querySelector('#account'), savedButton: window.document.querySelector('#saved') });

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
window.document.dispatchEvent(new window.CustomEvent('euclid:word', { detail: { word: 'λόγος', element: cardTarget } }));
await until(() => !!heldShardResolve, 'first Greek shard request');
assert.equal(cardRoot()?.querySelector('.card') ?? null, null, 'the card must wait until the required shard is available');
const secondTarget = window.document.createElement('span');
window.document.body.append(secondTarget);
window.document.dispatchEvent(new window.CustomEvent('euclid:word', { detail: { word: 'καί', element: secondTarget } }));
await until(() => !!cardRoot()?.querySelector('.card'), 'second rapid word card');
assert.match(cardRoot().textContent, /καί/u, 'the newer tap should win while the first tap waits on a shard');
heldShardResolve(); heldShardResolve = undefined; holdFirstShard = false;
await until(() => !!cardRoot()?.querySelector('.card'), 'first word card');
const card = cardRoot();
assert.match(card.textContent, /καί/u, 'late completion from the first tap must not replace the newer card');
assert.ok(card.textContent.includes('Wiktionary'), 'card sources should name the shared Greek index source');

// An old /me 401 must finish before the sign-in form is made available.
window.document.querySelector('#account').click();
await until(() => !!window.document.querySelector('dialog[open]'), 'account dialog');
assert.match(window.document.querySelector('[data-account-body]').textContent, /Checking your GoLearn sign-in/u);
assert.equal(window.document.querySelector('[data-account-body] form'), null, 'sign-in cannot race the initial session check');
resolveMe();
await until(() => !!window.document.querySelector('[data-account-body] form'), 'sign-in form after /me');
const accountBody = window.document.querySelector('[data-account-body]');
const email = accountBody.querySelector('input[type="email"]');
const password = accountBody.querySelector('input[type="password"]');
email.value = 'learner@example.test'; password.value = 'incorrect';
accountBody.querySelector('form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
await until(() => accountBody.querySelector('[role="status"]')?.textContent.includes('not accepted'), 'visible sign-in server error');
assert.match(accountBody.querySelector('[role="status"]').textContent, /not accepted/u);
password.value = 'mock-password';
accountBody.querySelector('form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
await until(() => window.document.querySelector('#account').textContent.includes('learner@example.test'), 'successful mocked sign-in');

// Verify knowledge can load, a mark posts through the recorder, and an older pending GET cannot undo the mark.
const knowledgeBefore = knowledgeCalls;
window.document.dispatchEvent(new window.CustomEvent('euclid:word', { detail: { word: 'λόγος', element: cardTarget } }));
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

console.log(JSON.stringify({ checks: ['analyser-ready lookup', 'Koine details/paradigm', 'shard-source attribution', 'session-check sign-in gate', 'visible server failure', 'mock sign-in', 'mock knowledge + mark', 'stale knowledge read guard'], requests: requests.length, externalWrites: 0 }, null, 2));
dom.window.close();
