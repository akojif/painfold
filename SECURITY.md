# Security and privacy issues

Painfold's promise is that personal data stays in your browser. If you find a way it doesn't, please tell us privately first, so it can be fixed before it's public.

## How to report

Use GitHub's private vulnerability reporting: open the repository's [Security tab](https://github.com/akojif/painfold/security) and choose **Report a vulnerability**, or go straight to the [new advisory form](https://github.com/akojif/painfold/security/advisories/new). Only you and the maintainer can see the report.

Please don't open a public issue, discussion or pull request for a security or privacy problem.

**Never include real personal data**, not in the report and not in an attached file. Use an invented example with the same pattern, such as `anna.example@example.com`, `+43 664 0000000`, or a test IBAN such as `DE89 3704 0044 0532 0130 00`.

A good report says:
- what happens, and what you expected instead;
- the steps to reproduce, with invented data;
- the browser and operating system, and the address you used (painfold.com, a preview address, or a local build with its commit).

## What counts

- **Personal data leaving the browser unexpectedly.** For example:
  - any request carrying file content, findings or keys to a place other than the AI you chose;
  - anything sent to an AI before you pressed Send, or text that wasn't in the cleaned list you reviewed;
  - a value you removed reaching the AI;
  - data written to browser storage beyond what [docs/privacy.md](docs/privacy.md) lists.
- **Detection bypasses**: a pattern of personal data that should be found by a rule (email, phone, IBAN, card and similar numbers, addresses) but slips through in a way that looks systematic. A single missed name is usually an accuracy issue and fits the public "Missed or wrong detection" template. When unsure, report privately.
- **Prompt injection through feedback text**: text in a file that makes the analysis do something it shouldn't. Examples: changing what is sent, getting a quote that isn't word for word in the cleaned text past the check, or putting instructions into the report.
- **Classic web security issues**: script injection, a weakness in the Content-Security-Policy or security headers, the downloaded file running formulas in a spreadsheet despite the protection described in [docs/privacy.md](docs/privacy.md), or a problem in how the name model is downloaded and checked.

Not in scope here: what an AI provider does with text you chose to send (see its terms, linked in [docs/privacy.md](docs/privacy.md)), and the limits listed under "What Painfold doesn't protect against" in that file. Report those in a public issue if you think the documentation is wrong.

## What to expect

Painfold is maintained by one person, so please allow some time.

- Your report is acknowledged within 7 days, with regular updates in the private report after that: whether it's confirmed, how serious it is, and the plan.
- A fix comes in a new release. Privacy leaks come before anything else.
- When it's fixed, an advisory and a changelog entry are published. You'll be credited, unless you'd rather not be.

There's no bug bounty.

## Supported versions

Only the current version at [painfold.com](https://painfold.com) and the `main` branch get fixes.
