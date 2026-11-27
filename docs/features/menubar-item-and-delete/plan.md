# Plan: the menu bar item that macOS hides, and deleting a task from the app

Lighter gates for an urgent 🟡 fix: no plan review; reviewer findings below IMPORTANT land here.

- [ ] Prove the causes on the owner's Mac by reading only: the unified log of Control Center's `appStatusItems`, the item's frame through accessibility, the display list and the container's defaults; never the running app's windows, never its popover
- [ ] Red tests, committed alone: the owner route table and the parity row name `delete_task`; the Worker deletes a task through the owner route; `AppModel.delete(task:)`; `MenuBarItemPlacement`
- [ ] The Worker: `OwnerRoute.DeleteTask` on `DELETE …/tasks/:number`, a `deleteTask` handler that reads the task and deletes it under one fair-use write, and the parity row
- [ ] TodzKit: `OwnerService.deleteTask`, `OwnerAPI`, `WriteTarget.taskRemoval`, `AppModel.delete(task:)`, `MenuBarItemPlacement`
- [ ] The app: the task deletion dialog in the window, **Delete Task…** in the row's context menu and the Task menu, ⌘⌫ on the focused list; the popover row's context menu and ⌘⌫; `MenuBarItemNotice` at the start of the proactive surfaces and on activation
- [ ] An offscreen render of the notice's alert, light and dark
- [ ] `swift test`, the Debug app build, `pnpm --filter @todz/api test:unit`, `pnpm --filter @todz/repository-shape test`, `pnpm typecheck`, PR

## Failure modes

| Step | What breaks | Signal | Back out |
|------|-------------|--------|----------|
| ⌘⌫ as a menu key equivalent | Every text field loses delete-to-line-start | ⌘⌫ in the add field deletes the selected task instead of the text | The menu item carries no key equivalent; ⌘⌫ is a key press on the focused list or row |
| The placement rule reads a visible item as hidden | The alert shows on every launch for an owner whose item is on the bar | The alert appears with the item visible | "Don't show this again" silences it; revert the notice commit |
| A second display below the main one | The parked frame lands on that display's top edge and reads as on the bar | No alert on a blocked Mac with that arrangement | Accepted: a missed notice, never a false one |
| The delete races an agent's rename | 422 `confirmation_mismatch`, which the app cannot decode | "Change not saved" and the task stays | Delete again |
| A deleted task's queued edit | The outbox sends an update for a task that is gone | 404 `task_not_found` drops the change as refused (ADR 0028) | None needed |
