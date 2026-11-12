# AI providers: what was checked, and the decision

Stage 3 sends cleaned feedback text to an AI the user chooses: their own API key, sent straight from the browser to the provider, or a local model with Ollama. There is no proxy, so a provider can only be supported if a page on https://painfold.com can call it directly. This page records what was checked for slice 1 (#123), on 12 and 13 November 2026, how, and what follows from it.

## Decision

- **First:** Anthropic and Ollama. **Then:** OpenAI, then Mistral (the EU option). Mistral's API may use requests for training unless the account switches it off, so before the first request to Mistral the consent step asks the person to confirm that "Anonymous improvement data" is off (decided 13 November 2026, see below).
- The default model is Claude Haiku 5.5 until the evaluation's dev baseline decides (#129).
- The Python engine (#69) is not needed for v0.3: Ollama covers "nothing leaves the machine" without a server.

## Browser access

`npm run check:providers` (`scripts/check-providers.ts`) opens a Chromium page at the production origin, `https://painfold.com`, served locally by Playwright, and sends each provider one request: the word "Hello", with a fake key. The browser only lets the page read the answer, even an error, if the provider allows calls from that origin (CORS), so a fake key is enough. No feedback text and no real key are involved; with a real key in `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` or `MISTRAL_API_KEY`, the same script also checks a successful answer.

Result on 13 November 2026:

| Provider | Endpoint | From https://painfold.com |
|---|---|---|
| Anthropic | `https://api.anthropic.com/v1/messages` | Works with the header `anthropic-dangerous-direct-browser-access: true` (a 401 with a fake key, a 200 with a real key); blocked without it. An organisation can switch browser calls off for its keys; the app must explain that error. |
| OpenAI | `https://api.openai.com/v1/chat/completions` | Works (`access-control-allow-origin: *`) |
| Mistral | `https://api.mistral.ai/v1/chat/completions` | Works (`access-control-allow-origin: *`) |
| Mistral, EU | `https://api.eu.mistral.ai/v1/chat/completions` | Works (`access-control-allow-origin: *`) |

With a real key, Anthropic returned a successful answer (status 200) on 13 November 2026, run by Francis. OpenAI and Mistral are checked with a real key when they ship: run the script with the key set; nothing is printed or stored.

### Ollama (local)

Ollama only accepts browser calls from `127.0.0.1` and `0.0.0.0` by default; other origins must be added with `OLLAMA_ORIGINS`, for example `OLLAMA_ORIGINS=https://painfold.com` ([Ollama FAQ](https://docs.ollama.com/faq)). The same script calls a running Ollama (0.40.16, model `llama3.2:3b`) from a page at `https://painfold.com` in three browser engines. Result on 13 November 2026:

| Browser engine | Ollama with `OLLAMA_ORIGINS=https://painfold.com` | Ollama with its defaults |
|---|---|---|
| Chromium (Chrome, Edge) | Works once the person allows **local network access** for the site; Chrome asks once (from Chrome 142). Blocked until then. | Blocked |
| Firefox | Works | Blocked |
| WebKit (Safari) | **Blocked**: an https page may not call `http://localhost` ("requested insecure content … blocked") | Blocked |

So with Ollama, painfold.com works in Chrome, Edge and Firefox, after one setting in Ollama and, in Chrome and Edge, one permission. It does not work in Safari; for Safari, the way is Painfold served from `http://localhost` itself (the Docker image, #75). The settings screen (#124) must explain both steps and say that Safari is not supported for Ollama.

## Terms: training, retention, location

From the providers' own pages unless noted, as read on 12 and 13 November 2026. These change; re-check before each release and show the current terms in the consent step (#125).

| Provider | Training on API data | Retention | Location |
|---|---|---|---|
| Anthropic | Not by default (Commercial Terms) | Deleted within 30 days; zero retention only by agreement (secondary sources; confirm on Anthropic's privacy centre before release) | Not EU by default |
| OpenAI | No: "data sent to the OpenAI API is not used to train or improve OpenAI models" ([Your data](https://developers.openai.com/api/docs/guides/your-data)) | Abuse-monitoring logs "retained for up to 30 days"; zero retention by approval | EU residency only by approval, together with zero retention or modified abuse monitoring |
| Mistral | **Depends on an account setting.** Commercial Terms of Service §4.2 (effective 25 September 2026): Mistral "will not use Customer Data or Outputs to train its artificial intelligence models except" where a product's opt-in or opt-out default applies, and for Feedback. Data Processing Addendum §2.3 (effective 27 July 2026): Mistral may train as controller "unless Customer is or has opted-out of training". The [help article](https://help.mistral.ai/en/articles/455207-can-i-opt-out-of-my-input-or-output-data-being-used-for-training) names the opt-out for "Mistral Studio and API" (Admin panel, Privacy, "Anonymous improvement data") but not its default. | Not stated in the terms; secondary sources say about 30 days; zero retention by approval | EU by default (Paris); a separate EU endpoint exists |
| Ollama | Nothing leaves the machine: "We don't see your prompts or data when you run locally" ([Ollama FAQ](https://docs.ollama.com/faq)) | None | The user's machine |

**Mistral, decided.** Painfold cannot see a Mistral account's setting. Before the first request to Mistral, the consent step asks the person to confirm that "Anonymous improvement data" is switched off, with the exact path (Admin panel, Privacy). Rejected: a warning only (too easy to click past), and waiting until Mistral states the API default (no EU-by-default option until then). Re-check Mistral's help article before Mistral ships; if it states the API default as off, the confirmation can become a note.

## CSP and network design (for slice 2, #124)

- `connect-src` names exactly the endpoints of the providers that ship, nothing else: `'self'`, then `https://api.anthropic.com` and `http://localhost:11434 http://127.0.0.1:11434` in slice 2; `https://api.openai.com`, `https://api.mistral.ai` and `https://api.eu.mistral.ai` when those providers ship. The unit test that requires "no policy names a host" becomes a test that the policy names exactly these hosts. Only Ollama's default port is allowed; another port needs a change to the policy, which keeps the local network closed to the page otherwise.
- The code sends only to the provider the user chose; a test checks it.
- AI requests run from the page, so the documents' policy (the `<meta>` tag and `_headers`) is what changes; the workers' policy stays `'self'`.
- "What leaves your browser" cannot read sizes of cross-origin requests from the browser's Resource Timing (it reports 0 bytes without `Timing-Allow-Origin`), so AI requests are logged by Painfold's own request code: destination, time and the bytes it sent and received.
