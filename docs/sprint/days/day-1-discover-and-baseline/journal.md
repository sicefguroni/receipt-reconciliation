# Day 1 journal

One entry per block: what happened, what went wrong, and how it was checked. `TRACKER.md` stays a short index of facts; decisions live in its decision log and are linked here, not repeated. This is source material for `CASE_STUDY.md` and `AI_COLLABORATION.md`.

---

## Block 1: Scaffold (2026-11-02)

**Goal.** A repository that installs, type-checks, tests, and builds, with secrets and policy kept out of the code.

**Built.**

- Next.js 16 (App Router), TypeScript 6 strict (with `noUncheckedIndexedAccess`), Vitest 5, Drizzle with `better-sqlite3`, Biome. Commit `3b159db`.
- `src/config/env.ts`: every threshold from `05` is a Zod-validated env variable whose default equals `05`, so replay mode runs with no `.env` at all. A bad value fails with a message that says how to fix it.
- `src/core/boundary.test.ts`: fails `pnpm test` if `src/core` imports an adapter, Node I/O, `process.env`, or `fetch`. This turns the "money rules are pure" rule into something that is checked.
- `.gitattributes` pins LF line endings.

**What went wrong.**

- **The latest TypeScript (7.0) would have broken `next build`.** TS 7 is the native compiler and has no JavaScript API, which Next's type check calls. This was caught by reading the package metadata before installing, and TS was pinned to 6.0.3.
- **The latest `better-sqlite3` (13.0.3) failed to install.** It has no prebuilt binary for Windows on Node 24, so it tried to compile and needed Visual Studio. A reviewer on Windows would hit the same wall, which breaks the three-step setup. Checking the GitHub release assets showed 12.11.1 has the binary, so it is pinned to that.
- **Biome reformatted `CLAUDE.md`.** Biome 2.6 also formats Markdown. Only table padding changed, but the formatter should not touch prose docs, so `*.md` is now excluded.
- **`next build` rewrote `tsconfig.json`** after the first commit, so lint failed on the committed tree. A rebuild left the reformatted file alone, so one formatting commit fixed it (`3f1eb24`).
- **The first secrets check did not run.** The `git grep` flags were in the wrong order and the command printed "none" anyway. This was noticed in the output and re-run correctly before committing.
- **CRLF trap.** With `core.autocrlf=true`, a fresh Windows clone would check files out with CRLF and fail Biome. `.gitattributes` fixes that.

**Verified.** `pnpm typecheck` OK; `pnpm lint` clean; `pnpm test` 8/8; `pnpm build` OK; `pnpm start` served `/` showing "Mode: replay" with no `.env`.

**Decisions.** TS 6 pin, `better-sqlite3` pin, Biome, boundary test, thresholds in `.env`, no stub scripts. See the TRACKER decision log, 2026-11-02.

**Human input.** The candidate corrected the agent's assumption that `HANDOFF.md` meant a separate new repository: this folder *is* the repository. `HANDOFF.md` is excluded from git through `.git/info/exclude`. Private repo `sicefguroni/receipt-reconciliation` was created on request.

---

## Block 2: Dataset generator (2026-11-02)

**Goal.** One synthetic month with ground truth, good enough to score B0, B1, and the system against with the same definitions.

**Built.** `pnpm dataset` (`scripts/generate-dataset.ts`, `scripts/dataset/*`), commit `5bc626d`:

- 40 receipts across 6 layouts (café docket, airline e-ticket, vendor invoice, hardware tax invoice, ad-platform invoice, coworking receipt), rendered with Playwright. Files: 23 PDF, 3 PNG, and 14 JPEG phone photos (rotated 3 to 8 degrees, noise, quality 60, 750 to 900 px wide, all passing R-QUA-1).
- Each layout prints dates and currency its own way (`16/10/2026`, `October 5, 2026`, `06.10.2026`, `$`, `A$`, `AUD 89.00`, `$49.00 USD`), so extraction has to cope with real variety.
- 44 statement lines: 35 that belong to receipts plus 9 with no receipt. Some of the 9 are deliberate distractors: the TC11 twin, a same-day taxi charge 2.50 away from R27, and a café charge one day after R25. The same lines are written in two bank formats.
- Ground truth for every receipt: fields, category, correct line, match status, exception codes, ledger amount.
- Splits 24/16, plus a 20-item baseline subset and a ready-to-use B0 kit (files, `receipts.csv`, statement with line numbers, answer sheet, instructions).

