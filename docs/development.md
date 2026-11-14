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

- The text lives in one file per area and language: `i18n/locales/<en|de>/<area>.json`, for the areas common, start, columns, review, download, analyze, roadmap, accuracy, privacy and errors (`i18n/messages.ts` lists them). @nuxtjs/i18n merges a language's files deeply, so one key can be split across files, such as `start` in `start.json` with `start.privacy` in `privacy.json`.
- Every change adds both languages, in the matching file. `tests/unit/locales.test.ts` fails if a message exists in one language only or in a different file, if placeholders or plural forms differ, or if a message is defined in two files.
- German is plain and uses "Sie". The German locale is `de-AT`, so numbers, lists and any written dates follow Austrian conventions ("Jänner"). Dates in the cleaning report stay ISO (2026-11-10), which reads the same in both languages.
- The language is chosen like this: an explicit `/de/` address always wins; only the root `/` follows a saved choice (`painfold-language` in `localStorage`) or, without one, the browser language, in a small inline script before first paint. The switch in the header saves the choice and moves to the same page in the other language inside the app, so an open file and the review are kept. No cookie is set.
- Known limit: a missing address under `/de/` is answered with the single prerendered 404 page, which is in English until the app has loaded, then German.

### German texts to review before release

These are where precise wording matters most; a native speaker should review them before each release that changes them. They are all in **`i18n/locales/de/privacy.json`** (and the English in `en/privacy.json`), except the Accuracy page, which stays whole in `accuracy.json`, and the product terms, which are used everywhere. A unit test keeps this list and `privacy.json` in step:

- The privacy notice and the start screen's privacy line (`privacy.notice`, `start.privacy`, `start.dropOverlay`).
- The limits notice (`review.limits`), also used in the cleaning report.
- The "What leaves your browser" panel (`network.none`, `network.explain`, `network.allOwn`, `network.foreign`, `network.stored`).
- The name model download: what is downloaded and kept, and the failure and offline messages (`nameModel.*`). "Namensmodell" is the chosen term.
- The small-screen sheet (`smallScreen.*`: "Painfold mag größere Bildschirme" and its text, which should stay warm and a little playful) and the small-screen notes (`nameModel.smallScreen`, `download.names.smallScreen`).
- The Accuracy page (`accuracy.*`, in `accuracy.json`): the opening sentence ("Von 100 Namen in Ihrem Feedback entfernt Painfold etwa 97 …"), the findings, how it is measured, the name-origin groups ("Herkunftsgruppe"), the known gaps and the model's licence note.
- Opening files: the note about documents and transcripts and the unsupported-file message (`importNotes.*`, `importErrors.unsupported-format`).
- Names in the review and the download: the check, Stop and its question, and what the cleaning report says (`nameScan.*`, `download.names.*`).
- Column warnings and reasons (`columns.warning`, `columns.checkInstead`, `columns.masked`, `columns.reason.*`, `columns.help`).
- What the download contains and what is kept (`download.mapStays`, `download.reportExplain`, `download.notReviewed`) and the cleaning report (`report.*`).
- The warnings for text that could identify someone (`warning.*`): "Könnte jemanden erkennbar machen" as the heading, "Hinweis" for a warning, and the reasons, especially "Beruf mit Ort" and "Rolle, die eine Person innehat".
- Choosing an AI: how the API key is handled and what is sent (`aiPrivacy.*`), and requests to the AI in "What leaves your browser" (`network.toAi`, `network.aiOnly`, `network.kind.ai`). The rest of the Analyze step is in `analyze.json`.
- Terms chosen for this product, in the files where they are used: the column roles "Prüfen / Unverändert / Weglassen" (`columns.json`), "Treffer" for a finding (`review.json` and others), and "UID-Nummer" for VAT ID (`common.json`).

Open questions for the reviewer:

