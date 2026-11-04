# Day 4 journal

## Before starting: what was still open from Day 3 (2026-11-03)

Day 3's code was merged and healthy (261/261 tests; a keyless replay gave 12/12 and 0/33). One item was open: **block 6, the first execution by someone else**, blocked because there is no Accounting user. The candidate ruled: run Day 4's agent blocks now, then the naive proxy does P1 and the feedback questions in one sitting on the hardened build; the builder cold run (C1) when convenient. Live spend approved up to USD 1.

---

## Block 1: `v2-day4-pre` and the baseline comparison

**Goal.** A full-set run on the code as it stood, and the B1 comparison on the same 20 receipts.

**Built / run.** `v2-day4-pre` (replay, no key) and `v2-day4-pre-subset20`.

**Verified.** `eval:compare -- v1-day3 v2-day4-pre`: every metric and test case the same. The subset still failed TC10 on R13, the Day 2 date-gate finding, which became F6.

---

## Block 2: stress cases and failure analysis

**Goal.** Break the system with the `06` stress list and explain each failure by its mechanism.

**Built.** A separate stress set (`scripts/dataset/stress.ts`, `pnpm dataset:stress`, `fixtures/stress/`): eight receipts, each built to hit one mechanism (gate size, blur that passes the gate, a chat screenshot, a bare "$", a US month-first date, one receipt over two payments, a refunded purchase, a refund with no purchase), a ten-line statement, and the October statement with a title row and ISO dates. `pnpm eval:stress` runs them plus an FX outage on the October month (cold cache and warm cache) and grades *safe failure*: correct, safe (a person is asked), or failure (silent).

**Result.** 6/10 on the first live run. Four failures, all in rules or data contracts: refunds offered as payments (S07, S08), a valid statement rejected (S09), and a chat screenshot rejected as "retake it closer" (S03). A fifth problem passed the case's letter but not its spirit: during an FX outage six already-paid USD receipts were flagged, and the summary listed USD 224.40 as excluded while the ledger included it (S10). The model itself did well: blur gave nulls at confidence 0, the bare "$" was left blank, the US date was read right.

**What went wrong.**

- **S03 misdiagnosed.** No recording existed for S03, and the agent concluded the model call had failed. It then fixed a real but different gap (failed calls were never recorded, so replay of such a run would stop) before re-running with run-log codes in the report, which showed `QUALITY_GATE`: R-QUA-1 rejected the 840 × 700 PNG before the model saw it. The comments citing the wrong cause were corrected; the recording fix stays on its own merits.
- The first stress report printed no run-log codes, which is why the misdiagnosis was possible. Fixed in the report.
- A `python3` heredoc hung the shell, the third time in this sprint. Nothing was applied; edits were redone with the editor tool.

**Verified.** A second live run gave the same 6/10; a keyless replay of it matched exactly. Two date confidences moved between the live runs (0.99 → 0.75, 0.95 → 0.75): a variance finding, not a failure.

---

## Block 3: fixes

**Goal.** Fix each failure in the rule or contract that caused it; tune thresholds on the tuning split only.

