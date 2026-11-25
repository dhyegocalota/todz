# Plan: Landing deploy

**Spec:** spec.md
**Tier:** 🟢
**Seam:** `docs/runbooks/deploy-the-api.md`'s run log
**Assumptions (decided, owner can override):**
- The run log lives in the runbook, as ADR 0008 and the runbook's step 16 say.

## File map

| Group | Paths owned | Developer sub-agent |
|-------|-------------|---------------------|
| Lead | `docs/runbooks/deploy-the-api.md` (the run log), this folder | the lead, who ran the deploy |

## Sequencing

One commit after the run.

## Steps

- [x] **Step 1:** Run steps 1 to 15 of the runbook from `main` at fe34431 (step 10 is the owner's; step 15 not rerun) — evidence: the run log rows.
- [x] **Step 2:** Record the rows — evidence: this branch.

## Failure modes

| Step | What breaks | How I notice (the concrete signal) | How I back out |
|------|-------------|------------------------------------|----------------|
| 2 | a row disagrees with production | the tester's read-only checks | correct the row |

**Steps with no backout:** step 1 (the deploy is live; the runbook's Rollback section applies, including the site-only bullet).

## Z. Prove and ship

- [x] **Tester run:** 10 of 10, no defect — evidence: 142500a.
- [x] **Reviewer:** YES, LOW; three MINORs: the step 15 row's reason (reworded), the tier note (added), and these ticks.
- [x] **/open-pr:** gates passed, PR #26 opened.
