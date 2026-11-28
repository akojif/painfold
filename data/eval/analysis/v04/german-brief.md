# v0.4 German test texts: the brief

Approved by Francis on 2026-11-21 and committed with the v0.4 plan in [../runs-log.md](../runs-log.md). **It is never changed after prompt v2 work starts.**

It's used only if the GermEval 2017 data can't be used: no usable answer from its maintainers by 24 November 2026, end of day. `scripts/eval-v04-generate.ts` sends it to Mistral Large. The code holds the exact slot plan and messages (`scripts/eval-v04.ts`), and a unit test checks them against this brief. The writing model never sees Painfold's analysis instructions, the v0.3 texts or any labels.

- **Who wrote this brief:** Claude Opus 5.5, the agent that will also tune prompt v2. So the tuner knows the topics and the shares below, but never the texts. That's a known limitation, stated on the Accuracy page.
- **A stress test, not a natural mix (design note):**
  - The slot mix deliberately over-represents the v0.3 boundary cases: praise only, wishes phrased as a question or as something missing, texts with nothing to find, and several goals in one text.
  - So the German set is a stress test, unlike the English CFPB texts, which are a natural mix.
  - **German and English scores must not be compared with each other.** Only the within-language comparison of prompt v2 against prompt v1 counts.

## 1. The slot plan (fixed in code, seeded)

`buildSlots()` builds 100 slots before any request, with the seed `20261121`. Each list below is expanded to its counts and shuffled on its own, so every share is exact, not left to the model.

**Channel:**

| Channel | Texts |
|---|---|
| Support message (e-mail or contact form) | 30 |
| App store review | 25 |
| Chat message to customer service | 25 |
| Survey comment (after "How likely are you to recommend us?") | 20 |

**Length:**

| Band | Texts |
|---|---|
| short: up to 120 characters | 25 |
| medium: 120 to 600 characters | 50 |
| long: 600 to 1,500 characters | 25 |

**Language variety:**

| Variety | Texts |
|---|---|
| German usage (Germany) | 50 |
| Austrian usage (Erlagschein, Bankomat, KSV, Jänner …) | 35 |
| German with English mixed in | 15 |

**Topic:** each of these 25 topics is used 4 times:
1. logging in to online banking;
2. approving payments in the app (TAN, push approval);
3. blocking and replacing a card;
4. a transfer that takes too long;
5. instant transfers and their fees;
6. account fees going up;
7. overdraft interest;
8. how long a loan application takes;
9. advice on a mortgage;
10. a branch closing;
11. cash machines (location, availability, fees);
12. the account-switching service;
13. tax certificates (Germany: annual tax statement; Austria: capital gains tax);
14. securities account and savings plan;
15. paying by phone (Apple Pay, Google Pay);
16. using the credit card abroad;
17. phishing and suspected fraud;
18. waiting time on the hotline;
19. the chatbot;
20. a change of address;
21. a joint account;
22. a children's or youth account;
23. statements as PDF and the electronic mailbox;
24. an app update that changed something;
25. accessibility (font size, screen readers).

**Special feature:** exactly one per slot, so the shares stay exact.

| Special feature | Texts |
|---|---|
| ordinary: something doesn't work or bothers the customer | 40 |
| a wish phrased as a question or as something missing | 15 |
| praise only, no wish | 10 |
| several goals in one text | 15 |
| nothing to find: no goal, no problem, no wish | 10 |
| already cleaned: one to three placeholders | 10 |

**Tone:** factual, annoyed, friendly or ironic, drawn by the seed for each slot.

## 2. The request (per batch of 5 slots, in German)

**Placeholders (fix 1, decided):**
- Only the "already cleaned" slots use placeholders such as `[NAME_1]` or `[IBAN_1]`.
- **All other slots contain no personal data at all:** no names, no account numbers, no addresses, no e-mail addresses, no phone numbers, and no placeholders.
- The request and the checks say the same thing.

System message:

> Du schreibst realistische, erfundene Kundenrückmeldungen an eine Bank, für einen Testdatensatz. Die Bank heißt „Hafenbank“; es ist eine erfundene Bank. Schreibe jede Rückmeldung so, wie eine echte Kundin oder ein echter Kunde sie schreiben würde: mit eigenen Worten, Tippfehlern, wo sie natürlich sind, ohne Überschrift, ohne Erklärung und ohne Antwort der Bank.
>
> Regeln:
> - Erfinde keine echten Personen, Firmen außer der Hafenbank, Kontonummern oder Adressen. Nenne keine echte Bank.
> - Nur Aufträge mit der Besonderheit „Enthält ein bis drei Platzhalter“ enthalten Platzhalter wie [NAME_1], [IBAN_1], [EMAIL_1], [PHONE_1] oder [ADDRESS_1], an der Stelle, wo personenbezogene Daten stünden.
> - Alle anderen Rückmeldungen enthalten keinerlei personenbezogene Daten: keine Namen, keine Kontonummern, keine Adressen, keine E-Mail-Adressen, keine Telefonnummern und auch keine Platzhalter.
> - Halte dich genau an Kanal, Länge, Sprachvariante, Thema, Ton und Besonderheit jedes Auftrags.
> - Jede Rückmeldung steht für sich; sie wiederholen einander nicht.
>
> Antworte nur mit JSON in dieser Form: {"texts": [{"slot": <Nummer>, "text": "<Rückmeldung>"}]}

**User message:** "Schreibe 5 Rückmeldungen." It's followed by one line per slot: "Auftrag <slot>: Kanal: … Länge: … Sprachvariante: … Thema: … Ton: … Besonderheit: …". The special-feature wording:

| Feature | Wording |
|---|---|
| ordinary | "Etwas funktioniert nicht oder stört; oft wird klar, was die Person erreichen wollte." |
| wish as a question | "Ein Wunsch, aber als Frage oder als Fehlen formuliert, nicht als direkte Bitte." |
| praise only | "Nur Lob, kein Wunsch und kein Problem." |
| several goals | "Die Person will zwei oder drei verschiedene Dinge erledigen." |
| nothing to find | "Eine rein sachliche Nachricht ohne Problem, ohne Wunsch und ohne Ziel, etwa eine Bestätigung." |
| already cleaned | "Enthält ein bis drei Platzhalter für personenbezogene Daten, etwa [NAME_1] oder [IBAN_1]." |

**Settings (recorded in the run log):**
- model `mistral-large-latest`, with the dated version Mistral returns recorded;
- temperature 0.8;
- JSON mode;
- 20 requests of 5 slots;
- first a 5-text dry run (`--dry-run`), whose texts are discarded unread and whose token counts are reported.

## 3. Checks, without anyone reading the texts

Each text is checked for its slot (`checkText`):
- **present:** a text exists for the slot;
- **length:** within its band, with ±20 % tolerance;
- **placeholders:** one to three in "already cleaned" slots, and **none in any other slot**;
- **no personal data:** Painfold's detectors find none outside placeholders;
- **no real bank:** none from a fixed list;
- **no duplicate:** not identical or near-identical to an accepted text.

**Drops (fix 3, decided):**
- A failing text is regenerated once for its slot. If it fails again, the slot is dropped.
- **The script reports regenerated and dropped slots by language variety and by special feature, as counts only.**
- **If any variety or feature loses more than 2 of its slots, it stops**: nothing is written, Francis is told, and labelling doesn't start.

**Output:** the texts go into the git-ignored `data/eval/analysis/v04/private/` and the German labelling sheet there. No text is printed.
