# Lock single workspace

**Status:** Shipped 2026-11-27
**Tier:** 🔴 (a privacy guarantee: every path that widens the selection is a bypass; TodzKit and the Mac app only, no server, no schema, no deploy)
**Owner approval:** approved 2026-11-27, the owner's report: "quando eu lock workspaces, ainda posso ter múltiplos selecionados e selecionar múltiplos; corrige aí".
**ADRs:** [0122](../../adr/0122-one-rule-in-todzkit-decides-the-selection-a-locked-session-shows-and-every-path-that-widens-it-asks-the-mac-owner.md) (builds on [0110](../../adr/0110-the-workspace-lock-hides-every-workspace-but-the-current-one-until-touch-id-or-the-mac-password-unlocks-a-session.md) and [0113](../../adr/0113-a-locked-session-looks-like-a-one-workspace-account-with-no-placeholder-count-or-lock-chrome-and-one-neutral-way-back-in.md))
**Not changing:** the server, the owner API, the widget extension's code, the relock triggers and the idle timeout

## Problem

With the lock on, a locked session could still hold a multi-workspace selection, and the paths that widen it (switcher toggles, All workspaces, shortcuts, the popover) refused silently instead of asking the Mac owner.

## Goals

- While locked, exactly one workspace is selected and shown: the current one. A relock, turning the switch on and a launch collapse any multi-selection to it.
- Every path that selects another workspace or several (sidebar, switcher, Workspace menu, ⌃1–9, ⌃⌘[ ], global hot keys, ⌘-click, All workspaces, the popover) asks Touch ID or the Mac password, the same `deviceOwnerAuthentication` gate as `Switch Workspace…`. A refused or cancelled prompt leaves the single selection as it was.
- Unlocking never restores an earlier multi-selection by itself.
- The widgets and the menu bar count follow the collapsed selection; the snapshot never carries another workspace while locked.

## Non-goals

- Links, intents and Shortcuts that name another workspace keep answering as an unknown workspace (ADR 0113); they never widen the selection.

## Test strategy summary

See [test-plan.md](test-plan.md): one unit test per path against a fake authenticator.
