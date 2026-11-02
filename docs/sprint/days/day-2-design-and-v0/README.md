# Day 2 (Tuesday): Design and v0

**Focus:** Translate the workflow into a system design and make the first happy path work.

*Key question: can this design become a repeatable system rather than a one-time generation?*

## Read before starting

| File | Section | Why today |
|---|---|---|
| [`00-challenge-brief.md`](../../00-challenge-brief.md) | Day 2: Design the system and ship v0 | What the graders expect from today |
| [`04-system-design.md`](../../04-system-design.md) | All sections | Finalise it against reality, then write `ARCHITECTURE.md` |
| [`05-business-rules.md`](../../05-business-rules.md) | R-MAT, R-QUA, R-CAT, R-APR, R-QUE | The rest of `src/core` with a test per rule ID |
| [`06-evaluation-plan.md`](../../06-evaluation-plan.md) | Metrics; Pass/fail rubric | Eval skeleton and the rubric for `EVALUATION.md` |

## Blocks

| Block | Work |
|---|---|
| 1 h | Finalise `04-system-design.md` against reality. Write `docs/ARCHITECTURE.md` (diagram plus data contracts). |
| 2 h | `ModelClient` (live, record, replay), the extraction prompt plus schema, validation retry, `FxClient` with cache |
| 2 h | The rest of `src/core` (matching, exceptions, status, queue ordering, categories) with tests for every rule ID |
| 2 h | `pipeline/run-month.ts` wired end to end. Minimal pages: upload → raw queue table → pack CSV download. |
| 1 h | `pnpm eval` skeleton producing `report.md` for TC01. Run `v0-day2`. |

## Outputs

Saved in this folder: nothing required. Today's work is code and repo-level docs. Use Notes below for anything worth keeping.

Saved elsewhere (paths fixed by the final layout in `08`):

- `docs/ARCHITECTURE.md`; pass/fail rubric in `docs/EVALUATION.md`
- `fixtures/recordings/`: recorded model responses for replay mode
- `eval-results/v0-day2/`

## Human-only today

None scheduled. The agent works from Day 1's confirmed rules and scope.

## Exit criteria

- [ ] One real receipt (TC01) goes from upload to the month-end CSV through the real model and the real FX API
- [ ] Recordings are committed
- [ ] `pnpm eval -- --mode replay --label v0-day2` runs
- [ ] The pass/fail rubric is written in `docs/EVALUATION.md`

Track task status in [`TRACKER.md`](../../TRACKER.md) under "Day 2".

## Notes
