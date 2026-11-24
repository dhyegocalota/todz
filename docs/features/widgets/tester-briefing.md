# Tester briefing: Widgets

Written by the developer sub-agent when its steps are done. The developer does not run `test-plan.md` and does not declare the feature works.

## G1 model (TodzKit)

### What changed

- `WidgetSnapshot`, `WidgetSnapshotTask`: the active workspace's Today as the widgets read it (workspace name, day, time zone, `open`, `pending`, `doneToday`), built from `TaskViews.today` and `pendingTasks(for: .today)`; no owner identifier.
- `WidgetContent`, `WidgetToday`, `WidgetFamilyKind`: what each family draws (prompt, empty, or Today with rows, Next up, counts and progress).
- `WidgetRequest`, `StoredWidgetRequest`, `WidgetStore`, `WidgetStoreError`, `FileWidgetStore`: `widget-snapshot.json` and `requests/<UUID>.json` in one folder, written through `PrivateFile`, read only when the file is a regular file.
- `WidgetToggle`: the checkbox's pure logic: the row's state set in place, plus the request to record.
- `WidgetNotification.requestsAdded`: the Darwin notification name `dev.todz.widgets.requests` (ADR 0033).
- `WidgetSnapshotState` and `AppModel+Widgets`: one observation loop started by `launch()` publishes the snapshot, `dayChanged()` republishes, `takeWidgetRequests()` takes requests into the outbox.
- `AppModel`: takes `widgetStore` and `reloadWidgets`; a launch and a sign-in take waiting requests; sign-out erases the widget files with the cache.
- `AppModel+Cache`: a sign-in as another owner and an owner switch found at launch erase the widget files with the cache.
- `apps/macos/Todz/TodzApp.swift` (outside the lane, the minimum so the app builds): passes `FileWidgetStore` over `Application Support/Widgets` inside the app's own container, and `WidgetCenter.shared.reloadAllTimelines()`.

### How to run

```bash
cd apps/macos/TodzKit && swift test
cd apps/macos/TodzKit && swift test --filter Widget
```

The suite went from 360 tests to 417, all green. The app builds with the `macos` gate's `xcodegen generate` and `xcodebuild build` lines.

### Red today, green after

The red runs that hit a `fatalError` stub crashed the test helper with signal code 5 after printing the line shown.

