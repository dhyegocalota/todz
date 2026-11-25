# Plan: Landing waitlist deploy

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

- [x] **Step 1:** Run steps 1 to 15 of the runbook from `main` at 6a65b68 (step 10 is the owner's) — evidence: the run log rows.
- [x] **Step 2:** Record the rows — evidence: this branch.

## Failure modes

| Step | What breaks | How I notice (the concrete signal) | How I back out |
|------|-------------|------------------------------------|----------------|
| 2 | a row disagrees with production | the tester's read-only checks | correct the row |

**Steps with no backout:** step 1 (the deploy is live; the runbook's Rollback section applies, and the `waitlist` table stays through any rollback).

## Z. Prove and ship

- [x] **Tester run:** 11 of 11, no defect — evidence: 0de5c4b; the review's two read checks added and run by the lead.
- [x] **Reviewer:** WITH RESERVATIONS, LOW; six MINORs: rows 11 and 15 completed by running the two commands, the spec's read list widened with its two checks, rows 8 and 12 kept in landing-deploy's wording, and these ticks with the status flip. Security: CLEAR.
- [x] **/open-pr:** gates passed.
