# Day 3 journal

One entry per block: what happened, what went wrong, and how it was checked. Decisions are in the `TRACKER.md` decision log and are not repeated here. This is source material for `CASE_STUDY.md` and `AI_COLLABORATION.md`.

---

## Block 2 (done first): statement column mapping (2026-11-03)

**Goal.** Read both bank formats; friendly errors on a bad upload.

**Built.** `src/adapters/statement/read-statement.ts` replaces the format-A reader. Each format is a mapping from its column names to the statement-line fields, found by name in any order. Detection is from the header; a nearly-right header names the missing column; an Excel or PDF file is refused with "choose CSV". Every bad row is reported at once with its spreadsheet row number. Card numbers in descriptions are masked.

**Verified.** 12 tests. **Format B produces lines identical to the ground truth**, the check the dataset was built for on Day 1 (both formats hold the same transactions). In the browser, the October month started from the format-B file and the page said "read as Format B".

---

## Block 1: review actions (2026-11-03)

**Goal.** The queue becomes a working tool: approve, bulk approve, choose a match, sign off a difference, correct fields, resolve duplicates, and the three R-MAT-7 actions for payments with no receipt.

**The design call.** Rather than store statuses and patch them per decision, the pipeline was split: `readMonth` does the I/O (quality gate, model, categories, FX) and stores a snapshot; `reconcileMonth` is pure and derives everything else from the snapshot plus the list of decisions, every time the month is shown. A corrected total therefore flows through FX, duplicates, and matching exactly as the pipeline would handle it, and a status is never hand-set. Decisions are append-only rows, checked at one boundary (`src/pipeline/decisions.ts`) against the month as it stands.

**How it was checked.**

- With no decisions, the reconciled month equals Day 2's output: the 40-receipt oracle test passed unchanged.
- 14 decision tests on the oracle month (TC04 choose → flag → sign off → approve; TC11; duplicates; purpose; reimbursement; the three no-receipt actions; removal; two choices for one line), and 9 boundary tests (self-approval, locked approvals, reasons, field validation).
- **A simulated reviewer closes the whole month**, one decision at a time, and the closed ledger equals the ground-truth total.
- 6 single-rule mutations of today's rules: 4 caught at first, 2 missed (a substitute without a reason; two choices for one line). A named test was added for each; both are now caught.

**What went wrong.**

- **The month-close test found a real UX trap.** TC04's candidate line L16 ($560) also shows as "No receipt", and group 4 sorts by amount, so it comes *before* R04 ($500). The simulated reviewer wrote it off as "not an expense", after which R04 could not be matched. The 12 single-action tests had all passed. Fix: such lines now say "could be the payment for R04" and offer Link first.
- The first full-close run took 64 s: the decision-free base month was derived again on every call. It is now cached per snapshot (whole file: 4 s).
- Typecheck caught two tests passing a receipt to `checkApproval` without `status`; they passed only because an exception blocked first.
- A shell command opened Python's interactive prompt and hung (the Day 2 trap again); edits were redone with the editor tool, nothing half-applied.

---

## Block 3 and 4: month-end pack and Runs page (2026-11-03)

**Built.** Ledger CSV (substitute rows, approver, sign-off reason, outcome), exceptions log CSV (every flag ever raised, open or how it was resolved, by whom, with the reason), and a summary page: totals by category and by payment source, what was left out and why (including FX-excluded amounts by currency), and each no-receipt line's resolution. The Runs page shows, per run and per step, counts by status, time, tokens, and error codes, including failed runs (a bad statement logs `STATEMENT_FORMAT`). The log stores fixed codes, never messages.

**Verified.** A test checks that the closed month's category totals and payment-source totals both equal the ledger total, and that the exceptions log has no open rows. In the browser, the Runs page showed the failed statement upload with its code and no receipt or statement text.

---

## Review UI and the browser check (2026-11-03)

**Design.** A ruled ledger: one column template for the header, every row, and every group total, so amounts line up down the page; tabular figures; a tick margin (red open circle for blocking groups, green tick when done); one sentence per row saying what to do. No client JavaScript: every action is a plain form.

**Checked on a production build in replay mode, by a scripted browser run: 22 of 22 checks pass.** Format-B start; TC04 choose → amount-differs group → approve disabled with "Give a reason…" → sign off → approve → Done; bulk approve (31 clean matches); self-approval disabled with the reason beside it; a substitute; a purpose; both CSVs; the receipt file; a friendly bad-statement message; the Runs page; no sideways scroll at 390 px.

**What went wrong.**

- The first script run failed after six checks. The script read the previous page's notice (it waited for `networkidle`, which a server action does not guarantee). It also exposed a real gap: after "Use this payment", R04 moved to group 2 *closed*, so the next step had to be found again. The app now keeps the item open after a step that leads to another.
- Screenshots showed group totals left of the amount column; fixed with a shared column template.
- The design hook flagged a thick left accent border on notices as a generic tell; replaced with a thin full border.
- On Windows, stopping `pnpm start` left the `next` process running and holding `data/app.db`, so `pnpm seed` failed with EPERM. Found by port and stopped. For the RUNBOOK.

---

## Block 5: README draft and v1-day3 (2026-11-03)

**README.md** drafted for the Accounting user against the six questions in `08`: what it does, three-step setup, closing a month, a row per flag with what to do, who decides what, and what data leaves the computer. Its claims about model requests (`store: false`; only vendor and items for categories) were checked against the code. Screenshots wait for Day 5.

**v1-day3, live (candidate approved the cost):** 12/12 test cases, wrong auto-match 0/33 (0/14 holdout), human touches 9/40. `pnpm eval:compare -- v0-day2-live v1-day3`: every metric and test case unchanged, as expected for a refactor that does not alter the no-decision result. Replay with the key blanked matches. p50 3.0 s, p95 4.7 s per receipt; at most USD 0.45. Two category requests re-recorded with new hashes (the model worded R16/R30's item lists differently); the run's `summary.json` names commit `31077eb` because it started just before the code commit `3b77a92`.

**Integrations checked today:** the OpenAI API (40 live extractions), Frankfurter (live FX range fetch inside the run), and CSV import (both formats, in tests and in the browser).

---

## Block 6: first execution (not run yet)

**There is no Accounting user.** The candidate chose: a naive proxy with admin or bookkeeping experience who has never seen the repo, plus a builder cold run from a fresh clone, each labelled for what it can show. The protocol, the observer's answer key, and the blank record are in `first-run-observations.md`. Automated runs are kept as completeness evidence and are not reported as a user session.

---

## Day 3 summary

- Exit criterion "user completes a month close, or each blocker is recorded": **open**, waiting for the proxy session and the builder run.
- Exit criterion "integrations working": **met** (OpenAI, Frankfurter, CSV import, today).
- Exit criterion "`v1-day3` results recorded": **met**.

The fact that most shapes Day 4: every automated check passes, and every number is unchanged from Day 2, so the remaining unknowns are human (can someone else find each action?) and adversarial (the stress cases).
