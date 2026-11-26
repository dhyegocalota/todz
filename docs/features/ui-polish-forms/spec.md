# One form language across the Mac app

**Status:** Approved
**Tier:** 🟡 (a new shared set of form views and one pure rule in TodzKit, one outbox refusal, no schema)
**Owner approval:** inherited from [`docs/product/README.md`](../../product/README.md), approved 2026-11-23; the owner's request of 2026-11-26, "faz a UI ficar sexy, até mesmo os forms", and the decisions of [design § 9](design.md#9-owner-decisions), made by the loop
**ADRs:** [0104](../../adr/0104-forms-share-one-drawn-field-language-on-native-buttons-and-a-glass-panel.md)
**Not changing:** the confirmation dialogs, the Settings sections, the rules behind every field (name, email, identity, server address), the typed-name rule, the menu bar popover

## Problem

Every form in the Mac app draws its own field, its own error line and its own busy state. An invalid field is not marked, an error is red text with no symbol, a busy button is replaced by a spinner so the layout jumps, the two primary actions of the first-run flow look different, and the Server field is as plain as a toggle.

## Goals

- One field look (`FormField`, `FieldChrome`) drawn from one pure `FieldState` in TodzKit, with a visible invalid ring.
- One validation line (`ValidationLine`): a symbol, the text, announced to VoiceOver once.
- One button (`FormButton`) whose busy state keeps its place.
- A glass panel (`FormPanel`) for the three centred screens: sign-in, first workspace, workspace picker.
- Migrated, in order: the name sheet, the first workspace and picker screens, the typed-name confirmation, sign-in, the Server field, Settings, Connect an Agent.
- The sign-in screen says, quietly, that free todz cloud spots are extremely limited and that the owner can run their own server, linking the self-host guide.
- A write refused with `cloud_at_capacity` keeps the queue and pauses sending, as a daily cap does, and shows the server's message.

## Non-goals

- Replacing the confirmation dialogs, regrouping Settings, a custom font, a colour, a new motion token.
- Full Liquid Glass buttons and fields ([design § 6, O1 C](design.md#o1-how-far-the-new-look-goes)).

## Design

[design.md](design.md) is the design of record: inventory, components, tokens, states, copy, accessibility and build order. Its § 9 holds the decisions.

### Interfaces

- `FieldState.of(isFocused:hasIssue:isDisabled:isBusy:)` in TodzKit; precedence busy, disabled, invalid, focused, rest.
- `FormMetrics`, `FieldChrome`, `FormField`, `ValidationLine`, `FormButton`, `GlassSurface`, `FormPanel` in `apps/macos/Todz/Shared/`.
- `OwnerErrorCode.cloudAtCapacity` decodes to `OwnerAPIError.fairUsePaused`, so `SendOutcome.paused` keeps the queue.

### Failure handling

- A refused request that is not the text's fault leaves the field at rest and shows the line.
- The glass panel falls back to `.regularMaterial` before macOS 26 and under Reduce Transparency, through the system.
- A pause from `cloud_at_capacity` lifts on the next refresh, like the daily cap; the server answers it without work.

## Open questions → answers

| Question | Options | Owner's answer | Date |
|----------|---------|----------------|------|
| D1 how far the new look goes | native, native plus glass panel and drawn fields, full Liquid Glass | Native plus glass panel and drawn fields | 2026-11-26 (the loop's call) |
| D2 the four form metrics | as proposed, other | As proposed in design § 3 | 2026-11-26 (the loop's call) |
| D3 a glass pair fails contrast | material, other | `.regularMaterial` for that screen | 2026-11-26 (the loop's call) |
| D4 label, width, dialogs, grouping | design's recommendations | A, A, A, the sections already shipped | 2026-11-26 (the loop's call) |

## Test strategy summary

TodzKit: `FieldState`'s sixteen combinations and its precedence, red first; the `cloud_at_capacity` decode and the paused outbox. The views have no logic beyond that and are rendered offscreen, light and dark, for the PR.