| Red commit | Test | Red failure printed | Green commit |
|---|---|---|---|
| `88a906f` | `WidgetSnapshotTests` (8 tests) | `TodzKit/WidgetSnapshot.swift:28: Fatal error: WidgetSnapshot.of is not implemented` | `cb7586f` |
| `061e894` | `WidgetContentTests` (10 tests) | `TodzKit/WidgetContent.swift:7: Fatal error: WidgetContent.of is not implemented` | `50a9343` |
| `2f537c3` | `FileWidgetStoreTests` (13 tests) | `TodzKit/FileWidgetStore.swift:11: Fatal error: FileWidgetStore is not implemented` | `37babd1` |
| `9f200aa` | `WidgetToggleTests` (6 tests) | `TodzKit/WidgetToggle.swift:11: Fatal error: WidgetToggle.setting is not implemented` | `4e37a44` |
| `e152992` | `AppModelTests.aCachedLaunchWritesTheSnapshotOnceAndReloadsOnce` | `Expectation failed: harness.widgets.routes() == [.writeSnapshot, .reload]` | `901c950` |
| `e152992` | `AppModelTests.aSignedOutLaunchErasesTheSnapshotOnceAndReloads` | `Expectation failed: harness.widgets.routes() == [.eraseSnapshot, .reload]` | `901c950` |
| `e152992` | `AppModelTests.namingTheFirstWorkspaceShowsNoSnapshot` | `Expectation failed: harness.widgets.routes() == [.eraseSnapshot, .reload]` | `901c950` |
| `e152992` | `AppModelTests.anAddWritesASecondSnapshotWithThePendingTask` | `Expectation failed: harness.widgets.routes() == [.writeSnapshot, .reload]` | `901c950` |
| `e152992` | `AppModelTests.aWorkspaceSwitchWritesTheNewWorkspacesToday` | `Expectation failed: harness.widgets.snapshot?.workspaceName == "side"` | `901c950` |
| `e152992` | `AppModelTests.aSignOutErasesTheSnapshotAndReloads` | `Expectation failed: harness.widgets.routes().suffix(2) == [.eraseSnapshot, .reload]` | `901c950` |
| `e152992` | `AppModelTests.aDayChangeWritesTheNewDayOnce` | `TodzKit/AppModel+Widgets.swift:7: Fatal error: AppModel.dayChanged is not implemented` | `901c950` |
| `e152992` | `AppModelTests.aLaunchStillLoadingLeavesTheWidgetFilesAlone` | pin: green on landing | — |
| `e152992` | `AppModelTests.aPullThatChangesNothingWritesNothing` | pin: green on landing | — |
| `9529097` | `AppModelTests.aColdLaunchWithACacheTakesAWaitingRequestOnceReady` | `Expectation failed: harness.model.waitingChangeCount == 1` | `044fc16` |
| `9529097` | `AppModelTests.aForgedRequestChangesNothingAndRewritesTheTrueSnapshot` | `Expectation failed: harness.widgets.storedRequests == []` | `044fc16` |
| `9529097` | `AppModelTests.aRequestForATaskAlreadyInThatStateEnqueuesNothing` | `Expectation failed: harness.widgets.storedRequests == []` | `044fc16` |
| `9529097` | `AppModelTests.aRequestIsStampedWithTheAppsClockNotItsOwn` | `Expectation failed: harness.model.outbox.head == .state(firstTask, .done, at: fixedInstant)` | `044fc16` |
| `9529097` | `AppModelTests.aDoneRowReopenedFromAWidgetReopensTheTask` | `Expectation failed: harness.service.calls.contains(.reopenTasks(...numbers: [1]))` | `044fc16` |
| `9529097` | `AppModelTests.whileLoadingTheRequestsStayUntouched` | pin: green on landing | — |
| `6ad233f` | `AppModelTests.aSignOutErasesTheSnapshotAndTheRequests` | `Expectation failed: harness.widgets.calls.first == .erase` | `71dc689` |
| `6ad233f` | `AppModelTests.aSignInAsAnotherOwnerErasesTheWidgetFilesBeforeTheFirstNewWrite` | `Expectation failed: routes.firstIndex(of: .erase).map { $0 < firstWrite } == true` and `harness.service.routes().contains(.completeTasks) == false` (the previous owner's request completed the new owner's task) | `71dc689` |
| `6ad233f` | `AppModelTests.aLaunchWhoseServerNamesAnotherOwnerErasesBeforeTheirFirstWrite` | `Expectation failed: routes.firstIndex(of: .erase)` | `71dc689` |
| `6ad233f` | `AppModelTests.aSessionEndedByTheServerErasesTheSnapshotAndKeepsTheRequestsForTheSameOwner` | pin: green on landing (step 5's signed-out publication already erases only the snapshot) | — |
| `72f7079` | `WidgetNotificationTests.theRequestsNotificationKeepsTheNameBothProcessesUse` | pin: green on landing | — |

### Hypotheses to attack

1. Hypothesis: the snapshot is written only when it differs from the last one written, and every write is followed by exactly one reload. Break it by: a pull that returns the same tasks, a refresh, a selection change, a window focus change; count writes in the shared folder.
2. Hypothesis: a widget's request reaches the outbox only for a task in the current Today, not already in the target state, stamped with the app's clock. Break it by: dropping a hand-written `requests/<UUID>.json` for another workspace's task, a task due tomorrow, a pending add, a task already done, and one with `at` in 1970.
3. Hypothesis: a symlink, a FIFO or a folder named like a request or a snapshot is refused and never followed; an unreadable request removes only itself. Break it by: symlinking `widget-snapshot.json` to another file, `mkfifo` under `requests/`, a broken JSON request between two good ones.
4. Hypothesis: `removeRequests` removes only names shaped `<UUID>.json` inside `requests/`. Break it by: a request name with `../`.
5. Hypothesis: sign-out, a sign-in as another owner and an owner switch found at launch erase the snapshot and every request before anything is written for the new owner; a 401 keeps the requests and the same owner's next sign-in sends them. Break it by: leaving a request, signing in as someone else, and checking the server never receives it.
6. Hypothesis: a launch still loading, a switch to a workspace whose projects are not loaded yet, and a load that failed with no cache never write a snapshot of the wrong workspace (the snapshot is erased until Today is known). Break it by: switching workspaces with the server slowed down and reading the file mid-switch.
7. Hypothesis: `dayChanged()` writes one snapshot with the new day and the overdue flags moved.
8. Hypothesis: a checkbox in the widget flips its row in place (O8) and a second tap with the same target state asks nothing, so a redrawn row never inverts.

### Known gaps

- The red-first runs that crashed on a `fatalError` stub report one line, not a per-test failure.
- A cached launch writes the cached owner's snapshot before the server confirms the owner, as the window shows that cache. When the server names another owner, the widget files are erased before the new owner's first write, but the old snapshot was on disk for that moment.
- The widget files go on with no error when the shared folder cannot be written: nothing is logged and no banner shows (spec, failure handling).
- Only pending adds: `WidgetToday.totalCount` is 0, so the ring's progress reads 0 of 0; the view decides what to draw then.
- The ordering of `requests()` follows file modification times. Two requests written within the file system's time resolution fall back to name order.
- A FIFO under `requests/` is refused by `O_NONBLOCK` and `fstat`, but no test makes one.

### What G2 must wire

- Pass `FileWidgetStore(folder:)` the shared folder of ADR 0033 (`~/Library/Application Support/dev.todz.widgets/` from the account's home directory) instead of the placeholder `Widgets` folder inside the app's container in `TodzApp.swift`.
- Keep `reloadWidgets: { WidgetCenter.shared.reloadAllTimelines() }`.
- Call `model.dayChanged()` on `NSCalendarDayChanged` (and on a time zone change, if wanted).
- Call `await model.takeWidgetRequests()` when the app becomes active and when the Darwin notification `WidgetNotification.requestsAdded` arrives. A launch and a sign-in already take them.
- In the extension: read with `FileWidgetStore.readSnapshot()`, draw `WidgetContent.of(snapshot:family:on:)` with the day of the snapshot's time zone, and in `ToggleTaskIntent` call `WidgetToggle.setting(...)`, then `addRequest`, then `writeSnapshot`, then post `WidgetNotification.requestsAdded`.
- Deviations to mirror in `plan.md`: the snapshot holds `open`, `pending` and `doneToday` instead of one `tasks` list (step 1), so the pending adds stay between the two sections after a row flips in place. The port gains `eraseSnapshot()` (step 3), so a 401 erases the snapshot and keeps the requests (step 7). `WidgetNotification` is the constant of ADR 0033, not a name built from a group identifier.
