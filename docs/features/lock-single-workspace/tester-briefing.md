# Tester briefing: lock single workspace

Written by the developer when its steps are done. The developer does not run `test-plan.md` and does not declare the feature works.

## What changed

- `apps/macos/TodzKit/Sources/TodzKit/AppModel+WorkspaceLock.swift`: `isShowableAfterAsking` (refuses several, asks while locked), `collapsedToOneWorkspace`, `hiddenWorkspaceAction` (the ⌃ and ⌘ number chords beyond the list, only on the ready screen).
- `AppModel+Workspaces.swift`, `AppModel+WorkspaceShortcuts.swift`: selection and shortcuts go through the rule; the phase is re-checked after each prompt.
- `WorkspaceLock.shown`, `AppModel.shownWorkspaces`: one workspace while the switch is on.
- `WorkspaceChrome`, `Todz/Shared/WorkspaceSwitcher.swift`: no All workspaces row, rows switch instead of toggling.
- `Todz/Shared/WorkspaceShortcutController.swift`, `Todz/WorkspaceMenuItems.swift`: number chords beyond the list reach the model while locked, and the monitor is suspended with the global hot keys; Previous and Next are enabled while locked.

## How to run

```bash
cd apps/macos/TodzKit && swift test
cd ../../.. && xcodegen generate --spec apps/macos/project.yml
xcodebuild build -project apps/macos/Todz.xcodeproj -scheme Todz -configuration Debug -derivedDataPath apps/macos/build
```

Never launch the Debug app on screen and never touch `/Applications`; prove the views through the unit tests and the offscreen renderer.

## Red today, green after

| Test | Red before the change because (printed failure) | Green after because |
|------|--------------------------------------------------|---------------------|
| `anUnlockedSessionWithTheSwitchOnRefusesAllWorkspaces`, `...RefusesSeveralWorkspaces` (92083c8e) | `Expectation failed: harness.model.selection == .chosen(["acme"])` | the model refuses a selection of several |
| `thePickerRefusesAllWorkspacesAfterTheSwitchPrompt` (92083c8e) | `Expectation failed: harness.model.phase == .choosing` | the picker refuses All workspaces |
| `theNumberOfTheCurrentWorkspaceNeitherAsksNorMovesWhileLocked` (92083c8e) | `Expectation failed: harness.authenticator.asked.isEmpty` | a listed number goes straight to the switch |
| `AppModelTests+LockSingleWorkspace` switch, number, step and picker tests (798d573c) | `Expectation failed: harness.authenticator.asked == [.switchWorkspaces]` with `asked → []` | the rule asks first |
| `aSwitchWhoseCurrentWorkspaceVanishedDuringThePromptShowsAndPullsNothing`, `aPickerChoiceWhoseListBecameOneWorkspaceDuringThePromptDoesNotShowTwice` (a79b18ed) | with the guards removed: `Expectation failed: pullCount(harness, projectIdentifier: "secret-inbox") == 0` and `... "acme-inbox") == pullsBefore` | the phase is re-checked after the prompt |
| `theCommandNumberChordsBeyondTheListReachTheModelWhileLocked`, `noChordIsHiddenOnTheSignInScreen` (7827d1a4) | no action for the ⌘ chord; an action on the sign-in screen | `hiddenWorkspaceAction` matches ⌘ and checks the phase |

Covered with the implementation (not red-first), landed in 72be63e2: `togglingAnotherWorkspaceWhileLockedIsRefusedWithoutAsking`, `allWorkspacesAndSeveralWhileLockedAreRefusedWithoutAsking`, `theNumberChordsBeyondTheListReachTheModelWhileLockedWithoutDrawingRows`, `noChordIsHiddenWithTheSwitchOff`, `withTheSwitchOnTheMenuOffersNoAllWorkspaces`.

## Hypotheses to attack

1. Hypothesis: no path selects two workspaces while the switch is on. Break it by: toggling, All workspaces, the picker, a launch that remembered All, a workspace created while All was selected.
2. Hypothesis: a refused or cancelled prompt changes nothing. Break it by: cancelling while two requests share one prompt.
3. Hypothesis: a locked session tells nothing about other workspaces. Break it by: comparing the prompts of ⌃2 and ⌘2 with and without a second workspace.

## Known gaps

- The switcher and menu views are checked by a Debug build only; they were not rendered on screen.
- Links, intents and Shortcuts still refuse instead of asking (ADR 0113).
