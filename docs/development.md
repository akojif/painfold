# Development

Requires Node 24 and npm 11. The version is pinned in `.nvmrc`; with [nvm](https://github.com/nvm-sh/nvm), run `nvm use` in the project folder (or `nvm install` the first time) before any npm command. If your shell still reports another version with `node -v`, run `hash -r` or open a new terminal.

```sh
nvm use
npm install
npm run dev          # local development server
npm run generate     # static build in .output/public
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

Run `npm run generate` before `npm run test:e2e`. The first time, install the test browser with `npx playwright install chromium`.

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

Every pull request runs three jobs: lint, typecheck, unit tests, the detection accuracy (shown in the job summary) and the static build; end-to-end tests; and a dependency check (`npm audit --audit-level=high` and the license allowlist). All must pass before review.

## Security headers

`deploy/headers.ts` is the single source of truth for the Content-Security-Policy and the other security headers.

- `npm run generate` builds the site, then `scripts/apply-csp.ts` adds the full policy to every page as a `<meta>` tag, with hashes of that build's inline scripts. It also fails the build if any page or stylesheet references another origin.
- Static headers (framing, `nosniff`, referrer, permissions, and the full policy for app files and Web Workers) come from `headersFor()`. The local preview server sends them, so the end-to-end tests run under the real policy.
- `vercel.json` is generated from the same file with `npm run headers:vercel`; a unit test fails if it is out of date.
- Every response sends `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp`, so pages are cross-origin isolated: WebAssembly threads need it, and the name model runs about 4 times faster with them. Everything Painfold loads is same-origin, so nothing else is affected.
- App code (`/_nuxt/`) and the ONNX Runtime files (`/ort/`) may compile WebAssembly (`'wasm-unsafe-eval'`), because the name model runs in the detection worker. Pages may not, and `'unsafe-eval'` is never allowed.

## Name model

Names and places are found by [Davlan/distilbert-base-multilingual-cased-ner-hrl](https://huggingface.co/Davlan/distilbert-base-multilingual-cased-ner-hrl) (AFL-3.0), in the int8 ONNX export by [Xenova](https://huggingface.co/Xenova/distilbert-base-multilingual-cased-ner-hrl). It was trained on news text, including CoNLL-2003 for German and English; the CoNLL source texts are themselves licensed, which is a common grey area for models trained on them.

- `deploy/model.ts` pins the exact Hugging Face revision and the SHA-256 and size of every file transformers.js loads. `scripts/fetch-model.ts` (part of `npm run dev` and `npm run generate`) downloads them into `node_modules/.cache/painfold-models/`, checks every hash and size and fails on a mismatch, then copies the model to `public/models/<id>/<revision>/` and the ONNX Runtime WebAssembly files to `public/ort/<version>/`. Both are ignored by git and served from this site with immutable caching; users' browsers never contact Hugging Face or a CDN.
- Nothing is downloaded until the user agrees: the column step explains the model and its size (computed at build time from the served files, `downloadBytes`), and the review offers the same download to people who skipped it. Where the browser reports Save-Data or a cellular connection, it suggests Wi-Fi.
- The model runs in its own worker (`app/workers/names.worker.ts`), separate from the rules, so Cancel stops that worker and the rules keep working. `useNameModel()` holds one download for the whole visit, so it goes on while the user moves from the column step to the review. transformers.js is imported only then, with remote models switched off, and uses 4 threads when the page is cross-origin isolated.
- Everything downloaded is kept in one Cache Storage cache, `painfold-name-model`: the model files (stored by transformers.js) and the runtime's WebAssembly file (stored by the worker and passed to ONNX Runtime as bytes, so it is downloaded once and works offline). Remove and Cancel delete that cache. Only the runtime's 24 kB loader script is imported by its address and stays in the browser's HTTP cache. If the browser cannot keep the files (full storage, some private windows), the model works for the visit and says so.
- In the review, names and places are found in the background (`useNameScan()`): the rule findings are ready at once, and rows go to the names worker in batches of 100. Each batch is added to the review in one change (`Review.addDetected`), leaving out anything that overlaps a rule finding or marked text; selection, focus and decisions are not touched, and screen readers hear only the start and the end. The download waits while names are checked, or while the model they need is on its way; Stop asks first, and the cleaning report records whether names were checked, skipped (and in how many rows) or not checked.
- Speed (`npm run bench`, model in the browser, MacBook Pro M-series): the rule findings for 5,000 rows are ready in 0.25 s, and names in all 5,000 rows are checked in 71 s (target: under 2.5 minutes).
- A worker's requests are not in the page's Resource Timing, so the names worker passes its own on, and the "What leaves your browser" panel lists the model and runtime files too.
- transformers.js imports the WebGPU build of ONNX Runtime; `nuxt.config.ts` aliases it to the plain WebAssembly build, which halves the runtime download (14 MB instead of up to 28 MB). Painfold runs the model on the CPU.
- Name and place accuracy is measured only in the browser: `npm run eval:names` starts the built names worker in headless Chromium, cross-origin isolated with threads, and checks each text with the rules and the model together, as the app does. Native ONNX Runtime in Node gives different results on different processors, so it is never used for the numbers.
  - The dev split (`--split dev`, the default) is for tuning: `--misses` lists every missed and wrong name or place. It includes look-alikes, greetings and sign-offs followed by words that are not names ("Hallo Team", "Liebe Grüße", "Dear Customer Support"), so precision is tuned too.
  - The test split (`--split test`) is only reported, never tuned against.
  - `--set <set> --save` stores a set's detections in `data/eval/name-detections.json` (the sets are listed in `scripts/name-detections.ts`: the generated set, the hard cases, the name dev and test splits, and the test split without the first-name list). `npm run eval -- --write` computes the published tables from them. An end-to-end test reruns the worker on every stored set and fails if anything differs, so the stored detections, and the numbers computed from them, cannot go stale. It is a pass/fail check, not used for tuning.
- To change the model: update the revision and hashes in `deploy/model.ts`, run `npm run models` and `npm run test:model`, and re-measure accuracy and speed.
- CI caches the downloaded files between runs. `core/detect/names.ts` turns the model's word pieces into names and places and has unit tests; `tests/model/` runs the real model.

## Hosting

The live site is a static build on Vercel. `vercel.json` (generated from `deploy/headers.ts`) sets the install and build commands, so Vercel runs the same `npm run generate` as CI, including the CSP check, and serves `.output/public` with the security headers. No Vercel framework preset, server functions or analytics are used.

- `main` deploys to https://painfold.vercel.app; every pull request gets a preview deployment.
- Unknown addresses get the 404 page with status 404. The build removes Nuxt's `200.html` single-page fallback (`scripts/remove-spa-fallback.ts`), which hosts would otherwise serve for every unknown path with status 200; every page is prerendered, so it is not needed.
- Turn off the Vercel Toolbar for preview deployments (Project Settings, General): it injects a script from another origin, which the CSP blocks.
- Any static host works the same way: serve `.output/public` with the headers from `headersFor()`.

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
