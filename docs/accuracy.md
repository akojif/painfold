# Accuracy and performance

How well Painfold finds personal data, how fast it is, and how well it finds customer jobs, pains and gains. The personal-data tables are written by `npm run eval -- --write`, which also writes `data/eval/accuracy.json` for the [Accuracy page](https://painfold.com/accuracy/) in the app; the jobs, pains and gains tables are written by `npm run eval:analysis -- --write`. A unit test fails when any of them is out of date.

## In short

Detection is measured per data type and language, on generated messages, on hand-written hard cases and on hand-written names from 13 communities living in Austria, and checked in CI. On the name test split, 97 % of names are removed (0.98 in German, 0.96 in English), and at least 92 % in every name-origin group; the model is measured in the browser, as users run it. On the hard cases nothing that only looks like personal data is removed, apart from one known case, and the known misses are listed. A 5,000-row file is cleaned in about 1.5 seconds; with the name model in the browser, names in it are checked in 70 to 115 seconds, in the background. Text that could identify someone together with other details (exact ages, "the only …", a job title with a small place) gets a warning, never removed on its own; on a small hand-written set every warning is found. The same numbers are on the [Accuracy page](https://painfold.com/accuracy/).

Automatic detection can miss personal data, including names. Review the results before sharing the cleaned file.

## How it is measured

Detection is measured on the evaluation set in [data/eval/](../data/README.md), with `npm run eval`, by the rules and the name model together, as in the app. The rules run in Node. The name model is measured only in the browser: `npm run eval:names` runs the built names worker in headless Chromium, on the same WebAssembly runtime users get, and stores what it finds in [data/eval/name-detections.json](../data/eval/name-detections.json). An end-to-end test reruns it on every pull request and fails if anything differs, so these numbers cannot go stale. (Native ONNX Runtime in Node gives different results on different processors, so it is never used for the numbers.) Four sets are reported separately:

- **Generated:** 1,200 messages built from the same templates as the sample file. The detectors could be tuned to these sentences, so treat these numbers as a check that nothing broke.
- **Hand-written hard cases:** written separately to catch what templates don't: obfuscated and pasted values, numbers written with dashes, dots or non-breaking spaces, and look-alikes that must not be removed (order and invoice numbers, ISBNs, EANs, versions, ordinary dates).
- **Hand-written long texts:** 8 German and English support messages of 5,000 to 6,000 characters (about 1,200 to 1,400 model tokens), each with a name near the start, one in the middle and one in the last sentence. The name model reads at most 512 tokens at a time, so long texts are checked in overlapping chunks; this set shows that names are found wherever they are. It was written after the name rules were tuned and is only reported.
- **Hand-written names:** 286 German and English sentences with invented names typical of communities living in Austria, because names in Austrian feedback come from many backgrounds, not only German and English ones. They include real diacritics (ć, š, ž, ğ, ı, ș, ő, ł), variant transliterations (Mohammed, Muhammad, Mohamad, Mohammad), multi-part and particle names (Abdul Rahman, Al-Hassan, van der Berg), possessives and lowercase chat names. Name recall is also reported per name-origin group, with the same target for every group. The group exists only in the evaluation data; Painfold never infers anyone's origin. A dev split (3 sentences per group, plus 26 look-alikes such as "Hallo Team" or "Liebe Grüße") was used to tune the name rules; only the test split (19 sentences, 25 names per group, written before any tuning) is reported. The test sentences were written by the same author as the tuning, but the test split was run only once, after tuning, and never used to tune. The generated set and the hard cases were measured with the name model once, after tuning, and were not used to tune it either.

- **Hand-written indirect identifiers:** 80 short German and English messages ([data/eval/indirect.jsonl](../data/eval/indirect.jsonl)) for the warnings about text that could identify someone: exact ages, "the only …", job titles with a place and unique roles, plus traps that must not warn (durations, versions, order numbers, the age of things, "the only problem", a role mentioned in passing, a job title in a large city). The places in each text are given, as the name model would find them, so the numbers measure the warning rules, not the model. A dev split (40 messages) was used to tune the rules; the test split (40 messages, 23 warnings, written before any tuning) was run once, after tuning, and is what is reported. These are warnings, never removed on their own, so a miss means a reviewer is not pointed at the text, and a wrong warning costs one key press.

How it is counted:

- **Recall:** the share of labelled values that detections of the same type cover completely. A value that is only partly removed counts as missed.
- **Precision:** the share of detections that overlap a labelled value of their type.
- **Removed by any type:** the share of labelled values that are fully removed by any detection. This is what matters for the cleaned file; an IBAN caught as something else is still removed.
- **For names, three columns:** removal recall (the name is removed, whatever type it got: a name labelled as a place is still protected), type-correct recall (removed and labelled as a name), and removal recall without the first-name list. The first-name list is used only right after a greeting, title, thank-you, sign-off or introduction ("hi anna", "LG Markus"), so the last column shows how much the names depend on it.
- Where a name or place overlaps a rule finding, the rule finding wins and only the rest of the name or place is kept, as in the review: a street name inside an address counts as the address, not as a place.

For the warnings, a labelled warning counts as found when a warning of the same kind of placeholder (age or role) covers part of it, and a warning counts as correct when it covers part of a labelled one.

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

**Could identify someone (indirect identifiers, test split)**

| Kind | DE recall | DE precision | DE warnings | EN recall | EN precision | EN warnings |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Exact age | 1.00 | 1.00 | 5 | 1.00 | 1.00 | 4 |
| “The only …” | 1.00 | 1.00 | 2 | 1.00 | 1.00 | 2 |
| Job title with a place | 1.00 | 1.00 | 2 | 1.00 | 1.00 | 2 |
| Role held by one person | 1.00 | 1.00 | 3 | 1.00 | 1.00 | 3 |
<!-- accuracy:end -->

## Known gaps

From the hand-written cases:

- Document numbers written like an SV-Nummer with a dash, whose second part looks like a date and happens to pass the check digit (`Vorgang 2024-010106`), are removed as SV-Nummern. Most are left alone: a dash form needs a date-like second part, and order, invoice and customer words before the number rule it out.
- Email addresses spelled out to fool spam filters (`name AT example DOT net`).
- English addresses that start with a flat number (`Flat 2, 14 Market Street`).

Warnings for indirect identifiers. The test split scores 1.00, but it is small (23 warnings) and was written by the same author as the rules, so real feedback will score lower. Known not to warn:

- Ages written as words ("zweiundvierzig", "forty-two"), ages after a comma ("meine Frau, 42, …"), and ages after a person other than with "ist" or "is" ("my mum turned 80").
- Roles and job titles that are not on the lists in `core/detect/indirect/roles.ts`, and German compounds of words shorter than six letters.
- Job titles with a place, when the name model is not used: the places come from it.
- Places outside Austria and Germany are not on the large-city list, so a common job title next to London or Zürich warns although it would not need to.

Names and places, from the name test split and the generated set. Fixing these needs new dev cases first, then a new test set written by someone else ([#82](https://github.com/akojif/painfold/issues/82)):

- English names in English sentences are the weakest area: 11 of the 13 English-origin test names in English sentences are removed (0.85; 0.92 for the group across both languages, which is what the target is measured on). With 12 or 13 names per group and language, one miss moves a per-language number by about 8 points, so these slices are too small to judge one language on its own. The larger, independent test set in #82 has at least 25 names per group and language for this.
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

## Jobs, pains and gains

The analysis (Stage 3) is measured on 240 invented feedback messages about an invoicing and accounting app ([data/eval/analysis/](../data/README.md)), 120 in English and 120 in German, each language split into 60 dev and 60 test messages. The messages and the instructions to the model were written by the same person; the labels were not. The English half is labelled by Francis, the German half by a German-speaking classmate: for each message, its jobs, pains and gains (as short theme names the labeller keeps consistent), its sentiment and its type.

The instructions were tuned on the dev split only. The test split was run once per language, after tuning, and that run is what is published. Each run stores the model's answers, so the numbers below are recomputed from them, through the same code as the app, without a request.

How it is counted:

- **Tag recall and precision** (shown as Found and Correct on the Accuracy page): after the test run, the labeller of each language matched every theme the model found to one of their own themes, by meaning, or to none. A labelled job, pain or gain counts as found when the model put that message under a theme matched to it; a model tag counts as correct when it was matched to a theme the labeller gave that message.
- **Presence recall and precision:** whether a message has any job, pain or gain at all, regardless of which. This needs no matching.
- **Grouping recall and precision:** for every pair of messages the labeller put under the same theme, whether the model did too, and the other way round. It measures the merging without any matching, but it is hard to read, so it is shown only here.
- **Sentiment and type:** the share of messages with the labelled value, with confusion tables.
- **Quotes found word for word:** quotes the model gave that were found word for word in the message; the others are dropped before the report.
- **Same answer when run twice:** two dev runs of the same model, compared on whether each message has a job, a pain and a gain.

The sample is small: 60 test messages per language, and fewer labelled jobs, pains or gains of each kind, so a single message moves a number by two points or more. There are no targets for version 0.3: these results are published with their weaknesses, and the targets for version 0.4 are set from them.

<!-- analysis:start -->
**English**: `test-en-claude-haiku-5-5-2026-11-17T22-20-37Z.json`, 60 texts, Claude Haiku 5.5, 2026-11-17, themes mapped by Francis Akoji.

| Kind | Tag recall | Tag precision | Presence recall | Presence precision | Grouping recall | Grouping precision |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Jobs | 0.89 (34/38) | 0.65 (34/52) | 0.95 (35/37) | 0.69 (35/51) | 0.65 (28/43) | 0.68 (28/41) |
| Pains | 0.76 (32/42) | 0.71 (32/45) | 1.00 (41/41) | 0.95 (41/43) | 1.00 (4/4) | 0.21 (4/19) |
| Gains | 0.66 (19/29) | 0.47 (19/40) | 0.97 (28/29) | 0.70 (28/40) | 1.00 (3/3) | 0.15 (3/20) |

| Measure | Value |
| --- | ---: |
| Sentiment correct | 0.88 (53/60) |
| Type correct | 0.95 (57/60) |
| Quotes found word for word | 1.00 (143/143) |
| Same answer when run twice (two dev runs) | 0.91 (164/180) |

Sentiment, labelled (rows) against Painfold's answer (columns):

| Sentiment | positive | negative | mixed | neutral |
| --- | ---: | ---: | ---: | ---: |
| positive | 9 | 0 | 0 | 0 |
| negative | 0 | 25 | 3 | 0 |
| mixed | 0 | 0 | 6 | 0 |
| neutral | 0 | 4 | 0 | 13 |

Type, labelled (rows) against Painfold's answer (columns):

| Type | bug | feature request | question | praise | complaint | other |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| bug | 15 | 0 | 0 | 0 | 1 | 0 |
| feature request | 0 | 13 | 0 | 0 | 0 | 0 |
| question | 0 | 0 | 11 | 0 | 0 | 0 |
| praise | 0 | 1 | 0 | 9 | 0 | 0 |
| complaint | 0 | 1 | 0 | 0 | 7 | 0 |
| other | 0 | 0 | 0 | 0 | 0 | 2 |

**German**: `test-de-claude-haiku-5-5-2026-11-17T22-21-31Z.json`, 60 texts, Claude Haiku 5.5, 2026-11-17, themes mapped by a German-speaking classmate.

| Kind | Tag recall | Tag precision | Presence recall | Presence precision | Grouping recall | Grouping precision |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Jobs | 0.86 (24/28) | 0.50 (24/48) | 0.93 (26/28) | 0.54 (26/48) | 0.69 (18/26) | 0.27 (18/66) |
| Pains | 0.78 (31/40) | 0.66 (31/47) | 1.00 (36/36) | 0.92 (36/39) | 0.94 (15/16) | 0.39 (15/38) |
| Gains | 0.63 (15/24) | 0.47 (15/32) | 0.92 (22/24) | 0.69 (22/32) | 0.50 (1/2) | 0.07 (1/14) |

| Measure | Value |
| --- | ---: |
| Sentiment correct | 0.88 (53/60) |
| Type correct | 0.88 (53/60) |
| Quotes found word for word | 1.00 (132/132) |
| Same answer when run twice (two dev runs) | 0.93 (167/180) |

Sentiment, labelled (rows) against Painfold's answer (columns):

| Sentiment | positive | negative | mixed | neutral |
| --- | ---: | ---: | ---: | ---: |
| positive | 12 | 0 | 0 | 0 |
| negative | 0 | 22 | 2 | 1 |
| mixed | 0 | 0 | 5 | 0 |
| neutral | 0 | 4 | 0 | 14 |

Type, labelled (rows) against Painfold's answer (columns):

| Type | bug | feature request | question | praise | complaint | other |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| bug | 11 | 0 | 0 | 0 | 2 | 0 |
| feature request | 1 | 7 | 0 | 0 | 0 | 0 |
| question | 0 | 0 | 11 | 0 | 0 | 0 |
| praise | 0 | 1 | 0 | 12 | 0 | 0 |
| complaint | 2 | 0 | 0 | 0 | 9 | 1 |
| other | 0 | 0 | 0 | 0 | 0 | 3 |

Stored test runs:

| Run | Texts | Not analyzed | Merged | Quotes kept |
| --- | ---: | ---: | ---: | ---: |
| `test-de-claude-haiku-5-5-2026-11-17T22-21-31Z.json` | 60 | 0 | yes | 1.00 (132/132) |
| `test-de-claude-haiku-5-5-2026-11-17T22-23-10Z.json` | 60 | 0 | yes | 1.00 (141/141) |
| `test-en-claude-haiku-5-5-2026-11-17T22-20-37Z.json` | 60 | 0 | yes | 1.00 (143/143) |
| `test-en-claude-haiku-5-5-2026-11-17T22-22-26Z.json` | 60 | 0 | yes | 1.00 (137/137) |
<!-- analysis:end -->
