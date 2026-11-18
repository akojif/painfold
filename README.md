# Painfold

Find what hurts your customers, without exposing who they are. **[painfold.com](https://painfold.com)**

![Painfold cleaning the sample file: the column step, downloading the name model once, finding personal data and names, reviewing values by value and by row, and the download step](docs/media/demo.gif)

## What it does

- Removes personal data from a CSV or XLSX file in your browser, in German and English: emails, phone numbers, IBANs, names, places and more.
- You review every finding, by value or by row, and download the cleaned file.
- Analysis: finds your customers' jobs, pains and gains, with an AI you choose. Counts come from code, and every quote is checked word for word.

More in [docs/how-it-works.md](docs/how-it-works.md).

## Privacy

- Your file never leaves your browser. There is no server that receives it.
- No cookies, no analytics, no tracking.
- Only cleaned text is sent to an AI, after you have reviewed it, and only to the one you choose: your own API key or a local model.
- Painfold keeps only your theme and language choice; the browser keeps each page's scroll position for the current tab. Never your file or findings.

Details, including what you download: [docs/privacy.md](docs/privacy.md).

## Accuracy

97 % of test names are removed, and at least 92 % in every name-origin group. In the analysis, Painfold finds 77 % of the pains and 64 % of the gains customers mention under the right theme, and about half of the gains it reports match people's labels; the known weaknesses are listed with the numbers. Numbers, method and known gaps: [painfold.com/accuracy/](https://painfold.com/accuracy/) and [docs/accuracy.md](docs/accuracy.md).

## Run it locally

Requires Node 24 (pinned in `.nvmrc`).

```sh
nvm use
npm install
npm run dev
```

## Links

- [Roadmap](ROADMAP.md) and [changelog](CHANGELOG.md)
- Docs: [development](docs/development.md) (tests, build, CI, hosting, security headers, dependency policies), [accuracy](docs/accuracy.md), [privacy](docs/privacy.md), [AI providers](docs/ai-providers.md)
- [Contributing](CONTRIBUTING.md)
- License: [MIT](LICENSE). The self-hosted fonts in `app/assets/fonts/` (Geist and Geist Mono by Vercel, Sora by the Sora Project Authors) are under the SIL Open Font License 1.1; each folder contains its license.
