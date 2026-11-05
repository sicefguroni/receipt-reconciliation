# Eval run `final-replay`

Mode **replay**, model `gpt-5.6-sol` (effort low), commit `b72b858`, 2026-11-05T03:14:04.131Z.
Receipts evaluated: 40 of 40 (full set).

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
| TC09 | R12 | PASS |
| TC10 | R13, R14 | PASS |
| TC11 | R15 | PASS |
| TC12 | R16, R17, R18, R19 | PASS |

## Metrics

| Metric | Evaluated set | Holdout part |
|---|---|---|
| Extraction: total | 40/40 (100%) | 16/16 (100%) |
| Extraction: currency | 40/40 (100%) | 16/16 (100%) |
| Extraction: date | 40/40 (100%) | 16/16 (100%) |
| Extraction: vendor | 38/40 (95%) | 16/16 (100%) |
| Category accuracy (before review) | 40/40 (100%) | 16/16 (100%) |
| Match recall (auto-match or top-1 candidate) | 35/35 (100%) | 15/15 (100%) |
| Wrong auto-match rate | 0/33 (0%) | 0/14 (0%) |
| Exception recall (amount, purpose, duplicate) | 5/5 (100%) | 3/3 (100%) |
| Human touches (receipts not bulk-approvable) | 10/40 (25%) | 5/16 (31%) |
| No-receipt line recall (full set only) | 9/9 (100%) | n/a |

Latency per receipt (model time, from the recorded live run): p50 1963 ms, p95 5031 ms.
Tokens: 91425 input, 4227 output.
Cost: at most USD 0.4502 (USD 0.0113 per receipt; upper bound, all input at the full rate; 4/M input, 20/M output; OpenAI API Pricing page, as reported by the candidate, 2026-11-03).

## Every failed assertion

None.
