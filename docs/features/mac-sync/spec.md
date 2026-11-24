# Mac sync

**Status:** Building
**Tier:** 🔴
**Owner approval:** approved 2026-11-24, by inheritance from [the v1 product design](../../product/README.md) (Order of delivery, item 6; macOS app → Sync; Calls made without the owner: last write wins per field), approved by the owner on 2026-11-23; the calls below that the product design does not make are ADRs or design decisions marked as the loop's calls and listed in the loop's questions for the owner
**ADRs:** [0022](../../adr/0022-the-owner-api-is-json-routes-and-the-app-builds-the-cross-project-views.md), [0023](../../adr/0023-each-project-numbers-its-changes-and-its-socket-only-says-changed.md), [0025](../../adr/0025-the-session-secret-lives-in-a-private-file-until-the-app-has-a-team.md), [0027](../../adr/0027-the-app-caches-each-owner-s-data-as-json-files-in-its-own-container-until-it-has-a-team.md), [0028](../../adr/0028-the-app-s-task-writes-are-optimistic-and-go-through-a-persisted-outbox.md), [0029](../../adr/0029-the-app-pulls-each-project-from-its-cursor-when-its-socket-says-changed.md)
**Not changing:** `apps/api`, `libs/core`, `libs/types` and the owner API contract ([owner-api spec](../owner-api/spec.md)). No App Group, widget extension or widget timeline reloads (`widgets`), no menu bar extra, no "Connect an agent", no delete. Workspace and project sheets and sign-in still wait for the server. Nothing is deployed or signed with a team.

## Problem

The shell forgets everything at quit, reads every project from cursor 0 on each launch, switch and ⌘R, waits for the server on every write, and never hears about an agent's change until the owner presses ⌘R. The product design asks for a local cache, a queue of writes while offline, pulls from a cursor, and the "changed" socket.

## Goals

- **Cache** (ADR 0027): the owner's workspaces, the active workspace and each project's tasks and cursor survive a relaunch. A launch with a session and a cache shows the cached window at once, then pulls.
- **Outbox** (ADR 0028): add, complete, reopen, title, notes, due date and order apply on screen at once, are persisted, and are sent in order while the server is reachable. A pending add shows as a pending row until the server gives it a number.
- **Pull from the cursor** (ADR 0029): each pull asks only for the changes after the project's stored cursor; `cursor_ahead` replaces the project's tasks from 0.
- **Live** (ADR 0029): one socket per project of the shown workspace; `changed` pulls that project; an opening socket sends the outbox and pulls.
- **Conflicts:** last write wins per field by the order the server applies writes; no conflict screen.
- **Privacy:** the cache belongs to one owner. Sign-out and a sign-in as another owner erase it first; a 401 keeps it for the same owner.
- The sync states of [`design.md`](design.md): the status, pending rows, the refused-change notice and the sign-out confirmation when changes are waiting.

## Non-goals

- The App Group container and the widget timelines: the cache moves there in `widgets`, once there is a signing team.
- Editing, completing or opening a pending add before the server confirms it.
- Offline creation or renaming of workspaces and projects.
- A conflict screen, field-level merge or Mac-clock timestamps.
- A polling timer or `NWPathMonitor`.
- History offline: the inspector's history still loads from the server and shows its failed state offline.

## Design

Screens, states and copy: [`design.md`](design.md).

### Data flow

```
launch ─▶ vault.read ─ secret ─▶ store.readOwner ─ cache ─▶ board from projects/*.json ─▶ phase ready (no network yet)
                                       │ none                 │
                                       ▼                      ▼
                                 loading screen        outbox from outbox.json, overlaid on the board
                                       │                      │
                                       └──────────┬───────────┘
                                                  ▼
                        PATCH /owner { time_zone } ─▶ GET /owner/workspaces ─▶ store.writeOwner
                                                  ▼
                 for each project of the active workspace:
                   pull: GET …/changes?cursor=<stored> … until has_more = false
                         ─▶ board.merge ─▶ store.writeProject(cursor, tasks)
                         409 cursor_ahead ─▶ pull from 0 ─▶ board.reset + merge
                   watch: WS …/socket (Bearer) ── "changed" ─▶ pull (one at a time, one queued)
                                               └─ opened ─▶ send the outbox, then pull

owner writes ─▶ outbox.append (coalesce) ─▶ store.writeOutbox ─▶ screen = board ⊕ outbox
                    │
                    ▼ send the head while reachable
                 answer ─▶ remove head ─▶ board.replace(server record) ─▶ store.writeOutbox + writeProject
                 unreachable ─▶ stop; status offline; resume when a socket opens, on ⌘R, at launch
                 refused ─▶ drop head ─▶ pull its project from 0 ─▶ notice once
                 unexpected ×3 ─▶ drop as refused
                 401 ─▶ stop; keep cache and outbox; sign-in screen
```

