# The menu bar item that macOS hides, and deleting a task from the app

**Status:** Shipped 2026-11-27
**Tier:** 🟡
**Owner approval:** approved 2026-11-27 by the owner's words on 0.2.8 build 2544, "por que meu todz não tá aparecendo no menubar?" and "não dá pra excluir tarefa? wtf!!!"; product scope inherited from [docs/product/README.md](../../product/README.md), approved 2026-11-23
**ADRs:** none new; the tombstone of [0102](../../adr/0102-deleting-a-task-leaves-a-scrubbed-tombstone-for-sync-and-a-move-adds-to-the-destination-before-it-deletes-the-source.md) and the ribbon widths of [0071](../../adr/0071-the-menu-bar-ribbon-unfolds-what-is-next-beside-the-glyph-for-a-few-seconds-as-template-frames-behind-a-setting-off-by-default.md) keep their shape
**Not changing:** the status item's drawing, the count, the ribbon's timing and widths, the MCP `delete` tool and its typed confirmation, the delete of a workspace or a project behind its typed name

## Problem

### The status item is not on the menu bar

On the owner's Mac (macOS 26.6.2, one 3440 by 1440 external display, no notch) todz 0.2.8 runs, but its status item is not on the menu bar.

Proven cause: macOS blocks it, not todz.

- The item is created at every launch. The unified log shows `[com.apple.controlcenter:appStatusItems] Host properties initialized; (bid:dev.todz.Todz-Item-0-<pid>). State(applicationItem: true, clientRequestsVisibility: true …)` for the launches at 07:09, 09:52 (the 0.2.8 relaunch), 11:02 and 11:05 on 2026-11-27.
- Within 10 ms of each launch Control Center answers `Moving host to blocked list; (bid:dev.todz.Todz-Item-0-<pid>)` and `Starting to track blocked host`. That is the system's Allow in the Menu Bar list in System Settings › Menu Bar. Windscribe, another of the owner's apps, gets the same answer.
- Accessibility reads the item as 44 by 24 points, labelled "todz, 1 left today", placed at (-1, 1439): parked below the bottom of the screen. Blocked 1Password and Tailscale sit at the same spot. Docker's visible item is at (3119, 3).
- So the notch, the ribbon's width and the lock are not the cause: there is no notch, the item was the compact glyph and count, and the item exists in every phase. The ribbon is already capped at 180 points of text (ADR 0071).

todz cannot remove itself from that list. What it can do is notice and say so: today a blocked todz is silent, and the owner sees no item, no Dock icon in menu-bar-only mode, and no clue.

### A task cannot be deleted in the app

No path deletes a task from the Mac app. This is not a regression: delete never existed there.

- The owner API has no task delete route. `OwnerRoute` lists add, update, complete, reopen and history for a task, nothing else; the only delete is the MCP `delete` tool (ADR 0102), and the parity table records the app action "Delete a task" with no owner route.
- `OwnerService` has no task delete, and `AppModel` has no delete for a task.
- The task list's context menu is empty, and the list swallows ⌫ and ⌦ with `.onKeyPress(keys: [.delete, .deleteForward]) { _ in .handled }` since the first window (beed1310).
- The popover's rows have no context menu and no delete key, and its More menu holds only the app's items.

## Goals

- When macOS keeps todz off the menu bar, todz tells the owner once per launch, with a button that opens System Settings › Menu Bar and a "Don't show this again" choice. It never tells a launch for an intent (ADR 0066), and never when the item is on the bar.
- The owner deletes a task from the window: the row's context menu has **Delete Task…**, the Task menu has **Delete Task…**, and ⌘⌫ on the focused list asks too. The popover's rows have the same context menu item, and ⌘⌫ on a focused row asks too.
- Every path asks once, "Delete Task?", naming the task in the message, with Delete and Cancel. Cancel is the default.
- A delete calls a new owner route, `DELETE /owner/projects/:projectId/tasks/:number`. The task leaves the board, the selection, the cache and the widgets. A task already gone counts as deleted. A locked workspace refuses, as it does for a project.
- The delete leaves the ADR 0102 tombstone, so every other Mac learns it through `deleted_numbers`.

## Non-goals

- Undo and a trash. A delete is final, as ADR 0102 decided.
- Deleting several tasks at once. The list selects one task.
- Plain ⌫ deleting a task. ⌘⌫ is the chord: ⌫ alone stays swallowed so the list never beeps.
- A ⌘⌫ key equivalent on the menu item. It would take ⌘⌫ away from every text field in the window (delete to the start of the line).
- Forcing the status item onto the bar. Only the owner can change the Allow in the Menu Bar list.

## Design

### Data flow

The delete: a row, the Task menu or ⌘⌫ asks for confirmation. Delete calls `AppModel.delete(task:)`, then `OwnerService.deleteTask`, then the route. The route reads the task, deletes it with the title it just read as the confirmation (as the MCP `delete` tool does), and answers 204. The model drops the number from the board, keeps the project cache and clears a selection that pointed at it. Widgets follow the board.

The menu bar notice: when the proactive surfaces start, and again when the app becomes active, the app reads the frame of its status bar window. `MenuBarItemPlacement.isOnTheBar(itemFrame:screenFrames:)` says whether that frame sits in the top band of a screen. If it does not, and the owner has not chosen "Don't show this again", an alert says so once per launch.

### Interfaces

- Owner API: `DELETE /owner/projects/:projectId/tasks/:number`, route `delete_task`. It answers 204 when deleted, 404 `not_found` for a project that is not the owner's, 404 `task_not_found` for a missing or deleted task, and 422 `confirmation_mismatch` when an agent renames the task between the read and the delete. It costs one write of the fair-use quota.
- TodzKit: `OwnerService.deleteTask(session:projectIdentifier:number:)`, `AppModel.delete(task:)`, `WriteTarget.taskRemoval(TaskKey)`, `MenuBarItemPlacement`.
- App: `MainWindowState.deletingTask`, `TaskDeletionDialog`, `MenuBarItemNotice`.

### Failure handling

- Offline: the network banner with Try Again, and the task stays.
- `task_not_found`: the task is gone, so it leaves the board.
- `not_found` for the project: the project-gone reload, as for every task write.
- A rename racing the delete answers 422 with an issue this app does not decode, so the app shows "change not saved" and the task stays.
- A locked workspace: the lock refusal, nothing is sent.

## Open questions → answers

| Question | Options | Owner's answer | Date |
|----------|---------|----------------|------|
| Ask before deleting a task? | Delete at once; a confirmation; a typed title as for projects | The loop's call under the owner's standing instruction: one confirmation with Cancel as the default, because the delete is final and ⌘⌫ is one chord away; a typed title is the agent's guard and too heavy for one task | 2026-11-27 |
| Tell the owner when macOS hides the item? | Nothing; a banner in the window; an alert once per launch | The loop's call: an alert once per launch with "Don't show this again", because a blocked menu-bar-only todz has no window to carry a banner | 2026-11-27 |

## Test strategy summary

Unit tests in TodzKit for the model's delete (sent, removed, selection cleared, already gone, offline, locked, refused) and for the placement rule (the parked frame, a visible frame, a second screen). Worker tests for the route (204, gone from the feed into `deleted_numbers`, 404 for a second delete, for a stranger's project and for a missing number, the route table and the parity table). An offscreen render of the alert. The live walk is skipped: no todz build is ever launched on the owner's screen.
