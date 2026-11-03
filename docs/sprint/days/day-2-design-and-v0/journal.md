# Day 2 journal

One entry per block: what happened, what went wrong, and how it was checked. Decisions are in the `TRACKER.md` decision log and are not repeated here. This is source material for `CASE_STUDY.md` and `AI_COLLABORATION.md`.

---

## Before block 1: model provider switch (2026-11-03)

**Goal.** Use the model API the candidate actually has.

**What happened.** The agent had started preparing Claude API code from `04`'s defaults. The candidate interrupted: OpenAI is what is available. The agent installed the `openai` SDK and confirmed the current API surface from the SDK's own type definitions (`responses.parse`, `zodTextFormat`, `input_file` for PDFs, `input_image`, `reasoning.effort`) instead of writing from memory. The candidate chose `gpt-5.6-sol` for extraction and for the category fallback.

**Why it matters for the evaluation.** `gpt-5.6-sol` is the model of B1 runs 2 and 3, so the system-vs-B1 comparison now holds the model roughly constant. A gain in wrong-match rate is attributable to the design (rules, one line per receipt, ambiguity to a person), not to a different vendor's model.

**Changed.** `src/config/env.ts` (`OPENAI_API_KEY`, model defaults, `MODEL_REASONING_EFFORT`), `.env.example`, `04`, `08`. Frankfurter's range endpoint was verified at the same time (`/v1/{from}..{to}?base=USD&symbols=AUD`). Commit `fd9a857`.

**Verified.** 91/91 tests; typecheck and lint clean.

---

## Block 3 (done first): remaining core rules (2026-11-03)

**Goal.** Pure `src/core` rules for R-MAT, R-CAT, R-QUA, R-APR, and R-QUE, with a named test per rule ID. Done before the adapters because the pipeline and eval depend on them and they need no API key.

