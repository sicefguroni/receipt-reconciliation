# Day 4 failure analyses

Six failures, each found by a run and fixed with a before/after measurement. Four come from the stress set (`fixtures/stress/`, `pnpm eval:stress`); two are the scoring findings queued on Day 2, tuned on the tuning split only. Template from `06`.

**Runs referred to below** (all under `eval-results/`):

| Label | What | Commit |
|---|---|---|
| `v2-day4-pre` | October month, replay, before any Day 4 change | `dd07c1f` |
| `v2-day4-pre-subset20` | The 20 B1 receipts, replay, before | `dd07c1f` |
| `v2-day4-pre-stress` | Stress set, **live**, first observation | `dd07c1f` |
| `v2-day4-pre-stress-2` | Stress set, **live**, second observation (its recordings are what replay serves) | `2b6b2c5` (recording fix only; no rule change) |
| `v2-day4-tuning-before-scoring`, `v2-day4-tuning-after-scoring` | Tuning split only, around F5 and F6 | `3a2469d`, `81dc5ba` |
| `v2-day4-post`, `v2-day4-post-subset20`, `v2-day4-post-stress` | After every fix, replay, no key | `2651a19` |

A stress case passes when the system **fails safely**: the right answer, or a person is asked. "Silent" means a wrong value, a wrong pairing, or a rejected valid input that nobody is told about.

---

### F1: A refund was offered as a receipt's payment

- **Case / input:** stress S07 (a $64.00 hardware purchase, refunded −$64.00 three days later) and S08 (a $38.50 receipt whose purchase is not on the statement; only its −$38.50 refund is).
- **Observed:** `v2-day4-pre-stress` and `-2`: the refund L09 appeared in the candidate list of three receipts (S07 at 40, S06 at 25, S08 at 10). S08 went to `ambiguous` with its refund L10 as the **top candidate** (40), so the queue invited the reviewer to choose it.
- **Expected:** a credit is never a payment. S07 matched to its purchase; S08 `NO_PAYMENT_FOUND`; the refunds listed for a person to record.
- **Root cause (rule):** the R-MAT scoring table never looked at the sign. A refund earns no amount points (a 200% difference), but it shares the purchase's vendor (+20), account (+5), and a nearby date (+15 to +25), which reaches the 40-point candidate floor on its own. Nothing at the decision boundary stopped a person from choosing it either. Had they done so, `applyChosenLine` would have marked the receipt `paid` with a negative ledger amount.
- **Fix:** new rule **R-MAT-8** (`05`): a credit line is never scored, offered, chosen, or linked; it is listed as a "refund or credit" and recorded against the category it reduces, or marked not an expense. Commit `e06b325`. The core rule, the decision checks (choose and link), and the choosable-lines list each have a named test; 4 of 4 single mutations caught.
- **Regression:** S07 FAIL → PASS; S08 FAIL → PASS (`v2-day4-pre-stress-2` → `v2-day4-post-stress`). October unchanged: 12/12, 0/33 wrong auto-matches (`v2-day4-pre` → `v2-day4-post`). Recording the credit lowers the ledger by exactly the refund (test).
- **Residual risk:** the refund is not *linked* to the purchase it reverses: the purchase stays in the ledger at full value and the credit is a separate negative row, so the net is right only if the reviewer picks the same category. A bank that writes refunds as positive amounts with a "CR" suffix would not be recognised (not in either supported format today).

### F2: A chat screenshot was told to "retake it closer"

- **Case / input:** stress S03, an 840 × 700 PNG screenshot of a team chat mentioning a $45 invoice.
- **Observed:** `v2-day4-pre-stress-2`: `UNREADABLE`, with the note "Photo is 840 × 700. Retake it closer, or upload the original PDF."; run log `quality QUALITY_GATE`; the model was never called. (The first run, `v2-day4-pre-stress`, had the same outcome; its report did not yet print run-log codes.)
- **Expected:** `NOT_A_RECEIPT` (R-QUA-4), in the first queue group, and the real $45 line left for a person.
- **Root cause (rule):** R-QUA-1's pixel floor (long side ≥ 1000 px) applied to every raster file, so a crisp screenshot was rejected before the model could say what it was. The advice is also wrong for a screenshot: there is nothing to retake. It failed safe (blocked, never matched), but cost the reviewer a misleading message.
- **Fix:** **candidate's ruling** (R-QUA-1 was confirmed on Day 1, so the change was asked for, not made): the size floor applies to camera photos (JPEG) only, as R-QUA-2 already does for blur. Commit `2651a19`; one live call recorded S03 (about USD 0.01). Named test plus 2 mutations, both caught.
- **Regression:** S03 FAIL → PASS: `NOT_A_RECEIPT`, group 1, L05 untaken (`v2-day4-post-stress`). October unchanged (its 3 PNGs were above the floor anyway).
- **Residual risk:** a tiny PNG now costs one model call and relies on the model to flag what it cannot read. The evidence that it does is S02 (heavy blur: every field null at confidence 0), one image. A small screenshot of a *real* receipt read wrongly with high confidence has not been tested.

