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

The bridge and Koine form index are checked in. To regenerate them, place the GoLearn repository alongside this checkout (or set `GOLEARN_SOURCE`), install its dependencies, and run `npm run golearn`. The current build uses GoLearn commit `2663f585334b5a2c5b9001b020229262d41b5098` and esbuild 0.28.2. Build provenance and third-party acknowledgements are in `public/vendor/`.

Word analysis uses GoLearn's available Koine tables, which have partial coverage of Euclid's mathematical Greek. Their displayed definitions are dictionary glosses; they are not a reviewed contextual translation of the geometry. Signed-in interactions use GoLearn's recorder and offline queue. Guest saved-word export stays on the device. Production CORS connectivity is checked; a real account login and sync require the account holder to test.

Do not add local storage exports, account tokens, or credentials to source control.
