# Eval run `v2-day4-tuning-before-scoring`

Mode **replay**, model `gpt-5.6-sol` (effort low), commit `3a2469d`, 2026-11-03T14:01:54.930Z.
Receipts evaluated: 24 of 40.

## Test cases (pass only if every expected behaviour holds)

| TC | Receipts | Result |
|---|---|---|
| TC03 | R03 | PASS |
| TC05 | R05 | PASS |
| TC07 | R08, R09, R10 | PASS |
| TC09 | R12 | PASS |
| TC10 | R13, R14 | PASS |
| TC11 | R15 | PASS |
| TC12 | R16 | PASS |

## Metrics

| Metric | Evaluated set | Holdout part |
|---|---|---|
| Extraction: total | 24/24 (100%) | n/a |
| Extraction: currency | 24/24 (100%) | n/a |
| Extraction: date | 24/24 (100%) | n/a |
| Extraction: vendor | 22/24 (92%) | n/a |
| Category accuracy (before review) | 24/24 (100%) | n/a |
| Match recall (auto-match or top-1 candidate) | 20/20 (100%) | n/a |
| Wrong auto-match rate | 0/19 (0%) | n/a |
| Exception recall (amount, purpose, duplicate) | 2/2 (100%) | n/a |
| Human touches (receipts not bulk-approvable) | 5/24 (21%) | n/a |
| No-receipt line recall (full set only) | n/a | n/a |

Latency per receipt (model time, from the recorded live run): p50 2526 ms, p95 4747 ms.
Tokens: 54125 input, 2549 output.
Cost: at most USD 0.2675 (USD 0.0111 per receipt; upper bound, all input at the full rate; 4/M input, 20/M output; OpenAI API Pricing page, as reported by the candidate, 2026-11-03).

## Every failed assertion

None.
