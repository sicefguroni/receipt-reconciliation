# 05. Business Rules (Source of Truth for `src/core`)

Every rule has an ID. Every ID has at least one Vitest case named after it (for example `it("R-CUR-1: AUD receipts never enter FX conversion")`). Rules marked **CONFIRM WITH USER** must be confirmed by the Accounting user on Day 1 or Day 3. Until confirmed, implement them as configurable defaults.

## Currency (R-CUR)

- **R-CUR-1** The base currency is AUD. A receipt whose extracted currency is AUD **never** enters FX conversion and is always included in AUD totals. *(Regression for evidence E2.)*
- **R-CUR-2** A non-AUD receipt is converted at the ECB reference rate for the receipt date. If there is no rate that day (weekend or holiday), use the most recent earlier business day. Store the rate, the rate date, and the source on the receipt.
- **R-CUR-3** If no rate can be obtained **and the AUD amount depends on one**, flag `FX_RATE_UNAVAILABLE` and exclude the item from totals, with the excluded **amount and currency** shown in the summary, not just a count. *(Evidence E2.)* *Clarified 2026-11-03 (Day 4, failure F4):* a receipt paid from a statement line whose amount was compared in the receipt's own currency takes the bank's AUD charge (R-CUR-4), so it is neither flagged nor listed as excluded. Before this, an FX outage flagged six already-paid USD receipts (human touches 9 → 15) and the summary listed USD 224.40 as excluded while the ledger included it. If the amount could not be compared (the line shows only AUD), the flag stays, even after a person chooses that line.
- **R-CUR-4** When a statement line shows both the original foreign amount and the AUD charge, matching uses the foreign amount against the receipt total, and the AUD charge becomes the ledger amount. The bank's FX margin and fees are not an "amount difference".
- **R-CUR-5** An ambiguous currency symbol ("$") with no other signal: infer from vendor and country clues in the receipt, with confidence. If confidence is below threshold, flag `LOW_CONFIDENCE_FIELD` on currency. Never silently assume.

## Amount differences (R-AMT)

