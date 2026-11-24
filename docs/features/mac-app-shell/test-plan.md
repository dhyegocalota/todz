# Test plan: Mac app shell

Every checkbox states the input and the exact expected outcome. A ticked box carries evidence after ` — evidence: ` (commit hash, log path, counts, screenshot path).

## The failing test first

- [ ] Each red commit of steps 1, 2 and 5 to 12 holds only its test (and a stub that fails with `<name> is not implemented`), and its body records the failure the red run printed — input: `git log --format='%h %s%n%b' origin/main..HEAD`; expected: one red commit before each green one, each with a failure text
- [ ] Red-first spot check in a throwaway worktree for steps 7 and 12 — input: check out the red commit, `swift test --filter OwnerAPITests` then `--filter AppModelTests`; expected: the failure printed matches the text in the commit body, not a compile error

## Unit

- [ ] `swift test` in `apps/macos/TodzKit` — input: the whole package; expected: every suite green, `LiveOwnerAPITests` reported as skipped, zero warnings from `TodzKit` sources
- [ ] `OwnerEnumsTests` — input: every raw value of `libs/types/src/task.ts` (`TaskState`, `ActorKind`, `TaskField`, `HistoryAction`, `TaskPlacement`, `RuleIssue`); expected: each decodes; `"archived"` as a state throws `DecodingError`
- [ ] `OwnerModelsTests` — input: fixtures shaped as `owner-json.ts`; expected: `created_at: 1764000000000` decodes to that instant, `due_date: null` to `nil`, `actor.client_name: "Claude Code"` to an agent actor named `Claude Code`, a workspace's projects keep their order with the Inbox first
- [ ] `CalendarDateTests` — input: `2026-11-24`, `2026-02-30`, `2026-1-5`, `""`, and `today` at 23:59:59 and 00:00:00 in `America/Sao_Paulo`; expected: the first parses and formats back, the next three are refused, the boundary answers two consecutive dates
- [ ] `OwnerAPITests`, requests — input: each route the shell uses; expected: method, path, `Authorization: Bearer <session>` (absent on sign-in), snake_case body (`identity_token`, `time_zone`, `due_date`, `idempotency_key`, `numbers`, `placement.kind`, `placement.anchor`)
- [ ] `OwnerAPITests`, errors — input: each row of the owner API error table; expected: its `OwnerAPIError` case, with `issue` and `index` for 422 `rule_violated`, `number` for `task_not_found`; a 418 → `unexpected(status: 418)`; a `URLError(.cannotConnectToHost)` → `unreachable`
- [ ] `FileSessionVaultTests` — input: write then read in a temporary folder; expected: the same secret, file mode `0600`; absent file → `nil`; a directory where the file should be → a thrown error; `erase` twice → no error
- [ ] `ProjectFeedTests` — input: pages with `has_more` true, true, false; expected: three calls with the returned cursors and every task merged; `cursorAhead` once → one restart from 0 and the board holds only the second pull; `cursorAhead` twice → the error is thrown
- [ ] `TaskViewsTests` — input: empty, one and many tasks around today = 2026-11-24; expected: due 2026-11-23 open → Today before due 2026-11-24; due 2026-11-25 → Upcoming; done on 2026-11-24 → "Done today" and Done; done on 2026-11-23 → Done only; undated open → Inbox or its project only; order keys `a0` < `a1` < `b` in byte order
- [ ] `TaskPlacementRequestTests` — input: list T-1, T-2, T-3, moves of T-3 to 0, T-1 to 2, T-2 to 1; expected: `first`, `after 2`, `nil`
- [ ] `AppModelTests` — input: the actions of step 12; expected: the phases and board changes it names, and on each failure an unchanged board
- [ ] Edge: a 401 in the middle of a pull of five projects — expected: the vault is erased once, the phase is `signedOut`, no further project is pulled
- [ ] Edge: adding a task with a 201-character title — expected: `ruleViolated(issue: .titleTooLong, index: 0)` exposed for the add field, the board unchanged
- [ ] Edge: renaming the Inbox — expected: the rename control is not offered; a forced call answers `inboxIsFixed` and the name is unchanged
- [ ] `bash scripts/verify.test.sh` — input: the new pins of step 1; expected: green, and red with the row moved below `apps/*`
- [ ] `pnpm test:hooks` — input: the doctor pin of step 2; expected: green

