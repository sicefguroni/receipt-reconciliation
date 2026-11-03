# Interview notes (second-hand)

**Source: second-hand.** The Accounting user was not available on Day 1. These answers are **the candidate's account**, based on running the October user-acceptance test with the Accounting user and working alongside them. They are not a fresh interview. Each answer is marked **(seen)** if the candidate observed it, or **(estimate)** if the candidate is inferring. Paraphrased; no names.

Recorded 2026-11-03 against the script in `01-problem-and-evidence.md`.

| # | Question | Answer (paraphrased) | Basis |
|---|---|---|---|
| 1 | Walk through last month's close. Which tools were open? | The finance tool that went through the redesign, which holds everything. | estimate |
| 2 | Typical volume: receipts, statement lines, cards or accounts? | About 30 to 60 receipts a month. Statement lines and number of accounts not given. | estimate |
| 3 | How long does the close take? Which part takes longest? | Duration not given. The longest part is comparing invoices against payments. | estimate |
| 4 | How do you decide which payment a receipt belongs to? | By the result of that comparison. | estimate |
| 5 | When amounts differ, what counts as close enough? | Nothing beyond the rulings already made: 10% OR $100 (R-AMT-2) and a badge for small differences (R-AMT-3). | seen |
| 6 | How often is a receipt missing, unreadable, duplicated, or missing a purpose? What happens? | Frequency not given. A missing or unreadable receipt: if the payment is certainly there, they create their own invoice for it. Duplicates should be tagged, then deleted. | estimate |
| 7 | Ever found a mistake after the report was final? | Probably small money differences. | estimate |
| 8 | What should an automated system never decide? | Anything that involves money. | estimate |
| 9 | Has the Accounting user tried ChatGPT for this? | Yes. What happened was not recorded. | seen |
| 10 | If this saved time, what would you do with it? | More double-checking. | seen |
| 11 | Are P1 to P9 still true after the redesign? | The current state is what the Accounting user's October UAT feedback says (the E-series in `01`). No further changes known. | seen |
| 12 | (R-QUA-1) How big are the receipt photos staff send? | It varies; documents are roughly letter-size. Pixel sizes not known. | seen |

## What this adds to the evidence

- **Volume (Q2).** 30 to 60 receipts a month, so the 40-receipt synthetic month is in range.
- **Bottleneck (Q3, Q4).** Comparing receipts against payments is the slowest part. This is consistent with P1 and E1 and with the bottleneck in `02`, but is second-hand and unquantified.
- **Missing receipts (Q6).** When a payment exists without a usable receipt, the Accounting user creates a substitute invoice. This points to a gap: v1 does not list **statement lines that have no receipt**. Raised as a scope question; not added to scope.
- **Duplicates (Q6).** "Tagged, then deleted" agrees with the Day 1 ruling: never deleted automatically, and the human decides. In R-DUP-1, "confirm duplicate" keeps the record but excludes it from totals, which is the audit-safe form of "deleted".
- **Human control (Q8).** Anything involving money stays a human decision, which matches the design: final approval is always human (`02`).
- **R-QUA-1 (Q12).** No pixel sizes are known. Phone photos of letter-size documents are normally well above 1000 × 700 px, so the default is kept and stays configurable.

## Gaps (not measured)

- **Time to close (Q3)**: not measured. The B0 timed run is the only source, and it needs a proxy (the Accounting user is unavailable).
- **Frequency of each exception type (Q6)**: not measured.
- **What happened when the Accounting user tried ChatGPT (Q9)**: not recorded.