**Key design choice.** Ground truth is written by hand from each scenario's intent and never computed by `src/core`. If the rules produced the expected answers, the eval would only check the code against itself.

**What went wrong.**

- **The unstratified split hid the hard cases.** The first seeded shuffle put TC04, TC05, TC06, and TC11 all in tuning, so holdout was almost all routine and "0% wrong auto-match on holdout" would have passed without being tested. This was found by printing which test cases landed in each split. The split is now stratified (hard and routine items each split 60/40), and a test requires at least 3 hard cases on each side.
- **The re-photographed duplicate showed a different invoice.** R10 is a photo of R08's printed invoice, but each receipt drew a new invoice number and time from the RNG. Duplicates now reuse their original's printed details.
- **The fixtures README had placeholder file counts.** It was corrected from `receipts.json` (23/14/3).
- **Git normalised the statement CSVs to LF.** Bank exports use CRLF, and the Day 3 parser should be tested on real bytes, so fixture CSVs are now stored byte-for-byte (`7d069ae`).

**Found in the rules while authoring the data.** These are not fixed yet; they are logged in the TRACKER session entry.

- **TC04 cannot reach its expected outcome under R-MAT as written.** A 12% difference earns no amount points, so the best score is 50, which gives `ambiguous`. That is not the `amount_differs` plus `AMOUNT_DIFFERS_OVER_THRESHOLD` that `06` expects. To be decided in block 6 or on Day 2.
- R27 versus its distractor gives a margin of exactly 20, the auto-match boundary. This is deliberate and will be sensitive to tuning on Day 4.
- Intake `paymentSource` has no `bank` value, so direct-debit receipts can never earn the account point.

**Verified.** 36/36 tests: spec invariants (TC01 to TC12 covered, thresholds for TC04 and TC05, splits, baseline subset, determinism) plus fixture checks (every file hash, real pixel sizes, R09's hash equal to R08's, row counts in both CSVs). R02 (USD invoice PDF), R10 (re-photo), and R11 (TC08 portrait photo) were inspected by eye and are legible.

**Open.** Stress cases from `06` (unreadable photo, non-receipt, bare "$", ambiguous date, refund, FX outage) are planned for Day 4. TC11 has one instance, so it is in only one split.

---

## Block 3: Rules confirmation and interview (2026-11-02 and 2026-11-03)

**Goal.** Settle the `CONFIRM WITH USER` rules and the gaps found while building the dataset, before any rule code depends on them.

**Context.** The Accounting user is not available today. The candidate already ran the October UAT with them, so the interview answers are **the candidate's second-hand account**, and are labelled that way in `interview-notes.md`.

**Decided by the candidate.**

| Topic | Ruling | Applied to |
|---|---|---|
| R-AMT-2 threshold | OR: over 10% **or** over $100 gets flagged | `05`, `.env.example` |
| TC04 ($500 receipt, $560 charge) | A different payment until a human says otherwise: never auto-paired, shown as a candidate; choosing it fires the flag | `05` R-AMT-2, `06` TC04 and pass/fail, ground truth (`exceptionsAfterMatchChoice`) |
| R-AMT-3 small differences | A normal match with a visible badge, bulk-approvable | `05` R-AMT-3 and R-QUE, `06` TC05, ground truth (`amountDifferenceAud`) |
| Duplicates | Mark, never delete | `05` R-DUP-1 |
| Payment source | Add `bank` | `05` R-REQ-3, `03`, `04`, `src/core/schemas.ts`, R24/R37 |

**Effect on the metrics.** TC05 now counts as a routine item (no human touch), which lowers the expected human-touch rate. TC04 still costs a human touch, by design.

