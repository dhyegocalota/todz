# The menu bar shows the pending count

**Status:** In review
**Tier:** 🟡
**Owner approval:** approved 2026-11-24: the owner asked for it ("extremely important": the menu bar icon shows the number of pending tasks, behind a setting he can turn off, on by default), relayed by the session that ran his checklists. What counts, where the setting lives and the look at zero are [ADR 0036](../../adr/0036-the-menu-bar-icon-counts-today-s-open-tasks-behind-a-setting.md), the loop's call, listed in the loop's questions for the owner
**ADRs:** [0036](../../adr/0036-the-menu-bar-icon-counts-today-s-open-tasks-behind-a-setting.md), [0031](../../adr/0031-the-menu-bar-extra-is-a-swiftui-window-over-the-app-s-one-model.md)
**Not changing:** the popover, the widgets, the main window's sidebar counts, the server

## Problem

The menu bar icon says nothing until it is clicked. The owner wants to see at a glance how many tasks are still waiting.

## Goals

- The menu bar status item shows the number of Today's open tasks of the active workspace next to the icon, the same number as the popover's "N left".
- At zero, and before the owner is signed in with a loaded workspace, the item shows the icon only.
- A Settings window (⌘,) holds one toggle, "Show pending count in the menu bar", on by default; turning it off shows the icon only at once, and the choice survives a relaunch.

## Non-goals

- Counting other views (Inbox, Upcoming) or other workspaces.
- A Dock badge or notifications.
- Any other setting.

## Design

### Data flow

`MenuBarLabel` already reads the app's one model. It derives the count from the same Today view the popover uses (`taskViews.today.open.count`), so the outbox's optimistic writes and the pulls move both together. The toggle is a `UserDefaults` boolean read through `@AppStorage` in the label and in the Settings view; its key and its default live in one place.

### Interfaces

- `MenuBarBadge` (TodzKit): from an open count and the toggle, the text to show or none: `nil` when off or at zero, the number up to 99, and "99+" above.
- `MenuBarLabel`: the icon, then the badge text when there is one; its accessibility label names the count ("todz, 3 left today").
- `SettingsView` in a SwiftUI `Settings` scene: the toggle, copy in a `*Copy.swift` file.

### Failure handling

- Signed out, loading or no workspace: no count, icon only.
- Offline: the count follows the cached Today, as the popover does.

## Open questions → answers

| Question | Options | Owner's answer | Date |
|----------|---------|----------------|------|
| What does "pending" count? | Today's open tasks of the active workspace / every open task of the workspace / Inbox | Loop's call (ADR 0036): Today's open tasks, overdue included, the popover's "N left" | 2026-11-24 |
| Where does the setting live? | A Settings window / the popover's footer / a View menu item | Loop's call (ADR 0036): a Settings window, the Mac's place for preferences | 2026-11-24 |
| What shows at zero? | Icon only / "0" / a check | Loop's call (ADR 0036): icon only | 2026-11-24 |

## Test strategy summary

Unit tests for `MenuBarBadge` (off, zero, one, 99, 100, a negative count refused), red first. A build. A walk: with two open tasks due today the status item reads the icon and "2"; completing one makes it "1"; completing the last leaves the icon only; the toggle off leaves the icon only, and back on shows the number again; a relaunch keeps the choice. A light screenshot of the menu bar item for the README.
