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

- [x] **Step 1:** Red: the spec's model tests in `AppModelTests+Keys.swift`, committed alone — evidence: d5b7075e
- [x] **Step 2:** Green: `revokeKey` keeps a confirmed revoke for the same project (`swift test` green) — evidence: 5421ac23, 1356 tests passing
- [x] **Step 3:** Tester briefing — evidence: tester-briefing.md
- [x] **Step 4 (added by the review):** the marker of a second revoke survives an earlier visit's answer; red `16671533`, green `e12ea774`, 1358 tests passing

## Failure modes

| Step | What breaks | How I notice (the concrete signal) | How I back out |
|------|-------------|------------------------------------|----------------|
| 2 | A revoke answer removes a key from another project's list | `aRevokeAnswerAfterTheProjectChangedLeavesTheNewListAlone` | revert the commit |
| 2 | A failure line shows on a row in a later visit | the failed-revoke-in-a-new-visit test | revert the commit |

**Steps with no backout:** none

## Z. Prove and ship

- [x] **Tester briefing:** a developer wrote `tester-briefing.md`.
- [x] **Tester run:** a fresh `tester` sub-agent executed `test-plan.md` and ticked every box with evidence (7a8366e7, at cef22cae; the fix round's change is covered by its unit test, not re-walked).
- [x] **Reviewer:** one combined review returned WITH RESERVATIONS at 5421ac23 (1 IMPORTANT, 2 MINOR, security CLEAR, merge sensitivity LOW); all three fixed in 16671533..ed25eac1 and the spec, as the reviewer proposed.
- [ ] **/open-pr:** gates passed, learnings sweep stated, PR opened.
