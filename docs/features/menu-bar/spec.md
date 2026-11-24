# Menu bar

**Status:** Approved
**Tier:** 🟡
**Owner approval:** approved 2026-11-24, by inheritance from [the v1 product design](../../product/README.md) (Order of delivery, item 7; macOS app → Menu bar extra; the approved mockup's popover in [`glass-screens.html`](../../product/mockups/glass-screens.html)), approved by the owner on 2026-11-23; the calls below that the product design does not make are an ADR or design decisions marked as the loop's calls and listed in the loop's questions for the owner
**ADRs:** [0026](../../adr/0026-a-native-app-is-walked-with-computer-use-and-recorded-from-its-screenshots.md), [0027](../../adr/0027-the-app-caches-each-owner-s-data-as-json-files-in-its-own-container-until-it-has-a-team.md), [0028](../../adr/0028-the-app-s-task-writes-are-optimistic-and-go-through-a-persisted-outbox.md), [0030](../../adr/0030-product-screenshots-live-in-docs-screenshots-and-the-readme-walks-them.md), [0031](../../adr/0031-the-menu-bar-extra-is-a-swiftui-window-over-the-app-s-one-model.md)
**Not changing:** `apps/api`, `libs/core`, `libs/types`, the owner API contract, the cache, the outbox and the sockets. No widgets, no App Group, no login item, no "Connect an agent". The main window's screens are unchanged except that closing it no longer quits the app.

## Problem

The owner sees and adds today's tasks only through the main window. The product design asks for a menu bar extra: Today of the active workspace at a glance, an "Add a task" field, and ⌘1 to ⌘9 to switch workspaces, without bringing the main window forward.

## Goals

- A status item in the menu bar, an icon only, that opens a popover (ADR 0031).
- The popover shows the active workspace's Today as the main window computes it: open tasks due today or overdue across the workspace's projects, then "Done today", with the pending adds of the outbox.
- A checkbox completes an open task and reopens a done-today task, through the outbox, exactly as the main window's checkbox does.
- "Add a task" adds a task to the workspace's Inbox, due today, through the outbox, exactly as the main window's Today view does; the field keeps focus for the next one.
- ⌘1 to ⌘9 switch to the first nine workspaces in the switcher's order; the popover and the main window follow the same active workspace.
- "Open todz" opens or raises the main window and activates the app; a task row opens the main window on Today with that task selected.
- Every phase of the model has a popover state: signed out, loading, naming the first workspace, ready, offline, and a workspace whose projects failed to load ([`design.md`](design.md)).
- The app keeps running in the menu bar when the main window closes.
- The root README gains the popover's screenshot in its gallery (ADR 0030).

## Non-goals

- Editing a title, notes or a due date, reordering, or deleting from the popover.
- Upcoming, Done, the Inbox or a project's list in the popover.
- Launch at login, or the menu bar extra while the app is quit.
- A count or a badge on the status item.
- ⌘1 to ⌘9 in the main window.

## Design

Screens, states and copy: [`design.md`](design.md).

### Data flow

```
status item click ─▶ MenuBarExtra(.window) ─▶ MenuBarPopover reads the one AppModel (environment)
                                                   │
          phase ─▶ signed out / loading / naming ─▶ a line and "Open todz"
          ready ─▶ model.taskViews.today (open, doneToday) + taskViews.pendingTasks(for: .today)
                                                   │
   checkbox ─▶ model.toggleDone(task:) ─▶ outbox ─▶ screen at once, sent when reachable (ADR 0028)
   Return in "Add a task" ─▶ model.addTaskDestination(for: .today) ─▶ model.addTask(…) ─▶ outbox
   ⌘1…⌘9 ─▶ model.switchWorkspace(number:) ─▶ activate ─▶ main window and popover follow
   row click ─▶ model.reveal(task:) ─▶ openWindow(main) + activate the app
   "Open todz" ─▶ openWindow(main) + activate the app
```

### `TodzKit`

| File | Holds |
|---|---|
| `AddTaskDestination.swift` | moves from the app target unchanged: a project and an optional due date, and its `WriteTarget` |
| `AppModel+Destinations.swift` | `addTaskDestination(for item: SidebarItem) -> AddTaskDestination?`, the rule the main window already uses: the Inbox for Inbox, the Inbox due today for Today, the project for a project, none for Upcoming and Done; `reveal(task:)` selects Today and the task |
| `WorkspaceShortcuts.swift` | `count` (nine) and the workspace a number from 1 to 9 selects, in the switcher's order; any other number selects none |
| `AppModel+Workspaces.swift` | `switchWorkspace(number:)` over `WorkspaceShortcuts`; a number without a workspace does nothing |

### `Todz` (app target)

`TodzApp` declares the `MenuBarExtra` scene with the `.window` style beside the `Window`, both reading the one `AppModel` and `MainWindowState`. The popover's views live in `Todz/MenuBar/`, reuse `TaskCheckbox`, `TaskRowSubline`, `PendingTaskRow` and the sync status where they fit, and take their strings from a new `MenuBarCopy`. The main window's `addTaskDestination` becomes `model.addTaskDestination(for: model.selectedItem)`.

### Failure handling

- **Signed out, loading, naming** → the popover says so and offers "Open todz"; nothing else is clickable.
- **Offline** → the cached Today shows, writes queue in the outbox, and the popover shows the main window's offline line with the count waiting.
- **Every project of the workspace failed to load** → the popover shows the load failure line and "Open todz"; the main window carries the Try Again.
- **A rule refusal on "Add a task"** (an empty or too long title) → the field shows the same inline issue as the main window's add field and keeps the text.
- **⌘ with a number that has no workspace** → nothing happens.
- **A workspace switch while the popover is open** → the popover shows the new workspace's Today, or its first-load state until its projects load.
- **The model signs out or the session ends while the popover is open** → the popover shows the signed-out state.
- **Logs:** nothing; the popover logs no task content.

## Open questions → answers

| Question | Options | Owner's answer | Date |
|----------|---------|----------------|------|
| How is the menu bar extra built, and does it share the app's state? | SwiftUI `MenuBarExtra(.window)` over the one model / `NSStatusItem` + `NSPopover` / `.menu` style / a login-item helper | Loop's call: `MenuBarExtra(.window)` over the one `AppModel` ([ADR 0031](../../adr/0031-the-menu-bar-extra-is-a-swiftui-window-over-the-app-s-one-model.md)); listed for the owner | 2026-11-24 |
| Where does a task added from the popover go? | the Inbox, due today / the Inbox, no date / the selected project | Loop's call: the Inbox, due today, as the main window's Today view, so the new task appears in the list right under the field; listed for the owner | 2026-11-24 |
| What does closing the main window do? | keep running in the menu bar / quit | Loop's call: keep running; ⌘Q quits ([ADR 0031](../../adr/0031-the-menu-bar-extra-is-a-swiftui-window-over-the-app-s-one-model.md)); listed for the owner | 2026-11-24 |
| The design's open choices | see [`design.md`](design.md) | Loop's calls: the designer's recommendations, recorded in `design.md` § 7; listed for the owner | 2026-11-24 |

## Rollback

Nothing is deployed and nothing is stored by this feature. Reverting the merge removes the status item and restores quitting on the main window's close; the cache and outbox are untouched.

## Test strategy summary

Swift Testing in `TodzKit`: `WorkspaceShortcuts` for 1, 9, 0, 10 and fewer workspaces than the number; `switchWorkspace(number:)` switching the active workspace and pulling its projects, and doing nothing for a missing number; `addTaskDestination(for:)` for every sidebar item, with and without an Inbox; `reveal(task:)`. The tester walks the built app with Orca against `wrangler dev` (ADR 0026, ADR 0031 § 5): every popover state, adding, completing and reopening from the popover and seeing it in the main window, ⌘1 to ⌘9, offline, an agent's add through MCP appearing in the popover, and closing the main window.
