# Multi workspace plan

**Spec:** spec.md
**Tier:** 🟡
**Seam:** `AppModel.shownWorkspaces` replaces "the active workspace's projects" wherever the model reads projects; `activeWorkspaceIdentifier` stays as the primary.
**Assumptions (decided by the loop):**
- Adds that name no project go to the primary workspace's Inbox.
- The first-run picker is unchanged.

- [x] Red: `WorkspaceSelectionTests`, `AppModelTests+MultiWorkspace`, snapshot and toggle tests, with neutral stubs. Done at 9b177fe3.
- [x] Green 1: `WorkspaceSelection`, `OwnerCache.selection`, `show` and the selection API, `TaskViews` union with tags, pulls and watches over every shown project, the menu bar count.
- [x] Green 2: snapshot workspace fields, `WidgetRequest.workspaceIdentifier`, tick routing.
- [x] Green 3: popover, day close, morning glance, ribbon and shortcuts read the shown set.
- [x] UI: the workspace menu as toggles with All Workspaces, the row tag, the sidebar projects, the open counts.
- [x] `swift test`, the Debug build and `pnpm verify` in the foreground.

## File map

| Path | Change |
|------|--------|
| `apps/macos/TodzKit/Sources/TodzKit/WorkspaceSelection.swift` | new |
| `apps/macos/TodzKit/Sources/TodzKit/OwnerCache.swift` | optional selection |
| `apps/macos/TodzKit/Sources/TodzKit/AppModel*.swift` | shown workspaces, selection API, pulls, watches, widgets, cache |
| `apps/macos/TodzKit/Sources/TodzKit/TaskViews.swift`, `BoardTask.swift` | union inbox, workspace tag |
| `apps/macos/TodzKit/Sources/TodzKit/Widget*.swift` | workspace fields, request routing |
| `apps/macos/Todz/**`, `apps/macos/Copy/MainWindowCopy.swift` | switcher, tags, sidebar, counts |

## Failure modes

| Failure | Signal | Back out |
|---------|--------|----------|
| A stale snapshot's rows have no workspace | A tick on such a row asks nothing until the app rewrites the snapshot | Launch the app |
| A selection names a deleted workspace | Shown set is empty | Falls back to the sole workspace or the picker |
| Many projects open many sockets | More watches | Choose fewer workspaces |
