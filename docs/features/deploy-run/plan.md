# Plan: Deploy run

**Spec:** spec.md
**Tier:** 🟢
**Seam:** `docs/runbooks/deploy-the-api.md` and its shape test
**Assumptions (decided, owner can override):**
- The run log lives in the runbook, as ADR 0008 and the runbook's step 16 say.

## File map

| Group | Paths owned | Developer sub-agent |
|-------|-------------|---------------------|
| Lead | `docs/runbooks/deploy-the-api.md`, `tools/repository-shape/src/runbooks.test.ts`, the learning and its index row | the lead, who ran the deploy |

## Sequencing

One commit after the run.

## Steps

- [x] **Step 1:** Run steps 1 to 15 of the runbook from `main` at 2bde053 (step 10 is the owner's) — evidence: the run log rows.
- [x] **Step 2:** Correct steps 8, 9 and 15, and the run-log shape test; write the learning — evidence: this branch.

## Failure modes

| Step | What breaks | How I notice (the concrete signal) | How I back out |
|------|-------------|------------------------------------|----------------|
| 2 | a changed command no longer runs | the tester's rerun of steps 9 and 15 | revert the runbook lines |

**Steps with no backout:** step 1 (the deploy is live; the runbook's Rollback section applies).

## Z. Prove and ship

- [x] **Tester run:** 8 of 8 at e912c57, no defect — evidence: c638373.
- [x] **Reviewer:** WITH RESERVATIONS, all fixed: `<version-id>` is defined, the run-log test requires at least one row, the owner's name is gone from the subdomain row, and the learning carries a Revisited line. Security CLEAR; the live Worker answers 503 on both sign-in posts until the secret exists.
- [x] **/open-pr:** gates passed, PR opened.
