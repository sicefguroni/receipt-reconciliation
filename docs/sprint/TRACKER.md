# Sprint Tracker

Read this at the start of every session and update it at the end. This tracker records facts for the handoff. It does not replace the evaluation or case-study documents.

**Status values (use exactly one per task):** `Done`, `In Progress`, `Deferred`, `Skipped`, `Blocked`.

- `Done` entries include: date, changed paths, and validation (the command and its result).
- `Deferred`, `Skipped`, and `Blocked` entries include: the reason and the resume condition.

## Current status

Day 1 in progress. Scaffold and dataset done. Next action: Day 1 interview (human), then block 3 (interview notes into `01`/`02`/`03`/`05`). The B0 kit is ready in `fixtures/dataset/baseline/b0-kit/`. Open issue: TC04 cannot reach `AMOUNT_DIFFERS_OVER_THRESHOLD` under the R-MAT scoring as written (see known risks, 2026-11-02 session). See `days/day-1-discover-and-baseline/README.md`.

## Tasks

### Day 1: Discover, map, and baseline

Block-by-block detail: [`days/day-1-discover-and-baseline/journal.md`](days/day-1-discover-and-baseline/journal.md)

- [x] Scaffold the repository and `.env.example`: `Done` 2026-11-02. Paths: `package.json`, `tsconfig.json`, `biome.json`, `vitest.config.ts`, `next.config.ts`, `drizzle.config.ts`, `.env.example`, `.gitignore`, `src/config/env.ts`, `src/adapters/db/{client,schema}.ts`, `src/core/boundary.test.ts`, `src/app/{layout,page}.tsx`, `drizzle/0000_*.sql`. Validation: `pnpm typecheck` OK; `pnpm lint` 0 errors; `pnpm test` 3 files, 8 tests passed; `pnpm db:generate` created `run_log` migration; `pnpm build` OK; `pnpm start` served `/` showing "Mode: replay" with no `.env`.
- [x] Synthetic dataset, ground truth, splits, baseline subset: `Done` 2026-11-02. Paths: `scripts/generate-dataset.ts`, `scripts/dataset/*`, `src/core/schemas.ts`, `fixtures/dataset/**`. 40 receipts (23 PDF, 14 phone-photo JPEG, 3 PNG; 6 layouts), 44 statement lines in two CSV formats, splits 24/16 (stratified), 20-item baseline subset plus the B0 kit. Validation: `pnpm dataset` OK (about 12 s); `pnpm test` 5 files, 36 tests passed (spec invariants plus fixture hashes and sizes); `pnpm lint` and `pnpm typecheck` clean; R02, R10, and R11 inspected by eye.
- [ ] Interview the Accounting user; notes in `days/day-1-discover-and-baseline/interview-notes.md` (human)
- [ ] Confirm `CONFIRM WITH USER` rules in `05` (human)
- [ ] B0 manual baseline, timed and scored (human + agent)
- [ ] B1 single-prompt baseline ×3, scored
- [ ] Metrics table baseline columns filled; v1 scope approved
- [ ] Core rule tests: R-CUR, R-AMT, R-DUP, R-REQ

### Day 2: Design and v0

- [ ] `ARCHITECTURE.md`
- [ ] ModelClient (live/record/replay) and FxClient (live/cached)
- [ ] Remaining `src/core` rules with tests
- [ ] End-to-end pipeline, TC01 through the real model
- [ ] Eval skeleton; run `v0-day2`

### Day 3: Working core

- [ ] Review queue UI
- [ ] Statement CSV mapping (two formats)
- [ ] Month-end pack
- [ ] Run log and Runs page
- [ ] README draft; run `v1-day3` live
- [ ] First execution by the target user (human)

### Day 4: Evaluate, break, and harden

- [ ] `v2-day4-pre` full run and baseline comparison
- [ ] Stress cases; at least 3 failure analyses
- [ ] Fixes; `v2-day4-post`; before/after comparison
- [ ] User feedback session and changes (human)

### Day 5: Hand off and present

- [ ] `final` live run
- [ ] README, RUNBOOK, ARCHITECTURE, EVALUATION final; fresh-clone check
- [ ] CASE_STUDY, AI_COLLABORATION, NEXT_ITERATION
- [ ] Demo recorded (human)
- [ ] Final checklist in `08` complete

