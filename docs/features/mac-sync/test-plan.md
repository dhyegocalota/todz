# Test plan: Mac sync

Every checkbox states the input and the exact expected outcome. A ticked box carries evidence after ` — evidence: ` (commit hash, log path, counts, screenshot path). Copy keys are those of [`design.md`](design.md) § 8 and the shell's [`design.md`](../mac-app-shell/design.md) § 4.

## The failing test first

- [ ] Each red commit of steps 1, 3 to 9 and 11 to 16 holds only its test (plus stubs that fail with `<name> is not implemented` and the types the test compiles against), and its body records the failure the red run printed — input: `git log --format='%h %s%n%b' origin/main..HEAD`; expected: one red commit before each green one, each with a failure text; steps 2 and 10 are marked `pin`
- [ ] Red-first spot check in a throwaway worktree for steps 5 and 13 — input: check out each red commit, `swift test --filter OutboxTests` then `--filter AppModelTests`; expected: the failure printed matches the commit body, not a compile error

## Unit

- [ ] `swift test` in `apps/macos/TodzKit` — input: the whole package; expected: every suite green, `LiveOwnerAPITests` skipped, `grep -c 'warning:'` = 0 for `TodzKit/Sources`; no `Cache` folder created under `~/Library/Containers/dev.todz.Todz` by the run (compare `ls -la` before and after)
- [ ] `OwnerCodingTests` — input: every fixture of `OwnerFixtures`; expected: decode → encode → decode equals the first decoding; an encoded task holds `"created_at":1764000000000` and `"due_date":"2026-11-24"`; a task with `notes: nil` decodes back to `nil`
- [ ] `FileSessionVaultTests` after the `PrivateFile` refactor — expected: green, unchanged
- [ ] `FileSyncStoreTests` — input: a temporary folder; expected: empty reads answer `nil`; written values read back equal; files `0600`, folder `0700`, `isExcludedFromBackup` true; `{` in a file → `SyncStoreError.unreadable`; project id `../escape` → `unwritable` on write, `nil` on read, nothing written outside the folder; `erase` twice → no error; 1 000-task project written in under 16 ms (median of 5)
- [ ] `PendingChangeTests` — expected: `add`, `field` with each `TaskPatch` case (including `.notes(nil)` and `.dueDate(nil)`) and `state` round-trip; `{"kind":"delete"}` fails decoding
- [ ] `OutboxTests` — input and expected as plan step 5: two title edits → one change with the second title in the first one's place; two moves → two changes in order; complete then reopen → one `.state(open)`; third attempt → at the limit; an edit of the head's field while the head is sent → appended; `droppingChanges(projectIdentifier:)` keeps others in order
- [ ] `TaskBoardOverlayTests` — expected: each waiting field shows; a waiting `done` moves the task from Inbox to Done in `TaskViews`; open X(T-1), Y(T-2), A(T-3), B(T-4) with moves A after X, B after A, A first → A, X, B, Y; a move after a missing anchor changes nothing; done tasks keep their order keys
- [ ] `TaskViewsTests` with pending tasks — expected: as plan step 7, and every existing view test unchanged
- [ ] `ProjectFeedTests` — expected: from cursor 7 the first call carries `cursor=7`; the last page's cursor is returned; one `cursorAhead` → `isFromStart` true; two → thrown
- [ ] `ReconnectDelayTests` — expected: 1, 2, 4, 8, 16, 30, 30 seconds for attempts 1 to 7
- [ ] `SocketChangeSignals` request — input: base `http://localhost:8787`, session `s`, project `p`; expected: `ws://localhost:8787/owner/projects/p/socket`, header `Authorization: Bearer s`; base `https://…` → `wss://…`
- [ ] `AppModelTests+Cache` — each bullet of plan steps 11, 12 and 15 has a test that passes; in particular: a cached launch is `ready` with the cached rows while `updateOwner` is held; a different owner's sign-in calls `store.erase()` before any store write; `signOut()` erases the store and then the vault; a 401 keeps the store
- [ ] `AppModelTests+Outbox` — each bullet of plan step 13 has a test that passes; in particular: `writeOutbox` before the service call; one call at a time; `unreachable` stops until `opened` or `refresh()`; two refusals in one flush → one `.changesRefused(count: 2)`; three `unexpected` → dropped; 401 mid-flush keeps the rest
- [ ] `AppModelTests+Watch` — each bullet of plan steps 14 and 16 has a test that passes; in particular: three `changed` during one pull → two pulls in all; a workspace switch cancels the old watches; reconnect pauses 1, 2, 4 seconds on three failures and back to 1 after an `opened`
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
- [ ] Offline: stop `wrangler dev`; check Beta, rename it `Beta 2`, add `Gamma` — expected: each shows at once; the toolbar shows `wifi.slash` "Offline · 3 changes waiting" (the exact `SyncCopy.offlineWaiting` text); Gamma is a pending row with the dashed ring and no id, and cannot be selected
- [ ] Offline survives a relaunch: quit and relaunch with the server still stopped — expected: Beta 2 done, Gamma pending, "Offline · 3 changes waiting"
- [ ] Back online: start the server on the same `<state>` — expected: within 30 seconds the offline item disappears, Gamma gets `T-3`, the server log shows the complete, the patch and one add in that order; a second relaunch shows no pending row and no duplicate Gamma
- [ ] Live update from an agent: with the window open on the Inbox, an MCP `add` of `From the agent` through a key of the Inbox (the shell's walk script) — expected: the row appears within 2 seconds without ⌘R, with "via Claude Code"
- [ ] Live update while editing: focus Beta 2's title in the inspector, type `Beta 3` without committing, have the agent `update` Beta 2's notes — expected: the notes update, the title field keeps `Beta 3`; committing sends the title
- [ ] Refused change: a throwaway forwarding proxy on 8788 in front of the server (as the shell's tester pass 3 did), with a re-signed app copy pointed at 8788; the proxy answers the next `PATCH …/tasks/1` with `422 {"error":"rule_violated","issue":"title_empty","index":0}`; change T-1's title — expected: the title shows at once, then the banner `ErrorCopy.changeNotSaved` with `ErrorCopy.changeNotSavedBody`, and the title returns to the server's value; the next change is sent normally
- [ ] Sign out with changes waiting: offline with one change waiting, Sign Out from the app menu (menus may not open in the background; then press the shortcut path the design gives, or record BLOCKED) — expected: the dialog `SyncCopy.signOutTitle(count: 1)`; Escape cancels; confirming erases `Cache`
- [ ] Session ended with changes waiting: offline with one change waiting, delete the session's row on the server (`wrangler d1 execute directory --local --persist-to <state> --command "DELETE FROM sessions"`), start the server — expected: the sign-in screen with `SignInCopy.sessionEndedWaiting(count: 1)`; signing in as `walker-1` sends the change; signing in instead as `walker-2` shows an empty first-workspace screen and no task of `walker-1`, and `Cache` holds no `walker-1` project file
- [ ] Two workspaces: switch from `Logic Bit` to a second workspace — expected: the server log shows the old project sockets closing and the new ones opening; an agent add in `Logic Bit`'s Inbox does not show in the second workspace, and shows after switching back

## Edge cases found during execution

None yet.

## Adversarial review

- [ ] The three claims most likely to be wrong, attacked by the reviewer, with the outcome: (1) the screen and the server end in the same order after a sequence of offline moves; (2) no change is sent twice after a lost answer and a relaunch (adds replay, others are idempotent); (3) another owner's sign-in never shows the first owner's tasks, even for one frame

## Coverage honesty

- [ ] State what was not proven and why: menus in the background (Orca `menus: false`), the drag reorder, sockets under a real network change (Wi-Fi off) rather than a stopped server, and anything the walk recorded as BLOCKED
