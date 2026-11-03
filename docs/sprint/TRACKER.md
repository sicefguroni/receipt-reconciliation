# Sprint Tracker

Read this at the start of every session and update it at the end. This tracker records facts for the handoff. It does not replace the evaluation or case-study documents.

**Status values (use exactly one per task):** `Done`, `In Progress`, `Deferred`, `Skipped`, `Blocked`.

- `Done` entries include: date, changed paths, and validation (the command and its result).
- `Deferred`, `Skipped`, and `Blocked` entries include: the reason and the resume condition.

## Current status

**Day 3 built; user session pending** (2026-11-03). Blocks 1–5 are done and merged to `main` (PR #1, rebase merge): every review action (including R-MAT-7) works through a pure reconcile step that re-derives the month from what was read plus each human decision; both statement formats read; the full pack and the Runs page exist; README drafted. `v1-day3` live: 12/12, 0/33 wrong auto-match, every metric unchanged from Day 2; a simulated reviewer closes the month to the ground-truth ledger total; 22/22 browser checks on a production build. **There is no Accounting user:** block 6 is a naive proxy session plus a builder cold run (candidate's ruling), protocol in `days/day-3-working-core/first-run-observations.md`. Next: run those two sessions, then Day 4. See `days/day-3-working-core/journal.md`.

**Day 2 complete** (2026-11-03). All four exit criteria are met. The runtime model is now **OpenAI `gpt-5.6-sol`** (candidate's ruling). The whole October month was run live and recorded: **`v0-day2` passes 12/12 TCs with 0/33 wrong auto-matches** (0/14 on holdout), live and in replay with no key. On B1's 20 receipts the wrong-match rate is 0/14 vs B1's 3/19. Cost is at most USD 0.45 for the month. Two scoring weaknesses are queued for Day 4 (wordmark vendor names; no date gate). Next: Day 3 (`days/day-3-working-core/README.md`): review actions, column mapping, the full pack, the Runs page, and the first user session. See `days/day-2-design-and-v0/journal.md`.

**Day 1 complete** (2026-11-03). B1 already meets four `03` targets; its weakness is a 16% wrong-match rate. B1 time to close is 5 min 35 s mean for 20 receipts.

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

Block-by-block detail: [`days/day-2-design-and-v0/journal.md`](days/day-2-design-and-v0/journal.md)

- [x] `ARCHITECTURE.md`: `Done` 2026-11-03. Paths: `docs/ARCHITECTURE.md`; `04-system-design.md` "As built (Day 2)" section. Validation: every number in it is copied from `eval-results/v0-day2/summary.json` or a recordings count (one estimate corrected, see the AI corrections log).
- [x] ModelClient (live/record/replay) and FxClient (live/cached): `Done` 2026-11-03. Paths: `src/adapters/model/*`, `src/adapters/fx/*`, `src/adapters/statement/*`, `src/adapters/db/*`, `drizzle/0001_*.sql`, `.env.example`, `src/config/env.ts`. OpenAI Responses API with structured output and `store: false`; replay by request hash; Frankfurter range endpoint verified; SQLite FX cache. Validation: 17 adapter tests, including an FX outage served from the cache and a missing recording failing loudly; the format-A reader reproduces all 44 ground-truth lines from the real CRLF bytes.
- [x] Remaining `src/core` rules with tests: `Done` 2026-11-03. Paths: `src/core/{matching,categories,quality,approvals,queue,receipt-state,privacy}.ts` and tests, `config/categories.json`. Validation: 115 tests in `src/core`; every rule ID in `05` has at least one named test (checked by script); 23 single-rule mutations, all caught; boundary test passes.
- [x] End-to-end pipeline, TC01 through the real model: `Done` 2026-11-03. Paths: `src/pipeline/*`, `src/server/months.ts`, `src/app/**`, `scripts/seed.ts`. Validation: TC01 + TC02 live through `pnpm eval` (`eval-results/v0-day2-tc01-live`), and through the upload page on a live production server (R01 matched to L03; R02 converted at the real ECB rate 1.4367, ledger $77.12 = AUD charged); replay upload and the unrecorded-file message checked in a browser; `pnpm build` 0 warnings; `pnpm seed` loads the month with no key.
- [x] Eval skeleton; run `v0-day2`: `Done` 2026-11-03. Paths: `scripts/eval.ts`, `scripts/eval/system.ts`, `scripts/eval-compare.ts`, `config/pricing.json`, `docs/EVALUATION.md`, `eval-results/{v0-day2,v0-day2-live,v0-day2-tc01-live,v0-day2-subset20,oracle-day2}/`, `fixtures/recordings/**`. Validation: `pnpm eval -- --mode replay --label v0-day2` with the key blanked: 12/12 TCs, identical to the live run (`pnpm eval:compare` shows no change); `pnpm test` 22 files, 226 tests passed; `pnpm typecheck` and `pnpm lint` clean.

### Day 3: Working core

Block-by-block detail: [`days/day-3-working-core/journal.md`](days/day-3-working-core/journal.md)

- [x] Review queue UI: `Done` 2026-11-03. Paths: `src/pipeline/{read-month,reconcile,decisions,config,test-month}.ts`, `src/server/months.ts`, `src/app/{actions.ts,labels.ts,layout.tsx,globals.css,page.tsx}`, `src/app/review/[runId]/*`, `src/app/files/**`, `src/config/people.ts`, `src/core/{schemas,approvals,queue,matching}.ts`, `drizzle/0002_*.sql`, `05` (R-APR-2 addition). Validation: `pnpm test` 24 files, 261 tests passed (oracle month unchanged with no decisions; simulated reviewer closes the month to the ground-truth ledger total); 6 single-rule mutations all caught after adding 2 tests; scripted browser run on `pnpm build && pnpm start`, 22/22 checks; typecheck, lint, build clean.
- [x] Statement CSV mapping (two formats): `Done` 2026-11-03. Paths: `src/adapters/statement/read-statement{,.test}.ts` (format-A reader removed). Validation: 12 tests; format B gives lines identical to the ground truth; bad files give named problems; browser start from format B.
- [x] Month-end pack: `Done` 2026-11-03. Paths: `src/pipeline/pack.ts`, `src/app/pack/[runId]/{page.tsx,ledger.csv,exceptions.csv}`. Validation: closed-month test (category and payment-source totals equal the ledger; no open exception rows); browser download of both CSVs with the substitute row and the sign-off reason.
- [x] Run log and Runs page: `Done` 2026-11-03. Paths: `src/pipeline/run-log.ts` (`statement`, `run` stages; fixed error codes), `src/app/runs/**`. Validation: browser run shows a failed statement upload as `STATEMENT_FORMAT` and no receipt or statement text.
- [x] README draft; run `v1-day3` live: `Done` 2026-11-03. Paths: `README.md`, `eval-results/v1-day3{,-replay}/`, `fixtures/recordings/**`, `docs/EVALUATION.md`. Validation: `pnpm eval -- --mode live --label v1-day3` 12/12, 0/33; `eval:compare -- v0-day2-live v1-day3` all same; replay with the key blanked identical.
- [ ] First execution by the target user (human): `Blocked` 2026-11-03. No Accounting user exists for this sprint. Candidate's ruling: a naive proxy (admin or bookkeeping background, never seen the repo) plus a builder cold run, each labelled. Resume condition: run both sessions with `days/day-3-working-core/first-run-observations.md` and fill in its record.

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
| 2026-11-03 | Keep the approved ≤ 10 min time target; frame speed as "about as fast as B1, faster than B0" and correctness (0% vs 16% wrong matches) as the headline | Add a B1-relative time target (≤ ~5.5 min, 50% less than B1) | About 20 human decisions are required by design, so ≤ 5.5 min is unrealistic. The approved target already beats both baselines. Correctness is where B1 measurably fails. Recorded in `03`, "Business value link". | Yes |
| 2026-11-03 | Core money maths in integer cents | Floating-point dollars | Makes "above $0.01" and "exactly 10%" exact (0.1 + 0.2 ≠ 0.3 in floating point); covered by a test | Yes |
| 2026-11-03 | R-AMT-2 "over" is strict: exactly 10% or exactly $100 is not over | Inclusive (≥) | `05` says "over"; tested at both boundaries | Yes (one character) |
| 2026-11-03 | R-CUR-2 looks back at most 7 days for a rate | Unlimited lookback | Covers weekends and the longest ECB holiday gap, but a stale rate after a long outage falls to R-CUR-3 (unavailable) instead of being used silently | Yes (parameter) |
| 2026-11-03 | R-CUR-4 converts a foreign difference to AUD at the bank's implied rate (AUD charged / original amount) for the $100 test | Use the ECB rate | The bank's rate is the one actually paid, and it is available on the line itself with no lookup | Yes |
| 2026-11-03 | R-DUP-1 vendor normalisation drops case, accents, punctuation, and legal suffixes (Pty, Ltd, Inc, Co, GmbH...) | Exact text match | "SAMPLE CAFE" and "Sample Café" are the same vendor; a re-photo can read the name slightly differently | Yes |
| 2026-11-03 | R-REQ-1 placeholders also include "na", "n.a.", "--", ".", "nil", "null" | Only the three examples in `05` | Same intent as `05` ("placeholder text such as"); tested | Yes |
| 2026-11-03 | Runtime model provider is OpenAI (Responses API), `gpt-5.6-sol` for extraction and the category fallback | Claude (`04` default); a cheaper model for categorisation | **Candidate's ruling:** OpenAI is the API the candidate has access to. `gpt-5.6-sol` is the model of B1 runs 2–3, so the system-vs-B1 comparison holds the model constant and isolates the design (rules, one line per receipt, ambiguity to a person). Same model for both tasks: one access check, and the fallback rarely runs. Only the adapter and config change; `src/core` has no model dependency. | Yes (adapter + `.env`) |
| 2026-11-03 | `MODEL_REASONING_EFFORT=low` default | `medium` / `high` | Reading a receipt is perception, and the ≤ 10 min time target needs low latency. Revisit on Day 4 if extraction accuracy misses ≥ 95% on holdout. | Yes (config) |
| 2026-11-03 | Two extraction schemas: a loose model-facing one (types only) and the strict `Extraction` in `src/core` | One strict schema sent to the model | Structured output enforces types, not domain rules; a strict check after the call is what makes the `04` "retry once with the validation error" path real | Yes |
| 2026-11-03 | An extraction failure becomes `UNREADABLE` with "enter its details by hand" | A new exception code | `04` names the behaviour but no code; reusing a blocking group-1 code keeps the code list at 11 | Yes |
| 2026-11-03 | Replay key = SHA-256 of task, model, effort, prompt text and version, output JSON schema, and each file's SHA-256 (not its bytes) | Key on file and model only | Any prompt or schema change makes old recordings miss loudly instead of answering for a different request | Yes |
| 2026-11-03 | One FX range call per foreign currency per month (`month start − 7 days` to month end), cached in SQLite; when the API fails, cached rates are served, and with none, R-CUR-3 | One call per receipt | Fewer calls; the 7-day lead covers the R-CUR-2 lookback; an outage degrades to the cache, never to a rate of 1 | Yes |
| 2026-11-03 | R-CAT-1 checks the vendor name, then the item summary; seed keyword `stationery` → `stationer` | Vendor only; keep `stationery` | A hardware store sells both chairs and printer supplies; `stationer` matches stationers and stationery. Found by the oracle test (R35). Risk logged: one summary word can decide a mixed basket. | Yes |
| 2026-11-03 | Matching is globally greedy: the receipt with the highest available score is decided first, then all are re-scored | Process receipts in upload order | R-MAT-4 says "assign greedily by highest score"; upload order would let a weak early receipt take a line from a strong later one | Yes |
| 2026-11-03 | Add an `oracle` eval mode (ground-truth fields in place of the model) | Live and replay only | Separates rules errors from perception errors. Expected outcomes stay hand-written, so it does not grade the rules against themselves. | Yes |
| 2026-11-03 | Run TC01 together with TC02 for the live end-to-end check | TC01 alone | TC01 is AUD, so by R-CUR-1 it never calls the FX API; TC02 (USD) exercises it | n/a |
| 2026-11-03 | Record the full 40-receipt month live on Day 2, so `v0-day2` is a full-set run | TC01 + TC02 only; full live run on Day 3 | **Candidate approved** (measured cost about USD 0.011 per receipt). The full replay eval, `pnpm seed`, and the UI then work with no key from Day 2. | n/a |
| 2026-11-03 | Report cost as an upper bound (all input tokens at the full rate) | Assume a cache-hit share | The run log does not split cached from uncached input; an assumed share would be an invented number | Yes (log cached tokens) |
| 2026-11-03 | Price for `gpt-5.6-sol` in `config/pricing.json`: USD 4.00 / 1M input, 0.40 cached, 20.00 output, "OpenAI API Pricing page, as reported by the candidate", 2026-11-03 | Leave cost unmeasured | `06` needs the price in config with its source and date; the source is labelled as reported, not fetched by the agent | Yes |
| 2026-11-03 | The ledger CSV prefixes cells that start with `= + - @` with `'` (plain numbers excepted); uploads drop leading dots from filenames | Write cells as-is | Vendor names come from a model reading uploaded files (untrusted); a formula cell could run when the Accounting user opens the CSV | Yes |
| 2026-11-03 | Do not fix the two Day 2 scoring findings (wordmark vendor names; no date gate) until Day 4 | Fix now | `06` tunes scoring on the tuning split with a before/after comparison; fixing after seeing the full set would contaminate the holdout claim. Both fail safe today. | n/a |
| 2026-11-03 | The B1 comparison uses the system on the same 20 receipts (`v0-day2-subset20`), not the 40-receipt run | Compare against the full-set run | Like for like. The subset run is slightly harder (more free statement lines), and it surfaced the date-gate finding. | n/a |
| 2026-11-03 | Split the pipeline: `readMonth` (I/O: gate, model, categories, FX fetch) stores a snapshot; `reconcileMonth` (pure) derives exceptions, matches, statuses, queue, and totals from the snapshot **plus every human decision**, on every view | Store derived statuses and patch them per decision; re-run the whole pipeline per decision | Statuses stay derived, never hand-picked (non-negotiable 3); a correction flows through FX, duplicates, and matching the same way the pipeline would; no model call per decision. With no decisions it reproduces Day 2 exactly (oracle month test unchanged). | Yes |
| 2026-11-03 | Decisions are append-only rows; the latest of each kind wins; approved items are locked; approval keeps the match the item had (`after` records it) | Editable decision rows; un-approve | Audit trail without updates or deletes; locking stops a later correction from silently changing an approved amount. Undo is a Day 4 candidate if the user session asks for it. | Yes |
| 2026-11-03 | A person's chosen line is assigned before automatic matching; when two choices claim one line, the later wins and the other receipt is re-matched (R-MAT-4) | Refuse the second choice | The later choice is the person's latest judgement; refusing would force an extra step. Tested. | Yes |
| 2026-11-03 | Lines resolved as substitute or "not an expense" leave the matching pool | Keep them matchable | "The payment is real but the receipt is missing" means no receipt should take it; keeps a later correction from re-matching it silently | Yes |
| 2026-11-03 | R-APR-2 extended: an item with no category at all cannot be approved (a flagged suggestion still can) | Keep R-APR-2 as written; block every `UNKNOWN_CATEGORY` | Without it an approved item enters the ledger uncategorised. The Day 2 test that allows approving a flagged suggestion is kept. `05` and a named test updated in the same commit. | Yes |
| 2026-11-03 | "No receipt" lines that are an open receipt's real candidate (score ≥ 40) say "could be the payment for R04" and offer Link first | List them like any other line | Found by the automated month close: L16 ($560, TC04's line) sorts above R04 ($500) in group 4, so a reviewer working top-down wrote it off as "not an expense" and R04 could no longer be matched | Yes |
| 2026-11-03 | Statement formats are column-name mappings (`STATEMENT_FORMATS`), detected from the header; every bad row is reported at once with its spreadsheet row number | One parser per format; stop at the first error | Columns found by name survive reordered exports; one pass to fix a file. Format B gives lines identical to the ground truth (tested). | Yes |
| 2026-11-03 | The sample month starts from the 40 submitted receipts plus a statement the user uploads (or the sample one); own receipts upload as a batch per submitter | Upload 40 files with per-file metadata | Matches the real flow: staff submit during the month, Accounting brings the statement. Per-receipt purpose is editable in the queue. | Yes |
| 2026-11-03 | Simulated people in a header switcher (`src/config/people.ts`), cookie only | Real sign-in | `03` non-goal; enough to show R-APR-1 (disabled, with the reason beside it) | Yes |
| 2026-11-03 | Failed runs and statement reads are logged (`statement`, `run` stages) with fixed error codes only, never messages | Log the message | A message can quote file contents (a CSV row); codes keep the log PII-free and still show on the Runs page | Yes |
| 2026-11-03 | **No Accounting user; first execution by a naive proxy (admin or bookkeeping background, never seen the repo) plus a builder cold run, each labelled** | Builder run only; an AI-driven "user" run | **Candidate's ruling.** Only someone else can answer "can someone else run it?"; the builder run is like-for-like with B1 (also the candidate's). Automated runs are completeness evidence, never a user session. | n/a |
| 2026-11-03 | Run `v1-day3` live (about USD 0.45) | Replay only | **Candidate approved.** Exit criterion: model API, FX API, and CSV import working today | n/a |
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
| 2026-11-03 | R-CAT-1 rule matching that falls back to the item summary when the vendor has no keyword | R35 "Sample Stationers" (markers, notebooks, a desk organiser) went to Equipment: the vendor missed the `stationery` keyword, and one summary word ("desk") decided the basket. All 163 unit tests had passed; the oracle month test caught it. | Agent changed the seed keyword to `stationer` (matches stationers and stationery), updated `05` and added a named test in the same commit; the mixed-basket risk is logged in `05` | Day 2 block 2 commit |
| 2026-11-03 | `ARCHITECTURE.md` draft: "the category model runs for 15 of 40 receipts" | Written from an estimate; the recordings show 10 categorise calls | Agent counted the recordings by task and corrected it before committing. Same lesson as the 2026-11-03 test-count entry: copy numbers from output. | Day 2 docs commit |
| 2026-11-03 | `ui-check` browser script (scratch) waited for `/upload` after submitting the upload form | It matched the page it was already on, so it read the page before the redirect and reported an empty error | Agent waited for `/review/…` or `/upload?error=…` specifically and re-ran; also found Next's hidden route announcer shares `role="alert"` | n/a (scratch) |
| 2026-11-03 | TC07 assertions in `scripts/eval/system.ts` required every TC07 receipt to be a duplicate | R08 is the original in the TC07 group and is correctly not flagged; the checker failed a correct system | Agent split the assertions: copies must be flagged and excluded, the original must not be flagged and must stay in totals | `e94beef` |
| 2026-11-03 | A shell command that started with an empty `python -` heredoc | Opened Python's interactive prompt and hung (the same trap as Day 2's heredoc); the edit after it never ran | Agent stopped it, confirmed nothing was half-applied, and made the edits with the editor tool | Day 3 commit |
| 2026-11-03 | Review queue listed TC04's candidate line (L16, $560) as a plain "No receipt" line | Group 4 sorts by amount, so L16 came before R04 ($500); the automated month close wrote it off as "not an expense" and R04 could never be matched. All 12 single-action tests had passed. | Agent added "could be the payment for R04" with Link offered first, plus a test; the simulated reviewer now links lines that have an owner | Day 3 commit |
| 2026-11-03 | Two decision tests passed a receipt object to `checkApproval` without `status` | They passed only because an exception blocked approval first; typecheck caught it | Agent added a `subject()` helper building the full approval subject | Day 3 commit |
| 2026-11-03 | Day 3 decision tests (first version) | Mutation check: removing "a substitute needs a reason" and "the later choice wins a line" went unnoticed (2 of 6 survived) | Agent added a named test for each and re-ran the two mutations | Day 3 commit |
| 2026-11-03 | `.group:first-of-type` to colour group 1's ticks red | It would have matched the progress `<section>`, not group 1 | Agent noticed while reviewing the CSS and used `.g1`/`.g2` classes | Day 3 commit |
| 2026-11-03 | Review page: group totals in their own grid | Screenshot showed group totals left of the row amount column | Agent gave the heading the rows' column template (`--ledger-cols`) | Day 3 commit |
| 2026-11-03 | Notices with a thick left accent border | Flagged by the design hook as a generic "side-tab" tell | Agent replaced it with a thin full border and the wash colour | Day 3 commit |
| 2026-11-03 | Browser check script waited for `networkidle` after a server action | Read the previous page's notice (stale) and then clicked a closed row. Also showed a real UX gap: the item closed after "Use this payment", so the next step (sign off) had to be found again | Agent waits for each action's own confirmation; the app now keeps the item open after a step that leads to another | n/a (scratch) / Day 3 commit |
| 2026-11-03 | Day 3 journal draft: "13 decision tests … 10 boundary tests" | Written from memory; counting the files gave 14 and 9 | Agent counted with `grep` and corrected before committing. Third time this lesson appears: copy numbers from output. | Day 3 docs commit |
| 2026-11-03 | Stopping `pnpm start` with the task tool | On Windows the `next` child kept running and held `data/app.db`, so `pnpm seed` failed with EPERM | Agent found the processes by port and stopped them; noted for the RUNBOOK | n/a |
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