### F3: A valid statement with a title row and ISO dates was rejected

- **Case / input:** stress S09, the October statement (44 lines) with a title row ("Business Visa ...4821 - Transactions …"), a blank row, then the format A header, with dates written `2026-10-02`.
- **Observed:** `v2-day4-pre-stress`: rejected with "The statement's columns were not recognised (found: Business Visa ...4821 - Transactions 01/10/2026 to 31/10/2026) …".
- **Expected:** the same 44 lines as the plain format A file.
- **Root cause (data contract):** the reader took row 1 as the header, and each format accepted one date style only. Both are common in real bank exports. The month could not start at all, so this would have stopped the Accounting user at the first step.
- **Fix:** the header is the first of the opening 5 rows that a supported format recognises; ISO dates are accepted in every format (they cannot be misread); row numbers in error messages still count the title and blank rows, as a spreadsheet shows them. Commit `2fb710a`. One existing test had encoded the old behaviour (an ISO date in format B was expected to fail) and was changed to a date that is still wrong for that format. 3 of 3 mutations caught.
- **Regression:** S09 FAIL → PASS, lines identical (`v2-day4-post-stress`). Reader tests 12 → 14.
- **Residual risk:** slash dates are still read day-first. A US-style export (`10/02/2026` meaning 2 October) would be rejected when the day is over 12, but **misread silently when it is 12 or under**. Not tested; detecting the order from the whole file is the fix. **Fixed 2026-11-04** (see the follow-up below).

### F4: An FX outage flagged receipts that did not need a rate, and the summary contradicted the ledger

- **Case / input:** stress S10, the October month with the FX API failing and an empty cache (and, as a control, failing with a warm cache).
- **Observed:** `v2-day4-pre-stress`: all 6 USD receipts flagged `FX_RATE_UNAVAILABLE` although every one was already matched to a line showing the USD amount and the AUD charged. Human touches rose from 9 to 15. The summary listed **USD 224.40 as excluded** while the ledger total (4,811.26) still included those receipts: the month-end pack said two contradictory things. With a warm cache, the month was identical to normal.
- **Expected:** no rate of 1 ever; a missing rate matters only when the AUD amount depends on it.
- **Root cause (rule order):** R-CUR-3 was applied while reading, before matching. But a receipt matched on its original currency takes the bank's AUD charge as its ledger amount (R-CUR-4), so the rate is not used. The summary then summed every unavailable conversion, included or not.
- **Fix:** R-CUR-3 clarified in `05`: the flag is dropped only when the receipt is paid from a line whose amount **was compared** in the receipt's own currency; if the line shows only AUD, the flag stays, even after a person chooses that line (a guard found while writing the mutation tests: the first version of the test never exercised it). The excluded list counts only receipts that are actually excluded. Commit `3a2469d`; 3 tests, 3 of 3 mutations caught.
- **Regression (S10, cold cache):** flagged 6 → 0; human touches 15 → 9 (normal is 9); excluded USD 224.40 → none; ledger 4,811.26 unchanged. Warm cache still identical to normal.
- **Residual risk:** a foreign reimbursement (no statement line) still needs a rate and is excluded during an outage, which is correct. There is no "fetch the rates again" action: once the API is back, the month has to be read again. Not built.

### F5: A vendor's logo text lost the vendor points

- **Case / input:** R16 and R30, the two ad-platform invoices (both in the **tuning** split). Day 2 finding 1.
- **Observed:** the model reads the wordmark as `brightreachads`; the statement says `BRIGHTREACH ADS`. Measured on the code before the fix: R16 top score 80 (L11), R30 80 (L41). They auto-matched only because no rival line existed; the margin was 50.
- **Expected:** the same name scores as the same name.
- **Root cause (rule):** vendor similarity is whole-word overlap, and a run-together logo shares no whole word with the spaced name. The prompt asks for the vendor "as printed", and the most prominent print is the logo, so changing the prompt would be the wrong lever (and would invalidate every recording).
- **Fix:** a vendor whose words, run together, equal **consecutive whole words** of the description (or the reverse) is a full match. Whole words only, so "Ace" never matches inside "PLACEMENT". Commit `81dc5ba`; 2 tests, 2 mutations caught (including a substring version, which failed 4 tests).
- **Regression:** R16 80 → 100, R30 80 → 100 (margin 50 → 70). Tuning-split metrics unchanged (`v2-day4-tuning-before-scoring` → `-after-scoring`), full set unchanged. The extraction-vendor metric (38/40) does not move: it grades what the model read against the printed name, which is a different question.
- **Residual risk:** a bank abbreviation ("BRT REACH ADS") still scores 0 for the vendor.

