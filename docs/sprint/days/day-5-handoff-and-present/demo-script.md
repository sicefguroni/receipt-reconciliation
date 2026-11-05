# Demo script (five minutes)

The timing follows `08`. Recorded by the candidate. Every number on screen or spoken is from `eval-results/final/` or the cold-run records; nothing is rounded up.

## Before recording

1. Stop every running dev server (they hold the database), then in the repository: `pnpm seed`, then `pnpm build && pnpm start`.
2. Open <http://localhost:3000> in a clean browser window at about 1280 × 800, zoom 100%.
3. Acting as: **Accounting user (reviewer)**.
4. Have ready in tabs: `docs/EVALUATION.md` (the "Final results at a glance" table) and `docs/sprint/days/day-4-evaluate-and-harden/failures.md` (F4). Optionally `fixtures/dataset/statement-format-b.csv` on the desktop to upload.
5. Close notifications. Do not show `.env`, the terminal history, or any other window.

## Script

| Time | Show | Say (in your own words) |
|---|---|---|
| **0:00–0:45** | The first page | "This comes from a real finance workflow at a company I currently work at; the data here is synthetic. Each month an Accounting user pairs every staff receipt with a card payment, by hand: 'pick a request, hunt for the charge'. Doing it manually is estimated at 20 to 40 minutes for 40 receipts. Pasting it into ChatGPT is fast, about 11 minutes, but in every run it paired 3 of 19 payments wrongly, including one $312 charge paid out three times." |
| **0:45–1:15** | Press **Match sample month** (optionally upload `statement-format-b.csv` first). The queue appears | "The model only reads the receipts. Everything about money is tested code. The queue is in the order the user asked for: blocking problems, then amount differences, then missing information, then match decisions, then clean matches." Point at the tab counts. |
| **1:15–1:45** | **Amount differences** is empty; go to **Match decisions**, open **R04** (QuickFix Repairs, $500). Choose **L16** ($560), press **Use this payment** | "A $500 repair charged at $560 is never paired automatically: 12% is over policy. I choose it, and it moves to Amount differences." |
| **1:45–2:05** | R04 is open under **Amount differences**: point at the "Check this pairing" box. Type a reason ("Extra part fitted on site") and **Sign off difference**, then **Approve** | "It shows the receipt and the payment side by side and needs a real reason; 'Good' is refused." |
| **2:05–2:20** | **Match decisions**, open **R15** ($19.99 app). Two $19.99 payments a day apart are offered. Choose **L22**, **Use this payment** | "Two equal charges a day apart: it never guesses, it asks." |
| **2:20–2:30** | **Ready to approve**: press **Approve all … clean matches** (the button shows "Approving…") | "Clean matches go through in one click." |
| **2:30–3:15** | **Month-end pack**: the tiles, by category and by payment source, "Left out of the totals", the no-receipt lines; press **Download ledger** | "The pack is what the accountant hands on: totals that add up to the ledger, what was left out and why, and each payment that had no receipt." |
| **3:15–4:15** | `EVALUATION.md`: the final table; then `failures.md` F4 | "Twelve test scenarios pass, no wrong automatic matches on the whole month or the holdout half. I broke it on purpose with 11 stress cases; four failed at first. For example, when the exchange-rate service was down, six receipts that were already paid in Australian dollars were flagged and the summary contradicted the ledger. After the fix: none flagged, the ledger unchanged." |
| **4:15–5:00** | The "Final results at a glance" table, the time-to-close row | "Against the targets: every one met. A newcomer closed the month in 9 minutes, under the 10-minute target. The most important limitation: this is one synthetic month, closed by me and one proxy, not the real Accounting user. And the most interesting finding: the system's own matching was never wrong; every wrong number came from a person pairing a receipt with someone else's payment, so the last changes guard the human step. Next two weeks: the real user closes one real month, measured the same way." |

## After recording

- Length five minutes or less. Check that no real name, figure, or other window appears.
- Upload it, then send the link: it goes in the README ("Demo") and the final checklist.
