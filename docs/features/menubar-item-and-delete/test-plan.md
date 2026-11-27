# Test plan: the menu bar item that macOS hides, and deleting a task from the app

The installed or running todz is never driven, and no todz build is launched on the owner's screen. The proof is unit tests, Worker tests, and renders hosted in process.

## Unit (TodzKit, `swift test --filter "AppModelTests/(deletingATask|aTaskTheServer|anOfflineDelete)|MenuBarItemPlacementTests"`)

- [x] Deleting a task sends one delete for its project and number, drops it from the board and the project cache, and clears the selection that pointed at it; another task's selection stays. Evidence: `deletingATaskSendsOneDeleteAndDropsItFromTheBoardTheCacheAndTheSelection`, `deletingATaskKeepsTheSelectionOfAnotherTask`, red as a compile failure on ec42c680.
- [x] A task the server no longer has (`task_not_found`) leaves the board too. Evidence: `aTaskTheServerNoLongerHasLeavesTheBoardToo`.
- [x] Offline: the network banner, and the task stays. Evidence: `anOfflineDeleteRaisesTheNetworkBannerAndKeepsTheTask`.
- [x] A task of a locked workspace is refused and nothing is sent. Evidence: `deletingATaskOfALockedWorkspaceIsRefusedAndSendsNothing`.
- [x] The parked frame (-1, -23, 44, 24) on a 3440 by 1440 screen is off the bar; a frame in the top band (3119, 1413, 47, 24) is on it; a frame on a second screen's top band is on it; the middle of a screen and no screen are off it. Evidence: `MenuBarItemPlacementTests`, red as a compile failure on ec42c680.

## Worker (`pnpm --filter @todz/api test:unit`)

- [x] `DELETE /owner/projects/:projectId/tasks/:number` matches `delete_task`. Evidence: `owner-routes.test.ts`, red on ec42c680.
- [x] The owner deletes a task: 204; the changes feed lists its number in `deleted_numbers` and not in `tasks`. Evidence: `owner-task-delete.test.ts`, red on ec42c680.
- [x] A second delete of the same number answers 404 `task_not_found`; a number never issued answers 404 `task_not_found`.
- [x] Another owner's project answers 404 `not_found`, and the task stays.
- [x] The parity table maps "Delete a task" to `delete_task` and the `delete` tool. Evidence: `mcp-parity.test.ts`.

## Repository shape (`pnpm --filter @todz/repository-shape test`)

- [x] The app has one `MenuBarExtra`, and no Swift source sets an autosave name, adds its own status item or binds `isInserted`. Evidence: `menu-bar-item-identity.test.ts`. It pins how things are today, so it was green from the start.

## Renders (hosted in process)

- [x] The notice's alert, light: the message, the detail, **Open Menu Bar Settings**, **Not Now**, and "Don't show this again". The harness is not an app bundle, so it draws the generic icon where todz shows its own.
- [ ] The notice's alert, dark: skipped, the alert's material draws white offscreen under white text.
- [ ] The task deletion dialog: skipped, a SwiftUI confirmation dialog only exists on a presented window.

## Builds and gates

- [x] The Debug app builds from its own derived data.
- [x] `swift test` in `apps/macos/TodzKit`, `pnpm --filter @todz/api test:unit`, `pnpm --filter @todz/repository-shape test`, `pnpm typecheck`.

## User-visible walk (skipped: no todz build is launched on the owner's screen)

- [ ] Right-click a task in the list: **Delete Task…** asks "Delete Task?" naming it; Delete removes it, Cancel keeps it.
- [ ] Select a task, ⌘⌫: the same question. ⌘⌫ in the add field deletes text to the start of the line.
- [ ] The popover: right-click a row, **Delete Task…**; ⌘⌫ on a focused row.
- [ ] With todz turned off in System Settings › Menu Bar, a launch shows the alert once; **Open Menu Bar Settings** opens that pane.