### F6: A payment 15 days away was offered as a match

- **Case / input:** R13 on the 20-receipt subset (TC10: a $14.70 personal-card coffee with no statement line; **tuning** split). Day 2 finding 2.
- **Observed:** `v2-day4-pre-subset20`: TC10 FAIL. R13 went to `ambiguous` with L07 ($15.50, a café line 15 days earlier) at 40: amount within policy +30, the shared word "cafe" +10.
- **Expected:** `unmatched`, offered as a reimbursement.
- **Root cause (rule):** the date table gives 0 points beyond 5 days, but nothing removed a far line from the candidates, so amount plus one vendor word reached the 40-point floor.
- **Fix:** **R-MAT-9**: a line more than 7 days from the receipt date is not a candidate (configurable, `MATCH_MAX_DAYS_APART`). The value was set from the **tuning split only**: posting lag there is 0–2 days over 20 receipts; 7 covers a weekend plus a public holiday. Commit `81dc5ba`; 3 tests (including the inclusive boundary), 2 mutations caught.
- **Regression:** subset TC10 FAIL → PASS (10/11 → 11/11, `v2-day4-pre-subset20` → `v2-day4-post-subset20`); R13 `ambiguous` → `unmatched`. Full set and tuning split unchanged; holdout unchanged (0/14 wrong auto-matches).
- **Residual risk:** a genuinely late posting (a hotel that charges at checkout a week later, a delayed settlement) becomes `NO_PAYMENT_FOUND`, with the line listed as "No receipt". It fails safe: the reviewer can link the two by hand.

---

## Follow-up on the open items (2026-11-04)

Three items left open on Day 4 were closed the next morning. Commits `fe7731d`, `b29bd56`, `2bb74a5`, `f1df119`.

**Month-first statement dates (F3 residual).** New stress case **S11**: the October statement written US-style (`10/02/2026` = 2 October). Measured on the Day 4 reader (`f373625`): the full month was *rejected* at "10/13/2026"; an excerpt of 1–12 October was **read with 15 of 18 dates wrong, silently** (2 October became 10 February). The order is now decided from the whole file: a first number over 12 proves day first, a second number over 12 proves month first, both together are refused; when every date fits both ways, the reading that keeps the statement within the shorter period wins, and day first wins a tie. The review page states "dates read month first". After: full month and excerpt both 0 wrong; S11 PASS (`v2-day4-followup-stress`, 11/11). 3 tests, 4 mutations caught. *Residual:* a one-line file such as `05/06/2026` is read day first (no evidence either way).

**Split payment (S06 residual).** New rule **R-MAT-10**: a person can say one receipt was paid by two or more lines; the amount rules apply to the sum, the ledger amount is the sum of the AUD charged, every line leaves the no-receipt list, credits are refused, and a later claim on any line undoes the whole split (R-MAT-4). Before: S06 could only be closed by signing off a false difference against one part and recording the other as a substitute. 8 tests (4 core, 4 at the decision boundary), 7 mutations caught.

**Browser check of the refund wording and the split** on a production build (`pnpm build && next start`), using `fixtures/stress/statement-october-split-and-refund.csv` (R01's $18.50 charged as $10.00 + $8.50, and $4.50 refunded): **16 of 16 checks pass**. The refund row reads "A refund or credit, not a payment", offers no "Link a receipt", and is never among R01's payments to choose; the split brings the ledger to the normal October total (4,792.76 → 4,811.26); recording the credit lowers it by 4.50; the ledger CSV lists "L03 + L04"; no sideways scroll at 390 px. The screenshots found two problems no test had: refunds printed as "$-4.50" (now "−$4.50"), and the split form listing all 13 free lines under every receipt that needed a match (now a closed "Paid in more than one payment?" section).

## Also fixed while investigating

- **A failed model call left no recording**, so replaying that run with no key would stop on "missing recording" instead of taking the same fallback (non-negotiable 6). Failures are now recorded by their error code only, and replay raises the same error. Commit `2b6b2c5`, with a test. This was found while chasing S03, whose real cause turned out to be different (F2); see the AI corrections log.

## Variance between the two live stress runs

Same outcomes in both (6/10). Two confidences moved: S04's date 0.99 → 0.75 and S05's date 0.95 → 0.75. In the second run S05's (correct) date falls below 0.8, so it is flagged for a person; in the first it would have been bulk-approvable. The model's self-reported confidence is not stable near the threshold, so one live run can change the human-touch count by one or two. Replay pins the second run.

## Not fixed: known measurement artifact

Per-code recall for `AMBIGUOUS_MATCH` reads 0/1 in every run since `v0-day2`. The harness scores per-code recall after the simulated expected human choice, and that choice removes R15's ambiguity by construction. TC11 checks the ambiguity directly, before any choice, and passes. Left as is so the metric stays comparable across runs; noted in `docs/EVALUATION.md`.
