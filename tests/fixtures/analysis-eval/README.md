# Analysis evaluation fixture

Six invented English items in the exact format `npm run labels:convert` writes (`labels-<lang>.jsonl`, scripts/labels.ts), with invented model predictions in `tests/unit/analysis-metrics.test.ts`. Every expected number in that test is worked out by hand from these lines, so the metrics are checked before any real labels exist. Not part of the evaluation set.
