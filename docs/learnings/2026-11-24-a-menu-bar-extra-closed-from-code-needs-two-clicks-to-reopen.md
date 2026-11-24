# A menu bar extra closed from code needs two clicks to reopen, and its walk pops over the owner's screen

- Date: 2026-11-24
- Inspired by: [ADR 0031](../adr/0031-the-menu-bar-extra-is-a-swiftui-window-over-the-app-s-one-model.md), the `menu-bar` developer's check and tester passes 1 and 2 ([test plan](../features/menu-bar/test-plan.md))

## Signal

After the popover of a SwiftUI `MenuBarExtra(.window)` is closed from code with its `NSWindow.close()`, the next click on the status item does nothing and only a second click opens it. Separately, a walk that opens the popover in a loop puts it in front of whatever the owner is doing, and he notices.

## Cause

The status item keeps its own open state. Closing the panel directly leaves that state at "open", so the next click toggles it to "closed". The panel is a floating window at layer 101: System Events can open it while another app keeps the focus, but nothing can show it without drawing it on screen.

## Do

- Close the panel from code by clicking the status item's own button, guarded by the panel being visible (`MenuBarPanel.swift`). Close it before opening the main window, so the window's activation does not race the close.
- Read the panel's open signal from its `didBecomeKey`, not from `onAppear`: SwiftUI can keep the content alive across openings.
- Walk the popover in a few short openings and close it after each read. Ask the owner before a long pass when he is at the Mac.
- To shoot the light appearance while the Mac is dark, launch the app with `-NSRequiresAquaSystemAppearance YES`; no system setting changes.
- Run `swift test` directly, not from a `zsh` script: from a script the XCTest runner started as x86_64 and exited 1 with every test passing.

## Anchor

`apps/macos/Todz/MenuBar/MenuBarPanel.swift`; commits `78814c1`, `aea915b`; `.pr-media/menu-bar/p2-cycles-window-closed.log` (the only misses left are the cycles that create the main window).
