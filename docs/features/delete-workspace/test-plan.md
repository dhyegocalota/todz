# Test plan: delete and rename workspaces, delete projects

## Server (Vitest in workerd): `apps/api/test/owner-delete.test.ts`, 19 tests

- [x] DELETE workspace answers 204 and removes the workspace, its Inbox, its projects and their keys (`297a052c`).
- [x] A key of a deleted project answers 401 right after the delete (`297a052c`).
- [x] The storage of every deleted project is wiped (no tables left) (`297a052c`).
- [x] Deleting the only workspace leaves the owner with an empty list (`297a052c`).
- [x] An unknown workspace answers 404 and deletes nothing (`297a052c`).
- [x] Another owner gets the answer an absent workspace gets, and the workspace stays (`297a052c`).
- [x] DELETE project answers 204 and keeps the workspace and the siblings (`297a052c`).
- [x] A key of a deleted project answers 401 and its storage is wiped (`297a052c`).
- [x] The Inbox answers 409 `inbox_is_fixed` and is kept (`297a052c`).
- [x] An unknown project answers 404 (`297a052c`).
- [x] Another owner's project answers 404 and keeps its key and storage (`297a052c`).
- [x] DELETE without a session answers 401 with an empty body (`297a052c`).
- [x] `deleteOwnerWorkspace` for another owner answers null and keeps the workspace and its projects, with no key issued (`c4e8dcbc`, green `68d4fc62`).
- [x] `deleteOwnerProject` for another owner answers false and keeps the project (`c4e8dcbc`; a pin, it passed there).
- [x] Another owner deleting a project that has no key answers 404 and the project stays (`c4e8dcbc`; a pin, it passed there).
- [x] A workspace delete whose storage wipe throws after the directory commit still answers 204 (`2251a70a`, green `a324b2b1`).
- [x] A project delete whose storage wipe throws after the directory commit still answers 204 (`2251a70a`, green `a324b2b1`).
- [x] An MCP session of a deleted project answers 401 right after the workspace delete (`c4e8dcbc`; a pin, it passed once the key was gone).

## macOS (`swift test` in TodzKit: 1466 tests, 0 failing)

- [x] Deleting one of two shown workspaces leaves the survivor as the whole state: selection, primary, open item and cache (`deletingOneOfTwoShownWorkspacesLeavesTheSurvivorAsTheWholeState`).
- [x] A workspace delete whose reload fails still drops the workspace (`aWorkspaceDeleteWhoseReloadFailsStillDropsTheWorkspace`).
- [x] A project delete whose reload fails still drops the project (`aProjectDeleteWhoseReloadFailsStillDropsTheProject`).
- [x] Deleting the Inbox is refused with the fixed-Inbox banner (`deletingTheInboxIsRefusedWithTheFixedInboxBanner`).
- [x] Renaming a workspace patches it (`renameWorkspacePatchesTheWorkspace`).
- [x] The typed-name confirm enables on the exact name, never on an empty name, and not on anything else (`theExactNameConfirms`, `anEmptyNameIsNeverConfirmed`, `anythingElseDoesNotConfirm`).
- [x] Deleting the last workspace moves the app to the naming screen (`deletingTheLastWorkspaceMovesTheAppToNaming`).
- [x] A 404 on delete reloads the list quietly (`aWorkspaceDeleteThatAnswersNotFoundReloadsTheListWithoutABanner`, `aProjectDeleteThatAnswersNotFoundReloadsTheListWithoutABanner`).
- [x] A failed delete leaves the workspace in the list and raises the banner (`aFailedWorkspaceDeleteKeepsTheWorkspaceAndRaisesTheBanner`, `aFailedProjectDeleteKeepsTheProjectAndRaisesTheBanner`).
- [x] Renaming the Inbox is refused (`renamingTheInboxIsRefused`).
- [x] Renaming to an empty name keeps the old name and raises the rule issue (`renamingAWorkspaceToAnEmptyNameKeepsTheOldNameAndRaisesTheRuleIssue`).
- [x] A 404 on a project pull after the project was deleted elsewhere reloads the list (`aPullOfAProjectDeletedElsewhereDropsItsCacheAndReloadsTheList`).
- [x] A failed reload after deleting the shown workspace shows the remaining one, for single selection, multi selection and the last workspace (`deletingTheOnlyShownWorkspaceWhoseReloadFailsShowsTheRemainingOne`, `deletingTheActiveOfTwoShownWorkspacesWhoseReloadFailsShowsTheSurvivor`, `deletingTheLastWorkspaceWhoseReloadFailsMovesTheAppToNaming`; red `b8272492`, green `2a4691bb`).
- [x] A failed reload after a workspace delete drops it from the cache (`aWorkspaceDeleteWhoseReloadFailsDropsTheWorkspaceFromTheCache`; red `b8272492`, green `2a4691bb`).
- [x] A failed reload after a project delete erases its cache file and watch (`aProjectDeleteWhoseReloadFailsErasesItsCache`; red `b8272492`, green `2a4691bb`).
- [x] The typed name is trimmed before it is compared (`surroundingWhitespaceIsIgnored`; red `3827ee45`, green `7a5b535d`).

## Walk and evidence

- [x] Screenshots of the confirm sheet and the rename sheet, light and dark, rendered in-process with no input events. Local paths are in the PR body; they are not committed.
- [x] `/verify` green in the foreground (see the PR).
- [x] `apps/docs` Workspaces › Delete and rename validated with `mint validate`.
- [ ] ~~A live walk of the running app on a second Mac.~~ Struck: not run; it is the PR's human checklist.
