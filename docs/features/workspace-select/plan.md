# Workspace select plan

- [ ] Red 1: `AppModelTests+WorkspaceChoice.swift` tests and the `choosing` phase and `chooseWorkspace` stubs; run the Swift filter and record the red text.
- [ ] Green 1: `openListedWorkspaces` enters `choosing` for two or more workspaces with no remembered one; `chooseWorkspace(identifier:)` activates; the switch sites handle `choosing`.
- [ ] Red 2: widget snapshot and shortcut readiness tests for `choosing`, committed alone before their implementation.
- [ ] Green 2: `WorkspacePickerScreen`, its copy file and the RootView case.
- [ ] Settings: `SettingsWorkspaceRows` in its own file and one line in `SettingsView`.
- [ ] Menu bar popover prompt for `choosing` in `MenuBarCopy`.
- [ ] Docs: `docs/features/README.md` row, package README purpose check, `tester-briefing.md`.
- [ ] `pnpm verify` foreground, then the `macos` gate's xcodegen and xcodebuild.
- [ ] Push with `gh-as-owner.sh`.

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
| A row is tapped twice | The switch guard ignores the same identifier |
| A tap while a sign-out is pending | The sign-out path is unchanged |
