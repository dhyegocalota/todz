# Test plan: lock single workspace

Unit tests run with Swift Testing in `apps/macos/TodzKit` (`swift test`) against a fake `DeviceOwnerAuthenticator`. Boxes stay unticked until the tester has run them.

## One workspace while the switch is on

Run at c58b22ca: `swift test` in `apps/macos/TodzKit`, 1753 tests in 151 suites passed. Red-first replayed in a throwaway worktree (removed): at 798d573c `AppModelTests+LockSingleWorkspace` fails 15 tests with 22 issues; at 92083c8e `AppModelTests+OneWorkspaceWhileLockOn` fails with 8 issues.

- [x] An unlocked session refuses All workspaces and several workspaces and keeps one. — evidence: `anUnlockedSessionWithTheSwitchOnRefusesAllWorkspaces`, `...RefusesSeveralWorkspaces`, `...StillSwitchesToOneOtherWorkspaceWithoutAsking`; red at 92083c8e (selection != [acme]), green at c58b22ca
- [x] A locked session refuses toggles, All workspaces and several without asking. — evidence: `allWorkspacesAndSeveralWhileLockedAreRefusedWithoutAsking`, `togglingAnotherWorkspaceWhileLockedIsRefusedWithoutAsking`, green at c58b22ca
- [x] The picker refuses All workspaces after the switch prompt. — evidence: `thePickerRefusesAllWorkspacesAfterTheSwitchPrompt`; red at 92083c8e (phase != .choosing, selection != [acme]), green at c58b22ca
- [x] The switcher draws no All workspaces row while the switch is on. — evidence: `withTheSwitchOnTheMenuOffersNoAllWorkspaces` (WorkspaceChromeTests) and `WorkspaceLock.shown` (WorkspaceLockTests), green at c58b22ca; the SwiftUI view was not rendered, model level only
- [x] Turning the switch on collapses a multi-selection and the widget snapshot follows. — evidence: `turningTheSwitchOnCollapsesAMultiSelectionAndTheSnapshotFollows`, green at c58b22ca
- [x] Unlocking a launch that remembered All leaves one workspace. — evidence: `unlockingACollapsedLaunchThatRememberedAllLeavesOneWorkspace`, green at c58b22ca
- [x] Turning the switch off brings several back without restoring the old selection. — evidence: `turningTheSwitchOffBringsSeveralBackButNeverTheOldSelection`, green at c58b22ca

## Switching asks

- [x] A switch to another workspace, the picker and the numbered and step shortcuts ask while locked; a refusal leaves the selection as it was. — evidence: `switchingToAnotherWorkspaceWhileLockedAsksAndSwitchesOnceConfirmed`, `aRefusedSwitchWhileLockedLeavesTheSingleSelection`, `theNumberedShortcutAsksWhileLocked...`, `theStepShortcutsAskWhileLocked...`, `theNextShortcutAsksWhileLocked...`, `choosingFromTheLockedLaunchPickerAsks...`, `aRefusedPickerChoiceKeepsThePicker`; red at 798d573c (15 tests, 22 issues), green at c58b22ca
- [x] A number naming the current workspace asks nothing and stays put. — evidence: `theNumberOfTheCurrentWorkspaceNeitherAsksNorMovesWhileLocked`; red at 92083c8e (asked not empty, active != secret, lock not locked), green at c58b22ca
- [x] A number beyond the visible list asks, then resolves against every workspace. — evidence: `aNumberBeyondTheVisibleListAsksThenResolvesAgainstEveryWorkspace`, green at c58b22ca
- [x] The in-app number chords beyond the list reach the model while locked without drawing rows. — evidence: `theNumberChordsBeyondTheListReachTheModelWhileLockedWithoutDrawingRows`, green at c58b22ca; the controller and menu views were not rendered, model level only
- [x] With the switch off or the session unlocked nothing asks; a confirmed prompt asks once. — evidence: `withTheLockOffNoSelectionAsks`, `aConfirmedPromptAsksOnlyOnceForTheNextSelections`, `noChordIsHiddenWithTheSwitchOff`, green at c58b22ca

## Edge cases found during execution

- [x] The switch is turned on while a multi-selection is shown and a switch prompt is still open: the confirmed prompt must not leave two workspaces selected. — evidence: `pinTurningTheSwitchOnWhileASwitchPromptIsOpenNeverLeavesTwoWorkspaces`; a pin, it passed on first run, so the behaviour already held
- [x] A launch that remembered All with the switch on and the session locked: the picker offers one workspace and entering it leaves one workspace. — evidence: `pinALockedLaunchThatRememberedAllOffersTheListAndEntersWithOneWorkspace`; a pin, it passed on first run, so the behaviour already held
