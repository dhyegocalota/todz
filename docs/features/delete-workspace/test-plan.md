# Test plan: delete and rename workspaces, delete projects

## Server (Vitest in workerd): `apps/api/test/owner-delete.test.ts`

- [x] DELETE workspace answers 204 and removes the workspace, its Inbox, its projects and their keys. Commit `297a052c`.
- [x] A key of a deleted project answers 401 right after the delete. Same commit.
- [x] The storage of every deleted project is wiped (no tables left). Same commit.
- [x] Deleting the only workspace leaves the owner with an empty list. Same commit.
- [x] An unknown workspace answers 404 and deletes nothing. Same commit.
- [x] Another owner gets the answer an absent workspace gets, and the workspace stays. Same commit.
- [x] DELETE project answers 204 and keeps the workspace and the siblings. Same commit.
- [x] A key of a deleted project answers 401 and its storage is wiped. Same commit.
- [x] The Inbox answers 409 `inbox_is_fixed` and is kept. Same commit.
- [x] An unknown project answers 404. Same commit.
- [x] Another owner's project answers 404 and keeps its key and storage. Same commit.
- [x] DELETE without a session answers 401 with an empty body. Same commit.

## macOS (`swift test` in TodzKit)

- [ ] Deleting the shown workspace reloads the list and selects the first remaining workspace.
- [ ] Deleting the last workspace moves the app to the naming screen.
- [ ] A 404 on delete reloads the list and shows no error.
- [ ] A failed delete leaves the workspace in the list and raises the banner.
- [ ] Renaming a workspace replaces its name in the list and keeps its projects.
- [ ] Renaming to an empty name keeps the old name and raises the rule issue.
- [ ] A 404 on a project pull after the project was deleted elsewhere reloads the list and drops its cache.
- [ ] The typed-name confirm enables only on an exact match of the name.

## Walk and evidence

- [ ] Screenshot of the confirm sheet, light and dark.
- [ ] Screenshot of the rename sheet, light and dark.
- [ ] `/verify` green in the foreground.
- [ ] `apps/docs` Workspaces › Delete and rename section builds.