- "Aufgaben, Probleme und Wünsche" for jobs, pains and gains, or keeping the canvas terms "Jobs, Pains und Gains", which German-speaking product teams often use?
- "Kunden", "Kund:innen" or "Kundschaft" in the headline, the roadmap and elsewhere?

The review happens before the v0.2.1 release (#110).



All test data is fake and generated: see [data/README.md](../data/README.md) for what is in it and where each kind of value comes from. Never add real customer data to the repository.

## Continuous integration

Every pull request runs four jobs: lint, typecheck, unit tests, the detection accuracy (shown in the job summary) and the static build; end-to-end tests; the name accuracy check (see Name model); and a dependency check (`npm audit --audit-level=high` and the license allowlist). All must pass before review.

The two browser jobs run in Microsoft's Playwright image (`mcr.microsoft.com/playwright`), which already has Chromium and its system packages, so CI never installs anything from Ubuntu's package servers. The image's version must match `@playwright/test`: when Playwright is updated, change the image tag and its digest in `.github/workflows/ci.yml` too (a unit test fails until both match).

## Security headers

`deploy/headers.ts` is the single source of truth for the Content-Security-Policy and the other security headers.

- `npm run generate` builds the site, then `scripts/apply-csp.ts` adds the full policy to every page as a `<meta>` tag, with hashes of that build's inline scripts. It also fails the build if any page or stylesheet references another origin.
- Static headers (framing, `nosniff`, referrer, permissions, and the full policy for app files and Web Workers) come from `headersFor()`. The local preview server sends them, so the end-to-end tests run under the real policy.
- For Cloudflare, the build writes a `_headers` file from the same file (`scripts/write-cloudflare-assets.ts`). Every matching rule applies there and a header set twice gets both values joined by a comma, so the rules for app files remove the page policy before setting their own; a unit test applies the file the way Cloudflare does and compares every path with `headersFor()`. The Worker that serves the model sets `headersFor()` itself.
- No policy names a host: every source is a keyword, a hash or `data:`, and a unit test fails otherwise. On any address the site only talks to itself.
- Every response sends `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp`, so pages are cross-origin isolated: WebAssembly threads need it, and the name model runs about 4 times faster with them. Everything Painfold loads is same-origin, so nothing else is affected.
- App code (`/_nuxt/`) and the ONNX Runtime files (`/ort/`) may compile WebAssembly (`'wasm-unsafe-eval'`), because the name model runs in the detection worker. Pages may not, and `'unsafe-eval'` is never allowed.

## Addresses

Every page address ends in a slash: `/roadmap/`, `/de/`, `/de/accuracy/`. That way search engines see one address per page.

- `nuxt.config.ts` adds the slash to every link: `<NuxtLink>` (`experimental.defaults.nuxtLink.trailingSlash`), and `localePath`, `switchLocalePath`, the canonical and the hreflang links (`i18n.trailingSlash`). Always build page addresses with `localePath`, never as plain strings.
- The hosts redirect the form without a slash, keeping the query: Cloudflare (`html_handling: auto-trailing-slash`) and the local test server.
- `tests/e2e/addresses.spec.ts` checks every page, including the review and download steps: each link, canonical and hreflang link ends in a slash, and each address without one redirects.

## Feedback items

Every file becomes a list of **items**, each a piece of text and where it came from (`core/items/`, #86). Detection, review and export move to items one pull request at a time, so later sources such as interview transcripts only need a new adapter. Only tables are read today.

- **Items:** the table adapter (`core/items/table.ts`) makes every checked cell an item, empty ones included.
- **Units:** every row is a unit that groups its items. A unit's `attributes` hold the non-empty values of the columns kept as they are (Keep as is), such as date, channel, plan or country, for segments and trends later. Dropped columns never appear there, and checked columns are always items, never attributes.
- **Ids:** they come from the location, not from a counter, so they're the same for a given file whatever is checked, and a quote can be linked back to its source: `cell:<sheet>:<row>:<column>` for an item and `row:<sheet>:<row>` for a unit, all counted from 0. The sheet is its position in the workbook (0 for CSV), never its name, because sheet names are chosen by people and can hold personal data, and ids may later appear in quotes, links and exports. Row and column count in the data, after the header.
- **Rebuilding the table:** `rebuildTable()` puts cleaned item texts back through their cell locations, with dropped columns left out and kept columns unchanged.
- **Workers:** both detection workers take items (`{ id, text, unit }`) and return detections per item id (`core/detect/items.ts`, `core/detect/worker-protocol.ts`); they never see rows or columns. Progress counts units, so it still reads "rows" however many columns are checked. The column step's survey gets counts per item, and the adapter adds them up per column (`countsByColumn`).
- **Review:** `Review` (`core/review/review.ts`) gets the items and their detections. Findings and warnings belong to an item and its unit; marking missed text, names that arrive later, Undo and cleaning (`cleanedItem`) all work per item. Findings are indexed by item and kept up to date, so the overlap check and cleaning only look at one item's findings. The export rebuilds the table from the cleaned items through the adapter.
- **Review screen:** it shows units with their place ("Row 17", from `placeOf()`), and each unit's items with their labels (the column names). Each item says how to show it (`display`): the feedback text first (`main`), other free text always (`text`, where missed names can hide), and short values such as a channel only with a finding (`short`). Selecting text for "Mark as missed" reads the item id from the page (`data-item`).
- **The boundary:** only the import side (the column step, `core/import`, `core/columns`), the table adapter and the CSV export know about rows and columns. `tests/unit/items-boundary.test.ts` reads the code after that boundary (detection, review, redaction, the report and the review screen) and fails if it names a row or a column.

## AI providers

Which AI providers Painfold can call straight from the browser, their terms (training, retention, location), and the CSP design for Stage 3 are recorded in [docs/ai-providers.md](ai-providers.md). `npm run check:providers` repeats the browser check: one request with the word "Hello" and a fake key per provider, from a page at the production origin.

- **Choosing the AI** (`app/pages/analyze.vue`, not linked until slice 4 and marked noindex): the person's API key (Anthropic, Claude Haiku 5.5 by default) or Ollama on this computer, with a connection test that sends only "Hello". Providers, requests and error handling are plain code in `core/ai/providers.ts`.
- **The key** is held in memory (`useAiSettings`) and forgotten on Start over. Only "Remember on this device" stores it, in this browser's local storage, and unticking it removes it.
- **Every AI request goes through `sendAiRequest`** (`useAiRequest`). It refuses any destination but the chosen provider's, sends no cookies and no referrer, and logs the request in "What leaves your browser" with the bytes sent. The browser's own record (Resource Timing) can't see the size of a request to another site, so it skips the AI endpoints.
- **The pages' CSP** allows exactly `AI_ENDPOINTS` in `deploy/headers.ts` (Anthropic, and Ollama on `localhost:11434` and `127.0.0.1:11434`). App files and workers stay limited to this site. Unit tests check the exact list, and that the providers only call endpoints on it.
- **The consent step** (`app/components/ConsentStep.vue`, #125) shows exactly what will be sent before anything is: how many cleaned texts go to which provider and model, the provider's terms, what is not sent, and a cost estimate. Below that come every text (searchable), the instructions in full, and a download of the exact JSON. The payload is built once (`core/ai/payload.ts`) from the review's cleaned texts; only feedback and other free text are sent, not short values such as a channel or a plan. Texts go out under short ids (`t1`, `t2`…), and the mapping back to the items stays in the browser. The cost is estimated locally (`core/ai/cost.ts`, characters ÷ 3.5, ±30%, dated prices); a provider's token counter would already send the text. If names were not checked, the step says so and asks for a confirmation. A value removed in the review inside the payload blocks sending (`leakedValues`); a unit test checks that, and its mutation check fails with redaction switched off.
- **End-to-end tests** stand in for Anthropic and Ollama with Playwright. Only those tests may reach those origins (`test.use({ allowedOrigins })`); every other test still fails on any request to another site.

## Analysis evaluation: labelling

The Stage 3 analysis is measured against hand labels (#129), as names are: items and prompts are written by one person, the labels by others. `data/README.md` describes the files.

- `python3 scripts/labelling/make_sheets.py` writes the two labelling spreadsheets from `data/eval/analysis/items.jsonl`. It needs Python 3 with openpyxl (MIT), used only for this: SheetJS, which the app uses, cannot write dropdowns. The generated files are committed, so labelling and converting need neither.
- `npm run labels:convert -- <filled files>` checks filled spreadsheets (`scripts/labels.ts`, unit-tested) and writes `labels-<lang>.jsonl` only when there are no problems; every problem is listed with its row.
- Types: bug, feature request, question, praise, complaint and other. CLAUDE.md names the first four; complaint (price, support, a decision) and other were added because many messages fit none of them.

## Indirect identifiers

Text that is not personal data on its own but can point to one person, such as "the only female CFO in Wels" or "a 42-year-old tax adviser in Wels" (#66). Painfold warns about it and never removes it on its own. `core/detect/indirect/` finds three kinds, in German and English:

- **Exact ages** (`age.ts`): "42 Jahre alt", "die 42-Jährige", "mit 42 Jahren", "Alter: 42", "ich bin 42", "a 42-year-old", "aged 42". An age before a noun only warns when the noun is a person ("10-jährige Erfahrung" and "a 5-year-old laptop" don't).
- **"The only …"** (`roles-in-text.ts`): "die einzige Ärztin", "the only female CFO".
- **Roles** (`roles.ts`, `roles-in-text.ts`):
  - A common job title warns only with a place in the same sentence that isn't a large city: "Steuerberaterin in Wels" warns, "Lehrerin in Graz" doesn't.
  - A unique role (a mayor, a bishop, a school principal, a CEO) warns with any place, with an organisation ("Direktorin der Volksschule …") or when the writer holds it ("I am the mayor").
  - German feminine and gender-inclusive forms ("Lehrer:in", "LehrerIn") and compounds ("Volksschuldirektorin") count.

In the review (`core/review/review.ts`), warnings sit next to the findings and never overlap them: a finding over the same text wins. A warning nobody decided on is **kept**; Remove replaces it with `[AGE_n]` or `[ROLE_n]`, and Dismiss keeps it as decided. Both can be undone. Decisions follow a warning's position, so they survive when the name model's places arrive and the cell's warnings are found again. `placeRemoved()` says whether a role's place will be removed, so the interface can say the role is less identifying.

In the interface, warnings are listed after the personal data under "Could identify someone" (By value) and marked in the text (By row). They use the same keys as findings: R removes, K keeps. A warning not checked yet has a dashed underline in the risk colour (`danger`, which passes 4.5:1 on the page and surface backgrounds in both themes, above the 3:1 a line needs). The dashes, not the colour, set it apart from personal data waiting for review (a yellow fill) and from kept text (a dotted underline), and each mark's label says "Could identify someone" and the kind for screen readers. Warnings never hold up the review: Continue doesn't wait for them, and an untouched warning stays in the file. The download summary and the cleaning report count them.

Places come from the name model. Without it, ages, "the only …" and unique roles linked to an organisation or the writer are still found.

Large cities (`large-cities.ts`) are those with 100,000 or more residents. The list has the six in Austria, from Statistik Austria, and the 79 in Germany, from Destatis, with English names such as Vienna and Munich. The source and the date it was checked are in the file; re-check when new figures are published. A place that isn't on the list warns, so a missing city adds a warning but never hides one.

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

The site runs on Cloudflare (Workers with static assets); until v0.2.0 it ran on Vercel. `wrangler.jsonc` serves `.output/public` as static files, with the headers from the `_headers` file in the build. No analytics, logs or metrics are kept (`observability` is off, `send_metrics` is false).

- The name model is the one exception. Its largest file (135 MB) is over Cloudflare's 25 MiB limit for a static file, so the build leaves `models/` out (`.assetsignore`), the files live in the R2 bucket `painfold-models`, and a small Worker (`deploy/worker.ts`) serves them at the same address, `/models/<id>/<revision>/`. Cloudflare runs it only for `/models/*` (`run_worker_first`). It serves only the pinned files in `deploy/model.ts`, with the same headers as every other host, and answers range and conditional requests. The bucket has no public address.
- `npm run models:upload` uploads a new model revision to R2 (`--local` for wrangler's local copy). It takes each file from the build's cache, checked against its SHA-256 first, and the R2 key is the path the app requests, so a new revision never replaces an old one's files.
- Cloudflare builds every push from GitHub (Workers Builds): `main` deploys to production at https://painfold.com (the custom domain in `wrangler.jsonc`, its only address: `workers_dev` is off), other branches get a preview address on workers.dev, linked from the pull request.
- Two redirect rules in the Cloudflare dashboard (painfold.com, Rules, Redirect Rules) belong to production. Both are 301s that keep the query:
  - "Redirect from WWW to root": `https://www.painfold.com/*` to `https://painfold.com/${1}`. `www` is a proxied `AAAA 100::` record, so it needs no server.
  - "Add trailing slash", after the first: page addresses without a final slash get one, in one hop instead of the 307 from `auto-trailing-slash`. It skips paths with a dot (files), `/_` (`/_nuxt/`, `/_payload.json`, `/_i18n/`), `/models/`, `/ort/`, `/cdn-cgi/` and `/404`, which Cloudflare serves without the slash; without that last exception `/404` would loop. Expression: `(http.host eq "painfold.com" and not ends_with(http.request.uri.path, "/") and not http.request.uri.path contains "." and not starts_with(http.request.uri.path, "/_") and not starts_with(http.request.uri.path, "/models/") and not starts_with(http.request.uri.path, "/ort/") and not starts_with(http.request.uri.path, "/cdn-cgi/")) and http.request.uri.path ne "/404"`, target `concat("https://painfold.com", http.request.uri.path, "/")`.
  - A rule must never point at an address the deployed site does not yet serve: check production first, then turn the rule on.
- Locally: `npx wrangler dev` serves the build with the Worker and local R2 (after `npm run models:upload -- --local`). `PAINFOLD_URL=<address> npx playwright test` runs the end-to-end tests against any address, such as a preview, without starting a local server.
- Network Error Logging is off for the painfold.com zone (Network settings). Cloudflare adds `NEL` and `Report-To` headers by default, which make browsers send network errors to Cloudflare, outside the CSP and the "What leaves your browser" panel. An end-to-end test fails if any response carries them. workers.dev previews always send them; only the team opens previews, so the test is skipped there.
- `PAINFOLD_URL` runs two tests at a time: every model test downloads 152 MB from the deployed site.
- Cloudflare compresses some files, such as the ONNX Runtime WebAssembly file, and then sends no `Content-Length`. The app counts the bytes it receives, so download progress is unaffected.
- Unknown addresses get the 404 page with status 404. Page addresses end in a slash, and `/accuracy` redirects to `/accuracy/` (`html_handling: auto-trailing-slash`; see Addresses). The build removes Nuxt's `200.html` single-page fallback (`scripts/remove-spa-fallback.ts`), which hosts would otherwise serve for every unknown path with status 200; every page is prerendered, so it is not needed.
- Rollback: Cloudflare keeps every deployed version. To go back, open painfold in the dashboard (Workers & Pages, Deployments) and roll back to an earlier version, or run `npx wrangler rollback <version-id>` (`npx wrangler deployments list` shows them). Static files, headers and the Worker go back together; model files in R2 are never replaced (each revision has its own path), so an older version still finds its model. If a redirect rule is the problem, switch it off under Rules, Redirect Rules; that takes effect at once.
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
