# Workspace shortcuts

**Status:** Approved
**Tier:** 🟡 (new keys and a Settings section; no server, no schema, no deploy)
**Owner approval:** approved 2026-11-26 by the owner's request to the loop, "quero switch between workspaces com shortcuts configurados por padrão… corre", recorded in `todz-loop/PROMPT.md` "Workspaces, more". Product intent by inheritance from [docs/product/README.md](../../product/README.md).
**ADRs:** [0079](../../adr/0079-workspaces-switch-by-chord-with-carbon-hot-keys-and-a-stored-rebindable-binding-table.md)
**Not changing:** the server, the workspace selection model, the popover's ⌘1–⌘9, the picker and the widgets

## Problem

The owner switches workspaces with the mouse or with ⌘1–⌘9, which belong to lists, and cannot do it from another app.

## Goals

- ⌃1…⌃9 switch to workspace 1…9, in the Workspace menu's order, by default.
- ⌃⌘[ and ⌃⌘] go to the previous and next workspace, wrapping.
- Every chord is rebindable in Settings and shown in the Workspace menu.
- The same chords work from any app through a registered hot key, with an on/off switch, on by default.

## Non-goals

- Chords for workspaces beyond the ninth (stepping reaches them).
- Clearing a chord, or a reset button.
- Changing the popover's own ⌘1–⌘9.

## Design

- TodzKit: `ChordModifiers`, `KeyChord`, `WorkspaceAction`, `WorkspaceBindings` (defaults plus overrides, refusals), `WorkspaceShortcutsPreference` (storage and the global switch), `WorkspaceShortcuts.workspace(action:activeIdentifier:in:)` and `AppModel.switchWorkspace(action:)`, which ends in the existing `switchWorkspace(identifier:)`.
- App: `WorkspaceShortcutController` (observable bindings and registration), `WorkspaceHotKeys` (Carbon), the Workspace menu items, `SettingsWorkspaceShortcuts` with `WorkspaceChordRow` (Record, Escape cancels), and `WorkspaceShortcutsCopy`.
- Settings shows the rows only when the account has workspaces, one row per listed workspace up to nine, plus Previous and Next, and one quiet line about Mission Control's Switch to Desktop keys. A refused rebind replaces that line with the reason.

## Failure handling

- A chord without ⌃, ⌥ or ⌘ is refused: "Hold ⌃, ⌥ or ⌘ with the key."
- A chord another action holds is refused: "Another workspace shortcut already uses those keys."
- A number past the list, or a step with no workspace, does nothing.
- A switch while the app is not `ready` does nothing (the phase check in `switchWorkspace`).
- A hot key that the system refuses to register is skipped; the menu chord still works.

## Test strategy summary

TodzKit unit tests, red first: defaults, number to workspace, wrapping steps, rebind persisted and reloaded, duplicate refused, the global switch on by default. The menu, the recorder and the global keys are walked by the tester.
