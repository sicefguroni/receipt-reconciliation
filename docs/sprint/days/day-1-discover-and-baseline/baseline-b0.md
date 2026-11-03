# B0 baseline: manual process

**Status: not measured. The time below is a labelled estimate.** The Accounting user was not available on Day 1. The candidate could not act as a proxy without bias, because they had seen the answer key. An AI agent could not stand in either: B0 measures a person working by hand, so an agent's time and accuracy would be another AI baseline, not B0. The B0 kit (`fixtures/dataset/baseline/b0-kit/`) is kept so a timed run can still be done if a person becomes available.

## Time: estimate

**Basis:** the current process, after the redesign (the redesigned finance tool, with receipts paired to payments by hand). This is what the new system replaces. Pre-redesign figures are not B0.

| Input | Value | Source |
|---|---|---|
| Time per receipt (read, find the payment, check, flag) | **30 seconds to 1 minute** | Candidate's estimate for the current process, not timed |
| Receipts per month | 30 to 60 | Candidate's estimate (`interview-notes.md`, Q2) |

| Scope | Arithmetic | Estimated B0 time |
|---|---|---|
| 20-item baseline subset | 20 × 0.5 to 1 min | **10 to 20 min** |
| The 40-receipt synthetic month | 40 × 0.5 to 1 min | **20 to 40 min** |
| A typical real month | 30 to 60 × 0.5 to 1 min | **15 to 60 min** |

**Not included:** exporting the statement, chasing submitters for missing purposes or receipts, resolving payments with no receipt, and building the report. The estimate covers only the per-receipt work, so the real close is probably longer.

**Revision history.** The candidate first estimated 1 to 4 minutes per receipt (2026-11-03) without saying which process it described. After agreeing that B0 must be the current, post-redesign process, they revised it to 30 seconds to 1 minute the same day, before any system timing existed. The revision makes B0 *faster*, which makes the system's time claim harder to win, not easier.

**What this means for the time target.** `03` sets "at least 50% less than B0". Against an estimate band, that claim holds convincingly only if the system's close is at most half of the **low** end. For the 40-receipt month, that means **10 minutes or less** (half of 20). Anything between 10 and 20 minutes is faster than the band's middle but not convincingly 50% faster, and the results must say so.

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