**What went wrong.** Regenerating after a rules-only change rewrote all 23 PDFs, because Chromium stamps each PDF with the time it was made. The timestamps are now pinned, and two reruns give identical hashes.

**Verified.** 40/40 tests pass, including new checks for TC04's after-choice flag, TC05's badge amount, zero difference on a USD match (the FX fee is excluded), and `bank` on R24/R37. The stabilised R24 PDF still opens and reads correctly.

**Interview (2026-11-03).** The Accounting user was unavailable, so the candidate answered the `01` script from the October UAT, with each answer marked seen or estimate ([`interview-notes.md`](interview-notes.md)). What it added:

- 30 to 60 receipts a month (estimate), so the 40-receipt synthetic month is in range.
- Comparing receipts against payments is the slowest part (estimate). This supports the bottleneck in `02` but does not quantify it.
- When a payment exists without a usable receipt, a substitute invoice is created. That suggests listing statement lines with no receipt; raised as a scope question, not added.
- R-QUA-1 default kept: receipts are roughly letter-size, and no pixel sizes are known.

Time to close and how often each exception occurs remain **not measured**. The answers are thin and mostly estimates, and the case study must say so.

---

## Block 4: Baselines (2026-11-03)

**Goal.** Measure the previous way of working: B0 (manual) and B1 (single ChatGPT prompt), scored with the same definitions the system will use.

**Built.** A reusable scorer (`scripts/eval/score.ts`) and answer-table parser (`scripts/eval/answer-sheet.ts`) with 9 tests, plus `pnpm score:baseline -- <label> <files>`, which writes `eval-results/<label>/{summary.json, cases.csv, report.md}`. `eval.ts` will reuse the same scoring functions on Day 2.

**B1 result.** Three ChatGPT runs by the candidate, scored on the 20-item subset ([`baseline-b1-runs.md`](baseline-b1-runs.md)):

- 100% on extraction, category, match recall, and headline exception recall, in every run.
- **16% wrong-match rate in every run** (3/19):
  - One $312 payment was assigned to the original and both duplicates.
  - The hotel receipt with no payment in the period was paired with a *different* hotel stay's charge (29% off) all three times. The real problem, no payment found, was never named.
- The only variance between runs: R15's twin-charge ambiguity was flagged in 2 of 3 runs.

**What surprised us.** B1 is a much stronger baseline than expected. It already meets four of the `03` targets on this clean synthetic set. The targets were kept (changing them after seeing B1 would be moving the goalposts), and the system's measurable edge is narrowed to the wrong-match rate, ledger integrity, and the Day 4 stress cases. This is probably the most important framing fact for the case study so far.

**What went wrong.**

- The B1 times (25–29 s) are ChatGPT's response time only (confirmed by the candidate). Upload, copy, and check were not timed, so **B1 time to close is not measured.**
- Run 1 used a different model (GPT 6-Sol); runs 2 and 3 used GPT 5.6-Sol. Only runs 2 and 3 show same-model variance. They still differed on R15's ambiguity flag.

**B0: not measured; time estimated.** The Accounting user was unavailable, and the candidate had seen the answer key. The candidate suggested using an agent for "a fair estimate". The agent advised against it: B0 measures a person, so an agent run would be a third AI baseline presented as manual work, which would be an invented measurement. The candidate chose a **labelled estimate** instead: 1–4 min per receipt, giving 40–160 min for the 40-receipt month ([`baseline-b0.md`](baseline-b0.md)). Manual accuracy is not measured; the kit is kept in case a person becomes available. Consequence: the time target can only be called met convincingly if the system closes the month in **20 minutes or less** (half the low end of the band).

