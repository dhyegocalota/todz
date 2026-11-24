# Test plan: Mac app shell

Every checkbox states the input and the exact expected outcome. A ticked box carries evidence after ` — evidence: ` (commit hash, log path, counts, screenshot path). Copy keys are those of [`design.md`](design.md) § 4.

## The failing test first

- [ ] Each red commit of steps 1, 2 and 5 to 12 holds only its test (and a stub that fails with `<name> is not implemented`), and its body records the failure the red run printed — input: `git log --format='%h %s%n%b' origin/main..HEAD`; expected: one red commit before each green one, each with a failure text
- [ ] Red-first spot check in a throwaway worktree for steps 7 and 12 — input: check out the red commit, `swift test --filter OwnerAPITests` then `--filter AppModelTests`; expected: the failure printed matches the text in the commit body, not a compile error

## Unit

- [ ] `swift test` in `apps/macos/TodzKit` — input: the whole package; expected: every suite green, `LiveOwnerAPITests` reported as skipped, `grep -c 'warning:'` = 0 on the log for `TodzKit/Sources`
- [ ] `OwnerEnumsTests` — input: every raw value of `libs/types/src/task.ts` (`TaskState`, `ActorKind`, `TaskField`, `HistoryAction`, `TaskPlacement`, `RuleIssue`); expected: each decodes; `"archived"` as a state throws `DecodingError`
- [ ] `OwnerModelsTests` — input: fixtures shaped as `owner-json.ts`, and each answer envelope of the spec; expected: `created_at: 1764000000000` decodes to that instant, `due_date: null` and `notes: null` to `nil`, `actor.client_name: "Claude Code"` to an agent actor named `Claude Code`, a workspace's projects keep their order with the Inbox first, each envelope unwraps to its inner value
- [ ] `CalendarDateTests` — input: `2026-11-24`, `2026-02-30`, `2026-1-5`, `""`, and `today` at 23:59:59 and 00:00:00 in `America/Sao_Paulo`; expected: the first parses and formats back, the next three are refused, the boundary answers two consecutive dates
- [ ] `OwnerAPITests`, requests — input: each route the shell uses, `PATCH /owner` included; expected: method, path, `Authorization: Bearer <session>` from the `session:` argument (absent on sign-in), snake_case body (`identity_token`, `time_zone`, `due_date`, `idempotency_key`, `numbers`, `placement.kind`, `placement.anchor`)
- [ ] `OwnerAPITests`, errors — input: each row of the owner API error table; expected: its `OwnerAPIError` case, with `issue` and `index` for 422 `rule_violated`, `number` for `task_not_found`; a 418 → `unexpected(status: 418)`; a `URLError(.cannotConnectToHost)` → `unreachable`
- [ ] `FileSessionVaultTests` — input: write then read in a temporary folder; expected: the same secret, file mode `0600`; absent file → `nil`; a directory where the file should be → a thrown error; `erase` twice → no error
- [ ] `TaskBoardTests` — input: a task at `updated_at` 2000, then a copy at 1000; expected: the board keeps 2000; a copy at 2000 or later replaces it
- [ ] `ProjectFeedTests` — input: pages with `has_more` true, true, false; expected: three calls with the returned cursors and every task merged; `cursorAhead` once → one restart from 0 and the board holds only the second pull; `cursorAhead` twice → the error is thrown
- [ ] `TaskViewsTests` — input: empty, one and many tasks around today = 2026-11-24; expected: due 2026-11-23 open → Today before due 2026-11-24; due 2026-11-25 → Upcoming; done on 2026-11-24 → Done Today and Done; done on 2026-11-23 → Done only; undated open → Inbox or its project only; order keys `a0` < `a1` < `b` in byte order; two projects' tasks due the same day with order key `a0` → in sidebar order
- [ ] `TaskPlacementRequestTests` — input: list T-1, T-2, T-3, T-4; moves: T-2 up one, T-4 up one, T-1 down one, T-1 past the end, T-4 to the top, T-3 onto itself; expected: `first`, `after 2`, `after 2`, `after 4`, `first`, `nil`
- [ ] `AppModelTests` — input: each bullet of plan step 12; expected: exactly the phase, banner, board and in-flight outcome the bullet names, and on each failure a board equal to the one before the call
- [ ] Edge: a 401 in the middle of a pull of five projects — expected: `erase` called exactly once, no request started after the 401 is handled, phase `signedOut(notice: .sessionEnded)`
- [ ] Edge: adding a task with a 201-character title — expected: `ruleViolated(issue: .titleTooLong, index: 0)` exposed for the add field, the board unchanged
- [ ] Edge: renaming the Inbox — expected: the rename control is not offered; a forced call answers `inboxIsFixed` and the name is unchanged
- [ ] `bash scripts/verify.test.sh` — input: the new pins of step 1; expected: green; with the row moved below `apps/*`, the Swift-file pin fails
- [ ] `pnpm test:hooks` — input: the doctor pins of step 2; expected: green

## E2E

