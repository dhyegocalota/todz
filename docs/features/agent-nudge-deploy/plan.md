# Plan: Agent nudge deploy

**Spec:** spec.md
**Tier:** 🟢
**Seam:** `docs/runbooks/deploy-the-api.md`'s run log
**Assumptions (decided, owner can override):**
- The run log lives in the runbook, as ADR 0008 and the runbook's step 16 say.

## File map

| Group | Paths owned | Developer sub-agent |
|-------|-------------|---------------------|
| Lead | `docs/runbooks/deploy-the-api.md` (the run log), this folder | the lead, whose sub-agent ran the deploy |

## Sequencing

One commit after the run.

## Steps

- [x] **Step 1:** Run steps 1 to 15 of the runbook from `main` at 59d3966 (step 10 put nothing: no new secret, the Turnstile widget is the owner's) — evidence: the run log rows.
- [x] **Step 2:** Record the rows — evidence: this branch.

## Failure modes

| Step | What breaks | How I notice (the concrete signal) | How I back out |
|------|-------------|------------------------------------|----------------|
| 2 | a row disagrees with production | the tester's read-only checks | correct the row |

**Steps with no backout:** step 1 (the deploy is live; the runbook's Rollback section applies: the `agent_nudge` column stays and an older version never reads it).

## Z. Prove and ship

- [x] **Tester run:** 16 of 16, no defect — evidence: f201b7a.
- [x] **Reviewer:** WITH RESERVATIONS, LOW; two MINORs: row 15 now says the follow-up request was not sent; the `/admin` box kept as is (its command is the runbook's step 13).
- [ ] **/open-pr:** gates passed.
