/** Euclid Elements' adapter for the genuine GoLearn Greek analyser, word card, and account service. */
import { createCardUI } from "../../go-v0/packages/golearn-extension/src/popup/card";
import { parseSelection } from "../../go-v0/packages/golearn-extension/src/parser";
import { loadAnalyser } from "../../go-v0/packages/golearn-extension/src/analysers/loaders";
import { installGreekIndex, type GreekFormIndex } from "../../go-v0/src/adapters/greek/index-store";
import { createAccountService } from "../../go-v0/packages/biblia/src/account";
import { accountRecorder, APP_VERSION, READER_ID } from "../../go-v0/packages/biblia/src/repo";
import { createEventQueue } from "../../go-v0/packages/biblia/src/queue";
import { buildAssistanceEvent, buildMarkEvent, buildSelectionEvent } from "../../go-v0/packages/golearn-extension/src/store";

const SERVICE_URL = "https://go-v0.onrender.com";
const SAVED_KEY = "euclid-elements:saved-words";
const CARD = createCardUI({ doc: document, speech: window.speechSynthesis });
let account: ReturnType<typeof createAccountService> | undefined;
let recorder: ReturnType<typeof accountRecorder> | undefined;
let activeModel: ReturnType<typeof parseSelection> | undefined;
let accountButton: HTMLButtonElement | undefined;
let savedButton: HTMLButtonElement | undefined;
let accountDialog: HTMLDialogElement | undefined;
let savedDialog: HTMLDialogElement | undefined;

type WordContext = { sentence?: string; start?: number; end?: number; reference?: string; varietyId?: string };
type WordDetail = { word: string; context?: WordContext; element?: HTMLElement };
type SavedWord = { word: string; context?: WordContext; savedAt: string };

