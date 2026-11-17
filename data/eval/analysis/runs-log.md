# Analysis evaluation runs

Every run of the analysis evaluation (#129). The raw provider answers are in `runs/`, and `npm run eval:analysis` replays them without a key or a request. The tables between the generated markers are written by `npm run eval:analysis -- --write` from those files (scripts/runs-log.ts), and a unit test fails when they are out of date; no number in them is typed by hand. The notes around them are hand-written.

All runs so far are on the dev split. The test split has not been run.

## Runs

Runs are numbered per split and language in the order they were made. The prompt is a short SHA-256 of the tagging and merging instructions sent. Cost comes from the tokens Anthropic reported, at the prices in `core/ai/cost.ts`. Duration is recorded from round 2 on; the first runs did not store it.

<!-- generated:runs:start -->
| Run | Language | File | Commit | Model | Prompt | Settings | Rows | Requests | Tokens in | Tokens out | Cost | Duration |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| dev 1 | English | `dev-en-claude-haiku-5-5-2026-11-17T21-21-43Z.json` | `c27950c` | `claude-haiku-5-5` | `37771f5d4668` | effort low, at most 16,000 tokens out, batches of 25 | 60 | 6 | 11,335 | 19,333 | $0.0108 | not recorded |
| dev 1 | German | `dev-de-claude-haiku-5-5-2026-11-17T21-22-38Z.json` | `c27950c` | `claude-haiku-5-5` | `0287715bfa91` | effort low, at most 16,000 tokens out, batches of 25 | 60 | 6 | 13,460 | 24,517 | $0.0136 | not recorded |
| dev 2 | English | `dev-en-claude-haiku-5-5-2026-11-17T21-23-44Z.json` | `c27950c` | `claude-haiku-5-5` | `37771f5d4668` | effort low, at most 16,000 tokens out, batches of 25 | 60 | 6 | 11,178 | 19,931 | $0.0111 | not recorded |
| dev 2 | German | `dev-de-claude-haiku-5-5-2026-11-17T21-24-41Z.json` | `c27950c` | `claude-haiku-5-5` | `0287715bfa91` | effort low, at most 16,000 tokens out, batches of 25 | 60 | 6 | 13,196 | 22,577 | $0.0126 | not recorded |
| dev 3 | English | `dev-en-claude-haiku-5-5-2026-11-17T21-43-18Z.json` | `653a082` | `claude-haiku-5-5` | `af1e7e98b6a9` | effort low, at most 16,000 tokens out, batches of 25 | 60 | 6 | 11,650 | 18,097 | $0.0102 | not recorded |
| dev 3 | German | `dev-de-claude-haiku-5-5-2026-11-17T21-44-08Z.json` | `653a082` | `claude-haiku-5-5` | `d71e3ce51cf0` | effort low, at most 16,000 tokens out, batches of 25 | 60 | 6 | 14,054 | 25,549 | $0.0142 | not recorded |
| dev 4 | English | `dev-en-claude-haiku-5-5-2026-11-17T21-45-14Z.json` | `653a082` | `claude-haiku-5-5` | `af1e7e98b6a9` | effort low, at most 16,000 tokens out, batches of 25 | 60 | 6 | 11,740 | 17,280 | $0.0098 | not recorded |
| dev 4 | German | `dev-de-claude-haiku-5-5-2026-11-17T21-46-02Z.json` | `653a082` | `claude-haiku-5-5` | `d71e3ce51cf0` | effort low, at most 16,000 tokens out, batches of 25 | 60 | 6 | 14,211 | 20,914 | $0.0119 | not recorded |
| dev 5 | English | `dev-en-claude-haiku-5-5-2026-11-17T21-59-08Z.json` | `ea192a4` | `claude-haiku-5-5` | `b61172780ec8` | effort low, at most 16,000 tokens out, batches of 25 | 60 | 6 | 12,398 | 19,593 | $0.0110 | 59 s |
| dev 5 | German | `dev-de-claude-haiku-5-5-2026-11-17T22-00-08Z.json` | `ea192a4` | `claude-haiku-5-5` | `c49dbc91195d` | effort low, at most 16,000 tokens out, batches of 25 | 60 | 6 | 13,660 | 20,928 | $0.0118 | 57 s |
| dev 6 | English | `dev-en-claude-haiku-5-5-2026-11-17T22-01-05Z.json` | `ea192a4` | `claude-haiku-5-5` | `b61172780ec8` | effort low, at most 16,000 tokens out, batches of 25 | 60 | 6 | 12,032 | 21,465 | $0.0119 | 60 s |
| dev 6 | German | `dev-de-claude-haiku-5-5-2026-11-17T22-02-05Z.json` | `ea192a4` | `claude-haiku-5-5` | `c49dbc91195d` | effort low, at most 16,000 tokens out, batches of 25 | 60 | 6 | 13,772 | 26,150 | $0.0145 | 66 s |
<!-- generated:runs:end -->

## Scores

Presence against the human labels: whether an item has a gain, or a pain, at all. Whether it is the right one is only checked with the theme mapping on the test run.

<!-- generated:scores:start -->
| Run | Language | Commit | Gains recall | Gains precision | Pains recall | Pains precision |
| --- | --- | --- | --- | --- | --- | --- |
| dev 1 | English | `c27950c` | 86% (24/28) | 77% (24/31) | 97% (32/33) | 91% (32/35) |
| dev 1 | German | `c27950c` | 85% (29/34) | 97% (29/30) | 100% (37/37) | 97% (37/38) |
| dev 2 | English | `c27950c` | 75% (21/28) | 81% (21/26) | 97% (32/33) | 91% (32/35) |
| dev 2 | German | `c27950c` | 88% (30/34) | 94% (30/32) | 100% (37/37) | 97% (37/38) |
| dev 3 | English | `653a082` | 93% (26/28) | 68% (26/38) | 97% (32/33) | 100% (32/32) |
| dev 3 | German | `653a082` | 100% (34/34) | 85% (34/40) | 97% (36/37) | 95% (36/38) |
| dev 4 | English | `653a082` | 96% (27/28) | 82% (27/33) | 97% (32/33) | 94% (32/34) |
| dev 4 | German | `653a082` | 100% (34/34) | 79% (34/43) | 100% (37/37) | 95% (37/39) |
| dev 5 | English | `ea192a4` | 96% (27/28) | 69% (27/39) | 97% (32/33) | 97% (32/33) |
| dev 5 | German | `ea192a4` | 100% (34/34) | 89% (34/38) | 100% (37/37) | 97% (37/38) |
| dev 6 | English | `ea192a4` | 96% (27/28) | 82% (27/33) | 94% (31/33) | 97% (31/32) |
| dev 6 | German | `ea192a4` | 91% (31/34) | 97% (31/32) | 100% (37/37) | 95% (37/39) |
<!-- generated:scores:end -->

## Notes

### Baseline: dev 1 and dev 2

Two runs with identical settings, before any tuning, on commit `c27950c` (main after #166). Together they are the baseline and show how much results vary between runs. Temperature is not set: this model only takes its fixed default (a request that sets temperature 0 is refused with HTTP 400, "`temperature` is deprecated for this model"), so it applies to every run.

### Round 1: gain definition (dev 3 and dev 4), reverted

One change from the baseline: the gain definition in the tagging instructions (commit `653a082`), for two baseline findings: feature wishes were missed as gains, and general satisfaction or praise was counted as a gain.

Verdict: not kept, reverted in `218980a`. Gain recall beat both baseline runs in both languages, and praise without a named benefit was no longer counted as a gain. Gain precision did not: English dev 3 and both German runs are below both baseline runs. Most new false finds restate a pain from the same text as a gain (a complaint that search fails becomes "search finds umlauts"). German pains also fell just below the baseline range in dev 3.

### Round 2: gain definition with a rule against mirrored pains (dev 5 and dev 6), reverted

The round 1 gain definition, unchanged, plus one rule: a gain that only restates a pain from the same text as its opposite is not recorded; a gain is recorded only when the customer wants something beyond the fix itself, or states the wish separately (commit `ea192a4`). It addressed three dev findings: missed feature wishes, praise counted as a gain, and the pain mirrors from round 1. This was the last tuning round.

Verdict: not kept, reverted in `4eb89e9`; the prompt stays at version 1. Gain recall beat both baseline runs in all four runs. Gain precision did not: English and German dev 5 are below the best baseline run, and German dev 6 only equals it. Pains fell below the baseline range in English dev 6 (recall) and German dev 6 (precision). In German, pains restated as gains mostly went away; in English, some did, but general praise came back as gains ("simple and essential for daily work", "confidence that figures are right"), and en-009 still got no pain.

## Possible label gaps (dev split)

Items where Painfold found something the human labels do not have, and the text looks like it does say it. Listed for the labellers to judge; they are not counted as correct, and no label was changed. The list is kept by hand in `label-gaps.json`; the runs it was seen in are computed.

<!-- generated:gaps:start -->
| Item | Found | Seen in (dev runs) | Why it may be a gap |
| --- | --- | --- | --- |
| en-113 | pain: support does not respond | runs 1, 2, 4 and 5 | The text asks whether anyone reads the messages |
| de-113 | pain: support does not respond | runs 1, 2, 3, 4, 5 and 6 | Same as en-113, in German |
| en-008 | gain: a refund of the double payment | runs 1, 2, 3, 4 and 5 | The text asks for the refund outright |
| en-116 | gain: keep or restore invoice duplication | runs 1, 2, 3, 4, 5 and 6 | The text calls it the feature they used most |
| en-089 | gain: payment terms per invoice | runs 1, 3, 4 and 6 | "which is not what I want" names the wanted outcome |
| en-040 | gain: payroll for more than one country | runs 3, 4 and 5 | The customer uses a second tool to get it |
| de-040 | gain: payroll for more than one country | runs 3, 4 and 5 | Same as en-040, in German |
<!-- generated:gaps:end -->
