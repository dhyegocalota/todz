# Workspace select

**Status:** Building
**Tier:** 🟡 (a new app phase and a picker screen, a Settings list; no server, no schema, no deploy)
**Owner approval:** approved 2026-11-26 by the owner's request to the loop, "workspace select para selecionar existentes da conta", recorded in `todz-loop/PROMPT.md` "Tonight's last three", item 2. The lead confirmed the scope on 2026-11-26: name and project count only, last activity as v1.1.
**ADRs:** [0076](../../adr/0076-an-account-with-several-workspaces-and-no-remembered-choice-opens-a-picker-of-names-and-project-counts.md)
**Not changing:** the server, the listing endpoint, the sync, the widgets' content, the day close, the morning glance and the sign-in screen

## Problem

A new Mac or a fresh sign-in enters the account's first workspace without asking, so the owner cannot choose among the workspaces the account already has.

## Goals

- On sign-in, an account with two or more workspaces and no remembered choice on this Mac shows a picker instead of entering the first one. Each row shows the name and the project count.
- The picker keeps "New Workspace…", which opens the existing name sheet.
- The Workspace menu and the Settings window list every workspace and switch between them.
- The choice is remembered per Mac (already true through the owner cache; unchanged).
- The widgets and the menu bar count follow the selected workspace (already true; verified by test).

## Non-goals

- Last activity in the picker (v1.1, needs a server change and a deploy; see the ADR).
- Any server, schema or listing change.
- Changing the naming screen for an account with no workspace.

## Design

- `AppPhase.choosing` is entered from `openListedWorkspaces` when the listing has two or more workspaces and the remembered workspace is not among them.
- `AppModel.chooseWorkspace(identifier:)` activates a listed workspace from the picker and moves to `ready`.
- `WorkspacePickerScreen` lists the rows and the "New Workspace…" button.
- `SettingsWorkspaceRows` is a small view in its own file, placed in `SettingsView` with one line.

## Failure handling

- A listing that fails keeps the existing load-failure path (retry banner); the picker is not shown.
- A row tapped while a write is in flight is ignored by the same guard as a switch.

## Test strategy summary

TodzKit unit tests, red first, for the phase decision, the choice, the remembered workspace and the tenant rule (only the listed workspaces are offered). The Settings list and the picker are checked by the user-visible walk in `test-plan.md`.
