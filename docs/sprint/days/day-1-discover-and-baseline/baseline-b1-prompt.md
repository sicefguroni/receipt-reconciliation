# B1 baseline: single chat prompt

B1 answers the reviewer question "why not just paste it into ChatGPT?" (`06`, "Baselines"). The prompt below is fixed: use it **verbatim** for all three runs. Do not edit it between runs, and do not help the assistant during a run.

## The prompt (copy everything inside the box)

```text
I'm closing the month for a small Australian company. Our base currency is AUD.

I've attached:
- 20 receipt files. Each file name is the receipt ID (for example R04.pdf is receipt R04).
- receipts.csv: for each receipt, who submitted it, how it was paid, and the business purpose they gave.
- statement.csv: the company card and bank statement for October 2026. Each row has a Line number (L01, L02, ...).

For every receipt listed in receipts.csv, work out:
1. Vendor, date (YYYY-MM-DD), total, and currency, as printed on the receipt.
2. Category: exactly one of Advertising & Marketing, AI & Cloud, Software, Rent & Workspace, Equipment, Office Supplies, Travel, Meals & Entertainment, Repairs & Maintenance, Utilities, Other.
3. The statement Line that paid for it, or "none" if no line did.
4. Flags: anything that needs follow-up before I can sign off the month. Leave blank if it is fine.

Company policy:
- If the amount charged differs from the receipt by more than 10% OR by more than $100 AUD, the difference needs a written reason and sign-off.
- Every expense needs a real business purpose.
- For foreign-currency purchases, the bank's foreign transaction fee does not count as a difference.
- Personal-card purchases are reimbursed separately and will not appear on the statement.

Reply with a single table only, one row per receipt, with these columns:
Receipt | Vendor | Date | Total | Currency | Category | Statement line | Flags | Notes
```

## Why the prompt is written this way

- **It gets the same information the B0 user has, and no more.** It has the same files, category list, and answer columns as `fixtures/dataset/baseline/b0-kit/INSTRUCTIONS.md`, plus the policy an accountant already knows. It deliberately does **not** mention duplicates, ambiguous matches, or any test case. A human doesn't get told those either.
- **It is a strong baseline, not a straw man.** Giving it the policy and a fixed output format makes the comparison credible. If the system beats it, that is not because B1 was set up to fail.
- **It asks for vendor, date, total, and currency** so that B1 extraction accuracy can be scored (`03`, metrics table).

## Protocol (repeat for runs 1, 2, and 3)

1. **Prepare the files.** Open `fixtures/dataset/baseline/b0-kit/`. Upload only:
   - all 20 files in `receipts/`
   - `receipts.csv`
   - `statement.csv`

   Do **not** upload `INSTRUCTIONS.md` or `answer-sheet.csv`.
2. **Start a fresh Temporary Chat** in ChatGPT, so memory from an earlier run cannot carry over. Use the default model and write down its name exactly as the UI shows it.
3. **Start the stopwatch.**
4. **Paste the prompt and attach the 22 files.** If the UI won't take 22 files in one message, send them in batches. Start each batch except the last with the line `Part N of M: files only, please wait.`, then send the prompt with the last batch. Write down that you batched.
5. **Wait for the full reply.** If it stops partway, you may send only the word `continue`. Write down each time you do. No other messages, hints, or corrections.
6. **Copy the whole reply** into `b1-raw/run-N.md` (create the file). Paste it unedited.
7. **Read it through once**, as you would before using it. Write any problems you notice under "Noticed while checking" in the run file. **Don't fix anything in the table.** It is scored exactly as ChatGPT produced it.
8. **Stop the stopwatch.** The time covers everything from step 3 to here: uploading, waiting, copying, and checking.
9. Fill in that run's row in `baseline-b1-runs.md`.

Use a **new Temporary Chat for each run**. Variation between the three runs is itself a finding (`06`), so don't rerun a bad run. Every run counts.

When all three are done, tell the agent. It scores each run against `ground-truth.json` with the same definitions used for B0 and the system.

## Data note

Everything in the kit is synthetic: fictional vendors, people, and amounts. It is safe to upload to a third-party chat service. Do not add anything real to these files.
