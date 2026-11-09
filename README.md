# Painfold

Find what hurts your customers, without exposing who they are.

Painfold turns customer feedback into an evidence-backed customer profile: the jobs customers are trying to get done, their pains and their gains. Personal data is removed in your own browser before any AI sees it, including German-language and Austrian data.

## Status

Early development. Nothing is usable yet.

The first release (v0.1, Clean) removes personal data from a CSV or XLSX file in the browser and lets you download the cleaned file. See [ROADMAP.md](ROADMAP.md) for all stages and what "done" means for each.

## The promise

- Your file is never uploaded. It stays in your browser.
- Nothing is sent to an AI until you have reviewed what was removed.
- Numbers are counted by code, and quotes are checked against your data.

## Development

Requires Node 24 (see `.nvmrc`).

```sh
npm install
npm run dev          # local development server
npm run generate     # static build in .output/public
npm run serve        # serve the static build on http://localhost:4173
npm run lint
npm run typecheck
npm test             # unit tests (Vitest)
npm run test:e2e     # end-to-end tests against the static build (Playwright)
```

Run `npm run generate` before `npm run test:e2e`. The first time, install the test browser with `npx playwright install chromium`.

Every end-to-end test fails if the page contacts any origin other than the app itself.

## License

[MIT](LICENSE)
