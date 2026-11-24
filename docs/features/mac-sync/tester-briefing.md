# Tester briefing: Mac sync

Written by the developer sub-agents when their steps were done. The developers did not run `test-plan.md` and do not declare the feature works. The lane sections below (G1b, G2) keep their own detail; this part covers the whole feature.

## What changed

- `TodzKit` coding and cache (G0, G1a): `OwnerCoding.encoder()` writes dates as epoch milliseconds; the owner models encode back to the owner API's shapes; `SyncStore` and `FileSyncStore` keep `owner.json`, `projects/<id>.json` and `outbox.json` in a private `Cache` folder through `PrivateFile`.
- `TodzKit` outbox and pulls (G1b): `PendingChange`, `Outbox`, `TaskBoard.applying`, pending adds in `TaskViews`, `ProjectFeed.pull` from a cursor, `ReconnectDelay`, `ChangeSignals` and `SocketChangeSignals`.
- `TodzKit` model (G2): the cached launch, one owner per cache, task writes through the outbox and one send loop, one pull gate per project, a socket per shown project, `syncStatus`, `isRefreshing`, `waitingChangeCount`, the three new banners.
- App (G3, steps 19 to 22):
  - `Copy/SyncCopy.swift` (new) and `Copy/InflectedCopy.swift` (new: every count goes through the system's inflection, so one reads "1 change"); `TaskRowCopy.pending`, `pendingHelp`; `SignInCopy.sessionEndedWaiting(count:)`; `ErrorCopy.changesNotSaved(count:)` now inflects too.
  - `MainWindow/TaskList/SyncStatusItem.swift` (new): `wifi.slash` and `Offline` or `Offline · N changes waiting` before Refresh while offline; a click refreshes; one VoiceOver announcement when it appears.
  - `RefreshButton` and the Refresh command read TodzKit's `isRefreshing` (the app's shadow over `pullsInFlight` is gone); `TaskListState` reads `model.taskViews`, the board with the outbox applied.
  - The shell's in-flight `ProgressView`s, read-only fields and disabled rows are gone from `TaskRow`, `TaskCheckbox`, the Task menu, `TitleField`, `NotesEditor`, `DueDatePicker` and `AddTaskField`.
  - `PendingTaskRow` (new), `TaskRowTitle` (new, shared by both rows), `TaskSection.pendingTasks`, `TaskSections` (pending adds in Inbox, a project, Today and the Upcoming day groups), `TaskRows` (pending rows after the confirmed ones, selection disabled, no move; a double-click on no selection opens nothing).
  - TodzKit, new files of G3: `UpcomingDay.swift` and `TaskViews+Upcoming.swift` (`upcomingSchedule`: `upcomingDays` and `upcomingPendingDays` merged by day, confirmed tasks first), `CompletionLingers.swift` (per task, the list and place where it was checked; puts the done task back there, last when the list got shorter, never twice; `placement(moving:toOffset:in:)` turns a drag into a placement over the open tasks only, so a lingering row is never an anchor, never counted and never moved); tests `TaskViewsTests+Upcoming.swift` and `CompletionLingersTests.swift`.
  - `MainWindowState`: the checked row's linger (`completionLinger`, one second, per task, its own timer; animated unless Reduce Motion) over one `CompletionLingers`; every toggle goes through `MainWindowState.toggleDone(task:model:)`.
  - `TitleField`, `NotesEditor`: a focused field the owner has typed in keeps its text on a live update; one the owner has not typed in follows it.
  - `RootView`: the sign-out `.confirmationDialog`; `MainWindowState.requestSignOut(model:)` from the app menu, `WorkspaceSwitcher` and `FirstWorkspaceScreen`. `SignInScreen`: the waiting line.
  - Step 21: `AppModel.pullsInFlight`, `AppModel.unconfirmedDrafts`, the app's `isWriting(task:)`, `isSaving(task:field:)` and `DueDatePicker`'s issue line are deleted.
- `apps/macos/README.md`: the cache and the live sync in its purpose.

## How to run

The server, in `apps/api`, with a new scratch folder `<state>` and port 8787 free:

```
pnpm exec wrangler d1 migrations apply directory --local --persist-to <state>
pnpm exec wrangler dev --var SIGN_IN_PROVIDER:fake --persist-to <state> --port 8787
```

**Offline and back.** Stop the server with Ctrl-C; start it again with the same command, same `<state>` and port. The app notices a stop at its next request or when a socket drops; it notices the restart when a socket reopens (1, 2, 4, 8, 16, then every 30 seconds) or on ⌘R.

