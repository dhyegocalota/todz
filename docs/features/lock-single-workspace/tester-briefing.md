# Tester briefing: lock single workspace

Written by the developer when its steps are done. The developer does not run `test-plan.md` and does not declare the feature works.

## What changed

- `apps/macos/TodzKit/Sources/TodzKit/AppModel+WorkspaceLock.swift`: `isShowableAfterAsking` (refuses several, asks while locked), `collapsedToOneWorkspace`, `hiddenWorkspaceAction`.
- `AppModel+Workspaces.swift`, `AppModel+WorkspaceShortcuts.swift`: selection and shortcuts go through the rule; the phase is re-checked after each prompt.
- `WorkspaceLock.shown`, `AppModel.shownWorkspaces`: one workspace while the switch is on.
- `WorkspaceChrome`, `Todz/Shared/WorkspaceSwitcher.swift`: no All workspaces row, rows switch instead of toggling.
- `Todz/Shared/WorkspaceShortcutController.swift`, `Todz/WorkspaceMenuItems.swift`: number chords beyond the list reach the model while locked; Previous and Next are enabled while locked.

## How to run

```bash
cd apps/macos/TodzKit && swift test
cd ../.. && xcodegen generate --spec apps/macos/project.yml
xcodebuild build -project apps/macos/Todz.xcodeproj -scheme Todz -configuration Debug -derivedDataPath apps/macos/build
```

Never launch the Debug app on screen and never touch `/Applications`; prove the views through the unit tests and the offscreen renderer.

## Red today, green after

| Test | Red before the change because | Green after because |
|------|--------------------------------|---------------------|
| `AppModelTests+OneWorkspaceWhileLockOn` (all workspaces, several, picker) | an unlocked session widened | the model refuses a selection of several |
| `theNumberOfTheCurrentWorkspaceNeitherAsksNorMovesWhileLocked` | every number asked | a listed number goes straight to the switch |
| `AppModelTests+LockSingleWorkspace` (switch, number, step, picker asks) | nothing asked while locked | the rule asks first |

## Hypotheses to attack

1. Hypothesis: no path selects two workspaces while the switch is on. Break it by: toggling, All workspaces, the picker, a launch that remembered All, a workspace created while All was selected.
2. Hypothesis: a refused or cancelled prompt changes nothing. Break it by: cancelling while two requests share one prompt.
3. Hypothesis: a locked session tells nothing about other workspaces. Break it by: comparing the prompts of ⌃2 with and without a second workspace.

## Known gaps

- The switcher and menu views are checked by a Debug build only; they were not rendered on screen.
- Links, intents and Shortcuts still refuse instead of asking (ADR 0113).
