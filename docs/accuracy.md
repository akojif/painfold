# Accuracy and performance

How well Painfold finds personal data, and how fast it is. The tables are written by `npm run eval -- --write`, and a unit test fails when they are out of date.

## How it is measured

Detection is measured on the evaluation set in [data/eval/](../data/README.md), with `npm run eval`. Two sets are reported separately:

- **Generated:** 1,200 messages built from the same templates as the sample file. The detectors could be tuned to these sentences, so treat these numbers as a check that nothing broke.
- **Hand-written hard cases:** written separately to catch what templates don't: obfuscated and pasted values, numbers written with dashes, dots or non-breaking spaces, and look-alikes that must not be removed (order and invoice numbers, ISBNs, EANs, versions, ordinary dates).

How it is counted:

- **Recall:** the share of labelled values that detections of the same type cover completely. A value that is only partly removed counts as missed.
- **Precision:** the share of detections that overlap a labelled value of their type.
- **Removed by any type:** the share of labelled values that are fully removed by any detection. This is what matters for the cleaned file; an IBAN caught as something else is still removed. It is shown with and without names and places.

The hard cases have only a few values per type and language, so one miss moves a number a lot: read them together with the list of known gaps below. Names and places are labelled but not detected until v0.2. The Stage 2 target is name recall of at least 0.90, in German and in English separately.

## Results

<!-- accuracy:start -->
**Generated**

| Data type | DE recall | DE precision | DE values | EN recall | EN precision | EN values |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Email addresses | 1.00 | 1.00 | 82 | 1.00 | 1.00 | 88 |
| Phone numbers | 1.00 | 1.00 | 74 | 1.00 | 1.00 | 83 |
| IBANs | 1.00 | 1.00 | 50 | 1.00 | 1.00 | 50 |
| Card numbers | 1.00 | 1.00 | 50 | 1.00 | 1.00 | 50 |
| Social security numbers | 1.00 | 1.00 | 91 | 1.00 | 1.00 | 50 |
| VAT IDs | 1.00 | 1.00 | 50 | 1.00 | 1.00 | 50 |
| Links | 1.00 | 1.00 | 50 | 1.00 | 1.00 | 50 |
| IP addresses | 1.00 | 1.00 | 75 | 1.00 | 1.00 | 50 |
| Dates of birth | 1.00 | 1.00 | 92 | 1.00 | 1.00 | 75 |
| Street addresses | 1.00 | 1.00 | 82 | 1.00 | 1.00 | 94 |
| Postcodes | 1.00 | 1.00 | 82 | 1.00 | 1.00 | 94 |
| Names (from v0.2) | 0.00 | – | 189 | 0.00 | – | 172 |
| Places (from v0.2) | 0.00 | – | 82 | 0.00 | – | 94 |
| **Removed by any type** | 0.74 | 1.00 | 1049 | 0.73 | 1.00 | 1000 |
| **Removed by any type, without names and places** | 1.00 | 1.00 | 778 | 1.00 | 1.00 | 734 |

**Hand-written hard cases**

| Data type | DE recall | DE precision | DE values | EN recall | EN precision | EN values |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Email addresses | 1.00 | 1.00 | 5 | 0.80 | 1.00 | 5 |
| Phone numbers | 1.00 | 1.00 | 7 | 1.00 | 1.00 | 4 |
| IBANs | 1.00 | 1.00 | 5 | 1.00 | 1.00 | 2 |
| Card numbers | 1.00 | 1.00 | 3 | 1.00 | 1.00 | 3 |
| Social security numbers | 1.00 | 0.86 | 6 | – | – | 0 |
| VAT IDs | 1.00 | 1.00 | 5 | 1.00 | 1.00 | 2 |
| Links | 1.00 | 1.00 | 2 | 1.00 | 1.00 | 3 |
| IP addresses | – | – | 0 | 1.00 | 1.00 | 3 |
| Dates of birth | 1.00 | 1.00 | 4 | 1.00 | 1.00 | 2 |
| Street addresses | 1.00 | 1.00 | 5 | 0.50 | 1.00 | 2 |
| Postcodes | 1.00 | 1.00 | 4 | 1.00 | 1.00 | 2 |
| Names (from v0.2) | 0.00 | – | 1 | 0.00 | – | 1 |
| Places (from v0.2) | 0.00 | – | 5 | 0.00 | – | 2 |
| **Removed by any type** | 0.88 | 0.98 | 52 | 0.84 | 1.00 | 31 |
| **Removed by any type, without names and places** | 1.00 | 0.98 | 46 | 0.93 | 1.00 | 28 |
<!-- accuracy:end -->

## Known gaps

In v0.1, from the hand-written cases:

- Document numbers written like an SV-Nummer with a dash, whose second part looks like a date and happens to pass the check digit (`Vorgang 2024-010106`), are removed as SV-Nummern. Most are left alone: a dash form needs a date-like second part, and order, invoice and customer words before the number rule it out.
- Email addresses spelled out to fool spam filters (`name AT example DOT net`).
- English addresses that start with a flat number (`Flat 2, 14 Market Street`).
- Names and places, from v0.2. Until then, look for them in the review step and mark them with M.

## Performance

A 5,000-row file is cleaned in about 1.5 seconds: import, column step, detection, review and export, clicked straight through in a real browser. Stage 1 asks for under 10 seconds on a normal laptop.

| Step | Time |
| --- | ---: |
| Import (read and parse the file) | 0.2–0.3 s |
| Find personal data and open the review | 0.9–1.2 s |
| Export the cleaned file | 0.1–0.2 s |
| **Total** | **1.2–1.6 s** |

Measured with `npm run bench` (three runs) on an Apple M3 Pro with 18 GB of memory, macOS 26.7, headless Chromium from Playwright 1.65, using a generated 5,000-row file. The same test runs in CI on every pull request with a 20-second limit, since shared runners are slower.
