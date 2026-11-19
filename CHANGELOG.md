# Changelog

All notable changes to Painfold. Versions follow the stages in [ROADMAP.md](ROADMAP.md).

## 0.3.1: Workspace redesign (2026-11-20)

Import, Review, Analyze and Report now work as one workspace: a top bar with the four steps, the page's context and filters at the side, tables you can sort, and details in a panel beside them. Nothing about what is found, sent or counted has changed.

### Changed

- **One workspace with a top bar.** Once a file is open, a top bar shows Painfold, the four steps (Import, Review, Analyze, Report) and the language, theme, "What leaves your browser" and Start over controls.
  - Each step is a link once it can be reached, and says what it holds now: how many findings are left, an analysis running, how many themes.
  - Steps you have finished are marked done.
  - The demo report shows the steps too, without claiming an import.
- **Import:** a sidebar with the file, its rows and columns, and what happens to each column, next to the column table and the preview.
- **Review:** a filter sidebar (type, status, warnings) with counts, and a sortable table with one row per distinct value. A value's details open in a panel beside the table: where it appears and the decision. N and P move through the values the filters show.
- **Analyze** comes in two steps:
  - first, where the analysis runs; once the connection test works, it shows as connected, with Change and Disconnect;
  - then, check and send. The cleaned texts that will be sent open in a panel on request instead of a long list, and the privacy notice sits in the sidebar.
- **Report:** jobs, pains and gains as tables (theme, texts, share, intensity). A theme's quotes and all its texts open in the panel. The sidebar has the sections with their counts and the cleaned file.
- **Charts:** the report's share bars and the Accuracy page's bars are drawn the same way, in colours checked for contrast in light and dark. Every bar has its number written beside it, and a bar below its target also says "below target" in words.
- **Roadmap page** (/roadmap/): released versions, what is being built now, what comes next and later, and ideas, each linked to its issue or release.
- **No sideways scrolling at 768 px**, the narrowest width the working flow supports, in English and German. After an analysis, the top bar rounds the bytes sent to kB so the German steps still fit; screen readers hear the exact count.

### Fixed

- **Opening a step directly with nothing open** (a shared link, a bookmark, a reload of Review, Download, Analyze or Report) no longer shows the step for a moment before the start page. The served pages hold nothing of the step, and the start page it leads to is laid out as on a fresh load: before, it could keep the step's layout, squeezing the headline to one word per line.

### Documentation

- **Security policy** (SECURITY.md): how to report a privacy leak or security problem privately, and what counts.
- **How we prove it** in docs/privacy.md: a data-flow diagram, each privacy claim with the test that checks it, and what Painfold doesn't protect against.
- **Feedback** (docs/feedback.md): no analytics or tracking, what the host sees, and where to ask questions and share ideas (GitHub Discussions).
- Contributing guide, issue templates with a warning never to paste real personal data, and a quick start in the README.
- **painfold.com/llms.txt**: what Painfold is, its privacy model, accuracy and roadmap, built from the site's own sources.

### Known limits

