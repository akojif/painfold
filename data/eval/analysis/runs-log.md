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
| test 1 | English | `test-en-claude-haiku-5-5-2026-11-17T22-20-37Z.json` | `68492d2` | `claude-haiku-5-5` | `37771f5d4668` | effort low, at most 16,000 tokens out, batches of 25 | 60 | 6 | 11,704 | 17,590 | $0.0100 | 54 s |
| test 1 | German | `test-de-claude-haiku-5-5-2026-11-17T22-21-31Z.json` | `68492d2` | `claude-haiku-5-5` | `0287715bfa91` | effort low, at most 16,000 tokens out, batches of 25 | 60 | 6 | 13,136 | 20,111 | $0.0114 | 53 s |
| test 2 | English | `test-en-claude-haiku-5-5-2026-11-17T22-22-26Z.json` | `68492d2` | `claude-haiku-5-5` | `37771f5d4668` | effort low, at most 16,000 tokens out, batches of 25 | 60 | 6 | 11,600 | 14,907 | $0.0086 | 44 s |
| test 2 | German | `test-de-claude-haiku-5-5-2026-11-17T22-23-10Z.json` | `68492d2` | `claude-haiku-5-5` | `0287715bfa91` | effort low, at most 16,000 tokens out, batches of 25 | 60 | 6 | 13,289 | 15,778 | $0.0092 | 44 s |
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
| test 1 | English | `68492d2` | 97% (28/29) | 70% (28/40) | 100% (41/41) | 95% (41/43) |
| test 1 | German | `68492d2` | 92% (22/24) | 69% (22/32) | 100% (36/36) | 92% (36/39) |
| test 2 | English | `68492d2` | 97% (28/29) | 80% (28/35) | 100% (41/41) | 95% (41/43) |
| test 2 | German | `68492d2` | 96% (23/24) | 66% (23/35) | 100% (36/36) | 92% (36/39) |
<!-- generated:scores:end -->

## Notes

### Baseline: dev 1 and dev 2

