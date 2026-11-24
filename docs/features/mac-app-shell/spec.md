# Mac app shell

**Status:** Building
**Tier:** 🔴
**Owner approval:** approved 2026-11-24, by inheritance from [the v1 product design](../../product/README.md) (Order of delivery, item 5; Views; macOS app; Stack; Calls made without the owner), approved by the owner on 2026-11-23; the calls below that the product design does not make are ADRs or design decisions marked as the loop's calls and listed in the loop's questions for the owner
**ADRs:** [0020](../../adr/0020-sign-in-goes-through-a-provider-port-and-v1-ships-only-the-fake.md), [0021](../../adr/0021-owner-sessions-are-bearer-secrets-that-last-90-days.md), [0022](../../adr/0022-the-owner-api-is-json-routes-and-the-app-builds-the-cross-project-views.md), [0023](../../adr/0023-each-project-numbers-its-changes-and-its-socket-only-says-changed.md), [0024](../../adr/0024-the-macos-app-is-an-xcodegen-project-over-a-local-swift-package.md), [0025](../../adr/0025-the-session-secret-lives-in-a-private-file-until-the-app-has-a-team.md), [0026](../../adr/0026-a-native-app-is-walked-with-computer-use-and-recorded-from-its-screenshots.md)
**Not changing:** `apps/api`, `libs/core`, `libs/types` and the owner API contract ([owner-api spec](../owner-api/spec.md)). No local cache, offline queue or socket (`mac-sync`), no menu bar extra, no widgets, no "Connect an agent" screen, no delete. Nothing is deployed or signed with a team.

## Problem

The owner API exists, but nothing a person can use talks to it. The product needs its native macOS main window: sign in, a first workspace, the sidebar, the task list and the inspector, against the local Worker.

## Goals

- `apps/macos`: an XcodeGen project with the `Todz` app target and the local `TodzKit` package (ADR 0024), built ad-hoc signed and sandboxed, reaching `wrangler dev` on localhost.
- Sign in through the fake provider with a development identity and the Mac's time zone; keep the session in the vault (ADR 0025); a 401 anywhere signs out.
- A first sign-in with no workspace asks for the workspace's name (ADR 0022).
- The main window of the product design: the workspace switcher, Inbox, Today, Upcoming, Done, the projects; the task list; the inspector with project, due date, how the task was added, notes and history.
- The owner's task writes: add, complete, reopen, edit title, notes and due date, reorder by drag in the Inbox and project views. Create and switch workspaces, create and rename projects (the Inbox cannot be renamed).
- Views computed in the app from each project's change feed, read from cursor 0 into memory, in the Mac's own calendar. Launch and a workspace switch reset the board and pull each project of the active workspace from 0; ⌘R pulls each project from 0 into the held board, so rows stay while it runs; the shell keeps no cursor between pulls.
- The Mac's time zone reaches the server at sign-in and, when a session exists, with `PATCH /owner` at every launch, so the app's Today and the agents' due windows (ADR 0018) agree.
- A `macos` gate in `pnpm verify` (ADR 0024).

## Non-goals

- Persistence of tasks between launches, a pull loop, the "changed" socket, offline writes (`mac-sync`). The shell reloads on launch, on a workspace switch and on ⌘R.
- Sign in with Apple, a signing team, the App Group, the Keychain.
- The menu bar extra, the widgets, ⌘1–⌘9, "Connect an agent".
- Deleting or archiving anything (open question for the owner).
- Search in the window.

## Design

Screens, states, copy and keyboard paths: [`design.md`](design.md).

### Data flow

```
launch ─▶ SessionVault.read ─ nil ─▶ SignInScreen ── identity + TimeZone.current.identifier
              │ secret                                 │ POST /owner/sessions
              ▼                                        ▼
   PATCH /owner { time_zone }                vault.write(session_token)
              ▼                                        │
         GET /owner/workspaces ◀───────────────────────┘
              │ [] ─▶ FirstWorkspaceScreen ── POST /owner/workspaces
              ▼
   active workspace (last chosen in this launch, else the oldest)
              │ for each project, concurrently:
              ▼ GET /owner/projects/:id/changes?cursor=N … until has_more = false
   TaskBoard: [project id: [task number: TaskRecord]] (409 cursor_ahead → drop the project's tasks, pull from 0)
              │
              ▼ TaskViews (pure): Inbox · Today (+ Done today) · Upcoming · Done · Project
   MainWindow ── a write ─▶ owner API ─▶ the returned task replaces its copy in TaskBoard
              any 401 ─▶ vault.erase ─▶ SignInScreen
```

### `TodzKit` (Swift package, no UI)

