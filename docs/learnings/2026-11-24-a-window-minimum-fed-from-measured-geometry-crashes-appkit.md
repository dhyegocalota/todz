# A SwiftUI window crashes with EXC_BREAKPOINT when an inspector opens, or clips its sidebar at the minimum size
- Date: 2026-11-24
- Inspired by: `mac-app-shell` tester pass 2 (the crash after `d80830f`), fix `44e110b`

## Signal
The app stops with `EXC_BREAKPOINT (SIGTRAP)`, an `NSException` from `-[NSWindow(NSDisplayCycle) _postWindowNeedsUpdateConstraints]` under `NSHostingView.invalidateSafeAreaCornerInsets`, when a column such as the inspector is shown in a window narrower than the new minimum. Or, with a fixed `frame(minWidth:)` on the `NavigationSplitView`, the window shrinks below what the columns need, and the sidebar's content is cut off on its leading edge.

## Cause
`.windowResizability(.contentMinSize)` turns the root view's minimum into the window's minimum constraint. A minimum computed from `onGeometryChange` values (safe-area insets, a column's width) changes again during the layout pass that the first change started, and AppKit traps on the nested constraint update. Separately, `.frame(minWidth:)` does not add to a child's minimum: it replaces it, so a number lower than what the split view needs lets the window cut into the columns. On macOS 26 the split view also counts the floating sidebar twice (once as its column, once as the detail's leading safe-area inset), so a `frame(minWidth:)` on the detail inflates the minimum.

## Do
Never feed a window minimum from measured geometry. Leave the split view its own minimum, and add a floor as a sibling in a `ZStack` (a `Color.clear` with `frame(minWidth:)`): a `ZStack` reports the largest of its children, so the floor only ever raises the minimum. The floor may depend on state that changes from a user action (`isInspectorPresented`), never on a size.

## Anchor
- `apps/macos/Todz/MainWindow/MainWindow.swift`
- `d80830f` (the geometry-fed minimum), `44e110b` (the floor)
- `docs/features/mac-app-shell/tester-briefing.md` § Fix round 2