Two runs with identical settings, before any tuning, on commit `c27950c` (main after #166). Together they are the baseline and show how much results vary between runs. Temperature is not set: this model only takes its fixed default (a request that sets temperature 0 is refused with HTTP 400, "`temperature` is deprecated for this model"), so it applies to every run.

### Round 1: gain definition (dev 3 and dev 4), reverted

One change from the baseline: the gain definition in the tagging instructions (commit `653a082`), for two baseline findings: feature wishes were missed as gains, and general satisfaction or praise was counted as a gain.

Verdict: not kept, reverted in `218980a`. Gain recall beat both baseline runs in both languages, and praise without a named benefit was no longer counted as a gain. Gain precision did not: English dev 3 and both German runs are below both baseline runs. Most new false finds restate a pain from the same text as a gain (a complaint that search fails becomes "search finds umlauts"). German pains also fell just below the baseline range in dev 3.

### Round 2: gain definition with a rule against mirrored pains (dev 5 and dev 6), reverted

The round 1 gain definition, unchanged, plus one rule: a gain that only restates a pain from the same text as its opposite is not recorded; a gain is recorded only when the customer wants something beyond the fix itself, or states the wish separately (commit `ea192a4`). It addressed three dev findings: missed feature wishes, praise counted as a gain, and the pain mirrors from round 1. This was the last tuning round.

Verdict: not kept, reverted in `4eb89e9`; the prompt stays at version 1. Gain recall beat both baseline runs in all four runs. Gain precision did not: English and German dev 5 are below the best baseline run. (An earlier version of this note, and the revert commit, said German dev 6 only equals the best baseline run; both round to 97%, but 31/32 is above 29/30, so German dev 6 did beat both baseline runs on gain precision. The verdict stands on dev 5 and on pains.) Pains fell below the baseline range in English dev 6 (recall) and German dev 6 (precision). In German, pains restated as gains mostly went away; in English, some did, but general praise came back as gains ("simple and essential for daily work", "confidence that figures are right"), and en-009 still got no pain.

### Test run plan (pre-registered before any test run)

Written and pushed before the test split is run, so the plan can be checked against the results. Nothing below changes after the test runs.

- Commit: the test runs are made on the commit that adds this plan. Its code is identical to `fe59a3c` (main at #166, with the evaluation tooling and run log since, and no prompt change: both tuning rounds were reverted).
- Model: `claude-haiku-5-5`, Anthropic, called from `npm run eval:analysis -- --run --split test`. Temperature is not set (the model takes only its fixed default). Effort `low`, at most 16,000 tokens out, batches of 25: the same settings as the dev baseline.
- Prompt: version 1, unchanged since before tuning. Prompt hashes (tagging and merging instructions): English `37771f5d4668`, German `0287715bfa91`, the same as the dev baseline.
- Runs: two test runs per language, English and German, with identical settings. Test 2 is recorded with `--again`, which the script requires for a second test run. Test 1 is the headline run; test 2 is reported only to show how much results vary between runs.
- Metrics reported, per language:
  - presence recall and precision for jobs, pains and gains (against the human labels), for test 1 and test 2;
  - tag-level recall and precision for jobs, pains and gains, from a theme mapping made by a person, on test 1 only (English mapped by Francis, German by the classmate who labelled German);
  - grouping (pairwise), marked as indicative;
  - sentiment and type accuracy, with confusion tables;
  - the share of quotes found word for word;
  - variance between test 1 and test 2: presence agreement and the share of theme pairs repeated.
- The theme mapping is done on test 1 only.
- Nothing is tuned or rerun after the test results are seen. Results are published as they come out, with the known weaknesses noted on #131.

### v0.4 test set plan (pre-registered 2026-11-21, before any v0.4 test text exists)

Approved by Francis on 2026-11-21. Committed and pushed with the selection and generation scripts and the German brief, before any test text is downloaded or generated. Prompt v2 (#178) is tuned only after labelling is done.

**Why a new test set.** The v0.3 texts were written by Claude Opus 5.5 during development, in the same working session that wrote prompt version 1. They're synthetic and from the analyzer's model family, so the v0.3 scores are likely optimistic (#190). v0.4 measures on a separately sourced test set.

**Split.**
- Dev (for tuning prompt v2): all 240 v0.3 texts, 120 per language, its former test set included.
- Test (run once): 100 new texts per language.

**English: CFPB complaint narratives (real feedback).**
- **Source:** the CFPB Consumer Complaint Database. It's published by a US federal agency for anyone to use. Narratives are published only with the consumer's consent, after a computer pass, a human review and a final computer check. The CFPB measured residual leakage at about 0.5 %.
- **Selection** (`scripts/eval-v04-select.ts`, seed `20261121`):
  - 120 days of 2025 drawn with the seed, up to 100 complaints with a narrative from each day;
  - then 150 to 1,500 characters, no duplicate texts, at most 2 per company, spread across products by a seeded round robin;
  - 100 test texts and 20 reserve.
- **Handling:**
  - The CFPB's masks (`XX/XX/XXXX`, `XXXX`) count as already removed.
  - Painfold's rule detectors count what's left, by type, as counts only.
  - Names are checked by the labeller, who removes anything left by hand.
  - Texts that still hold personal data are replaced from the reserve, in order.
- **Licence:** the texts go into `data/eval/analysis/v04/cfpb/` with a NOTICE (source, download date, the CFPB's terms), after labelling.
- **Domain:** US financial-services complaints, unlike the dev texts (an invoicing app).

**German: GermEval 2017 if its maintainers allow it, otherwise generated.**
- Francis asks the maintainers whether the data may be used and redistributed in this public MIT repository for evaluation. **Deadline: 24 November 2026, end of day.**
- **If they allow it:**
  - Their licence or permission is quoted here, word for word, in a commit, before any GermEval text is downloaded into the repository.
  - A committed selection script, written before the download, draws 100 plus 20 reserve with the seed: news and Q&A sources only, no tweets, relevant, with a sentiment.
  - **Cleaning before labelling uses Painfold's own detection, as in the app:** the rules plus the name model at the revision pinned in `deploy/model.ts`, run in Chromium like `npm run eval:names`.
    - Every finding is removed and nothing is kept. Indirect-identifier warnings are counted, not removed.
    - Usernames become `[NAME_n]` and links `[LINK_n]`.
    - New IDs (`de-ge-001` …) replace the originals, which contain usernames. The mapping stays private.
    - Counts only are printed. The labeller removes anything left.
  - **Limitations:**
    - The domain is rail travel, not finance. The comparison stays within each language, so the languages don't need the same domain.
    - Short social-media and Q&A texts carry fewer jobs and gains per text than the English narratives.
- **If not: generated by Mistral Large** from the committed brief, [v04/german-brief.md](v04/german-brief.md) (`scripts/eval-v04-generate.ts`), flagged as generated text everywhere.
  - **Design note:** the slot mix deliberately over-represents the v0.3 boundary cases: praise only, wishes phrased as a question or as something missing, nothing to find, several goals. So it's a stress test, not a natural mix like the English CFPB texts.
  - **Drops:** regenerated and dropped slots are reported by language variety and by special feature, as counts only. If any variety or feature loses more than 2 slots, the script stops before labelling.
  - **Who wrote the brief:** Claude Opus 5.5, the agent that tunes prompt v2. It knows the brief's topics and shares, never the texts.

**Handling of all test texts.**
- Written only into the git-ignored `data/eval/analysis/v04/private/` and the labelling sheets there.
- The scripts print counts, never a text. Claude in Claude Code never reads, prints, quotes or summarizes a test text, and checks the sheets for structure only.
- Test texts are committed only after labelling, and never quoted in issues, pull requests or chat.

**Labelling: 23 to 29 November 2026.**
- English: Francis.
- German: the German-speaking classmate, without the English labels available. Each language is labelled and merged on its own.
- The English sheet can be ready on 23 November. The German texts exist on 25 November, after the GermEval deadline, so German labelling runs 25 to 29 November.
- Pain and gain merges come from the names only, without Painfold output.

**What is measured.**
- **Main measure:** tag-level recall (Found) and precision (Correct) per kind, after each labeller maps Painfold's themes to their own.
- **Also reported, without targets:** presence, grouping, sentiment and type, quotes word for word, and stability (test 1 against test 2).
- **Runs, once per language each:** prompt v2 test 1 (the headline), prompt v2 test 2 (the variance) and prompt v1 (the comparison). No tuning or rerun after the results are seen.
- **Recorded before the runs:** the commit, model, settings, prompt versions and hashes.

**Comparisons.**
- **The main comparison is prompt v2 against prompt v1 on the same new test set, within each language.**
- German and English scores are never compared with each other: different domains, and for German possibly a stress-test mix.
- v0.4's numbers aren't compared with v0.3's published ones.

**Targets.** Tag-level; each applies to each language separately; a missed target is published as missed.

| Target for prompt v2 on the new test set | Per language | v0.3 baseline (EN / DE) |
|---|---|---|
| Gain recall | at least 70 % | 66 % / 63 % |
| Gain precision | at least 55 % | 48 % / 47 % |
| Job precision | at least 65 % | 65 % / 50 % |
| Pain recall | within 5 points of v0.3: at least 71 % EN, 73 % DE | 76 % / 78 % |
| Job recall | within 5 points of v0.3: at least 84 % EN, 81 % DE | 89 % / 86 % |

**Against prompt v1:**
- Prompt v2 beats prompt v1 on gain precision and job precision, in each language.
- It falls no more than 5 points on any other tag-level metric.

**Presence has no targets.**

**Small samples.** If a language has fewer than 30 labelled gains, its gain targets are reported but not judged.

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
