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

## Block 3: Rules confirmation (2026-11-02, in progress)

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

**Open.** R-QUA-1 photo size; the B0 proxy decision; candidate-reported interview answers.
