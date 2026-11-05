# Case study: receipt-to-ledger reconciliation

*This system comes from a real finance workflow at a company I currently work at. Company details are withheld; all data in this repository is synthetic, and the user's feedback is paraphrased.*

**In one line:** a month of staff receipts and a card statement become a reconciled ledger and one review queue that puts a person's attention only where judgement is needed. The model reads receipts; deterministic, tested code decides everything about money; a person approves. On the evaluation month it made **no wrong automatic matches** where a single chat prompt got **16%** wrong, and a newcomer closed the 40-receipt month in **9 minutes**.

## 1. User and problem

**The user** is the Accounting user who closes each month for a small company with an AUD base currency, staff paying on company and personal cards, and many software subscriptions billed in USD. A finance lead sets the policy (categories, the sign-off threshold).

**The job:** *when a month ends, turn a pile of receipts and a card or bank statement into a reconciled ledger where every exception has been looked at, so that the month-end report is complete and correct without checking every row by hand.*

## 2. Existing workflow and bottleneck

The evidence comes from two documents the Accounting user wrote, summarised here without names or figures: a redesign proposal (September) and a structured acceptance test of the company's finance tool (October: 18 scripted tests, 10 passed).

- **The bottleneck:** pairing each receipt with its payment, item by item. In the user's words, "pick a request, hunt for the charge"; they asked for "same amount & date, one click". A month later, matching was still a manual dropdown (finding E1).
- **Silent errors from rules in the wrong place:** AUD receipts were sent through currency conversion, so recorded spend showed $0.00 (E2); a third of spend was filed as "Other" (P3); open items showed as both "Approved" and "Awaiting match" (P5).
- **Rework from naive checks:** clean digital receipts rejected as "blurry", portrait phone scans rejected by a fixed size (E5).
- **The user's own design request:** one list, ordered "amount differences, then approvals, then matches" (E6).

The interview was answered second-hand (the Accounting user was unavailable) and is labelled that way throughout.

**Baselines, on the same 20 receipts:**

| | B0: the current manual process | B1: one ChatGPT prompt, run 3 times | System (`final`) |
|---|---|---|---|
| Time | 20–40 min for 40 receipts (a **labelled estimate**, not measured) | 5 min 35 s mean for 20 (about 11 min for 40, extrapolated) | about 8 min (builder) and 9 min (proxy) for 40 |
| Wrong matches | not measured | **3 of 19 (16%), in every run** | **0 of 14** |
| "No payment found" caught | not measured | 0 of 1, in every run | 1 of 1 |
| Category, extraction, match recall | not measured | 100% | 100% |

B1 is strong on clean synthetic receipts: it reads, categorises, and finds payments as well as the system. What it gets wrong is the ledger: in every run it paid one $312 charge to an original receipt *and both its duplicates*, and paired a hotel receipt that has no payment with a different hotel stay's charge. Its time is not the time to a *correct* ledger, because nothing marks those errors. That argument, not speed, is the headline.

## 3. Scope decisions and non-goals

**In v1:** upload, a deterministic quality gate, model extraction with per-field confidence, currency conversion at the ECB rate, rule-first categorisation, deterministic matching, eleven exception types, one review queue with audited decisions, the month-end pack, and an evaluation harness that runs with no API key.

**Added during the sprint, each with the candidate's approval:** statement lines with no receipt (substitute, link, or "not an expense"), which came from the interview; a split payment (one receipt, several lines); refund handling.

| Not built | Why |
|---|---|
| Bank feeds, accounting-software sync | The CSV export is what the user has; sync is the first item of the next iteration |
| Email intake | Upload covers the workflow; a two-week follow-up |
| Authentication and roles | A simulated user switcher shows the one rule that matters: nobody approves their own expense |
| Tax computation | GST is recorded only when printed |
| Policy decisions | The finance lead owns thresholds; every one is configurable in `.env` |

## 4. Architecture and trade-offs

- **The model reads; code decides; a person approves.** The model (`gpt-5.6-sol`, the same model as two of the B1 runs, so the comparison isolates the design) only reads receipts and suggests a category when no rule applies. Currency, thresholds, matching, duplicates, statuses, and the queue are pure TypeScript in `src/core` with no I/O, which a test enforces. 321 tests; every rule has a named test, and each new rule was deliberately broken to check a test fails. Several survived the first time; each got a test until all were caught.
- **Precision over recall.** Auto-match needs a score of 75 *and* a 20-point lead over the runner-up; anything in doubt goes to a person with ranked candidates and plain-language reasons. That costs human touches (25% of receipts) and buys the 0% wrong-match rate.
- **Statuses are derived, never set.** The month is read once (the model calls) and then reconciled again, purely, from what was read plus every human decision, on every view. A correction flows through the rules exactly as the pipeline would, and a status cannot be hand-picked, the failure in finding P5.
- **Local-first.** SQLite and a local file store; only the receipt file goes to the model API, with storage turned off. About USD 0.45 per month of 40 receipts.
- **Replay mode.** Every model answer is recorded by a hash of the request, so the whole app and the evaluation run with no API key, and any prompt or schema change fails loudly instead of answering silently for a different request.
- **Why not "just ChatGPT"?** B1 already reads receipts as well as the system. It cannot guarantee that a payment is used once, that a doubtful pairing goes to a person, or that the same input gives the same answer. Those are code properties, and they are where B1 failed.

