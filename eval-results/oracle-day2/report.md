# Eval run `oracle-day2`

Mode **oracle**, model `oracle (ground-truth fields)` (effort low), commit `c4afc51`, 2026-11-03T06:06:46.172Z.
Receipts evaluated: 40 of 40 (full set).

> Oracle mode: the model returns the ground-truth fields, so this measures the rules and pipeline alone, not perception.

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
| Extraction: vendor | 40/40 (100%) | 16/16 (100%) |
| Category accuracy (before review) | 40/40 (100%) | 16/16 (100%) |
| Match recall (auto-match or top-1 candidate) | 35/35 (100%) | 15/15 (100%) |
| Wrong auto-match rate | 0/33 (0%) | 0/14 (0%) |
| Exception recall (amount, purpose, duplicate) | 5/5 (100%) | 3/3 (100%) |
| Human touches (receipts not bulk-approvable) | 9/40 (23%) | 4/16 (25%) |
| No-receipt line recall (full set only) | 9/9 (100%) | n/a |

Latency per receipt (model time, from no model calls): not applicable (oracle mode).
Tokens: not applicable (oracle mode).
Cost: not applicable (oracle mode makes no model calls).

## Every failed assertion

None.