| Fix | Failure | Commit |
|---|---|---|
| R-MAT-8: a credit is never a receipt's payment; listed as "refund or credit" | F1 (S07, S08) | `e06b325` |
| R-QUA-1 size floor for camera photos only (**candidate's ruling**, asked because R-QUA-1 was confirmed on Day 1) | F2 (S03) | `2651a19` |
| Statement header found below title rows; ISO dates accepted | F3 (S09) | `2fb710a` |
| R-CUR-3 only when the AUD amount needs a rate; summary lists only what is excluded | F4 (S10) | `3a2469d` |
| Vendor wordmark match on consecutive whole words | F5 (R16, R30) | `81dc5ba` |
| R-MAT-9: date gate at 7 days, from tuning-split posting lags (0–2 days) | F6 (R13) | `81dc5ba` |
| Failed model calls recorded by code and replayed | found while investigating | `2b6b2c5` |

Every rule change updated `05` and its named tests in the same commit.

**What went wrong.** The first R-CUR-3 test never exercised its own guard (R02 stayed ambiguous, so "the amount was compared" was never tested); found while planning the mutations, and a test was added where a person chooses the AUD-only line.

**Verified.** `pnpm test` 279/279 (261 at the start). 16 single mutations of today's rules (refund 4, statement 3, FX 3, scoring 4, gate 2): all caught. Typecheck, lint, `pnpm build` clean. The tuning-split check for F5 and F6 ran before the holdout was looked at; no metric moved there, and the targeted effects were measured as scores (R16 and R30: 80 → 100).

---

## Block 4: `v2-day4-post` and before/after

**Run.** `v2-day4-post`, `-subset20`, `-stress`, all keyless replays of the same recordings, so changes come from code, not model variance.

| | Before | After |
|---|---|---|
| October month | 12/12, 0/33 (0/14 holdout), touches 9/40 | identical: no regression |
| B1 subset | 10/11 | **11/11** |
| Stress set | 6/10 | **10/10** (7 correct, 3 safe) |
| FX outage (cold cache) | 6 flagged, touches 15, "excluded" USD 224.40 | 0 flagged, touches 9, nothing excluded |

`docs/EVALUATION.md`, `03` (Final column), and `failures.md` hold the numbers. Live spend for the day: about USD 0.09 by the run logs (upper bound), plus one unlogged probe call.

---

## Block 5: user feedback session (not run yet)

Proxy only, straight after P1, on this build. Protocol and blank record in `feedback-session.md`; the P1 protocol now points to it. Exit criterion "user feedback recorded with the resulting changes" is **open**.

---

## Follow-up: the open items (2026-11-04)

**Goal.** Close what Day 4 left open that did not need a person: see the refund wording in a browser, stop misreading month-first statement dates, and give S06 (one receipt, two payments) a real resolution.

**Built.**

- Statement dates: the slash order is decided from the whole file (a number over 12 proves it; both proofs refused; otherwise the shorter period; day first on a tie), and a month-first reading is named on the review page. Stress case S11.
- **R-MAT-10** split payment: a person ticks the lines that together paid a receipt; the amount rules apply to the sum; the ledger amount is the sum; a later claim on any line undoes the split; approval keeps it; the pack lists "L03 + L04".
- A statement fixture for the sample month with a split payment and a refund, so a person (or a script) can try both.

**What went wrong.**

- A half-written shell command meant for the S11 "before" measurement ran and put the pre-fix reader into the working tree. Caught from the tool's warning, restored from `HEAD`, nothing lost; measured afterwards from a temporary copy.
- A probe reported one wrong date after the fix; it was the probe matching TC11's twin line. Position by position: 0 wrong.
- The browser screenshots showed two problems no test had: "$-4.50", and a split form listing 13 lines under every receipt. Both fixed and re-checked.

**Verified.** `pnpm test` 290/290; 11 mutations caught; stress 11/11 keyless; on a production build 16/16 browser checks, including the ledger moving by exactly +18.50 (split) and −4.50 (credit). Before/after for S11: the old reader rejected the full US-style month and read an all-ambiguous excerpt with 15 of 18 dates wrong; the new one reads both exactly.

---

## C1, the builder cold run, and what changed because of it

**Measured.** Fresh clone, install 17.3 s, the month closed in about 8 minutes. Scored by script from the downloaded ledger: 37 of 40 receipts as the key expects; 3 wrong pairings chosen by the person, all signed off as "Good"; the ledger $106.66 over. Every automatic match was right.

**What it means.** On Days 2–4 every safeguard was aimed at the model and the rules. C1 showed the human step can undo them in seconds: any free line could be paired and pushed through with a 4-letter reason. The builder did it, so a newcomer could too.

**Changed** (candidate chose which): a pairing check that shows receipt and payment side by side and lists what does not fit; specific reasons everywhere; a "Saving…" state on every action; the queue as tabs; an in-app guide rendered from the README.

**What went wrong.** Seeding while the server held the database (Windows lock again); JSX comments put inside `.map()` callbacks broke the guide file until they were changed to line comments; `sed` ate a regex's backslashes.

**Verified.** 299/299 tests; 6 guardrail mutations caught; 15/15 browser checks, including C1's exact R13 → L26 pairing replayed through the UI.

---

## P1, the proxy run, and the feedback

**Measured.** Business management, 1 year, new to the app: the month closed in 9 minutes with help once. 39 of 40 receipts as the key expects; the miss was R20 (a $268 hotel with no payment) paired with the $10 card fee and signed off "This is good", with the pairing check on screen. Ledger $10.00 over. Answers recorded word for word in `feedback-session.md`.

**What it means.** Two people, two builds, the same failure: the system's matching was right every time, and every wrong number was a person pairing a receipt with an unrelated payment. The screenshot of P1's screen showed the mechanism: with no real candidate, the payment list filled with weak lines, and the fee was first.

**Changed** (candidate chose each): R-MAT-11 refuses clear mismatches; filler reasons refused; only real candidates suggested; tabs switch on the page and keep what was typed; always light, with groups as cards.

**What went wrong.** The reason rule built for C1 let P1's "This is good" through. One of today's own tests took 5.4 s because it reconciled the month 44 times. Inline shell scripts mangled `$` and backslashes again, despite a saved note; switched to script files.

**Verified.** 307/307 tests; 7 mutations caught; 12/12 browser checks, including P1's exact pairing refused on screen and a typed reason surviving a tab switch.

---

## Day 4 summary

- Exit criterion "`EVALUATION.md` has full results (TC table, holdout and full, B0/B1, latency, cost, human touches)": **met**, except time to close, which needs a person.
- Exit criterion "at least 3 failure analyses with before/after numbers": **met** (six).
- Exit criterion "user feedback recorded with the resulting changes": **met**, by proxy (P1), with five feedback → change pairs.

The fact that most shapes Day 5: on clean data the system and B1 look alike; under stress the differences were all in the deterministic layer, and that layer is now what makes the difference. What nobody has measured yet is a person closing the month.
