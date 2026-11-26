# Test plan: Key list after a revoke

Every checkbox states the input and the exact expected outcome. A ticked box carries evidence after ` — evidence: `.

## The failing test first

- [x] The new tests at the red commit — input: `swift test --filter AppModelTests` at that commit; expected: the same-project tests fail on their `#expect` of the key list, not on a build error — evidence: throwaway worktree at d5b7075e (removed after), 507 tests, 2 issues: `aRevokeAnsweredAfterTheScreenReappearedRemovesTheKeyFromTheNewList` (AppModelTests+Keys.swift:460, `keys == .loaded([])`) and `aListAnsweredAfterAConfirmedRevokeInANewVisitDoesNotBringTheKeyBack` (:480), identical to the briefing, no build error

## Unit

- [x] Revoke held, screen left and reappeared, the new list answers with the key, then the revoke answers — expected: `keys == .loaded` without the key, `revokingKeyIdentifiers == []` — evidence: head cef22cae, `aRevokeAnsweredAfterTheScreenReappearedRemovesTheKeyFromTheNewList` passes
- [x] Revoke held, screen left and reappeared, the revoke answers, then the new list answers with the key — expected: the key is not listed — evidence: head cef22cae, `aListAnsweredAfterAConfirmedRevokeInANewVisitDoesNotBringTheKeyBack` passes
- [x] Revoke held and failing, screen left and reappeared, then the revoke answers — expected: `failedRevokeIdentifiers == []`, the key still listed — evidence: head cef22cae, `aFailedRevokeAnsweredAfterTheScreenReappearedShowsNoFailureOnTheNewList` passes (a pin, green before the fix)
- [x] Revoke held, the key screen switched to another project, then the revoke answers — expected: the other project's list unchanged (existing `aRevokeAnswerAfterTheProjectChangedLeavesTheNewListAlone`) — evidence: head cef22cae, passes
- [x] The whole TodzKit suite — expected: every test passes — evidence: head cef22cae, `swift test --package-path apps/macos/TodzKit`: 1356 tests in 107 suites passed

## The app (Mac walk, local Worker)

- [x] Debug app on a local Worker, Connect an Agent, issue a key, revoke it — expected: the row leaves the list at once, and a reload (Refresh) does not bring it back — evidence: Debug app built from head cef22cae, local Worker on 8787 (fake sign-in); Create a Key, Revoke Key: DELETE 204, row gone at once, Refresh (GET keys 200) shows "No keys yet"; `.pr-media/key-list-revoke/walk-1-revoked-after-refresh.png`
- [x] Revoke a key while the local Worker is held (SIGSTOP), switch to another sidebar item and back to Connect an Agent, resume the Worker — expected: after the answer, the key is not listed without pressing Refresh — evidence: workerd SIGSTOPped, Revoke Key confirmed, Inbox then Connect an Agent (Keys showed "Loading…"), SIGCONT: DELETE 204 and GET keys 200 answered, "No keys yet", Refresh never pressed; `.pr-media/key-list-revoke/walk-2-held-revoke-after-reappear.png`

## Edge cases found during execution

- Connect an Agent showed "The server is older than todz 0.2.0 expects. It needs an update." against the local Worker while every call answered 2xx. Unrelated to the revoke; noted, not investigated.
- With the Worker held, the reappeared key screen showed "Loading…" with no stale key row; after release the list settled without the key.
- `xcodebuild` first failed (`cannot find 'SettingsWorkspaceRows'`) on a stale git-ignored `Todz.xcodeproj`; `xcodegen generate` fixed it, no tracked change.

## Adversarial review

- [x] Claim: a revoke answer never touches another project's keys — attack: revoke held, change the screen's project, release — evidence: unit `aRevokeAnswerAfterTheProjectChangedLeavesTheNewListAlone` passes at head cef22cae; not walked, the fresh workspace has one project

## Coverage honesty

- The trigger in production (what made the screen leave and reappear during the revoke) was not reproduced; the fix covers every visit change for the same project.