function addStylesheet(): void {
  const href = new URL("./golearn.css", import.meta.url).href;
  if ([...document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')].some((link) => link.href === href)) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  document.head.append(link);
}

function h<K extends keyof HTMLElementTagNameMap>(tag: K, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  return node;
}

function readSaved(): SavedWord[] {
  try {
    const data: unknown = JSON.parse(localStorage.getItem(SAVED_KEY) ?? "[]");
    return Array.isArray(data) ? data.filter((row): row is SavedWord => !!row && typeof row.word === "string") : [];
  } catch { return []; }
}

function writeSaved(rows: SavedWord[]): void {
  try { localStorage.setItem(SAVED_KEY, JSON.stringify(rows)); } catch { /* Device storage may be unavailable. */ }
  renderSaved();
}

function renderSaved(): void {
  if (!savedButton) return;
  savedButton.textContent = `Saved words (${readSaved().length})`;
}

function saveCurrent(detail: WordDetail): void {
  const rows = readSaved();
  const normalized = detail.word.normalize("NFC");
  if (!rows.some((row) => row.word === normalized && row.context?.reference === detail.context?.reference)) {
    rows.unshift({ word: normalized, ...(detail.context ? { context: detail.context } : {}), savedAt: new Date().toISOString() });
    writeSaved(rows);
  }
}

function showSaved(): void {
  if (!savedDialog) return;
  const list = savedDialog.querySelector<HTMLElement>("[data-saved-list]")!;
  list.replaceChildren();
  const rows = readSaved();
  if (!rows.length) list.append(h("p", "No saved words yet. Open a word card and choose Save word."));
  for (const row of rows) {
    const item = h("li");
    const open = h("button", row.word);
    open.type = "button";
    open.addEventListener("click", () => { savedDialog?.close(); openWord({ word: row.word, context: row.context }); });
    item.append(open);
    if (row.context?.reference) item.append(document.createTextNode(` · ${row.context.reference}`));
    list.append(item);
  }
  if (rows.length) {
    const exportButton = h("button", "Export saved words");
    exportButton.type = "button";
    exportButton.addEventListener("click", () => {
      const blob = new Blob([JSON.stringify(rows, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = h("a");
      link.href = url; link.download = "euclid-saved-words.json"; link.click();
      URL.revokeObjectURL(url);
    });
    list.append(exportButton);
    const clearButton = h("button", "Clear saved words");
    clearButton.type = "button";
    clearButton.addEventListener("click", () => { writeSaved([]); showSaved(); });
    list.append(clearButton);
  }
  if (!savedDialog.open) savedDialog.showModal();
}

function showAccount(): void {
  if (!accountDialog) return;
  const body = accountDialog.querySelector<HTMLElement>("[data-account-body]")!;
  body.replaceChildren();
  const state = account?.state();
  if (state?.signedIn) {
    body.append(h("p", `Signed in as ${state.email ?? "your GoLearn account"}.`));
    body.append(h("p", "Word lookups and knowledge marks can sync to GoLearn when you are connected. Your Saved words list stays on this device."));
    const out = h("button", "Sign out"); out.type = "button";
    out.addEventListener("click", () => { void account?.signOut().then(() => { showAccount(); updateAccountButton(); }); });
    body.append(out);
  } else {
    body.append(h("p", "Sign in to your existing GoLearn account. Your password is sent to GoLearn over HTTPS and is not saved by this reader."));
    const form = h("form");
    const emailLabel = h("label", "Email");
    const email = h("input"); email.type = "email"; email.autocomplete = "username"; email.required = true;
    emailLabel.append(email);
    const passwordLabel = h("label", "Password");
    const password = h("input"); password.type = "password"; password.autocomplete = "current-password"; password.required = true;
    passwordLabel.append(password);
    const submit = h("button", "Sign in"); submit.type = "submit";
    const status = h("p"); status.setAttribute("role", "status"); status.setAttribute("aria-live", "polite");
    form.append(emailLabel, passwordLabel, submit, status);
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      submit.disabled = true; status.textContent = "Signing in…";
      const secret = password.value; password.value = "";
      void account?.signIn(email.value, secret).then((result) => {
        status.textContent = result.ok ? "Signed in." : "Could not sign in. Check your details and try again.";
        if (result.ok) { showAccount(); updateAccountButton(); }
      }).catch(() => { status.textContent = "Could not reach GoLearn. Try again."; }).finally(() => { password.value = ""; submit.disabled = false; });
    });
    body.append(form);
  }
  if (!accountDialog.open) accountDialog.showModal();
}

function updateAccountButton(): void {
  if (accountButton) accountButton.textContent = account?.state().signedIn ? `GoLearn · ${account.state().email ?? "signed in"}` : "Sign in to GoLearn";
}

function makeDialog(title: string, attribute: string): HTMLDialogElement {
  const dialog = h("dialog"); dialog.className = "euclid-golearn-dialog";
  const header = h("header"); header.append(h("h2", title));
  const close = h("button", "Close"); close.type = "button"; close.addEventListener("click", () => dialog.close());
  header.append(close);
  const body = h("section"); body.dataset[attribute] = "";
  dialog.append(header, body);
  document.body.append(dialog);
  return dialog;
}

function anchorFor(element?: HTMLElement): { rect: DOMRect; viewport: { width: number; height: number }; rtl: false; source: "range" } {
  const rect = element?.getBoundingClientRect() ?? new DOMRect(window.innerWidth / 2, window.innerHeight / 2, 0, 0);
  return { rect, viewport: { width: window.innerWidth, height: window.innerHeight }, rtl: false, source: "range" };
}

function openWord(detail: WordDetail): void {
  const word = detail.word.normalize("NFC").trim();
  if (!word) return;
  let model;
  const sentence = detail.context?.sentence;
  const start = detail.context?.start;
  const end = detail.context?.end;
  try {
    model = parseSelection({ surface: word, languageId: "el", context: {
      kind: sentence ? "sentence" : "none", confidence: sentence ? 1 : 0,
      ...(sentence ? { sentence, ...(start !== undefined ? { selStart: start } : {}), ...(end !== undefined ? { selEnd: end } : {}) } : {}),
      direction: "ltr", varietyId: "el-koi",
    } });
  } catch {
    const node = detail.element ?? document.body;
    CARD.showMessage("GoLearn could not analyse this word with the available Greek word list.", anchorFor(node), "info");
    return;
  }
  CARD.show(model, anchorFor(detail.element), {
    view: { languageName: `Koine Greek${detail.context?.reference ? ` · ${detail.context.reference}` : ""}` },
    actions: {
      onRate: (mark) => {
        if (!account?.session()) { CARD.setFeedback("Sign in to GoLearn to sync knowledge marks."); return; }
        CARD.setFeedback("Saving your knowledge level…");
        void recordInteraction(model, detail, "mark", mark);
      },
      onLayer: (layer) => { if (!account?.session()) CARD.setFeedback("Sign in to GoLearn to sync reading activity."); else void recordInteraction(model, detail, "layer", layer); },
    },
  });
  activeModel = model;
  // The common GoLearn card starts with no learner profile. Populate it from the
  // signed-in Repository so a saved knowledge level survives closing the card.
  void loadKnowledge(model);
  const host = CARD.host();
  const root = host ? CARD.root() : undefined;
  if (!root || root.querySelector("[data-euclid-save]")) return;
  const save = document.createElement("button"); save.type = "button"; save.dataset.euclidSave = ""; save.className = "euclid-card-save"; save.textContent = "Save word";
  save.style.cssText = "margin: .55em 0 0; padding: .4em .7em; color: #f4dfbf; background: #302719; border: 1px solid #a17d4f; border-radius: .35em; font: inherit; cursor: pointer;";
  save.addEventListener("click", () => { saveCurrent(detail); save.textContent = "Saved on this device"; });
  const card = root.querySelector(".card");
  card?.append(save);
  void recordInteraction(model, detail, "selection");
}

async function loadKnowledge(model: ReturnType<typeof parseSelection>): Promise<void> {
  const session = account?.session();
  const api = account?.api();
  if (!session || !api || !model.itemIds.length) return;
  try {
    const result = await api.knowledge(model.itemIds);
    // Avoid showing a previous word's or a previous account's knowledge.
    if (activeModel !== model || !CARD.isOpen() || account?.session()?.learnerId !== session.learnerId) return;
    if (!result.ok) {
      CARD.setFeedback("Could not retrieve this word's saved knowledge level from GoLearn.");
      return;
    }
    const rows = result.data.knowledge || [];
    // Prefer the marked lemma, then the model's main item, then the form.
    const matched = model.itemIds.map((id) => rows.find((row) => row.unitId === id)).filter((row) => !!row);
    const knowledge = matched.find((row) => !!row?.selfMark) ?? matched[0];
    CARD.update({
      profile: {
        state: "ready",
        weak: [],
        level: knowledge?.level ?? "new",
        ...(knowledge?.selfMark ? { selfMark: knowledge.selfMark.mark } : {}),
        encounters: knowledge?.encounters ?? 0,
        met: knowledge?.encounters ?? 0,
      },
    });
  } catch {
    if (activeModel === model && CARD.isOpen()) {
      CARD.setFeedback("GoLearn could not load this word's saved state. Check your connection.");
    }
  }
}

async function recordInteraction(model: ReturnType<typeof parseSelection>, detail: WordDetail, kind: "selection" | "mark" | "layer", value?: string): Promise<void> {
  if (!recorder || !account?.session()) return;
  const identity = await recorder.identity("el", "el-koi");
  if (!identity) { CARD.setFeedback("Could not connect to your GoLearn account. Your saved words remain on this device."); return; }
  const now = new Date();
  const base = {
    card: model, readerId: READER_ID, identity, version: APP_VERSION,
    sessionId: `euclid:${now.getTime().toString(36)}`, now, direction: "ltr",
    language: { languageId: "el", varietyId: "el-koi", basis: "override" as const, confidence: 1, source: detail.context?.reference ? `euclid:${detail.context.reference}` : "euclid-elements" },
  };
  const event = kind === "selection" ? buildSelectionEvent(base)
    : kind === "mark" ? buildMarkEvent(base, value as Parameters<typeof buildMarkEvent>[1])
      : buildAssistanceEvent(base, value as Parameters<typeof buildAssistanceEvent>[1]);
  try {
    const result = await recorder.record([event]);
    if (activeModel !== model || !CARD.isOpen()) return;
    if (!result.ok) CARD.setFeedback(result.message || "GoLearn could not save this activity.");
    else {
      if (kind === "mark") CARD.update({ rated: value as Parameters<typeof buildMarkEvent>[1] });
      CARD.setFeedback(result.queued ? "Saved on this device; GoLearn sync is pending." : "Synced to GoLearn.");
    }
  } catch {
    if (activeModel === model && CARD.isOpen()) CARD.setFeedback("Could not save the knowledge level. Please try again.");
  }
}

export async function initGoLearn(options: { accountButton: HTMLElement; savedButton: HTMLElement }): Promise<void> {
  addStylesheet();
  accountButton = options.accountButton as HTMLButtonElement;
  savedButton = options.savedButton as HTMLButtonElement;
  accountDialog = makeDialog("GoLearn account", "accountBody");
  savedDialog = makeDialog("Saved words", "savedList");
  account = createAccountService({ serviceUrl: SERVICE_URL, storage: localStorage, fetch: window.fetch.bind(window) });
  recorder = accountRecorder({
    session: () => { const session = account?.session(); const api = account?.api(); return session && api ? { api, learnerId: session.learnerId, deviceId: session.deviceId } : undefined; },
    queue: createEventQueue(localStorage), storage: localStorage, win: window,
    subscribeSession: (listener) => account!.subscribe(listener),
    onAuthExpired: () => account?.expire(),
  });
  accountButton.addEventListener("click", showAccount);
  savedButton.addEventListener("click", showSaved);
  renderSaved(); updateAccountButton();
  account.subscribe(updateAccountButton);
  document.addEventListener("euclid:word", ((event: CustomEvent<WordDetail>) => openWord(event.detail)) as EventListener);
  void Promise.all([loadAnalyser("el"), fetch(new URL("./lexicon/el/koine-index.json", import.meta.url)).then(async (response) => {
    if (!response.ok) return;
    installGreekIndex(await response.json() as GreekFormIndex);
  }).catch(() => undefined)]).catch(() => undefined);
  void account.start().catch(() => undefined);
}
