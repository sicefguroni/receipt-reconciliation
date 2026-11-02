# Receipt-to-Ledger Reconciliation: Agent Instructions

## Mission

Build, evaluate, and hand off a working system that turns one month of staff receipts plus a card/bank statement export into:

1. a reconciled ledger, where each receipt is matched to a payment or explicitly flagged, and
2. one exception-first review queue that a non-developer Accounting user works through, ending in
3. a readable month-end pack (CSV ledger, exceptions log, summary).

This is a five-day job-application work sample. It is graded on the rubric in `docs/sprint/00-challenge-brief.md`. Every task you do should map to a rubric line. If it maps to none, it is out of scope.

## Read first, in order

| File                                     | Why                                                                               |
| ---------------------------------------- | --------------------------------------------------------------------------------- |
| `docs/sprint/00-challenge-brief.md`      | The assignment, required deliverables, and grading rubric                         |
| `docs/sprint/01-problem-and-evidence.md` | The real user, anonymised evidence, and open questions                            |
| `docs/sprint/02-workflow-map.md`         | Current workflow, bottleneck, and target workflow                                 |
| `docs/sprint/03-scope-and-success.md`    | v1 scope, non-goals, and success metrics                                          |
| `docs/sprint/04-system-design.md`        | Architecture, data contracts, and model/tool choices                              |
| `docs/sprint/05-business-rules.md`       | Deterministic money rules (source of truth for `src/core`)                        |
| `docs/sprint/06-evaluation-plan.md`      | Test cases, baselines, metrics, and failure analysis                              |
| `docs/sprint/07-sprint-plan.md`          | Five-day overview; links to each day's folder                                     |
| `docs/sprint/days/day-N-*/README.md`     | The current day only: focus, sections to read, blocks, human tasks, exit criteria |
| `docs/sprint/08-deliverables.md`         | Final package, case study, and demo script                                        |
| `docs/sprint/TRACKER.md`                 | Live status. Read it at the start of every session and update it at the end.      |

## Non-negotiables

1. **Evidence over claims.** Never invent a measurement, user quote, timing, or test result. If something is not measured, write `not measured`, the reason, and the command that would measure it. The "Evaluation and Learning Loop" rubric line (20%) rewards honest reporting, including where improvement was not achieved.
2. **Money rules are code, not prompts.** The model does perception (reading receipts) and ambiguous categorisation only. Currency handling, thresholds, matching, duplicate detection, and statuses are deterministic, pure, and unit-tested in `src/core/`.
3. **Statuses are derived, never hand-picked.** Match status and payment status are computed from data. A human can override them only through an audited decision with a reason.
4. **Ambiguity goes to a human.** Never auto-resolve a case with two plausible matches, low extraction confidence, or a policy question. Route it to the queue with the reason and the ranked candidates.
5. **Confidentiality.** Use synthetic data only. Never write the employer's name, product names, people's names, clients, or real figures into code, data, commits, docs, or the demo. Say "the Accounting user" and "a company I currently work at".
6. **Reproducible without the candidate.** Setup takes at most three steps. A `replay` mode must run the whole flow and the evaluation without an API key, using recorded model responses committed under `fixtures/recordings/`.
7. **Secrets and PII.** Secrets live only in `.env`, and `.env.example` is committed. Logs never contain receipt text, card numbers, names, or raw model output. Log IDs, stage names, durations, token counts, and error codes.
8. **Tracker discipline.** Update `docs/sprint/TRACKER.md` at the end of every working block, using the format defined in that file.

## Engineering conventions

- Use TypeScript in strict mode. No `any`: use `unknown` plus Zod parsing or type guards.
- Use Zod at every boundary: uploaded files' metadata, CSV rows, model output, API route input, and environment config.
- Keep pure business logic in `src/core/` with no I/O. Keep integrations (model, FX API, storage) in `src/adapters/` behind interfaces so tests and replay mode can swap them.
- Every rule in `docs/sprint/05-business-rules.md` has at least one Vitest case. When a rule changes, update the doc and the test in the same commit.
- Error messages are written for the Accounting user: what happened, why, and what to do next. Never show a stack trace in the UI.
- Make small commits with conventional prefixes (`feat:`, `fix:`, `eval:`, `docs:`).

## Commands (create these on Day 2 and keep them working)

```bash
pnpm install
pnpm seed                 # generate the synthetic month and load it
pnpm dev                  # web UI at http://localhost:3000
pnpm test                 # unit tests for src/core
pnpm eval -- --mode replay --label <name>   # full test set, no API key needed
pnpm eval -- --mode live --label <name>     # real model calls; records new fixtures
pnpm eval:compare -- <labelA> <labelB>      # metric deltas between two runs
```

## Stop and ask the human when

- a business rule in `05-business-rules.md` is marked `CONFIRM WITH USER` and you are about to depend on it,
- a scope change would add or drop a v1 item in `03-scope-and-success.md`,
- you need the interview, a baseline timing, user feedback, or the demo recording, or
- a metric misses its target and the fix would take more than about two hours. Present options instead of silently cutting quality.

Otherwise make the call yourself, record it in the decision log in `TRACKER.md`, and keep moving. The rubric rewards decisions made under ambiguity.
