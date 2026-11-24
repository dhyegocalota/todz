# Design: menu-bar

**Sources:** [the approved product design](../../product/README.md) (macOS app → Menu bar extra: "Today of the active workspace and an 'Add a task' field; ⌘1 to ⌘9 switch workspaces"; Non-goals: agents as live actors), [the Glass mockup](../../product/mockups/glass-screens.html) ("Menu bar and widgets": `.menubar`, `.tray`, `.pop`, `.pop-head`, `.ws-mini`, `.pop .add`, `.pop h3`, `.pop .task`, `.pop .foot`; the widgets there belong to `widgets`), [the shell's design](../mac-app-shell/design.md) (rows, Today, add field, keyboard, contrast), [the sync design](../mac-sync/design.md) (pending rows, the offline item, banners), and the lead's constraints: a SwiftUI `MenuBarExtra` with `.menuBarExtraStyle(.window)` over the one `AppModel`, an icon-only status item, the app stays running when the main window closes, "Open todz" opens or raises the main window.
**Design system:** unchanged from the shell: system materials, semantic colours, text styles and the one accent `#2F5BFF`. No token is added.
**Screenshots:** none taken. Playwright MCP drives a browser and this surface is a native status item and panel; its `chrome-for-testing` browser is also not installed, so even the mockup could not be captured (the fix it prints, `npx @playwright/mcp install-browser chrome-for-testing`, needs the owner's OK per HARNESS 11). The captures this document needs are listed in section 6 under `.pr-media/menu-bar/design/`, taken from the built app by the `recorder`. Until they exist, each option cites the mockup element or the shell element it changes.

## 1. Screens and states

One status item and one popover are added. The main window gains only the ⌘1 to ⌘9 menu items (option O7) and the way it is opened from the popover.

### 1.1 Status item

- An icon only: SF Symbol `checkmark.square` (the mockup's `.tray`: a check in a rounded square), template-rendered so the menu bar tints it for light, dark and a highlighted (open) item. No count, no title, no badge, no state change when offline.
- Clicking it opens the popover; clicking it again, clicking elsewhere or Escape (§ 5) closes it.
- It is shown in every phase, signed out included, for as long as the app runs. Closing the main window keeps the app and the item; ⌘Q quits both.

### 1.2 Popover layout

Width 360 (the mockup's `.pop`), one named constant; the height follows the content up to a maximum (option O4). The panel is the system's `.window` menu bar extra material; nothing is drawn behind it.

Top to bottom, in the ready phase:

| Region | Content | Mockup |
|---|---|---|
| Header | leading: the workspace switcher (option O6); trailing: `MenuBarCopy.openWindow`, a borderless button in `.secondary` | `.pop-head`, `.ws-mini` |
| Banner | the model's one banner, when raised, through the shell's `ErrorBanner` (§ 1.5) | none |
| Add field | the shell's `AddTaskField`, adding to the Inbox due today (option O1); a rule issue shows inline under it in red, as in the main window | `.pop .add` |
| Section heading | `MainWindowCopy.today` and, trailing in `.secondary`, `MenuBarCopy.left(count:)` with the open count | `.pop h3` |
| Rows | open tasks in Today's order (overdue first, then by due date, then manual order), then pending adds, then the tasks done today, newest first (option O3); they scroll past the maximum height (option O4) | `.pop .task` |
| Foot | leading: the offline item when offline, otherwise `MenuBarCopy.doneToday(count:)` when at least one task is done today; trailing: `MenuBarCopy.switchHint(last:)` with two or more workspaces | `.pop .foot` |

Header, field and foot stay pinned; only the rows scroll. There is no narrow layout: the popover has one width. Long workspace names truncate at the tail in the header with the full name as help text; titles take up to two lines and sub-lines truncate, as in the main window.

### 1.3 States by phase

| Phase or case | What the popover shows |
|---|---|
| `loading`, no cache | a centred column: the shell's `ProgressView` with `MainWindowCopy.loading`; no header, field or foot |
| `loading`, the launch failed (the model's banner is set) | the centred column with the shell's `FailureView` for that banner (`ErrorCopy.networkTitle`, `networkBody`, Try Again) |
| `loading` with a cache | never seen: the cached workspace shows at once, as in the main window (mac-sync § 1.2) |
| `signedOut`, no notice | a centred column: `MenuBarCopy.signedOut`, then `MenuBarCopy.openWindow` as the default, prominent button (option O8) |
| `signedOut` with a notice | the same, with the notice's own copy (`SignInCopy.sessionEnded`, `sessionUnreadable`, `sessionEndedWaiting(count:)`) in place of `MenuBarCopy.signedOut` |
| `naming` | the centred column: `MenuBarCopy.naming`, then `MenuBarCopy.openWindow` as the default button (option O8) |
| `ready`, the active workspace's first load | header and field as in § 1.2; in place of the rows, the shell's small `ProgressView` with `MainWindowCopy.loading`; no section heading, no foot count |
| `ready`, nothing loaded (`loadFailure` is `.network` or `.someProjectsFailed`) | header; no field (the main window hides it on a failed list too); the `FailureView` for that failure with Try Again in place of the rows |
| `ready`, Today empty, nothing done today | header, field, then `MainWindowCopy.todayEmptyTitle` in `.secondary` with `MainWindowCopy.todayEmptyBody` under it in `.subheadline`; no section heading, no foot count |
| `ready`, nothing open, some done today | the section heading with `MenuBarCopy.left(count: 0)`, then the done rows; foot count shown |
| `ready`, open and done today | the full layout of § 1.2 (the mockup) |
| `ready`, many tasks | the rows scroll inside the maximum height (option O4); the heading count and the foot count always state the totals |
| `ready`, pending adds | the shell's `PendingTaskRow` for each, after the confirmed open rows (mac-sync O4 = A): `circle.dashed`, no id, not clickable, help `TaskRowCopy.pendingHelp`; it becomes a normal row in place on confirmation. It counts in `left` once confirmed, not before, as the main window's badge |
| `ready`, offline with a cache | the cached rows; the foot's leading slot shows the offline item (`SyncCopy.offline` or `SyncCopy.offlineWaiting(count:)`, `wifi.slash`), which refreshes on click, as in the toolbar |
| `ready`, offline, no cache for the workspace | header; the `FailureView` with `ErrorCopy.networkTitle` and Try Again |
| `ready`, a refused change, cache not saved, or waiting changes lost | the banner region shows the same `AppBanner` as the main window (§ 1.5) |
| One workspace | the header shows its name as plain text, no menu; no switch hint in the foot (option O6) |
| Two to nine workspaces | the header switcher is a menu; ⌘1 to ⌘N, N the count; the foot reads `switchHint(last: N)` |
| More than nine | ⌘1 to ⌘9 reach the first nine in the switcher's order; the tenth on are reached through the menu only; the foot reads `switchHint(last: 9)` (option O6) |
| The day changes while open | Today recomputes from `model.today`, as the main window does; no special state |

### 1.4 Rows

- The shell's `TaskRow` unchanged, with the item `.today` (option O10): checkbox, title, the sub-line (project tag, the due label only when it is not today, "via {client}" from the task's creator), the trailing `T-{number}`. "via Claude Code" is a label from the creator, never a live actor.
- Done-today rows: the done checkbox in the accent, the title `.secondary` with strikethrough, as the main window's Done Today. The checkbox reopens (option O3).
- Checking a row: the checkbox fills at once, the row lingers for the shell's completion linger, then moves into the done group with the system animation. Reopening a done row moves it back into the open group the same way. A second click during the linger undoes it, as in the main window.
- Clicking anywhere on a row but its checkbox opens the main window on Today with that task selected and the inspector shown, then closes the popover (option O2). Hover tints the row with `.fill.quaternary`.

### 1.5 Banners in the popover

The popover shows `model.banner` through the shell's `ErrorBanner`, under the header, because a task added from the popover with the main window closed can be refused with nobody watching the window. It is the one banner of the model: Dismiss or Try Again in either surface acts on both. A load failure already shown as `FailureView` in place of the rows is not shown again as a banner, as in the main window.

### 1.6 Opening the main window

`MenuBarCopy.openWindow` (and ⌘0, § 5) opens the main window if it is closed or raises it if it is behind, activates the app, and closes the popover. It keeps whatever the main window was showing; only a row click (option O2) changes the window's view. With the Dock icon (option O9), clicking the Dock icon with no window open also reopens it.

## 2. Components

| Component | Folder | Change |
|---|---|---|
| `MenuBarPopover` (new) | `MenuBar` | the panel's root: switches on `model.phase` as `RootView` does, and lays out § 1.2 |
| `MenuBarHeader` (new) | `MenuBar` | the switcher or the plain name, and the Open todz button |
| `MenuBarTodayRows` (new) | `MenuBar` | the scrolling rows: `TaskRow`, `PendingTaskRow`, the done rows, the row click |
| `MenuBarFoot` (new) | `MenuBar` | the done count or the offline item, and the switch hint |
| `MenuBarCopy` (new) | `Copy` | section 8 |
| `TodzApp` | app | adds the `MenuBarExtra` scene with `MainWindowCopy.windowTitle` as its title and the status symbol; injects the same `model` and `windowState` |
| `WorkspaceSwitcher` | `MainWindow/Sidebar` → `Shared` | reused in the popover header; ⌘1 to ⌘9 live in the View menu only, so the switcher's items carry no key (the review found two registrations, ADR 0031); the popover drops New Workspace and Sign Out (those stay in the main window) |
| `AddTaskField` | `MainWindow/TaskList` → `Shared` | reused with a Today destination that does not read `selectedItem`: the Inbox, due today; its focus binding generalises beyond `MainWindowFocus` |
| `TaskRow`, `TaskRowSubline`, `TaskRowTitle`, `PendingTaskRow`, `DueLabel` | `MainWindow/TaskList` | reused unchanged with the item `.today` |
| `TaskCheckbox` | `Shared` | reused; the linger it starts is computed for `.today`, not for the main window's `selectedItem`, so checking in the popover never depends on what the window shows |
| `SyncStatusItem` | `MainWindow/TaskList` → `Shared` | reused in the foot |
| `ErrorBanner`, `FailureView`, `BannerActionButton` | `MainWindow/TaskList`, `Shared` | reused unchanged |
| `AppCommands` | app | the ⌘1 to ⌘9 items (option O7) |

Two facts for the plan, not design choices: the launch must not depend on the main window's `RootView.task`, since the popover can be the only surface; and macOS 14 has no public SwiftUI call that closes a `.window` menu bar extra, which § 1.4, § 1.6 and § 5 need, so its mechanism is the plan's first unproven assumption.

System components only: `MenuBarExtra`, `ScrollView`, `Menu`, `Picker`, `Button`, `Label`, `ProgressView`, `ContentUnavailableView`, `Image(systemName:)`, `openWindow`.

## 3. Tokens

All from the shell's § 3; nothing new.

| Use | Token |
|---|---|
| Popover background | the system menu bar extra window material |
| Status item symbol | template rendering, the menu bar's own tint |
| Add field fill, row hover, banner fill | `.fill.quaternary` |
| Checked checkbox, default button (signed out, naming) | `Color.accentColor` = `#2F5BFF` |
| Switcher, row titles, section heading | `.primary` |
| Open todz, heading count, foot, sub-lines, ids, empty body | `.secondary` |
| Done row title | `.secondary` with strikethrough |
| Overdue label, inline rule issue | `Color.red` |
| Section heading | the system `List` section header style, as `TaskSectionHeader` |
| Row title, field | `Font.body` |
| Sub-line, foot, empty body | `Font.subheadline` |
| Width 360, maximum height (O4) | named constants beside the scene, like the window's default size; spacing, radius and row height stay system defaults |

The mockup's accent square before the workspace name (`.ws-mini b`) is not drawn: the model has no workspace colour, as the shell dropped project dots.

## 4. Copy

New strings are in section 8. Reused unchanged: `MainWindowCopy.windowTitle` (the status item's title and accessibility label), `MainWindowCopy.today`, `MainWindowCopy.addPlaceholder`, `MainWindowCopy.loading`, `MainWindowCopy.todayEmptyTitle`, `MainWindowCopy.todayEmptyBody`, `MainWindowCopy.markDone`, `MainWindowCopy.markNotDone`, `MainWindowCopy.tryAgain`, `MainWindowCopy.dismiss`, `TaskRowCopy` (due labels, via, short id, pending), `SyncCopy.offline`, `SyncCopy.offlineWaiting(count:)`, `SyncCopy.offlineHelp`, every `ErrorCopy` banner and rule issue, `SignInCopy.sessionEnded`, `sessionUnreadable`, `sessionEndedWaiting(count:)`, `AccessibilityCopy.switcher(name:)`, `checkboxOpen`, `checkboxDone`, `rowValueOpen`, `rowValueDone`. Counts are numbers formatted by the system (`count.formatted()`); "left" and "done today" need no inflection.

## 5. Interaction and accessibility

**Focus when the popover opens** (option O5): the add field, so a click on the icon and typing adds a task. VoiceOver focus lands on the field too.

**Keyboard**

| Keys | Where | Does |
|---|---|---|
| Return | add field | adds the task, clears the field, keeps focus; the popover stays open for the next one; a blank field does nothing |
| Escape | add field with text | clears the field and its rule issue; focus stays |
| Escape | add field empty, or anywhere else | closes the popover |
| ⌘1 to ⌘9 | popover (and the main window, option O7) | switches to that workspace in both surfaces; a number beyond the count does nothing, no beep; the popover stays open, the field clears (it belongs to its destination, as in the main window) and keeps focus |
| ⌘N | popover | focuses the add field |
| ⌘0 | popover | Open todz (Mail's key for its main window) |
| ⌘R | popover | Refresh, as in the main window |
| Tab, ⇧Tab | popover | switcher → Open todz → banner button → add field → each row (its checkbox, then the row) → the offline item; rows are reached with Full Keyboard Access |
| Space | a focused checkbox | toggles done |
| Return, Space | a focused row | opens it in the main window (option O2) |
| ↑ ↓ | popover | nothing: the popover has no list selection |
| ⌘Q | anywhere | quits the app |

There is no global shortcut to open the popover in v1 (minor call). While the popover is key, ⌘N and ⌘1 to ⌘9 must reach the popover's own handlers and never the main window's (⌘N there changes the window's view); the plan proves which handler receives the key.

**VoiceOver**
- Status item: label `MainWindowCopy.windowTitle`, the button trait.
- Switcher: `AccessibilityCopy.switcher(name:)` with the menu trait; one workspace: the name as static text.
- Section heading: "Today, 5 left" (the heading and `MenuBarCopy.left(count:)` read as one element).
- Row: the shell's one element (label the title, value the state then the sub-line, actions Mark as Done or Mark as Not Done), plus the hint `AccessibilityCopy.rowOpensWindow`; its default action opens the main window.
- Pending row, offline item, banner: as in mac-sync and the shell, including the one offline announcement and the banner announcement.
- The switch hint is read as text.

**Motion:** the system popover appearance, the shell's linger and the system insert, move and remove animations when a row moves between the open and done groups. Reduce Motion: rows move at once, no fade, as in the main window.

**Contrast:** the popover material sits over the desktop, so its background varies; the system material keeps `.primary` and `.secondary` legible on it, and Increase Contrast and Reduce Transparency make it opaque. `.secondary` is about 4:1, the system's own; nothing is set in `.tertiary`, though the mockup's foot uses its faintest colour (`--faint`). Overdue carries the word "Overdue"; offline carries the word "Offline"; the done state is the filled check, not the strikethrough alone.

## 6. Options

Captures to take from the built app, light and dark, on the default desktop picture, into `.pr-media/menu-bar/design/`: `status-item.png` (closed and highlighted), `popover-ready.png` (open and done today, the mockup's case), `popover-empty.png`, `popover-all-done.png`, `popover-many.png` (scrolled to the done group), `popover-pending.png`, `popover-offline.png`, `popover-first-load.png`, `popover-load-failed.png`, `popover-launch-failed.png`, `popover-signed-out.png`, `popover-session-ended.png`, `popover-naming.png`, `popover-one-workspace.png`, `popover-switcher-open.png`, `popover-ten-workspaces.png` (the menu open, ⌘ on the first nine), `popover-banner.png`, `popover-rule-issue.png`, `main-window-from-row.png` (after a row click), and one annotated copy per option (`o1-…png` to `o10-…png`). Once the browser is installed, `mockup-popover.png` from the mockup's "Menu bar and widgets" block at 1280.

**O1. Where "Add a task" puts the task** (mockup: `.pop .add`; shell: the Today view adds to the Inbox due today)
- A. The Inbox, due today. The task appears at once in the list under the field; same rule as the main window's Today, so one destination to learn.
- B. The Inbox, no due date. Pure capture, but the task leaves the popover as it is added, which reads as lost.
- C. The project selected in the main window. Ties the popover to the window's selection, which the popover otherwise ignores, and a closed window has a stale one.
- **Recommendation: A.**

**O2. What clicking a row does**
- A. Opens the main window on Today with that task selected and the inspector shown, then closes the popover. The popover is a glance; detail lives in the inspector.
- B. Nothing; only the checkbox acts. Safe, but a dead click on the largest target.
- C. Expands the row in place with its notes. A second inspector in 360 points, with editing rules to repeat.
- **Recommendation: A.** It is the one place where the popover changes the main window's view.

**O3. Rows done today** (mockup: one `.task.done` after the open rows, and "3 done today" in `.pop .foot`)
- A. After the open rows, no group header, the checkbox reopens them; the foot carries the count. The mockup, and a mis-click stays undoable after the linger.
- B. The same rows read-only. Avoids reopening by accident, but a checkbox that looks live and does nothing.
- C. Hidden; the foot count only. The shortest list, but a task checked by mistake disappears from the popover.
- **Recommendation: A.**

**O4. Many tasks and the maximum height** (mockup: six rows, the popover about 440 high)
- A. The rows scroll between the pinned header, field and foot; the popover grows with its content up to 520 points, about eight rows with sub-lines, which fits under the menu bar on the smallest display macOS 14 supports. Everything stays reachable.
- B. A cap of eight open rows and a `{count} more` row that opens the main window on Today. Predictable height, but the done group and the overflow need the window, and one more string.
- C. Grow to the screen's visible height. No scroll, but a popover taller than the screen's half for a busy day.
- **Recommendation: A.**

**O5. Focus when the popover opens** (mockup: `.pop .add` carries a `⌘N` key hint)
- A. The add field. Click, type, Return; the hint becomes redundant and is dropped, as the shell's field dropped it.
- B. Nothing; ⌘N focuses the field, and the hint stays. Faithful to the mockup, one more key for the most common action.
- C. The first row. Useful only with a list selection the popover does not have.
- **Recommendation: A**, with ⌘N still focusing the field.

**O6. The header switcher with one workspace, and beyond nine** (mockup: `.ws-mini` "todz ⌄" and "Switch workspace ⌘1–9")
- A. One workspace: its name as plain text, no chevron, no hint. Two or more: the menu with ⌘1 to ⌘N on its first nine items, the hint naming the real last number. Beyond nine: the rest in the menu without a shortcut, in the switcher's order. Nothing shows that does nothing.
- B. Always the menu and the fixed "⌘1–9" hint. Faithful to the mockup; a menu of one and a hint that promises eight dead keys.
- C. Beyond nine, the nine most recently used get the shortcuts. Faster for the busy ones, but a key's workspace moves under the owner's fingers.
- **Recommendation: A.**

**O7. ⌘1 to ⌘9 outside the popover** (shell § 5: "⌘1–⌘9 stay free for the menu bar extra")
- A. The popover only. Exactly the product line; the main window keeps its switcher menu.
- B. The popover and the main window: the View menu lists the first nine workspaces with ⌘1 to ⌘9, and the main window's switcher shows the same keys. One set of keys for one shared active workspace, discoverable in the menu bar.
- **Recommendation: B.**

**O8. Signed out and naming the first workspace in the popover**
- A. One line and Open todz; the forms stay in the main window. One sign-in path, no second set of states.
- B. The sign-in field and the name field inside the popover. Never leaves the popover, but duplicates every error state of both screens in 360 points.
- **Recommendation: A.**

**O9. The Dock icon when the main window is closed**
- A. Always a regular app with its Dock icon; the popover needs no Quit item. ⌘Tab and the Dock reopen the window.
- B. A menu bar–only app (no Dock icon) while the main window is closed, a Dock icon while it is open. Quieter, but the app vanishes from ⌘Tab, and the popover needs a Quit item and copy.
- C. A setting. A preference screen the app does not have.
- **Recommendation: A.**

**O10. The row in the popover** (mockup: `.pop .task` shows no project tag and no id)
- A. The shell's `TaskRow` unchanged: project tag, due label, via, `T-{number}`. One row component; Today mixes projects and the id is what the owner tells an agent.
- B. A compact variant without tag and id. Closer to the mockup and more room for the title, but a second row to keep in step, and "T-12" without its project is ambiguous.
- **Recommendation: A.**

**Minor calls made by the loop** (reversible; listed for the owner)

| Call | Choice |
|---|---|
| Status symbol | `checkmark.square`; `checklist` reads less like the mockup's `.tray` |
| Width | 360, the mockup's |
| Workspace colour square | not drawn: the model has no workspace colour |
| Popover after Return | stays open with the field focused |
| Escape with text | clears first; a second Escape closes |
| Field after ⌘1 to ⌘9 | cleared, as the main window's field when its destination changes |
| Open todz | ⌘0, and it keeps the window's current view |
| Global shortcut to open the popover | none in v1 |
| Launch at login | none in v1 |
| Switcher items in the popover | workspaces only; New Workspace and Sign Out stay in the main window |

## 7. Owner decisions

The owner asked the build loop to take every call (2026-11-24, "take every decision and do not stop, I review later"). Each answer below is the loop's call, listed in the loop's questions for the owner, who may overturn it in review.

| Option | Answer | Date |
|---|---|---|
| O1 | A: the Inbox, due today | 2026-11-24 |
| O2 | A: opens the main window on Today with the task selected and the inspector shown, then closes the popover | 2026-11-24 |
| O3 | A: done-today rows after the open rows, reopenable, the count in the foot | 2026-11-24 |
| O4 | A: rows scroll between the pinned header, field and foot; at most 520 points high, 360 wide | 2026-11-24 |
| O5 | A: the add field takes focus on open; ⌘N still focuses it | 2026-11-24 |
| O6 | A: one workspace shows its name as plain text and no hint; the menu and ⌘1 to ⌘N from two | 2026-11-24 |
| O7 | B: ⌘1 to ⌘9 also in the main window's View menu; the spec's non-goal is amended | 2026-11-24 |
| O8 | A: one line and Open todz | 2026-11-24 |
| O9 | A: always a Dock icon, no Quit item | 2026-11-24 |
| O10 | A: the shell's `TaskRow` unchanged | 2026-11-24 |
| Minor calls | as listed in § 6 | 2026-11-24 |

## 8. Every new copy string

**MenuBarCopy** (new): openWindow "Open todz" · left "{count} left" · doneToday "{count} done today" · switchHint "Switch workspace ⌘1–{last}" · signedOut "Sign in to see what's due today." · naming "Name your first workspace to see what's due today."

**AccessibilityCopy:** rowOpensWindow "Shows it in the todz window."
