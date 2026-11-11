# Development

Requires Node 24 and npm 11. The version is pinned in `.nvmrc`; with [nvm](https://github.com/nvm-sh/nvm), run `nvm use` in the project folder (or `nvm install` the first time) before any npm command. If your shell still reports another version with `node -v`, run `hash -r` or open a new terminal.

```sh
nvm use
npm install
npm run dev          # local development server
npm run generate     # static build in .output/public
npm run verify       # every check below that CI runs: lint, typecheck, unit, build, model, e2e, names; one summary, non-zero exit on any failure
npm run serve        # serve the static build on http://localhost:4173
npm run lint
npm run typecheck
npm test             # unit tests (Vitest)
npm run test:e2e     # end-to-end tests against the static build (Playwright)
npm run bench        # time a 5,000-row file from import to download
npm run licenses     # fail on dependency licenses outside the allowlist
npm run eval         # detection recall and precision; --write updates the numbers in docs/accuracy.md
npm run models       # download and check the name model (also part of dev and generate)
npm run test:model   # run the real name model through the post-processing (after npm run models)
npm run eval:names   # name and place accuracy in Chromium (after npm run generate); see below
```

Run `npm run generate` before `npm run test:e2e`, or use `npm run verify -- e2e`, which always builds first. CI runs `npm run verify` too (split across its two test jobs), so a local `npm run verify` checks what CI checks; read its summary or exit code, not the last lines of a test run, which can hide failures listed above them. The first time, install the test browser with `npx playwright install chromium`.

Every end-to-end test fails if the page contacts any origin other than the app itself.

## Translations

The interface is in English and German. English lives at `/`, German under `/de/` (`prefix_except_default`), so every page is prerendered in both languages and German pages can be shared and indexed; each page links to the other language with `hreflang`.

- Every change adds both languages: `i18n/locales/en.json` and `i18n/locales/de.json`. `tests/unit/locales.test.ts` fails if a message exists in one language only, or if placeholders or plural forms differ.
- German is plain and uses "Sie". The German locale is `de-AT`, so numbers, lists and any written dates follow Austrian conventions ("Jänner"). Dates in the cleaning report stay ISO (2026-11-10), which reads the same in both languages.
- The language is chosen like this: an explicit `/de/` address always wins; only the root `/` follows a saved choice (`painfold-language` in `localStorage`) or, without one, the browser language, in a small inline script before first paint. The switch in the header saves the choice and moves to the same page in the other language inside the app, so an open file and the review are kept. No cookie is set.
- Known limit: a missing address under `/de/` is answered with the single prerendered 404 page, which is in English until the app has loaded, then German.

### German texts to review before release

These are where precise wording matters most; a native speaker should review them before each release that changes them:

- The privacy notice and the start screen's privacy line (`privacy.notice`, `start.privacy`, `start.dropOverlay`).
- The limits notice (`review.limits`), also used in the cleaning report.
- The "What leaves your browser" panel (`network.none`, `network.explain`, `network.allOwn`, `network.foreign`, `network.stored`).
- The name model download: what is downloaded and kept, and the failure and offline messages (`nameModel.*`). "Namensmodell" is the chosen term.
- The small-screen sheet (`smallScreen.*`: "Painfold mag größere Bildschirme" and its text, which should stay warm and a little playful) and the small-screen notes (`nameModel.smallScreen`, `download.names.smallScreen`).
- The Accuracy page (`accuracy.*`): the opening sentence ("Von 100 Namen in Ihrem Feedback entfernt Painfold etwa 97 …"), the findings, how it is measured, the name-origin groups ("Herkunftsgruppe"), the known gaps and the model's licence note.
- Opening files: the note about documents and transcripts and the unsupported-file message (`importNotes.*`, `importErrors.unsupported-format`).
- Names in the review and the download: the check, Stop and its question, and what the cleaning report says (`nameScan.*`, `download.names.*`).
- Column warnings and reasons (`columns.warning`, `columns.checkInstead`, `columns.masked`, `columns.reason.*`, `columns.help`).
- What the download contains and what is kept (`download.mapStays`, `download.reportExplain`, `download.notReviewed`) and the cleaning report (`report.*`).
- Terms chosen for this product: the column roles "Prüfen / Unverändert / Weglassen", "Treffer" for a finding, and "UID-Nummer" for VAT ID.

Open questions for the reviewer:

- "Aufgaben, Probleme und Wünsche" for jobs, pains and gains, or keeping the canvas terms "Jobs, Pains und Gains", which German-speaking product teams often use?
- "Kunden", "Kund:innen" or "Kundschaft" in the headline, the roadmap and elsewhere?

The review happens before the v0.2.0 release.



All test data is fake and generated: see [data/README.md](../data/README.md) for what is in it and where each kind of value comes from. Never add real customer data to the repository.

## Continuous integration

Every pull request runs four jobs: lint, typecheck, unit tests, the detection accuracy (shown in the job summary) and the static build; end-to-end tests; the name accuracy check (see Name model); and a dependency check (`npm audit --audit-level=high` and the license allowlist). All must pass before review.

## Security headers

`deploy/headers.ts` is the single source of truth for the Content-Security-Policy and the other security headers.

- `npm run generate` builds the site, then `scripts/apply-csp.ts` adds the full policy to every page as a `<meta>` tag, with hashes of that build's inline scripts. It also fails the build if any page or stylesheet references another origin.
- Static headers (framing, `nosniff`, referrer, permissions, and the full policy for app files and Web Workers) come from `headersFor()`. The local preview server sends them, so the end-to-end tests run under the real policy.
- `vercel.json` is generated from the same file with `npm run headers:vercel`; a unit test fails if it is out of date.
- For Cloudflare, the build writes a `_headers` file from the same file (`scripts/write-cloudflare-assets.ts`). Every matching rule applies there and a header set twice gets both values joined by a comma, so the rules for app files remove the page policy before setting their own; a unit test applies the file the way Cloudflare does and compares every path with `headersFor()`. The Worker that serves the model sets `headersFor()` itself.
- No policy names a host: every source is a keyword, a hash or `data:`, and a unit test fails otherwise. On any address the site only talks to itself.
- Every response sends `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp`, so pages are cross-origin isolated: WebAssembly threads need it, and the name model runs about 4 times faster with them. Everything Painfold loads is same-origin, so nothing else is affected.
- App code (`/_nuxt/`) and the ONNX Runtime files (`/ort/`) may compile WebAssembly (`'wasm-unsafe-eval'`), because the name model runs in the detection worker. Pages may not, and `'unsafe-eval'` is never allowed.

## Name model

Names and places are found by [Davlan/distilbert-base-multilingual-cased-ner-hrl](https://huggingface.co/Davlan/distilbert-base-multilingual-cased-ner-hrl) (AFL-3.0), in the int8 ONNX export by [Xenova](https://huggingface.co/Xenova/distilbert-base-multilingual-cased-ner-hrl). It was trained on news text, including CoNLL-2003 for German and English; the CoNLL source texts are themselves licensed, which is a common grey area for models trained on them.

- `deploy/model.ts` pins the exact Hugging Face revision and the SHA-256 and size of every file transformers.js loads. `scripts/fetch-model.ts` (part of `npm run dev` and `npm run generate`) downloads them into `node_modules/.cache/painfold-models/`, checks every hash and size and fails on a mismatch, then copies the model to `public/models/<id>/<revision>/` and the ONNX Runtime WebAssembly files to `public/ort/<version>/`. Both are ignored by git and served from this site with immutable caching; users' browsers never contact Hugging Face or a CDN.
- Nothing is downloaded until the user agrees: the column step explains the model and its size (computed at build time from the served files, `downloadBytes`), and the review offers the same download to people who skipped it. Where the browser reports Save-Data or a cellular connection, it suggests Wi-Fi.
- The model runs in its own worker (`app/workers/names.worker.ts`), separate from the rules, so Cancel stops that worker and the rules keep working. `useNameModel()` holds one download for the whole visit, so it goes on while the user moves from the column step to the review. transformers.js is imported only then, with remote models switched off, and uses 4 threads when the page is cross-origin isolated.
- Everything downloaded is kept in one Cache Storage cache, `painfold-name-model`: the model files (stored by transformers.js) and the runtime's WebAssembly file (stored by the worker and passed to ONNX Runtime as bytes, so it is downloaded once and works offline). Remove and Cancel delete that cache. Only the runtime's 24 kB loader script is imported by its address and stays in the browser's HTTP cache. If the browser cannot keep the files (full storage, some private windows), the model works for the visit and says so.
- In the review, names and places are found in the background (`useNameScan()`): the rule findings are ready at once, and rows go to the names worker in batches of 100. Each batch is added to the review in one change (`Review.addDetected`), leaving out anything that overlaps a rule finding or marked text; selection, focus and decisions are not touched, and screen readers hear only the start and the end. The download waits while names are checked, or while the model they need is on its way; Stop asks first, and the cleaning report records whether names were checked, skipped (and in how many rows) or not checked.
- Speed (`npm run bench`, model in the browser, MacBook Pro M-series): the rule findings for 5,000 rows are ready in 0.25 s, and names in all 5,000 rows are checked in 70 to 115 s over several runs (target: under 2.5 minutes).
- Every file goes through `core/import/formats.ts`, whether chosen, dropped anywhere on any step, or the sample (`useOpenFile()`). A format is a table (CSV, TSV, XLSX) or a document (DOCX, PDF, ODT, RTF, Markdown, VTT and SRT transcripts, plain text that does not read as a table), told apart by content where possible: inside a ZIP, `xl/workbook` is a workbook and `word/document` a Word document. Documents get a note that they are on the roadmap (Stage 5) and leave the open file alone; adding one later means giving its entry a reader.
- The name model reads at most 512 tokens (about 300 to 400 words) and ignores the rest, so a longer text is checked in chunks (`core/detect/chunks.ts`): cut at paragraph breaks, then sentence ends, then between words, each measured with the model's own tokenizer, and each starting with the last sentence of the one before. Names found twice in that overlap are merged. A text that fits is one chunk, so short texts are checked exactly as before. The cue rules run once on the whole text.
- A worker's requests are not in the page's Resource Timing, so the names worker passes its own on, and the "What leaves your browser" panel lists the model and runtime files too.
- transformers.js imports the WebGPU build of ONNX Runtime; `nuxt.config.ts` aliases it to the plain WebAssembly build, which halves the runtime download (14 MB instead of up to 28 MB). Painfold runs the model on the CPU.
- Name and place accuracy is measured only in the browser: `npm run eval:names` starts the built names worker in headless Chromium, cross-origin isolated with threads, and checks each text with the rules and the model together, as the app does. Native ONNX Runtime in Node gives different results on different processors, so it is never used for the numbers.
  - The dev split (`--split dev`, the default) is for tuning: `--misses` lists every missed and wrong name or place. It includes look-alikes, greetings and sign-offs followed by words that are not names ("Hallo Team", "Liebe Grüße", "Dear Customer Support"), so precision is tuned too.
  - The test split (`--split test`) is only reported, never tuned against.
  - `--set <set> --save` stores a set's detections in `data/eval/name-detections.json` (the sets are listed in `scripts/name-detections.ts`: the generated set, the hard cases, the name dev and test splits, and the test split without the first-name list). `npm run eval -- --write` computes the published tables from them. An end-to-end test reruns the worker on every stored set and fails if anything differs, so the stored detections, and the numbers computed from them, cannot go stale. It is a pass/fail check, not used for tuning. It runs as its own step (`npm run verify -- names`, the end-to-end tests tagged `@name-eval`) and as its own required CI job, "Name accuracy check": on a pull request that changes nothing it depends on (detection, the workers, the model, the eval scripts and data, the lock file, the Nuxt and Playwright configs, the workflow) it passes in seconds; otherwise, and on every push to main, nightly and when started by hand, it runs in full. All sets share one page, so the model loads once.
- To change the model: update the revision and hashes in `deploy/model.ts`, run `npm run models` and `npm run test:model`, and re-measure accuracy and speed.
- CI caches the downloaded files between runs. `core/detect/names.ts` turns the model's word pieces into names and places and has unit tests; `tests/model/` runs the real model.

## Hosting

The site moves from Vercel to Cloudflare (Workers with static assets) for v0.2.0. `wrangler.jsonc` serves `.output/public` as static files, with the headers from the `_headers` file in the build. No analytics, logs or metrics are kept (`observability` is off, `send_metrics` is false).

- The name model is the one exception. Its largest file (135 MB) is over Cloudflare's 25 MiB limit for a static file, so the build leaves `models/` out (`.assetsignore`), the files live in the R2 bucket `painfold-models`, and a small Worker (`deploy/worker.ts`) serves them at the same address, `/models/<id>/<revision>/`. Cloudflare runs it only for `/models/*` (`run_worker_first`). It serves only the pinned files in `deploy/model.ts`, with the same headers as every other host, and answers range and conditional requests. The bucket has no public address.
- `npm run models:upload` uploads a new model revision to R2 (`--local` for wrangler's local copy). It takes each file from the build's cache, checked against its SHA-256 first, and the R2 key is the path the app requests, so a new revision never replaces an old one's files.
- Cloudflare builds every push from GitHub (Workers Builds): `main` deploys to production, other branches get a preview address on workers.dev, linked from the pull request.
- Locally: `npx wrangler dev` serves the build with the Worker and local R2 (after `npm run models:upload -- --local`). `PAINFOLD_URL=<address> npx playwright test` runs the end-to-end tests against any address, such as a preview, without starting a local server.
- Cloudflare compresses some files, such as the ONNX Runtime WebAssembly file, and then sends no `Content-Length`. The app counts the bytes it receives, so download progress is unaffected.
- Unknown addresses get the 404 page with status 404, and `/accuracy/` redirects to `/accuracy` (`html_handling: drop-trailing-slash`). The build removes Nuxt's `200.html` single-page fallback (`scripts/remove-spa-fallback.ts`), which hosts would otherwise serve for every unknown path with status 200; every page is prerendered, so it is not needed.
- Until the move is complete, https://painfold.vercel.app keeps serving the same build from `vercel.json` (generated from `deploy/headers.ts`, only for `main`). Turn off the Vercel Toolbar for preview deployments (Project Settings, General): it injects a script from another origin, which the CSP blocks.
- Any static host works the same way: serve `.output/public` with the headers from `headersFor()`, and the model from the same origin.

## Dependency updates

Dependabot opens one weekly pull request with grouped minor and patch updates, a separate pull request for each major update, and weekly updates for the pinned GitHub Actions.

SheetJS (XLSX import) is installed from the official SheetJS tarball, not the npm registry, so Dependabot does not see it. Check https://cdn.sheetjs.com for new versions and security notes by hand, at least before each release.

## Dependency licenses

`npm run licenses` allows only permissive licenses: MIT, Apache-2.0, ISC, BSD-2-Clause, BSD-3-Clause, 0BSD, BlueOak-1.0.0, CC0-1.0 and Python-2.0. Three more are allowed for specific build-time packages:

- MPL-2.0: `lightningcss`, the CSS compiler behind Tailwind, used unmodified.
- CC-BY-4.0 and CC-BY-3.0: data packages (`caniuse-lite`, `spdx-exceptions`).

`tosource` is excluded by exact version because its `package.json` has no license field; its LICENSE file is the permissive zlib license. A new version is checked again.

`@img/sharp-libvips-*` (LGPL-3.0-or-later) is excluded by name: it is the native image library of `sharp`, which transformers.js depends on for image models. Painfold never loads `sharp`: the browser build does not include it, no build step or test uses it, and nothing from it is in the static site. LGPL allows using the unmodified library this way. Replacing `sharp` with an empty package through npm `overrides` was tried first, but npm 11 does not keep such a `file:` override in step with `package-lock.json`, which breaks `npm ci`.

## Dependency install scripts

npm 11 does not run dependency install scripts unless they are allowed. The `allowScripts` field in `package.json` records the decision for each package that has one:

- `esbuild`: denied. Its postinstall only verifies the platform binary, which npm already installs as an optional dependency.
- `fsevents`: denied. It ships prebuilt; the script is a build-from-source fallback.
- `onnxruntime-node`: denied. It comes with transformers.js for Node and ships its CPU binaries; the script only downloads optional GPU builds. The browser uses `onnxruntime-web`.
- `protobufjs`: denied. Its postinstall only prints version notices.
- `sharp`: denied. transformers.js depends on it for image models, which Painfold does not use; it ships prebuilt binaries, and the script is a build-from-source fallback.


If a new dependency brings an install script, `npm install` warns about it. Review it with `npm install-scripts ls`, then allow or deny it explicitly.
