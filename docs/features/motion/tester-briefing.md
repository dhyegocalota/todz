# Tester briefing: Motion

Written by the developer when its steps are done. The developer does not run `test-plan.md` and does not declare the feature works.

## What changed

- `apps/macos/TodzKit/Sources/TodzKit/MotionToken.swift` — the seven tokens (`snap`, `settle`, `bloom`, `reveal`, `draw`, `sparkle`, `crossfade`) with their durations and curves, and the 350 ms ceiling.
- `apps/macos/TodzKit/Sources/TodzKit/MotionRule.swift` — Reduce Motion turns every token into `crossfade`.
- `apps/macos/TodzKit/Sources/TodzKit/MotionToken+Animation.swift`, `TodzMotion.swift` — the SwiftUI animations and the modifiers `todzAnimation`, `todzCountTransition`, `todzBloom`, `todzEntrance`, `todzInsertion`. Shared with the widgets.
- `apps/macos/Todz/Shared/TaskCheckbox.swift`, `CheckmarkMark.swift`, `SparkleBurst.swift` — the check is a trimmed path drawn over an accent disc on completion; six mint dots burst once. Undo clears at once.
- `apps/macos/Todz/MainWindow/TaskList/TaskRows.swift` — rows spring in when the shown tasks change.
- `apps/macos/Todz/MenuBar/MenuBarLabel.swift` — the text count rolls. The image count does not (see gaps).
- `apps/macos/Todz/MenuBar/MenuBarPopover.swift` — the popover blooms on each show.
- `apps/macos/Todz/RootView.swift` — the screen change on sign-in is a reveal.
- `apps/macos/Todz/MorningGlance/MorningGlanceView.swift`, `apps/macos/Todz/MenuBar/MenuBarDayCloseActions.swift` — entrances.
- `apps/macos/TodzWidgets/Views/TodayRing.swift`, `NextUpView.swift` — count transitions through the shared modifier.
- ADR 0077, `docs/features/motion/`.

No new dependency. No font, colour or layout change except the mint burst and the checkbox disc, which is 14 pt (the checkbox used the same SF Symbol size before).

## How to run

Debug app against a local `wrangler dev` Worker, as in `docs/features/menu-bar-only/tester-briefing.md`. Use a scratch build with its own defaults domain. Do not run against production.

## Red and green

| Test | Red (before the implementation) | Green |
|------|---------------------------------|-------|
| `MotionTokenTests` (6 tests) | `Fatal error: MotionToken.curve is not implemented`, `Fatal error: MotionRule.token is not implemented`, `Fatal error: MotionToken.durationMilliseconds is not implemented` | 6 passed |
| `swift test --package-path apps/macos/TodzKit` (full) | not run red | 1307 tests in 103 suites passed |
| `xcodegen` and `xcodebuild` Debug | not applicable | BUILD SUCCEEDED, no warnings in the touched files |

## Hypotheses to attack

- Completing a task with the space key or the checkbox plays the draw and the burst once; undo clears without a burst.
- A rapid complete then undo then complete does not leave a stuck burst (the burst is keyed to the done state, reset on undo).
- Adding a task (a new row in the open section) springs in; a moved row does not spring in again on every reorder beyond the settle.
- The popover bloom replays on each open and does not break the focus on the add field.
- With Reduce Motion on, no row scales, no burst appears and the count changes by crossfade.
- The day temperature image count is unchanged: no roll, same text.
- The widgets show the same numbers; no layout shift.

## Known gaps

- Sidebar matched geometry is not shipped (see `spec.md`).
- The image-drawn count does not roll.
- The sign-in reveal fades the screen; the logo has no own reveal.
- The GIF for the PR and the README is recorded later.
