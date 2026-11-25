# Plan: Production smoke walk

**Spec:** spec.md
**Tier:** 🟢
**Seam:** `docs/runbooks/` and its shape test, `tools/repository-shape/src/runbooks.test.ts`
**Assumptions (decided, owner can override):**
- A runbook is followed step by step, so it never takes the docs lane (HARNESS §1); the folder carries all three files.
- The walk's tasks live in the `todz-perf` workspace under a `smoke-<short>` title, so the owner's real tasks are never touched.
- The probes assert what the code answers today: an unsolved token is `429 sign_in_refused`, a malformed verifier `401`, from the eleventh `429`.

## File map

| Group | Paths owned | Developer sub-agent |
|-------|-------------|---------------------|
| G1 | `docs/runbooks/production-smoke-walk.md`, `docs/runbooks/README.md`, `tools/repository-shape/src/runbooks.test.ts`, `docs/features/smoke-walk/`, `docs/features/README.md` | `developer` |

## Sequencing

One group, one commit.

## Steps

### G1

- [x] **Step 1:** The runbook, its Run log and the index row.
- [x] **Step 2:** The exception sentence in the index and in `runbooks.test.ts`.
- [x] **Step 3:** The feature folder and its row in `docs/features/README.md`.

## Failure modes

| Step | What breaks | How I notice (the concrete signal) | How I back out |
|------|-------------|------------------------------------|----------------|
| 1 | A step has no `If it fails` line or a link is broken | `runbooks.test.ts` fails | fix the step |
| 2 | The sentence and the test constant disagree | `runbooks.test.ts` fails | align them |

**Steps with no backout:** none

## Z. Prove and ship

- [x] **Tester briefing:** a developer wrote `tester-briefing.md`.
- [ ] **Tester run:** the first run of the walk is the proof; its rows go in the Run log.
- [ ] **Reviewer:** a fresh `reviewer` sub-agent returned a verdict.
- [ ] **/open-pr:** gates passed, learnings sweep stated, PR opened.
