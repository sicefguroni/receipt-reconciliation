# Stress run `v2-day4-pre-stress-2`

Mode **live**, model `gpt-5.6-sol` (effort low), commit `dd07c1f`, 2026-11-03T13:49:56.438Z.

A case passes when the system fails *safely*: the right answer, or a person is asked. **correct** = right answer; **safe** = wrong or unsure, but routed to a person; **failure** = a silent wrong value, a wrong pairing, or a rejected valid input.

**6/10 pass** (2 correct, 4 safe, 4 failure).

| ID | Stress case | Result | Outcome |
|---|---|---|---|
| S01 | Unreadable photo, 400 px | PASS | correct |
| S02 | Heavy blur at full size | PASS | safe |
| S03 | Chat screenshot | FAIL | failure |
| S04 | Bare $ with no currency clues | PASS | safe |
| S05 | Ambiguous numeric date from a US vendor | PASS | correct |
| S06 | One receipt, two payments | PASS | safe |
| S07 | Purchase later refunded | FAIL | failure |
| S08 | Only the refund is on the statement | FAIL | failure |
| S09 | Statement with an extra header row and ISO dates | FAIL | failure |
| S10 | FX API unreachable | PASS | safe |

## S01: Unreadable photo, 400 px

- 06 stress case: an unreadable photo (heavy blur, 400 px)
- Expected: Stopped at the quality gate (R-QUA-1) with the measured size and a fix; never sent to the model; not matched; out of totals.
- Observed: read: nothing read
- Observed: status unmatched; exceptions [UNREADABLE]; queue group 1
- Observed: candidates: none
- Observed: run log errors: quality QUALITY_GATE
- Observed: note: Photo is 300 × 400. Retake it closer, or upload the original PDF.
- Failed assertions: none

## S02: Heavy blur at full size

- 06 stress case: an unreadable photo (heavy blur), at a size that passes the gate
- Expected: Either read correctly, or every doubtful field is flagged (LOW_CONFIDENCE_FIELD or UNREADABLE). Never a wrong total, date, or currency with high confidence that a person could bulk-approve.
- Observed: read: total null (0), date null (0), currency null (0); isReceipt true
- Observed: status unmatched; exceptions [NO_PAYMENT_FOUND, LOW_CONFIDENCE_FIELD, UNKNOWN_CATEGORY]; queue group 3
- Observed: candidates: none
- Observed: run log errors: none
- Failed assertions: none

## S03: Chat screenshot

- 06 stress case: a non-receipt image (a screenshot of a chat)
- Expected: NOT_A_RECEIPT (R-QUA-4), in the first queue group; it must not take the $45.00 Sample Supplies line, which stays listed as a line with no receipt.
- Observed: read: nothing read
- Observed: status unmatched; exceptions [UNREADABLE]; queue group 1
- Observed: candidates: none
- Observed: run log errors: quality QUALITY_GATE
- **Failed:** not flagged NOT_A_RECEIPT

## S04: Bare $ with no currency clues

- 06 stress case: "$" with no currency clues
- Expected: Currency flagged for a person (R-CUR-5: never assumed to be AUD without evidence), so it is not bulk-approvable. No address, ABN, GST, or currency code is printed.
- Observed: read: total 24 (1), date "2026-10-09" (0.75), currency null (0); isReceipt true
- Observed: status ambiguous; exceptions [AMBIGUOUS_MATCH, LOW_CONFIDENCE_FIELD]; queue group 3
- Observed: candidates: L06:50 L05:30 L03:20
- Observed: run log errors: none
- Failed assertions: none

## S05: Ambiguous numeric date from a US vendor

- 06 stress case: a date in ambiguous 03/04/2026 format
- Expected: The printed 10/09/2026 is month-first (a US invoice: 9 October). Read as 2026-10-09, or the date flagged low-confidence. Never 2026-09-10 with high confidence.
- Observed: read: total 29 (1), date "2026-10-09" (0.75), currency "USD" (1); isReceipt true
- Observed: status matched → L07; exceptions [LOW_CONFIDENCE_FIELD]; queue group 3
- Observed: candidates: L07:100 L05:60 L06:30
- Observed: run log errors: none
- Failed assertions: none

## S06: One receipt, two payments

- 06 stress case: a receipt covering two items paid in two transactions
- Expected: Never auto-paired with either part payment (each is far from $620). It goes to a person, and both lines stay visible, so the $620 is not lost or counted twice.
- Observed: read: total 620 (1), date "2026-10-03" (1), currency "AUD" (1); isReceipt true
- Observed: status ambiguous; exceptions [AMBIGUOUS_MATCH, UNKNOWN_CATEGORY]; queue group 3
- Observed: candidates: L02:50 L01:40 L09:25
- Observed: run log errors: none
- Failed assertions: none

## S07: Purchase later refunded

- 06 stress case: a refund (a negative statement line)
- Expected: Matched to the $64.00 purchase. The −$64.00 refund three days later is never offered as a payment for any receipt; it is listed as a credit for a person to record.
- Observed: read: total 64 (1), date "2026-10-12" (1), currency "AUD" (0.98); isReceipt true
- Observed: status matched → L08; exceptions []; queue group 5
- Observed: candidates: L08:100 L09:40 L06:20
- Observed: run log errors: none
- **Failed:** S06 lists credit L09 (score 25)
- **Failed:** S07 lists credit L09 (score 40)
- **Failed:** S08 lists credit L09 (score 10)

## S08: Only the refund is on the statement

- 06 stress case: a refund (a negative statement line), with no purchase line
- Expected: The purchase is not on this statement, only a −$38.50 refund two days later. NO_PAYMENT_FOUND; the refund is never offered as the payment (choosing it would put a negative amount in the ledger as if paid).
- Observed: read: total 38.5 (1), date "2026-10-20" (1), currency "AUD" (0.99); isReceipt true
- Observed: status ambiguous; exceptions [AMBIGUOUS_MATCH]; queue group 4
- Observed: candidates: L10:40 L04:35 L09:10
- Observed: run log errors: none
- **Failed:** S08 lists credit L10 (score 40)
- **Failed:** not flagged NO_PAYMENT_FOUND

## S09: Statement with an extra header row and ISO dates

- 06 stress case: a statement CSV with an extra header row and a different date format
- Expected: The October statement (44 lines) read exactly as the plain format-A file reads it.
- Observed: rejected: "The statement's columns were not recognised (found: Business Visa ...4821 - Transactions 01/10/2026 to 31/10/2026). Supported: Format A (one signed Amount column): Date, Account, Description, Amount, Foreign Amount, Foreign Currency; Format B (separate Debit and Credit columns): Posted, Account Type, Merchant Name, Debit, Credit, Orig. Amount, Orig. Ccy. Export it again in one of these layouts."
- **Failed:** a valid statement was rejected

## S10: FX API unreachable

- 06 stress case: the FX API being unreachable (simulated)
- Expected: No rate of 1, ever. With a cold cache: each foreign receipt is paid at the bank's AUD charge or flagged FX_RATE_UNAVAILABLE and left out of totals with the amount shown. With a warm cache: the same month as normal.
- Observed: foreign receipts: 6; cold cache: 6 flagged FX_RATE_UNAVAILABLE, of which 6 already paid at the bank's AUD charge (R02, R21, R22, R23, R31, R39)
- Observed: ledger total: normal 4811.26, cold 4811.26, warm 4811.26; excluded (cold): [{"currency":"USD","amount":224.4,"count":6}]
- Observed: human touches over 40 receipts: normal 9, cold 15, warm 9
- Failed assertions: none

Tokens (stress receipts, this run): 6022 input, 1054 output.
