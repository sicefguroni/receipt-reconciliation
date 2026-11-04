# Feedback session

**Status: not run yet.** This file is the protocol and the blank record. Nothing below the "Record" headings may be filled in from memory or by an agent: only from the session itself, paraphrased from what the person said (`CLAUDE.md`, non-negotiable 1).

## Who, when, and why (decided 2026-11-03)

There is no Accounting user for this sprint. The feedback comes from the **naive proxy** who runs the first execution (P1, `../day-3-working-core/first-run-observations.md`), **straight after P1, in the same sitting**, on the Day 4 build. Everything recorded here is labelled **proxy feedback**, never the Accounting user's.

Why the same sitting: the proxy has just closed (or tried to close) the month, so the answers are about what they did, not what they imagine. Why after the Day 4 fixes: the build they judge is the one that will ship.

| Can show | Cannot show |
|---|---|
| What someone with bookkeeping experience, new to the app, trusted or doubted after one close | The Accounting user's judgement, habits, or the company's policy |
| Wording, order, and actions that confused them | Whether the confusion would last past the first month |

## Setup

- Commit: the one P1 ran on (note it below).
- Straight after P1's stopwatch stops. No break, no walkthrough in between.
- The observer asks the four questions from `06`, in this order, word for word, and writes down what is said. Follow-up allowed: *"Can you show me where?"* Nothing that suggests an answer.

1. *"What did you trust?"*
2. *"What didn't you trust?"*
3. *"What was confusing?"*
4. *"What would stop you using it next month?"*

Then, only if they did not come up on their own (mark each answer as **prompted**):

5. *"There were lines on the statement with no receipt. What did you make of them?"*
6. *"Did you look at why a payment was matched to a receipt?"*

## Record (proxy feedback)

*Recorded from the observer's (candidate's) report, word for word where quoted; nothing added. Proxy feedback, not the Accounting user.*

- Date: Day 4
- Commit: `db8579c`
- Runner: same person as P1 (business management, 1 year; no names)
- Length of the conversation (mm:ss): not recorded

| # | Question | What they said (exact words in quotes) | Screen / item they pointed at |
|---|---|---|---|
| 1 | Trusted | "the matching" | not recorded |
| 2 | Did not trust | "nothing" | — |
| 3 | Confusing | "nothing so far, it might be cause of the UI of the tables and the detail card of each row. we should stick also to the standard light colors and modern tables/card for them because currently it looks like the UI is just separated with breaklines or lines" | the queue rows and the open row's detail |
| 4 | Would stop them next month | "might be if the the loading and rendering times are slow, like rendering content per tab. im good if it's standardly quick enough." | the tabs |
| 5 | No-receipt lines (prompted?) | not recorded | — |
| 6 | Match reasons (prompted?) | not recorded | — |

**Other comments** (exact words):

- "i notice when i switch when tabs, my inputs are erased"
- "UI should just be standard light"

**Read alongside the scoring** (P1 record): the proxy said they trusted the matching and distrusted nothing; their one wrong decision was a pairing they made themselves (R20 with a $10.00 card fee), which the system had flagged on screen.

## Feedback → change pairs

Fill after the session. Each change also goes in `TRACKER.md` with the feedback that caused it. "No change" is a valid decision when the reason is written down.

| Feedback (row #) | Change made, or "no change" and why | Commit | Checked how |
|---|---|---|---|
| | | | |
