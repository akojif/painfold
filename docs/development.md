# Development

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
npm run eval         # detection recall and precision; --write updates the numbers in docs/accuracy.md
```

Run `npm run generate` before `npm run test:e2e`. The first time, install the test browser with `npx playwright install chromium`.

Every end-to-end test fails if the page contacts any origin other than the app itself.

## Translations

The interface is in English and German. English lives at `/`, German under `/de/` (`prefix_except_default`), so every page is prerendered in both languages and German pages can be shared and indexed; each page links to the other language with `hreflang`.

- Every change adds both languages: `i18n/locales/en.json` and `i18n/locales/de.json`. `tests/unit/locales.test.ts` fails if a message exists in one language only, or if placeholders or plural forms differ.
- German is plain and uses "Sie". The German locale is `de-AT`, so numbers, lists and any written dates follow Austrian conventions ("Jänner"). Dates in the cleaning report stay ISO (2026-11-10), which reads the same in both languages.
- The language is chosen like this: an explicit `/de/` address always wins; only the root `/` follows a saved choice (`painfold-language` in `localStorage`) or, without one, the browser language, in a small inline script before first paint. The switch in the header saves the choice and moves to the same page in the other language inside the app, so an open file and the review are kept. No cookie is set.
- Known limit: a missing address under `/de/` is answered with the single prerendered 404 page, which is in English until the app has loaded, then German.

### German texts to review before release

These are where precise wording matters most; a native speaker should review them before each release that changes them:

- The privacy notice and the start screen's privacy line (`privacy.notice`, `start.privacy`, `start.dropOverlay`).
- The limits notice (`review.limits`), also used in the cleaning report.
- The "What leaves your browser" panel (`network.none`, `network.explain`, `network.allOwn`, `network.foreign`).
- Column warnings and reasons (`columns.warning`, `columns.checkInstead`, `columns.masked`, `columns.reason.*`, `columns.help`).
- What the download contains and what is kept (`download.mapStays`, `download.reportExplain`, `download.notReviewed`) and the cleaning report (`report.*`).
- Terms chosen for this product: the column roles "Prüfen / Unverändert / Weglassen", "Treffer" for a finding, and "UID-Nummer" for VAT ID.

Open questions for the reviewer:

- "Aufgaben, Probleme und Wünsche" for jobs, pains and gains, or keeping the canvas terms "Jobs, Pains und Gains", which German-speaking product teams often use?
- "Kunden", "Kund:innen" or "Kundschaft" in the headline, the roadmap and elsewhere?

The review happens before the v0.2.0 release.



All test data is fake and generated: see [data/README.md](../data/README.md) for what is in it and where each kind of value comes from. Never add real customer data to the repository.

## Continuous integration

Every pull request runs three jobs: lint, typecheck, unit tests, the detection accuracy (shown in the job summary) and the static build; end-to-end tests; and a dependency check (`npm audit --audit-level=high` and the license allowlist). All must pass before review.

## Security headers

`deploy/headers.ts` is the single source of truth for the Content-Security-Policy and the other security headers.

- `npm run generate` builds the site, then `scripts/apply-csp.ts` adds the full policy to every page as a `<meta>` tag, with hashes of that build's inline scripts. It also fails the build if any page or stylesheet references another origin.
- Static headers (framing, `nosniff`, referrer, permissions, and the full policy for app files and Web Workers) come from `headersFor()`. The local preview server sends them, so the end-to-end tests run under the real policy.
- `vercel.json` is generated from the same file with `npm run headers:vercel`; a unit test fails if it is out of date.

## Hosting

The live site is a static build on Vercel. `vercel.json` (generated from `deploy/headers.ts`) sets the install and build commands, so Vercel runs the same `npm run generate` as CI, including the CSP check, and serves `.output/public` with the security headers. No Vercel framework preset, server functions or analytics are used.

- `main` deploys to https://painfold.vercel.app; every pull request gets a preview deployment.
- Unknown addresses get the 404 page with status 404. The build removes Nuxt's `200.html` single-page fallback (`scripts/remove-spa-fallback.ts`), which hosts would otherwise serve for every unknown path with status 200; every page is prerendered, so it is not needed.
- Turn off the Vercel Toolbar for preview deployments (Project Settings, General): it injects a script from another origin, which the CSP blocks.
- Any static host works the same way: serve `.output/public` with the headers from `headersFor()`.

## Dependency updates

Dependabot opens one weekly pull request with grouped minor and patch updates, a separate pull request for each major update, and weekly updates for the pinned GitHub Actions.

SheetJS (XLSX import) is installed from the official SheetJS tarball, not the npm registry, so Dependabot does not see it. Check https://cdn.sheetjs.com for new versions and security notes by hand, at least before each release.

## Dependency licenses

`npm run licenses` allows only permissive licenses: MIT, Apache-2.0, ISC, BSD-2-Clause, BSD-3-Clause, 0BSD, BlueOak-1.0.0, CC0-1.0 and Python-2.0. Three more are allowed for specific build-time packages:

- MPL-2.0: `lightningcss`, the CSS compiler behind Tailwind, used unmodified.
- CC-BY-4.0 and CC-BY-3.0: data packages (`caniuse-lite`, `spdx-exceptions`).

`tosource` is excluded by exact version because its `package.json` has no license field; its LICENSE file is the permissive zlib license. A new version is checked again.

## Dependency install scripts

npm 11 does not run dependency install scripts unless they are allowed. The `allowScripts` field in `package.json` records the decision for each package that has one:

- `esbuild`: denied. Its postinstall only verifies the platform binary, which npm already installs as an optional dependency.
- `fsevents`: denied. It ships prebuilt; the script is a build-from-source fallback.

If a new dependency brings an install script, `npm install` warns about it. Review it with `npm install-scripts ls`, then allow or deny it explicitly.
