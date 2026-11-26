# Multi workspace

**Status:** Building
**Tier:** 🟡 (app-side only: a selection model, a union of projects, a widget snapshot field and a request field; no server, no schema, no deploy)
**Owner approval:** approved 2026-11-26 by the owner's request, "posso selecionar múltiplos workspaces pra aparecer? … corre, paraleliza ao máximo", recorded in `todz-loop/PROMPT.md` "Workspaces, more"; product scope inherited from [docs/product/README.md](../../product/README.md).
**ADRs:** [0080](../../adr/0080-the-workspace-picker-selects-several-workspaces-or-all-and-every-surface-shows-their-union-tagged-by-workspace.md)
**Not changing:** the server and the owner API, the first-run picker of [workspace-select](../workspace-select/spec.md), the sign-in, the outbox format

## Problem

The app shows one workspace at a time, so an owner with several workspaces cannot see all their tasks together.

## Goals

- The workspace picker becomes multi-select, with an "All Workspaces" option; the selection is remembered per Mac.
- The window's Today, Upcoming, Inbox and Done, the menu bar count, the popover, the widgets, the day close, the morning glance and the ribbon show the union of the selected workspaces. Each row is tagged with its workspace name when two or more are shown.
- The widget snapshot carries the workspace per task, and a widget tick completes the task in its own workspace, never in another.
- A single selection behaves exactly as before, including the cache bytes.
- The existing select-one-workspace API stays; a shortcut selects exactly one.

## Non-goals

- Any server change; a colour per workspace; an All row in the first-run picker; choosing the destination of an add in the union (it goes to the primary workspace's Inbox).

## Design

See the ADR: `WorkspaceSelection` (`all` or `chosen`), the primary workspace, `OwnerCache.selection` written only when not the single primary, `TaskViews` over every shown project, the row tag, `WidgetSnapshotTask.workspaceIdentifier/workspaceName` and `WidgetRequest.workspaceIdentifier`, optional on decode.

## Failure handling

- A chosen workspace that disappears from the listing leaves the selection; an empty resolution falls back to the sole workspace or the picker.
- A widget request for a workspace that does not own the task's project, or for a task not in the union Today, is dropped.
- Toggling off the last chosen workspace changes nothing.
