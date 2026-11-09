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
- No cookies, no analytics, no tracking. An end-to-end test checks that no cookies are set.
- The only thing Painfold stores is your theme choice (Light or Dark), in `localStorage` under `painfold-theme`. Choosing System removes it. Your file, the findings and your decisions are never stored; they are gone when you close the tab. An end-to-end test checks this too.

## What you download

**The cleaned file** (`<name>_cleaned.csv`) holds only your data, so it can go straight into a spreadsheet or another tool:

- Columns set to Drop are left out. Columns set to Keep as is are copied unchanged.
- In checked columns, every finding you removed, and every finding you did not review, is replaced by a placeholder such as `[EMAIL_3]`. The same value always gets the same placeholder. Findings you kept stay as they were.
- UTF-8 with a byte order mark (so Excel shows umlauts correctly), and the same delimiter as the original CSV: a semicolon file stays a semicolon file. Files imported from XLSX are saved with commas.
- **Formula protection:** a cell that starts with `=`, `+`, `-` or `@` (also after leading spaces), a tab or a carriage return could run as a formula when the file is opened in Excel, LibreOffice or Google Sheets ("CSV injection"). Painfold puts an apostrophe in front of such cells, for example `'=1+1` or `'+43 664 1234567`, so spreadsheets show them as text. Plain numbers such as `-12,50` are left alone. If you process the file with other tools, remove a leading apostrophe where you need the original value.

**The cleaning report** (`<name>_cleaning-report.txt`) goes with it: the file names, the number of rows, the date, the Painfold version, how many values of each type were replaced, what was not reviewed, kept or left out, and the limits of automatic detection.

The list of original values behind each placeholder is never exported. It stays in the browser tab and is gone when you close it.

## Performance

A 5,000-row file is cleaned in about 1.5 seconds: import, column step, detection, review and export, clicked straight through in a real browser. Stage 1 asks for under 10 seconds on a normal laptop.

| Step | Time |
| --- | ---: |
| Import (read and parse the file) | 0.2–0.3 s |
| Find personal data and open the review | 0.9–1.2 s |
| Export the cleaned file | 0.1–0.2 s |
| **Total** | **1.2–1.6 s** |

Measured with `npm run bench` (three runs) on an Apple M3 Pro with 18 GB of memory, macOS 26.7, headless Chromium from Playwright 1.65, using a generated 5,000-row file. The same test runs in CI on every pull request with a 20-second limit, since shared runners are slower.

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
npm run bench        # time a 5,000-row file from import to download
npm run licenses     # fail on dependency licenses outside the allowlist
```

Run `npm run generate` before `npm run test:e2e`. The first time, install the test browser with `npx playwright install chromium`.

Every end-to-end test fails if the page contacts any origin other than the app itself.

### Test data

All test data is fake and generated: see [data/README.md](data/README.md) for what is in it and where each kind of value comes from. Never add real customer data to the repository.

### Continuous integration

Every pull request runs three jobs: lint, typecheck, unit tests and the static build; end-to-end tests; and a dependency check (`npm audit --audit-level=high` and the license allowlist). All must pass before review.

### Security headers

`deploy/headers.ts` is the single source of truth for the Content-Security-Policy and the other security headers.

- `npm run generate` builds the site, then `scripts/apply-csp.ts` adds the full policy to every page as a `<meta>` tag, with hashes of that build's inline scripts. It also fails the build if any page or stylesheet references another origin.
- Static headers (framing, `nosniff`, referrer, permissions, and the full policy for app files and Web Workers) come from `headersFor()`. The local preview server sends them, so the end-to-end tests run under the real policy.
- `vercel.json` is generated from the same file with `npm run headers:vercel`; a unit test fails if it is out of date.

### Dependency updates

Dependabot opens one weekly pull request with grouped minor and patch updates, a separate pull request for each major update, and weekly updates for the pinned GitHub Actions.

SheetJS (XLSX import) is installed from the official SheetJS tarball, not the npm registry, so Dependabot does not see it. Check https://cdn.sheetjs.com for new versions and security notes by hand, at least before each release.

### Dependency licenses

`npm run licenses` allows only permissive licenses: MIT, Apache-2.0, ISC, BSD-2-Clause, BSD-3-Clause, 0BSD, BlueOak-1.0.0, CC0-1.0 and Python-2.0. Three more are allowed for specific build-time packages:

- MPL-2.0: `lightningcss`, the CSS compiler behind Tailwind, used unmodified.
- CC-BY-4.0 and CC-BY-3.0: data packages (`caniuse-lite`, `spdx-exceptions`).

`tosource` is excluded by exact version because its `package.json` has no license field; its LICENSE file is the permissive zlib license. A new version is checked again.

### Dependency install scripts

npm 11 does not run dependency install scripts unless they are allowed. The `allowScripts` field in `package.json` records the decision for each package that has one:

- `esbuild`: denied. Its postinstall only verifies the platform binary, which npm already installs as an optional dependency.
- `fsevents`: denied. It ships prebuilt; the script is a build-from-source fallback.

If a new dependency brings an install script, `npm install` warns about it. Review it with `npm install-scripts ls`, then allow or deny it explicitly.

## License

Code: [MIT](LICENSE).

Fonts in `app/assets/fonts/` (Geist and Geist Mono, by Vercel) are self-hosted under the SIL Open Font License 1.1; each folder contains its license.
