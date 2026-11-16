# Contributing

Thanks for your interest in Painfold. Issues and pull requests are welcome.

- **Before you start:** check the [roadmap](ROADMAP.md) and the open issues. For anything bigger than a small fix, open an issue first so we can agree on the approach.
- **Branches and pull requests:** one change per branch (`feat/…`, `fix/…`, `docs/…`) and per pull request, small enough to review in one sitting. The pull request template asks what changed and why, how it was tested, screenshots for any interface change, and the issue it closes.
- **Tests:** CI runs lint, typecheck, unit tests, end-to-end tests and the build, and they must pass. How to run them locally is in [docs/development.md](docs/development.md).
- **Test data is fake only:** invented names, `example.com` addresses, test IBANs. Never add real customer data to the repository. [data/README.md](data/README.md) describes the test data.
- **Privacy is the product:** a change must not upload the file, add analytics or third-party scripts, or send anything to an AI before the person has reviewed it. See [docs/privacy.md](docs/privacy.md).
- **Dependencies:** open an issue before adding one, with its license.
