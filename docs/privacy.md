# Privacy, storage and downloads

## Privacy

- Your file is never uploaded. It stays in your browser, and an end-to-end test checks that no request leaves it while you import, check and download.
- No cookies, no analytics, no tracking.
- Analysis: nothing is sent to an AI until you have reviewed what was removed, only the cleaned text is sent, and the AI is your choice (your own API key, sent straight from your browser to the provider, or a local model with Ollama). See [ai-providers.md](ai-providers.md).

## What is stored in your browser

- **Your theme choice** (Light or Dark), in `localStorage` under `painfold-theme`. Choosing System removes it.
- **Your language choice**, in `localStorage` under `painfold-language`.
- **The name model**, only if you download it (152 MB), in Cache Storage under `painfold-name-model`. You can remove it in Painfold.
- **Each page's scroll position for the current tab**, kept by the browser routing library (vue-router) in `sessionStorage` under `vue-router:scroll`: only the app's page paths and numbers. It is gone when you close the tab. An end-to-end test fails if anything else is stored there.

Never your file, its values or your findings.

## What you download

- **The cleaned file** (`<name>_cleaned.csv`): only your data, with dropped columns left out and every removed or unreviewed finding replaced by its placeholder. UTF-8 with a byte order mark, same delimiter as the original.
- **Formula protection:** cells that start with `=`, `+`, `-`, `@`, a tab or a carriage return get an apostrophe in front (`'=1+1`), so spreadsheets show them as text instead of running them ("CSV injection"). Plain numbers such as `-12,50` are left alone. Remove the apostrophe if another tool needs the original value.
- **The cleaning report** (`<name>_cleaning-report.txt`): what was replaced by type and count, what was kept, not reviewed or left out, the date, the Painfold version and the limits of automatic detection.

The list of original values behind each placeholder is never exported; it is gone when you close the tab.
