# Plan: Landing admin deploy

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

- [x] **Step 1:** Run steps 1 to 15 of the runbook from `main` at 217d5c3 (step 10's Turnstile part is the owner's; its `ADMIN_EMAIL` part was run) — evidence: the run log rows.
- [x] **Step 2:** Record the rows — evidence: this branch.

## Failure modes

| Step | What breaks | How I notice (the concrete signal) | How I back out |
|------|-------------|------------------------------------|----------------|
| 2 | a row disagrees with production | the tester's read-only checks | correct the row |

**Steps with no backout:** step 1 (the deploy is live; the runbook's Rollback section applies: the 0006 tables stay, the cron needs `"crons": []`, and deleting `ADMIN_EMAIL` closes the admin).

## Z. Prove and ship

- [x] **Tester run:** 12 of 12, no defect — evidence: dde39b2; the review's `/sign-in` and `/mcp` read added and run by the lead.
- [x] **Reviewer:** WITH RESERVATIONS, LOW; three MINORs: row 9 names both versions, the domain command spelled out, the `/sign-in` and `/mcp` read added. Security: CLEAR; its two notes answered (row 10 names how the secret went in; row 15's counts are the run's own).
- [x] **/open-pr:** gates passed.
