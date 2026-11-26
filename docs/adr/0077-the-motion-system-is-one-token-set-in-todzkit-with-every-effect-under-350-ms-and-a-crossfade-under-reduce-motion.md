# 0077. The motion system is one token set in TodzKit, with every effect under 350 ms and a crossfade under Reduce Motion

- Status: Accepted
- Date: 2026-11-26
- Deciders: Claude (the build loop's call, pending the owner); Dhyego Calota (owner) asked for the cinematic moment with the brand, "quero finalizar ainda hoje nas próximas horas … workspace select … e aquele 'tchã' cinematográfico de motion e animation … não faça verificações demais", 2026-11-26
- Inspired by: [ADR 0031](0031-the-menu-bar-extra-is-a-swiftui-window-over-the-app-s-one-model.md) (the menu bar extra is a SwiftUI window), [ADR 0071](0071-the-menu-bar-ribbon-unfolds-what-is-next-beside-the-glyph-for-a-few-seconds-as-template-frames-behind-a-setting-off-by-default.md) (a motion budget counted in seconds, held in TodzKit so tests can read it)

## Context

The app has motion in three places, each with its own numbers: the ribbon's fold in `RibbonMotion`, the day temperature and the morning glance's dwell. The owner wants a consistent cinematic feel: a task check that draws in with a mint burst, a new task that springs in, a count that rolls, a popover that blooms, a brand reveal on sign-in, entrances for the day close and the morning glance, and content transitions in the widgets. Apple's own apps keep such motion quiet: short, springy and never blocking. Every one of these must also respect Reduce Motion.

## Decision

1. One token set, `MotionToken` in TodzKit, shared by the app and the widget extension: `snap`, `settle`, `bloom`, `reveal`, `draw`, `sparkle` and `crossfade`. Each has a curve (a spring with a response and damping, or an ease-out) and a duration in milliseconds. The SwiftUI `Animation` is read from the token in TodzKit, so no view picks its own numbers.
2. Every effect lasts at most `MotionTiming.ceilingMilliseconds`, 350 ms. This is a token rule: a unit test fails when a token's duration is above it, so a new token cannot exceed it without the test and this ADR changing.
3. Reduce Motion is decided by `MotionRule.token(_:isReduceMotionOn:)` in TodzKit: with Reduce Motion on, every token becomes `crossfade`, so no spring, scale or offset plays. The view modifiers read `accessibilityReduceMotion` and pass it through this rule; no view checks the setting itself.
4. The modifiers live in TodzKit (`TodzMotion.swift`): `todzAnimation(_:value:)`, `todzCountTransition()`, `todzBloom(trigger:)`, `todzEntrance()` and `todzInsertion()`. The app and the widgets use the same modifiers. The popover's bloom rests fully visible and dims only while it enters (`MotionBloom`).
5. The task completion burst is six mint dots at `#8CF7D0`, the logo's sparkle colour, and it appears only in the app's task list, never in the widgets. The mint is the only new colour.
6. The menu bar count does not roll. The `MenuBarExtra` label is a status-item title and image, and ADR 0065's spike found the status item drops SwiftUI animation, so the count changes at once. The roll is listed for a later version; the widgets keep their content transitions.

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| Per-view `.animation(.spring(...))` literals | Quick to write | Numbers drift across views, no ceiling can be tested, the widgets cannot share them | The owner asked for a consistent system |
| Lottie or a bundled animation library | Rich motion | A dependency, large assets, no Reduce Motion story in the widgets | Not needed for six moments; the shapes are native |
| Skip Reduce Motion for short effects | Less code | Violates the owner's rule and the system setting | Every effect respects it, through one rule |
| Longer, more cinematic effects (about 600 ms) | More drama | Slow for a to-do list used many times a day | The owner asked for quiet, never slow |

## Consequences

- Each new animated surface picks a token; a new timing is a new token and passes the ceiling test.
- Under Reduce Motion the app still changes what it shows, through a crossfade, so no information is lost.
- The widgets keep their content transitions, now through the shared `todzCountTransition` modifier, so Reduce Motion crossfades them too. They play only when the system animates a widget, so they cost nothing on the timeline.
- Supersedes nothing; the ribbon's own fold timing stays in `RibbonMotion` (ADR 0071) because its tests pin it.

## Evidence

Unit tests in `MotionTokenTests` (the ceiling, the spring settling within each token's duration, the Reduce Motion rule, the crossfade) and `MotionBloomTests` (the popover's resting state), written red first; the visual moments are walked by hand, listed in `docs/features/motion/test-plan.md`.

## Revisit when

- A moment needs more than 350 ms to read, for example a first-run reveal the owner asks to be longer.
- The widgets report that content transitions cost a timeline reload.
