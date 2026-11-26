# Global workspace hot keys off by default

**Status:** Building
**Tier:** 🟡 (a default change, a second chord scope, a Settings change; no server, no schema, no deploy)
**Owner approval:** approved by inheritance from [docs/product/README.md](../../product/README.md) (2026-11-23) and the owner's report of 2026-11-26: the global ⌃1…⌃9 hot keys steal Dia's profile switching system-wide.
**ADRs:** [0086](../../adr/0086-global-workspace-hot-keys-are-off-by-default-and-take-control-option-command-digits-and-yield-to-a-chord-another-app-holds.md) (amends [0079](../../adr/0079-workspaces-switch-by-chord-with-carbon-hot-keys-and-a-stored-rebindable-binding-table.md))
**Not changing:** the popover's ⌘1–⌘9, the workspace picker, the server, the selection model, the widgets

## Problem

ADR 0079 registers ⌃1…⌃9 and ⌃⌘[ ⌃⌘] as global hot keys, on by default. Those chords belong to other apps too, and while todz runs they are taken from every app.

## Goals

- In-app workspace keys (⌃1…⌃9, ⌃⌘[, ⌃⌘]) work only while todz is frontmost and are never registered globally.
- Global workspace keys are off by default; when on, the default chord is ⌃⌥⌘1…9, rebindable.
- A global chord is registered only when no other app owns it; otherwise its Settings row says "In use by another app" and nothing is registered.
- An install that never touched the global switch lands off with the new chord; an explicit choice stays.

## Non-goals

- Global Previous and Next chords.
- Rebinding the in-app chords.
- Re-checking an in-use chord while todz runs (it is checked when the hot keys are registered: at launch, on a change, and on becoming ready).

## Design

- TodzKit: `WorkspaceAction` gives each action an `inAppChord` and a `globalDefaultChord`; `GlobalWorkspaceChords` (renamed from `WorkspaceBindings`) holds the global overrides, refuses chords with fewer than two of ⌃⌥⌘ or equal to an in-app chord, and refuses non-number actions; `ChordModifiers.canBeGlobal`; `WorkspaceShortcutsPreference` reads the switch (default off) and drops stored overrides that are no longer valid; `GlobalChordPlan` decides which global chords to register and which are held by the system; `SymbolicHotKeys` reads a system entry's key and modifiers.
- App: `WorkspaceHotKeys` registers the plan and returns the actions Carbon refused; `WorkspaceShortcutController` keeps the in-use set; the Workspace menu keeps the in-app chords; `SettingsWorkspaceShortcuts` shows number rows only while the switch is on, with the in-use line; `WorkspaceShortcutsCopy` carries the new strings.

## Failure handling

- A chord held by the system or refused by Carbon is marked in use, not registered, and its row says so.
- A stored override that is not valid globally is dropped at read; the action uses its default.
- A global chord with one modifier, or equal to an in-app chord, is refused at rebind.

## Test strategy summary

See [test-plan.md](test-plan.md). Decision logic is in TodzKit and unit-tested with Swift Testing; the Carbon and Settings layers are checked by a Debug build and screenshots.
