# Greek Euclid corpus

The reader corpus is built from `reference/work.json` and `reference/about.json`, the Greek *Elements* data published by [westerncanon](https://github.com/Rookie2401/westerncanon/tree/master/data/euclid-elements). The reference files are retained verbatim. `scripts/import-corpus.mjs` turns their nested Book → section → item structure into the reader's book/unit structure and fetches each referenced figure into `public/diagrams/`. Runtime reading does not require a network connection.

## Text and licensing

The text is Euclid's Greek as presented in Johan Ludvig Heiberg's *Euclidis Opera Omnia* (Leipzig: Teubner, 1883–88), a public-domain edition. The accompanying source notes identify the machine-readable transcription as the Perseus Digital Library / OpenGreekAndLatin `tlg1799.tlg001.perseus-grc2` TEI, distributed under CC BY-SA 4.0. The imported data preserves the supplied Greek passages and section/item order. Refer to the bundled `about.json` for the source's detailed editorial notes, including deleted spans and transcription anomalies.

The downloaded figures are the actual files referenced by the westerncanon data, not newly drawn substitutes. The source contains 493 figure markers: 459 point to 450 distinct image files, and 34 carry no image path. This import includes all 450 referenced image files; nine of the image-bearing markers reuse an image file. The source's accompanying prose reports different totals (463 image files and 498 markers), so this bundle reports counts measured directly from the retained `work.json` and its figure references. The 34 marker-only locations have no supplied image and are not represented as image links.

## Structure

There are 13 books and 465 propositions, with proposition counts `[48, 14, 37, 16, 25, 33, 39, 27, 36, 115, 39, 18, 18]`. Each book's definitions are combined into one unit; postulates and common notions are each combined into one unit when present; propositions remain individual units in source order. Book X's three proposition groups are joined in their printed continuous numbering (1–115). A unit's `entries` hold the original item IDs, display title, and passage text; its `diagrams` hold local `diagrams/<filename>` paths and source alt text.

## Rebuild

With Node.js 20 or newer, run `node scripts/import-corpus.mjs` from the project root. It writes `public/data/elements.json` and downloads any missing referenced figures. Existing diagram files are reused. The output embeds the retained source metadata under `sources`.
