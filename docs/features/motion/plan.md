# Plan: Motion

**Spec:** spec.md
**Tier:** 🟡
**Seam:** `MotionToken`, `MotionRule` and the modifiers are pure or presentation-only TodzKit code; the app and the widgets only call the modifiers.
**Assumptions (decided, owner can override):**
- Native shapes and SF Symbols, no animation dependency.
- The count drawn as an image keeps its instant swap.
- Target macOS 14: `symbolEffect(.bounce)`, `numericText`, `phaseAnimator` are available; `drawOn` is not, so the check is a trimmed path.

## File map

| Group | Paths owned | Developer sub-agent |
|-------|-------------|---------------------|
| G1 | `apps/macos/TodzKit/Sources/TodzKit/MotionToken.swift`, `MotionToken+Animation.swift`, `MotionRule.swift`, `TodzMotion.swift`, `apps/macos/TodzKit/Tests/TodzKitTests/MotionTokenTests.swift` | `developer` |
| G2 | `apps/macos/Todz/Shared/TaskCheckbox.swift`, `apps/macos/Todz/Shared/CheckmarkDraw.swift`, `apps/macos/Todz/Shared/SparkleBurst.swift`, `apps/macos/Todz/MainWindow/TaskList/TaskRows.swift`, `apps/macos/Todz/MenuBar/MenuBarLabel.swift`, `apps/macos/Todz/MenuBar/MenuBarPopover.swift`, `apps/macos/Todz/RootView.swift`, `apps/macos/Todz/MorningGlance/MorningGlanceView.swift`, `apps/macos/Todz/MenuBar/MenuBarDayCloseActions.swift` | `developer` |
| G3 | `apps/macos/TodzWidgets/Views/TodayRing.swift`, `apps/macos/TodzWidgets/Views/NextUpView.swift` | `developer` |
| G4 | `docs/adr/0077-*.md`, `docs/features/motion/*`, `docs/features/README.md`, `apps/macos/README.md` | `developer` |

## Sequencing

G1 first (the tokens the others call). G2 and G3 after G1. G4 last.

## Steps

### G1

- [ ] **Step 1:** red: `MotionTokenTests` (every token under the ceiling, the Reduce Motion rule for each token, the crossfade's curve), against stubs that stop on `MotionToken.durationMilliseconds is not implemented` and `MotionRule.token is not implemented`.
- [ ] **Step 2:** green: the token enum, the ceiling, the rule, `animation`, and the modifiers in `TodzMotion.swift`.

### G2

- [ ] **Step 3:** the check draws in and the mint sparkle burst on completion in `TaskCheckbox`.
- [ ] **Step 4:** a new task springs in: task rows insert with the `settle` token in `TaskRows`.
- [ ] **Step 5:** the menu bar count rolls (`todzCountTransition`) in the text branch of `MenuBarLabel`.
- [ ] **Step 6:** the popover blooms on each show in `MenuBarPopover`, with `todzBloom`.
- [ ] **Step 7:** sign-in success reveals the main window in `RootView` with `todzAnimation(.reveal)`.
- [ ] **Step 8:** the morning glance and the day close enter with `todzEntrance`.

### G3

- [ ] **Step 9:** the widgets' counts use `todzCountTransition` in `TodayRing` and `NextUpView`.

### G4

- [ ] **Step 10:** ADR 0077, the feature index row, `apps/macos/README.md`, tester briefing, and the walk checkboxes in `test-plan.md`.
- [ ] **Step 11:** xcodegen, Debug build, `swift test --package-path apps/macos/TodzKit`, `pnpm verify`.

## Failure modes

| Failure | Guard |
|---------|-------|
| A token creeps above 350 ms | `MotionTokenTests` ceiling test |
| Reduce Motion ignored by one view | Every view uses a modifier; the rule test covers the mapping |
| The burst replays on undo | The burst is keyed to completion only; undo resets without animation |
| The count roll flickers the menu bar | Text branch only; the image branch is unchanged |