## E2E

- [ ] `LiveOwnerAPITests` against `wrangler dev` on a fresh `--persist-to` — input: `TODZ_LIVE_API_URL=http://localhost:8787 swift test --filter LiveOwnerAPITests`; expected: every call succeeds and decodes; nothing is skipped
- [ ] `pnpm verify` on the branch — expected: the `macos` gate runs and is green

## Prove it for real — Orca walk (ADR 0026)

Against `wrangler dev` on a fresh `--persist-to` in the scratchpad and the Debug build of `Todz`; background input only.

- [ ] Happy path: launch → sign-in screen; identity `walker-1` → first-workspace screen; name `Logic Bit` → main window with Inbox selected and its empty state; add `Write the spec` → it appears with `T-1`; select it → inspector shows Inbox, no due date, "Added by you", empty notes, history "Created"; set due today → it appears in Today; check it → it leaves Today's open list and appears under "Done today" and in Done
- [ ] Empty: a new workspace — expected: Inbox, Today, Upcoming and Done each show their empty copy from `design.md`
- [ ] Single and many: 1 then 30 tasks in a project — expected: rows in manual order, scrolling, the add field pinned
- [ ] Rejected input: a 201-character title — expected: the issue copy under the field, the field keeps the text, nothing is added
- [ ] Reorder: drag T-3 above T-1 in a project — expected: the new order shows after the answer and survives ⌘R
- [ ] An agent's write: add a task through `POST /mcp` with a project key (issued with `curl` through `POST /owner/projects/:id/keys`) and client name `Claude Code`, then ⌘R — expected: the task appears; its inspector says "Added via Claude Code"
- [ ] Second owner: sign out, sign in as `walker-2` — expected: the first-workspace screen, none of `walker-1`'s workspaces or tasks
- [ ] Projects: create `api`; rename it `api server` — expected: both show in the sidebar; the Inbox offers no rename
- [ ] Workspaces: create `Pessoal`, switch back and forth — expected: each shows only its own projects and tasks
- [ ] Session ended: delete the session file in the app's container while it runs, then ⌘R — expected: back at sign-in with the session-ended notice
- [ ] Server down: stop `wrangler dev`, then ⌘R and try to add — expected: the offline notice with Retry, the list unchanged; start it again, Retry → the list loads
- [ ] Relaunch: quit and relaunch — expected: signed in, the oldest workspace shown (no state kept but the session)
- [ ] No Keychain prompt and no `SecurityAgent` process at any step
- [ ] Narrow: the window at its minimum size — expected: the layout of `design.md` § 1.1, nothing clipped
- [ ] Dark appearance: one screenshot of the main window — expected: readable, the accent unchanged
- [ ] Screenshots at `.pr-media/mac-app-shell/`; video `walk.mp4` and `walk.gif` built from them

## Edge cases found during execution

Empty on purpose. The tester adds one checkbox per new case (input, exact expected outcome) and a regression test for each.

## Adversarial review

The reviewer picks the three claims most likely to be wrong and tries to refute each.

- [ ] Claim 1: <claim> — attack: <how>; result: <refuted | held>
- [ ] Claim 2: <claim> — attack: <how>; result: <refuted | held>
- [ ] Claim 3: <claim> — attack: <how>; result: <refuted | held>

## Coverage honesty

- The SwiftUI views have no automated test; the Orca walk is their proof (ADR 0026). The rules they show live in `TodzKit` and are unit-tested.
- The live suite runs only when the tester points it at `wrangler dev`; the gate runs the stubbed suites.
- Dark mode and accessibility labels are checked once in the walk, not per screen.