- **R-AMT-1** Difference = |ledger amount in AUD − expected AUD amount from the receipt|.
- **R-AMT-2** *Confirmed 2026-11-02: the OR reading.* Flag `AMOUNT_DIFFERS_OVER_THRESHOLD` when the difference is **over 10% of the receipt amount OR over $100 AUD**, whichever triggers first. Both numbers stay configurable, because the finance lead owns the policy (`01`, "Open policy questions"). A line with an over-threshold difference is **never paired automatically**. It earns no amount points (R-MAT), so the receipt reaches the queue as `AMBIGUOUS_MATCH` with that line among its candidates (R-MAT-2), or as `NO_PAYMENT_FOUND` if no candidate scores 40. If the human chooses that line, the status becomes `amount_differs` and the flag fires.
- **R-AMT-3** *Confirmed 2026-11-02.* A difference at or under the threshold but above $0.01 is still a normal match: status `matched` and bulk-approvable. It shows a visible difference badge (for example "+$2.00 vs receipt") on the item and in the ledger. No reason is needed. Typical causes are tips and card surcharges.
- **R-AMT-4** Signing off an over-threshold difference requires a reason. *(Keeps a behaviour that worked in UAT.)* *Changed Day 4 (C1, candidate's ruling "warn and show both"):* every reason a person gives (sign-off, substitute, not an expense, reimburse with no line, not a duplicate) must be **specific**: at least 8 characters, and not only generic words such as "good", "ok", "approved", or "monthly". *Why:* in the builder's cold run every sign-off said "Good", including three pairings of a receipt with an unrelated payment (ledger $106.66 over).

## Matching (R-MAT)

Score each (receipt, statement line) pair for unmatched lines in the same month, plus 5 days either side:

| Signal | Points |
|---|---|
| Amount equal (after R-CUR-4) | +50 |
| Amount within R-AMT-2 threshold | +30 (instead of +50) |
| Date diff 0–1 days | +25; 2–3 days +15; 4–5 days +5 |
| Vendor similarity (normalised token overlap with the statement description) ≥ 0.6 | +20; ≥ 0.3 +10. *Day 4 (F5):* a vendor whose words run together equal consecutive whole words of the description counts as a full match ("brightreachads" = "BRIGHTREACH ADS"), and the reverse |
| Account matches the receipt's payment source | +5 |

- **R-MAT-1** Auto-match only if the best score is **≥ 75** and beats the runner-up by **≥ 20**. Both numbers are configurable and tuned on Day 4 using only the tuning split (see `06`).
- **R-MAT-2** If the best score is ≥ 40 but R-MAT-1 fails, the status is `ambiguous` and the queue shows the top 3 candidates with their reasons.
- **R-MAT-3** If the best score is < 40, the status is `unmatched`. For `personal_card`, the queue offers "Reimburse (no statement line)". Otherwise it flags `NO_PAYMENT_FOUND`.
- **R-MAT-4** A statement line can be matched to at most one receipt unless a human splits it. Assign greedily by highest score, so a line taken by a higher-scoring receipt is unavailable to others.
- **R-MAT-5** Match status is derived **only** from these rules or from a human `choose_match` / `override_status` decision. Payment status = `paid` if and only if status ∈ {matched, amount_differs} with a statement line. *(Evidence E1, P5.)*
- **R-MAT-6** Every auto-match and candidate shows its reasons in plain language ("same amount, 1 day apart, vendor name matches"). The user asked for "same amount & date, one click" (P1), so the reasons must make that one click trustworthy. *Added Day 4 (C1):* when a receipt is paired with a payment that does not fit, the review page lists what does not fit in plain words and shows the receipt and the payment side by side before sign-off or approval: not a suggested payment, a vendor that does not look alike, the size of the difference in %, more than 3 days apart, a different account from the one the receipt names. The person can still go ahead with a specific reason (R-AMT-4). No automatic match on the October month carries a concern (tested).
- **R-MAT-7** *Added 2026-11-03.* After matching and the human's match decisions, every statement line not matched to a receipt is listed as **"No receipt"**. The user resolves each one with one of three actions, each audited and the last two needing a reason: link an uploaded receipt; record a substitute (the payment is real but the receipt is missing or unreadable, matching the "create own invoice" step from the interview); or mark it not an expense (for example a bank fee). Until resolved, the line stays out of the ledger and is shown in the month-end pack.
- **R-MAT-10** *Added 2026-11-04 (Day 4 open item, stress S06).* A person may say that one receipt was paid by **two or more statement lines** (a deposit and a balance, for example). This is the human split R-MAT-4 allows; it is never automatic. The amount rules apply to the **sum** of the lines (R-AMT, with R-CUR-4 comparing in the receipt's currency only when every line shows it); the ledger amount is the sum of the AUD charged; every line leaves the "No receipt" list. Each line must be free, not resolved, and not a credit (R-MAT-8). If another receipt later claims one of the lines, the whole split is undone (R-MAT-4). Approval keeps the split. *Why:* before this, a receipt paid in two parts could be paired with one part only, so the reviewer had to sign off a false difference and record the other part as a substitute.
- **R-MAT-9** *Added 2026-11-03 (Day 4, failure F6).* A statement line more than **7 days** (configurable, `MATCH_MAX_DAYS_APART`) from the receipt date is not a candidate. A receipt with no date is not gated. *Tuned on the tuning split only:* posting lag there is 0–2 days (20 receipts), and 7 covers a weekend plus a public holiday. *Why:* the date table gives 0 points beyond 5 days, but amount-within-policy (+30) plus a shared word like "cafe" (+10) still reached the 40-point candidate floor, so a personal-card coffee with no payment was shown a line 15 days earlier as its possible payment.
- **R-MAT-8** *Added 2026-11-03 (Day 4, failure F1).* A **credit** (a statement line with a negative amount: a refund or reversal) is never a receipt's payment. It is not scored, not offered as a candidate, and cannot be chosen for or linked to a receipt. It is listed under R-MAT-7 as a "refund or credit", resolved by recording it against the category it reduces (a negative ledger row) or marking it not an expense, each with a reason. *Why:* a refund shares the purchase's vendor, account, and a nearby date, so it scored 40–50 and was offered as the payment; choosing it would have put a negative amount in the ledger as if the receipt were paid.

## Required information (R-REQ)

- **R-REQ-1** A missing or blank business purpose (after trim, or placeholder text such as "n/a", "-", or "none") flags `MISSING_PURPOSE`. The item cannot be approved until a purpose is added. *(Evidence E4.)*
- **R-REQ-2** A `paymentSource` of `unknown` is allowed but visible and editable. Its default display is "Unknown — set payment source". *(Evidence E8.)*
- **R-REQ-3** *Added 2026-11-02.* `paymentSource` is one of `company_card`, `personal_card`, `bank` (for example a direct debit from the business account), or `unknown`. A `bank` receipt earns the account point (R-MAT) against `bank` statement lines.

## Duplicates (R-DUP)

- **R-DUP-1** Two receipts are duplicates if their file hashes are equal, **or** if vendor (normalised), date, total, and currency are all equal. The later upload is flagged `DUPLICATE` and excluded from totals until a human decides. *(Evidence P4: "the same cost can be entered twice".)* *Confirmed 2026-11-02:* the system never deletes a duplicate. The item stays in the month, marked, and the human chooses between "confirm duplicate" (kept on record, excluded from totals) and "not a duplicate" (included).
- **R-DUP-2** The same vendor and amount on different dates is **not** a duplicate (for example monthly subscriptions).

## Receipt quality gate (R-QUA)

- **R-QUA-1** Dimension check is orientation-aware: **long side ≥ 1000 px and short side ≥ 700 px**. *(Evidence E5: a fixed width × height rejected portrait scans.)* *Checked 2026-11-03 (second-hand):* receipts vary and are roughly letter-size documents, and no pixel sizes are known. A phone photo of a letter-size page is normally well above this minimum, so the default is kept. It stays configurable (`QUALITY_MIN_LONG_SIDE`, `QUALITY_MIN_SHORT_SIDE`). *Changed 2026-11-03 (Day 4, failure F2, candidate's ruling):* the floor applies to **camera photos (JPEG) only**, as R-QUA-2 does for blur. A chat screenshot (840 × 700 PNG) was rejected with "Retake it closer" before the model could report `NOT_A_RECEIPT`; a crisp screenshot is readable at that size, and the model flags what it cannot read (stress S02 returned empty fields at confidence 0, not guesses).
- **R-QUA-2** Blur checks apply **only to raster photos**. PDFs and screenshots with embedded text skip the blur check. *(Evidence E5.)*
- **R-QUA-3** A failed gate gives a plain reason and a fix: "Photo is 600 × 820. Retake it closer, or upload the original PDF."
- **R-QUA-4** The model may report `isReceipt: false`, which flags `NOT_A_RECEIPT`.

## Categories (R-CAT)

Default chart (configurable in `config/categories.json`):

| Category | Seed vendor keywords (rule table) |
|---|---|
| Advertising & Marketing | ads, meta ads, google ads, linkedin ads, facebook |
| AI & Cloud | aws, azure, gcp, data centre, openai, anthropic, vercel, supabase |
| Software | canva, notion, slack, figma, adobe, zoom, google workspace |
| Rent & Workspace | coworking, office rent, desk hire |
| Equipment | chair, desk, monitor, laptop, keyboard |
| Office Supplies | stationer (matches stationery and stationers; changed 2026-11-03), paper, printer ink |
| Travel | airline, flight, hotel, uber, taxi |
| Meals & Entertainment | cafe, restaurant, catering |
| Repairs & Maintenance | repair, maintenance, servicing |
| Utilities | electricity, water, internet, phone |
| Other | (only by explicit human choice) |

- **R-CAT-1** The rule table is applied first. A keyword hit gives source `rule` with confidence 1.0. *Implemented 2026-11-03:* keywords match the start of a word, case and accents ignored, and the vendor name is checked before the extracted item summary (a hardware store sells both chairs and printer supplies). Known risk: a summary hit lets one item decide a mixed basket.
- **R-CAT-2** If there is no rule hit, the model picks from the configured list only (enumerated in the schema) and returns a reason. Confidence below 0.7 flags `UNKNOWN_CATEGORY`.
- **R-CAT-3** The model may never choose "Other". Only a human can. *(Evidence E3: "Other" became a dumping ground.)*
- **R-CAT-4** When a human corrects a category, the UI offers "Always use this category for <vendor>", which appends to the rule table and is audited.
- **R-CAT-5** Category names are displayed exactly as configured (no slug forms such as "ai cloud"). *(Evidence E6.)*

## Approval (R-APR)

- **R-APR-1** The submitter of a receipt cannot approve it. The control is visible but disabled, with the reason. *(Evidence P6; blocked correctly in UAT but looked clickable.)*
- **R-APR-2** An item with an open blocking exception (`MISSING_PURPOSE`, `AMOUNT_DIFFERS_OVER_THRESHOLD` without a reason, `DUPLICATE`, `UNREADABLE`, `NOT_A_RECEIPT`, `AMBIGUOUS_MATCH`, `NO_PAYMENT_FOUND`) cannot be approved until it is resolved. *Added 2026-11-03:* an item with **no category at all** (not even a flagged suggestion) cannot be approved either, so nothing enters the ledger uncategorised. A flagged suggestion (`UNKNOWN_CATEGORY` with a category) can still be approved one by one.
- **R-APR-3** Bulk approve applies only to items with no exceptions, no low-confidence fields, and status `matched`.

## Review queue order (R-QUE)

The user's explicit request (evidence E6), extended for the new exception types:

1. Blocking intake problems: `UNREADABLE`, `NOT_A_RECEIPT`, `DUPLICATE`
2. **Amount differences** over the threshold (after a human has chosen the line, R-AMT-2)
3. Missing information: `MISSING_PURPOSE`, `LOW_CONFIDENCE_FIELD`, `UNKNOWN_CATEGORY`, `FX_RATE_UNAVAILABLE`
4. **Approvals** needing a match decision: `AMBIGUOUS_MATCH`, `NO_PAYMENT_FOUND`, personal-card reimbursements, and statement lines with no receipt (R-MAT-7)
5. **Matches** ready to approve: `matched` items, including small differences shown with a badge (R-AMT-3); bulk-approvable

Within a group, sort by AUD amount, largest first. Every list view shows a total for the rows shown. *(Evidence E9.)*
