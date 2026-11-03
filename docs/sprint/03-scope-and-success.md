# 03. Scope, Non-Goals, and Success Metrics

## v1 scope (must be working on Day 5)

**Approved by the candidate on 2026-11-03** (Day 1, block 5), including the Day 1 changes marked below and the targets in "Success metrics". Any later change to a v1 item needs a new approval and a decision-log entry.

1. **Intake.** In the web UI, upload a batch of receipts (JPG, PNG, PDF) and one statement CSV for a chosen month. Each receipt carries a submitter, a payment source (company card, personal card, or bank account), and a business purpose.
2. **Quality gate.** Deterministic, orientation-aware checks with a plain-language rejection reason.
3. **Extraction.** Vendor, date, total, currency, tax (GST) if shown, and line-item summary, with per-field confidence, validated against a schema.
4. **Normalisation.** AUD stays AUD. Non-AUD amounts are converted at the historical rate for the receipt date from a public FX API.
5. **Categorisation.** A vendor rule table first, then a model fallback with a reason and confidence. Every category is editable.
6. **Matching.** Deterministic scoring against statement lines, with auto-match only for a single clear winner.
7. **Exceptions.** Amount difference, missing purpose, duplicate, no payment found, ambiguous match, low confidence, unreadable, and self-approval. *Added 2026-11-03:* **statement lines with no receipt**, listed so the user can link a receipt or record a substitute with a reason. This is the "create own invoice" step from the interview (R-MAT-7).
8. **One review queue** in the user's requested order, with approve, correct, and override-with-reason actions, all audited.
9. **Month-end pack.** Ledger CSV, exceptions log CSV, and a readable HTML/Markdown summary with totals by category and by payment source, plus the list of statement lines with no receipt and how each was resolved.
10. **Evaluation harness.** `pnpm eval` in replay and live modes, plus comparison between runs.
11. **Handoff documentation.** README, runbook, architecture, evaluation results, case study, AI collaboration note, and demo.

## Non-goals (state these in the case study)

| Non-goal | Reason |
|---|---|
| Live bank feeds or open-banking APIs | Bank CSV export is what the user already has; feeds add auth and compliance work for no evaluation gain |
| Sync to accounting software (Xero, QuickBooks, MYOB) | Export a clean CSV instead. Sync is the first item of the next iteration. |
| Email or chat intake of receipts | Upload covers the workflow. Intake channels are a two-week follow-up. |
| Multi-user authentication and roles | Simulate the submitter and reviewer with a user switcher. Enforce only "no self-approval". |
| Payroll, contractor payouts, rent, subscriptions management | Separate workflows |
| Tax or GST computation and lodgement | Record GST only if it is printed on the receipt |
| Mobile app | Desktop web, usable at phone width |
| Policy decisions (thresholds, who approves executives) | Owned by the finance lead. The system makes them configurable. |

## Success metrics

Fill in the Baseline columns on Day 1 and the Final column on Day 4 and Day 5. Targets are the bar for "better". If a target is missed, report it honestly.

| Metric | Definition | Baseline B0 (manual) | Baseline B1 (single chat prompt) | Target | Final |
|---|---|---|---|---|---|
| **Time to close** | Minutes for the user to reach a signed-off ledger on the test month | **estimate, not measured:** 20–40 min for the 40-receipt month (30 s–1 min per receipt for the current process; candidate's estimate, revised from 1–4 min) | not measured (only ChatGPT response time recorded: 25–29 s per run) | at least 50% less than B0: convincing only at **≤ 10 min** (half the low end of the estimate) | |
| **Human touches** | Receipts needing a human action / all receipts. Statement lines with no receipt (R-MAT-7) are reported separately as a count. | 100% by definition | n/a | 35% or fewer (floor by design on the October set: 9/40 = 22.5%) | |
| **Exception recall** | Exceptions caught / exceptions planted (ground truth) | not measured (no human answer sheet) | 5/5 (100%) in all 3 runs | 100% for amount difference, missing purpose, duplicate | |
| **Wrong auto-match rate** | Auto-matches that are incorrect / total auto-matches | n/a | **3/19 (16%) in all 3 runs** | 0% on the test set | |
| **Match recall** | Correct matches found (auto plus suggested top-1) / matchable receipts | not measured | 16/16 (100%) in all 3 runs | at least 95% | |
| **Extraction accuracy** | Correct total, currency, and date / receipts | n/a | 20/20 (100%) in all 3 runs | at least 95% on total and currency | |
| **Category accuracy** | Correct category / receipts | not measured | 20/20 (100%) in all 3 runs | at least 90% before human review | |
| **Cost per month closed** | Model spend for the test month | $0 | not measured (consumer subscription, no per-run cost shown) | report it; no target | |

B1 figures are from the 20-item baseline subset, scored on 2026-11-03 (`eval-results/baseline-b1/report.md`; detail in `days/day-1-discover-and-baseline/baseline-b1-runs.md`). **B1 already meets the extraction, category, match-recall, and headline exception-recall targets on this clean synthetic set.** Improvement over B1 can only be shown on the wrong-match rate, ledger integrity (one line, one receipt), and the Day 4 stress cases. Targets are kept as set; the final report must say this plainly. B0 was not measured, because the Accounting user was unavailable and no unbiased proxy was available; its time is a labelled estimate (`days/day-1-discover-and-baseline/baseline-b0.md`).
| **Latency** | p50/p95 seconds per receipt, end to end | n/a | n/a | report it; p95 under 20 s | |

### Business value link (for the case study)

- **Time to close** is the Accounting user's hours each month.
- **Exception recall** and the **wrong auto-match rate** are the trustworthiness of the month-end report. One silent miss costs more than the time saved, which is why wrong auto-matches have a 0% target and the system prefers asking over guessing.
- **Human touches** shows where attention goes: on judgment, not on routine pairing.
