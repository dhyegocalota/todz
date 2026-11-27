# Test plan: the menu bar item that macOS hides, and deleting a task from the app

The installed or running todz is never driven, and no todz build is launched on the owner's screen. The proof is unit tests, Worker tests, and renders hosted in process.

## Unit (TodzKit, `swift test --filter "AppModelTaskDeleteTests|MenuBarItemPlacementTests"`)

- [ ] Deleting a task sends one delete for its project and number, drops it from the board and the project cache, and clears the selection that pointed at it.
- [ ] A task the server no longer has (`task_not_found`) leaves the board too.
- [ ] Offline: the network banner, and the task stays.
- [ ] A task of a locked workspace is refused and nothing is sent.
- [ ] The parked frame (-1, -23, 44, 24) on a 3440 by 1440 screen is off the bar; a frame in the top band (3119, 1413, 47, 24) is on it; a frame on a second screen's top band is on it.

## Worker (`pnpm --filter @todz/api test:unit`)

- [ ] `DELETE /owner/projects/:projectId/tasks/:number` matches `delete_task`.
- [ ] The owner deletes a task: 204; the changes feed lists its number in `deleted_numbers` and not in `tasks`.
- [ ] A second delete of the same number answers 404 `task_not_found`; a number never issued answers 404 `task_not_found`.
- [ ] Another owner's project answers 404 `not_found`, and the task stays.
- [ ] The parity table maps "Delete a task" to `delete_task` and the `delete` tool.

## Renders (hosted in process, light and dark)

- [ ] The notice's alert: the message, the detail, **Open Menu Bar Settings**, **Not Now**, and "Don't show this again".

## Builds and gates

- [ ] The Debug app builds from its own derived data.
- [ ] `swift test` in `apps/macos/TodzKit`, `pnpm --filter @todz/api test:unit`, `pnpm --filter @todz/repository-shape test`, `pnpm typecheck`.

## User-visible walk (skipped: no todz build is launched on the owner's screen)

- [ ] Right-click a task in the list: **Delete Task…** asks "Delete “<title>”?"; Delete removes it, Cancel keeps it.
- [ ] Select a task, ⌘⌫: the same question. ⌘⌫ in the add field deletes text to the start of the line.
- [ ] The popover: right-click a row, **Delete Task…**; ⌘⌫ on a focused row.
- [ ] With todz turned off in System Settings › Menu Bar, a launch shows the alert once; **Open Menu Bar Settings** opens that pane.
