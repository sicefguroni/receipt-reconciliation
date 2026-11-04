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

- Same build: note the commit hash below. Replay mode (no API key), `pnpm seed` first. *Decided 2026-11-03:* run both on the Day 4 build (after the stress fixes), and for P1 go straight on to the feedback questions in `../day-4-evaluate-and-harden/feedback-session.md` in the same sitting.
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

*Recorded from the candidate's own report in the session; nothing added. Builder evidence, not a user session.*

- Date: Day 4
- Commit: `4b537cd` (the clone was of `main`; nothing had been pushed after `4b537cd`, checked with `git ls-remote origin main`)
- Fresh clone? (path, `pnpm install` time): yes; `pnpm install` 17.3 s
- Setup steps that did not work exactly as the README says: none reported
- **Time to close:** **about 8 min** (candidate's figure; the month was closed). The candidate first said "around 20 mins" and corrected it to "about 8 mins" in the same message thread; 8 min is the figure used.
- Deviations from the README, and anything that felt slow:
  - "I didn't see any README or wasn't able to see it if there is." The month was closed without it.
  - Slowest part: "there's no optimistic UI and loading indicators (it feels hanging when interacting but they [are] successful) for every transaction."
  - "The UI feels cluttered vertically."

| mm:ss | Note |
|---|---|
| not recorded | No timed notes were kept; the three points above are the candidate's summary after the run |

**Scored against the key** (the downloaded `ledger-2026-10.csv`, compared with `fixtures/dataset/ground-truth.json` by script, Day 4):

- **37 of 40 receipts as the key expects.** Duplicates R09 and R10 confirmed; R04 paired with L16 and signed off; purposes added to R06 and R07; R14 reimbursed; every automatic match correct.
- **3 wrong, all pairings chosen by the person, each signed off with the reason "Good":**
  - R13 ($14.70 coffee, personal card) paired with L26, SAMPLE PETROL $75.20 on the company card. Expected: no line, reimburse $14.70.
  - R15 ($19.99) paired with L32, SAMPLE BOOKSHOP $34.95. Expected: L22 ($19.99), which was instead recorded as a substitute.
  - R20 ($268.00 hotel) paired with L40, METRO TAXI $31.20. Expected: no payment found, so remove or reimburse with a reason.
- Effect on the month: receipts in the ledger total $5,497.91 against $5,391.25 in the ground truth (**$106.66 over**); three of the nine "no receipt" payments (L26, L32, L40) were absorbed into unrelated receipts; R13's submitter is not reimbursed.
- The four signed-off differences (R04, R13, R15, R20) were approved within 13 seconds (05:21:24 to 05:21:37), all with the reason "Good".
- Not in the key, noted: R21 approved with payment source "Unknown"; substitutes recorded as L02 pharmacy, L12 parking, and L22 app store under Meals & Entertainment, L36 cafe under Office Supplies, and L44 card fee under Rent & Workspace, all with the reasons "Good" or "Monthly"; L19 and L24 are not in the ledger (marked not an expense, or otherwise left out).
- *Agent's hypothesis, not observed:* R13 was a reimbursement with no payment, yet its payment section was titled "Wrong payment? Choose another", which reads as if something needed changing. Relabelled; whether it caused the pairing is unknown.

**Changes made in response** (builder evidence; candidate chose which, Day 4):

| C1 finding | Change | Commit | Checked how |
|---|---|---|---|
| Three unrelated pairings signed off as "Good"; ledger $106.66 over | Candidate's ruling "warn and show both": a pairing that does not fit shows receipt and payment side by side with what does not fit; every reason must be specific (8+ characters, not only generic words) | `b35ad79` | 7 tests (C1's R13 → L26 replayed, "Good" refused, no October auto-match flagged); 6 mutations caught; browser: the R13 pairing shows 5 concerns and "Good" is refused |
| "It feels hanging"; no loading indicators | One client component: the pressed button says "Saving…" (or what is running) and its form's buttons are disabled until the action finishes | this commit | browser: with the reply held 2 s, the button reads "Saving…" and is disabled |
| "The UI feels cluttered vertically" | The five queue groups and Done are tabs with counts; one group on screen; the page opens on the first group with work and keeps the person's tab after an action | this commit | browser: counts add up to all 51 items; the open page fits one screen (900 px); stays on the tab after approving; no sideways scroll at 390 px |
| "I didn't see any README" | "How to close a month" in the header and on the first page; the guide page renders the README's user sections, so they cannot drift | this commit | 3 tests over the real README; browser: five sections and the flag table |
| (hypothesis above) | "Not paid personally? Choose a payment" for a receipt with no payment | this commit | browser |

## Comparison (fill after both runs)

| Measure | B0 (estimate) | B1 (candidate, ChatGPT) | C1 (candidate, system) | P1 (proxy, system) |
|---|---|---|---|---|
| Time to close, 40 receipts | 20–40 min (labelled estimate) | about 11 min 10 s (extrapolated from 20 receipts) | **about 8 min** (builder; knows every screen) | |
| Wrong matches | not measured | 3/19 **3 of 40** receipts, all paired by the person and signed off as "Good" (R13, R15, R20); automatic matches 0 wrong. Ledger $106.66 over the ground truth | |
| Assisted? | n/a | n/a | n/a | |