The app, from the repository root:

```
xcodegen generate --spec apps/macos/project.yml
xcodebuild build -project apps/macos/Todz.xcodeproj -scheme Todz -configuration Debug -derivedDataPath apps/macos/build
open apps/macos/build/Build/Products/Debug/Todz.app
```

Quit it with ⌘Q or `pkill -f Todz.app/Contents/MacOS/Todz`. The session file is `~/Library/Containers/dev.todz.Todz/Data/Library/Application Support/session`; the cache is the `Cache` folder beside it (`owner.json`, `projects/<id>.json`, `outbox.json`).

The unit suite: `swift test --package-path apps/macos/TodzKit` (308 tests in 22 suites at `429b77e`). The live suite: `TODZ_LIVE_API_URL=http://localhost:8787 swift test --package-path apps/macos/TodzKit --filter LiveOwnerAPITests`.

### A refused change: the forwarding proxy

The app talks to `http://localhost:8787` (`TodzAPIBaseURL`). Start the server on 8788 instead (`--port 8788`), then this proxy on 8787 from any folder. It forwards every request and every WebSocket upgrade to 8788, and answers the first `REFUSALS` task `PATCH`es (title, notes, due date, order) with `404 {"error":"task_not_found"}`, which the app treats as a refusal:

```
UPSTREAM_PORT=8788 PROXY_PORT=8787 REFUSALS=2 node --input-type=module -e "
import http from 'node:http';
import net from 'node:net';
const upstream = { host: '127.0.0.1', port: Number(process.env.UPSTREAM_PORT) };
let refusals = Number(process.env.REFUSALS);
const server = http.createServer((request, response) => {
  const isTaskPatch = request.method === 'PATCH' && /^\/owner\/projects\/[^/]+\/tasks\/\d+$/.test(request.url);
  if (isTaskPatch && refusals > 0) {
    refusals -= 1;
    request.resume();
    response.writeHead(404, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ error: 'task_not_found', number: Number(request.url.split('/').pop()) }));
    console.log('refused ' + request.method + ' ' + request.url);
    return;
  }
  const forwarded = http.request({ ...upstream, method: request.method, path: request.url, headers: request.headers }, (answer) => {
    response.writeHead(answer.statusCode, answer.headers);
    answer.pipe(response);
  });
  forwarded.on('error', () => { response.writeHead(502); response.end(); });
  request.pipe(forwarded);
});
server.on('upgrade', (request, socket, head) => {
  const upstreamSocket = net.connect(upstream.port, upstream.host, () => {
    const headerLines = Object.entries(request.headers).map(([name, value]) => name + ': ' + value).join('\r\n');
    upstreamSocket.write(request.method + ' ' + request.url + ' HTTP/1.1\r\n' + headerLines + '\r\n\r\n');
    upstreamSocket.write(head);
    socket.pipe(upstreamSocket).pipe(socket);
  });
  upstreamSocket.on('error', () => socket.destroy());
  socket.on('error', () => upstreamSocket.destroy());
});
server.listen(Number(process.env.PROXY_PORT));
"
```

To refuse several changes in one flush: stop the proxy (the app goes offline), rename two tasks, then start the proxy with `REFUSALS=2`. Checked with a stub upstream on 2026-11-24: the first `PATCH` answered 404 with the body above, the second was forwarded, a `GET` was forwarded, and an upgrade got `101` and echoed through.

### An agent's write while the window is open

With the app signed in as `walker-1` and the server above, take a second session, the Inbox's id and a project key:

```
curl -s -X POST http://localhost:8787/owner/sessions -H 'Content-Type: application/json' -d '{"identity_token":"walker-1","time_zone":"America/Sao_Paulo"}'
curl -s http://localhost:8787/owner/workspaces -H 'Authorization: Bearer <session>'
curl -s -X POST http://localhost:8787/owner/projects/<inbox id>/keys -H 'Authorization: Bearer <session>'
```

Then, from `apps/api` so Node resolves `@modelcontextprotocol/client`, without writing a file:

```
KEY=<key> node --input-type=module -e "
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
const client = new Client({ name: 'Claude Code', version: '1.0.0' });
const transport = new StreamableHTTPClientTransport(new URL('http://localhost:8787/mcp'), { requestInit: { headers: { Authorization: 'Bearer ' + process.env.KEY } } });
await client.connect(transport);
console.log(JSON.stringify(await client.callTool({ name: 'add', arguments: { tasks: [{ title: 'From the agent' }] } })));
await client.close();
"
```

No ⌘R: the project's socket says `changed` and the window pulls. Other tools of the same client (`list`, `done`, `update`) change titles, due dates and states the same way.

**Session ended.** Read `<secret>` from the session file and send `curl -X DELETE http://localhost:8787/owner/sessions/current -H 'Authorization: Bearer <secret>'`, or delete every session with `pnpm exec wrangler d1 execute directory --local --persist-to <state> --command "DELETE FROM sessions"` while the server is stopped.

## Red today, green after

Each red row was committed alone; the text is what the red run printed, copied from the commit bodies. The lane sections below map each to its green commit.

| Test | Red before the change because | Green after because |
|------|--------------------------------|---------------------|
| `OwnerCodingTests` dates (`e8cbbad`) | `Expectation failed: try encodedText(instant) == "\(millisecondsOfInstant)"`; `Expectation failed: try OwnerCoding.decoder().decode(Date.self, from: data) == instant`; the request body tests were pins | `5ce0518` |
| `OwnerModelsTests` round trip (`f031064`) | `TodzKit/OwnerModels.swift:101: Fatal error: TaskRecord.encode is not implemented; Owner.encode is not implemented` | `7c81049` |
| `FileSyncStoreTests` (`d39f8c2`) | `TodzKit/FileSyncStore.swift:12: Fatal error: FileSyncStore.readOwner is not implemented; FileSyncStore.writeProject is not implemented; FileSyncStore.writeOwner is not implemented (process exited with unexpected signal code 5)` | `31994c5` |
| `PendingChangeTests` (`0317081`) | `Fatal error: PendingChange.projectIdentifier is not implemented`; `DecodingError.dataCorrupted … TaskPatch is not implemented`; `EncodingError.invalidValue … PendingChange is not implemented`; two decoding failures were pins | `3dc434f` |
| `OutboxTests` (`0c9459b`) | `Fatal error: Outbox.appending is not implemented`; `Fatal error: Outbox.head is not implemented` | `52ca7fe` |
| `TaskBoardOverlayTests` (`c9fb1dc`) | `Fatal error: TaskBoard.applying is not implemented`; `Fatal error: TaskBoard.setting is not implemented` | `e49e616` |
| `TaskViewsTests` pending (`33f4f05`) | `Fatal error: TaskViews.pendingTasks is not implemented`; `aPendingAddLeavesEveryTaskListAsItWas` was a pin | `8015afa` |
| `ProjectFeedTests` (`f6e159e`) | `Fatal error: ProjectFeed.pull is not implemented` | `7f9e4a0` |
| `ReconnectDelayTests` (`433119d`) | `Fatal error: ReconnectDelay.after is not implemented` | `f2cde9f` |
| `SocketChangeSignalsTests` (`b481d46`) | `Fatal error: SocketChangeSignals.socketRequest is not implemented`; `Fatal error: SocketChangeSignals.watch is not implemented` | `1af2ed6` |
| `AppModelTests+Cache` launch (`269e7e8`) | `Expectation failed: harness.model.phase == .ready`; `Expectation failed: harness.model.banner == nil`; `Expectation failed: harness.store.calls == [.readOutbox]`; `Fatal error: AppModel.waitingChangeCount is not implemented` | `5a495cb` |
| `AppModelTests+Owners` (`ce28d60`) | `Expectation failed: harness.model.phase == .ready`; `isWatchingAtErase.value == false`; `isStoreErasedAtVaultErase.value == true`; `isUntouchedAtErase.value == true`; `harness.model.signInError == .unexpected`; `harness.store.routes().contains(.erase)`; `harness.store.owner == nil`; one pin | `93c6df1` |
| `AppModelTests+Outbox` (`3859ae1`) | `Expectation failed: harness.service.calls.contains(.updateTask(… patch: .title("Waiting")))`; `harness.model.waitingChangeCount == 0`; `Fatal error: SendOutcome.of is not implemented` | `39f2c63` |
| `AppModelTests+Pull` gates (`5423899`) | `Fatal error: AppModel.pullProject is not implemented` | `6146b42` |
| `AppModelTests+Watch` (`fa5688f`) | `Expectation failed: harness.signals.opens.last == harness.watchKey(gardenIdentifier)`; six tests hung on a read, pause or cancel that never came (run stopped by hand) | `a1a3867` |
| `AppModelTests+Cache` failures (`ea9768a`) | `Expectation failed: harness.store.calls.contains(.eraseProject(identifier: inboxIdentifier))`; `….contains(.writeOutbox(emptyOutbox))`; `harness.model.banner == .waitingChangesLost`; `Array(harness.store.routes().prefix(3)) == [.readOwner, .erase, .readOutbox]`; `harness.model.banner == .cacheNotSaved` | `658762c` |
| `AppModelTests+Pull` status (`f39d02a`) | `Fatal error: AppModel.syncStatus is not implemented` | `965585f` |
| `TaskBoardOverlayTests::aTaskReopenedAfterAMoveTakesItsPlaceByItsKeyAmongTheMovedTasks` (`8207230`) | `Expectation failed: try openTitles(applied) == ["B", "X", "Y", "A"]` | `61348c7` |
| `TaskViewsUpcomingTests` (`68b8173`) | `TodzKit/TaskViews+Upcoming.swift:3: Fatal error: TaskViews.upcomingSchedule is not implemented` | `8687e2a` |
| `CompletionLingersTests` (`209c8b9`) | `TodzKit/CompletionLingers.swift:9: Fatal error: CompletionLingers.toggling is not implemented` | `53aab63` |
| `CompletionLingersTests` drag placement (`9ab8ef0`) | `TodzKit/CompletionLingers.swift:62: Fatal error: CompletionLingers.placement is not implemented` | `429b77e`: `TaskRows` computes its moves with it |
| App views, G3 (`ad0a52f`, `c8848e4`, `2d11f33`) | no unit test: the app target has no test target and the `macos` gate runs `swift test` and `xcodebuild build` only, so the rest of steps 19 and 20 (the sign-in waiting line, the rows, the dialog, the status item) is proven by the walk | — |

