# 00. Challenge Brief (Source of Truth for Grading)

This file transcribes the assignment as given. Do not reinterpret it. When a sprint decision is unclear, check it against this file.

## Objective

Answer this question with a working artifact: **whose recurring workflow did you change, what system did you build, and how did you prove it was better than the previous way of working?**

- Allowed areas: content, marketing, branding, sales, recruiting, customer support, finance, research, operations. **This project: finance.**
- Use a real workflow from your own work or someone around you. Public or synthetic data is allowed, but assumptions about the user and workflow must be stated clearly.
- The problem may be small. It must be **real, recurring, and usable by someone other than you.**

## Format

- Duration: five days, Monday to Friday, remote, about 8 hours a day.
- Final output: working system, evaluation results, and a portfolio-ready case study.
- The candidate owns the problem, tools, scope, schedule, and evaluation method. The company offers lightweight check-ins.

## 5-day rhythm

### Day 1: Discover, map, and baseline

Observe the real workflow and define the exact bottleneck you can solve within five days.

- Target user and job-to-be-done
- Current workflow map: trigger, input, judgment, tool, approval, output, exception
- Evidence of pain: frequency, time, rework, errors, interview notes, or observational evidence
- Baseline: time and quality under the manual process or simple ChatGPT use
- Success metric and explicit non-goals
- 8 to 12 test cases covering representative, edge, and failure scenarios
- v1 scope for Day 5

*Key question: is the problem real, recurring, and measurable against a baseline?*

### Day 2: Design the system and ship v0

Translate the workflow into a system design and make the first happy path work.

- Architecture and end-to-end data flow
- Input/output schemas and data contracts
- Model, tool, storage, and interface choices with rationale
- Human approval points, fallbacks, privacy, and permission boundaries
- Evaluation rubric and pass/fail criteria
- A v0 that moves one real input through the entire flow

*Key question: can this design become a repeatable system rather than a one-time generation?*

### Day 3: Build the working core

Complete the end-to-end core workflow for a non-developer user.

- A working core flow from trigger to final output
- At least two real data-source or tool integrations
- Validation, structured outputs, logs, and useful error messages
- Configuration and secrets separated from the code or workflow
- One interface: CLI, form, chat command, or simple web UI
- First execution by the target user or a proxy user

*Key question: can someone else run the core workflow when you are not beside them?*

### Day 4: Evaluate, break, and harden

Deliberately break the system and improve it until its reliability can be explained.

- Full test-set results and baseline comparison
- Appropriate quality, latency, cost, or manual-touch metrics
- At least three failure cases with root-cause analysis
- The necessary combination of retries, fallbacks, validation, confidence indicators, or human approval
- Before-and-after regression results
- Feedback from the target or proxy user and the changes made in response

*Key question: can you explain quality and failure across multiple conditions, not just one successful example?*

### Day 5: Hand off, prove value, and present

Package the system so another person can run, operate, and improve it.

- Final live demo, runnable repository, or exported workflow
- One-command or three-step setup guide
- User README and operator runbook
- Documentation for architecture, data flow, evaluation set, results, and limitations
- Five-minute screen-recorded demo
- Portfolio-ready case study
- Adoption and quality metrics for the first two weeks after deployment, plus the next iteration plan

*Key question: can another person understand, run, trust, and improve the system?*

## Deliverables

**Working system:** a live URL, runnable repository, exported automation, or reproducible local project. Private submissions are accepted. It must include sample data, an executable core path, and example configuration with all secrets removed.

**Evaluation package:** 8 to 12 test cases with expected behaviour; a baseline versus final-system comparison; pass/fail results and failure analysis; quality, speed, cost, and human-intervention metrics.

**Case study:** user and problem; existing workflow and bottleneck; scope decisions and non-goals; architecture and major trade-offs; work delegated to AI and judgment retained by humans; failures, changes, results, and limitations; next two-week iteration plan.

**AI collaboration note:** AI tools used and the role of each; work delegated to AI; how AI-generated results were verified; important results rejected or manually corrected; core decisions personally owned.

**Demo video (five minutes):** the problem and baseline; a live flow from real input to output; the non-developer user experience; evaluation and failure handling; measured results and the most important limitation.

## How the submission is graded

| Criterion | Weight | Questions |
|---|---|---|
| Problem leverage and scope | 15% | Recurring bottleneck for a real user? Five-day scope with clear non-goals? Success criteria tied to business value? |
| System architecture and engineering | 20% | Clear boundaries between workflow, data, tools, models, and interfaces? Handles input variation and exceptions? Technical choices and trade-offs explained? |
| Working product and reliability | 20% | Works end to end? Appropriate logs, validation, error messages, retries, and fallbacks? Reproducible without the candidate? |
| Evaluation and learning loop | 20% | Baseline, test set, and rubric? Meaningful failure cases found and analysed? Improvement shown honestly, or the lack of it explained? |
| Non-developer UX and adoption | 15% | Can a non-developer run it and understand the result? Are human approval and correction points clear? Do the README, examples, and runbook enable a real handoff? |
| Ownership and communication | 10% | Decisions made under ambiguity? Can the candidate explain and modify AI-generated code? Do the demo and case study communicate decisions, results, and limitations? |

## Where this project earns each criterion

| Criterion | Where it is earned |
|---|---|
| Problem leverage | Real user-acceptance-testing evidence (`01`), a monthly recurring close, and a measured manual baseline |
| Architecture | Deterministic rules core plus a model only for perception (`04`, `05`), with explicit adapter boundaries |
| Reliability | Quality gate, schema validation, retry and fallback, replay mode, and an audit log |
| Evaluation | 12 test cases, two baselines (manual and single-prompt chat), and a regression run after the fixes (`06`) |
| Non-developer UX | One ordered review queue, plain-language reasons, and an Accounting-user README |
| Ownership | Decision log in `TRACKER.md`, the AI collaboration note, and the case study |
