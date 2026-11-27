# 0122. The workspace lock switch on shows one workspace and refuses widening

- Status: Accepted (the loop's call)
- Date: 2026-11-27
- Deciders: Claude (the build loop's call, under the owner's report on 2026-11-27: "quando eu lock workspaces, ainda posso ter múltiplos selecionados e selecionar múltiplos")
- Inspired by: [0110](0110-the-workspace-lock-hides-every-workspace-but-the-current-one-until-touch-id-or-the-mac-password-unlocks-a-session.md), [0113](0113-a-locked-session-looks-like-a-one-workspace-account-with-no-placeholder-count-or-lock-chrome-and-one-neutral-way-back-in.md)
- Amends: 0113 (shortcuts and selection)

## Context

The lock hid other workspaces only while the session was locked. An unlocked session with the switch on still offered All workspaces and per-workspace toggles, so the owner kept seeing a multi-selection; and the paths that tried to select another workspace while locked refused without asking.

## Decision

The loop's call on what the owner meant: while the switch is on, the app shows exactly one workspace at a time, locked or unlocked. `AppModel` is the one place that decides this (`shownWorkspaces`, `isShowableAfterAsking`, `collapsedToOneWorkspace`, `pickWorkspace`), so no view is patched on its own. Multi-select and All workspaces are refused by the model and not drawn by the switcher, and a switcher row switches to its workspace alone, so the picked workspace becomes the current one that a relock or a relaunch keeps; a persisted multi-selection collapses to the current workspace when the switch turns on, at launch and on every relock, and unlocking never restores it. Unlocking lets the person switch to one other workspace, never widen. A locked session asks Touch ID or the Mac password (the `.switchWorkspaces` gate of `Switch Workspace…`) before showing another workspace: a number naming the current workspace does nothing and asks nothing, a number beyond the visible list asks and then resolves against every workspace, Previous and Next ask first, and the in-app number chords beyond the list reach the model without drawing rows. A refused or cancelled prompt leaves the selection as it was. Turning the switch off, with authentication as before, brings multi-select back without restoring the old selection. Links, intents and Shortcuts still answer as an unknown workspace and never widen anything.

## Alternatives

- Ask only while locked and keep multi-select when unlocked: this is what shipped before and what the owner reported.
- Draw a disabled "All workspaces" and ask when it is chosen: it tells a bystander that other workspaces exist (ADR 0113).
- Patch each view: a new view can forget the gate; the rule in the model cannot be forgotten.

## Consequences

- With the switch on, no one can look at two workspaces at once; switching away from the current one costs one prompt per locked session.
- A shortcut toward a workspace beyond the current one asks even when none exists, so the prompt tells nothing; ⌃1 toward the current workspace asks nothing.
- The Previous and Next items are enabled while locked so their chords reach the model.
- Rollback: turn the switch off, or revert the PR; no data, server or schema changes.
