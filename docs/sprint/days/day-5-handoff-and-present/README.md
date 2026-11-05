# Day 5 (Friday): Hand off, prove value, and present

**Focus:** Package the system so another person can run, operate, and improve it.

*Key question: can another person understand, run, trust, and improve the system?*

## Read before starting

| File | Section | Why today |
|---|---|---|
| [`00-challenge-brief.md`](../../00-challenge-brief.md) | Day 5; Deliverables; How the submission is graded | Final check against the rubric |
| [`03-scope-and-success.md`](../../03-scope-and-success.md) | Non-goals; Business value link | Feeds the case study |
| [`08-deliverables.md`](../../08-deliverables.md) | All sections | Every document outline, the demo script, and the final checklist |
| [`TRACKER.md`](../../TRACKER.md) | Decision log; AI corrections log | Source material for `CASE_STUDY.md` and `AI_COLLABORATION.md` |

## Blocks

| Block | Work |
|---|---|
| 1 h | Final `--mode live` run labelled `final`. Freeze the numbers. |
| 2 h | `README.md` (user), `RUNBOOK.md` (operator), `ARCHITECTURE.md`, `EVALUATION.md` final; verify the three-step setup in a fresh clone with replay mode and no API key |
| 2 h | `CASE_STUDY.md` and `AI_COLLABORATION.md` (outlines in `08`) |
| 1 h | Two-week post-deployment metrics plan and next-iteration plan |
| 1 h | Demo rehearsal from the script in `08`; the human records the demo |
| 1 h | Final checklist in `08`, a confidentiality scan (`grep` for any real names or figures), and a tagged release |

## Outputs

Saved in this folder: nothing required. Today's deliverables are graded at fixed paths. Use Notes below for the fresh-clone check and the confidentiality scan results.

Saved elsewhere (paths fixed by the final layout in `08`):

- `README.md`, `RUNBOOK.md` at the repo root
- `docs/ARCHITECTURE.md`, `docs/EVALUATION.md`, `docs/CASE_STUDY.md`, `docs/AI_COLLABORATION.md`, `docs/NEXT_ITERATION.md`
- `eval-results/final/`

## Human-only today

- Record the five-minute demo video
- Submit

## Exit criteria

- [ ] Every box in the `08` final checklist is ticked or explicitly marked not done with a reason

Track task status in [`TRACKER.md`](../../TRACKER.md) under "Day 5".

## Notes

**Fresh-clone check (Day 5, commit `5537833`).** Cloned into an ordinary folder, followed the README literally with no API key: `pnpm install` 12 s; `.env.example` copied unchanged (replay mode, empty key); `pnpm seed` loaded the month; `pnpm test` 26 files, **321 passed**; `pnpm eval -- --mode replay --label final` 12/12, 0/33, every metric identical to the committed live `final` (only mode, time, and commit differ); `pnpm eval:stress` 11/11; `pnpm lint` clean; `pnpm dev` served the home, review, and guide pages in replay mode. A first clone under `AppData\Local\Temp` installed, seeded, and evaluated fine, but Vitest could not start there (`ERR_PACKAGE_IMPORT_NOT_DEFINED`); the identical install in an ordinary folder passed, so this is the location, not the repository. Recorded in the RUNBOOK's problems table. Both clones deleted.

**Secrets scan.** `.env` was never committed and is ignored. No key-like string (`sk-ant`, `sk-proj-`, `sk-` + 20 characters, a non-empty `OPENAI_API_KEY=`) in any version of any file; the only matches are documentation placeholders. `.env.example` covers all 18 variables the app reads and has no secret values.

**Generic confidentiality scan** (all tracked text files and every commit message): no email address in files; in commit messages only the AI co-author line; every commit authored under one personal address; web domains only `localhost`, the public FX service, and `nodejs.org`; every phone number in the fictional 555 range; all 22 ABN-shaped numbers **fail the official ABN checksum**, so none can be a real business. **Names scan:** run by the candidate privately (the employer, product, people, and client names are not written anywhere in this repository); result recorded in the `08` checklist.

**Demo:** the timed script against the real screens is in [`demo-script.md`](demo-script.md).
