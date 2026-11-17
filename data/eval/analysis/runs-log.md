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
