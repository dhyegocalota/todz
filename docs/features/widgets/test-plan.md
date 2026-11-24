# Test plan: Widgets

Every checkbox states the input and the exact expected outcome. A ticked box carries evidence after ` — evidence: ` (commit hash, log path, counts, screenshot path). Copy keys are those of [`design.md`](design.md) § 8.

## The failing test first

- [ ] Each red commit of steps 1 to 6 holds only its test (plus stubs that fail with `<name> is not implemented`), and its body records the failure the red run printed — input: `git log --format='%h %s%n%b' origin/main..HEAD`; expected: one red commit before each green one
- [ ] Red-first spot check in a throwaway worktree for steps 4 and 5 — input: check out each red commit, `swift test --filter AppModelTests`; expected: the failure printed matches the commit body
- [ ] Each group's last commit builds — input: `swift test` and the app build with the extension at G1's and G2's last commits; expected: green at each

## Unit

- [ ] `WidgetSnapshotTests`: open, overdue, done today newest first, pending adds without a number, an agent's creator label, empty Today, the `OwnerCoding` round trip, `isCurrent(on:)` false for another day
- [ ] `FileWidgetStoreTests`: nil and `[]` when nothing is written; write then read equal; two appends then take → both in order, a second take → `[]`; files `0600`; an unreadable snapshot → `unreadable`; unreadable requests → erased and `[]`; erase twice
- [ ] `WidgetToggleTests`: open → done today with a `done` request; done today → open at its place with an `open` request; unknown task or pending add → nil; two toggles → the original snapshot
- [ ] `AppModelTests+Widgets`: launch with a cache → one write and one reload; an add → a second write; an unchanged pull → no write; a workspace switch → the new name; sign-out → erase and reload
- [ ] `AppModelTests+Widgets`: a request for a snapshot task → one outbox change with its click time; a forged request (another workspace) → none; no snapshot → none
- [ ] `AppModelTests+Widgets`: sign-out erases the store; another owner's sign-in erases it before the first new write; the same owner keeps it
- [ ] The whole suite stays green — `swift test`; count recorded

## E2E

- [ ] No browser surface. `pnpm verify all` green with the `macos` gate building the extension — summary recorded

## Prove it for real — the desktop (ADR 0026, with the owner's OK: widgets draw on his screen)

- [ ] Files: launch the app signed in (`open -g`) — expected: `~/Library/Group Containers/TODZLOCAL0.dev.todz/Widgets/widget-snapshot.json`, mode `-rw-------`, holding the active workspace's Today; no session secret in the group (grep the session token in the folder: no match)
- [ ] Registration: `pluginkit -m -i dev.todz.Todz.widgets` lists the extension
- [ ] Gallery: the four widgets appear in the widget gallery with the sample (O12) when no snapshot, the real Today when one exists
- [ ] Small Today ring: 1 done of 4 — expected: the ring at a quarter and the caption per `design.md`
- [ ] Small Next up: the first open task in Today's order with its due caption, tag and "via Claude Code" for an agent's task
- [ ] Medium: three rows and "Today · N left"; large: seven rows, the workspace name and "N left"; overdue in red; done-today rows fill the slots left
- [ ] Checkbox with the app running: tap a medium row's checkbox — expected: the row turns done at once; within 2 seconds one `POST …/tasks/complete 200` in the server log; the main window and the popover show it done
- [ ] Checkbox with the app quit: quit todz, tap a checkbox — expected: the row turns done; `widget-requests.json` holds one request; launch todz → the request is sent and the file is empty
- [ ] Second tap reopens: tap a just-done row — expected: open again, and one reopen sent (or none if the first was not sent yet)
- [ ] Every local change reloads: add a task in the popover — expected: the medium widget shows it within a few seconds
- [ ] An agent's add through MCP while the app runs — expected: the widgets show it without opening the app
- [ ] Signed out: sign out — expected: the widgets show "Open todz" and the group's files are gone
- [ ] Another day: set the snapshot's `day` to yesterday by hand — expected: "Open todz" (O9)
- [ ] Deep links: tap the ring → the main window on Today; tap a row → that task in the inspector; a hand-made `todz://task/<another workspace's project>/1` → Today, nothing foreign selected
- [ ] Light and dark; README shots `docs/screenshots/widgets/01-…png` within ADR 0030's limits

## Edge cases found during execution

## Adversarial review

## Coverage honesty

- The widgets' views have no unit seam; they are proven only on the desktop, which draws on the owner's screen.
- Until a team exists, another local ad-hoc app could claim the group (ADR 0032); the walk does not attack it, the security review does.
