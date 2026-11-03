# First execution: observations

**Status: not run yet.** This file is the protocol and the blank record. Nothing below the "Record" headings may be filled in from memory or by an agent: only from the session itself (`CLAUDE.md`, non-negotiable 1).

## Who runs it, and why (decided 2026-11-03)

There is no Accounting user for this sprint. The brief allows "the target user **or a proxy user**", and its key question is whether *someone else* can run the core workflow without the candidate beside them. Two runs, each labelled for what it can show:

| Run | Who | What it can show | What it cannot show |
|---|---|---|---|
| **P1: naive proxy** | One person with admin or bookkeeping experience who has never seen this repo or its docs | Whether someone else can close the month from the README alone: hesitations, wrong turns, error messages read, time to close | The real Accounting user's judgement or habits; one person is one data point |
| **C1: builder cold run** | The candidate, from a fresh clone, following the README literally | Setup from the README works; a time-to-close floor; like-for-like with B1, which the candidate also ran | Usability for anyone else: the builder knows every screen |

Not a user session, and never reported as one: the automated month close (`src/pipeline/reconcile.test.ts`, "closing the October month") and the scripted browser run. They show that every queue item has an action, not that a person can find it.

## Setup for both runs

- Same build: note the commit hash below. Replay mode (no API key), `pnpm seed` first.
- The month: October sample, started with **`fixtures/dataset/statement-format-b.csv`** uploaded on the first page (exercises CSV import and the second format). `pnpm seed` already lists one October month (format A) under *Months in progress*; if the runner opens that one instead, let them, and note it: it is the same 40 receipts, and which they chose is itself an observation about the first page.
- Acting as: *Accounting user (reviewer)*.
- Goal given to the runner, word for word: *"Close the October month using this app and its README. When you think the month is done, download the ledger and the exceptions log. Think aloud if you can. I won't help unless you're completely stuck."*
- The runner gets: `README.md` (printed or in a second window) and the app open on the first page. Nothing else: no walkthrough, no hints about flags.
- Stopwatch: starts when the runner first reads the README's "Close a month" section; stops when both files are downloaded *or* the runner says they are done. If the observer has to help, note the minute and what was said; the run then counts as *assisted*.

### What a "correct" close looks like (observer's key; do not show the runner)

From `fixtures/dataset/ground-truth.json`. Use it to note wrong decisions afterwards, not to correct the runner during the run.

- R09, R10: confirm as duplicates of R08.
- R04: choose L16 ($560), then sign off the difference with a reason, then approve.
- R15: choose L22 (not L24, the same amount one day later).
- R06, R07: add a business purpose.
- R13, R14: approve as reimbursements.
- R20: no payment on the statement; a reasonable close removes it or reimburses with a reason.
- Nine statement lines have no receipt (L02, L12, L19, L24, L26, L32, L36, L40, L44): each needs a substitute or "not an expense", with a reason. L16 and L22 also appear until R04 and R15 are matched.
- Everything else: approve (bulk approve covers most).

## Observer's rules

- Say nothing. Write down every pause over about 5 seconds, every question asked aloud, every error message read (copy it exactly), and every wrong turn (a click that had to be undone).
- Write down the time of each note (mm:ss from the start).
- If the runner is stuck for 2 minutes, ask once: *"What are you looking for?"* Record the answer and that the run became assisted.

## Record: P1 (naive proxy)

- Date:
- Commit:
- Runner's background (role, years doing expenses or bookkeeping; no names):
- Assisted? (no / yes at mm:ss, what was said):
- **Time to close:** mm:ss — or *not finished* and why
- Items done at the end (from the progress bar): __ of __
- Wrong decisions against the key above:

| mm:ss | What happened (hesitation, question, error read, wrong turn) | Screen / item | Severity: blocker / slowed / cosmetic |
|---|---|---|---|
| | | | |

**Blockers** (anything that would stop them closing the month alone):

1.

**Their words at the end** (exact quotes; ask "What would stop you using this next month?"):

-

## Record: C1 (builder cold run)

- Date:
- Commit:
- Fresh clone? (path, `pnpm install` time):
- Setup steps that did not work exactly as the README says:
- **Time to close:** mm:ss
- Deviations from the README, and anything that felt slow:

| mm:ss | Note |
|---|---|
| | |

## Comparison (fill after both runs)

| Measure | B0 (estimate) | B1 (candidate, ChatGPT) | C1 (candidate, system) | P1 (proxy, system) |
|---|---|---|---|---|
| Time to close, 40 receipts | 20–40 min (labelled estimate) | about 11 min 10 s (extrapolated from 20 receipts) | | |
| Wrong matches | not measured | 3/19 | | |
| Assisted? | n/a | n/a | n/a | |
