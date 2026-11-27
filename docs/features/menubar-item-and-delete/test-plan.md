# Test plan: the menu bar item that macOS hides, and deleting a task from the app

The installed or running todz is never driven, and no todz build is launched on the owner's screen. The proof is unit tests, Worker tests, and renders hosted in process.

## Unit (TodzKit, `swift test --filter "AppModelTests/(deletingATask|aTaskTheServer|anOfflineDelete|aTaskAnAgent|aDeleteInAProject|aDeletedTaskTakes)|MenuBarItemPlacementTests|HiddenMenuBarItemCheckTests|TaskDeletionAlertTests"`)

- [x] Deleting a task sends one delete with its project, number and the title the app synced, drops it from the board and the project cache, and clears the selection that pointed at it; another task's selection stays. Evidence: `deletingATaskSendsOneDeleteAndDropsItFromTheBoardTheCacheAndTheSelection`, `deletingATaskKeepsTheSelectionOfAnotherTask`, red on ec42c680 and 79a8b8f0.
- [x] A task the server no longer has (`task_not_found`) leaves the board too. Evidence: `aTaskTheServerNoLongerHasLeavesTheBoardToo`.
- [x] A task an agent renamed since the sync is kept, with the `taskChangedBeforeDelete` banner. Evidence: `aTaskAnAgentRenamedSinceTheAppShowedItIsKeptWithAClearBanner`.
- [x] A project that is gone reloads and raises `projectGone`. Evidence: `aDeleteInAProjectThatIsGoneReloadsAndSaysTheProjectIsGone`.
- [x] The deleted task's waiting changes leave the outbox, and another task's stay. Evidence: `aDeletedTaskTakesItsWaitingChangesAlongAndLeavesTheOthers`.
- [x] Offline: the network banner, and the task stays. Evidence: `anOfflineDeleteRaisesTheNetworkBannerAndKeepsTheTask`.
- [x] A task of a locked workspace is refused and nothing is sent. Evidence: `deletingATaskOfALockedWorkspaceIsRefusedAndSendsNothing`.
- [x] The delete alert: Cancel first with Return, Delete second with no key equivalent and `hasDestructiveAction`, only the second button deletes. Evidence: `TaskDeletionAlertTests`, red on 79a8b8f0.
- [x] The check offers once after its two-second pause, never for an item on the bar, never when declined, never while the gate is quiet before or after the pause, never with no screen or no item, never twice while waiting, never after a cancelled pause. Evidence: `HiddenMenuBarItemCheckTests`, red on 79a8b8f0.
- [x] The parked frame (-1, -23, 44, 24) on a 3440 by 1440 screen is off the bar; a frame in the top band, above the top edge, or on a second screen's top band is on it; the middle of a screen is off it; no screen is never off it. Evidence: `MenuBarItemPlacementTests`.

## Worker (`pnpm --filter @todz/api test:unit`)

- [x] `DELETE /owner/projects/:projectId/tasks/:number` matches `delete_task`. Evidence: `owner-routes.test.ts`, red on ec42c680.
- [x] The owner deletes a task with its shown title: 204; the changes feed lists its number in `deleted_numbers` and not in `tasks`. Evidence: `owner-task-delete.test.ts`.
- [x] Another title answers 422 `confirmation_mismatch` and the task stays; no body answers 400 `invalid_request`. Evidence: `owner-task-delete.test.ts`, red on 79a8b8f0.
- [x] A second delete of the same number answers 404 `task_not_found`; a number never issued answers 404 `task_not_found`.
- [x] Another owner's project answers 404 `not_found`, and the task stays.
- [x] The parity table maps "Delete a task" to `delete_task` and the `delete` tool. Evidence: `mcp-parity.test.ts`.

## Repository shape (`pnpm --filter @todz/repository-shape test`)

- [x] The app has one `MenuBarExtra`, and no Swift source sets an autosave name, adds its own status item or binds `isInserted`. Evidence: `menu-bar-item-identity.test.ts`. It pins how things are today, so it was green from the start.

## Renders (hosted in process, light)

- [x] The notice's alert: the message, the detail, **Open Menu Bar Settings**, **Not Now**, and "Don't show this again". The harness is not an app bundle, so it draws the generic icon where todz shows its own.
- [x] The delete alert from `TaskDeletionAlert.make`: "Delete Task?", the title in the message, **Cancel** then **Delete** in red.
- [ ] Dark renders: skipped, an alert's material draws white offscreen under white text.

## Builds and gates

- [x] The Debug app builds from its own derived data.
- [x] `swift test` in `apps/macos/TodzKit`, `pnpm --filter @todz/api test:unit`, `pnpm --filter @todz/repository-shape test`, `pnpm typecheck`.

## User-visible walk (skipped: no todz build is launched on the owner's screen)

- [ ] Right-click a task in the list: **Delete Task…** asks; Delete removes it, Return and Cancel keep it.
- [ ] Select a task, ⌘⌫: the same alert. ⌘⌫ in the add field deletes text to the start of the line.
- [ ] The popover: right-click a row, **Delete Task…**; ⌘⌫ on a focused row.
- [ ] With todz turned off in System Settings › Menu Bar, a launch shows the notice once; **Open Menu Bar Settings** opens that pane.
