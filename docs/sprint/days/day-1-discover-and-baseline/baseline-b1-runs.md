# B1 baseline runs

Prompt and protocol: [`baseline-b1-prompt.md`](baseline-b1-prompt.md). Raw replies are in `b1-raw/run-N.md`, pasted unedited. Table whitespace was compacted on 2026-11-03; a script confirmed every cell is unchanged.

## Runs (from the candidate's notes in `b1-raw/`)

| Run | Date | Tool and model (as recorded) | Time (as recorded) | Files batched? | "continue" count |
|---|---|---|---|---|---|
| 1 | 2026-11-02 | ChatGPT, "GPT 6-Sol" | ~29 s | not recorded | not recorded |
| 2 | 2026-11-02 | ChatGPT, "GPT 5.6-Sol" | ~25 s | not recorded | not recorded |
| 3 | 2026-11-02 | ChatGPT, "GPT 5.6-Sol" | ~26 s | not recorded | not recorded |

**Open questions on these records:**

- **Time.** Was ~25–29 s the full protocol time (upload, wait, copy, check), or only ChatGPT's response time? Until confirmed, **B1 time to close is not measured.** Measure it with a stopwatch from opening a new Temporary Chat to finishing the read-through (protocol steps 3 to 8).
- **Model.** Run 1 is recorded as "GPT 6-Sol" and runs 2 and 3 as "GPT 5.6-Sol". This may be a typo. If not, run 1 used a different model.

## Scores against ground truth (20-item baseline subset)

Produced by `pnpm score:baseline -- baseline-b1 <run files>`. Full output, including every miss and the flag coding, is in `eval-results/baseline-b1/report.md`.

| Metric | Run 1 | Run 2 | Run 3 | Spread |
|---|---|---|---|---|
| Extraction: total / currency / date / vendor | 20/20 each | 20/20 each | 20/20 each | 0 |
| Category accuracy | 20/20 | 20/20 | 20/20 | 0 |
| Match recall (correct line / 16 matchable) | 16/16 | 16/16 | 16/16 | 0 |
| **Wrong-match rate** (wrong line / lines given) | **3/19 (16%)** | **3/19 (16%)** | **3/19 (16%)** | 0 |
| Exception recall: amount, purpose, duplicate (`03` headline) | 5/5 | 5/5 | 5/5 | 0 |
| Recall: `AMBIGUOUS_MATCH` (R15, twin $19.99 lines) | 1/1 | **0/1** | 1/1 | 1 |
| Recall: `NO_PAYMENT_FOUND` (R20, charge after statement period) | **0/1** | **0/1** | **0/1** | 0 |
| Precision: `DUPLICATE` | 2/3 | 2/3 | 2/3 | 0 |
| Precision: `AMOUNT_DIFFERS_OVER_THRESHOLD` | 1/2 | 1/2 | 1/2 | 0 |

## What B1 got wrong (all three runs unless noted)

1. **One payment matched to three receipts.** R08, R09, and R10 were each given statement line L25, even though R09 and R10 were flagged as duplicates. A ledger built from this table assigns one $312 charge three times.
2. **A receipt forced onto another receipt's payment.** R20 (hotel, $268, 31 Oct) has no statement line because the charge posted after the period. All three runs paired it with L37, which is R28's $189 hotel charge from 26 October, 29% different. Runs 1 and 2 marked it "tentative"; run 3 did not. The real problem (no payment in this statement) was never named.
3. **Ambiguity flagged inconsistently.** R15 has two identical $19.99 lines on adjacent days. Runs 1 and 3 flagged the second charge as a possible duplicate; run 2 picked L22 silently. The only variance between runs is here.
4. **The original duplicate was flagged too.** R08 was flagged along with R09 and R10. Ground truth flags only the later uploads (R-DUP-1), so this counts as a false positive. A human flagging the whole set is a defensible choice, though.

## What B1 got right

Every receipt was read correctly (totals, currencies, dates, vendors), every category was right, every matchable receipt got its correct line, and every headline exception was caught. USD receipts were matched on the original amount with the FX fee correctly ignored. TC04 was flagged at 12%, and TC05's $2 tip was correctly left unflagged.

## Variance between runs

Low. The only difference is the R15 ambiguity flag (2 of 3 runs) and whether R20's wrong match was marked "tentative" (2 of 3). The three wrong matches occurred in every run.

## What this means for the comparison (agent's reading)

- On this dataset, B1 already meets or beats the `03` targets for extraction (95%), category (90%), match recall (95%), and headline exception recall (100%). **The system cannot show improvement on those metrics here.** The receipts are clean synthetic renders, so the Day 4 stress cases (blurred and small photos, a bare "$", ambiguous dates, a refund) are where extraction differences would show, if any exist. B1 should also be run on those cases.
- B1 misses the `03` target on the **wrong-match rate (0%)**, at 16% in every run, and on **ledger integrity**: one line was used for three receipts, and a receipt was paired with another receipt's payment. Those are the silent errors the user's evidence describes (E1, E2) and the ones that cost most at month end.
- Not yet tested: whether B1 holds up on the **full 40-receipt month** (upload limits, longer output), and what it costs to put company receipts into a consumer chat tool.
