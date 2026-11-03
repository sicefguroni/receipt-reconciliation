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

## Day 4 summary

- Exit criterion "`EVALUATION.md` has full results (TC table, holdout and full, B0/B1, latency, cost, human touches)": **met**, except time to close, which needs a person.
- Exit criterion "at least 3 failure analyses with before/after numbers": **met** (six).
- Exit criterion "user feedback recorded with the resulting changes": **open** (P1 + feedback).

The fact that most shapes Day 5: on clean data the system and B1 look alike; under stress the differences were all in the deterministic layer, and that layer is now what makes the difference. What nobody has measured yet is a person closing the month.
