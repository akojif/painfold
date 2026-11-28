# Feedback, and what is measured

## No analytics, no tracking

Painfold doesn't measure how people use it:
- no analytics, tracking scripts or cookies;
- no error reporting service;
- no logs of its own.

How that's enforced:
- The Content-Security-Policy only allows scripts from the site itself, so a tracking script couldn't even load.
- An end-to-end test fails if any cookie is set, and every end-to-end test fails if the page contacts another site. See [How we prove it](privacy.md#how-we-prove-it).

So the only way to know what works, what doesn't and what's missing is when you tell us.

## What the host sees

painfold.com is served by Cloudflare. Like any web host, it sees each request for the site's files: your IP address, the page addresses, and the headers your browser sends (such as its user agent and language). It never sees your file, which isn't sent.

What Painfold has switched off:
- **Worker logs:** `observability` is off in `wrangler.jsonc`. The Worker serves only the name model and writes no logs.
- **Wrangler's usage metrics:** `send_metrics` is false. This covers the deploy tool, not visitors.
- **Network Error Logging** for painfold.com, so browsers don't report network errors to Cloudflare. A test checks it.
- **Cloudflare Web Analytics** isn't added to the site. Its script would be blocked by the policy above anyway.

Cloudflare still processes request data, mainly IP addresses, for running and protecting its network, under its own [privacy policy](https://www.cloudflare.com/privacypolicy/) (see also its [GDPR FAQ](https://www.cloudflare.com/trust-hub/gdpr/)). Painfold doesn't use that data.

## How to give feedback

- **Questions** ("does Painfold fit my case?", "why was this removed?"): [Discussions, Q&A](https://github.com/akojif/painfold/discussions/categories/q-a).
- **Ideas and general feedback:** [Discussions, Ideas](https://github.com/akojif/painfold/discussions/categories/ideas).
- **Something broken, or personal data that was missed or wrongly removed:** [open an issue](https://github.com/akojif/painfold/issues/new/choose) with the template.
- **A privacy leak or security problem:** report it privately, as described in [SECURITY.md](../SECURITY.md), not in public.

**Never paste real personal data** anywhere: not in issues, discussions or attached files. Use an invented example with the same pattern, such as `anna.example@example.com` or `+43 664 0000000`.
