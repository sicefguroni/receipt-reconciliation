# Sprint Tracker

Read this at the start of every session and update it at the end. This tracker records facts for the handoff. It does not replace the evaluation or case-study documents.

**Status values (use exactly one per task):** `Done`, `In Progress`, `Deferred`, `Skipped`, `Blocked`.

- `Done` entries include: date, changed paths, and validation (the command and its result).
- `Deferred`, `Skipped`, and `Blocked` entries include: the reason and the resume condition.

## Current status

Day 1 in progress. Scaffold done. Next action: Day 1 block 2, `scripts/generate-dataset.ts`. Human: book the interview and B0 slots. See `days/day-1-discover-and-baseline/README.md`.

## Tasks

### Day 1: Discover, map, and baseline

- [x] Scaffold the repository and `.env.example`: `Done` 2026-11-02. Paths: `package.json`, `tsconfig.json`, `biome.json`, `vitest.config.ts`, `next.config.ts`, `drizzle.config.ts`, `.env.example`, `.gitignore`, `src/config/env.ts`, `src/adapters/db/{client,schema}.ts`, `src/core/boundary.test.ts`, `src/app/{layout,page}.tsx`, `drizzle/0000_*.sql`. Validation: `pnpm typecheck` OK; `pnpm lint` 0 errors; `pnpm test` 3 files, 8 tests passed; `pnpm db:generate` created `run_log` migration; `pnpm build` OK; `pnpm start` served `/` showing "Mode: replay" with no `.env`.
- [ ] Synthetic dataset, ground truth, splits, baseline subset
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
| 2026-11-02 | `pnpm` scripts limited to ones that work today (`dev`, `build`, `test`, `typecheck`, `lint`, `db:*`). `seed`, `eval`, `eval:compare` are added when their scripts exist. | Stub scripts that print "not yet" | A command that exists but does nothing would be a claim the code does not back | Yes |

## AI corrections log

Keep a running list for `AI_COLLABORATION.md`. Do not reconstruct it at the end.

| Date | What AI produced | What was wrong | What was done | Commit |
|---|---|---|---|---|

## Session history

### 2026-11-02: Day 1, block 1, scaffold

- Work done: read `00`–`06`; initialised git (`main`); scaffolded Next.js 16 (App Router), TypeScript 6 strict (`noUncheckedIndexedAccess` on), Vitest 5, Drizzle + `better-sqlite3`, Biome; Zod-validated env config with all `05` thresholds; first `run_log` table and migration; core boundary test.
- Decisions: six rows added to the decision log (TS 6 pin, `better-sqlite3` pin, Biome, boundary test, thresholds in `.env`, no stub scripts).
- Validation: `pnpm typecheck` OK · `pnpm lint` clean · `pnpm test` 8/8 passed · `pnpm build` OK · `pnpm start` served `/` in replay mode with no `.env`.
- Remaining: Day 1 blocks 2–6. Nothing committed yet; the first commit is waiting for the human's go-ahead.
- Known risks: Biome's first `format` run (before Markdown was excluded) re-padded the tables in `CLAUDE.md`; this was whitespace only, with no content change. The Frankfurter URL in `.env.example` is not yet verified (planned for Day 2 per `04`).

### YYYY-MM-DD: Session title

- Work done:
- Decisions:
- Validation:
- Remaining:
- Known risks:
