# Settings layout plan

Tier 🟡. One branch, `fix/settings-layout`, one PR.

## Steps

1. **Red.** Failing tests first: `UsageSharingPromptTests` (default, escape, button order and index) and the project-count tests in `AppModelTests+WorkspaceChoice.swift`. Commit `0ae87337`, red by a compile failure.
2. **TodzKit.** `UsageSharingPrompt` and `UsageSharingAnswer`; `Workspace.namedProjectCount` becomes `projectCount` and counts every project.
3. **Usage prompt.** `AppDelegate+UsageSharing.swift` adds the buttons from the helper's order, marks the escape answer with the escape key, and maps the response index through the helper. `UsageSharingCopy.title(of:)` gives the button text.
4. **Settings layout.** `SettingsView` becomes one `Form` of six sections with headers. `SettingsRow` puts each title and detail beside a top-aligned control. `SettingsWorkspaceShortcuts` uses the same row. `TodzApp` gives the scene a 520 by 640 default, a 460 by 420 minimum, and resizability.
5. **Server field.** The row layout shows the field under a "Server address" label, so it no longer reads as a stray grey pill.
6. **Evidence.** Debug build captures in `apps/docs/images/settings-layout/`, added to the tour's Settings section.
7. **Gate.** `swift test` for TodzKit, the Debug `xcodebuild`, `/verify`.

## Files

- `apps/macos/TodzKit/Sources/TodzKit/UsageSharingPrompt.swift` (new)
- `apps/macos/TodzKit/Sources/TodzKit/OwnerModels.swift`
- `apps/macos/Todz/AppDelegate+UsageSharing.swift`
- `apps/macos/Copy/UsageSharingCopy.swift`, `apps/macos/Copy/SettingsCopy.swift`
- `apps/macos/Todz/Settings/SettingsView.swift`, `SettingsRow.swift` (new), `SettingsWorkspaceShortcuts.swift`
- `apps/macos/Todz/Server/ServerAddressForm.swift`
- `apps/macos/Todz/Shared/WorkspaceSummary.swift`, `apps/macos/Todz/TodzApp.swift`
- `apps/docs/tour.mdx`, `apps/docs/images/settings-layout/`, `docs/adr/0092-*.md`, `docs/features/README.md`

## Findings below IMPORTANT (v1.1)

- The light captures were taken with a temporary, uncommitted in-process appearance override; the committed code has none.
- The Settings scene does not fit on one screen at its default height. Scrolling is kept; the grouping is what the owner asked for.
