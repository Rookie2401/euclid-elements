# Euclid · Elements in Greek

A standalone reading edition of the thirteen books, with grouped preliminary sections, sourced diagrams, and GoLearn vocabulary tools.

Published reader: https://rookie2401.github.io/euclid-elements/

This GitHub edition is a fresh implementation from the available Greek corpus and GoLearn source. The earlier ChatGPT-hosted reader remains a separate edition.

## Local preview

Use a local checkout outside OneDrive. Node.js 24 is sufficient to serve the checked-in website:

```sh
npm run validate
npm run serve
```

The site is the `public/` directory and needs no server or credentials to read. All asset paths are relative so it works under the GitHub Pages project path.

## Publication

The `main` branch contains source and imported material. GitHub Pages serves only `public/`, split onto the `gh-pages` branch:

```sh
git subtree split --prefix public -b gh-pages
git push origin main gh-pages
```

Pages is configured for the `gh-pages` branch at `/`.

## Text and diagrams

The Greek corpus is adapted from [WesternCanon’s Euclid dataset](https://github.com/Rookie2401/westerncanon/tree/master/data/euclid-elements), derived from the Perseus transcription of Heiberg’s edition. See [CORPUS.md](CORPUS.md) and the reader’s About panel for editorial choices, actual diagram coverage, and source acknowledgements. Digital Greek text is CC BY-SA 4.0. No missing diagram is generated or invented.

## GoLearn

The vocabulary integration uses the existing GoLearn analysis/card code. Its account connects directly to `https://go-v0.onrender.com`; passwords are sent only there. Reader preferences and guest vocabulary are stored in the browser. Account sessions belong to this site’s browser storage, independently of the earlier hosted reader. No account password or personal vocabulary is included in this repository.

The bridge and Greek form index are checked in. To regenerate them, place the GoLearn repository alongside this checkout (or set `GOLEARN_SOURCE`), install its dependencies, and run `npm run golearn`. The current build uses GoLearn commit `e47a943f136a42306e830fa76e618053e46e3b4d` (the commit `rebuild-golearn.yml` pins; it carries the account page in its new look) and esbuild 0.28.2. Build provenance and third-party acknowledgements are in `public/vendor/`.

Euclid's text is Classical (Attic) Greek, so its GoLearn enrolment and recorded activity use the `el-att` variety. Word analysis uses GoLearn's bundled Greek index and loads Ancient and Modern Greek table shards from the public Biblia edition when needed. Those tables have partial coverage of Euclid's mathematical Greek. Their displayed definitions are sourced glosses, rather than a reviewed contextual translation of the geometry. Grammar explanations and generated forms come from GoLearn's shared language pack and analyser. Greek has no full dictionary pack configured upstream, so dictionary-only etymologies, recordings, and related-word records can remain unavailable.

Signed-in interactions use GoLearn's recorder and offline queue. Activity identifies the `euclid-elements` reader and includes an ebook source reference with the book or section locator, allowing GoReview's vocabulary view to show where a word came from. Lookups and knowledge marks sync to the account; the separate “Save on this device” list and its export stay local to this browser. Production connectivity is checked; real account login and sync require the account holder to test. The adapter waits for saved-session checks before showing the sign-in form, preserves new knowledge marks against stale responses, and shows the service's sign-in error message.

Do not add local storage exports, account tokens, or credentials to source control.