## 5. AI versus human judgement

| Step | Decided by | Why |
|---|---|---|
| Is the file readable? | Rule | Measurable; naive checks caused rework (E5) |
| What does the receipt say? | **Model**, then schema validation | Perception; each field has a confidence, and low confidence goes to a person |
| Currency, conversion, totals | Rule | Inferring it corrupted totals (E2) |
| Category | Rule table first, **model** only for unknown vendors | Must be explainable; a doubtful guess goes to a person |
| Which payment? | Deterministic scoring; **a person** when there is no clear winner | Auto-match only on a clear winner |
| Is a difference acceptable? | Policy threshold, then **a person** with a reason | Policy is the finance lead's; sign-off is always human |
| Final approval | **Always a person** | The system prepares; a person signs off |

The cold runs (section 6) showed that the human step needs its own guardrails, so the person's choices are checked too: only real candidates are suggested, a pairing that does not fit is shown side by side with why, a pairing that is clearly someone else's payment is refused, and every reason must say something.

## 6. Failures, changes, and results

**Breaking it.** A stress set of 11 cases from the evaluation plan failed 4 of its first 10 before any fix. Every failure was in a rule or a data contract; the model said "unsure" correctly on blur, a bare "$", and an ambiguous date. Six failure analyses, each with a measured before and after ([`failures.md`](sprint/days/day-4-evaluate-and-harden/failures.md)):

| | Failure | Root cause | After |
|---|---|---|---|
| F1 | A refund was offered as a receipt's payment | Scoring never looked at the sign | Credits are never candidates |
| F2 | A chat screenshot was told "retake it closer" | The size check ran on screenshots, before the model could say "not a receipt" | Size check for camera photos only (the candidate's ruling) |
| F3 | A valid statement with a title row was rejected | The header had to be row 1; one date style per format | Header found below title rows; ISO and month-first dates read |
| F4 | An FX outage flagged six already-paid receipts and the summary contradicted the ledger | The missing-rate rule ran before matching knew a rate was not needed | Flag only when the amount depends on a rate |
| F5 | A logo-styled vendor name lost its vendor points | Whole-word comparison | Run-together names match |
| F6 | A payment 15 days away was offered as a match | No date gate | 7-day gate, tuned on the tuning split only |

Before → after: stress cases **6/10 → 11/11**; the B1 subset **10/11 → 11/11** test cases; the October month unchanged at 12/12 with no regression.

**People closing the month.** There is no Accounting user for this sprint, so two cold runs stood in, each labelled for what it can show:

| | C1: the builder, fresh clone | P1: a proxy with a year of business-management experience, new to the app |
|---|---|---|
| Time to close | about 8 min | 9 min (helped once) |
| Receipts right, against the answer key | 37 of 40 | 39 of 40 |
| Ledger against the truth | $106.66 over | $10.00 over |

**Every wrong number in both runs came from a person pairing a receipt with an unrelated payment**, signed off "Good" or "This is good"; P1's was made with a warning on screen, and a screenshot showed why: for a receipt with no real candidate, the list offered a $10 card fee first. The changes that followed (refusing clear mismatches, suggesting only real candidates, requiring specific reasons, suggesting categories for substitutes) now refuse all four observed wrong pairings in tests. They have not been tried on a person since. P1's other feedback (inputs lost when switching tabs, "standard light" tables and cards) was built and checked in a browser.

**Final metrics against the targets** (`final`, live, Day 5):

| Metric | Target | Result |
|---|---|---|
| Wrong auto-match rate | 0% | **0/33**; 0/14 on holdout |
| Exception recall (amount, purpose, duplicate) | 100% | 5/5 |
| Match recall | ≥ 95% | 35/35 |
| Extraction: total, currency | ≥ 95% | 40/40 each |
| Category accuracy | ≥ 90% | 40/40 |
| Human touches | ≤ 35% | 10/40 (25%) |
| Time to close (40 receipts) | ≤ 10 min | about 8 min (builder), 9 min (proxy) |
| Latency | p95 < 20 s | p50 2.0 s, p95 5.0 s |
| Cost | report it | at most USD 0.45 per month |

Every target is met; one number moved the wrong way. Between two identical live runs, one receipt's currency confidence fell from 0.99 to 0.77, under the 0.8 threshold, so human touches went from 9 to 10. The threshold was not changed, because that receipt is in the holdout split.

## 7. Limitations

1. **Synthetic data, proxy users.** Every number is on one synthetic month; the people who closed it were the builder and one proxy. Nothing here is the Accounting user's measurement, and B0's time is an estimate.
2. B1 already matches the system on reading, categorising, and finding payments on clean receipts; the measured advantage is ledger correctness, on one month.
3. The Day 4 guardrails on human decisions are tested, not yet tried by a person.
4. One month at a time; two bank layouts; substitute categories checkable for 4 of 9 payments until the rule table grows.
5. The model's confidence near the threshold varies between identical runs, so the human-touch count can move by about one.

## 8. Next two weeks

From [`NEXT_ITERATION.md`](NEXT_ITERATION.md): before any feature, the Accounting user closes one real month with the same protocol, timed and scored. Then watch adoption, wrong pairings made by people, the human-touch rate, correction rates, and category overrides. First to build: rule-table entries and learning vendor rules from corrections, then an accounting-software export.
