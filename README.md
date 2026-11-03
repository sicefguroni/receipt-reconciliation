# Receipt reconciliation

This app matches a month of staff receipts to the company's card and bank statement, then shows you only the items that need a person. When every item is resolved, it gives you the month-end pack: a ledger file, an exceptions log, and a summary.

*Draft, Day 3 (2026-11-03), updated Day 4. Screenshots and the operator's guide (RUNBOOK) come later in the sprint.*

## Set it up (three steps)

You need [Node.js 22 or newer](https://nodejs.org) and pnpm (run `npm install -g pnpm` once).

1. **Install:** in this folder, run `pnpm install`.
2. **Settings:** copy `.env.example` to `.env`. You can leave it as it is: it starts in *replay mode*, which needs no API key.
3. **Start:** run `pnpm seed && pnpm dev`, then open <http://localhost:3000>.

`pnpm seed` clears the app's local database, so run it only the first time, or when you want to start again from nothing.

## Close a month

1. **Start the month.** On the first page, under *October 2026 sample month*, choose your bank's statement export (CSV) and press **Match October's receipts**. Or press it without a file to use the sample statement. To read your own receipts instead, use **Upload** (this needs live mode; see below).
2. **Work down the review queue.** Items are grouped worst first. Click a row to open it; each row says, in one sentence, what to do. Every group shows how many items it has and their total.
   1. *Blocking intake problems*: unreadable files, files that are not receipts, duplicates.
   2. *Amount differences*: the charge differs from the receipt by more than policy allows.
   3. *Missing information*: a purpose to add, details to check, a category to choose.
   4. *Approvals needing a match decision*: choose a payment, approve a reimbursement, or deal with a payment that has no receipt.
   5. *Matches ready to approve*: check and approve, one at a time or with **Approve all clean matches**.
3. **Open the month-end pack.** The **Month-end pack** button (top right of the queue) shows totals by category and by payment source, what was left out and why, and how each payment with no receipt was resolved. Download the ledger and the exceptions log from there.

The progress bar shows how many items are done. When it reaches the end, the pack says *Every item is resolved*.

**Acting as.** The selector in the top bar chooses who you are. Nobody can approve a receipt they submitted: the **Approve** button stays visible but greyed out, with the reason next to it.

## What each flag means, and what to do

| Flag | What it means | What to do |
|---|---|---|
| Could not be read | The photo is too small or blurred, or the receipt could not be read. | Open the receipt and type its details into *Details to check*, or press **Remove from this month** and ask the submitter for a better copy. |
| This file does not look like a receipt | The file is something else, such as a screenshot of an order page. | **Remove from this month** and ask for the receipt. |
| Looks like a duplicate | Same file, or same vendor, date, and total as an earlier upload. Left out of the totals. | **Confirm duplicate** (it stays on record, out of the totals), or **Not a duplicate** with a reason. Nothing is ever deleted. |
| Charged amount differs by more than policy allows | The payment you chose is over 10% or over $100 away from the receipt. | **Sign off difference** with a reason (for example "extra part ordered on site"), or choose another payment. Then approve. |
| Business purpose is missing | No purpose, or a placeholder such as "n/a". | Type the purpose in *Details to check* and press **Save details**. |
| Some details were hard to read | The highlighted fields were read with low confidence. | Open the receipt, check the highlighted fields, correct them if needed, and press **Save details**. |
| Category needs choosing | No vendor rule matched and the model was not sure. | Choose a category. Tick *Always use this category for…* to make it a rule for next time. |
| No exchange rate available | A foreign receipt has no rate for its date, so it is left out of the totals. Its amount and currency are listed in the pack. | Nothing is guessed; a rate of 1 is never used. It can still be approved. |
| More than one payment could match | Two or more statement lines fit about equally well. | Under *Choose the payment*, pick the right one and press **Use this payment**. |
| No matching payment on the statement | Nothing on the statement fits. | Choose a payment from the list, choose *Paid personally: reimburse* (with a reason), or remove the receipt until the payment appears. |
| Paid personally (no flag) | A personal-card receipt with no statement line. | Approve it to reimburse the submitter. |
| Payment with no receipt | A statement line that no receipt matched. | **Link receipt**, **Record a substitute** (a real payment whose receipt is missing; choose a category and give a reason), or **Not an expense** with a reason (a bank fee, for example). If the row says it *could be the payment for* a receipt, link it. |
| Refund or credit | A statement line where money came back to the company (a negative amount). It is never matched to a receipt. | **Record the credit** against the category it reduces, with a reason (it lowers that category's total), or **Not an expense** with a reason. |
| Small difference badge, e.g. "+$2.00 vs receipt" | The charge is a little different, within policy (a tip or card surcharge). | Nothing extra: approve as normal. |

## What the system decides, and what you decide

| The system decides | You decide |
|---|---|
| Whether a file is big and sharp enough to read | Every approval: nothing is approved without a person |
| What the receipt says (vendor, date, total, currency, GST), with a confidence for each field | Corrections to any field or category |
| Currency conversion at the ECB reference rate for the receipt date | Which payment, when more than one could match |
| Category, from the vendor rule table first, then the model; never "Other" | Whether a difference over policy is acceptable, and why |
| Which payment matches, only when one is a clear winner | Whether a flagged duplicate really is one |
| Which items go to which group, and in what order | What to do with a payment that has no receipt |

Money rules (thresholds, conversion, matching, duplicates) are fixed code with tests, not the model's judgement. The policy thresholds live in `.env` so the finance lead can change them.

## What data leaves your computer

- **Leaves, in live mode only:** each receipt file (image or PDF) is sent to the OpenAI API to be read, with the instruction not to return card numbers. Requests are made with storage turned off (`store: false`). Unknown vendor names and item lists are sent to choose a category when no rule matches. The FX service ([Frankfurter](https://frankfurter.dev), ECB rates) receives only a currency code and a date range.
- **Stays on your computer:** the statement, every decision you make, the ledger, and the database (`data/app.db`). Receipts you upload are stored in `data/files`.
- **Replay mode** sends nothing anywhere: it serves answers recorded earlier.
- **Logs** (the Runs page) hold item ids, step names, timings, token counts, and error codes. They never hold receipt text, names, or card numbers.

## Live mode

To read new receipts, put an OpenAI API key in `.env` as `OPENAI_API_KEY=...` and set `MODE=live`, then restart `pnpm dev`. Reading costs about USD 0.011 per receipt (measured on the sample month).

## When something goes wrong

Messages say what happened and what to do. The **Runs** page shows each step of every run, including runs that failed, with an error code for each problem. Common ones:

| Message or code | What to do |
|---|---|
| "The statement's columns were not recognised" (`STATEMENT_FORMAT`) | Export the statement again as CSV in one of the layouts the message lists. A title row above the column names, and dates written like 2026-10-02, are fine. |
| "This app is in replay mode…" (`RECORDING_MISSING`) | Replay mode can only read the sample receipts. Switch to live mode to read others. |
| "The statement has no transactions in…" | Check the month you picked, or that you chose the right file. |
| A run with `FX_API_ERROR` | The exchange-rate service was down. Stored rates are used where available; otherwise the receipt is flagged *No exchange rate available*, but only if its AUD amount needs a rate: a receipt matched to a payment that shows the foreign amount uses the AUD the bank charged and is not flagged. |
