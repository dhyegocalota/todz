# Lock single workspace

**Status:** In review
**Tier:** 🔴 (a privacy guarantee: every path that widens the selection is a bypass; TodzKit and the Mac app only, no server, no schema, no deploy)
**Owner approval:** the owner's report of 2026-11-27: "quando eu lock workspaces, ainda posso ter múltiplos selecionados e selecionar múltiplos; corrige aí". The reading below is the loop's call (ADR 0122).
**ADRs:** [0122](../../adr/0122-one-rule-in-todzkit-decides-the-selection-a-locked-session-shows-and-every-path-that-widens-it-asks-the-mac-owner.md) (builds on [0110](../../adr/0110-the-workspace-lock-hides-every-workspace-but-the-current-one-until-touch-id-or-the-mac-password-unlocks-a-session.md), amends [0113](../../adr/0113-a-locked-session-looks-like-a-one-workspace-account-with-no-placeholder-count-or-lock-chrome-and-one-neutral-way-back-in.md))
**Not changing:** the server, the owner API, the widget extension's code, the relock triggers and the idle timeout

## Problem

With the switch on, the app still offered All workspaces and per-workspace toggles in an unlocked session, and the paths that selected another workspace while locked refused silently instead of asking the Mac owner.

## Goals

- While the switch is on, exactly one workspace is selected and shown, locked or unlocked. Multi-select and All workspaces are not offered (not drawn) and the model refuses them.
- A persisted multi-selection collapses to the current workspace when the switch turns on, at launch and on every relock (sleep, screen lock, screensaver, idle, Lock Now). Unlocking never restores it.
- Switching to one other workspace asks Touch ID or the Mac password while locked (sidebar, switcher, Workspace menu, ⌃1–9 and ⌃⌘[ ], global hot keys, the popover, the picker). A number naming the current workspace asks nothing. A refused or cancelled prompt leaves the selection as it was.
- Turning the switch off (with authentication) brings multi-select back without restoring the old selection.
- The widgets and the menu bar count follow the single selection; the snapshot never carries another workspace.

## Non-goals

- Links, intents and Shortcuts that name another workspace keep answering as an unknown workspace (ADR 0113); they never widen the selection.

## Alternatives

See [ADR 0122](../../adr/0122-one-rule-in-todzkit-decides-the-selection-a-locked-session-shows-and-every-path-that-widens-it-asks-the-mac-owner.md): keep multi-select when unlocked (the reported bug), draw a disabled All workspaces (a tell), patch each view (forgettable).

## Rollback

Turn the switch off (it needs authentication) or revert the PR. Nothing is stored beyond the existing switch, and no server, schema or sync format changes.

## Test strategy summary

See [test-plan.md](test-plan.md): one unit test per path against a fake authenticator, run by the tester from [tester-briefing.md](tester-briefing.md).