**Scope change.** "Statement lines with no receipt" was added to v1 (R-MAT-7) with three actions: link a receipt, record a substitute (the interview's "create own invoice"), or mark not an expense. `03`, `04`, `05`, and `06` were updated, plus a spec test pinning the 9 such lines in the October set.

**Verified.** 50/50 tests pass. The table cleanup was checked by script to leave every cell unchanged. The flag-to-code mapping for every flagged row is printed in `eval-results/baseline-b1/report.md` for audit.

**Open.** Whether to also run B1 on the full 40-receipt month and on the Day 4 stress cases.

---

## Block 5: Targets and scope approval (2026-11-03)

**Goal.** Finalise the targets with baseline numbers, and get the v1 scope approved.

**What changed before approval.**

- The B0 estimate was tied to the **current, post-redesign process** and revised from 1–4 min to 30 s–1 min per receipt: 20–40 min for the 40-receipt month. The revision makes B0 faster, so it cannot flatter the system. Both values are kept in `baseline-b0.md`.
- Time-to-close target: "at least 50% less than B0" holds convincingly only at **≤ 10 min** for the 40-receipt month (half the low end of the estimate).
- Human touches are counted over receipts only, with no-receipt lines reported separately. Counting the lines as items would have made the 35% target impossible by design (best possible 36.7%). Over receipts, the best possible is 22.5% (9/40 need a person by design).

**Approved.** The candidate approved the 11-item scope (with the Day 1 changes: bank source, no-receipt lines, small-difference badge, TC04 never auto-paired), the 8 unchanged non-goals, and the targets.

**Risk carried forward (block 5).** The ≤ 10 min time target needs about 20 human actions in 10 minutes. If it is missed, report the real time against both 10 min (half the low end) and 15 min (half the midpoint). The strongest measurable claim remains a 0% wrong-match rate against B1's 16%.

---

## Block 6: Core rules and tests (2026-11-03)

**Goal.** Pure `src/core` rules for R-CUR, R-AMT, R-DUP, and R-REQ, with no I/O, and at least one named test per rule ID.

**Built.**

| File | Rules | Key behaviour |
|---|---|---|
| `money.ts` | (helpers) | Integer cents; ISO currency check |
| `currency.ts` | R-CUR-1 to 5 | AUD skips FX; rate for the date or the latest earlier business day (7-day lookback); no rate means `FX_RATE_UNAVAILABLE`, the amount is excluded, and the summary shows it by currency; a missing or low-confidence currency is never assumed to be AUD |
| `amounts.ts` | R-AMT-1 to 4, R-CUR-4 | Signed difference plus AUD gap; strict "over" 10% **or** $100; above one cent and under the threshold is "small" (badge); foreign purchases compare on the original amount, so the FX fee is never a difference; reason of 3+ characters |
| `duplicates.ts` | R-DUP-1, 2 | Same hash, or same normalised vendor + date + total + currency; the earliest upload is the original, copies of copies point at it; flags only, never deletes |
| `required.ts` | R-REQ-1 to 3 | Blank and placeholder purposes; "Unknown — set payment source"; `bank` matches bank lines |

Thresholds are function arguments (`AmountPolicy`), never read from `.env`. The boundary test enforces that.

**How it was checked.** 42 core tests, every rule ID from R-CUR-1 to R-REQ-3 covered. Because they all passed on the first run, 8 deliberate rule changes were then tried (for example OR → AND on R-AMT-2, `>` → `>=` on the $100 limit, dropping the date from the duplicate key). 7 were caught. The 8th survived because it was dead code (a guard against an `unknown` account that cannot exist), so the guard was removed rather than a test added.

**What went wrong.** Only the dead-code guard above (logged in the AI corrections log).

**Open.** R-MAT (scoring, auto-match, R-MAT-7 no-receipt lines), R-CAT, R-QUA, R-APR, and R-QUE rules are Day 2 work (`05`; TRACKER Day 2 "Remaining `src/core` rules with tests").

---

## Day 1 summary

All six blocks are done, and the v1 scope and targets are approved. The two facts that most shape the rest of the sprint:

1. **B1 is strong.** On clean synthetic data, ChatGPT already reads, categorises, and finds payments at 100%. The system's measurable edge is the 16% → 0% wrong-match rate and ledger integrity (one payment per receipt), plus whatever the Day 4 stress cases reveal.
2. **The human evidence is thin.** The interview is second-hand, B0 is an estimate (30 s to 1 min per receipt), and B1 time to close is not measured yet. The case study must say so plainly.
