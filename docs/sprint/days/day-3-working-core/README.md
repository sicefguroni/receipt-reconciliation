# Day 3 (Wednesday): Working core for a non-developer

**Focus:** Complete the end-to-end core workflow for a non-developer user.

*Key question: can someone else run the core workflow when you are not beside them?*

## Read before starting

| File | Section | Why today |
|---|---|---|
| [`00-challenge-brief.md`](../../00-challenge-brief.md) | Day 3: Build the working core | What the graders expect from today |
| [`02-workflow-map.md`](../../02-workflow-map.md) | Target workflow; Who decides what in v1 | The review queue must match this |
| [`05-business-rules.md`](../../05-business-rules.md) | R-QUE, R-APR, and any `CONFIRM WITH USER` rule still open | Queue order, approval, and rules to confirm in today's session |
| [`06-evaluation-plan.md`](../../06-evaluation-plan.md) | User sessions | How to run the first execution |
| [`08-deliverables.md`](../../08-deliverables.md) | README.md must answer | Draft the user README against this |

## Blocks

| Block | Work |
|---|---|
| 3 h | Review queue UI: grouped by R-QUE order, plain-language reason per item, inline field correction, ranked match candidates, approve / bulk approve / sign-off with reason, disabled self-approve with tooltip, totals on every list |
| 1 h | Statement CSV column mapping (two formats) and upload validation with friendly errors |
| 1 h | Month-end pack: ledger CSV, exceptions log CSV, readable summary page (totals by category and payment source, FX excluded amounts shown) |
| 1 h | Structured `run_log`, a "Runs" page showing per-stage status and errors, and no PII in logs |
| 1 h | `README.md` draft for the Accounting user, plus a three-step setup. Run the full eval live as `v1-day3`. |
| 1 h | **First execution by the target user** (human session, observed silently). Agent logs the issues. |

## Outputs

Saved in this folder:

| File | Contents |
|---|---|
| `first-run-observations.md` | Every hesitation, question, and error message the user read; time to close the month; each blocker |

Saved elsewhere (paths fixed by the final layout in `08`):

- `README.md` draft at the repo root
- `eval-results/v1-day3/`

## Human-only today

- First unassisted run of the system by the Accounting user or a proxy (observe silently)

## Exit criteria

- [ ] The user completes a month close without the candidate's help, or each blocker is recorded
- [ ] Integrations working: the model API, the FX API, and CSV import
- [ ] `v1-day3` results are recorded

Track task status in [`TRACKER.md`](../../TRACKER.md) under "Day 3".

## Notes
