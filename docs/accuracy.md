# Accuracy and performance

How well Painfold finds personal data, and how fast it is. The tables are written by `npm run eval -- --write`, which also writes `data/eval/accuracy.json` for the [Accuracy page](https://painfold.vercel.app/accuracy) in the app; a unit test fails when either is out of date.

## How it is measured

Detection is measured on the evaluation set in [data/eval/](../data/README.md), with `npm run eval`, by the rules and the name model together, as in the app. The rules run in Node. The name model is measured only in the browser: `npm run eval:names` runs the built names worker in headless Chromium, on the same WebAssembly runtime users get, and stores what it finds in [data/eval/name-detections.json](../data/eval/name-detections.json). An end-to-end test reruns it on every pull request and fails if anything differs, so these numbers cannot go stale. (Native ONNX Runtime in Node gives different results on different processors, so it is never used for the numbers.) Four sets are reported separately:

- **Generated:** 1,200 messages built from the same templates as the sample file. The detectors could be tuned to these sentences, so treat these numbers as a check that nothing broke.
- **Hand-written hard cases:** written separately to catch what templates don't: obfuscated and pasted values, numbers written with dashes, dots or non-breaking spaces, and look-alikes that must not be removed (order and invoice numbers, ISBNs, EANs, versions, ordinary dates).
- **Hand-written long texts:** 8 German and English support messages of 5,000 to 6,000 characters (about 1,200 to 1,400 model tokens), each with a name near the start, one in the middle and one in the last sentence. The name model reads at most 512 tokens at a time, so long texts are checked in overlapping chunks; this set shows that names are found wherever they are. It was written after the name rules were tuned and is only reported.
- **Hand-written names:** 286 German and English sentences with invented names typical of communities living in Austria, because names in Austrian feedback come from many backgrounds, not only German and English ones. They include real diacritics (ć, š, ž, ğ, ı, ș, ő, ł), variant transliterations (Mohammed, Muhammad, Mohamad, Mohammad), multi-part and particle names (Abdul Rahman, Al-Hassan, van der Berg), possessives and lowercase chat names. Name recall is also reported per name-origin group, with the same target for every group. The group exists only in the evaluation data; Painfold never infers anyone's origin. A dev split (3 sentences per group, plus 26 look-alikes such as "Hallo Team" or "Liebe Grüße") was used to tune the name rules; only the test split (19 sentences, 25 names per group, written before any tuning) is reported. The test sentences were written by the same author as the tuning, but the test split was run only once, after tuning, and never used to tune. The generated set and the hard cases were measured with the name model once, after tuning, and were not used to tune it either.

How it is counted:

- **Recall:** the share of labelled values that detections of the same type cover completely. A value that is only partly removed counts as missed.
- **Precision:** the share of detections that overlap a labelled value of their type.
- **Removed by any type:** the share of labelled values that are fully removed by any detection. This is what matters for the cleaned file; an IBAN caught as something else is still removed.
- **For names, three columns:** removal recall (the name is removed, whatever type it got: a name labelled as a place is still protected), type-correct recall (removed and labelled as a name), and removal recall without the first-name list. The first-name list is used only right after a greeting, title, thank-you, sign-off or introduction ("hi anna", "LG Markus"), so the last column shows how much the names depend on it.
- Where a name or place overlaps a rule finding, the rule finding wins and only the rest of the name or place is kept, as in the review: a street name inside an address counts as the address, not as a place.

The hard cases have only a few values per type and language, so one miss moves a number a lot: read them together with the list of known gaps below. The Stage 2 target is name removal recall of at least 0.90 in German and in English, and for every name-origin group. With 25 test names per group, two misses still meet the target (0.92) and three do not (0.88). The target is met with the first-name list; without it, four groups would be below it.

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
| Names | 0.99 | 1.00 | 189 | 0.91 | 1.00 | 172 |
| Places | 0.98 | 0.99 | 82 | 0.78 | 0.97 | 94 |
| **Removed by any type** | 1.00 | 1.00 | 1049 | 0.96 | 1.00 | 1000 |

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
| Names | 0.50 | 1.00 | 2 | 1.00 | 1.00 | 1 |
| Places | 1.00 | 1.00 | 5 | 1.00 | 1.00 | 2 |
| **Removed by any type** | 0.98 | 0.98 | 53 | 0.94 | 1.00 | 31 |

**Hand-written long texts**

| Data type | DE recall | DE precision | DE values | EN recall | EN precision | EN values |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Names | 1.00 | 1.00 | 12 | 1.00 | 1.00 | 12 |
| Places | 0.67 | 1.00 | 3 | 1.00 | 1.00 | 3 |
| **Removed by any type** | 0.93 | 1.00 | 15 | 1.00 | 1.00 | 15 |

**Hand-written names (test split)**

| Data type | DE recall | DE precision | DE values | EN recall | EN precision | EN values |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Names | 0.98 | 1.00 | 156 | 0.96 | 1.00 | 169 |
| Places | 1.00 | 1.00 | 10 | 1.00 | 0.67 | 2 |
| **Removed by any type** | 0.98 | 1.00 | 166 | 0.96 | 1.00 | 171 |

**Name recall (test split).** Removal: the name was removed, whatever type it got. Type-correct: removed and labelled a name. Without the list: removal recall without the first-name list. Target: 0.90 removal recall.

| Language | Removal | Type-correct | Without the list | Names |
| --- | ---: | ---: | ---: | ---: |
| DE | 0.98 | 0.98 | 0.90 | 156 |
| EN | 0.96 | 0.96 | 0.91 | 169 |
| **Both** | 0.97 | 0.97 | 0.90 | 325 |

**Name recall by name-origin group (test split).** The group exists only in the evaluation data; Painfold never infers anyone's origin.

| Name-origin group | DE removal | DE type-correct | DE without the list | EN removal | EN type-correct | EN without the list | Removal | Type-correct | Without the list | Names |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| German-speaking | 1.00 | 1.00 | 0.92 | 1.00 | 1.00 | 0.92 | 1.00 | 1.00 | 0.92 | 25 |
| English | 1.00 | 1.00 | 0.92 | 0.85 | 0.85 | 0.85 | 0.92 | 0.92 | 0.88 | 25 |
| Bosnian, Serbian, Croatian | 1.00 | 1.00 | 0.92 | 0.92 | 0.92 | 0.92 | 0.96 | 0.96 | 0.92 | 25 |
| Turkish | 1.00 | 1.00 | 0.92 | 1.00 | 1.00 | 0.92 | 1.00 | 1.00 | 0.92 | 25 |
| Romanian | 1.00 | 1.00 | 0.92 | 1.00 | 1.00 | 0.92 | 1.00 | 1.00 | 0.92 | 25 |
| Hungarian | 1.00 | 1.00 | 0.92 | 0.92 | 0.92 | 0.92 | 0.96 | 0.96 | 0.92 | 25 |
| Polish | 0.92 | 0.92 | 0.92 | 0.92 | 0.92 | 0.92 | 0.92 | 0.92 | 0.92 | 25 |
| Ukrainian | 1.00 | 1.00 | 0.92 | 1.00 | 1.00 | 0.85 | 1.00 | 1.00 | 0.88 | 25 |
| Arabic | 1.00 | 1.00 | 0.92 | 1.00 | 1.00 | 0.92 | 1.00 | 1.00 | 0.92 | 25 |
| Afghan | 1.00 | 1.00 | 0.92 | 1.00 | 1.00 | 0.92 | 1.00 | 1.00 | 0.92 | 25 |
| African | 0.92 | 0.92 | 0.83 | 0.92 | 0.85 | 0.85 | 0.92 | 0.88 | 0.84 | 25 |
| South Asian | 0.92 | 0.92 | 0.83 | 1.00 | 1.00 | 0.92 | 0.96 | 0.96 | 0.88 | 25 |
| East Asian | 1.00 | 1.00 | 0.92 | 1.00 | 1.00 | 0.92 | 1.00 | 1.00 | 0.92 | 25 |

**The first-name list (test split).** 271 of 325 test names contain a first name from the list. It is used only right after a greeting, title, thank-you, sign-off or introduction.

**Names by where they are in a long text (removal recall).** Each text is far longer than the 512 tokens the name model reads at once.

| Position | DE removal | DE names | EN removal | EN names |
| --- | ---: | ---: | ---: | ---: |
| Start | 1.00 | 4 | 1.00 | 4 |
| Middle | 1.00 | 4 | 1.00 | 4 |
| End | 1.00 | 4 | 1.00 | 4 |
<!-- accuracy:end -->

## Known gaps

From the hand-written cases:

- Document numbers written like an SV-Nummer with a dash, whose second part looks like a date and happens to pass the check digit (`Vorgang 2024-010106`), are removed as SV-Nummern. Most are left alone: a dash form needs a date-like second part, and order, invoice and customer words before the number rule it out.
- Email addresses spelled out to fool spam filters (`name AT example DOT net`).
- English addresses that start with a flat number (`Flat 2, 14 Market Street`).

Names and places, from the name test split and the generated set. Fixing these needs new dev cases first, then a new test set written by someone else ([#82](https://github.com/akojif/painfold/issues/82)):

- Lowercase nicknames after a greeting or thank-you that are not on the first-name list: "cheers ollie", "thx dino", "thx gergő", "hier ist kuba", "thx gosia".
- Names at the start of a sentence, without a greeting or other cue: "Sanne van der Berg says…", "Oluwaseun Adebayo says…".
- Names with particles that are not on the list yet, such as "ur": "Saif ur Rehman".
- Multi-part names the model does not label fully, or labels as a place: "Tesfaye Bekele", "Sipho Ndlovu" (removed, but as a place).
- The second part of some English double names ("Merriweather-Stone"), and English towns right before a postcode ("Bristol BS1 4DJ") are sometimes missed.
- Small towns as places in long texts: "Mehmet Aydın aus Wels" removes the name but not "Wels". Places are not part of the 0.90 target; a missed town can still identify someone together with other details.

In the review, names and places that were missed can be marked with M like anything else.

## Performance

With the name model already in the browser, names in a 5,000-row file are checked in 70 to 115 seconds (several runs on an Apple M3 Pro, depending on what else the machine is doing), in the background while the rule findings are reviewed (Stage 2 asks for under 2.5 minutes). The rule findings themselves are ready in about 0.25 seconds.

A 5,000-row file is cleaned in about 1.5 seconds: import, column step, detection, review and export, clicked straight through in a real browser. Stage 1 asks for under 10 seconds on a normal laptop.

| Step | Time |
| --- | ---: |
| Import (read and parse the file) | 0.2–0.3 s |
| Find personal data and open the review | 0.9–1.2 s |
| Export the cleaned file | 0.1–0.2 s |
| **Total** | **1.2–1.6 s** |

Measured with `npm run bench` (three runs) on an Apple M3 Pro with 18 GB of memory, macOS 26.7, headless Chromium from Playwright 1.65, using a generated 5,000-row file. The same test runs in CI on every pull request with a 20-second limit, since shared runners are slower.
