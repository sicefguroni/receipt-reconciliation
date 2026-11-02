# 01. Problem and Evidence

## Confidentiality rule for this file and everything derived from it

The evidence below comes from a real company. It is anonymised: no company name, product name, person's name, client, or real figure appears here, and none may appear anywhere in this repository. Public wording: **"a finance workflow at a company I currently work at."** All data in this repository is synthetic.

## Context (stated assumptions)

- A small, growing company with an **AUD base currency**, staff in more than one country, and many software/AI subscriptions **billed in USD**.
- Staff pay for business expenses on a **company card** or a **personal card** (reimbursed later), then submit a receipt plus a business purpose.
- One **Accounting user** (the target user) closes each month. They make sure every expense has a receipt, a category, a matching payment, and a justification, and that differences are signed off before the month-end report.
- A finance lead sets policy (categories, the sign-off threshold, who approves whose expenses).

## Target user and job-to-be-done

> **When** a month ends, **the Accounting user wants to** turn a pile of receipts and a card/bank statement into a reconciled ledger where every exception has been looked at, **so that** the month-end report is complete and correct without checking every row by hand.

## Evidence of pain

### Sources (two, both written by the Accounting user)

1. **Redesign proposal, late September 2026 (P-series below).** Before any fixes, the Accounting user reviewed screenshots of the company's finance tool and wrote an interactive redesign proposal. It includes a "before → after" table, a list of current-system problems, and open questions for leadership. It describes the **previous way of working in the user's own words**.
2. **User-acceptance testing, October 2026 (E-series below).** After the candidate implemented much of the redesign, the same user ran **structured acceptance tests** and wrote a feedback report: 18 scripted tests (10 passed, 5 partly passed, 2 failed, 1 not tested) and 17 numbered issues ("fix first" and "improve").

Taken together: the user **asked for suggested matching** in September (P1), and in October **matching was still a manual dropdown** (E1). The candidate later fixed the status logic, but pairing receipts with payments is still a manual choice. That gap between what the user asked for and what was delivered is the bottleneck this sprint closes.

Items about property rentals, payouts, sales/ads analytics, and layout are out of scope. The source documents themselves stay out of this repository because they contain names and real figures. Only the anonymised summary below is used.

### Previous way of working, in the user's words (redesign proposal)