## Decision log

Record decisions made under ambiguity. These feed the case study and the "Ownership" rubric line.

| Date | Decision | Options considered | Reason | Reversible? |
|---|---|---|---|---|
| (pre-sprint) | Finance month-end reconciliation as the workflow | Chat-to-ticket triage; contractor invoice payout run | Strongest real-user evidence; measurable baseline; clear human-in-the-loop design | n/a |
| (pre-sprint) | Rules for money, model for perception only | Model end to end | UAT showed silent errors from rules applied in the wrong place (E1, E2) | Yes |
| 2026-11-02 | Pin TypeScript to 6.0.x | TypeScript 7.0 (latest) | TS 7 is the native compiler and ships no JS API (`main` absent); `next build` type-checks through that API | Yes, when Next supports TS 7 |
| 2026-11-02 | Pin `better-sqlite3` to 12.11.1 | 13.0.3 (latest); Node's built-in `node:sqlite`; libsql | 13.0.3 has no prebuilt binary for Windows + Node 24 (ABI 137), so install needs Visual Studio build tools; that breaks the 3-step setup for a Windows reviewer. 12.11.1 ships one. Keeps the documented stack (`04`). | Yes |
| 2026-11-02 | Biome instead of ESLint + Prettier | ESLint flat config | One tool for lint and format; Next 16 no longer ships `next lint`. Markdown excluded so the formatter never rewrites docs. | Yes |
| 2026-11-02 | Enforce the `src/core` boundary with a test (`src/core/boundary.test.ts`) | Lint rule (Biome `noRestrictedImports`); documentation only | A test fails `pnpm test` the moment core imports an adapter, Node I/O, `process.env`, or `fetch`. It checks the "money rules are pure" claim rather than just stating it. | Yes |
| 2026-11-02 | Policy thresholds live in `.env`, validated by Zod with defaults equal to `05` | Hard-coded constants; JSON config | `04` lists thresholds in `.env`; Zod defaults mean replay mode runs with no `.env`; `CONFIRM WITH USER` values (R-AMT-2, R-QUA-1) change without a code edit | Yes |
| 2026-11-02 | Ground truth written by hand per scenario, never computed by `src/core` | Derive expected codes by running the rules | If the rules computed the answers, the eval would only check the code against itself | Yes |
| 2026-11-02 | Stratified tuning/holdout split (hard vs routine, each 60/40) | Plain seeded shuffle | The plain shuffle put TC04, TC05, TC06, and TC11 all in tuning, so "0% wrong auto-match on holdout" would have passed without being tested | Yes |
| 2026-11-02 | Both statement formats hold the same transactions | Two different accounts, one per format | Day 3 column mapping can then be checked by confirming both formats give identical lines | Yes |
| 2026-11-02 | Duplicates expect only `DUPLICATE` (no `NO_PAYMENT_FOUND`), status `unmatched`, excluded from totals | Also expect `NO_PAYMENT_FOUND` | A duplicate is resolved by discarding it; a second flag would double-count one problem in the queue | Yes |
| 2026-11-02 | `pnpm` scripts limited to ones that work today (`dev`, `build`, `test`, `typecheck`, `lint`, `db:*`). `seed`, `eval`, `eval:compare` are added when their scripts exist. | Stub scripts that print "not yet" | A command that exists but does nothing would be a claim the code does not back | Yes |

## AI corrections log

Keep a running list for `AI_COLLABORATION.md`. Do not reconstruct it at the end.