**Built.** `matching.ts` (scoring table with plain-language reasons; global greedy assignment; human match choice; payment status; no-receipt lines), `categories.ts` (keyword table in `config/categories.json`; the model's list excludes "Other"; vendor rules), `quality.ts`, `approvals.ts`, `queue.ts`, `receipt-state.ts` (exceptions and status derived together), `privacy.ts` (card-number masking). Commit `0a83511`.

**How it was checked.** 72 new core tests, all passing on the first run. Because a first-run pass proves little, 23 single-rule mutations were tried, including the two boundary cases the dataset is built around: R27's margin of exactly 20 (`>=` → `>`) and TC04's score of exactly 40. All 23 were caught. A script confirmed that every rule ID in `05` has at least one named test.

**What went wrong.** Nothing visible at this point. The category rule had a flaw that only the oracle test exposed (block 2).

---

## Block 2: adapters and the month pipeline (2026-11-03)

**Goal.** `ModelClient` (live, record, replay), `FxClient` (live, cached), the extraction prompt and schema with a validation retry, and `runMonth` wired end to end.

**Built.**

- Model: the OpenAI Responses API with structured output and `store: false`; replay by a request hash covering the prompt, schema, model, effort, and each file's SHA-256. A missing recording fails loudly and says how to re-record.
- FX: the Frankfurter range client, replay, and a SQLite cache that serves stored rates when the API is down (R-CUR-3 when it has none).
- Statement: a format-A reader that reproduces all 44 ground-truth lines from the real CRLF bytes.
- Pipeline: quality → extract (one validation retry, then manual entry) → categorise → FX → duplicates → match → state → queue, with a run-log row per receipt per stage and no receipt content.
- **Oracle model**: answers with the ground-truth fields, so the whole month runs through the real rules with perfect perception.

Commit `c4afc51`.

**What went wrong.**

- **The oracle month test caught a rules bug that 163 unit tests had missed.** R35, "Sample Stationers" (markers, notebooks, a desk organiser), was categorised as Equipment. The vendor missed the `stationery` keyword ("stationers" does not start with "stationery"), so the summary fallback the agent had added ran, and the single word "desk" decided the basket. Fix: the seed keyword `stationer`, with `05` and a named test updated in the same commit. Residual risk logged in `05`: a summary hit lets one item decide a mixed basket.
- A shell heredoc to edit files hung on the Windows `python3` stub and was stopped; edits were redone with the editor tool. No files had been changed.

**Verified.** Oracle month: 40/40 receipts match the hand-written status, line, exceptions, category, and duplicate pointer. 17 adapter tests. The run-log test confirms no vendor name appears in the log.

---

## Block 5: eval harness and the live runs (2026-11-03)

**Goal.** `pnpm eval` producing `report.md` with a pass/fail table; run `v0-day2`; TC01 through the real model and the real FX API.

**Built.** `scripts/eval.ts` (replay, live, oracle; `--cases` and `--ids`), `scripts/eval/system.ts` (the `06` metric definitions and one assertion list per TC), `scripts/eval-compare.ts`, and `config/pricing.json`. Commits `e94beef`, `46b6899`.

**Results.**

| Run | Receipts | TCs | Wrong auto-match | Notes |
|---|---|---|---|---|
| `oracle-day2` | 40 | 12/12 | 0/33 | The rules alone |
| `v0-day2-tc01-live` | 2 (TC01, TC02) | 2/2 | 0/2 | Real model and real ECB rate; USD 0.011 per receipt |
| `v0-day2-live` | 40 | 12/12 | 0/33 | Records all fixtures; p50 2.1 s, p95 4.6 s per receipt; at most USD 0.45 |
| `v0-day2` | 40 | 12/12 | 0/33 (0/14 holdout) | Replay with the key blanked; identical to live |
| `v0-day2-subset20` | B1's 20 | 10/11 | 0/14 | Like-for-like with B1 (3/19 wrong) |

**What went wrong.**

- **The TC07 checker was wrong, not the system.** It required every TC07 receipt to be a duplicate, but R08 is the original and is correctly not flagged. The assertions were split: copies flagged and excluded; the original not flagged and kept.
- **`pnpm eval -- --mode …` failed at first:** pnpm forwards the literal `--`, after which Node's `parseArgs` treats every flag as positional. The script now drops it, so the command documented in `CLAUDE.md` works as written.
- **TC01 alone cannot test the FX API**: it is AUD, so by R-CUR-1 it never converts. TC02 was run alongside it.
- **The `.env` was in the parent folder**, so the first live attempt found no key. The agent moved (not copied) it into the repo root, where it is gitignored, and checked that git does not see it.

**Findings, deferred to Day 4 on purpose** (`06` tunes scoring on the tuning split with a before/after comparison):

1. **Wordmark vendor names.** R16 and R30 were read as `brightreachads` (the invoice's logo is `brightreach<span>ads</span>`). That shares no word with the statement's `BRIGHTREACH ADS`, so the pairs lose 20 points. They auto-match only because no competing line exists.
2. **No date gate.** In the subset run, R13 (a personal-card coffee with no line) reaches 40 against a café line 15 days away: amount within 10% (+30) and the word "cafe" (+10). This fails safe (an extra human touch), but in a real month free lines are normal.

**Human input.** The candidate supplied the OpenAI key, chose the model, approved the full live run after seeing the measured per-receipt cost, and provided the `gpt-5.6-sol` price.

---

## Block 4: v0 pages and seed (2026-11-03)

**Goal.** Upload → raw queue table → pack CSV download.

**Built.** `/upload` (one receipt plus a format-A statement), `/review/[runId]` (the queue in R-QUE order with a total per group, flags in plain language, candidate reasons), `/pack/[runId]/ledger.csv`, and `pnpm seed` (resets the database and loads October in replay). The CSV neutralises formula cells; upload filenames cannot point outside their folder. Commit `dd9bd00`.

**What went wrong.**

- A real type error: TypeScript only narrows on a `never`-returning helper declared as a function with an explicit type. Fixing it also removed three `as` casts.
- `pnpm add sharp` left it in `devDependencies`; it was moved explicitly, because the upload needs it at runtime.
- The first browser check script waited for `/upload` and matched the page it was already on, so it read the page before the redirect. Fixed to wait for the result URL.

**Verified in a browser on production builds.** Replay: uploading R01 gives the queue and the correct CSV row with no API call, and an unrecorded file shows "replay mode can only read receipts that were recorded in advance". Live: R01 matched to L03; R02 converted at the real ECB rate 1.4367 (2026-10-05), matched on the USD original, ledger $77.12 = the AUD charged. Server logs had no errors and no receipt text. `pnpm build` has 0 warnings.

---

## Block 1 (done last): design docs (2026-11-03)

**Goal.** `04` finalised against reality; `docs/ARCHITECTURE.md`; the pass/fail rubric in `docs/EVALUATION.md`.

**Why last.** Written after the code, it describes what exists rather than what was planned; `04` keeps the plan plus an "As built" table of every deviation.

**What went wrong.** The `ARCHITECTURE.md` draft said the category model runs for "15 of 40 receipts". Counting the recordings showed 10. Corrected before committing; logged in the AI corrections log. Every other number in both documents was re-checked against `summary.json` by script. Commit `9124068`.

---

## Day 2 summary

All four exit criteria are met: TC01 went from upload to the CSV through the real model and the real FX API (in the eval and in the browser); recordings are committed; `pnpm eval -- --mode replay --label v0-day2` runs with no key; and the rubric is in `docs/EVALUATION.md`.

The two facts that most shape the rest of the sprint:

1. **The rules are right on this data and perception is nearly perfect.** The oracle and live runs agree, so Day 4's job is to break it: stress cases, free statement lines, and the two scoring findings.
2. **The edge over B1 is now measured like for like:** 0/14 wrong matches against 3/19 on the same 20 receipts, with the same model family. The cost is human touches (8/20 on the subset), which the Day 3 user session will show in minutes.
