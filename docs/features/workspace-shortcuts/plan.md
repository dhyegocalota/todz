# Workspace shortcuts plan

- [ ] Red: `WorkspaceBindingsTests.swift` and `WorkspaceStepTests.swift` with stubs of the new types; run the Swift filter and record the red text.
- [ ] Green: defaults, `rebinding`, the preference's storage and `WorkspaceShortcuts.workspace(action:activeIdentifier:in:)`; `AppModel.switchWorkspace(action:)` with its tests.
- [ ] App: `WorkspaceHotKeys`, `WorkspaceShortcutController`, the key-event extensions, the menu items, the Settings section and the copy.
- [ ] Docs: ADR 0079 and its index row, the `docs/features/README.md` row, `tester-briefing.md`.
- [ ] `swift test`, then xcodegen and xcodebuild, then `pnpm verify`, each in the foreground.

## File map

| File | Change |
|------|--------|
| `apps/macos/TodzKit/Sources/TodzKit/ChordModifiers.swift` | new option set |
| `apps/macos/TodzKit/Sources/TodzKit/KeyChord.swift` | new chord value |
| `apps/macos/TodzKit/Sources/TodzKit/WorkspaceAction.swift` | new action with the default chords |
| `apps/macos/TodzKit/Sources/TodzKit/WorkspaceBindings.swift` | new bindings and refusals |
| `apps/macos/TodzKit/Sources/TodzKit/WorkspaceShortcutsPreference.swift` | new stored preference |
| `apps/macos/TodzKit/Sources/TodzKit/WorkspaceShortcuts.swift` | `workspace(action:activeIdentifier:in:)` |
| `apps/macos/TodzKit/Sources/TodzKit/AppModel+WorkspaceShortcuts.swift` | `switchWorkspace(action:)` |
| `apps/macos/TodzKit/Tests/TodzKitTests/WorkspaceBindingsTests.swift`, `WorkspaceStepTests.swift`, `AppModelTests+WorkspaceActions.swift` | new tests |
| `apps/macos/Todz/Shared/WorkspaceHotKeys.swift`, `WorkspaceShortcutController.swift`, `KeyChord+Keyboard.swift` | Carbon, controller, key conversions (the last replaces `WorkspaceShortcuts+Keyboard.swift`) |
| `apps/macos/Todz/Settings/SettingsWorkspaceShortcuts.swift`, `WorkspaceChordRow.swift`, `SettingsView.swift` | Settings section and one line |
| `apps/macos/Todz/WorkspaceMenuItems.swift`, `AppCommands.swift`, `TodzApp.swift`, `AppDelegate.swift` | menu chords, defaults registration, the controller |
| `apps/macos/Copy/WorkspaceShortcutsCopy.swift` | copy |

## Failure modes

| Failure | Handling |
|---------|----------|
| Another app already holds a chord | Registration of that chord fails quietly; the menu chord still works in todz |
| Mission Control's Switch to Desktop holds ⌃1–⌃9 | The system wins; Settings says so in one line |
| The stored bindings are unreadable | Read as the defaults |
| The global switch is turned off | Every hot key is unregistered at once |
