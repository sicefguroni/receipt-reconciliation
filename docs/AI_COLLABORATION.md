# AI collaboration

How AI was used to build this system, how its work was checked, where it was wrong, and which decisions stayed with me. The running record is the **AI corrections log** in [`sprint/TRACKER.md`](sprint/TRACKER.md) (48 entries, written as each mistake happened, not reconstructed); the decisions are in its **decision log**.

## Tools and roles

| Tool | Role |
|---|---|
| **Claude Code** (an AI coding agent, Claude Opus models) | Implementation, tests, the evaluation harness, scripted browser checks, and first drafts of every document, working in the repository under `CLAUDE.md`'s rules |
| **OpenAI API, `gpt-5.6-sol`** | The runtime model: reading receipts and the category fallback, in the product itself |
| **ChatGPT** | Baseline B1 only: one fixed prompt, run three times by me (run 1 on a different model version, recorded as such) |
| **Playwright** | Rendering the synthetic receipts; scripted browser checks of the built app |

## Delegated to AI

- Scaffolding, the synthetic dataset generator (40 receipts in six layouts, degraded phone photos, two statement formats), and the stress set.
- The rules in `src/core` and their tests, from the rules I wrote in `05-business-rules.md`.
- The pipeline, adapters, replay recording, the UI, and the evaluation and stress harnesses.
- Failure analysis: reproducing each failure, finding the mechanism, proposing the fix, measuring before and after.
- First drafts of every document, including this one.

## How the work was verified

| Check | What it catches |
|---|---|
| **Ground truth written by hand**, never computed by the rules | The evaluation grading the code against itself |
| **A test for every rule**, and a test that fails if `src/core` does any I/O | Untested money logic; rules drifting into adapters |
| **Mutation checks**: each new rule deliberately broken to confirm a test fails | Tests that pass for the wrong reason. Several survived the first time; each got a test (for example 2 of 6 on Day 3, and the pairing-check wording on Day 4) |
| **An oracle mode** that feeds ground-truth fields instead of the model | Separates rule errors from perception errors; it found a categorisation bug before any live run |
| **Replay of every live run with the key blanked**, compared metric by metric | A live result that cannot be reproduced |
| **Scripted browser runs on a production build, plus screenshots read by eye** | Behaviour the unit tests cannot see. Screenshots found problems no test had: "$-4.50", a split form listing 13 lines, and the $10 card fee offered first |
| **People**: my own cold run and a naive proxy, scored by script against the answer key | Whether someone else can use it, and what they get wrong |
| **Confidentiality and secrets scans** before release | Real names, figures, or keys in the repository (Day 5) |

## Rejected or corrected

Every entry is in the AI corrections log with its commit. The patterns, with examples:

**Numbers written from memory instead of copied from output** (the most frequent; the agent's own rule after the second time was "copy numbers from output, never retype them"):

- B1 test count "46/46" (the run showed 49), `f8c94e3`; "the category model runs for 15 of 40 receipts" (the recordings showed 10); "13 decision tests" (14); "18 mutations" (16); Day 4 spend "about USD 0.17" (the token counts gave 0.09).
- On Day 5, three counts in the architecture draft ("11 decision actions", "four guardrails", "8 stress receipts recorded"; the code gave 10, five, 7) and an overclaim in the case study ("mutations were caught every time"). All caught by checking against the code before committing.

**A conclusion inferred instead of read from the evidence:**

- Stress case S03 (a chat screenshot) was diagnosed as "the model call failed, so no recording exists". The run log said `QUALITY_GATE`: the size check had rejected it before the model. The fix made on the wrong diagnosis (recording model failures) was kept on its own merits, and the real cause became failure F2, `2651a19`.

**Tests that passed for the wrong reason:**

- The TC07 checker failed a correct system (it required the *original* to be flagged too), `e94beef`.
- An FX-outage test never exercised its own guard, so removing the guard went unnoticed, `3a2469d`.
- A rule fixture used two names that share "Sample", so the rule correctly did not fire; it also exposed a real gap (two cafés looked alike), fixed in `96657a4`.

**Product problems found by the agent's own checks, not by me:**

- A simulated month close wrote off TC04's real payment as "not an expense", because the queue sorted it first; all 12 single-action tests had passed.
- A seeded random split put every hard matching case in the tuning half, so "0% wrong on holdout" would have passed untested, `5bc626d`.

**Tooling and environment mistakes:**

- The latest `better-sqlite3` had no Windows binary, which would have broken three-step setup for a Windows reviewer; pinned, `3b159db`.
- Shell traps repeated across days: `python3` hanging on this machine (three times), and `sed` or inline scripts mangling `$` and backslashes. One script pasted two documents into themselves; caught from a repeated section before committing, restored, re-run with literal replacements.
- A half-written command checked the old statement reader into the working tree; caught from the tool's warning, restored, nothing lost.

**Corrections I made:**

- The agent planned a new repository; this folder already was it, `3b159db`.
- Where its plans needed a person (the interview, the baselines, the cold runs), I supplied the evidence or made the call, and it recorded my words as given. When I misstated my own close time in conversation and corrected it, both figures were recorded, with the correction.

## Decisions I owned

These are recorded in the decision log as my rulings; the agent proposed options and asked rather than deciding.

| Decision | Why it was mine |
|---|---|
| The problem: month-end receipt reconciliation, from a workflow I know | Strongest real-user evidence and a measurable baseline |
| **The model reads, code decides** | The acceptance-test evidence showed silent errors from rules in the wrong place |
| **Precision over recall**: auto-match only a clear winner, everything doubtful to a person | A wrong match costs more than a human touch |
| The policy readings: over 10% **or** $100; a big difference is never auto-paired; duplicates are marked, never deleted; a bank-account payment source | Policy belongs to finance; I made the calls the evidence supported and kept them configurable |
| OpenAI as the runtime provider, the same model as B1 | Isolates the design in the comparison |
| B0 as a labelled estimate; no Accounting user, so a naive proxy plus my own cold run | Presenting either as real measurements would be invented evidence |
| The size check for camera photos only | A rule I had confirmed on Day 1; the agent asked rather than changing it |
| After the cold runs: **warn**, then **block** clear mismatches; tabs and a light theme from the proxy's feedback | The human-step guardrails change how the product treats its user |
| Scope: what was cut, and the three additions (no-receipt lines, split payment, refunds) | Scope is a product decision |
| Every live API spend, every push to `main`, and the release tag | Outward and costly actions |

## What I would do differently

Ask the agent to print numbers from command output into documents mechanically (a script, not a sentence), since the most common correction was a retyped number; and schedule the cold runs earlier, because the most important finding of the sprint (people pairing receipts with the wrong payments) came from them on Day 4, not from any automated check.
