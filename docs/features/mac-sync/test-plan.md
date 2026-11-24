# Test plan: Mac sync

Every checkbox states the input and the exact expected outcome. A ticked box carries evidence after ` — evidence: ` (commit hash, log path, counts, screenshot path). Copy keys are those of [`design.md`](design.md) § 8 and the shell's [`design.md`](../mac-app-shell/design.md) § 4.

## The failing test first

- [ ] Each red commit of steps 1, 2, 4 to 18 holds only its test (plus stubs that fail with `<name> is not implemented` and the types the test compiles against), and its body records the failure the red run printed — input: `git log --format='%h %s%n%b' origin/main..HEAD`; expected: one red commit before each green one, each with a failure text; step 3 is marked `pin`
- [ ] Red-first spot check in a throwaway worktree for steps 6 and 14 — input: check out each red commit, `swift test --filter OutboxTests` then `--filter AppModelTests`; expected: the failure printed matches the commit body, not a compile error
- [ ] Each lane's last commit builds — input: at G0's, G1a's, G1b's and G2's last commits, `swift test` and `xcodegen generate` + `xcodebuild build` as the `macos` gate runs them; expected: green at each

## Unit

- [ ] `swift test` in `apps/macos/TodzKit` — input: the whole package; expected: every suite green, `LiveOwnerAPITests` skipped, `grep -c 'warning:'` = 0 for `TodzKit/Sources`; no `Cache` folder created under `~/Library/Containers/dev.todz.Todz` by the run (compare `ls -la` before and after)
- [ ] `OwnerCodingTests` — input: a date of 1764000000000 ms, every request body, every fixture of `OwnerFixtures`; expected: the date encodes as `1764000000000` and decodes equal; request bodies encode to the same bytes as on `main`; decode → encode → decode equals the first decoding; an encoded task holds `"created_at":1764000000000` and `"due_date":"2026-11-24"`; `notes: nil` decodes back to `nil`
- [ ] `FileSessionVaultTests` after the `PrivateFile` refactor — expected: green, unchanged
- [ ] `FileSyncStoreTests` — input: a temporary folder; expected: empty reads answer `nil`; written values read back equal; files `0600`, `Cache` and `Cache/projects` `0700`, `isExcludedFromBackup` true; `{` in a file → `SyncStoreError.unreadable`; project id `../escape` → `unwritable` on write, `nil` on read, nothing written outside the folder; `erase` twice → no error; the 1 000-task write's median is printed and under 100 ms, and the tester records it against ADR 0027's 16 ms budget
- [ ] `PendingChangeTests` — expected: `add`, `field` with each `TaskPatch` case (including `.notes(nil)` and `.dueDate(nil)`) and `state` with its time round-trip; `{"kind":"delete"}` fails decoding
- [ ] `OutboxTests` — expected as plan step 6: two title edits → one change with the second title in the first one's place; two moves → two changes in order; complete then reopen → one `.state(open)`; the third counted attempt → at the limit; an edit of the sent head's field → appended, and a third edit replaces the appended one; `droppingChanges` keeps others in order and counts the dropped
- [ ] `TaskBoardOverlayTests` — expected: each waiting field shows; a waiting `done` moves the task from Inbox to Done in `TaskViews` with the stored completion time; X(T-1), Y(T-2), A(T-3), B(T-4) with moves A after X, B after A, A first → A, X, B, Y; `[move B after A, complete A]` → B where the server puts it, A in Done; a move after a missing anchor changes nothing; 12 open tasks get keys `"00"` to `"11"`; done tasks keep their keys
- [ ] `TaskViewsTests` with pending tasks — expected: as plan step 8, and every existing view test unchanged
- [ ] `ProjectFeedTests` — expected: from cursor 7 the first call carries `cursor=7`; the last page's cursor is returned; one `cursorAhead` → `isFromStart` true; two → thrown
- [ ] `ReconnectDelayTests` — expected: 1, 2, 4, 8, 16, 30, 30, 30 seconds for attempts 1 to 7 and 100; 1 second for attempt 0
- [ ] `SocketChangeSignalsTests` — input: base `http://localhost:8787`, session `s`, project `p`; expected: `ws://localhost:8787/owner/projects/p/socket`, header `Authorization: Bearer s`; base `https://h` → `wss://h/owner/projects/p/socket`
- [ ] `AppModelTests+Cache` — each bullet of plan steps 12 and 17 has a passing test; in particular: a cached launch is `ready` with the cached rows and its watches open while `updateOwner` is held; a cached launch with `listWorkspaces` unreachable recovers on the next `opened`; `updateOwner` naming another owner erases and resets; a launch with no session reads only the outbox; a write failure raises `.cacheNotSaved` once; an unreadable outbox raises `.waitingChangesLost`
- [ ] `AppModelTests+Owners` — each bullet of plan step 13 has a passing test; in particular: a different owner's sign-in empties the in-memory outbox and calls `store.erase()` before `vault.write` and before any send; no `owner.json` → erase too; `erase` throwing → `SignInError.unexpected`, the vault untouched, `session == nil`; the same owner's sign-in shows the cache and sends the outbox; `signOut()` erases the store, then the vault, and a held pull answering afterwards writes nothing; a 401 keeps the store and `waitingChangeCount`
- [ ] `AppModelTests+Outbox` — each bullet of plan step 14 has a passing test; in particular: `writeOutbox` before the service call; one call at a time; each row of the outcome table (a 503 kept as transient; a body that does not decode counts an attempt); three `unexpected`, each after a released pause → dropped; `unreachable` then `opened` → sent at once; two refusals in one flush → one `.changesRefused(count: 2)`; an answer after a workspace switch removes the head and merges into the other project's file with its cursor unchanged; a 401 mid-flush keeps the rest; a pending add's answer selects it only when the selection did not move
- [ ] `AppModelTests+Pull` — each bullet of plan steps 15 and 18 has a passing test; in particular: three triggers during one pull → two pulls, the second from the stored cursor; `isRefreshing` false for background pulls; no banner for a failed pull with cached rows
- [ ] `AppModelTests+Watch` — each bullet of plan step 16 has a passing test; in particular: a workspace switch cancels the old watches; `createProject` opens a watch; a project leaving the list drops its changes into the refused count; reconnect pauses 1, 2, 4 seconds on three failures and 1 after an `opened`; `notFound` backs off and reloads once; a stale watch's 401 after a new sign-in leaves the new session signed in; a cancelled watch never reopens
- [ ] No logging — input: `git grep -nE 'print\(|Logger|os_log|NSLog' -- apps/macos/TodzKit/Sources apps/macos/Todz`; expected: no line
- [ ] The shell's suites (`AppModelTests`, `+Answers`, `+Failures`, `+Notes`, `+Offline`, `+Races`, `+Tasks`, `+Workspaces`) — expected: green; any test changed because writes are now optimistic names the bullet of `design.md` § 1.1 that changed it in its commit body
- [ ] `bash scripts/verify.test.sh` and `pnpm test:hooks` — expected: green (no gate changes in this feature)

