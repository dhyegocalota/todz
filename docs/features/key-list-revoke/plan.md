# Plan: Key list after a revoke

**Spec:** spec.md
**Tier:** 🟢
**Seam:** `AppModel.revokeKey` in `apps/macos/TodzKit/Sources/TodzKit/AppModel+Keys.swift`
**Assumptions (decided, owner can override):**
- The guard after the revoke request compares the project the key screen shows, not the visit: a revoke is a fact about the project's keys, not about one appearance of the screen.

## File map

| Group | Paths owned | Developer sub-agent |
|-------|-------------|---------------------|
| G1 | `apps/macos/TodzKit/Sources/TodzKit/AppModel+Keys.swift`, `apps/macos/TodzKit/Tests/TodzKitTests/AppModelTests+Keys.swift`, `docs/features/key-list-revoke/tester-briefing.md` | `developer` |

## Sequencing

G1, one developer.

## Steps

### G1

- [ ] **Step 1:** Red: the spec's model tests in `AppModelTests+Keys.swift`, committed alone
- [ ] **Step 2:** Green: `revokeKey` keeps a confirmed revoke for the same project (`swift test` green)
- [ ] **Step 3:** Tester briefing

## Failure modes

| Step | What breaks | How I notice (the concrete signal) | How I back out |
|------|-------------|------------------------------------|----------------|
| 2 | A revoke answer removes a key from another project's list | `aRevokeAnswerAfterTheProjectChangedLeavesTheNewListAlone` | revert the commit |
| 2 | A failure line shows on a row in a later visit | the failed-revoke-in-a-new-visit test | revert the commit |

**Steps with no backout:** none

## Z. Prove and ship

- [ ] **Tester briefing:** a developer wrote `tester-briefing.md`.
- [ ] **Tester run:** a fresh `tester` sub-agent executed `test-plan.md` and ticked every box with evidence.
- [ ] **Reviewer:** one combined review (correctness and security) returned its verdict.
- [ ] **/open-pr:** gates passed, learnings sweep stated, PR opened.
