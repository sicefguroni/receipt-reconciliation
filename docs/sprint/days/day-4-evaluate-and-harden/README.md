# Day 4 (Thursday): Evaluate, break, and harden

**Focus:** Deliberately break the system and improve it until its reliability can be explained.

*Key question: can you explain quality and failure across multiple conditions, not just one successful example?*

## Read before starting

| File | Section | Why today |
|---|---|---|
| [`00-challenge-brief.md`](../../00-challenge-brief.md) | Day 4: Evaluate, break, and harden | What the graders expect from today |
| [`03-scope-and-success.md`](../../03-scope-and-success.md) | Success metrics | Fill the Final column; report misses honestly |
| [`05-business-rules.md`](../../05-business-rules.md) | R-MAT-1 thresholds | Tune on the tuning split only |
| [`06-evaluation-plan.md`](../../06-evaluation-plan.md) | Stress cases; Failure analysis; Regression protocol; User sessions | Today's whole plan in detail |

## Blocks

| Block | Work |
|---|---|
| 1 h | Full test-set run `v2-day4-pre`, comparison table against B0 and B1 |
| 2 h | Run all stress cases. Write at least 3 failure analyses (template in `06`). |
| 3 h | Fixes: retries, fallbacks, confidence thresholds, prompt and schema changes, rule changes. Tune thresholds on the **tuning split only**. |
| 1 h | `v2-day4-post` run; `eval:compare` before/after table, regressions included |
| 1 h | User feedback session (human). Make the changes. Log feedback → change pairs. |

## Outputs

Saved in this folder:

| File | Contents |
|---|---|
| `failures.md` | At least 3 failure analyses (template in `06`) |
| `feedback-session.md` | The user's answers to the feedback questions in `06`, paraphrased |

Saved elsewhere (paths fixed by the final layout in `08`):

- `docs/EVALUATION.md`: full results
- `eval-results/v2-day4-pre/`, `eval-results/v2-day4-post/`
- Feedback → change pairs in `TRACKER.md`

## Human-only today

- Feedback session with the Accounting user

## Exit criteria

- [x] `docs/EVALUATION.md` has full results: TC table, metrics on holdout and full, B0/B1 comparison, latency, cost, human touches
- [x] At least 3 failure analyses with before/after numbers
- [x] User feedback recorded with the resulting changes (proxy, P1)

Track task status in [`TRACKER.md`](../../TRACKER.md) under "Day 4".

## Notes

- 2026-11-03: the first two criteria are met (time to close is the one result still not measured: it needs a person). The third waits for the proxy session; see `journal.md`.
