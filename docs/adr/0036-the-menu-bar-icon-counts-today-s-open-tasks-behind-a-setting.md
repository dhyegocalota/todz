# 0036. The menu bar icon counts Today's open tasks, behind a setting

- Status: Proposed
- Date: 2026-11-24
- Deciders: Claude (the build loop's call, pending the owner); Dhyego Calota (owner) asked for the count and may overturn these calls
- Inspired by: the owner's request of 2026-11-24 ("the menu bar status item must show the number of pending tasks… behind a setting… on by default"), [ADR 0031](0031-the-menu-bar-extra-is-a-swiftui-window-over-the-app-s-one-model.md)

## Context

The owner wants the menu bar item to show how many tasks are pending, with a setting to turn it off, on by default. "Pending", the setting's place and the look at zero were left to the loop.

## Decision

1. The count is the open tasks of Today in the active workspace, overdue included: the number the popover's heading shows as "N left". One definition, so the icon and the popover never disagree.
2. The count sits after the icon in the status item. At zero, while signed out, loading or without a workspace, the item shows the icon only. Above 99 it reads "99+".
3. A SwiftUI `Settings` scene, opened with ⌘, and the app menu's "Settings…", holds one toggle, "Show pending count in the menu bar", on by default, stored as a `UserDefaults` boolean in the app's own container. Off shows the icon only at once.
4. The status item's accessibility label names the count ("todz, 3 left today") when it shows.

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| Today's open tasks (chosen) | Matches the popover and the widgets' ring; a number that shrinks to zero each day | Ignores undated Inbox tasks | Today is what the menu bar is for (product design) |
| Every open task of the workspace | Everything waiting | A large number that never reaches zero; noisy | A count that never clears stops being read |
| Inbox only | The capture list | Not what the popover shows | Two numbers for one item |
| The toggle in the popover's footer | One click away | Crowds the popover; preferences belong in Settings on the Mac | Apple's pattern is ⌘, |
| "0" at zero | Steady width | A zero reads as a badge to clear | Icon only is calmer |

## Consequences

- The app gains a Settings window with one control; later preferences go there.
- The status item's width changes with the count.

## Evidence

The popover's heading already counts `taskViews.today.open` (`MenuBarTodayHeading`), so the label reads the same value from the one model.

## Revisit when

The owner asks for another count, or a second preference arrives.