The server for this section and the walk, run in `apps/api` with a new scratch folder `<state>` and port 8787 free (the app's Info.plist names it):

```
pnpm exec wrangler d1 migrations apply directory --local --persist-to <state>
pnpm exec wrangler dev --var SIGN_IN_PROVIDER:fake --persist-to <state> --port 8787
```

A restart reuses the same `<state>` and port.

- [ ] `LiveOwnerAPITests` — input: `TODZ_LIVE_API_URL=http://localhost:8787 swift test --filter LiveOwnerAPITests` in `apps/macos/TodzKit`; expected: every call succeeds and decodes; the suite is not reported as skipped
- [ ] `pnpm verify` on the branch — expected: the `macos` gate runs and is green

## Prove it for real — Orca walk (ADR 0026)

The Debug build of `Todz` from `apps/macos/build`, against the server above; background input only, never `--restore-window`.

- [ ] Happy path: launch → sign-in screen with `SignInCopy.title`; identity `walker-1` → `FirstWorkspaceCopy.title`; name `Logic Bit` → main window, Inbox selected, `MainWindowCopy.inboxEmptyTitle`; add `Write the spec` → a row with `T-1`; select it → inspector shows Project `Inbox`, Due `InspectorCopy.noDueDate` ("None"), Added "{time} by you", notes placeholder, history line `HistoryCopy.ownerAdded` ("You added it"); set due today → it appears in Today; check it → it leaves Today's open list and shows under `MainWindowCopy.doneToday` and in Done
- [ ] Empty: a new workspace — expected: Inbox, Today, Upcoming and Done show `inboxEmptyTitle`, `todayEmptyTitle`, `upcomingEmptyTitle`, `doneEmptyTitle`
- [ ] Single and many: 1 then 30 tasks in a project — expected: rows in manual order, the list scrolls, the add field stays above the rows
- [ ] Waiting state: check a task — expected: the checkbox shows a progress indicator until the answer, then the row leaves; the tree shows no state the server did not answer
- [ ] Rejected input: a 201-character title in the add field — expected: `ErrorCopy.titleTooLong` under the field, the field keeps the text, no row is added
- [ ] Reorder: select T-3 in a project of T-1, T-2, T-3 and press ⌥⌘↑ twice — expected: T-3, T-1, T-2 after each answer, and the same order after ⌘R. A background drag is tried once and its result recorded either way
- [ ] An agent's write: as `walker-1`, `curl -X POST http://localhost:8787/owner/sessions` with `{"identity_token":"walker-1","time_zone":"America/Sao_Paulo"}` gives a second session; `GET /owner/workspaces` with it gives the Inbox id; `POST /owner/projects/<inbox id>/keys` gives a key; a scratch Node script with `@modelcontextprotocol/client` from `apps/api` connects to `http://localhost:8787/mcp` with that key and client name `Claude Code` and calls `add` with title `From the agent`; then ⌘R in the app — expected: the row shows "via Claude Code"; its inspector shows Added "{time} via Claude Code" and the history line "Added via Claude Code"
- [ ] Second owner: Sign Out, sign in as `walker-2` — expected: `FirstWorkspaceCopy.title`, none of `walker-1`'s workspaces or tasks anywhere in the tree
- [ ] Projects: ⇧⌘N, create `api`; rename it `api server` — expected: both names show in the sidebar in turn; the Inbox row has no rename item
- [ ] Workspaces: create `Pessoal`, switch back and forth — expected: each shows only its own projects and tasks
- [ ] Session ended: read the secret from `~/Library/Containers/dev.todz.Todz/Data/Library/Application Support/session`, `curl -X DELETE http://localhost:8787/owner/sessions/current -H "Authorization: Bearer <secret>"`, then ⌘R — expected: the sign-in screen with `SignInCopy.sessionEnded`, the identity prefilled, and the session file gone
- [ ] Server down: stop the server, then ⌘R and try to add — expected: `ErrorCopy.networkTitle` with `MainWindowCopy.tryAgain`, the list unchanged, no row added; restart with the same `<state>` and port, Try Again → the list loads
- [ ] Relaunch: quit and relaunch — expected: signed in, the oldest workspace shown with its Inbox selected
- [ ] No Keychain prompt: `pgrep -f SecurityAgent.bundle` before and after the walk — expected: no new process started by the walk
- [ ] Narrow: the window at its minimum size — expected: the layout of `design.md` § 1.1, row titles and the add field not clipped
- [ ] Dark appearance: one screenshot of the main window — expected: row titles, sub-lines, the sidebar labels and the accent checkbox each visible against their background
- [ ] Screenshots at `.pr-media/mac-app-shell/`; video `walk.mp4` and `walk.gif` built from them with ffmpeg

## Edge cases found during execution

Empty on purpose. The tester adds one checkbox per new case (input, exact expected outcome) and a regression test for each.

## Adversarial review

The reviewer picks the three claims most likely to be wrong and tries to refute each.

- [ ] Claim 1: <claim> — attack: <how>; result: <refuted | held>
- [ ] Claim 2: <claim> — attack: <how>; result: <refuted | held>
- [ ] Claim 3: <claim> — attack: <how>; result: <refuted | held>

## Coverage honesty

- The SwiftUI views have no automated test; the Orca walk is their proof (ADR 0026). The rules they show live in `TodzKit` and are unit-tested.
- The live suite runs only when the tester points it at the local server; the gate runs the stubbed suites.
- Dark mode and accessibility labels are checked once in the walk, not per screen.
