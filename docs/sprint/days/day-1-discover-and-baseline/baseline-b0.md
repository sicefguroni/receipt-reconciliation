# B0 baseline: manual process

**Status: not measured. The time below is a labelled estimate.** The Accounting user was not available on Day 1. The candidate could not act as a proxy without bias, because they had seen the answer key. An AI agent could not stand in either: B0 measures a person working by hand, so an agent's time and accuracy would be another AI baseline, not B0. The B0 kit (`fixtures/dataset/baseline/b0-kit/`) is kept so a timed run can still be done if a person becomes available.

## Time: estimate

| Input | Value | Source |
|---|---|---|
| Minutes per receipt (read, find the payment, check, flag) | **1 to 4** | Candidate's estimate from the October UAT, not timed |
| Receipts per month | 30 to 60 | Candidate's estimate (`interview-notes.md`, Q2) |

| Scope | Arithmetic | Estimated B0 time |
|---|---|---|
| 20-item baseline subset | 20 × 1 to 4 min | **20 to 80 min** |
| The 40-receipt synthetic month | 40 × 1 to 4 min | **40 to 160 min** |
| A typical real month | 30 to 60 × 1 to 4 min | **30 to 240 min** (0.5 to 4 h) |

**Not included:** exporting the statement, chasing submitters for missing purposes or receipts, and building the report. The estimate covers only the per-receipt work, so the real close is probably longer.

**What this means for the time target.** `03` sets "at least 50% less than B0". Against an estimate band, that claim holds convincingly only if the system's close is at most half of the **low** end. For the 40-receipt month, that means **20 minutes or less** (half of 40). Anything between 20 and 80 minutes beats the band's middle but not its low end, and the results must say so.

## Accuracy: not measured

Exception recall, match recall, and category accuracy for manual work are not measured. There is no human answer sheet to score. Measure them by running the B0 kit with a person who has not seen this repository, then:

```bash
pnpm score:baseline -- baseline-b0 <their completed answer sheet>
```

(CSV support for the answer sheet would need adding to `scripts/eval/answer-sheet.ts` first.)

## Evidence that does exist about manual accuracy

These come from the Accounting user's own documents (`01`), not from a measurement:

- About a third of spend (35.8%) was filed as "Other" (P3).
- Base-currency receipts were treated as foreign currency, so totals showed $0.00 (E2).
- Categories were wrong on older records (E3).
- "None" was accepted as a business justification (P2, E4).
