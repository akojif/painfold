# Roadmap

Painfold finds what hurts your customers, without exposing who they are.

It turns customer feedback into an evidence-backed customer profile: the jobs customers are trying to get done, their pains and their gains, as used in the Value Proposition Canvas. Personal data is removed in your browser before any AI sees it.

The product ships in stages. Each stage is a release that is useful on its own, so real users can start using it before the next stage exists.

## Principles that guide every decision

1. Your file is never uploaded. Everything that touches feedback runs in the browser.
2. You stay in control. Nothing is sent to an AI until you have reviewed what was removed.
3. Evidence over impressions. Numbers are counted, quotes are real, and uncertainty is shown.
4. Built for European teams. German and English, Austrian and German data formats, GDPR in mind.

## Stage 1: Clean (v0.1)

**Goal:** remove personal data from a feedback file, in the browser, and download the cleaned file. Useful on its own: teams can safely share or analyze feedback with any tool.

**For:** a product manager who has a CSV export of support tickets and wants to pass it on without exposing customers.

Scope:
- Import CSV and XLSX; choose the text column; preview rows.
- Detect emails, phone numbers (AT/DE/international), IBANs, Austrian social security numbers, VAT IDs, credit cards, URLs, IP addresses, dates of birth, street addresses and postcodes.
- Review screen: see every detection highlighted, undo false ones, mark missed ones.
- Consistent placeholders: the same email becomes the same `[EMAIL_3]` everywhere.
- Download the cleaned file as CSV.
- Privacy notice on the start screen and in the footer, plus a "What leaves your browser" panel (see below).

Done when:
- A 5,000-row file is cleaned in under 10 seconds on a normal laptop.
- Detection recall and precision per data type are measured on the evaluation set and published.
- No network request is made while importing, detecting or exporting (verified by an end-to-end test).

## Stage 2: Names (v0.2)

**Goal:** catch the personal data rules can't: people's names and places, in German and English.

Scope:
- Name and place detection with a model that runs in the browser (downloaded once, then cached).
- Warnings for indirect identifiers: job title plus small town, exact ages, rare roles.
- An Accuracy page showing how well each data type is detected.

Done when:
- Name recall on the evaluation set is published and above a target set in Stage 1.
- The model download is explained to the user before it starts, with its size.

## Stage 3: Jobs, pains and gains (v0.3)

**Goal:** answer "what are customers trying to do, what hurts, and what do they wish for?" from the cleaned feedback.

Scope:
- Choose an AI: your own API key (sent directly from your browser to the provider) or a local model with Ollama.
- Tag feedback as customer jobs, pains and gains, with sentiment and type (bug, feature request, praise, question).
- A first report: ranked jobs, pains and gains with counts, share, intensity, and 2–3 real quotes each.

Done when:
- Every count in the report is computed by code from tagged items.
- Every quote is verified to exist word for word in the cleaned feedback.
- The user sees exactly what will be sent, and how many items, before analysis starts.

Option for self-hosters (not required for the stage): **Painfold Engine**, a self-hosted service (Python, Docker) for companies that run Painfold themselves. It runs the AI analysis with a local model through Ollama and can optionally add server-side name detection (Presidio, spaCy). The online demo stays browser-only, so no data ever reaches a server we host. Tracked in #69.

## Stage 4: Report (v0.4)

**Goal:** a report a team can act on in one meeting.

Scope:
- Summary of the three most important findings.
- Segments (by channel, plan, country) and trends over time, when the file has those columns.
- New or growing issues compared with the previous period.
- Opportunities: the strongest pains and gains framed as "How might we…" questions for the team's value map, with a suggested next step. Painfold fills the customer side of the canvas; deciding what to build stays with the team.
- Confidence markers on entries based on few items.
- Privacy report: what was removed, warnings, which AI saw the cleaned data.
- Exports: PDF, Markdown, and a CSV of items tagged with their themes.

## Stage 5: Launch (v1.0)

**Goal:** anyone can try it in 30 seconds and teams can run it themselves.

Scope:
- Demo mode with a fake sample dataset and pre-computed results, no API key needed.
- Docker image for self-hosting with a local model.
- README with a short demo recording, documentation, and the accuracy numbers.

## Later (not planned yet)

- User interview transcripts (TXT, DOCX).
- Comparing two files or two periods side by side.
- Export to Jira and Notion.
- Custom patterns for company-specific identifiers (customer numbers, contract IDs).
- More languages.

## The privacy notice

Shown on the start screen and kept in the footer on every step:

> Your file is never uploaded. It stays in this browser.
> Only the cleaned text you approve is sent to the AI you choose.

"What leaves your browser" panel: a live list of every network request the app makes, with its destination and size. Before analysis it says "No data has left this browser." This makes the promise checkable, not just stated.

Limits notice, shown on the review step and in the exported file's notes:

> Automatic detection can miss personal data. Review the results before sharing the cleaned file. Painfold helps with data protection but is not legal advice and does not by itself make your processing GDPR compliant.