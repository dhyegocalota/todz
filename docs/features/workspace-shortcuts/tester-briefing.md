# Tester briefing: workspace shortcuts

## What changed

- The Workspace menu now shows ⌃1…⌃9 (not ⌘1…⌘9) and adds Previous and Next Workspace (⌃⌘[ and ⌃⌘]). The popover keeps its own ⌘1–⌘9.
- Settings has a "Workspace shortcuts" section: a "Switch from any app" switch (on by default), a Record button per chord, and one line about Mission Control.
- Global chords are Carbon hot keys; no permission prompt is expected.

## How to run it

`swift test --package-path apps/macos/TodzKit`, then the walk in `test-plan.md` with the Debug app and an account with three workspaces.

## Red then green

Red at a3fa8f1c: the stubs returned no chord, no workspace and a global switch off; the run printed `Expectation failed: bindings.chord(for: .number(1))` and `Expectation failed: WorkspaceShortcuts.workspace(action: .next, ...)`. Green at 92813fba.

`rebindingToTheChordItAlreadyHoldsIsAccepted` was red after the first green and fixed in the same commit.

## Hypotheses for the tester

- A chord rebound in Settings shows in the menu at once and survives a relaunch.
- ⌃1 from another app switches the workspace; with the switch off it does nothing.
- Escape during a recording changes nothing.
- A chord another app already holds does not register, and nothing crashes.

## Gaps

- The recorder, the menu and the Carbon keys have no automated test; only TodzKit's pure parts do.
- The ⌃1 Mission Control collision was not exercised.
- ⌘1–⌘9 in the main window now do nothing (decision 1 of ADR 0079).
