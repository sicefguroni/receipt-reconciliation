# Next iteration

What to watch in the first two weeks after the Accounting user starts closing real months with the system, and what to build next. Grounded in the sprint's evidence: [`EVALUATION.md`](EVALUATION.md), the two cold runs (C1, P1), and the Day 4 failure analyses.

## First two weeks after deployment: metrics to watch

The deployment covers at most one real month-end in two weeks, so these are read per month closed, plus a check-in with the Accounting user at the end of week 1 and week 2.

| Metric | Why | Signal to act | How it is collected today |
|---|---|---|---|
| **Months closed in the system vs. outside it** | Adoption: the one number that says whether it is used | The user falls back to the spreadsheet for any part of the month | Ask at each check-in; the Runs page shows every month started |
| **Wrong pairings made by people** | Both cold runs' only errors (C1: 3, P1: 1) were people pairing a receipt with someone else's payment | Any pairing the accountant later reverses; any R-MAT-11 refusal the user works around | Count R-MAT-11 refusals and sign-off reasons in the decisions table; ask the accountant who reconciles the books |
| **Human-touch rate per month** | Value: attention on judgement, not routine pairing | Above 35% of receipts, or rising month on month: rules or vendors are missing | The review page's group counts at the start of the month (target ≤ 35%; `final`: 25%) |
| **Field and category correction rate** | Extraction and categorisation quality on real receipts, which the synthetic month cannot show | Above 10% on any field | Corrections are decisions (`correct_field`); count them per field per month |
| **Category suggestion overrides (R-CAT-6)** | Whether substitutes are filed consistently | More than one in five suggestions overridden: the rule table or the suggestion is wrong | Count `record_substitute` decisions with `overrideSuggestion` |
| **Wrong auto-matches found later** | Trust: the 0% target | Any non-zero value: raise `AUTO_MATCH_MIN_SCORE` or the margin, and add the case to the evaluation | Not instrumented: approved items are locked. Found by the accountant when the books are reconciled; record each one |
| **Time to close** | Value | Not below the B0 estimate (20–40 min for 40 receipts) | Stopwatch for the first two months, as in the cold-run protocol |
| **Cost per month** | Unit economics | Unexpected growth beyond about USD 0.011 per receipt | Tokens per run on the Runs page; price in `config/pricing.json` |

## Next iteration candidates (ranked)

| Rank | Candidate | Why now | Size |
|---|---|---|---|
| 1 | **Rule-table entries for common payment types, and learning vendor rules from corrections** | R-CAT-6 can check a substitute's category for only 4 of the 9 October payments with no receipt; pharmacy, parking, courier, petrol, bookshop, and card fees have nothing to go on. Corrections already exist as decisions, so "always use this category for this vendor" can be learnt from them (R-CAT-4 offers it today, one at a time). Needs the finance lead to agree the categories | Small |
| 2 | **Accounting-software export or sync** | The ledger CSV is the hand-off today; a direct export removes a manual import step every month | Medium |
| 3 | **"Read again" for a month** | After an FX or model outage the only fix is to start the month again, which loses the decisions made so far | Small |
| 4 | **Repeat-run variance in the evaluation** | One receipt's confidence moved from 0.99 to 0.77 between identical live runs; several live runs per release would show the real spread of the human-touch count | Small (about USD 0.45 per run) |
| 5 | **Email-forward intake** | Staff submit receipts during the month; forwarding is less effort than uploading | Medium |
| 6 | **Multi-month view and carry-over** | A receipt whose payment posts next month currently has to be removed and re-uploaded | Medium |
| 7 | **Real authentication and roles** | Simulated sign-in shows the no-self-approval rule but does not enforce identity | Medium |

Already built during the sprint, so no longer candidates: split-line matching (R-MAT-10), refund handling (R-MAT-8), and two statement layouts with header and date-order detection.

## Before any of it: the Accounting user

The largest gap is not a feature. Every measurement in this repository is on synthetic data, closed by the builder and one proxy. The first real step is the Accounting user closing one real month with the cold-run protocol (`docs/sprint/days/day-3-working-core/first-run-observations.md`), timed and scored the same way, with the feedback questions straight after.
