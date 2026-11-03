# Sprint Tracker

Read this at the start of every session and update it at the end. This tracker records facts for the handoff. It does not replace the evaluation or case-study documents.

**Status values (use exactly one per task):** `Done`, `In Progress`, `Deferred`, `Skipped`, `Blocked`.

- `Done` entries include: date, changed paths, and validation (the command and its result).
- `Deferred`, `Skipped`, and `Blocked` entries include: the reason and the resume condition.

## Current status

**Day 1 complete** (2026-11-03). All six blocks are done, and the v1 scope and targets are approved. **B1 already meets four `03` targets; its weakness is a 16% wrong-match rate.** B1 time to close is 5 min 35 s mean for 20 receipts (about 11 min 10 s extrapolated to 40). Next: Day 2 (`days/day-2-design-and-v0/README.md`). See `days/day-1-discover-and-baseline/README.md`.

## Tasks

### Day 1: Discover, map, and baseline

Block-by-block detail: [`days/day-1-discover-and-baseline/journal.md`](days/day-1-discover-and-baseline/journal.md)

- [x] Scaffold the repository and `.env.example`: `Done` 2026-11-02. Paths: `package.json`, `tsconfig.json`, `biome.json`, `vitest.config.ts`, `next.config.ts`, `drizzle.config.ts`, `.env.example`, `.gitignore`, `src/config/env.ts`, `src/adapters/db/{client,schema}.ts`, `src/core/boundary.test.ts`, `src/app/{layout,page}.tsx`, `drizzle/0000_*.sql`. Validation: `pnpm typecheck` OK; `pnpm lint` 0 errors; `pnpm test` 3 files, 8 tests passed; `pnpm db:generate` created `run_log` migration; `pnpm build` OK; `pnpm start` served `/` showing "Mode: replay" with no `.env`.
- [x] Synthetic dataset, ground truth, splits, baseline subset: `Done` 2026-11-02. Paths: `scripts/generate-dataset.ts`, `scripts/dataset/*`, `src/core/schemas.ts`, `fixtures/dataset/**`. 40 receipts (23 PDF, 14 phone-photo JPEG, 3 PNG; 6 layouts), 44 statement lines in two CSV formats, splits 24/16 (stratified), 20-item baseline subset plus the B0 kit. Validation: `pnpm dataset` OK (about 12 s); `pnpm test` 5 files, 36 tests passed (spec invariants plus fixture hashes and sizes); `pnpm lint` and `pnpm typecheck` clean; R02, R10, and R11 inspected by eye.
- [x] Interview the Accounting user; notes in `days/day-1-discover-and-baseline/interview-notes.md` (human): `Done` 2026-11-03, **second-hand**. The Accounting user was unavailable, so the candidate answered from the October UAT; each answer is marked seen or estimate. Paths: `interview-notes.md`, `01` (Day 1 status), `02` (hypothesis result). Validation: n/a (evidence record).
- [x] Confirm `CONFIRM WITH USER` rules in `05` (human): `Done` 2026-11-03. R-AMT-2 (OR), R-AMT-3, TC04, R-DUP-1, and R-REQ-3 (`bank`) were applied on 2026-11-02. R-QUA-1 default kept (receipts are roughly letter-size; no pixel sizes known).
- [ ] B0 manual baseline, timed and scored (human + agent): `Skipped` 2026-11-03. The Accounting user is unavailable; the candidate has seen the answer key; an agent cannot stand in for a person. Recorded instead: a **labelled time estimate** for the current, post-redesign process: 30 s–1 min per receipt (revised from 1–4 min), giving 20–40 min for the 40-receipt month, in `days/day-1-discover-and-baseline/baseline-b0.md`. Accuracy not measured. Resume condition: a person who has not seen the repo runs `fixtures/dataset/baseline/b0-kit/`.
- [x] B1 single-prompt baseline ×3, scored: `Done` 2026-11-03. Paths: `eval-results/baseline-b1/`, `days/day-1-discover-and-baseline/baseline-b1-runs.md`, `scripts/eval/*`, `scripts/score-baseline.ts`. Validation: `pnpm score:baseline` over the 3 runs; 50/50 tests pass. Time to close: **5 min 35 s mean for 20 receipts** (5:26, 5:31, 5:47 full session, reported by the candidate on 2026-11-03), about 11 min 10 s extrapolated to 40 receipts. Run 1 used a different model (GPT 6-Sol) from runs 2 and 3 (GPT 5.6-Sol).
- [x] Metrics table baseline columns filled; v1 scope approved: `Done` 2026-11-03. Paths: `03-scope-and-success.md` (approval note, B0 and B1 columns, targets). The candidate approved the scope and targets. Open risk: the time target (≤ 10 min for 40 receipts) is tight.
- [x] Core rule tests: R-CUR, R-AMT, R-DUP, R-REQ: `Done` 2026-11-03. Paths: `src/core/{money,currency,amounts,duplicates,required}.ts` and their `*.test.ts`. Validation: `pnpm test` 10 files, 91 tests passed (42 in `src/core`); every rule ID from R-CUR-1 to R-REQ-3 has at least one named test; 8 deliberate rule mutations: 7 caught, 1 equivalent (dead code, removed); boundary test confirms no I/O in core; `pnpm typecheck` and `pnpm lint` clean.

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
| 2026-11-02 | R-AMT-2 uses the OR reading (over 10% **or** over $100) | AND reading | Candidate's ruling. Thresholds stay configurable because the finance lead owns the policy. | Yes (config) |
| 2026-11-02 | TC04: an over-threshold difference is never auto-paired; it goes to the queue as a candidate, and the flag fires when the human chooses that line | Score over-threshold amounts so they auto-pair, then flag; or treat as no payment found | Candidate's ruling ("flag as a different one", option a). Matches the existing scoring and keeps the human on any doubtful pairing. | Yes |
| 2026-11-02 | R-AMT-3: a small difference is a normal `matched` item with a "+$x.xx" badge, bulk-approvable | Separate low-priority `amount_differs` queue item | Candidate's ruling. Tips and surcharges should not cost a human touch. | Yes |
| 2026-11-02 | Duplicates are marked, never deleted | Auto-delete the later upload | Candidate's ruling. Keeps the audit trail. | Yes |
| 2026-11-02 | Add a `bank` payment source (R-REQ-3) | Record direct debits as `company_card` | Candidate's ruling. Direct debits now earn the account point. | Yes |
| 2026-11-02 | B1 is run by the candidate in ChatGPT, using a fixed prompt that gives the same information as B0 plus the policy | Agent runs B1 through an API; a minimal prompt | The brief says "simple ChatGPT use". A strong, fair prompt makes the comparison credible. | Yes |
| 2026-11-02 | Pin PDF timestamps in the generator | Accept churn | Every rerun rewrote all 23 PDFs and changed their hashes | Yes |
| 2026-11-03 | Interview answered second-hand by the candidate and labelled that way | Wait for the Accounting user; present it as a direct interview | The user is unavailable; presenting it as a direct interview would be invented evidence (non-negotiable 1) | Yes |
| 2026-11-03 | B1 free-text flags coded by fixed keyword rules on the Flags column only, with the coding printed in the report | Agent codes each flag by judgment; also read Notes | Repeatable and auditable; Flags is what a reviewer acts on | Yes |
| 2026-11-03 | For baselines, a receipt's "planted" exception is `exceptionsAfterMatchChoice` when present (TC04: the amount difference, not `AMBIGUOUS_MATCH`) | Require `AMBIGUOUS_MATCH` on TC04 | `AMBIGUOUS_MATCH` is how the system routes TC04, not the problem itself; a baseline that pairs and flags the difference has caught it | Yes |
| 2026-11-03 | Keep the `03` targets even though B1 already meets four of them on this set; state that plainly | Raise the targets to beat B1 | Changing targets after seeing the baseline would be moving the goalposts. The honest finding is that the system's edge must come from wrong matches, ledger integrity, and stress cases. | Yes |
| 2026-11-03 | B0 time is a labelled estimate (1–4 min per receipt, from the candidate); B0 accuracy is not measured | The candidate as a proxy (seen the answer key); an AI agent "simulating" manual work | An agent measures AI, not a person; presenting it as B0 would be an invented measurement. The estimate is labelled everywhere it appears, and the time target is judged against the low end of the band (≤ 20 min for 40 receipts). | Yes, if a person runs the B0 kit |
| 2026-11-03 | Add "statement lines with no receipt" to v1 scope (R-MAT-7), with link / substitute / not-an-expense actions | Leave out of v1 | From the interview: the Accounting user creates a substitute invoice when the payment is certain. It is cheap to build (whatever is left after matching), and the dataset already has 9 such lines. The candidate approved it. | Yes |
| 2026-11-03 | B0 estimate revised from 1–4 min to 30 s–1 min per receipt, explicitly for the current (post-redesign) process; the convincing time bar moves from ≤ 20 to ≤ 10 min | Keep 1–4 min; use the pre-redesign process | B0 must be the process the system replaces, not the one before the redesign (which the candidate also built). Revised before any system timing exists, and it makes B0 faster, so it cannot flatter the system. Both values are kept in `baseline-b0.md`. | Yes |
| 2026-11-03 | Human touches counted over receipts only; statement lines with no receipt reported as a separate count | Count no-receipt lines as items | Counting them makes the 35% target impossible by design (best possible 18/49 = 36.7%). Over receipts, the best possible is 9/40 = 22.5%. Set before any measurement. | Yes |
| 2026-11-03 | B1 time to close = the full-session times the candidate reported per run (5:26, 5:31, 5:47; mean 5:35), kept next to the earlier response-only times (25–29 s) | Use response time only; record B1 time as not measured | The full-session time is what the protocol defines as time to close. Both kinds stay visible, so the switch from response time to session time can be checked. The 40-receipt figure (about 11 min 10 s) is labelled as an extrapolation. | Yes |
| 2026-11-03 | Core money maths in integer cents | Floating-point dollars | Makes "above $0.01" and "exactly 10%" exact (0.1 + 0.2 ≠ 0.3 in floating point); covered by a test | Yes |
| 2026-11-03 | R-AMT-2 "over" is strict: exactly 10% or exactly $100 is not over | Inclusive (≥) | `05` says "over"; tested at both boundaries | Yes (one character) |
| 2026-11-03 | R-CUR-2 looks back at most 7 days for a rate | Unlimited lookback | Covers weekends and the longest ECB holiday gap, but a stale rate after a long outage falls to R-CUR-3 (unavailable) instead of being used silently | Yes (parameter) |
| 2026-11-03 | R-CUR-4 converts a foreign difference to AUD at the bank's implied rate (AUD charged / original amount) for the $100 test | Use the ECB rate | The bank's rate is the one actually paid, and it is available on the line itself with no lookup | Yes |
| 2026-11-03 | R-DUP-1 vendor normalisation drops case, accents, punctuation, and legal suffixes (Pty, Ltd, Inc, Co, GmbH...) | Exact text match | "SAMPLE CAFE" and "Sample Café" are the same vendor; a re-photo can read the name slightly differently | Yes |
| 2026-11-03 | R-REQ-1 placeholders also include "na", "n.a.", "--", ".", "nil", "null" | Only the three examples in `05` | Same intent as `05` ("placeholder text such as"); tested | Yes |
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
| 2026-11-02 | Dataset generator and the claim "a rerun gives the same data" | Chromium stamps each PDF with the current time, so every rerun changed all 23 PDF hashes | Agent noticed 23 changed binaries after a rules-only change, then pinned the timestamps; two reruns now give identical hashes | `b14526d` |
| 2026-11-03 | Test count in the TRACKER and journal entries for B1 | Written as "46/46" from memory; the real run showed 49 | Agent re-ran the tests and replaced it with the count from the output. Lesson: copy numbers from command output, never retype them. | `f8c94e3` |
| 2026-11-03 | `accountMatchesSource` with a `source !== "unknown"` guard | The guard was dead code: there is no `unknown` statement account, so removing it changed nothing (an equivalent mutant) | Mutation testing exposed it; the guard was removed and the doc comment explains why `unknown` still never matches | this commit |
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
  - *(Resolved 2026-11-02: candidate chose option (a); `05` and `06` were updated and ground truth expects `AMBIGUOUS_MATCH`, then `AMOUNT_DIFFERS_OVER_THRESHOLD` after the choice.)* **TC04 cannot reach its expected outcome under R-MAT as written.** A 12% difference earns no amount points (it is outside the threshold), so the best score is 25 (date) + 20 (vendor) + 5 (account) = 50. That gives `ambiguous`, not `amount_differs` with `AMOUNT_DIFFERS_OVER_THRESHOLD`. Decide in block 6 / Day 2: either score over-threshold amounts when date and vendor are strong, or accept TC04 as ambiguous-then-flagged. Ground truth keeps the intent from `06`.
  - R27's same-day distractor (31.20 vs 28.70) leaves a margin of exactly 20, the R-MAT-1 boundary. This is deliberate, and sensitive to Day 4 tuning.
  - *(Resolved 2026-11-02: `bank` added, R-REQ-3.)* The intake `paymentSource` enum has no `bank` value; direct-debit receipts (R24, R37) are recorded as `company_card`, so they never earn the +5 account point.

### 2026-11-03: Day 1, blocks 3 to 6

- Work done: second-hand interview notes; B1 scored (3 ChatGPT runs) with a reusable scorer; B0 recorded as a labelled estimate; scope addition R-MAT-7 (statement lines with no receipt); v1 scope and targets approved; core rules and tests for R-CUR, R-AMT, R-DUP, and R-REQ.
- Decisions: see the 2026-11-03 rows in the decision log (second-hand interview, flag coding, B0 estimate and its revision, human-touch definition, scope addition, core rule details).
- Validation: `pnpm test` 91/91; `pnpm typecheck` and `pnpm lint` clean; mutation check on 8 rule changes (7 caught, 1 equivalent).
- Remaining: optional B1 run 4 (stopwatch) to measure B1 time to close. Day 2 next.
- Known risks:
  - The time target (≤ 10 min for 40 receipts) is tight.
  - B1 already meets four targets on clean synthetic data, so improvement can only be shown on wrong matches, ledger integrity, and stress cases.
  - The interview and B0 rest on the candidate's estimates.

### YYYY-MM-DD: Session title

- Work done:
- Decisions:
- Validation:
- Remaining:
- Known risks:
