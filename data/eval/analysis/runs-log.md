# Analysis evaluation runs

Every run of the analysis evaluation (#129), in the order it was made. The raw provider answers are in `runs/`, and `npm run eval:analysis` replays them without a key or a request.

## Dev baseline: runs 1 and 2 (2026-11-17)

Two runs with identical settings, on the dev split only, before any tuning. Together they are the baseline and show how much results vary between runs.

- Commit: `c27950c` (main after #166), the same for all four files
- Provider: Anthropic, called straight from the script
- Model: `claude-haiku-5-5`
- Temperature: not set, so the provider default applies; adaptive thinking with effort `low`, at most 16,000 output tokens, batches of 25 texts
- Prompt version: the prompts have no version number yet, so each is identified by a SHA-256 of the tagging and merging instructions sent. English `37771f5d4668`, German `0287715bfa91`; the same in both runs of each language
- Rows: 60 dev items per language and run (the test split was not run)
- Cost: from the tokens Anthropic reported, at $0.10 per million tokens in and $0.50 per million out (prices checked 2026-11-13)

| Run | Language | File | Started (UTC) | Tokens in | Tokens out | Cost | Duration |
|---|---|---|---|---|---|---|---|
| 1 | English | `dev-en-claude-haiku-5-5-2026-11-17T21-21-43Z.json` | 21:21:41 | 11,335 | 19,333 | $0.0108 | 57 s |
| 1 | German | `dev-de-claude-haiku-5-5-2026-11-17T21-22-38Z.json` | 21:22:38 | 13,460 | 24,517 | $0.0136 | 66 s |
| 2 | English | `dev-en-claude-haiku-5-5-2026-11-17T21-23-44Z.json` | 21:23:44 | 11,178 | 19,931 | $0.0111 | 56 s |
| 2 | German | `dev-de-claude-haiku-5-5-2026-11-17T21-24-41Z.json` | 21:24:40 | 13,196 | 22,577 | $0.0126 | 59 s |

Total: 24 requests (per language and run, 3 tagging batches and 3 merge requests), $0.048, about 4 minutes.

## Round 1: gain definition (runs 3 and 4, 2026-11-17), reverted

One change from the baseline: the gain definition in the tagging instructions (commit `653a082`). It addressed two baseline findings: feature wishes were missed as gains, and general satisfaction or praise was counted as a gain. Everything else matched the baseline: same model, settings and merge instructions, dev split only.

- Commit: `653a082`, the same for all four files
- Provider, model, temperature, rows: as in the baseline. Temperature 0 is not possible on this model: Anthropic answers a request that sets it with HTTP 400 ("`temperature` is deprecated for this model"), so every run uses the fixed default
- Prompt version: tagging and merging instructions hash to English `af1e7e98b6a9`, German `d71e3ce51cf0`

| Run | Language | File | Started (UTC) | Tokens in | Tokens out | Cost | Duration |
|---|---|---|---|---|---|---|---|
| 3 | English | `dev-en-claude-haiku-5-5-2026-11-17T21-43-18Z.json` | 21:43:17 | 11,650 | 18,097 | $0.0102 | 50 s |
| 3 | German | `dev-de-claude-haiku-5-5-2026-11-17T21-44-08Z.json` | 21:44:07 | 14,054 | 25,549 | $0.0142 | 67 s |
| 4 | English | `dev-en-claude-haiku-5-5-2026-11-17T21-45-14Z.json` | 21:45:14 | 11,740 | 17,280 | $0.0098 | 48 s |
| 4 | German | `dev-de-claude-haiku-5-5-2026-11-17T21-46-02Z.json` | 21:46:02 | 14,211 | 20,914 | $0.0119 | 62 s |

Gains and pains, presence against the human labels (baseline runs 1 and 2, then runs 3 and 4):

| | Gains recall | Gains precision | Pains recall | Pains precision |
|---|---|---|---|---|
| English, baseline | 86%, 75% | 77%, 81% | 97%, 97% | 91%, 91% |
| English, round 1 | 93%, 96% | 68%, 82% | 97%, 97% | 100%, 94% |
| German, baseline | 85%, 88% | 97%, 94% | 100%, 100% | 97%, 97% |
| German, round 1 | 100%, 100% | 85%, 79% | 97%, 100% | 95%, 95% |

Verdict: not kept, reverted in `218980a`. Gain recall beat both baseline runs in both languages, and praise without a named benefit was no longer counted as a gain. But gain precision did not: English run 3 is below both baseline runs, and both German runs are. Most new false finds mirror a pain as a gain (a complaint that search fails becomes "search finds umlauts"). German pains also slipped just below the baseline range in run 3 (recall 36/37, precision 95%).

## Possible label gaps (dev split)

Items where Painfold found something the human labels do not have, and the text looks like it does say it. Listed for the labellers to judge. They are not counted as correct, and no label was changed.

| Item | Found | Seen in | Why it may be a gap |
|---|---|---|---|
| en-113 | pain: support does not respond | runs 1, 2 and 4 | The text asks whether anyone reads the messages |
| de-113 | pain: support does not respond | runs 1 to 4 | Same as en-113, in German |
| en-008 | gain: a refund of the double payment | runs 1 to 4 | The text asks for the refund outright |
| en-116 | gain: keep or restore invoice duplication | runs 1 to 4 | The text calls it the feature they used most |
| en-089 | gain: payment terms per invoice | runs 1, 3 and 4 | "which is not what I want" names the wanted outcome |
| en-040, de-040 | gain: payroll for more than one country | runs 3 and 4 | The customer uses a second tool to get it |
