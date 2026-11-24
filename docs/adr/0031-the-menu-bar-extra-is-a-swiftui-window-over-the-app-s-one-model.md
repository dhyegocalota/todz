# 0031. The menu bar extra is a SwiftUI window over the app's one model

- Status: Proposed
- Date: 2026-11-24
- Deciders: Claude (the build loop's call, pending the owner); Dhyego Calota (owner) may overturn it
- Inspired by: [the v1 product design](../product/README.md) (macOS app → Menu bar extra; the approved mockup's popover), [ADR 0026](0026-a-native-app-is-walked-with-computer-use-and-recorded-from-its-screenshots.md), [ADR 0027](0027-the-app-caches-each-owner-s-data-as-json-files-in-its-own-container-until-it-has-a-team.md), the `menu-bar` spike of 2026-11-24

## Context

The product design asks for a menu bar extra that shows Today of the active workspace, an "Add a task" field and ⌘1 to ⌘9 to switch workspaces, drawn in the mockup as a popover under a status item. The app already has one `AppModel` that holds the session, the cache, the outbox and the sockets (ADR 0027 to 0029). A second copy of that state would send the outbox twice, open every socket twice and race on the cache files. There is still no signing team, so nothing can share an App Group with a second process. The walk tool of ADR 0026 lists only a process's ordinary windows and cannot open menus in the background.

## Decision

1. The menu bar extra is a SwiftUI `MenuBarExtra` scene with the `.window` style, declared in `TodzApp` beside the main `Window`, and reads the same `AppModel` instance through the environment. The popover and the main window always show the same active workspace: switching in one switches the other.
2. The status item is an icon only. The app keeps its Dock icon and keeps running when the main window closes; "Open todz" in the popover opens or raises the main window and activates the app.
3. The model launches once per process, whichever surface asks first: the main window's root view, the popover and the status item's label all start it, and every call after the first returns at once. The popover can be the only surface open, so no single view owns the launch.
4. Everything the popover decides that is not layout lives in `TodzKit` with unit tests: the workspace a ⌘-digit selects, the destination of a task added from the popover, and what revealing a task in the main window selects.
5. Walks open the popover with System Events (`click menu bar item 1 of menu bar 2` of the `Todz` process), then read, drive and screenshot it with Orca's `--window-id` of the popover's window (layer 101), which `list-windows` does not show but the window list of CoreGraphics does. No `--restore-window` is needed.

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| SwiftUI `MenuBarExtra`, `.window` style, one model (chosen) | One process, one outbox, one set of sockets; the views reuse the main window's components; no AppKit glue | No control over the panel's arrow or its exact placement; the popover's lifetime is SwiftUI's | — |
| AppKit `NSStatusItem` with an `NSPopover` hosting SwiftUI | Full control of the panel, an arrow like the mockup | AppKit glue the project has none of yet; focus and closing rules by hand | More code for a look the system style already gives |
| `MenuBarExtra` with the `.menu` style | Native menu, keyboard for free | A menu cannot hold a text field that stays open or rows with checkboxes and sublines | The product asks for an "Add a task" field |
| A separate login-item helper with its own model | Runs when the app is quit | Two processes sync the same cache and outbox; needs an App Group and so a team | No team, and a second sync engine is the bug factory ADR 0028 avoids |

## Consequences

- The menu bar extra lives while the app runs. Quitting todz removes it; launching at login is not part of v1.
- Closing the main window no longer quits the app. ⌘Q still does. A Dock click with no window open reopens it. Both go through an `NSApplicationDelegateAdaptor`.
- macOS 14 has no SwiftUI call that closes a `.window` menu bar extra or says it opened, so a small `NSViewRepresentable` reads the panel's `NSWindow`: its `didBecomeKey` focuses the field. Closing it from code (a row click, "Open todz", ⌘0, the second Escape) clicks the status item's own button: a plain `close()` of the panel left the status item thinking it was open, so the next click did nothing (developer's check of 2026-11-24). This is the only AppKit in the app.
- ⌘1 to ⌘9 are registered once, in the View menu; the popover and the main window both receive them while either is key.
- When a team exists and the widgets move the cache to the App Group, the popover is unchanged: it reads the model, not the files.

## Evidence

The spike of 2026-11-24 built a `MenuBarExtra(.window)` app with `swiftc`, opened its popover with `osascript` System Events while another app kept the focus, found its window at layer 101 with `CGWindowListCopyWindowInfo`, and read its tree and a screenshot with `orca computer get-app-state --window-id`.

## Revisit when

- The owner wants todz in the menu bar while the app is quit (a login item, which needs a team).
- The popover's look needs an arrow or a placement the `.window` style cannot give.
