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
