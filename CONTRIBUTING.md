# Contributing

Thanks for your interest in Painfold. Issues and pull requests are welcome. Questions and ideas go to [Discussions](https://github.com/akojif/painfold/discussions) ([Q&A](https://github.com/akojif/painfold/discussions/categories/q-a), [Ideas](https://github.com/akojif/painfold/discussions/categories/ideas)). Security and privacy problems are reported privately: see [SECURITY.md](SECURITY.md).

## Never use real personal data

This applies to tests, fixtures, screenshots, issues, discussions and pull requests:
- Use invented names, `example.com` addresses, test IBANs and invented feedback.
- Never add real customer data to the repository, and never paste it into an issue.
- To show a problem, write an invented example with the same pattern.

[data/README.md](data/README.md) describes the test data.

## Setup

Requires Node 24 and npm 11. The version is pinned in `.nvmrc`.

```sh
nvm use
npm install
npx playwright install chromium   # once, for the end-to-end tests
npm run dev                       # local development server
```

## Check your change

```sh
npm run verify
```

This runs what CI runs: lint, typecheck, unit tests, the build, the name model tests, the end-to-end tests and the name accuracy check, then prints one summary. It exits with an error if any step fails. Read the summary, not the last lines of a test run.

Every end-to-end test fails if the page contacts any site other than Painfold itself. More commands, and how CI is set up: [docs/development.md](docs/development.md).

## Pull requests

- **Before you start:** check the [roadmap](ROADMAP.md) and the open issues. For anything bigger than a small fix, open an issue first so we can agree on the approach. Issues labelled [good first issue](https://github.com/akojif/painfold/labels/good%20first%20issue) are a good place to begin.
- **Branches and pull requests:**
  - One change per branch (`feat/…`, `fix/…`, `docs/…`) and per pull request, small enough to review in one sitting.
  - The pull request template asks what changed and why, how it was tested, screenshots for any interface change (with invented data only), and the issue it closes. Write "Closes #n" when it finishes an issue.
  - The maintainer reviews and merges.
- **Tests:** CI must pass: lint, typecheck, unit tests, end-to-end tests, the build, the name accuracy check, and the dependency audit and license check.
- **Privacy is the product:** a change must not:
  - upload the file;
  - add analytics or third-party scripts;
  - send anything to an AI before the person has reviewed it.

  See [docs/privacy.md](docs/privacy.md).
- **Dependencies:** open an issue before adding one, with its license.

## Interface text, English and German

- Every piece of interface text is in `i18n/locales/en/` and `i18n/locales/de/`. A change that adds or changes text updates both.
- The English interface uses American English.
- New or changed German text is listed in [#110](https://github.com/akojif/painfold/issues/110), where a native speaker reviews it before release. If you speak German, reviewing those strings is a welcome contribution.
