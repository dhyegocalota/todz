# Tester briefing: The owner's checklist notes

Written by the developer sub-agent. The developer did not run `test-plan.md`, did not launch the app and does not declare the feature works.

## What changed

- `apps/macos/TodzKit/Sources/TodzKit/HistoryFailure.swift`: `HistoryFailure.of(isOffline:)` picks `.offline` or `.failed`.
- `apps/macos/TodzKit/Sources/TodzKit/AppModel.swift`: `isOffline` is readable from the app (`public internal(set)`).
- `apps/macos/Todz/MainWindow/Inspector/HistoryList.swift`, `apps/macos/Copy/InspectorCopy.swift`: offline failed history shows `historyOffline` in secondary colour; online keeps the red line; Try Again under both.
- `apps/macos/Todz/SignIn/CredentialSlot.swift`: asks for identity focus again on `NSWindow.didBecomeKeyNotification`.
- `docs/features/mac-app-shell/design.md`: § 1.1 and § 7 record the measured 976 × 532 next to the built 848 × 532.
- Step 4 (⌘2 in the popover): no code was changed. The tester checks it with a real key event (`osascript` key code through System Events) with another app in front.

## How to run

```bash
swift test --package-path apps/macos/TodzKit
xcodegen -s apps/macos/project.yml -p apps/macos
xcodebuild build -project apps/macos/Todz.xcodeproj -scheme Todz -configuration Debug
```

## Red today, green after

| Test | Red before the change because | Green after because |
|------|--------------------------------|---------------------|
| `HistoryFailureTests::aFailureWhileOfflineIsOffline`, `aFailureWhileOnlineIsFailed` (commit 892249a) | `Fatal error: HistoryFailure is not implemented` | 967c600 returns `.offline` when offline, else `.failed` |

Full suite after: 545 tests in 36 suites passed; Debug build succeeded.

## Hypotheses to attack

1. Hypothesis: offline, a task whose history is not cached shows the secondary "History shows when todz is back online." with Try Again; an online failure still shows the red "Couldn't load the history." Break it by: go offline, select an uncached task, come back online and press Try Again; also fail the history while online.
2. Hypothesis: after Sign Out the identity field is focused with no click. Presumed cause (not reproduced): the sign-out confirmation dialog is still the key window when the `.task` of `CredentialSlot` runs, so the first focus request is lost; the new request on `didBecomeKeyNotification` lands once the main window is key. Break it by: sign out through the dialog and type at once; repeat through the menu command; also a fresh launch while signed out.
3. Hypothesis: the focus observer does not steal focus elsewhere. Break it by: open the menu bar popover or another window while on the sign-in screen, then return.
4. Hypothesis: the main window minimum on his Mac is 976 × 532 because the sidebar measured 308 wide with the Connect an Agent section. Break it by: resizing to the minimum and measuring the sidebar.
5. Note 4 (⌘2 in the popover) may already work; verify with a real key event and record the evidence.
6. Note 5: no change; the count follows the server's tasks.

## Known gaps

- The app was never launched by the developer; the focus fix is reasoned from the code only.
- The observer is not filtered to its own window: another window becoming key also requests focus, harmless because focus state is per window.
