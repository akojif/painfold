# Changelog

All notable changes to Painfold. Versions follow the stages in [ROADMAP.md](ROADMAP.md).

## 0.2.0: Names (unreleased)

Names and places are found too, with a model that runs in your browser, and the interface is in English and German. Nothing is uploaded.

### Added

- **Names and places**, found by a multilingual name model (Davlan/distilbert-base-multilingual-cased-ner-hrl, AFL-3.0) in your browser, plus rules for names after greetings, titles, thanks, sign-offs and introductions, with a first-name list covering 13 communities living in Austria. Long texts are checked in full, in overlapping parts.
- **The name model download** is explained before it starts, with its size (152 MB). It comes from Painfold's own site, hash-checked, shows progress with Cancel, is kept in the browser and can be removed; offline, failure and full-storage cases are handled, and the rules keep working without it.
- **Names in the background:** rule findings can be reviewed at once while names arrive, without moving focus; the download waits until names are checked, and Stop asks first. The cleaning report says whether names were checked.
- **German interface** under /de/, with a language switch that keeps your work.
- **Accuracy page** in the app (/accuracy): how well every kind of personal data is found, names per language and per name-origin group, names in long texts, the known gaps, and the model's licence.
- **Drop a file anywhere**, on any step. Documents and transcripts (DOCX, PDF, VTT, SRT and more) get a note that they are on the roadmap; other file types say which files work.
- **Start over** from any step, with a question first when work would be lost, and the browser's own warning when closing the tab mid-review.
- **On a phone**, the start screen explains Painfold and suggests a bigger screen; Copy link or Continue anyway.
- **The example** on the start screen reveals what each placeholder replaced, on hover, focus or tap.

### Changed

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
