# Changelog

All notable changes to Painfold. Versions follow the stages in [ROADMAP.md](ROADMAP.md).

## 0.1.0: Clean (unreleased)

The first release: remove personal data from a feedback file in the browser and download the cleaned file. Nothing is uploaded.

### Added

- **Import** CSV (any common delimiter and encoding, including German Excel exports) and XLSX files, with a sheet picker for workbooks. Files are read in the browser; a bundled sample of 200 made-up support tickets is available.
- **Column step:** choose per column whether it is checked, kept as is or dropped. Columns that look personal are dropped by default and their sample values are masked; empty columns are kept. The feedback column is guessed and can be changed in place. A column kept as is that holds personal data gets a warning with the count and a one-click fix.
- **Detection**, in a Web Worker, of email addresses, phone numbers (Austrian, German and international), IBANs (mod-97), card numbers (Luhn and network prefixes), Austrian SV-Nummern (official check digit), Austrian and German VAT IDs, links, IP addresses, dates of birth (with context), street addresses and postcodes, in German and English.
- **Review:** every value once, grouped by type, or every row as written. Remove or keep a value everywhere with one key (R, K), remove all of a type, undo (Z), and mark missed text (M); possible forms of marked names are flagged. Consistent placeholders such as `[EMAIL_3]`.
- **Download** the cleaned CSV (data only, with protection against formula injection) and a separate cleaning report.
- **Privacy:** a strict Content-Security-Policy, no cookies, no analytics, and a "What leaves your browser" panel that lists every network request. The only stored setting is the theme.
- **Interface:** light and dark themes (or follow the system), full keyboard operation of the review, reduced motion respected, tested at 320px wide.
- **Measured quality:** detection recall and precision per type and language on a generated set and on hand-written hard cases, published in the README and checked in CI; a 5,000-row file is cleaned in about 1.5 seconds.

### Known limits

- Names and places are not detected yet (v0.2). Look for them in the review and mark them with M.
- Email addresses spelled out to fool spam filters and English addresses that start with a flat number are missed; see the Accuracy section of the README.