### `TodzKit`

| File | Holds |
|---|---|
| `OwnerModels.swift`, `OwnerEnums.swift`, `CalendarDate.swift`, `TaskDraft.swift`, `TaskPatch.swift`, `TaskPlacement.swift` | become `Codable` where the cache needs them, encoding the owner API's own shapes (snake_case, epoch milliseconds) so a cached file decodes with the same decoder as an answer |
| `OwnerCoding.swift` | `encoder()`, which already encodes request bodies, writes dates as epoch milliseconds, the mirror of `decoder()`; request bodies are unchanged |
| `SyncStore.swift` | the port (ADR 0027): `readOwner() throws -> OwnerCache?`, `writeOwner(_:)`, `readProject(identifier:) throws -> ProjectCache?`, `writeProject(_:)`, `eraseProject(identifier:)`, `readOutbox() throws -> Data?`, `writeOutbox(_ data: Data)`, `erase()`; the outbox crosses the port encoded |
| `FileSyncStore.swift` | the `Cache` folder in Application Support: `owner.json`, `projects/<id>.json` (an id is a file name only after it matches `^[A-Za-z0-9-]{1,64}$`), `outbox.json`; `0700` folders, `0600` files written atomically, excluded from backups, through `PrivateFile`, the write `FileSessionVault` now shares |
| `OwnerCache.swift`, `ProjectCache.swift` | `OwnerCache { ownerIdentifier, workspaces, activeWorkspaceIdentifier }`, `ProjectCache { projectIdentifier, cursor, tasks }` |
| `PendingChange.swift` | `enum PendingChange: Codable`: `add(projectIdentifier:draft:)`, `field(TaskKey, TaskPatch)` for title, notes, due date and order, `state(TaskKey, TaskState, at: Date)` for complete and reopen, with the time of the click |
| `Outbox.swift` | value type over the changes and their attempts: `appending(_:isHeadSent:)` replaces the last waiting change of the same task and field that is not the head being sent, except order changes, which are always appended (moves are relative, so their sequence must match the screen's); `head`, `removingHead()`, attempts per head (3), `droppingChanges(projectIdentifier:)`, `pendingTasks` |
| `TaskBoard.swift` | gains each project's cursor and `applying(_ outbox:) -> TaskBoard`: every change applies in outbox order against the board the previous ones left, so a move is placed where the server will place it; a project that had moves gives its open tasks display order keys in the resulting order |
| `ProjectFeed.swift` | `pull(session:projectIdentifier:cursor:)` returns `ProjectChanges { tasks, cursor, isFromStart }`, where `isFromStart` says the pull restarted from 0 after `cursorAhead` |
| `ChangeSignals.swift` | the port for sockets: `watch(session:projectIdentifier:) -> AsyncThrowingStream<ChangeSignalEvent, Error>` with `opened` and `changed`; fails with `OwnerAPIError.unauthorized`, `notFound` or `unreachable`, and ends without an error only when cancelled |
| `SocketChangeSignals.swift` | `URLSessionWebSocketTask` on `ws://…/owner/projects/<id>/socket` with `Authorization: Bearer`; `opened` from the delegate's `didOpenWithProtocol`; a failure reads the task's `response` status in `didCompleteWithError` |
| `ReconnectDelay.swift` | 1, 2, 4, 8, 16, then 30 seconds, by attempt |
| `TaskViews.swift` | reads the overlaid board; `pendingTasks(for:)` gives the pending adds of the Inbox, a project or Today, `upcomingPendingDays` those due later; none in Done |
| `AppModel*.swift` | `AppModel` gains a `SyncStore`, a `ChangeSignals` and an injected `pause(Duration)`; new extensions `AppModel+Cache.swift`, `AppModel+Outbox.swift`, `AppModel+Watch.swift`, `AppModel+Pull.swift`; task writes go through the outbox instead of `write(target:)`; one pull gate per project; `syncStatus`, `isRefreshing` and `waitingChangeCount` for the design's states. The rules are `plan.md` steps 12 to 18 |

### `Todz` (app target)

`TodzApp.swift` injects `FileSyncStore` beside the session folder and `SocketChangeSignals` with the same base URL. The views of [`design.md`](design.md): the sync status, pending rows, the refused-change notice, the sign-out confirmation. Sockets close when the app terminates.

### Failure handling

Copy keys are those of [`design.md`](design.md).

- **Unreachable** on a pull with a cache → the cached rows stay; the status says offline; no banner. Without a cache → the shell's banners, unchanged.
- **Unreachable** on a send → the change stays at the head; the status says offline with the count waiting.
- **Refused** on a send (`rule_violated`, `task_not_found`, `not_found`, `invalid_request`, `inbox_is_fixed`, `cursor_ahead`, `time_zone_invalid`, `identity_rejected`) → the change is dropped, its project is pulled from 0 when shown, and the refused-change notice shows once per flush with the count.
- **Unreachable** or **unexpected** (including 503 and an answer that does not decode) on a send → kept; the send waits the reconnect delay and tries again, cut short by an opening socket, a successful pull, a new write or ⌘R; the third unexpected failure of one change, each after a wait, drops it as refused.
- **An answer after a workspace switch** → the change still leaves the outbox; a project no longer shown takes the record into its cache file, not the board.
- **A cached launch with the server down** → the watches of the cached workspace open at launch, so the first socket that opens lists the workspaces, sends the outbox and pulls.
- **401** anywhere → the shell's sign-in screen with "session ended" and the count of waiting changes; sockets and the send loop stop; the cache and outbox stay. The next sign-in as the same owner loads the cache and sends the outbox. A sign-in as another owner, or with no `owner.json`, empties the in-memory state and erases the cache before the new session is stored; if the erase fails, the sign-in fails.
- **Stale work** → a send loop, pull or watch started under another session drops its result and writes nothing; a stale watch's 401 never ends the new session.
- **Sign-out** with changes waiting → the design's confirmation; confirmed, the cache and outbox are erased, then the session.
- **Unreadable cache files** → ADR 0027 § 5: a project file is erased and pulled from 0; an owner file erases the cache; an outbox file is erased and `ErrorCopy.waitingChangesLost` shows once.
- **Unwritable cache** → the app goes on in memory and raises `ErrorCopy.cacheNotSaved` once per launch (`design.md` § 1.9).
- **A pull's answer for a task with a waiting change** → the board takes the server's record; the screen keeps the waiting field on top until its answer arrives.
- **A project that leaves the workspace** (404 on its socket or pull) → the workspaces reload; its waiting changes are dropped as refused.
- **Two Macs** → each sends its own outbox; the server applies whichever arrives last per field.
- **Logs:** nothing about tasks, sessions or cache paths with ids.

## Open questions → answers

| Question | Options | Owner's answer | Date |
|----------|---------|----------------|------|
| Where and how is the cache kept without a team? | JSON files in the app container / SwiftData / GRDB / App Group now | Loop's call: JSON files per owner in the app's container ([ADR 0027](../../adr/0027-the-app-caches-each-owner-s-data-as-json-files-in-its-own-container-until-it-has-a-team.md)); listed for the owner | 2026-11-24 |
| How do writes queue and resolve? | persisted outbox, optimistic / memory only / wait for the server / Mac timestamps | Loop's call: a persisted, ordered, optimistic outbox; server order wins per field ([ADR 0028](../../adr/0028-the-app-s-task-writes-are-optimistic-and-go-through-a-persisted-outbox.md)); listed for the owner | 2026-11-24 |
| When does the app pull, and how does it learn of changes? | socket per project / poll / path monitor | Loop's call: a socket per shown project, pulls from the cursor, reconnect with backoff ([ADR 0029](../../adr/0029-the-app-pulls-each-project-from-its-cursor-when-its-socket-says-changed.md)); listed for the owner | 2026-11-24 |
| The design's open choices | see [`design.md`](design.md) | Loop's calls: the designer's recommendations, recorded in `design.md`; listed for the owner | 2026-11-24 |

## Rollback

Nothing is deployed. Reverting the merge brings back the shell; the `Cache` folder stays in the app's container and is ignored by the shell; deleting `~/Library/Containers/dev.todz.Todz/Data/Library/Application Support/Cache` clears it. Changes still in an outbox at that moment are lost.

## Test strategy summary

Swift Testing in `TodzKit`: the `Codable` round trip of every cached shape against the decoder of answers; `FileSyncStore`'s modes, atomic writes, erase and unreadable files; `Outbox` coalescing, the order rule and attempts; `TaskBoard.applying` for every field and for sequences of moves; `TaskViews` with pending adds; `ProjectFeed` from a cursor and after `cursorAhead`; `ReconnectDelay`; and `AppModel` over fakes of `OwnerService`, `SyncStore` and `ChangeSignals`: the cached launch, offline writes and their flush in order, refusals, three unexpected failures, a 401 mid-flush, sign-in as the same and another owner, sign-out with changes waiting, a `changed` during a pull, socket reconnects. The live suite against `wrangler dev` gains the socket. The tester walks the built app with Orca against `wrangler dev`, including a stopped server and an agent writing through MCP while the window is open (ADR 0026).
