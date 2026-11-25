# Plan: Health HEAD

**Spec:** spec.md
**Tier:** 🟢
**Seam:** `serveHealth` in `apps/api/src/health.ts`, reached before host dispatch by `serveHost`
**Assumptions (decided, owner can override):**
- HEAD is answered by the same function as GET, with the body dropped, so the two cannot drift.

## File map

| Group | Paths owned | Developer sub-agent |
|-------|-------------|---------------------|
| G1 | `apps/api/src/health.ts`, `apps/api/test/health.test.ts` | `developer` |
| G2 | `docs/runbooks/performance.md`, `docs/runbooks/deploy-the-api.md`, `docs/features/health-head/`, `docs/features/README.md` | `developer` |

## Sequencing

G1 then G2; the feature folder's docs land first, the runbook edits after the code.

## Steps

### G1

- [x] **Step 1:** Red: the HEAD tests in `health.test.ts`, committed alone (fb758f8).
- [x] **Step 2:** Green: `serveHealth` answers HEAD with the GET headers and no body (`health.test.ts` green).

### G2

- [x] **Step 3:** Runbooks: the `Server-Timing` sentence in two places, the HEAD probe in step 13, the performance run-log rows (`runbooks.test.ts` green).
- [x] **Step 4:** Tester briefing (`tester-briefing.md`).

## Failure modes

| Step | What breaks | How I notice (the concrete signal) | How I back out |
|------|-------------|------------------------------------|----------------|
| 2 | HEAD answers with a body or without `no-store` | the HEAD tests; `curl -sSI https://api.todz.app/health` in step 13 prints anything but `HTTP/2 200` | revert the commit and deploy |
| 2 | POST or another method starts answering 200 | the POST test | revert the commit and deploy |
| 3 | A run-log row is malformed | `runbooks.test.ts` fails | fix the row |

**Steps with no backout:** none

## Z. Prove and ship

- [x] **Tester briefing:** a developer wrote `tester-briefing.md`.
- [ ] **Tester run:** a fresh `tester` sub-agent executed `test-plan.md` and ticked every box with evidence.
- [ ] **Reviewer:** a fresh `reviewer` sub-agent returned a verdict.
- [ ] **/open-pr:** gates passed, learnings sweep stated, PR opened.