| ID | Area | Before (user's description) | What the user asked for |
|---|---|---|---|
| P1 | **Matching a payment** | "Manual search: pick a request, hunt for the charge." "No suggested matches: you hunt manually." | "Suggested match: same amount & date, one click" |
| P2 | **Big differences** | "No rule": a justification of "None" was accepted | "Reason + sign-off", proposed as over 10% or $100, **never by the submitter** |
| P3 | **Categories** | About **a third of spend (35.8%) was filed as "Other"**. Ads had no category, and there was no Advertising, AI, or Rent category. | 12 categories with examples, the same list everywhere, with "Other" at 0% |
| P4 | **Where expenses live** | Split across 3 pages, with AI spend on a separate manual page, **"so the same cost can be entered twice"** | One place |
| P5 | **Statuses** | Open items shown as **both "Approved" and "Awaiting match"** at the same time | Three separate checks: Approved · Paid · Matched |
| P6 | **Separation of duties** | "Same person reconciles and approves" | Nobody approves their own expense, and a second person signs off differences |
| P7 | **Payment source** | Screens did not show which card paid | Personal card / company card tabs |
| P8 | **Statement data** | "Suggested matches need card or bank statement data (e.g. an import). Not confirmed that this exists today." | An import of card or bank transactions |
| P9 | **Knowing what's pending** | The home page had no finance information, so the user had to open another page to see what was pending | One to-do list showing what is blocking month-end |

P8 is why statement CSV import is an integration in v1. P3 gives a measurable baseline for category accuracy (share of spend landing in "Other").

Confidentiality note: percentages and counts may be quoted. Dollar amounts, names, and vendor-specific figures from the sources may not.

### Acceptance-test findings relevant to reconciliation (anonymised)

| ID | Finding | What it shows |
|---|---|---|
| E1 | **Matching was fully manual.** The match result was picked by hand from a dropdown. There was no auto-match, and payment status did not update after a match. The status vocabulary was inconsistent (a "Resolved" value next to Matched/Unmatched). | The core judgment (which payment is this receipt?) is done item by item. After the fix, status is derived, but **pairing each receipt with a payment is still a manual choice.** |
| E2 | **Base-currency receipts were treated as foreign currency**, so every AUD receipt was excluded from totals. Recorded spend showed $0.00 and spend by category was empty. The FX widget showed a count, not an amount. | Currency rules applied in the wrong place silently corrupt totals. Currency must be a tested rule, not an inference. |
| E3 | **Categories were wrong on older records**: ads under "Other", cloud hosting under "Software", coworking under "Utilities", furniture under "Office Supplies". | Category assignment drifts. A vendor-to-category rule table plus a reviewed fallback is needed. |
| E4 | **Business purpose was optional**, so the reviewer saw "None" as the justification. | Missing information reaches the approver. It must be caught as an exception before review. |
| E5 | **The receipt quality check was inconsistent.** Clean digital receipts were rejected as "blurry", the same layout passed once and failed later, and a fixed 1024x768 minimum rejected portrait phone scans. | A naive quality gate creates rework. It must be orientation-aware and skip blur checks on digital files. |
| E6 | **Review was split across four places** (approvals, matching, variance review, settled). The user asked for **one list ordered: amount differences, then approvals, then matches.** | Direct user requirement for the review queue design. |
| E7 | **Per-receipt fields could not be corrected after OCR** on bulk upload (category, paid-with). | Every model output needs an inline correction path. |
| E8 | **Historical rows were stuck on "Unknown"** for paid-with and payment, so card-specific views were empty. | Unknown must be a visible, fixable state, not a dead end. |
| E9 | **No totals on filtered lists**, and the month-end snapshot opened as **raw JSON**. | The output must be readable by a non-developer. |

### What worked (keep these behaviours)

- A reason is required before signing off an amount difference.
- Self-approval is blocked (although the button still looked clickable).
- OCR read vendor, date, and amount correctly on a clean receipt.
- Subscription run-rate maths matched the register.

### Open policy questions raised by the user

- Sign-off threshold for amount differences: **"10% or $100"**, still pending finance-lead confirmation. → `CONFIRM WITH USER` in `05-business-rules.md`.
- Who signs off the most senior person's own expenses. → Out of scope. v1 only enforces "no one approves their own".

## What is not yet known (measure on Day 1)

The two sources show **error types** and the **shape of the manual work**. They do not show **frequency or time cost**. The redesign proposal was also written from screenshots ("we haven't used the live system"), so confirm P1–P9 in the interview. Do not guess these numbers. Collect them in the Day 1 interview and baseline (`06-evaluation-plan.md`).

### Interview script (20 to 30 minutes, with the Accounting user)

1. Walk me through last month's close, from the first receipt to the final report. Which tools did you have open?
2. Roughly how many receipts and statement lines are in a typical month? How many cards or accounts?
3. How long does the close take? Which part takes the longest?
4. How do you decide which payment a receipt belongs to? What makes that hard?
5. What do you do when amounts differ? What counts as "close enough"?
6. How often is a receipt missing, unreadable, duplicated, or missing a purpose? What do you do then?
7. Have you ever found a mistake after the report was final? What was it?
8. What would you never want an automated system to decide for you?
9. Have you tried ChatGPT or a similar tool for any of this? What happened?
10. If this saved you time, what would you do with it?

Record answers as short notes in `docs/sprint/days/day-1-discover-and-baseline/interview-notes.md`. Paraphrase, use no names, and quote only with permission.
