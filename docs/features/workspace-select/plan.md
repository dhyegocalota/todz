# Workspace select plan

- [x] Red 1: `AppModelTests+WorkspaceChoice.swift` tests and the `choosing` phase and `chooseWorkspace` stubs; run the Swift filter and record the red text. Done at 679f1901 (9 failures).
- [x] Green 1: `openListedWorkspaces` enters `choosing` for two or more workspaces with no remembered one; `chooseWorkspace(identifier:)` activates; the switch sites handle `choosing`. Done at ce1a4327.
- [x] Red 2 (struck): the widget and shortcut readiness tests were not a separate red commit. The widget case passed on the stub, and the shortcut readiness case was added in the fix round at a3b507e7.
- [x] Green 2: `WorkspacePickerScreen`, its copy file and the RootView case. Done at 5238fec4.
- [x] Settings: `SettingsWorkspaceRows` in its own file and one line in `SettingsView`. Done at 5238fec4, hidden when the list is empty in the fix round.
- [x] Menu bar popover prompt for `choosing` in `MenuBarCopy`. Done at 5238fec4.
- [x] Docs: `docs/features/README.md` row, package README purpose check, `tester-briefing.md`. Done at ff1c3bfe and fdb14257.
- [x] `pnpm verify` foreground, then the `macos` gate's xcodegen and xcodebuild. Green at the merge commits; see the fix round's gates line.
- [x] Push with `gh-as-owner.sh`. Pushed at each lane step.
- [x] Fix round: the phase guard on switching (red a3b507e7), the watches of a left workspace, the choosing shortcut readiness, the empty Settings section, the plural copy, the tenant guard test, and the harness no longer remembering a workspace.

## File map

| File | Change |
|------|--------|
| `apps/macos/TodzKit/Sources/TodzKit/AppPhase.swift` | add `choosing` |
| `apps/macos/TodzKit/Sources/TodzKit/AppModel+Workspaces.swift` | pick `choosing` in `openListedWorkspaces`; add `chooseWorkspace(identifier:)` |
| `apps/macos/TodzKit/Sources/TodzKit/AppModel+Widgets.swift` | `choosing` gives `.absent` |
| `apps/macos/TodzKit/Sources/TodzKit/AppModel+Shortcuts.swift` | `choosing` gives `.noWorkspace` |
| `apps/macos/TodzKit/Sources/TodzKit/AppModel+SignInLink.swift` | `choosing` is a settled phase |
| `apps/macos/TodzKit/Tests/TodzKitTests/AppModelTests+WorkspaceChoice.swift` | new tests |
| `apps/macos/Todz/Onboarding/WorkspacePickerScreen.swift` | new picker screen |
| `apps/macos/Copy/WorkspacePickerCopy.swift` | new copy |
| `apps/macos/Todz/RootView.swift` | `choosing` case |
| `apps/macos/Todz/MenuBar/MenuBarPopover.swift` | `choosing` prompt |
| `apps/macos/Copy/MenuBarCopy.swift` | `choosing` line |
| `apps/macos/Todz/Settings/SettingsWorkspaceRows.swift` | new Settings rows |
| `apps/macos/Todz/Settings/SettingsView.swift` | one line |

## Failure modes

| Failure | Handling |
|---------|----------|
| The listing fails while signed in | Existing load-failure banner; no picker |
| The remembered workspace was deleted on another device | Not among the listed; the picker shows instead |
| A row is tapped twice | The phase check in `chooseWorkspace` ignores the second tap once the phase is `ready` |
| A tap while a sign-out is pending | The sign-out path is unchanged |