| File | Holds |
|---|---|
| `OwnerModels.swift` | `Owner`, `Workspace`, `Project`, `TaskRecord`, `ChangeActor`, `HistoryEntry`, `ChangePage`, `IssuedSession`: `Decodable`, `Sendable`, `Equatable`, decoded with `.convertFromSnakeCase`; times are epoch milliseconds turned into `Date` at decoding |
| `OwnerEnvelopes.swift` | the answer wrappers: `OwnerAnswer { owner }`, `WorkspacesAnswer { workspaces }`, `WorkspaceAnswer { workspace }`, `ProjectAnswer { project }`, `TaskAnswer { task }`, `AddedTasksAnswer { tasks: [{ task, replayed }] }`, `CompletedTasksAnswer { tasks: [{ task, already_done }] }`, `ReopenedTasksAnswer { tasks: [{ task, already_open }] }`, `HistoryAnswer { history }`; the client unwraps them, so `OwnerService` answers the inner values |
| `TaskLimits.swift` | the limits the copy interpolates and the app checks before sending: title 200, notes 20 000, names 80 characters, mirrored from `libs/core` |
| `OwnerEnums.swift` | `TaskState`, `ActorKind`, `TaskField`, `HistoryAction`, `PlacementKind`, `RuleIssue`: `String` raw values identical to `libs/types`; an unknown raw value fails decoding |
| `CalendarDate.swift` | `CalendarDate` (`year`, `month`, `day`), parsed from and formatted to `YYYY-MM-DD`, `Comparable`; `CalendarDate.today(in: TimeZone, at: Date)` |
| `OwnerAPIError.swift` | `enum OwnerAPIError: Error, Equatable`: `unauthorized`, `identityRejected`, `signInUnavailable`, `notFound`, `taskNotFound(number:)`, `inboxIsFixed`, `cursorAhead`, `ruleViolated(issue:index:)`, `timeZoneInvalid`, `invalidRequest`, `unreachable`, `unexpected(status:)` |
| `OwnerAPI.swift` | `protocol OwnerService: Sendable`, one `async throws` method per route the shell uses; every method but `signIn` takes `session: String`, so one service is injected before sign-in and the session lives in `AppModel` (read from the vault at launch, written after sign-in); `struct OwnerAPI: OwnerService` over `URLSession` and a base URL, sending `Authorization: Bearer <session>`; error bodies mapped by `error` code to `OwnerAPIError`; a `URLError` → `unreachable` |
| `SessionVault.swift`, `FileSessionVault.swift` | the port and its file implementation (ADR 0025) |
| `TaskBoard.swift` | value type: the tasks of each project of the active workspace, `merge(project:tasks:)`, `replace(project:task:)`, `reset(project:)`; a copy replaces the held one only when its `updatedAt` is not older, so a late answer or a stale page never rolls a task back |
| `ProjectFeed.swift` | pulls one project's changes from a cursor until `has_more` is false, restarting from 0 once on `cursorAhead` |
| `TaskViews.swift` | pure: `inbox`, `today` (open, due ≤ today, earliest due, then the project's sidebar position, then order key, then task number; then done with `completedAt` today, newest first), `upcoming` (open, due > today, same order), `done` (done, newest `completedAt` first, then project position, then task number), `project` (open, order key); order keys compare in byte order |
| `TaskPlacementRequest.swift` | turns a move in the visible open list (a drag, or Move Up and Move Down) into `first` (to the top) or `after <the task above>`, or `nil` when nothing moves; `before` is never sent |
| `AppModel.swift` | `@MainActor @Observable final class AppModel`: `phase` (`signedOut(notice)`, `naming`, `ready`), the session, workspaces, active workspace, selected sidebar item and task, `TaskBoard`, the tasks and fields in flight, the load state per project, the banner, and every action; depends only on `OwnerService`, `SessionVault`, a clock and a time zone, all injected |

Routes used: `SignIn`, `SignOut`, `UpdateOwner`, `ListWorkspaces`, `CreateWorkspace`, `CreateProject`, `RenameProject`, `AddTasks`, `UpdateTask`, `CompleteTasks`, `ReopenTasks`, `ReadHistory`, `ReadChanges`. Keys, the socket and `ReadOwner` are left to later features.

An idempotency key (`UUID().uuidString`, lowercased) is made once per add and reused when the owner presses Try Again on that add, so a retried add never duplicates.

### `Todz` (app target)

`TodzApp.swift` builds one `AppModel` with `OwnerAPI(baseURL:)` from the Info.plist key `TodzAPIBaseURL` (`http://localhost:8787` in the checked-in configuration) and `FileSessionVault` in Application Support, which in the sandbox is `~/Library/Containers/dev.todz.Todz/Data/Library/Application Support/session`. A missing or malformed key stops the app at launch with a `fatalError` naming the key: a build without its API URL is a build error, not a state. Views: `RootView` (by phase), `SignInScreen`, `FirstWorkspaceScreen`, `MainWindow` (`NavigationSplitView`: `SidebarView`, `TaskListView`, `InspectorView`), `TaskRow`, `HistoryList`, and the copy enums of `design.md`.

### Configuration

`project.yml`: bundle id `dev.todz.Todz`, deployment target macOS 14.0, Swift 6 language mode, `CODE_SIGN_IDENTITY = "-"`, App Sandbox with `com.apple.security.network.client`, `NSAllowsLocalNetworking`, `TodzAPIBaseURL` in Info.plist. `.gitignore` gains the generated project and the derived data folder.

### The `macos` gate

`scripts/verify-gates.tsv` maps `apps/macos/*` to class `product`, gates `macos`, directly before the `apps/*` row and after the README rows, so `apps/macos/README.md` stays class `docs`. `gate_macos` runs `swift test` in `apps/macos/TodzKit`, then `xcodegen generate` and `xcodebuild build -scheme Todz -derivedDataPath apps/macos/build`. `macos` joins `ALL_GATES`, so `pnpm verify all` runs it. A missing `swift` or `xcodegen`, or an `xcodebuild` whose `-version` fails (the Command Line Tools shim), fails the gate with the doctor's fix line; the doctor reports `xcodegen` as optional and checks `xcodebuild -version`. `scripts/verify.test.sh` pins the new row and the gate's failure text.

### Failure handling

Copy keys are those of [`design.md`](design.md) § 4.

- 401 on any call → erase the vault once, stop starting requests, back to sign-in with `SignInCopy.sessionEnded`.
- `unreachable` → the screen keeps what it shows and raises `ErrorCopy.networkTitle` with Try Again; nothing is queued.
- `ruleViolated` → the field that sent it shows the issue's copy (`ErrorCopy.titleEmpty`, `titleTooLong`, `notesTooLong`, `nameEmpty`, `nameTooLong`, `dueDateInvalid`, else `ruleUnexpected`); the task is unchanged locally.
- `notFound`, `taskNotFound` on a write → reload the active workspace and raise `ErrorCopy.taskGone`, `projectGone` or `workspaceGone`.
- Some projects fail to pull while others answer → their rows show, plus `ErrorCopy.someProjectsFailed` with Try Again, which pulls only the failed projects from 0.
- The session file exists but cannot be read at launch → `signedOut` with `SignInCopy.sessionUnreadable` (ADR 0025: shown, never silent); the next sign-in overwrites the file.
- The vault cannot write after a successful sign-in → the app goes on with the session in memory and raises `ErrorCopy.sessionNotSaved`.
- `timeZoneInvalid` at sign-in → `SignInCopy.timeZoneInvalid` under the slot; at the launch `PATCH /owner` → nothing shown, the stored zone stays.
- A write never changes `TaskBoard` before the server answers: the shell shows the server's state only; the task or field in flight shows its waiting state (`design.md` § 1.5, § 1.6).
- Two writes on one task in flight: the copy with the newer `updatedAt` wins, as the server's last write does.
- Logs: the app logs nothing about tasks; no `print`, no `os_log` of titles, notes or tokens.

## Open questions → answers

| Question | Options | Owner's answer | Date |
|----------|---------|----------------|------|
| How is the Swift code cut, tested, signed and gated? | package + thin app / app only / hand-made project / pnpm package | Loop's call: XcodeGen over `TodzKit`, Swift Testing, ad-hoc signed, a `macos` gate ([ADR 0024](../../adr/0024-the-macos-app-is-an-xcodegen-project-over-a-local-swift-package.md)); listed for the owner | 2026-11-24 |
| Where does the session secret live without a team? | private file behind a port / login keychain / data protection keychain / memory | Loop's call: a `0600` file behind `SessionVault` ([ADR 0025](../../adr/0025-the-session-secret-lives-in-a-private-file-until-the-app-has-a-team.md)); listed for the owner | 2026-11-24 |
| How is a native window walked and recorded? | Orca computer use / XCUITest / screen recording / snapshots | Loop's call: Orca walk, video from its frames, a live API suite ([ADR 0026](../../adr/0026-a-native-app-is-walked-with-computer-use-and-recorded-from-its-screenshots.md)); listed for the owner | 2026-11-24 |
| The design's open choices | see [`design.md`](design.md) § Options | Loop's calls: the designer's recommendations, except O4 (writes wait for the server), recorded in `design.md` § Owner decisions; listed for the owner | 2026-11-24 |
| Signing: the product design expects the free Personal Team | Personal Team / ad-hoc until a team exists | Loop's call: ad-hoc, because no identity is on the machine ([ADR 0024](../../adr/0024-the-macos-app-is-an-xcodegen-project-over-a-local-swift-package.md)); listed for the owner | 2026-11-24 |

## Rollback

Nothing is deployed and nothing else depends on `apps/macos`: reverting the merge removes the app, the gate row and the gate. A local session file is left in the app's container; deleting `~/Library/Containers/dev.todz.Todz` clears it.

## Test strategy summary

Swift Testing in `TodzKit`: the decoders against JSON shaped exactly as `owner-json.ts` answers, the error mapping of every row of the owner API's error table through a `URLProtocol` stub, `CalendarDate`, every view rule with empty, one and many tasks and the day boundary, the feed's paging and `cursor_ahead` restart, the placement mapping, the file vault's mode and erase, and `AppModel`'s phases and actions over a fake `OwnerService`. A live suite against `wrangler dev`, enabled by `TODZ_LIVE_API_URL`. The `macos` gate's row and failure text in `verify.test.sh`. The tester walks the built app with Orca computer use against `wrangler dev` (ADR 0026).
