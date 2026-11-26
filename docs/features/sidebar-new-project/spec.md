# Sidebar new project

**Status:** In review
**Tier:** 🟢
**Owner approval:** approved 2026-11-26 by the owner's words to the loop ("new project também ficou difícil de enxergar… ajusta com cautela, com frontend-designer, de forma sexy"), inheriting the product scope of [docs/product/README.md](../../product/README.md) (approved 2026-11-23); the option is the loop's pick in [design.md](design.md) § 9
**ADRs:** none
**Not changing:** File ▸ New Project… and its ⇧⌘N, the New Project sheet, the workspace switcher and New Workspace…, the project rows and their context menu, the multi-workspace tags, the count badges, Connect an Agent, `AccentColor`

## Problem

The sidebar's only New Project affordance is a `plus` in the Projects header at `.opacity(0)` until the pointer hovers the header (`ProjectsHeader`). At rest the sidebar offers no way to create a project, and when the glyph shows it is the header's small grey mark.

## Change

Option C of [design.md](design.md):

1. A `NewProjectButton` stacked under the list in a `VStack(spacing: 0)`, so it never covers a row; the `WorkspaceSwitcher` stays an inset above it.
2. A borderless `Label`: `plus.circle.fill` in `Color.accentColor`, the text "New Project" in `.secondary` at rest and `.primary` on hover, animated by `todzAnimation(.snap, value:)` so Reduce Motion crossfades.
3. Full-width `.contentShape(.rect)`, `.padding()` as the switcher, no background.
4. `.help` and `.accessibilityHint` read "Adds a project to {workspace name}".
5. Disabled when `!model.isReady`, as the menu item.
6. `ProjectsHeader.swift` is deleted; the Projects section header is plain `Text(MainWindowCopy.projects)`.
7. Copy: `MainWindowCopy.newProjectButton` = "New Project" and `MainWindowCopy.newProjectHelp(workspaceName:)`; `AccessibilityCopy.addProject` is removed, unused.
8. ⇧⌘N stays File ▸ New Project… only; the button repeats no shortcut.

## Test list

- `tools/repository-shape/src/sidebar-new-project.test.ts`: the copy values, the stacked button in `SidebarView`, no `ProjectsHeader` anywhere, the sheet, help and hint in `NewProjectButton` with no `.opacity(`, the ⇧⌘N binding pinned in `AppCommands`.
- `swift test` and the Debug `xcodebuild` green.
- In-process renders of the sidebar in light and dark, one workspace and several, attached to the PR.
