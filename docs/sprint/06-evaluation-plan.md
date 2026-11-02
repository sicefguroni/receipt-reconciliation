# 06. Evaluation Plan

## Dataset (build on Day 1 with `scripts/generate-dataset.ts`)

One synthetic month (`2026-10` or the sprint's previous month) with about **40 receipts** and **about 45 statement lines**. Include about 25 routine items so the human-touch rate is realistic, and every scenario below at least once.

- **Receipt generation.** Render HTML receipt templates (at least 6 distinct layouts: café, airline, SaaS invoice PDF, hardware store, ad-platform invoice, coworking) to PDF and PNG with Playwright. Make about 30% of them "phone photos" with `sharp`: rotate ±3–8°, add noise, JPEG quality 60, portrait 900 × 1200 and smaller.
- **Statement.** A CSV in one realistic bank export format, plus a second format with different column names to exercise column mapping.
- **Ground truth.** `fixtures/dataset/ground-truth.json`: per receipt, the true fields, category, correct statement line (or none), and the exception codes that must fire.
- **Splits.** `tuning` (about 60%) is used to set thresholds. `holdout` (about 40%) is never looked at while tuning. Report final numbers on **holdout** and on the full set, and say which is which.
- All vendors, people, and amounts are fictional. Use names like "Sample Café", "Test Airline", "Demo Cloud Pty Ltd".

## Test cases (the 12 required scenarios)

| ID | Scenario | Input | Expected behaviour | Rules |
|---|---|---|---|---|
| TC01 | Routine happy path | Clean AUD café PDF, exact statement line on the same day | Auto-matched, correct category, in bulk-approve group | R-MAT-1 |
| TC02 | USD subscription | USD SaaS invoice, statement shows USD original plus AUD charge with FX fee | Converted, matched on the original amount, no amount-difference flag | R-CUR-2, R-CUR-4 |
| TC03 | AUD must not go to FX | AUD receipt whose vendor is foreign-sounding | Stays AUD, included in totals | R-CUR-1 *(E2 regression)* |
| TC04 | Difference over threshold | Receipt $500.00, statement $560.00 (12%) | Never auto-paired: `AMBIGUOUS_MATCH` with the $560.00 line as a ranked candidate. When the user chooses it: `amount_differs` plus `AMOUNT_DIFFERS_OVER_THRESHOLD`, and approval needs a reason | R-AMT-2, R-AMT-4, R-MAT-2 |
| TC05 | Difference within threshold | Café receipt $42.00, statement $44.00 (tip) | `matched` with a "+$2.00" difference badge, bulk-approvable, no reason needed | R-AMT-3 |
| TC06 | Missing business purpose | Blank purpose, and a variant with "n/a" | `MISSING_PURPOSE`, blocked | R-REQ-1 *(E4)* |
| TC07 | Duplicate upload | Same file twice, and a re-photographed copy with the same fields | Second copy flagged `DUPLICATE` and excluded from totals | R-DUP-1 |
| TC08 | Portrait phone photo | 900 × 1200 skewed photo of a receipt | Passes the gate and extracts correctly | R-QUA-1 *(E5)* |
| TC09 | Clean digital receipt | Crisp PDF that a naive blur check would reject | Passes the gate (blur check skipped) | R-QUA-2 *(E5)* |
| TC10 | No statement line | Personal-card receipt with no line | `unmatched`, offered as reimbursement, not an error | R-MAT-3 |
| TC11 | Ambiguous match | Two $19.99 lines on adjacent days, one receipt | `AMBIGUOUS_MATCH` with both candidates ranked, never auto-picked | R-MAT-2 |
| TC12 | Category drift | Ad-platform invoice, cloud bill, coworking pass, office chair | Advertising & Marketing / AI & Cloud / Rent & Workspace / Equipment, never "Other" | R-CAT-1–3 *(E3)* |

### Stress cases for Day 4 ("break it")

Use these to find failures, not to pad the pass rate: an unreadable photo (heavy blur, 400 px), a non-receipt image (a screenshot of a chat), "$" with no currency clues, a date in ambiguous `03/04/2026` format, a receipt covering two items paid in two transactions, a statement CSV with an extra header row and a different date format, a refund (a negative statement line), and the FX API being unreachable (simulate it).

## Metrics and how each is computed

| Metric | Computation | Source |
|---|---|---|
| Extraction accuracy | Per field: total within $0.01, currency exact, date exact, vendor normalised fuzzy match ≥ 0.8 | `eval.ts` against ground truth |
| Category accuracy | Exact category before human review | `eval.ts` |
| Match recall | Correct line is the auto-match or the top-1 candidate / matchable receipts | `eval.ts` |
| Wrong auto-match rate | Incorrect auto-matches / all auto-matches | `eval.ts` |
| Exception recall / precision | Per exception code: fired vs expected | `eval.ts` |
| Human touches | Items not in the bulk-approve group / all items | `eval.ts` |
| Latency | p50/p95 per receipt end to end, plus per stage from `run_log` | `eval.ts` (live mode only) |
| Cost | Sum of input and output tokens × current per-token price (put the price in config with its source and date) | `eval.ts` (live mode only) |
| Time to close | Stopwatch: the user's minutes from opening the month to a signed-off ledger | Human session notes |

`pnpm eval` writes `eval-results/<label>/{summary.json, cases.csv, report.md}`. `report.md` has the pass/fail table per TC, the metric table, and a list of every failed assertion.

## Pass/fail rubric

- A **test case passes** only if every expected behaviour in its row holds. Partial is a fail, with a note.
- The **system passes v1** if all of the following hold: TC01–TC12 pass; exception recall is 100% for TC04 (`AMBIGUOUS_MATCH`, then `AMOUNT_DIFFERS_OVER_THRESHOLD` once the line is chosen), TC06, and TC07 codes on the full set; the wrong auto-match rate is 0% on holdout; extraction total and currency accuracy are ≥ 95% on holdout.
- If the system misses the bar, it still ships. The results doc states the miss, its root cause, and the next step.

## Baselines (Day 1)

### B0: manual process, by the Accounting user

1. Give the user a **fixed 20-item subset** (`fixtures/dataset/baseline-subset.json`, which includes TC04, TC06, TC07, TC11, and four routine items at minimum), the receipt files in a folder, the statement CSV, and a spreadsheet template with columns: receipt, category, statement line, flags, notes.
2. Ask them to work as they normally would. Time it. The candidate observes and does not help.
3. Score their sheet against ground truth with the same metric definitions.
4. Record minutes, accuracy, the exceptions they caught or missed, and observations in `docs/sprint/days/day-1-discover-and-baseline/baseline-b0.md`.

### B1: single chat prompt ("simple ChatGPT use")

1. Use one fixed prompt (save it verbatim in `docs/sprint/days/day-1-discover-and-baseline/baseline-b1-prompt.md`) asking a chat assistant to reconcile the same 20 receipts against the CSV and list categories, matches, and issues.
2. Run it **3 times** and record the variance between runs. Non-determinism is itself a finding.
3. Score each run against ground truth. Record the time, including copy, paste, and checking, in `docs/sprint/days/day-1-discover-and-baseline/baseline-b1-runs.md`.

**Why both:** B0 is the true previous way. B1 answers the obvious reviewer question: "Why not just paste it into ChatGPT?"

## Failure analysis (at least 3 on Day 4)

Write each one in `docs/sprint/days/day-4-evaluate-and-harden/failures.md`:

```md
### F<n>: <short title>
- Case / input: TC.. or stress case ..
- Observed: what the system did (with run label and evidence path)
- Expected: ...
- Root cause: the actual mechanism (prompt, rule, threshold, data contract, UI), not "the model got it wrong"
- Fix: what changed (commit)
- Regression: metric before → after (run labels)
- Residual risk: what can still go wrong
```

## Regression protocol

- Label runs: `v0-day2`, `v1-day3`, `v2-day4-pre`, `v2-day4-post`, `final`.
- Run `pnpm eval -- --mode replay` after every rule or prompt change. Run `--mode live` at least for `v1-day3` and `final`, so that latency and cost are real.
- Use `pnpm eval:compare v2-day4-pre v2-day4-post` for the before/after table in the results doc. Show regressions as well as gains.

## User sessions

- **Day 3, first execution:** the user gets only the README and a link. Observe silently. Note every hesitation, question, and error message they read. Record time to close for the full month. Write it all in `docs/sprint/days/day-3-working-core/first-run-observations.md`.
- **Day 4, feedback:** what did you trust, what didn't you trust, what was confusing, and what would stop you using it next month? Record the answers in `docs/sprint/days/day-4-evaluate-and-harden/feedback-session.md`, and record each change made in response in `TRACKER.md` with the feedback that caused it.
