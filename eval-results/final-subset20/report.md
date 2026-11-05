# Eval run `final-subset20`

Mode **replay**, model `gpt-5.6-sol` (effort low), commit `b72b858`, 2026-11-05T03:14:08.109Z.
Receipts evaluated: 20 of 40.

## Test cases (pass only if every expected behaviour holds)

| TC | Receipts | Result |
|---|---|---|
| TC01 | R01 | PASS |
| TC02 | R02 | PASS |
| TC03 | R03 | PASS |
| TC04 | R04 | PASS |
| TC05 | R05 | PASS |
| TC06 | R06, R07 | PASS |
| TC07 | R08, R09, R10 | PASS |
| TC08 | R11 | PASS |
| TC10 | R13 | PASS |
| TC11 | R15 | PASS |
| TC12 | R16, R19 | PASS |

## Metrics

| Metric | Evaluated set | Holdout part |
|---|---|---|
| Extraction: total | 20/20 (100%) | 9/9 (100%) |
| Extraction: currency | 20/20 (100%) | 9/9 (100%) |
| Extraction: date | 20/20 (100%) | 9/9 (100%) |
| Extraction: vendor | 19/20 (95%) | 9/9 (100%) |
| Category accuracy (before review) | 20/20 (100%) | 9/9 (100%) |
| Match recall (auto-match or top-1 candidate) | 16/16 (100%) | 8/8 (100%) |
| Wrong auto-match rate | 0/14 (0%) | 0/7 (0%) |
| Exception recall (amount, purpose, duplicate) | 5/5 (100%) | 3/3 (100%) |
| Human touches (receipts not bulk-approvable) | 8/20 (40%) | 4/9 (44%) |
| No-receipt line recall (full set only) | n/a | n/a |

Latency per receipt (model time, from the recorded live run): p50 2587 ms, p95 5387 ms.
Tokens: 49190 input, 2091 output.
Cost: at most USD 0.2386 (USD 0.0119 per receipt; upper bound, all input at the full rate; 4/M input, 20/M output; OpenAI API Pricing page, as reported by the candidate, 2026-11-03).

## Every failed assertion

None.
