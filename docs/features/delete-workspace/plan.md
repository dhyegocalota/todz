# Plan: delete and rename workspaces, delete projects

Steps are unchecked until built. A struck-through step records the reason it changed.

## Server (done in this lane)

- [ ] Red tests: `apps/api/test/owner-delete.test.ts` (13 cases), committed first.
- [ ] `directory-workspaces.ts`: `deleteOwnerWorkspace`, `deleteOwnerProject`, `listWorkspaceProjectIds`, each owner-scoped in every statement of its batch.
- [ ] `project-store.ts`: `wipe()` sends `changed`, closes sockets, deletes storage.
- [ ] `project-routing.ts`: `wipeProjectStorage`.
- [ ] `owner-routes.ts` and `owner-workspaces.ts`: `DeleteWorkspace` and `DeleteProject`.

## macOS (TodzKit, then the app)

- [ ] Red TodzKit tests: `AppModel.deleteWorkspace`, `AppModel.deleteProject`, `AppModel.renameWorkspace`, the owner API methods, and the 404 reload on delete.
- [ ] `OwnerAPI.swift`: `deleteWorkspace`, `deleteProject`, `renameWorkspace` (PATCH, existing route); `OwnerService` protocol and the fakes in tests.
- [ ] `AppModel+Workspaces.swift`: delete and rename; a deleted shown workspace selects the first remaining one, or moves the app to naming when none remain.
- [ ] `NameSheetKind.renameWorkspace`, reusing `NameSheet`.
- [ ] Typed-name confirm sheet, reused for workspace and project delete.
- [ ] Workspace menu: Rename Workspace…, Delete Workspace…; Settings › Workspaces rows: rename, delete; sidebar `ProjectRow` context menu: Delete Project….
- [ ] Screenshots of the confirm sheet and the rename sheet, light and dark, from the Debug build, rendered in-process or captured with `screencapture -l`, no input events.

## Docs

- [ ] `apps/docs`: a Workspaces › Delete and rename section.
- [ ] `docs/features/README.md` row; ADR index row for 0093.

## Failure modes

| Step | What breaks | Signal | Backout |
|------|-------------|--------|---------|
| D1 batch | A statement without owner scope deletes a foreign row | `owner-delete.test.ts` foreign-owner cases | Revert the batch; the statements are owner-scoped |
| `wipe()` | Storage delete fails after the directory rows went | The wipe throws; the request answers 500 | Rows already gone; storage unreachable, retry the wipe by hand |
| Swift reload | The deleted workspace stays selected | TodzKit selection test | Force a list reload on 404 |
| Confirm sheet | Enter confirms an empty or partly typed name | Confirm test | Require an exact match |
