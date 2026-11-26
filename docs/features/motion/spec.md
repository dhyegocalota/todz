# Motion

**Status:** Building
**Tier:** 🟡 (one shared token set in TodzKit and modifiers on existing views; no server, no schema, no new entitlement)
**Owner approval:** approved 2026-11-26 by the owner's request to the loop: "aquele 'tchã' cinematográfico de motion e animation … não faça verificações demais, só faz tudo logo, rápido com qualidade", recorded in `todz-loop/PROMPT.md` "Tonight's last three", item 3.
**ADRs:** [0077](../../adr/0077-the-motion-system-is-one-token-set-in-todzkit-with-every-effect-under-350-ms-and-a-crossfade-under-reduce-motion.md)
**Not changing:** fonts, colours (apart from the mint sparkle), layout, the Settings rows, the sync, the server, the widgets' content and the ribbon's fold timing (ADR 0071)

## Problem

The app's motion is ad hoc: some views animate with literal numbers, many do not animate at all, and the widgets never do. The owner wants one cinematic, quiet motion system, with a few signature moments, that respects Reduce Motion.

## Goals

- One token set in TodzKit, shared by the app and the widget extension: `MotionToken`, with a curve and a duration per token.
- Every effect under 350 ms, enforced by a unit test on the token set.
- Reduce Motion everywhere: each token becomes a crossfade.
- Signature moments:
  - Completing a task: the check draws in and a mint sparkle burst plays once, in the task list.
  - Adding a task: its row springs in.
  - The menu bar count rolls when it changes (SwiftUI text only).
  - The popover opens with a glass bloom.
  - Sign-in success: the signed-in window replaces the sign-in screen with a short reveal.
  - The day close and the morning glance enter with a bloom.
  - The widgets' counts use a content transition.
  - List and sidebar: the sidebar item's title matches the list header's, so the header lands from the sidebar. (see known gaps: sidebar matched geometry)

## Non-goals

- A Lottie or other animation dependency; the shapes are native.
- Motion in Settings rows (another lane touches them).
- Changing the ribbon's fold, the day temperature or any existing timing that a test pins.

## Design

### Data flow

`MotionToken` (TodzKit) → `Animation` (TodzKit) → modifiers (`TodzMotion.swift`, TodzKit) → views in the app and the widgets. `MotionRule.token(_:isReduceMotionOn:)` maps a requested token to a crossfade when Reduce Motion is on; the modifiers read `accessibilityReduceMotion` and pass it through.

### Interfaces

- `MotionToken`: `snap`, `settle`, `bloom`, `reveal`, `draw`, `sparkle`, `crossfade`; `durationMilliseconds`, `curve`, `animation`.
- `MotionTiming.ceilingMilliseconds`: 350.
- `MotionRule.token(_:isReduceMotionOn:)`.
- View modifiers: `todzAnimation(_:value:)`, `todzCountTransition()`, `todzBloom(trigger:)`, `todzEntrance()`.
- App: `CheckmarkDraw` and `SparkleBurst` next to `TaskCheckbox`.

### Failure handling

- No state is stored; the motion is presentation only, so a missed animation changes nothing for the owner.
- Reduce Motion never removes information: it crossfades the same change.
- The count that is drawn as an image cannot roll; it keeps its instant swap, and the count's text and accessibility label are unchanged.

## Open questions → answers

| Question | Options | Owner's answer | Date |
|----------|---------|----------------|------|
| Use Lottie or native shapes | Lottie, native | Owner did not choose; native, the loop's call (ADR 0077) | 2026-11-26 |
| Menu bar count roll on the image branch | Roll the image, keep the instant swap | Keep the instant swap: an NSImage cannot take a SwiftUI content transition | 2026-11-26 |

## Known gaps

- The menu bar count drawn as an image (day temperature on) does not roll. Only the text count rolls.
- The sign-in success reveal crossfades the whole screen (`AppPhase` change); the brand logo itself does not get its own reveal.
- The check is a trimmed path drawn over an accent disc (`SF Symbols` `drawOn` needs macOS 15, and the target is 14), so the done glyph is drawn, not the system's `checkmark.circle.fill`.
- Reduce Motion is verified through the unit rule and a manual toggle; the GIF recorder runs later.

## Test strategy summary

Unit tests on `MotionToken`: every token under the ceiling, the Reduce Motion rule for every token in both states, the crossfade's curve. Red first. The visual moments are hand walks, one checkbox each in `test-plan.md`, with a GIF recorded later for the PR and the README.
