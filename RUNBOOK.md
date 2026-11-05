# Runbook

For whoever runs and maintains the app: configuration, live and replay mode, recording, re-running a month, the Runs page, common errors, and how to extend the rules and the evaluation. For using the app to close a month, see [`README.md`](README.md); for how it is built, [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Commands

```bash
pnpm install                 # once; Node 22 or newer, pnpm 10
pnpm seed                    # reset the local database and load the October sample month
pnpm dev                     # development server, http://localhost:3000
pnpm build && pnpm start     # production server
pnpm test                    # unit and pipeline tests (no key, no network)
pnpm typecheck && pnpm lint
pnpm eval -- --mode replay --label <name>           # full evaluation, no key
pnpm eval -- --mode live --label <name>             # real model calls; records fixtures
pnpm eval -- --mode oracle --label <name>           # ground-truth fields: the rules alone
pnpm eval:compare -- <labelA> <labelB>              # metric and test-case deltas
pnpm eval:stress -- --mode replay --label <name>    # the 11 stress cases, no key
pnpm dataset                 # regenerate fixtures/dataset (Chromium needed once:
pnpm dataset:stress          #   pnpm exec playwright install chromium)
```

## Configuration

Everything lives in `.env` (copy `.env.example`; never commit `.env`). Every value is checked when the app starts, and every one but the API key has a working default, so replay mode runs with an empty `.env`.

| Variable | Default | What it controls | Who owns it |
|---|---|---|---|
| `MODE` | `replay` | `replay`: recorded model answers, no key, no network. `live`: real OpenAI calls | Operator |
| `RECORD` | `0` | In live mode, `1` writes each answer to `fixtures/recordings/` | Operator |
| `OPENAI_API_KEY` | (empty) | Needed only in live mode | Operator |
| `MODEL_EXTRACT`, `MODEL_CATEGORISE` | `gpt-5.6-sol` | Model for reading receipts and for the category fallback | Operator |
| `MODEL_REASONING_EFFORT` | `low` | `none` to `high`; higher is slower and dearer | Operator |
| `FX_BASE_URL` | Frankfurter v1 | Exchange-rate service (ECB reference rates, no key) | Operator |
| `DATABASE_PATH`, `FILE_STORE_DIR` | `./data/...` | Local database and uploaded files | Operator |
| `AMOUNT_DIFF_PCT_THRESHOLD`, `AMOUNT_DIFF_AUD_THRESHOLD` | `10`, `100` | A charge differs "by more than policy" when it is over 10% **or** over $100 (R-AMT-2) | **Finance lead** |
| `AUTO_MATCH_MIN_SCORE`, `AUTO_MATCH_MIN_MARGIN` | `75`, `20` | Auto-match only a clear winner (R-MAT-1). Raise to ask people more often | **Finance lead** |
| `MATCH_MAX_DAYS_APART` | `7` | A payment further than this from the receipt date is never suggested (R-MAT-9) | **Finance lead** |
| `EXTRACT_CONFIDENCE_MIN` | `0.8` | A field read below this confidence goes to a person | Operator |
| `CATEGORY_CONFIDENCE_MIN` | `0.7` | A model-chosen category below this goes to a person | Operator |
| `QUALITY_MIN_LONG_SIDE`, `QUALITY_MIN_SHORT_SIDE` | `1000`, `700` | Smallest camera photo accepted, in pixels (R-QUA-1) | **Finance lead** |

Restart the server after changing `.env`. Then:

- **Applied on the next page view, to every month, including months already read:** the amount and auto-match thresholds, `MATCH_MAX_DAYS_APART`, `EXTRACT_CONFIDENCE_MIN`, and the category rules. These are used while reconciling, which runs again on every view (ARCHITECTURE, "Read once, reconcile on every view").
- **Applied only to months read after the restart:** the photo size floor, the model settings, and `CATEGORY_CONFIDENCE_MIN`. These are used while reading; start the month again to apply them.

## Live and replay mode

- **Replay (default):** serves recorded answers by request key. It can read only the receipts that were recorded (the 40 October receipts and the stress set). Anything else fails with `RECORDING_MISSING` and a message saying so; it never guesses.
- **Live:** set `MODE=live` and `OPENAI_API_KEY`, restart. Each receipt costs about USD 0.011 (measured on `final`). Requests use `store: false`.
- A recording's key covers the task, model, effort, prompt text and version, output schema, and each file's hash. **Any change to a prompt, schema, model, or effort makes every old recording miss.** After such a change, re-record (below) before replay works again.

## Recording new fixtures

```bash
pnpm eval -- --mode live --label <name>                 # the whole October month (about USD 0.45)
pnpm eval:stress -- --mode live --label <name> --ids S03 # chosen stress receipts only
```

Live evaluation always records. Model failures are recorded too (by code only), so a replay takes the same fallback. Commit the changed files under `fixtures/recordings/` with the run's `eval-results/<name>/`. Then prove replay reproduces it: run the same command with `--mode replay` and the key blanked, and `pnpm eval:compare -- <name> <name>-replay` should show no change.

## Re-running a month

- **Start again from scratch:** `pnpm seed` (sample month), or start a month on the first page or the Upload page. Each start is a new run with its own id; **decisions do not carry over** between runs.
- **After an outage (FX or model):** a run keeps what it read. To read again with the service back, start the month again. There is no "re-read this run" action yet.
- **Windows:** stop the server (and any `next` process still holding port 3000) before `pnpm seed`; while the database is open, seed fails with `EPERM`.

## Reading the Runs page

`/runs` lists every run, including failed ones, newest first. Each run shows, per step (`statement`, `quality`, `extract`, `categorise`, `fx`, `duplicates`, `match`, `run`), how many receipts were ok, retried, or fell back, the time, the tokens, and error codes with counts. It never shows receipt text, names, card numbers, or model output; codes are fixed words so a message cannot leak a file's contents.

| Code | Step | Meaning |
|---|---|---|
| `QUALITY_GATE` | quality | A camera photo was too small; the person sees the size and "retake it closer" |
| `SCHEMA_INVALID`, `SCHEMA_INVALID_TWICE` | extract | The model's answer failed the schema; retried once, then entered by hand |
| `MODEL_API_ERROR`, `MODEL_REFUSED`, `MODEL_EMPTY_OUTPUT` | extract, categorise | The model call failed after the SDK's two retries; the receipt is entered by hand |
| `FX_API_ERROR`, `FX_NO_RATES` | fx | The rate service failed or returned nothing; cached rates used where available |
| `STATEMENT_FORMAT` | statement | The CSV could not be read; the person saw every bad row |
| `RECORDING_MISSING` | run | Replay was asked for a receipt that was never recorded |

## The most likely problems

| Symptom | Cause | Fix |
|---|---|---|
| "The statement's columns were not recognised" (`STATEMENT_FORMAT`) | A bank layout the reader does not know | Ask for a CSV export with the columns listed in the message; or add the layout (below) |
| "This app is in replay mode…" (`RECORDING_MISSING`) | Replay cannot read new receipts | Switch to live mode with a key, or use the sample month |
| Every replay request misses after a code change | A prompt, schema, model, or effort changed, so the request keys changed | Re-record live (about USD 0.45 for the month), commit the recordings |
| Foreign receipts show "No exchange rate available" (`FX_API_ERROR`) | The rate service was down and nothing was cached | Start the month again when it is back; receipts paid at the bank's AUD charge are not affected |
| `pnpm test` stops with `ERR_PACKAGE_IMPORT_NOT_DEFINED` (`#module-sync-enabled`) | The repository was cloned under `AppData\Local\Temp`; Vitest cannot start there (seen on Day 5; the same commit passes 321/321 in an ordinary folder) | Clone into an ordinary folder, such as `Documents` |
| `pnpm seed` fails with `EPERM` (Windows) | A server still holds `data/app.db` | Stop it (check port 3000 for a leftover `next` process), then seed again |

## Adding a category or vendor rule

The chart and the keyword table are `config/categories.json` (policy: agree changes with the finance lead).

1. Add the category to `categories` if it is new; it is shown exactly as written (R-CAT-5). Never let the model choose "Other": it is excluded from its list (R-CAT-3).
2. Add `{ "keyword": "parking", "category": "Travel" }` to `rules`. A keyword matches the start of a word in the vendor name, then the item list, and the description of a payment with no receipt (R-CAT-6 suggestions).
3. `pnpm test` (a test checks every rule's category is in the chart).
4. Removing a rule can send a receipt to the model, which replay has not recorded: re-record live if the evaluation then reports `RECORDING_MISSING`. Adding a rule never does.

## Adding a bank statement layout

Add one entry to `STATEMENT_FORMATS` in `src/adapters/statement/read-statement.ts`: the column names for date, description, account, the amount (one signed column, or debit and credit), and the foreign amount and currency, plus the date style. Columns are found by name in any order. Add a test in `read-statement.test.ts` that the same transactions read identically to format A.

## Adding a test case to the evaluation

- **A scenario in the October month:** add a `ScenarioDef` to `scripts/dataset/scenarios.ts` with its expected outcome written by hand (ground truth is never computed by the rules), tag it with a test-case id (`TestCaseId` in `scripts/dataset/schema.ts`), add its assertions to `scripts/eval/system.ts`, then `pnpm dataset` and record the new receipt live (`pnpm eval -- --mode live --label <name> --ids R41`). Keep the tuning/holdout split stratified (a test enforces it).
- **A stress case:** add it to `scripts/dataset/stress.ts` with its expected *safe* behaviour, add its check to `scripts/eval-stress.ts`, then `pnpm dataset:stress` and record it with `--ids`.
- Every rule change goes with a named test in the same commit, and `docs/sprint/05-business-rules.md` is updated with it.
