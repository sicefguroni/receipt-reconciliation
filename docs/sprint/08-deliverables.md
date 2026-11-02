# 08. Deliverables, Case Study, and Demo

## Final repository layout

```
README.md            # for the Accounting user: what it does, 3-step setup, how to close a month, what each flag means
RUNBOOK.md           # for an operator: config, thresholds, re-running a month, recording fixtures, common errors and fixes
.env.example
docs/
  ARCHITECTURE.md    # diagram, data flow, data contracts, model/tool choices and trade-offs, boundaries
  EVALUATION.md      # dataset, TCs, rubric, B0/B1/final comparison, failure analyses, regression tables, limitations
  CASE_STUDY.md
  AI_COLLABORATION.md
  NEXT_ITERATION.md  # two-week post-deployment metrics + next iteration plan
  sprint/            # these planning files + TRACKER.md + days/ (each day's plan and evidence)
fixtures/            # synthetic dataset, ground truth, recordings
eval-results/        # committed results per labelled run
```

## README.md must answer (for a non-developer)

1. What this does, in two sentences.
2. Setup in three steps (Node version, `pnpm install`, `cp .env.example .env`, `pnpm seed && pnpm dev`). Replay mode works with no key.
3. Closing a month: upload → review queue → month-end pack, with screenshots.
4. **What each flag means and what to do**: one row per exception code, in plain language.
5. What the system decides vs. what you decide.
6. What data leaves your computer (receipt images go to the model API) and what does not.

## RUNBOOK.md must cover

Configuration and thresholds; switching live/replay; recording new fixtures; re-running a month; reading the Runs page; the top five errors with the fix for each; how to add a category or vendor rule; how to add a test case to the eval.

## CASE_STUDY.md outline

Use this framing for the confidential origin: *"This system comes from a real finance workflow at a company I currently work at. Company details are withheld; all data in this repository is synthetic, and the user's feedback is paraphrased."*

1. **User and problem**: the Accounting user, the monthly close, the job-to-be-done.
2. **Existing workflow and bottleneck**: workflow map, UAT evidence (anonymised findings E1–E9), interview insights, B0 and B1 numbers.
3. **Scope decisions and non-goals**: what was cut and why.
4. **Architecture and trade-offs**: rules vs. model split; auto-match thresholds (precision over recall); SQLite and local-first; replay mode; why not "just ChatGPT" (B1 variance and accuracy).
5. **AI vs. human judgment**: table of decisions (from `02`) with the reason for each.
6. **Failures, changes, and results**: the 3+ failure analyses; before/after regression; the final metric table vs. targets, misses included.
7. **Limitations**: the most important one first (for example synthetic data, one bank format, a single-month view).
8. **Next two weeks**: from `NEXT_ITERATION.md`.

## AI_COLLABORATION.md outline

| Section | Content |
|---|---|
| Tools and roles | For example: Claude Code (implementation, tests, docs drafts), Claude API (runtime extraction and categorisation), the chat assistant used for B1 |
| Delegated to AI | Scaffolding, receipt templates, test drafting, first drafts of docs |
| Verification | Every money rule has a human-reviewed test; eval against ground truth; manual review of each failure analysis; confidentiality grep |
| Rejected or corrected | Concrete examples with commit links (keep a running list in `TRACKER.md` during the week; do not reconstruct from memory) |
| Decisions owned personally | Problem choice, rules/model boundary, thresholds, precision-over-recall stance, scope cuts |

## NEXT_ITERATION.md

**First two weeks after deployment: metrics to watch**

| Metric | Why | Signal to act |
|---|---|---|
| Months closed in the system vs. outside it | Adoption | The user falls back to the spreadsheet |
| Human-touch rate per month | Value | Rising: rules or vendors are missing |
| Field and category correction rate | Extraction and categorisation quality | Above 10% on any field |
| Wrong auto-matches found later | Trust | Any non-zero value: tighten R-MAT-1 |
| Time to close | Value | Not below B0 |
| Cost per month | Unit economics | Unexpected growth |

**Next iteration candidates (ranked):** accounting-software export or sync, email-forward intake, split-line matching, learning vendor rules from corrections, multi-month view, real authentication and roles.

## Five-minute demo script

| Time | Show |
|---|---|
| 0:00–0:45 | The user and problem. The manual close in one picture. B0 and B1 numbers. |
| 0:45–2:30 | Live: upload the month → queue appears in the user's order → resolve an amount difference with a reason → pick from an ambiguous match → bulk approve the clean items |
| 2:30–3:15 | The month-end pack. The readable summary, FX amounts shown, totals. |
| 3:15–4:15 | Evaluation: TC table, one failure analysis with before → after, what happens when the FX API is down |
| 4:15–5:00 | Final metrics vs. targets, **the most important limitation**, next two weeks |

## Final submission checklist

- [ ] Fresh clone: three-step setup works with **no API key** (replay mode)
- [ ] `pnpm test` and `pnpm eval -- --mode replay --label final` pass in the fresh clone
- [ ] `.env.example` has every variable and no secrets; `git log -p | grep -i "sk-ant"` returns nothing
- [ ] Confidentiality scan: no employer, product, person, or client names and no real figures in code, data, docs, commits, or video
- [ ] TC01–TC12 results with pass/fail; ≥ 3 failure analyses; before/after regression; B0/B1/final comparison
- [ ] Quality, speed (p50/p95), cost, and human-touch metrics reported, with the run label and date
- [ ] README, RUNBOOK, ARCHITECTURE, EVALUATION, CASE_STUDY, AI_COLLABORATION, NEXT_ITERATION present
- [ ] Demo video recorded (five minutes or less) and linked in the README
- [ ] `TRACKER.md` final session entry written
