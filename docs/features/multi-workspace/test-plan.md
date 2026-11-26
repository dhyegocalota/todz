# Multi workspace test plan

## Unit (TodzKit, `swift test --package-path apps/macos/TodzKit`)

- [ ] `WorkspaceSelectionTests`: chosen shows its workspaces in listing order; All includes a workspace added later; a chosen set does not; toggling adds, removes, turns All into the others and keeps the last one; the selection survives encoding.
- [ ] `WorkspaceSelectionTests`: an old cache reads its active workspace as the selection; a stored selection wins.
- [ ] `AppModelTests+MultiWorkspace`: All shows Today and Inbox of both workspaces in workspace order, tagged; a single selection tags nothing; the menu bar count is the union; every project is pulled and watched.
- [ ] `AppModelTests+MultiWorkspace`: the selection is cached and restored; a single selection writes the old cache shape; `switchWorkspace` after All selects exactly one.
- [ ] `WidgetSnapshotTests`: an old snapshot decodes with no workspace; a union snapshot tags each row.
- [ ] `WidgetToggleTests` and `AppModelTests+MultiWorkspace`: a tick carries its row's workspace; it completes in the task's own project; a tick naming another workspace, an unshown workspace or an unknown task is refused.
- [ ] Every test of the single-workspace behaviour stays green.

## User-visible walk (tester, by hand, Debug app against a local `wrangler dev`)

- [ ] The workspace menu lists All Workspaces and one toggle per workspace; choosing All shows the union with workspace tags in Today, Inbox and Upcoming; relaunching keeps the choice.
- [ ] Ticking a task of the second workspace in a widget completes it there.
