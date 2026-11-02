# Day 1 (Monday): Discover, map, and baseline

**Focus:** Observe the real workflow and define the exact bottleneck you can solve within five days.

*Key question: is the problem real, recurring, and measurable against a baseline?*

## Read before starting

| File | Section | Why today |
|---|---|---|
| [`00-challenge-brief.md`](../../00-challenge-brief.md) | Day 1: Discover, map, and baseline | What the graders expect from today |
| [`01-problem-and-evidence.md`](../../01-problem-and-evidence.md) | What is not yet known; Interview script | Run the interview from this script |
| [`02-workflow-map.md`](../../02-workflow-map.md) | Current workflow; The bottleneck | Validate this map in the interview |
| [`03-scope-and-success.md`](../../03-scope-and-success.md) | v1 scope; Success metrics | Fill the baseline columns, get scope approved |
| [`05-business-rules.md`](../../05-business-rules.md) | R-CUR, R-AMT, R-DUP, R-REQ, and every `CONFIRM WITH USER` rule | Rules to confirm and implement today |
| [`06-evaluation-plan.md`](../../06-evaluation-plan.md) | Dataset; Test cases; Baselines (B0, B1) | Dataset generator and baseline scoring |

## Blocks

| Block | Agent | Human |
|---|---|---|
| 1 h | Scaffold the repository (Next.js, TS strict, Vitest, Drizzle/SQLite, Biome or ESLint), `.env.example` | Book interview and baseline slots |
| 2 h | `scripts/generate-dataset.ts`: templates, photo degradation, statement CSVs, ground truth, splits, the 20-item baseline subset | Interview the Accounting user (script in `01`) |
| 1 h | Turn the interview notes into updates to `01`, `02`, `03`, and the `CONFIRM WITH USER` rules in `05` | Confirm the threshold and quality-gate rules with the user |
| 2 h | Score B0 and B1 against ground truth (write a small scorer you will reuse in `eval.ts`) | Run B0 with the user (timed). Run B1 three times. |
| 1 h | Finalise the success-metric targets and the v1 scope with baseline numbers filled in | Approve the scope |
| 1 h | Pure `src/core` rules plus tests for R-CUR, R-AMT, R-DUP, R-REQ (no I/O yet) | |

## Outputs

Saved in this folder:

| File | Contents |
|---|---|
| `interview-notes.md` | Interview answers, paraphrased, no names (script in `01`) |
| `baseline-b0.md` | B0 minutes, accuracy, exceptions caught or missed, observations |
| `baseline-b1-prompt.md` | The fixed B1 prompt, verbatim |
| `baseline-b1-runs.md` | Score and time for each of the three B1 runs, and the variance between them |

Saved elsewhere (paths fixed by the final layout in `08`):

- `fixtures/dataset/`: synthetic dataset, ground truth, splits, `baseline-subset.json`
- Updates to `01`, `02`, `03`, `05` from the interview
- `src/core/` rules and tests

## Human-only today

- 20 to 30 minute interview with the Accounting user
- Confirm the `CONFIRM WITH USER` rules
- Timed B0 manual baseline run
- Approve the v1 scope

## Exit criteria

- [ ] Dataset and ground truth committed
- [ ] Interview notes, B0, and B1 recorded with real numbers
- [ ] Metrics table has baseline columns filled
- [ ] 12 TCs listed
- [ ] v1 scope approved
- [ ] Core rule tests green

Track task status in [`TRACKER.md`](../../TRACKER.md) under "Day 1".

## Notes