### 2026-11-03: Day 2, design and v0

- Work done: switched the model provider to OpenAI; core rules R-MAT, R-CAT, R-QUA, R-APR, R-QUE plus state derivation and masking; model, FX, statement, and DB adapters; the month pipeline; `pnpm eval` (live, replay, oracle) and `eval:compare`; v0 pages and `pnpm seed`; the full month recorded live; `ARCHITECTURE.md`, `EVALUATION.md`, `04` "as built".
- Decisions: 16 decision-log rows added on Day 2, from "Runtime model provider is OpenAI" to "The B1 comparison uses the system on the same 20 receipts".
- Validation: `pnpm test` 226/226; typecheck, lint, and build clean (0 warnings); `v0-day2` 12/12 TCs live and in replay with no key; browser checks of upload → queue → CSV in replay and live.
- Remaining: Day 3 blocks. Statement lines with no receipt, review actions, and decisions exist as rules only; the Runs page is not built; format B is not read yet.
- Known risks:
  - The two scoring findings (see `EVALUATION.md`, "Findings queued for Day 4").
  - `.env` had been created in the parent folder (`must/`); the agent moved it into the repo root (gitignored), so the secret is in one place.
  - The live numbers are on clean synthetic data. The Day 4 stress cases are what will test the system.

### 2026-11-03: Day 3, working core (blocks 1–5)

- Work done: statement column mapping (A and B); pipeline split into read (I/O) and reconcile (pure, with decisions); every review action with one decision boundary; review UI; month-end pack and summary; Runs page with failed runs; README draft; `v1-day3` live and replay; session protocol for the proxy and builder runs.
- Decisions: 12 rows added on Day 3, from "Split the pipeline" to "Run `v1-day3` live".
- Validation: `pnpm test` 261/261; typecheck, lint, and build clean; 6/6 mutations caught; 22/22 browser checks on a production build; `v1-day3` 12/12 live and in replay, unchanged from `v0-day2-live`.
- Remaining: block 6 (proxy session and builder cold run). Merged to `main` through PR #1 (rebase merge, so commit hashes changed: code `f2b58e8`, eval `b31037a`, docs `bc1981e`).
- Known risks:
  - No real user has touched the review UI yet; the automated close shows each item *has* an action, not that a person finds it.
  - Approvals cannot be undone (approved items are locked); the session may ask for undo.
  - The two Day 2 scoring findings are still queued for Day 4.

### YYYY-MM-DD: Session title

- Work done:
- Decisions:
- Validation:
- Remaining:
- Known risks:
