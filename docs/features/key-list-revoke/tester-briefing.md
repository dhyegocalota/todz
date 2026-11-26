# Tester briefing: Key list after a revoke

## What changed

- `apps/macos/TodzKit/Sources/TodzKit/AppModel+Keys.swift`: `revokeKey` no longer drops a server-confirmed revoke when the key screen's visit changed. After the request it compares the project the key screen shows (`keyProjectIdentifier`), not the visit. A confirmed revoke always reaches `forget`, which records the key in `revokedKeyIdentifiers`, so a later list answer cannot bring it back. The failure line (`failedRevokeIdentifiers`) is still set only in the same visit.
- `apps/macos/TodzKit/Tests/TodzKitTests/AppModelTests+Keys.swift`: three tests added.

## How to run

`swift test --package-path apps/macos/TodzKit --filter AppModelTests` (fast loop), then `swift test --package-path apps/macos/TodzKit` (whole suite: 1356 tests in 107 suites, passing).

## Red first

Red commit `d5b7075e`, run of `--filter AppModelTests` printed:

```
✘ Test aRevokeAnsweredAfterTheScreenReappearedRemovesTheKeyFromTheNewList() recorded an issue at AppModelTests+Keys.swift:460:9: Expectation failed: harness.model.keys == .loaded([])
✘ Test aListAnsweredAfterAConfirmedRevokeInANewVisitDoesNotBringTheKeyBack() recorded an issue at AppModelTests+Keys.swift:480:9: Expectation failed: harness.model.keys == .loaded([])
✘ Test run with 507 tests in 1 suite failed after 0.188 seconds with 2 issues.
```

Green commit `5421ac23`.

| Test | State at the red commit |
|------|-------------------------|
| `aRevokeAnsweredAfterTheScreenReappearedRemovesTheKeyFromTheNewList` | red |
| `aListAnsweredAfterAConfirmedRevokeInANewVisitDoesNotBringTheKeyBack` | red |
| `aFailedRevokeAnsweredAfterTheScreenReappearedShowsNoFailureOnTheNewList` | pin (green before the fix; forgetKeys already cleared the failure state) |
| `aRevokeAnswerAfterTheProjectChangedLeavesTheNewListAlone` (existing) | green before and after |

## Hypotheses for the tester

- A revoke confirmed after the screen left and reappeared for the same project removes the key from the new list, and a list read before the revoke cannot bring it back.
- A revoke answered after the screen switched to another project touches nothing of the new project's state.
- A failed revoke answered in a new visit shows no failure line on the new list.
- A revoke in the same visit behaves as before (removal, failure line, in-flight marker).

## Gaps

- The production trigger that made the screen leave and reappear during the revoke was not reproduced; the Mac walk in `test-plan.md` covers it by switching sidebar items while the Worker is held.
- No stub was needed; the red run reached the assertions.
