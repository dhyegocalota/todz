# Tester briefing: <Feature title>

Written by the developer sub-agent when its steps are done. The developer does not run `test-plan.md` and does not declare the feature works.

## What changed

- <file or module> — <one line>

## How to run

```bash
<commands to start the stack and open the feature>
```

## Red today, green after

| Test | Red before the change because | Green after because |
|------|--------------------------------|---------------------|
| `<path>::<name>` |  |  |

## Hypotheses to attack

Every "it works" is a hypothesis the tester tries to break.

1. Hypothesis: <claim>. Break it by: <suggested attack>.

## Known gaps

- <what the developer knows is missing or untested>

## Lane G1b: outbox, overlay, pull from a cursor, sockets (steps 5 to 11)

### What changed

- `TaskDraft`, `TaskKey`, `TaskPatch`, `TaskPlacement`: `Codable`; a patch decodes its one key, `null` notes or due date to the clearing case.
- `PendingChange`, `PendingChangeKind`: the outbox's change, encoded with a `kind`.
- `Outbox`, `PendingTask`: coalescing per task and field, moves always appended, three attempts per head, drop by project, pending adds.
- `TaskBoard`: `applying(_:)` overlays the outbox in order; each project's cursor.
- `TaskViews`, `PendingTaskDay`: pending adds for Inbox, a project, Today and the upcoming days.
- `ProjectFeed`, `ProjectChanges`, `ProjectPull`: a pull from a cursor returns the last cursor and whether it restarted from 0; the shell still pulls from 0.
- `ReconnectDelay`, `ChangeSignals`, `ChangeSignalEvent`, `SocketChangeSignals`: the backoff and the project socket.

### How to run

From `apps/macos/TodzKit`: `swift test`. Live: in `apps/api`, migrate a scratch `--persist-to` folder, start `wrangler dev --var SIGN_IN_PROVIDER:fake` on a free port, then `TODZ_LIVE_API_URL=http://localhost:<port> swift test --filter LiveOwnerAPITests`.

### Red today, green after

| Test | Red before the change because | Green after because |
|------|--------------------------------|---------------------|
| `PendingChangeTests` | `PendingChange is not implemented` (throwing stubs); two decoding failures were pins | the kind-keyed coding |
| `OutboxTests` | `Fatal error: Outbox.appending is not implemented` | `Outbox` |
| `TaskBoardOverlayTests` | `Fatal error: TaskBoard.applying is not implemented` | `TaskBoard.applying`, cursors |
| `TaskViewsTests` (pending) | `Fatal error: TaskViews.pendingTasks is not implemented`; `aPendingAddLeavesEveryTaskListAsItWas` was a pin | `pendingTasks(for:)`, `upcomingPendingDays` |
| `ProjectFeedTests` | `Fatal error: ProjectFeed.pull is not implemented` | `ProjectChanges` |
| `ReconnectDelayTests` | `Fatal error: ReconnectDelay.after is not implemented` | `ReconnectDelay` |
| `SocketChangeSignalsTests` | `Fatal error: SocketChangeSignals.socketRequest is not implemented` | `SocketChangeSignals` |

### Hypotheses to attack

