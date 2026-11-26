# Plan: delete and rename workspaces, delete projects

Steps are ticked when built. A struck-through step records why it was not built.

## Server

- [x] Red tests: `apps/api/test/owner-delete.test.ts`, committed first (`63413755`, `c4e8dcbc`).
- [x] `directory-workspaces.ts`: `deleteOwnerWorkspace` (returns the deleted project ids or null, from `RETURNING`), `deleteOwnerProject`, each owner-scoped in every statement of its batch (`297a052c`, `68d4fc62`).
- [x] `project-store.ts`: `wipe()` sends `changed`, closes sockets, deletes storage (`297a052c`).
- [x] `project-routing.ts`: `wipeProjectStorage` wipes one project id (`297a052c`).
- [x] `owner-routes.ts` and `owner-workspaces.ts`: `DeleteWorkspace` and `DeleteProject`; the workspace handler wipes exactly the ids the batch returned (`297a052c`, `68d4fc62`).

## macOS (TodzKit, then the app)

- [x] Red TodzKit tests (`3b31b2b4`) and red review-fix tests (`f7cf5400`).
- [x] `OwnerAPI.swift`: `deleteWorkspace`, `deleteProject`, `renameWorkspace` (PATCH, existing route) (`a434994f`).
- [x] `AppModel+Workspaces.swift`: delete and rename; a deleted shown workspace leaves the selection and the cache; the local removal precedes the reload (`a434994f`, `eeb51a94`).
- [x] `WorkspaceSelection.limited(to:)` trims a chosen selection to the listed workspaces (`eeb51a94`).
- [x] `NameSheetKind.renameWorkspace`, reusing `NameSheet` (`a434994f`).
- [x] Typed-name confirm sheet, `DeleteConfirmSheet`, reused for workspace and project delete (`a434994f`).
- [x] Workspace menu, main window switcher: Rename Workspace…, Delete Workspace… (`a434994f`); menu bar Workspace menu: the same for the active workspace (`a201f3f5`).
- [x] Settings › Workspaces rows: rename and delete (`a434994f`).
- [x] Sidebar project context menu: Delete Project… (`a434994f`).
- [x] Screenshots of the confirm sheet and the rename sheet, light and dark, rendered in-process with no input events (paths in the PR body).
- [ ] ~~A 404 on a project pull drops the cache, the widgets and the count on another Mac, verified in the running app.~~ Struck: the existing 404 path (`requestWorkspaceReload`) is unchanged; no new test covers it by name and no second Mac was run. Evidence is the PR's human checklist.

## Docs

- [x] `apps/docs/workspaces.mdx`: Delete and rename section (`49e80a88`).
- [x] `docs/features/README.md` row and the ADR index row for 0093 (`48a16d10`, `9bb7804e`).

## Failure modes

| Step | What breaks | Signal | Backout |
|------|-------------|--------|---------|
| D1 batch | A statement without owner scope deletes a foreign row | `owner-delete.test.ts` foreign-owner and direct-function cases | Revert the batch; the statements are owner-scoped |
| `wipe()` | Storage delete fails after the directory rows went | The wipe throws; the request answers 500 | Rows already gone; storage unreachable, retry the wipe by hand |
| Swift reload | The deleted workspace stays selected | `AppModelTests+RemovalFailures` selection test | Trim on every listing |
| Confirm sheet | Enter confirms an empty or partly typed name | `NameConfirmationTests` | Require an exact match |
