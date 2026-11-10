# Painfold

Find what hurts your customers, without exposing who they are.

Painfold turns customer feedback into an evidence-backed customer profile: the jobs customers are trying to get done, their pains and their gains. Personal data is removed in your own browser before any AI sees it, including German-language and Austrian data. The interface is in English and German ([painfold.vercel.app/de](https://painfold.vercel.app/de)).

**[Try it at painfold.vercel.app](https://painfold.vercel.app)**, with your own file or the built-in sample of 200 made-up support tickets.

![Painfold cleaning the sample file: the column step, finding personal data, reviewing values by value and by row, and the download step](docs/media/demo.gif)

## What v0.1 does

Removes personal data from a CSV or XLSX file in your browser, and lets you download the cleaned file.

- Finds email addresses, phone numbers (Austrian, German and international), IBANs, card numbers, Austrian social security numbers (SV-Nummer), VAT IDs, links, IP addresses, dates of birth, street addresses and postcodes, in German and English.
- You choose per column what is checked, kept as is or dropped, then review every finding by value or by row, and mark anything that was missed.
- The same value always gets the same placeholder, such as `[EMAIL_3]`.

Names and places follow in v0.2, finding customer jobs, pains and gains in v0.3. See the [roadmap](ROADMAP.md) and the [changelog](CHANGELOG.md).

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/media/review-dark.png">
  <img alt="The review step: values grouped by type on the left, the selected value with Remove and Keep on the right, and the rows it appears in" src="docs/media/review-light.png">
</picture>

<details>
<summary>More screenshots, in light and dark</summary>

| | Light | Dark |
| --- | --- | --- |
| Start | ![Start screen, light](docs/media/start-light.png) | ![Start screen, dark](docs/media/start-dark.png) |
| Columns | ![Column step, light](docs/media/columns-light.png) | ![Column step, dark](docs/media/columns-dark.png) |
| Review | ![Review step, light](docs/media/review-light.png) | ![Review step, dark](docs/media/review-dark.png) |

</details>

## Privacy

- Your file is never uploaded. It stays in your browser, and an end-to-end test checks that no request leaves it while you import, check and download.
- No cookies, no analytics, no tracking. The only things Painfold stores are your theme choice (Light or Dark, under `painfold-theme`; choosing System removes it) and your language choice (`painfold-language`), both in `localStorage`.
- From v0.3, when analysis arrives: nothing is sent to an AI until you have reviewed what was removed, and the AI is your choice (your own API key or a local model).

## What you download

- **The cleaned file** (`<name>_cleaned.csv`): only your data, with dropped columns left out and every removed or unreviewed finding replaced by its placeholder. UTF-8 with a byte order mark, same delimiter as the original.
- **Formula protection:** cells that start with `=`, `+`, `-`, `@`, a tab or a carriage return get an apostrophe in front (`'=1+1`), so spreadsheets show them as text instead of running them ("CSV injection"). Plain numbers such as `-12,50` are left alone. Remove the apostrophe if another tool needs the original value.
- **The cleaning report** (`<name>_cleaning-report.txt`): what was replaced by type and count, what was kept, not reviewed or left out, the date, the Painfold version and the limits of automatic detection.

The list of original values behind each placeholder is never exported; it is gone when you close the tab.

## Accuracy and speed

Detection is measured per data type and language, on generated messages and on hand-written hard cases, and checked in CI. On the hard cases nothing that only looks like personal data is removed, apart from one known case, and the known misses are listed. A 5,000-row file is cleaned in about 1.5 seconds. Numbers, method and known gaps: [docs/accuracy.md](docs/accuracy.md).

Automatic detection can miss personal data, names in particular until v0.2. Review the results before sharing the cleaned file.

## Run it locally

Requires Node 24 (pinned in `.nvmrc`).

```sh
nvm use
npm install
npm run dev
```

Tests, the build, CI, security headers, hosting and dependency policies, including why some dependency install scripts are denied: [docs/development.md](docs/development.md).

## License

Code: [MIT](LICENSE). Fonts in `app/assets/fonts/` (Geist and Geist Mono, by Vercel) are self-hosted under the SIL Open Font License 1.1; each folder contains its license.