## E2E

The server, run in `apps/api` with a new scratch folder `<state>` and port 8787 free:

```
pnpm exec wrangler d1 migrations apply directory --local --persist-to <state>
pnpm exec wrangler dev --var SIGN_IN_PROVIDER:fake --persist-to <state> --port 8787
```

- [ ] `LiveOwnerAPITests` — input: `TODZ_LIVE_API_URL=http://localhost:8787 swift test --filter LiveOwnerAPITests`; expected: the shell's tests and the socket tests pass (`opened`, then `changed` after an add; a wrong session finishes `unauthorized`); not reported as skipped
- [ ] `pnpm verify all` on the branch — expected: the `macos` gate runs and is green

## Prove it for real — Orca walk (ADR 0026)

The Debug build of `Todz` against the server above; background input only, never `--restore-window`. Screenshots to `.pr-media/mac-sync/`.

- [ ] Cached launch: sign in as `walker-1`, create `Logic Bit`, add `Alpha` and `Beta`, quit (⌘Q), relaunch — expected: the window with Alpha and Beta, no loading screen; `Cache/owner.json` and one project file exist under `~/Library/Containers/dev.todz.Todz/Data/Library/Application Support/`, mode `-rw-------`
- [ ] Optimistic writes online: check Alpha — expected: the checkbox fills at once, the row leaves after about a second, and one `POST …/tasks/complete 200` reaches the server
- [ ] Offline: stop `wrangler dev`; rename Beta to `Beta 2`, then check it, then add `Gamma` — expected: each shows at once (Beta 2 leaves the Inbox after about a second and is in Done); the toolbar shows `wifi.slash` "Offline · 3 changes waiting" (the exact `SyncCopy.offlineWaiting` text); Gamma is a pending row with the dashed ring and no id, and cannot be selected
- [ ] Offline survives a relaunch: quit and relaunch with the server still stopped — expected: Beta 2 done, Gamma pending, "Offline · 3 changes waiting"
- [ ] Back online: start the server on the same `<state>` — expected: within 30 seconds the offline item disappears, Gamma gets `T-3`, the server log shows the patch, the complete and one add in that order; a second relaunch shows no pending row and no duplicate Gamma
- [ ] Live update from an agent: with the window open on the Inbox, an MCP `add` of `From the agent` through a key of the Inbox (the shell's walk script) — expected: the row appears within 2 seconds without ⌘R, with "via Claude Code"
- [ ] Live update while editing: focus Beta 2's title in the inspector, type `Beta 3` without committing, have the agent `update` Beta 2's notes — expected: the notes update, the title field keeps `Beta 3`; committing sends the title
- [ ] Refused change: a throwaway forwarding proxy on 8788 in front of the server (as the shell's tester pass 3 did; it must forward WebSocket upgrades too, or the app sits offline), with a re-signed app copy pointed at 8788; the proxy answers the next `PATCH …/tasks/1` with `422 {"error":"rule_violated","issue":"title_empty","index":0}`; change T-1's title — expected: the title shows at once, then the banner `ErrorCopy.changeNotSaved` with `ErrorCopy.changeNotSavedBody`, and the title returns to the server's value; the next change is sent normally
- [ ] Sign out with changes waiting: offline with one change waiting, Sign Out from the app menu — expected: the dialog `SyncCopy.signOutTitle(count: 1)`; Escape cancels; confirming erases `Cache`. Sign Out has no shortcut and Orca cannot open menus in the background (`menus: false`): without the owner's OK for `--restore-window`, record BLOCKED and rely on the `AppModelTests+Owners` box
- [ ] Session ended with changes waiting: offline with one change waiting, delete the session's row on the server (`wrangler d1 execute directory --local --persist-to <state> --command "DELETE FROM sessions"`), start the server — expected: the sign-in screen with `SignInCopy.sessionEndedWaiting(count: 1)`; quit and relaunch → the same line; signing in as `walker-1` shows the cached window and sends the change; signing in instead as `walker-2` shows an empty first-workspace screen and no task of `walker-1` in any frame of the walk, and `Cache` holds no `walker-1` project file
- [ ] Cached launch with the server down: quit, stop the server, relaunch, then start the server — expected: the cached window at launch with the offline item; within 30 seconds of the start the item disappears and an agent's add made while the app was down appears, without ⌘R
- [ ] A new project gets live updates: create project `api` in the window, then an agent add through a key of `api` — expected: the row appears in `api` within 2 seconds without ⌘R
- [ ] Two workspaces: switch from `Logic Bit` to a second workspace — expected: the server log shows the old project sockets closing and the new ones opening; an agent add in `Logic Bit`'s Inbox does not show in the second workspace, and shows after switching back

## Edge cases found during execution

None yet.

## Adversarial review

- [x] Plan review (2026-11-24, before building): 24 findings (5 CRITICAL, 11 IMPORTANT, 8 MINOR), all answered in `plan.md`, `spec.md`, ADRs 0027 to 0029, `design.md` and this file before any code; its three refutations were the overlay order, resent patches (now stated in ADR 0028 § 5) and the cross-owner outbox — evidence: `5ad0326` (the answers), first code commit `e8cbbad` after it
- [ ] The three claims most likely to be wrong, attacked by the code reviewer, with the outcome: (1) the screen and the server end in the same order after a sequence of offline changes of every kind; (2) no add is duplicated after a lost answer and a relaunch, and a resent patch only re-applies its own field; (3) another owner's sign-in never shows or sends the first owner's data, even across a crash between the erase and the new session

## Coverage honesty

- [ ] State what was not proven and why: menus in the background (Orca `menus: false`), the drag reorder, sockets under a real network change (Wi-Fi off) rather than a stopped server, a socket the network drops without a close (no ping, ADR 0029), and anything the walk recorded as BLOCKED