1. Hypothesis: a sequence of moves, completes and reopens overlaid on the board shows the order the server will reach. Break it by: a move after a task reopened by the outbox (its letter key sorts after the overlay's digit keys).
2. Hypothesis: an outbox written by one build decodes in the next. Break it by: decoding a hand-edited `outbox.json` with a `placement` of kind `last`, or a patch with two keys.
3. Hypothesis: a socket that the server closes after `opened` ends the watch with `unreachable`. Break it by: stopping `wrangler dev` while a watch is open.
4. Hypothesis: a cancelled watch closes its socket and releases its session. Break it by: cancelling many watches and watching the server's open sockets.

### Known gaps

- A cancelled watch ends without an error, not with `CancellationError` (plan step 11, struck through with the reason); the spec's `ChangeSignals` row still says `CancellationError`.
- A server close after `opened` and texts other than `changed` have no automated test; both follow from the status mapping and the message filter.
- `Outbox` and `SocketChangeSignals` each hold a private helper type in their file (`WaitingChange`, `SocketWatch`); the lane owned no other file to put them in.

## G2 model: cache, owners, outbox, pulls, watches, status (steps 12 to 18)

### What changed

- `AppModel.swift`: the model takes a `SyncStore`, `ChangeSignals` and a `pause`; launch opens the cache before any request; sign-in checks the cached owner before the vault; sign-out erases the cache before the vault; `request` sets the sync status; `forgetWindow` stops watches, sends and pulls.
- `AppModel+Cache.swift` (new): reading `owner.json`, the project files and the outbox, writing them, erasing on unreadable files, `cacheNotSaved` once per launch.
- `AppModel+Outbox.swift` (new): task writes append to the outbox; one send loop per session; answers, refusals, waits, attempts; the add's selection.
- `AppModel+Pull.swift` (new): `refresh`, `isRefreshing`, `syncStatus`, one pull gate per project, banners only for projects with nothing to show.
- `AppModel+Watch.swift` (new): watches matched to the active projects, events, reopen with backoff, one coalesced workspace reload.
- `AppModel+Tasks.swift`: writes go through the outbox; title and notes over the limit refused inline.
- `AppModel+Workspaces.swift`: quiet and loud workspace loads, project files read on activate, owner file written on every change.
- `SendOutcome.swift`, `SyncStatus.swift` (new); `AppBanner` gains `changesRefused(count:)`, `cacheNotSaved`, `waitingChangesLost`.
- `TaskBoard.swift`: a task the outbox reopens after a move in its project takes its place by its key (the overlay edge); the manual-order comparison now lives in `PositionedTask` (pin refactor). `SocketChangeSignals` builds its path from `OwnerAPI`'s `projectPath` (pin refactor).
- `Todz/TodzApp.swift`: injects `FileSyncStore` on `<Application Support>/Cache`, `SocketChangeSignals` and `Task.sleep`.
- Tests: `InMemorySyncStore`, `FakeChangeSignals`, `HeldPause`; `AppModelTests+Cache`, `+Owners`, `+Outbox`, `+Pull`, `+Watch`. Shell tests that tested the replaced write path were removed or rewritten in the green commits that replaced it (each commit body lists them).

### How to run

From `apps/macos/TodzKit`: `swift test` (290 tests). App: `xcodegen generate --spec apps/macos/project.yml`, then `xcodebuild build -project apps/macos/Todz.xcodeproj -scheme Todz -configuration Debug -derivedDataPath apps/macos/build`.

### Red today, green after

| Test | Red before the change because | Green after because |
|------|--------------------------------|---------------------|
| `AppModelTests+Cache` (launch) | `Expectation failed: harness.model.phase == .ready`; `Expectation failed: harness.store.calls == [.readOutbox]`; `Fatal error: AppModel.waitingChangeCount is not implemented` | the cached launch, 269e7e8 → 5a495cb |
| `AppModelTests+Owners` | `Expectation failed: isUntouchedAtErase.value == true`; `Expectation failed: harness.model.signInError == .unexpected`; `Expectation failed: isStoreErasedAtVaultErase.value == true`; `aSessionEndedKeepsTheCacheAndTheWaitingChanges` was a pin | owner checks and sign-out order, ce28d60 → 93c6df1 |
| `AppModelTests+Outbox` | `Fatal error: SendOutcome.of is not implemented`; `Expectation failed: harness.service.calls.contains(.updateTask(…"Waiting"…))` | the outbox and its send loop, 3859ae1 → 39f2c63 |
| `AppModelTests+Pull` (gates) | `Fatal error: AppModel.pullProject is not implemented` | pull gates, 5423899 → 6146b42 |
| `AppModelTests+Watch` | `Expectation failed: harness.signals.opens.last == harness.watchKey(gardenIdentifier)`; six tests hung waiting for a read, pause or cancel that never came (run stopped by hand) | watches, fa5688f → a1a3867 |
| `AppModelTests+Cache` (failing cache) | `Expectation failed: harness.model.banner == .cacheNotSaved`; `Expectation failed: Array(harness.store.routes().prefix(3)) == [.readOwner, .erase, .readOutbox]`; `Expectation failed: harness.model.banner == .waitingChangesLost` | ea9768a → 658762c |
| `AppModelTests+Pull` (status) | `Fatal error: AppModel.syncStatus is not implemented` | f39d02a → 965585f |
| `TaskBoardOverlayTests::aTaskReopenedAfterAMoveTakesItsPlaceByItsKeyAmongTheMovedTasks` | `Expectation failed: try openTitles(applied) == ["B", "X", "Y", "A"]` | 8207230 → 61348c7 |

### Hypotheses to attack

1. Hypothesis: one owner's tasks never show in another owner's window. Break it by: signing in as owner B after owner A's 401 with changes waiting; after B's sign-in, `~/Library/Containers/dev.todz.Todz/Data/Library/Application Support/Cache` holds only B's files and A's waiting changes are never sent under B's session.
2. Hypothesis: a stale task never writes. Break it by: holding a pull or a send (stop the server mid-request), signing out and in again, then letting it answer; no project file, owner file or outbox write follows the sign-out.
3. Hypothesis: the send loop exits on a 401 and on a session change, and restarts on sign-in, an opened socket, a successful pull and a new write. Break it by: a 401 mid-flush (the rest stays waiting and the sign-in line counts it), then signing in as the same owner.
4. Hypothesis: triggers during a pull coalesce into one more pull from the stored cursor. Break it by: an agent writing several tasks quickly through MCP while the window is open; each `changed` must not start a pull of its own.
5. Hypothesis: a cached launch with the server down shows the cached window, says offline and recovers by itself when the server comes back. Break it by: launching with `wrangler dev` stopped, then starting it.
6. Hypothesis: a task reopened offline in a project with a waiting move shows where the server will put it. Break it by: moving a task, then reopening a done task of the same project offline, then going online.

### Leftovers G3 must delete (step 21)

- `AppModel.pullsInFlight`: never written now; the app's `AppModel+Window.isRefreshing` still reads it and shadows TodzKit's `isRefreshing`.
- `AppModel.unconfirmedDrafts`: always empty.
- `writesInFlight` never holds a task target now, so `isWriting(task:)` and `isSaving(task:field:)` in `AppModel+Window.swift` are always false; `writesInFlight` still serves the workspace and project sheets.
- `ruleIssues` for task fields now only holds the inline `TextCheck` issues; the server never fills them for tasks.
- The task writes (`addTask`, `complete`, `reopen`, `updateTitle`, `updateNotes`, `updateDueDate`, `move`) stay `async` for the views' call sites but return as soon as the change is queued.
- `ProjectPull` is still used by the gate; nothing else of the shell's pull path remains.

### Known gaps

- With the lead's approval, two app-target files of G3's were touched only to keep the app building: `Todz/Copy/AppBanner+Copy.swift` maps the three new banners, and `Todz/Copy/ErrorCopy.swift` gains the design § 8 strings `changesNotSaved(count:)`, `changeNotSavedBody`, `cacheNotSaved` and `waitingChangesLost`. The count is plain interpolation, not the system's inflection (design § 4); one refusal shows `changeNotSaved`. The app's `isRefreshing` in `AppModel+Window.swift` was left for G3.
- `refresh()` kicks the send loop (cutting its wait short) and awaits the pulls; it does not wait for the flush, so `isRefreshing` covers the pulls only.
- A 404 on a pull marks the project failed but does not ask for a workspace reload; only a socket's 404 does.
- The refused-change count of a project dropped from the list while no flush runs carries into the next flush's banner.
- `waitingChangesLost` is raised each time an unreadable outbox is read (launch, then sign-in), not once per launch; the empty outbox written at the first read makes the second read succeed in practice.
- The overlay places a reopened task by the server keys of the tasks the outbox did not move; where it lands among moved tasks the server's new keys decide, which the overlay cannot know.
