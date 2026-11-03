# Eval run `v0-day2-tc01-live`

Mode **live**, model `gpt-5.6-sol` (effort low), commit `e94beef`, 2026-11-03T06:08:33.254Z.
Receipts evaluated: 2 of 40 (cases TC01, TC02).

## Test cases (pass only if every expected behaviour holds)

| TC | Receipts | Result |
|---|---|---|
| TC01 | R01 | PASS |
| TC02 | R02 | PASS |

## Metrics

| Metric | Evaluated set | Holdout part |
|---|---|---|
| Extraction: total | 2/2 (100%) | 2/2 (100%) |
| Extraction: currency | 2/2 (100%) | 2/2 (100%) |
| Extraction: date | 2/2 (100%) | 2/2 (100%) |
| Extraction: vendor | 2/2 (100%) | 2/2 (100%) |
| Category accuracy (before review) | 2/2 (100%) | 2/2 (100%) |
| Match recall (auto-match or top-1 candidate) | 2/2 (100%) | 2/2 (100%) |
| Wrong auto-match rate | 0/2 (0%) | 0/2 (0%) |
| Exception recall (amount, purpose, duplicate) | n/a | n/a |
| Human touches (receipts not bulk-approvable) | 0/2 (0%) | 0/2 (0%) |
| No-receipt line recall (full set only) | n/a | n/a |

Latency per receipt (model time, from this run): p50 3579 ms, p95 5980 ms.
Tokens: 4600 input, 223 output.
Cost: at most USD 0.0229 (USD 0.0114 per receipt; upper bound, all input at the full rate; 4/M input, 20/M output; OpenAI API Pricing page, as reported by the candidate, 2026-11-03).

## Every failed assertion

None.