- The analysis prompts, parsing and scoring are unchanged from 0.3.0, so the measured accuracy still applies.
- The German interface text has not been reviewed by a native speaker yet ([#110](https://github.com/akojif/painfold/issues/110)).

## 0.3.0: Jobs, pains and gains (2026-11-18)

Painfold now finds what your customers are trying to get done, what hurts and what they wish for, with an AI you choose. Only cleaned text is sent, after you have seen exactly what goes, and every count and quote in the report is checked in code.

### Added

- **Analysis** of the cleaned feedback into customer jobs, pains and gains, each with sentiment and type (bug, feature request, question, praise, complaint, other). Texts are sent in batches, and every answer is checked before it is used.
- **Your choice of AI:** your own Anthropic API key, sent straight from your browser to Anthropic and held in memory unless you choose "Remember on this device", or a local model with Ollama, where nothing leaves your machine.
- **What will be sent, before it is sent:** the consent step shows every cleaned text, the instructions and the number of items, with a download of exactly what goes.
- **The first report:** ranked jobs, pains and gains with counts, share, intensity and two to three quotes each. Counts are computed in code from the tagged texts, never by the AI, and every quote is verified to exist word for word in the cleaned text.
- **Demo mode:** a stored real run on the sample file, replayed without a request or an API key.
- **Warnings for text that could identify someone** together with other details: exact ages, "the only …", job titles with a place, and roles held by one person. They are shown in the review and never removed on their own. (Announced for 0.2.1, released here.)
- **The flow** is Import, Review, Analyze, Report.
- **Accuracy for the analysis** on the Accuracy page and in docs/accuracy.md, with its known weaknesses.

### Changed

- Every file becomes a list of feedback items behind the existing screens, so detection, review and export no longer depend on rows and columns. This prepares transcripts and documents (v0.5).
- On a phone, the start screen explains what Painfold does; the tool itself needs a screen 768 px or wider.
- "What Painfold does" is a full-width strip on the start page, with statuses from the roadmap.
- Page and section headings are set in Sora; text stays in Geist.
- The footer is one identical line on every page, and the start page states the privacy promise less often.
- The name model downloads from a copy in a GitHub release first, and retries when Hugging Face is busy.
- The README is shorter; the details moved into docs/.

### Measured

- Analysis, on the test split (60 hand-labeled texts per language), run once with the plan published beforehand, and with each theme Painfold found matched to the labels by hand: under the right theme, Painfold finds 88 % of jobs, 77 % of pains and 64 % of gains, and 58 %, 68 % and 47 % of what it reports match the labels (both languages together). Sentiment is right for 88 % of texts, type for 92 %, and 100 % of quotes were found word for word. Details: docs/accuracy.md and the Accuracy page.
- Warnings for text that could identify someone, on a small hand-written test split: every labeled warning found, and no wrong warning.

### Known limits

- Gains are the weakest kind: wishes phrased as a question or as something missing are missed, and general praise is sometimes counted as a gain.
- Painfold reports more jobs than people labeled, and its themes are often broader than the labeled ones.
- Results vary between two runs on the same texts, and the model takes no temperature setting that could reduce this.
- The sample is small, and the German labels were made with the English labels available. All known weaknesses, with numbers, are on the Accuracy page.
- The German interface text has not been reviewed by a native speaker yet ([#110](https://github.com/akojif/painfold/issues/110)).

## 0.2.0: Names (2026-11-12)

Names and places are found too, with a model that runs in your browser, and the interface is in English and German. Nothing is uploaded.

### Added

- **Names and places**, found by a multilingual name model (Davlan/distilbert-base-multilingual-cased-ner-hrl, AFL-3.0) in your browser, plus rules for names after greetings, titles, thanks, sign-offs and introductions, with a first-name list covering 13 communities living in Austria. Long texts are checked in full, in overlapping parts.
- **The name model download** is explained before it starts, with its size (152 MB). It comes from Painfold's own site, hash-checked, shows progress with Cancel, is kept in the browser and can be removed; offline, failure and full-storage cases are handled, and the rules keep working without it.
- **Names in the background:** rule findings can be reviewed at once while names arrive, without moving focus; the download waits until names are checked, and Stop asks first. The cleaning report says whether names were checked.
- **German interface** under /de/, with a language switch that keeps your work.
- **Accuracy page** in the app (/accuracy/): how well every kind of personal data is found, names per language and per name-origin group, names in long texts, the known gaps, and the model's licence.
- **Drop a file anywhere**, on any step. Documents and transcripts (DOCX, PDF, VTT, SRT and more) get a note that they are on the roadmap; other file types say which files work.
- **Start over** from any step, with a question first when work would be lost, and the browser's own warning when closing the tab mid-review.
- **On a phone**, the start screen explains Painfold and suggests a bigger screen; Copy link or Continue anyway.
- **The example** on the start screen reveals what each placeholder replaced, on hover, focus or tap.

### Changed

- **New address: [painfold.com](https://painfold.com).** The site is now hosted on Cloudflare, with the same security headers; painfold.vercel.app no longer works. Page addresses end in a slash (/roadmap/, /de/), and the address without it redirects there.
- Back on the column step, the review and its decisions are kept; changing column choices asks before resetting them.
- Messages about files that did not open are toasts, so nothing on the page moves.
- Links no longer end in arrows; the footer says "Built by Francis Akoji".

### Measured

- Names on the hand-written test split, measured in the browser once after tuning: 97 % removed (German 0.98, English 0.96), at least 92 % in every one of 13 name-origin groups, against a target of 90 %. Without the first-name list: 90 %. Details and known gaps: docs/accuracy.md and the Accuracy page.
- Names in a 5,000-row file are checked in 70 to 115 seconds with the model in the browser.

### Known limits

- Lowercase nicknames that are not on the first-name list, names at the very start of a sentence without a greeting, some multi-part names and particles ("Saif ur Rehman"), and small towns can be missed; see the known gaps.
- Names are not checked on small screens, where the model is not offered.
- Warnings for indirect identifiers (job title plus small town, exact ages, rare roles) follow in v0.2.1.
- The German interface has not been reviewed by a native speaker yet; that review follows in v0.2.1.

## 0.1.0: Clean (2026-11-09)

The first release: remove personal data from a feedback file in the browser and download the cleaned file. Nothing is uploaded.

### Added

- **Import** CSV (any common delimiter and encoding, including German Excel exports) and XLSX files, with a sheet picker for workbooks. Files are read in the browser; a bundled sample of 200 made-up support tickets is available.
- **Column step:** choose per column whether it is checked, kept as is or dropped. Columns that look personal are dropped by default and their sample values are masked; empty columns are kept. The feedback column is guessed and can be changed in place. A column kept as is that holds personal data gets a warning with the count and a one-click fix.
- **Detection**, in a Web Worker, of email addresses, phone numbers (Austrian, German and international), IBANs (mod-97), card numbers (Luhn and network prefixes), Austrian SV-Nummern (official check digit), Austrian and German VAT IDs, links, IP addresses, dates of birth (with context), street addresses and postcodes, in German and English. Numbers are found with spaces, dashes or dots between groups, as people write them.
- **Review:** every value once, grouped by type, or every row as written. Remove or keep a value everywhere with one key (R, K), remove all of a type, undo (Z), and mark missed text (M); possible forms of marked names are flagged. Consistent placeholders such as `[EMAIL_3]`.
- **Download** the cleaned CSV (data only, with protection against formula injection) and a separate cleaning report.
- **Privacy:** a strict Content-Security-Policy, no cookies, no analytics, and a "What leaves your browser" panel that lists every network request. The only stored setting is the theme.
- **Interface:** light and dark themes (or follow the system), full keyboard operation of the review, reduced motion respected, tested at 320px wide.
- **Roadmap page** in the app: what v0.1 does and what comes next, kept in step with ROADMAP.md by a test.
- **A 404 page** for unknown addresses, with a real 404 status.
- **Measured quality:** detection recall and precision per type and language on a generated set and on hand-written hard cases, published in docs/accuracy.md and checked in CI; a 5,000-row file is cleaned in about 1.5 seconds.

### Known limits

- Names and places are not detected yet (v0.2). Look for them in the review and mark them with M.
- Email addresses spelled out to fool spam filters and English addresses that start with a flat number are missed; see docs/accuracy.md.
- Rarely, a document number written like an SV-Nummer with a dash (`2024-010106`) is removed as one.