| Date | What AI produced | What was wrong | What was done | Commit |
|---|---|---|---|---|
| 2026-11-02 | Plan to scaffold in a separate new repository, following `HANDOFF.md` | This folder already is the new repository | **Human correction.** Scaffolded here; `HANDOFF.md` kept out of git through `.git/info/exclude` | `3b159db` |
| 2026-11-02 | Installed the latest `better-sqlite3` (13.0.3) | No Windows + Node 24 prebuilt binary; install needs Visual Studio, which breaks 3-step setup for a Windows reviewer | Agent checked release assets and pinned 12.11.1 | `3b159db` |
| 2026-11-02 | Ran `biome format` over the whole repo | It re-padded the tables in `CLAUDE.md` (whitespace only) | Agent excluded `*.md` from Biome | `3b159db` |
| 2026-11-02 | Secrets check before the first commit | Wrong `git grep` flag order; it printed "none" without running | Agent noticed the error in the output and re-ran it correctly before committing | `3b159db` |
| 2026-11-02 | First commit's `tsconfig.json` | `next build` had rewritten it; `pnpm lint` failed on the committed tree | Agent formatted it once and confirmed a rebuild leaves it unchanged | `3f1eb24` |
| 2026-11-02 | Seeded random tuning/holdout split | Every hard matching case (TC04, TC05, TC06, TC11) landed in tuning | Agent stratified the split and added a test requiring hard cases in holdout | `5bc626d` |
| 2026-11-02 | R10 re-photographed duplicate of R08 | Showed a different invoice number and time from R08 | Agent made duplicates reuse their original's printed details | `5bc626d` |
| 2026-11-02 | Fixtures README file counts | Placeholder text ("18 PDF, 8 PNG...") left in | Agent corrected it from `receipts.json` | `5bc626d` |
| 2026-11-02 | Repo-wide `eol=lf` in `.gitattributes` | Normalised fixture CSVs, which should keep CRLF like real bank exports | Agent marked `fixtures/**/*.csv` as `-text` | `7d069ae` |

## Session history

### 2026-11-02: Day 1, block 1, scaffold

- Work done: read `00`–`06`; initialised git (`main`); scaffolded Next.js 16 (App Router), TypeScript 6 strict (`noUncheckedIndexedAccess` on), Vitest 5, Drizzle + `better-sqlite3`, Biome; Zod-validated env config with all `05` thresholds; first `run_log` table and migration; core boundary test.
- Decisions: six rows added to the decision log (TS 6 pin, `better-sqlite3` pin, Biome, boundary test, thresholds in `.env`, no stub scripts).
- Validation: `pnpm typecheck` OK · `pnpm lint` clean · `pnpm test` 8/8 passed · `pnpm build` OK · `pnpm start` served `/` in replay mode with no `.env`.
- Remaining: Day 1 blocks 2–6. Nothing committed yet; the first commit is waiting for the human's go-ahead.
- Known risks: Biome's first `format` run (before Markdown was excluded) re-padded the tables in `CLAUDE.md`; this was whitespace only, with no content change. The Frankfurter URL in `.env.example` is not yet verified (planned for Day 2 per `04`).

### 2026-11-02: Day 1, block 2, dataset generator

- Work done: `pnpm dataset` renders 6 HTML layouts with Playwright (PDF, PNG, and phone photos degraded with `sharp`), writes intake metadata, ground truth, two statement formats, stratified splits, the baseline subset, and a ready-to-use B0 kit. Private GitHub repo `sicefguroni/receipt-reconciliation` created and the scaffold pushed.
- Decisions: four rows added to the decision log (hand-written ground truth, stratified split, same transactions in both formats, duplicate expectations).
- Validation: 36/36 tests passed, including checks that the committed fixtures match the spec (hashes, pixel sizes, exact-duplicate hash).
- Remaining: Day 1 blocks 3 to 6; most need the interview first.
- Known risks:
  - **TC04 cannot reach its expected outcome under R-MAT as written.** A 12% difference earns no amount points (it is outside the threshold), so the best score is 25 (date) + 20 (vendor) + 5 (account) = 50. That gives `ambiguous`, not `amount_differs` with `AMOUNT_DIFFERS_OVER_THRESHOLD`. Decide in block 6 / Day 2: either score over-threshold amounts when date and vendor are strong, or accept TC04 as ambiguous-then-flagged. Ground truth keeps the intent from `06`.
  - R27's same-day distractor (31.20 vs 28.70) leaves a margin of exactly 20, the R-MAT-1 boundary. This is deliberate, and sensitive to Day 4 tuning.
  - The intake `paymentSource` enum has no `bank` value; direct-debit receipts (R24, R37) are recorded as `company_card`, so they never earn the +5 account point.

### YYYY-MM-DD: Session title

- Work done:
- Decisions:
- Validation:
- Remaining:
- Known risks:
