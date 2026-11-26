# Test plan: Sidebar overlap

## The failing test first

- [ ] `sidebar-overlap.test.ts` — input: `SidebarView.swift`; expected: a `VStack(spacing: 0)` holding `WorkspaceSwitcher(workspace: workspace, isMainWindow: true)`, `list` and `NewProjectButton(workspace: workspace)` in that order
- [ ] `sidebar-overlap.test.ts` — input: `SidebarView.swift`; expected: no `.safeAreaInset(`
- [ ] Confirmed it fails for the right reason: the red run printed the failure text recorded here

## Renders

- [ ] The sidebar with 15 projects scrolled to the top, the middle and the end, light and dark: the workspace name's rows contain no ink of a project row
