# 0104. Forms share one drawn field language on native buttons and a glass panel

- Status: Accepted
- Date: 2026-11-26
- Deciders: Dhyego Calota (owner); Claude (advisor, the loop's call under the owner's instruction to decide every call)
- Inspired by: [0077](0077-the-motion-system-is-one-token-set-in-todzkit-with-every-effect-under-350-ms-and-a-crossfade-under-reduce-motion.md), [0092](0092-settings-is-one-scrolling-form-of-sections-with-a-resizable-window-and-usage-sharing-asks-with-not-now-as-the-default.md), [the ui-polish-forms design](../features/ui-polish-forms/design.md)

## Context

The owner asked for the UI to look better, forms included. Every form drew its own field, error and busy state, an invalid field was not marked, and the app had no spacing or radius tokens.

## Decision

1. Fields are drawn: `FormField` and `FieldChrome` render a text field's surface and ring from one pure `FieldState` (busy, disabled, invalid, focused, rest, in that precedence) kept in TodzKit so it is unit tested.
2. Buttons stay native: `.borderedProminent`, `.bordered` and `.link` through one `FormButton`, whose busy state keeps the button's place.
3. The three centred screens sit in one glass panel (`FormPanel`); a sheet never does, because the system already draws sheets in glass.
4. `FormMetrics` holds four values: field corner radius 8, panel corner radius 18, field padding 10 by 7 and ring widths 1 and 2, each scaled with text where it is a padding, plus one point under Increase Contrast.
5. If a glass pair fails contrast, that screen's panel was to use `.regularMaterial`; no colour is hand-picked. Measured, the material is worse on every pair (see the design's § 9), so the panel stays glass and the one failing pair, system red on light, is left to the system.
6. The sign-in label is the placeholder with the label spoken, the primary button fills the panel, the confirmation dialogs stay system dialogs, and Settings keeps the sections of 0092.
7. A write refused with `cloud_at_capacity` is a pause, not a refusal: the queue stays and sending waits, as for a daily cap.

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| Native fields only | Smallest | An invalid field stays unmarked | The main gap today |
| Full Liquid Glass | Most striking on macOS 26 | Two looks to test, morph timing above the 350 ms ceiling | Breaks 0077 |
| Replace the confirmation dialogs with sheets | One look | Loses the system alert behaviour | Already correct |

## Consequences

- Every form surface reads the same, and a future form adopts the components instead of drawing its own.
- Four metrics now exist in one enum; any other spacing stays the system's.
- The drawn ring is the focus indicator, so it must match the system's under Increase Contrast and Full Keyboard Access.

## Evidence

- `FieldStateTests` pin the precedence; the offscreen renders in the pull request show every state.

## Revisit when

macOS 26 glass controls reach the deployment target, or a glass pair fails contrast on a captured background.
