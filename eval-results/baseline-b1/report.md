# baseline-b1: scores against ground truth

Answer files: `docs/sprint/days/day-1-discover-and-baseline/b1-raw/run-1.md`, `docs/sprint/days/day-1-discover-and-baseline/b1-raw/run-2.md`, `docs/sprint/days/day-1-discover-and-baseline/b1-raw/run-3.md`. Baseline subset: 20 receipts.

| Metric | Run 1 | Run 2 | Run 3 |
|---|---|---|---|
| Extraction: total | 20/20 (100%) | 20/20 (100%) | 20/20 (100%) |
| Extraction: currency | 20/20 (100%) | 20/20 (100%) | 20/20 (100%) |
| Extraction: date | 20/20 (100%) | 20/20 (100%) | 20/20 (100%) |
| Extraction: vendor | 20/20 (100%) | 20/20 (100%) | 20/20 (100%) |
| Category accuracy | 20/20 (100%) | 20/20 (100%) | 20/20 (100%) |
| Match recall | 16/16 (100%) | 16/16 (100%) | 16/16 (100%) |
| Wrong-match rate | 3/19 (16%) | 3/19 (16%) | 3/19 (16%) |
| Exception recall (amount, purpose, duplicate) | 5/5 (100%) | 5/5 (100%) | 5/5 (100%) |
| Recall: AMBIGUOUS_MATCH | 1/1 (100%) | 0/1 (0%) | 1/1 (100%) |
| Recall: AMOUNT_DIFFERS_OVER_THRESHOLD | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) |
| Recall: DUPLICATE | 2/2 (100%) | 2/2 (100%) | 2/2 (100%) |
| Recall: MISSING_PURPOSE | 2/2 (100%) | 2/2 (100%) | 2/2 (100%) |
| Recall: NO_PAYMENT_FOUND | 0/1 (0%) | 0/1 (0%) | 0/1 (0%) |
| Precision: AMBIGUOUS_MATCH | 1/1 (100%) | n/a | 1/1 (100%) |
| Precision: AMOUNT_DIFFERS_OVER_THRESHOLD | 1/2 (50%) | 1/2 (50%) | 1/2 (50%) |
| Precision: DUPLICATE | 2/3 (67%) | 2/3 (67%) | 2/3 (67%) |
| Precision: MISSING_PURPOSE | 2/2 (100%) | 2/2 (100%) | 2/2 (100%) |
| Precision: NO_PAYMENT_FOUND | n/a | n/a | n/a |

## Every miss, wrong match, and extra flag

### Run 1

- R08: extra DUPLICATE
- R09: wrong line L25 (expected none)
- R10: wrong line L25 (expected none)
- R20: wrong line L37 (expected none); missed NO_PAYMENT_FOUND; extra AMOUNT_DIFFERS_OVER_THRESHOLD

Flag coding (Flags column → codes):

- R04: "Approval required — amount discrepancy" → AMOUNT_DIFFERS_OVER_THRESHOLD
- R06: "Missing business purpose" → MISSING_PURPOSE
- R07: "Missing business purpose" → MISSING_PURPOSE
- R08: "Duplicate receipt submission" → DUPLICATE
- R09: "Duplicate receipt submission" → DUPLICATE
- R10: "Duplicate receipt submission" → DUPLICATE
- R15: "Possible duplicate bank charge" → AMBIGUOUS_MATCH
- R20: "Approval required — substantial discrepancy; match unconfirmed" → AMOUNT_DIFFERS_OVER_THRESHOLD

### Run 2

- R08: extra DUPLICATE
- R09: wrong line L25 (expected none)
- R10: wrong line L25 (expected none)
- R15: missed AMBIGUOUS_MATCH
- R20: wrong line L37 (expected none); missed NO_PAYMENT_FOUND; extra AMOUNT_DIFFERS_OVER_THRESHOLD

Flag coding (Flags column → codes):

- R04: "Sign-off required" → AMOUNT_DIFFERS_OVER_THRESHOLD
- R06: "Business purpose missing" → MISSING_PURPOSE
- R07: "Business purpose invalid" → MISSING_PURPOSE
- R08: "Duplicate receipt review" → DUPLICATE
- R09: "Duplicate receipt review" → DUPLICATE
- R10: "Duplicate receipt review" → DUPLICATE
- R20: "Sign-off and payment verification required" → AMOUNT_DIFFERS_OVER_THRESHOLD

### Run 3

- R08: extra DUPLICATE
- R09: wrong line L25 (expected none)
- R10: wrong line L25 (expected none)
- R20: wrong line L37 (expected none); missed NO_PAYMENT_FOUND; extra AMOUNT_DIFFERS_OVER_THRESHOLD

Flag coding (Flags column → codes):

- R04: "Sign-off required: amount mismatch" → AMOUNT_DIFFERS_OVER_THRESHOLD
- R06: "Missing business purpose" → MISSING_PURPOSE
- R07: "Missing business purpose" → MISSING_PURPOSE
- R08: "Duplicate receipt: R09, R10" → DUPLICATE
- R09: "Duplicate receipt: R08, R10" → DUPLICATE
- R10: "Duplicate receipt: R08, R09" → DUPLICATE
- R15: "Possible duplicate card charge" → AMBIGUOUS_MATCH
- R20: "Sign-off required: amount and date mismatch" → AMOUNT_DIFFERS_OVER_THRESHOLD

