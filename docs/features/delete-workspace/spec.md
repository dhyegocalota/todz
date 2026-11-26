# Delete and rename workspaces, delete projects

**Status:** In review
**Tier:** 🔴 (workspace isolation, MCP key revocation, data deletion, schema-free server change, app cache and selection)
**Owner approval:** the owner's words, "como eu posso deletar um workspace?" and "como renomear?", inherit the product scope of [docs/product/README.md](../../product/README.md) (approved 2026-11-23); the loop decides the design under the owner's standing instruction and records it in [ADR 0093](../../adr/0093-deleting-a-workspace-or-project-is-a-hard-delete-behind-a-typed-name-confirmation.md).
**ADRs:** [0093](../../adr/0093-deleting-a-workspace-or-project-is-a-hard-delete-behind-a-typed-name-confirmation.md)
**Not changing:** the sign-in, the task API, the outbox format, the create routes, the Inbox name rule, the day-email and the fair-use limit (the fair-use lane counts only live rows, and hard delete leaves none behind).

## Problem

An owner can create and rename workspaces and projects but cannot remove them, and cannot rename a workspace from the app. A workspace or project that was a mistake stays in the list, its MCP keys stay live, and its data stays in the project store.

## Goals

- Delete a workspace from the Workspace menu and from Settings › Workspaces. The workspace's projects, their MCP keys and their storage go with it.
- Delete a project from the sidebar project context menu only.
- Rename a workspace from the Workspace menu and from Settings › Workspaces, through the existing `NameSheet` with a new `.renameWorkspace` kind.
- Both deletions ask the owner to type the name of the workspace or project before they run.
- Deleting the last workspace leaves the owner with none: the app offers to create one.
- Every other Mac drops the deleted data: a 404 on the project pull reloads the workspace list, which removes the widgets, the menu bar count and the multi-workspace selection entries that no longer exist.
- A key of a deleted project answers 401 at once.

## Non-goals

- Soft delete and restore (ADR 0093).
- Deleting the Inbox. It stays fixed, as the rename rule already says.
- Bulk delete.

## Data flow

1. The app asks for the name in a confirm sheet, then calls `DELETE /owner/workspaces/:id` or `DELETE /owner/projects/:id` with the owner's session.
2. The server runs one D1 batch: MCP sessions of the keys, the keys, the projects (not the Inbox for a project delete), the workspace. Then each project's Durable Object wipes its storage and sends `changed` to its sockets, then closes them.
3. The app removes the item locally. If the item was shown, it reloads the workspace list; a socket or a pull that answers 404 does the same on the other Macs.

## Interfaces

- `DELETE /owner/workspaces/:workspaceId` → 204; 404 `not_found` for an absent or another owner's workspace.
- `DELETE /owner/projects/:projectId` → 204; 404 `not_found`; 409 `inbox_is_fixed` for the Inbox.
- Renaming a workspace uses the existing `PATCH /owner/workspaces/:workspaceId`.

## Failure handling

- A failed delete leaves the item in place and shows the existing banner path; nothing is removed locally.
- A delete that answers 404 means the item is already gone: the app reloads the list instead of showing an error.
- After a wipe the server sends `changed` and closes the socket. The app's next pull answers 404, which reloads the workspace list. The reconnect that follows the close is answered 404 as well and reloads again; both use the existing reconnect backoff.

## Rollback

Reverting the change restores the routes and the screens, but a revert cannot restore deleted data: the rows, the keys and the project storage are gone, and the revoked keys stay revoked, so the owner issues new keys. The schema is unchanged, so a revert needs no migration.

## Open questions

None. The owner accepted hard delete with the typed-name confirmation.
