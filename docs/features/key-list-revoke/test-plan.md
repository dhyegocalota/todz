# Test plan: Key list after a revoke

Every checkbox states the input and the exact expected outcome. A ticked box carries evidence after ` — evidence: `.

## The failing test first

- [ ] The new tests at the red commit — input: `swift test --filter AppModelTests` at that commit; expected: the same-project tests fail on their `#expect` of the key list, not on a build error

## Unit

- [ ] Revoke held, screen left and reappeared, the new list answers with the key, then the revoke answers — expected: `keys == .loaded` without the key, `revokingKeyIdentifiers == []`
- [ ] Revoke held, screen left and reappeared, the revoke answers, then the new list answers with the key — expected: the key is not listed
- [ ] Revoke held and failing, screen left and reappeared, then the revoke answers — expected: `failedRevokeIdentifiers == []`, the key still listed
- [ ] Revoke held, the key screen switched to another project, then the revoke answers — expected: the other project's list unchanged (existing `aRevokeAnswerAfterTheProjectChangedLeavesTheNewListAlone`)
- [ ] The whole TodzKit suite — expected: every test passes

## The app (Mac walk, local Worker)

- [ ] Debug app on a local Worker, Connect an Agent, issue a key, revoke it — expected: the row leaves the list at once, and a reload (Refresh) does not bring it back
- [ ] Revoke a key while the local Worker is held (SIGSTOP), switch to another sidebar item and back to Connect an Agent, resume the Worker — expected: after the answer, the key is not listed without pressing Refresh

## Edge cases found during execution

## Adversarial review

- [ ] Claim: a revoke answer never touches another project's keys — attack: revoke held, change the screen's project, release

## Coverage honesty

- The trigger in production (what made the screen leave and reappear during the revoke) was not reproduced; the fix covers every visit change for the same project.
