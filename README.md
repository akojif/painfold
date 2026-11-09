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

Requires Node 24 and npm 11. The version is pinned in `.nvmrc`; with [nvm](https://github.com/nvm-sh/nvm), run `nvm use` in the project folder (or `nvm install` the first time) before any npm command. If your shell still reports another version with `node -v`, run `hash -r` or open a new terminal.

```sh
nvm use
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

### Dependency install scripts

npm 11 does not run dependency install scripts unless they are allowed. The `allowScripts` field in `package.json` records the decision for each package that has one:

- `esbuild`: denied. Its postinstall only verifies the platform binary, which npm already installs as an optional dependency.
- `fsevents`: denied. It ships prebuilt; the script is a build-from-source fallback.

If a new dependency brings an install script, `npm install` warns about it. Review it with `npm install-scripts ls`, then allow or deny it explicitly.

## License

Code: [MIT](LICENSE).

Fonts in `app/assets/fonts/` (Atkinson Hyperlegible Next, Atkinson Hyperlegible Mono, Source Serif 4) are self-hosted under the SIL Open Font License 1.1; each folder contains its license.
