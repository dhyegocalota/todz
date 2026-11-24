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

## G2 app and extension (steps 8 to 11)

### What changed

- `apps/macos/project.yml`: the `TodzWidgets` app extension (`dev.todz.Todz.widgets`, WidgetKit, macOS 14), embedded in `Todz`, linked to `TodzKit`, ad hoc and sandboxed. Both targets carry `com.apple.security.temporary-exception.files.home-relative-path.read-write` for `/Library/Application Support/dev.todz.widgets/` and the Info.plist key `TodzSharedFolder`; the app's Info.plist gains the URL scheme `todz`. The `Todz` scheme builds the extension only as the app's embedded dependency, and only locally (the `macos` gate's build line is unchanged).
- `apps/macos/Copy/`: the old `Todz/Copy`, compiled into both targets (O11), plus `WidgetCopy`, `WidgetSampleCopy` and `AccessibilityCopy.todayIn(workspace:)`.
- `TodzKit`: `SharedFolder` (the folder from the Info.plist key under the account's home, from `getpwuid(getuid())`, and its `0700` creation), `UnavailableWidgetStore` (keeps nothing, so the app runs when the folder cannot be made), `WidgetLink` (`todz://today`, `todz://task/<project>/<number>`, both ways), `AppModel.follow(_:)` (Today with no task, or the task when it is in the current Today).
- `TodzWidgets/`: the bundle, `TodayTimelineProvider` (entries now and at the next midnight of the snapshot's time zone, policy `.never`; the gallery gets the sample when there is no snapshot), the three kinds, the views of design.md §§ 1 to 5, and `ToggleTaskIntent`.
- `Todz/`: `AppDelegate` now owns the model and the window state. It takes the widget requests on `applicationDidBecomeActive` and on the Darwin notification, calls `dayChanged()` on `NSCalendarDayChanged`, and receives the links in `application(_:open:)`. `MenuBarLabel`, alive for the whole process, follows the waiting link and opens the main window as the popover does.

### How to run

The server and the app as in the mac-sync briefing (`wrangler dev --var SIGN_IN_PROVIDER:fake` on 8787, then the `macos` gate's `xcodegen generate` and `xcodebuild build` lines). Launch without drawing on the owner's screen with `open -g -j apps/macos/build/Build/Products/Debug/Todz.app`; quit with `pkill -x Todz`.

- The files: `~/Library/Application Support/dev.todz.widgets/widget-snapshot.json` and `requests/<UUID>.json` (`stat -f %Lp` prints `600`, the folder `700`). JSON keys are snake case; `at` is milliseconds since 1970.
- A widget tap without a widget: write `requests/<UPPERCASE-UUID>.json` with `{"project_identifier": "<id>", "number": <n>, "state": "done", "at": <ms>}` (mode 600), then `notifyutil -p dev.todz.widgets.requests`.
- The widgets on the desktop (they draw on the owner's screen, so ask him first): right-click the desktop, Edit Widgets, search "todz", add Today's Progress, Next Up and Today (medium and large).
- The links: `open -g todz://today` and `open -g "todz://task/<project id>/<number>"` (these open the main window).

The developer's hidden launch at `9f01710` (signed in against a seeded local server, two tasks due today): `widget-snapshot.json` appeared with mode `600` in a `700` folder, holding both tasks; `pluginkit -m -i dev.todz.Todz.widgets` printed `dev.todz.Todz.widgets(0.1.0)` at the build's `PlugIns/TodzWidgets.appex`; no consent alert (`orca … get-app-state --app com.apple.UserNotificationCenter` found no window). A request file for task 1 plus `notifyutil -p dev.todz.widgets.requests` emptied `requests/`, the server logged `POST …/tasks/complete 200`, and the snapshot moved task 1 to `done_today`. The owner's earlier session file was restored and the proof's cache and shared folder removed afterwards.

The unit suite went from 417 tests to 442 in 31 suites, all green.

### Red today, green after

| Red commit | Test | Red failure printed | Green commit |
|---|---|---|---|
| `e0edf4f` | `SharedFolderTests` (8 tests) | `TodzKit/SharedFolder.swift:5: Fatal error: SharedFolder.of is not implemented` | `c96e6be` |
| `e0edf4f` | `UnavailableWidgetStoreTests` (5 tests) | `TodzKit/UnavailableWidgetStore.swift:3: Fatal error: UnavailableWidgetStore is not implemented` | `c96e6be` |
| `0c31a14` | `WidgetLinkTests` (5 tests) | `TodzKit/WidgetLink.swift:8: Fatal error: WidgetLink.init is not implemented` and `TodzKit/WidgetLink.swift:12: Fatal error: WidgetLink.url is not implemented` | `28d70ba` |
| `0c31a14` | `AppModelTests` link tests (7 tests) | `TodzKit/AppModel+Links.swift:3: Fatal error: AppModel.follow is not implemented` | `28d70ba` |

Views, the intent and the project wiring have no unit seam: `94f9343`, `b45a1b8` and `9f01710` carry the build output.

### Hypotheses to attack

1. Hypothesis: a placed widget reads the shared folder from inside its own sandbox with no consent prompt. Break it by placing each widget after a fresh build.
2. Hypothesis: a checkbox flips its row in place at once, the counts move, a second tap reopens it, and with the app running the app takes the request within a second or two and moves the row into the done group. Break it by tapping fast, twice, and on the last open task.
3. Hypothesis: with the app quit, a tapped row stays done until the next launch, which sends it once.
4. Hypothesis: a snapshot of another day, a missing or unreadable snapshot, and a signed-out app all draw the prompt with no checkbox. Break it by editing `day`, writing `{` into the file, symlinking it, and signing out.
5. Hypothesis: `todz://today` opens the main window on Today with no task; a task link opens it with that task and the inspector shown only when the task is in the current Today, else Today; both work with the main window closed and with the app quit; no link writes. Break it with another workspace's task, a task due tomorrow, a malformed link and a non-numeric number.
6. Hypothesis: a forged `notifyutil -p dev.todz.widgets.requests` only triggers an intake.
7. Hypothesis: the app writes the new day's snapshot at midnight (`NSCalendarDayChanged`), and the widgets' midnight entry shows the prompt at most until then.
8. Hypothesis, not a pass or fail: how long the system takes to redraw the widgets of a background app after `reloadAllTimelines`.

### Known gaps

- ADR 0033's local risk until a team: any process the owner runs outside the sandbox can read today's titles in the shared folder and drop a request for one of today's tasks.
- The extension's own read of the folder is unobserved until a widget is placed; only the app's write and intake were run.
- The deep links, the widget views and the checkbox were never drawn: no widget was placed and no link was opened, so nothing drew on the owner's screen.
- Deviations from the steps, for `plan.md`: ~~"the files move unchanged (they depend only on Foundation and TodzKit)" (O11)~~: two copy files used `ChangeActor+Line` and `IdentityFormat`, so both moved to `Copy` with `DayFormat`, which the widgets need for the overdue label. ~~Copy strings only in `Copy`~~: the intent's title and parameter titles are literals in `ToggleTaskIntent`, because the App Intents metadata processor refuses anything but a literal; they are never shown. The model and the window state moved from `TodzApp` to `AppDelegate`, so the delegate's notifications and links reach them; the window is opened by the menu bar label, the one view alive for the whole process, because only a view holds `openWindow`. The checkbox is beside the row's link, not inside it, so each is its own accessibility element. `AppModel+Links.swift` is a new `TodzKit` file beyond the two helpers the step named.
- A Today holding only pending adds draws the ring's caption as "0 of 0 done".
- The gallery shows the prompt, not the sample, when the stored snapshot is of another day.
- No time zone change observer; `NSCalendarDayChanged` only.
- ~~`AGENTS.md`'s layout line for `apps/macos` still names only the `Todz` target over `TodzKit`; it is outside this lane's files.~~ Fixed in `7f0d5fc`.
- The old placeholder folder `Application Support/Widgets` inside the app's container, if G1's builds ever wrote it, is not removed.

## Fix round 1 (review and security findings)

### What changed

- S1 `FileWidgetStore`: a snapshot reads at most 1 MiB and a request at most 4 KiB. After `fstat`, a file past its cap is unreadable (an oversized request is removed by the existing path); the read asks for the cap plus one byte.
- S2 `AppModel`, `AppModel+Cache`, `AppModel+Widgets`: `eraseWidgets()` no longer throws. Sign-out clears the session, the vault and the server's session whatever the widget erase does; a sign-in or a launch that finds another owner goes on. Only the cache erase still gates them.
- S3 `FolderStatus` (new), `SharedFolder.owned`, `FileWidgetStore`, the extension's `FileWidgetStore.shared`: the shared folder and `requests/` are opened with `O_NOFOLLOW | O_DIRECTORY`, must be directories owned by `getuid()`, and are set to `0700` through the descriptor. A refused shared folder leaves the app on `UnavailableWidgetStore` and the extension with no store; a refused `requests/` is unreadable (no listing, no removal).
- S4 `AppModel.widgetRequestsAdded()`, `AppDelegate+Widgets`, `FileWidgetStore`: the Darwin notification starts one intake and skips while one runs; the store walks `requests/` with an enumerator and examines at most 500 entries a pass before keeping the 50 oldest. An intake that finds nothing writes nothing.
- R1 `AppModel+Links`: a link followed while the launch is loading, or while the active workspace's first load is pending, waits in the model and is followed once that settles. `isFirstLoad(of:)` moved to `AppModel+Workspaces` and is shared with the widget snapshot.
- R2 `ToggleTaskIntent`: writes the snapshot, then the request. After a notification's intake, the app reads the snapshot file and republishes when it no longer holds what the app last published or cannot be read (signed out, that erases it). Deviation: the finding asked to republish without any equality check; comparing with the file instead keeps a flood of forged notifications to one read each, never a write and a reload (S4).
- R3 `eraseWidgets()` reloads the widgets.
- R4 the intake removes the request files first and takes them only when the removal succeeded.
- R5 the six `NB ADR 0032` pointers name ADR 0033; the store's pointer also names the size cap.
- R6 `IdentityFormat` moved from `apps/macos/Copy` to TodzKit (public); `SignInCopy` imports TodzKit. For `plan.md` step 8's deviation note: `IdentityFormat` no longer lives in `Copy`.

The unit suite went from 442 tests in 31 suites to 461 in 32, all green, eight repeated runs of `AppModelTests` stable. The `macos` gate's `xcodegen generate` and `xcodebuild build` lines built with no warning.

### Red today, green after

| Red commit | Test | Red failure printed | Green commit |
|---|---|---|---|
| `bda3d64` | `FileWidgetStoreTests.refusesASnapshotLargerThanItsCap` | `Expectation failed: an error was expected but none was thrown and "Optional(TodzKit.WidgetSnapshot(...))" was returned` | `7c8badf` |
| `bda3d64` | `FileWidgetStoreTests.removesARequestLargerThanItsCapAndReadsTheOthers` | `Expectation failed: try store.requests().map(\.request) == [request(2)]` | `7c8badf` |
| `7c8badf` | `FileWidgetStoreTests.refusesASparseHundredGigabyteSnapshotWithoutReadingIt` | landed with the fix: on the red code it would read 100 GiB | — |
| `02cae6f` | `AppModelTests.aSignOutWhoseWidgetEraseFailsStillSignsOut` | `Expectation failed: harness.model.phase == .signedOut(notice: nil)` | `7ca2723` |
| `02cae6f` | `AppModelTests.aSignInAsAnotherOwnerGoesOnWhenTheWidgetEraseFails` | `Expectation failed: harness.model.signInError == nil` | `7ca2723` |
| `02cae6f` | `AppModelTests.aLaunchWhoseServerNamesAnotherOwnerGoesOnWhenTheWidgetEraseFails` | `Expectation failed: harness.model.phase == .ready` | `7ca2723` |
| `14669f7` | `SharedFolderTests.aFolderThatExistsOpenToOthersIsMadePrivate` | `Expectation failed: try modeOfFile(at: folder) == privateFolderMode` | `4082570` |
| `14669f7` | `SharedFolderTests.aSymlinkedFolderIsRefusedAndItsTargetLeftAlone` | `Expectation failed: SharedFolder.created(folder) == nil` | `4082570` |
| `14669f7` | `FileWidgetStoreTests.refusesASymlinkedRequestsFolderAndRemovesNothingInIt` | `Expectation failed: an error was expected but none was thrown` (the removal) | `4082570` |
| `20ce210` | `AppModelTests.aRequestWhoseRemovalFailsIsNotTaken` | `Expectation failed: harness.model.waitingChangeCount == 0` | `8916680` |
| `85ffdc2` | `AppModelTests.aFloodOfNotificationsRunsOneIntakeAtATime` | `Expectation failed: harness.widgets.routes().filter { $0 == .requests }.count == 1` | `af33c7c` |
| `4eb70b9` | `AppModelTests.aSnapshotRedrawnByTheExtensionIsRewrittenAfterTheNotification` | `Expectation failed: harness.widgets.snapshot == truth` | `60cf5f0` |
| `4eb70b9` | `AppModelTests.aNotificationWithNothingRedrawnWritesNothing` | `Expectation failed: harness.widgets.routes() == [.requests, .readSnapshot]` | `60cf5f0` |
| `4eb70b9` | `AppModelTests.aSnapshotLeftAfterASignOutIsErasedOnTheNextNotification` | `Expectation failed: harness.widgets.snapshot == nil` | `60cf5f0` |
| `7c073a8` | `AppModelTests.aWidgetEraseReloadsTheWidgetsAtOnce` | `Expectation failed: harness.widgets.routes().prefix(2) == [.erase, .reload]` | `085d2a6` |
| `cd9b6b4` | `AppModelTests.aLinkFollowedBeforeTheLaunchFinishesRevealsTheTaskOnceTodayIsLoaded` | `Expectation failed: harness.model.selectedTask == dueTodayTask` | `2973890` |
| `c4eb218` | `IdentityFormatTests` (3 tests) | pin: green on landing (the rule moved unchanged) | — |

R5, the intent's reorder and the 500-entry cap have no unit seam: the build is their proof, and the enumeration order is the file system's.

### Hypotheses to attack

1. Hypothesis: a sparse 100 GB `widget-snapshot.json` or `requests/<UUID>.json` never grows the app's or the extension's memory; the snapshot draws the prompt and the request file disappears at the next intake. Break it with `truncate -s 100G`.
2. Hypothesis: with `widget-snapshot.json` made immutable (`chflags uchg`), sign-out still reaches the sign-in screen, the session file is gone and a sign-in as another owner opens their workspace.
3. Hypothesis: replacing `~/Library/Application Support/dev.todz.widgets` or its `requests/` with a symlink to another folder makes the app write and remove nothing there, and the folder's mode goes back to `700` when it was opened wider.
4. Hypothesis: a loop of `notifyutil -p dev.todz.widgets.requests` with nothing waiting writes no snapshot and reloads nothing (watch the file's modification time); with 10,000 junk files in `requests/` an intake stays quick.
5. Hypothesis: `open -g "todz://task/<project>/<number>"` with the app quit opens the main window and, once Today has loaded, shows that task.
6. Hypothesis: a snapshot edited by hand while the app runs is rewritten after the next `notifyutil -p dev.todz.widgets.requests`.
7. Hypothesis: a request file the app cannot remove (`chflags uchg`) is never sent to the server, however many activations follow.

### Known gaps

- The owner check (`st_uid == getuid()`) has no test: making a folder owned by another account needs root.
- A link followed while loading waits in the model; the inspector is shown only if the owner had not hidden it, because `MainWindowState.follow` sees no task yet when it decides.
- ADR 0033 does not yet state the best-effort erase, the size caps or the symlink refusal. The erase pointer in `AppModel+Widgets` says "a failed erase never keeps a session or a cache", which the record should say too; the symlink rule carries no pointer.