## Hypotheses to attack

Every "it works" is a hypothesis. The lane sections hold the model's; these are the window's.

1. Hypothesis: online and idle the toolbar shows only Refresh and the inspector toggle; offline it shows `Offline`, and `Offline · 1 change waiting` / `Offline · 3 changes waiting` as changes join; clicking it refreshes; it disappears when a socket reopens. Break it by: stopping the server, checking, renaming and reordering offline, then restarting it; watch for "1 changes".
2. Hypothesis: VoiceOver announces `Offline` once when the item appears and nothing when it goes. Break it by: narrowing the window until the item moves to the toolbar's overflow and back while offline (a re-created item may announce again).
3. Hypothesis: a pending add sits last in Inbox, a project or Today with `circle.dashed` and no id; it cannot be selected, ↑ ↓ skip it, Return, Space, ⌘↩, a double-click, a right-click and a drag do nothing on it; VoiceOver reads its title, then `Not saved yet`. Break it by: adding three tasks offline, then arrowing through the list and dragging a confirmed row below them.
4. Hypothesis: on confirmation the pending row becomes a normal row in place, selected only if the selection did not move. Break it by: adding offline, selecting another task, then going online.
5. Hypothesis: a task checked in Inbox, a project or Today stays where it was, filled and struck through, for about a second, then leaves; a second click within the second reopens it in place; in Today it never shows in Done Today and the open list at once. Break it by: checking three rows quickly, by Space, ⌘↩, the inspector's checkbox and the VoiceOver action; with Reduce Motion on (the linger stays, the slide goes); dragging another row just below or above a lingering one (the move lands among the open tasks and is not refused).
6. Hypothesis: a focused title or notes field the owner has typed in keeps the typed text when an agent changes that field; on commit the owner's text wins; a focused field the owner has not typed in takes the agent's value. Break it by: focusing the title, letting the MCP script change it, then leaving the field without typing (the agent's title must survive).
7. Hypothesis: Sign Out signs out at once with no change waiting, and asks `Sign out and lose N changes?` when changes wait, from the app menu, the workspace switcher and the first-workspace screen; Return and Escape cancel; confirming shows Sign in with an empty cache. Break it by: offline with changes, pressing Return in the dialog.
8. Hypothesis: the sign-in screen says `Your session has ended. Sign in again to send N waiting changes.` whenever changes wait, after a 401 and after a relaunch; with none waiting it shows the shell's notice. Break it by: the session-ended walk with one and with two changes.
9. Hypothesis: one refused change shows `Your change wasn't saved.` with `todz now shows what it has saved.` and Dismiss; two refused in one flush show `2 changes weren't saved.`; the rows show the server's values. Break it by: the proxy with `REFUSALS=1`, then `REFUSALS=2`.
10. Hypothesis: no row, checkbox, field or add field shows a spinner or goes read-only during a write; the add field clears on Return and keeps focus. Break it by: adding and editing quickly online and offline.

## Known gaps

- No socket ping (ADR 0029): a socket the network drops silently is noticed only by the next failure (a write, ⌘R, a pull); changes made meanwhile show on the next pull.
- The views of steps 19 and 20 have no unit test (no app test target); only the Upcoming merge and the linger, moved into TodzKit, are unit-tested. The linger's one-second timer and its animation live in the app.
- An Upcoming pending row cannot be produced from the window: an add carries no due date, or today's in Today, so `upcomingPendingDays` is empty in practice; the merge is there for a pending add with a later due date.
- Live inserts, moves and removals are applied without an explicit animation; whether the system `List` animates them is for the walk to see.
- The offline announcement is posted when the item appears, so a toolbar that re-creates it (overflow) may announce again.
- Counts are formatted in the Mac's locale (`1.000 changes` in Portuguese settings).
- The G2 note that `changesNotSaved(count:)` is plain interpolation is outdated: it inflects since `ad0a52f`.
- `AppModelTests+Races.swift:95` warns `expression of type 'Workspace?' is unused` (test target, not from this lane).

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

## Security fixes (lane `lane/mac-sync-security`)

### What changed

- **Uncoded failures never drop a change.** `OwnerErrorBody`'s status map keeps only 401 → `unauthorized` and 503 → `signInUnavailable`; a bare 400 or 404 is now `unexpected(status:)`, so only a todz error body with a refusal code is refused. `AppModel.hasServerAnswered` is set by `noteAnswer()` (a request with a decoded answer, a loaded pull, a coded refusal) and read once per failed attempt by the send loop's `countAttempt`: without an answer since the change's previous attempt the loop waits without counting. ADR 0028 point 4, the `// NB ADR 0028:` line in `SendOutcome.swift` and the spec's failure handling say so.
- **Nothing is sent before the owner is confirmed.** `AppModel.isOwnerConfirmed` is set by sign-in's issued owner and by `confirmOwner()` (the old `sendTimeZone`, `PATCH /owner`), cleared with the session; `startSending` requires it, so an `opened` before the answer sends nothing. The launch now confirms at the top of `openListedWorkspaces` (no separate call), so a reload after an offline launch confirms before it lists and sends; a list that follows an unconfirmed owner stays outdated, so the next opened socket reloads again. A quiet reload that fails after another owner's cache was erased (phase `loading`) raises the load failure with Try again, as the launch did before. ADR 0027 point 4 and the spec's cached-launch bullet say so.
- **Sign-out never hides a failed erase.** `signOut` calls `store.erase()` first and directly; on failure the session, the vault, the window and its watches stay and `AppBanner.signOutFailed` shows `ErrorCopy.signOutFailed`. The watches are cancelled after the erase now, before the vault erase. ADR 0027 point 4 and the spec's sign-out bullet say so.
- **A sign-in whose erase fails signs the issued session out** (`try? await service.signOut(session:)`).
- ADR 0027 Consequences: a remote revocation (401) never removes the cached tasks; no UI change.

### Red today, green after

| Test | Red text | Commits |
| --- | --- | --- |
| `AppModelTests+Outbox::aTransientFailureWithNoAnswerBetweenNeverDropsTheChange` (7 failures) | `Expectation failed: waitingAtFourthAttempt.value == 1`, `harness.pause.durations == [.seconds(1), .seconds(2), .seconds(4)]`, `harness.model.banner == nil`, for every case | 16cf8b7 → 917bcd5 |
| `AppModelTests+Outbox::aThirdTransientFailureEachAfterAnAnswerDropsTheChangeAsRefused` | `Expectation failed: harness.service.routes().filter { $0 == .completeTasks }.count == 3` for `.bareNotFound` and `.bareBadRequest`; the other five cases are pins | 16cf8b7 → 917bcd5 |
| `AppModelTests+Outbox::aCodedRefusalDropsTheChangeAtOnce` | pin | 16cf8b7 |
| `OwnerAPITests::mapsEachRowOfTheErrorTable` | `expected error ".unexpected(status: 404)" of type OwnerAPIError, but ".notFound" of type OwnerAPIError was thrown instead`, and the same for 400 / `.invalidRequest`; the 511 row is a pin | 16cf8b7 → 917bcd5 |
| `AppModelTests+Owners::aLaunchSendsNothingBeforeTheSessionsOwnerIsConfirmedThenErasesAnotherOwnersCache` | `Expectation failed: harness.service.routes().contains(.updateTask) == false` (before and after the answer) | 4891427 → 9bcf56e |
| `AppModelTests+Owners::aLaunchAsAnotherOwnerWhoseListingFailsSaysSoWithTryAgain` | pin | 4891427 |
| `AppModelTests+Owners::aSignOutWhoseEraseFailsStaysSignedInWithTheVaultAndSaysSo` | `Expectation failed: harness.model.banner == .signOutFailed` and seven more | 0bc800d → 9730dcc |
| `AppModelTests+Owners::aSignInWhoseEraseFailsFailsSignsTheIssuedSessionOutAndLeavesTheVaultUntouched` | `Expectation failed: harness.service.calls.dropFirst() == [.signOut(session: harness.service.issuedSession.sessionToken)]` | 8963388 → c3395d2 |

`aThirdTransientFailureDropsTheChangeAsRefused` was replaced by the two transient tests above; `signOutCancelsTheWatchesThenErasesTheCacheThenTheVaultThenSignsOut` became `signOutErasesTheCacheThenCancelsTheWatchesThenErasesTheVaultThenSignsOut`; `aCachedLaunchWithTheServerDownWaitsForASocketToOpen` now expects `updateOwner` before `listWorkspaces` after the socket opens. The unit suite: 313 tests in 22 suites at c3395d2.

### Hypotheses to attack

1. Hypothesis: a captive portal never drops a waiting change. Break it by: changing the proxy above to answer every task write with `511` and an HTML page (and, separately, `200` with an HTML page, and a bare `404`), making three changes, pressing ⌘R several times; `outbox.json` keeps all three, no refused-change notice shows, and they land once the proxy forwards again.
2. Hypothesis: one change the real server keeps failing is still dropped at its third counted attempt. Break it by: answering only one task's `PATCH` with a bare `500` while everything else forwards (pulls succeed between attempts); the third attempt drops it with the notice and the others are sent.
3. Hypothesis: a stopped server never drops a change. Break it by: stopping `wrangler dev` behind the proxy (the proxy answers a bare `502`) for a minute with changes waiting; none is dropped.
4. Hypothesis: a cached launch whose session belongs to another owner sends nothing of the cache's outbox. Break it by: putting owner A's `session` file beside owner B's `Cache` folder with a waiting change, launching; the server never receives B's change and the folder is erased once `PATCH /owner` answers.
5. Hypothesis: an offline cached launch sends its outbox once the server returns. Break it by: launching with the server stopped and changes waiting, then starting it; `PATCH /owner` then `GET /owner/workspaces` precede the sends.
6. Hypothesis: a sign-out whose erase fails leaves the owner signed in and says so. Break it by: making the `Cache` folder unremovable (`chflags uchg` on a file inside it), signing out; the banner shows, the window stays, and the session file is still there.

### Known gaps

- A bare 401 still ends the session (vault erased, signed-out screen); the cache and outbox are kept, so nothing is lost and the same owner resumes, but a portal or proxy answering 401 would sign the owner out. The Worker's 401 always carries `WWW-Authenticate: Bearer`, which a hardening could require; not done.
- An owner whose `PATCH /owner` is refused with `time_zone_invalid` is never confirmed, so their outbox waits until a later launch confirms (sign-in refuses that zone too, so only a zone that turns invalid after sign-in hits this). Each opened socket reloads the workspaces in that state. The Worker has a read-only owner route that could confirm instead.
- When the owner is confirmed as another owner inside a reload started by a socket (an offline launch after two failed erases), the erase cancels that reload, so its listing fails and the load failure shows with Try again.
- `plan.md`'s outcome table (transient row) and `test-plan.md` still describe the old counting rule; they are the lead's to update.

## Tester pass 1 fixes

| Fix | What changed | Red text |
|---|---|---|
| D1: Offline never appears while only sockets fail | A current watch's failure other than `unauthorized` now notes the connection (`AppModel+Watch.swift`), so `unreachable` sets Offline with nothing waiting; a coded `notFound` stays online. Test `anUnreachableWatchMarksTheModelOfflineBeforeItReconnects`; pins: `aStaleWatchsFailureLeavesTheNewSessionOnline`, `aMissingProjectKeepsTheModelOnlineWhileItsWatchReloads` | `Expectation failed: harness.model.syncStatus == .offline(waiting: 0)` |
| A project that leaves the list keeps its file | `followActiveProjects()` erases the project file and board rows of each project that left (`forgetProject(identifier:)` in `AppModel+Cache.swift`); a workspace switch stops the watches first and erases nothing. Tests `aProjectThatLeavesTheListHasItsProjectFileErased` (red), `aWorkspaceSwitchErasesNoProjectFile` (pin) | `Expectation failed: harness.store.calls.contains(.eraseProject(identifier: launchIdentifier))` and `Expectation failed: harness.model.board.tasks(projectIdentifier: launchIdentifier).isEmpty` |

Re-check D1: sign in with the server up and nothing waiting, stop the server, touch nothing. The status shows Offline within the first reconnect delay and clears on the next opened socket. Known gap: the board cursor of a left project stays in memory until the next sign-in.

## Review fixes (lane `lane/mac-sync-review`)

The unit suite: 329 tests in 22 suites at f906eba; the app builds.

| Fix | What changed | Red text | Commits |
|---|---|---|---|
| 1. An unconfirmed owner stops the outbox for good | `startSending()` with the owner unconfirmed calls `requestWorkspaceReload()` (which confirms first), so an opened socket, a successful pull, a new write and ⌘R all retry; no reload is requested while a listing runs (`workspaceListingsInFlight`). A refused `time_zone_invalid` confirms through `GET /owner` (`OwnerService.readOwner`, new). Unconfirmed with changes waiting, `syncStatus` is `.offline(waiting: n)`. ADR 0027 point 4 says so | `Expectation failed: harness.model.syncStatus == .offline(waiting: 2)` and `.offline(waiting: 1)`; `Expectation failed: harness.service.calls.contains(.completeTasks(…numbers: [2]))`, `…contains(.updateTask(…"Waiting"…))`, `…waitingChangeCount == 0`; `Expectation failed: Array(harness.service.calls.prefix(2)) == [.updateOwner(…), .readOwner(…)]`; `aRefusedZoneAtLaunchShowsNothingAndGoesOn` now asserts the send: `…waitingChangeCount == 0`, `…tasksOfProject["acme-inbox"]?.first?.title == "Waiting"`; `OwnerAPI.swift:72: Fatal error: OwnerAPI.readOwner is not implemented` | 0dd226e → cfe3bcb |
| 2. A 404 on a pull never reloads | `ProjectPull.notFound`: counts as an answer, no banner, one workspace reload; also on the refusal's pull from 0 | `Expectation failed: harness.model.activeWorkspace?.projects.map(\.identifier) == [inboxIdentifier]` (both tests); `Expectation failed: harness.model.syncStatus == .online` | 371464f → 4c35147 |
| 3. Offline flaps behind a proxy that blocks sockets | A watch failure marks Offline only when no HTTP answer arrived since that watch's previous failure or opening (`isWatchAnswered`); a watch that never opened nor failed still marks Offline | `Expectation failed: harness.model.syncStatus == .online` | 5a989c9 → 19d6b05 |
| 4. Callers await the whole drain | Each pull is its own task after the one before; a trigger joins the one waiting pull or queues it and gets that pull back; `refresh()` and activation await only the pulls they joined, in turn on the main actor; a refusal asks for its pull from 0 without waiting | `Expectation failed: harness.model.isRefreshing == false`; `Expectation failed: harness.service.routes() == [.completeTasks, .updateTask, .readChanges]` | 05ab764 → 966f2f0 |
| 5. The write budget allowed 100 ms | `FileSyncStoreTests` budget is 16 ms (median printed 0.0076 s) | pin | f906eba |
| 6. A cancelled reload erases a newer reload's handle | Each reload takes an identifier; it clears `workspaceReload` only while the identifier is still its own | `Expectation failed: harness.model.workspaceReload != nil` | 916cb6c → d7ba644 |
| D2. An answer before an outage counts an attempt | An unreachable send clears `hasServerAnswered`, so the next uncoded failure without an answer counts nothing | `Expectation failed: harness.model.outbox == Outbox().appending(.state(firstTask, .done, at: fixedInstant), isHeadSent: false)` | 30b23da → ddf86a0 |

The earlier known gaps "a 404 on a pull does not ask for a workspace reload" and "an owner whose zone is refused is never confirmed" are closed by fixes 2 and 1.

### Hypotheses to attack

1. Hypothesis: a cached launch whose `PATCH /owner` fails (5xx) after a socket opened still sends. Break it by: a proxy answering `PATCH /owner` with a bare 503 once, launching with changes waiting; the status says Offline with the count, and the first ⌘R, write or `changed` after the proxy forwards again sends `PATCH /owner`, `GET /owner/workspaces`, then the changes.
2. Hypothesis: a refused zone confirms the owner. Break it by: a proxy answering `PATCH /owner` with `400 {"error":"time_zone_invalid"}`; `GET /owner` follows and the outbox is sent.
3. Hypothesis: a cached launch sends one `PATCH /owner` and one listing even when sockets open first. Break it by: counting requests at the proxy during a cached launch.
4. Hypothesis: a project deleted elsewhere leaves the sidebar on its next pull. Break it by: deleting a project through the API while the window shows it, then ⌘R.
5. Hypothesis: behind a proxy that refuses WebSocket upgrades, Offline does not reappear on the reconnect right after an HTTP answer. Break it by: such a proxy, then ⌘R; the status stays online across the next reconnect.
6. Hypothesis: ⌘R ends while an agent writes steadily through MCP; the Refresh button never spins past its own pull.

### Known gaps

- Fix 1: a trigger that arrives while a listing runs requests no reload; if that listing's confirmation failed, the next trigger after it retries.
- Fix 3: with sockets blocked and no HTTP traffic, the second failure after an answer still marks Offline; the status stays Offline until the next answer.
- Fix 6: after fix 1's guard, a newer reload can no longer start while another lists; the test reaches the race by cancelling through `stopWatching()` before the first reload runs.

## Re-review fixes (lane `lane/mac-sync-rereview`)

The unit suite: 333 tests in 22 suites, green three runs in a row; the app builds.

| Fix | What changed | Red text | Commits |
|---|---|---|---|
| 1. One failed `PATCH /owner` stalls the outbox on a cached launch | A workspace listing that ends with the owner unconfirmed and a change waiting schedules one reload after `ReconnectDelay.after(attempt:)` (`retryOwnerConfirmation()` in `AppModel+Watch.swift`), the attempt growing per failed confirmation and reset on confirmation; `stopWatching()` cancels it. ADR 0027 point 4 says so. `aLaunchWhoseOwnerUpdateFailsOnceConfirmsOnALaterPullAndSends` became `aLaunchWhoseOwnerUpdateFailsOnceConfirmsAfterTheReconnectDelayAndSends` (no explicit pull); `anOwnerUpdateThatKeepsFailingIsTriedAgainAfterGrowingDelays`, `aSignOutCancelsTheOwnerUpdateWaitingToBeTriedAgain` are new | `Expectation failed: harness.model.ownerConfirmationRetry` (all three; the red commit adds the handle, unset) | 61ffaa6 → c51afab |
| 2. Offline on the first socket failure after answered pulls | A watch starts with `isWatchAnswered` set to `hasServerAnswered`. `anUnreachableWatchMarksTheModelOfflineBeforeItReconnects` now fails its watch before any answer (a cached launch held at `PATCH /owner`); `anAnswerBetweenTwoWatchFailuresKeepsTheModelOnline` starts from the second failure. New `aWatchsFirstFailureAfterAnsweredPullsKeepsTheModelOnline` | `Expectation failed: harness.model.syncStatus == .online` | 3fa2bfe → 8fbea77 |
| 3. The refused zone's owner read was tested only with the same owner | `aLaunchWhoseZoneIsRefusedAndWhoseOwnerReadNamesAnotherOwnerErasesTheCacheAndSendsNothing`; mutation: ignoring the read's answer turns it red at the erase, the count, the titles and the stored owner | pin | 48be545 |

### Hypotheses to attack

1. Hypothesis: a cached launch whose `PATCH /owner` fails once (a bare 503 at a proxy), with the sockets already open and changes waiting, sends them about one second later with nothing touched. Break it by: that proxy, then waiting; `PATCH /owner`, `GET /owner/workspaces`, then the changes, and the status turns online.
2. Hypothesis: while `PATCH /owner` keeps failing, the asks space out 1, 2, 4 … 30 seconds and stop after a sign-out.
3. Hypothesis: behind a proxy that blocks socket upgrades, the status stays online after the launch's pulls through the first reconnect, and turns Offline only after a failure with no HTTP answer since the one before.

### Known gaps

- D1 changes shape: with the server up and then stopped and nothing touched, Offline now shows at the second socket failure (after the first reconnect delay), not the first.
- Fix 1: a workspace switch cancels the scheduled ask; the switch's own pulls ask again when they answer.
- Fix 1: once a session's owner is confirmed it is never unconfirmed, so the reset on confirmation has no observable test.
