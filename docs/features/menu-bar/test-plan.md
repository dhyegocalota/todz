# Test plan: Menu bar

Every checkbox states the input and the exact expected outcome. A ticked box carries evidence after ` — evidence: ` (commit hash, log path, counts, screenshot path). Copy keys are those of [`design.md`](design.md) § 8.

## The failing test first

- [ ] Each red commit of steps 1 to 4 holds only its test (plus stubs that fail with `<name> is not implemented` and the types the test compiles against), and its body records the failure the red run printed — input: `git log --format='%h %s%n%b' origin/main..HEAD`; expected: one red commit before each green one, each with a failure text
- [ ] Red-first spot check in a throwaway worktree for steps 3 and 4 — input: check out each red commit, `swift test --filter WorkspaceShortcutsTests` then `--filter AppModelTests`; expected: the failure printed matches the commit body, not a compile error
- [ ] Each group's last commit builds — input: at G1's and G2's last commits, `swift test` and `xcodegen generate` + `xcodebuild build` as the `macos` gate runs them; expected: green at each

## Unit

- [ ] `AppModelTests+Destinations`: Inbox → the Inbox, no date; Today → the Inbox, due today; a project → that project, no date; Upcoming and Done → nil; no Inbox → nil for Inbox and Today; no active workspace → nil
- [ ] `AppModelTests+Destinations`: `reveal(task:)` from a project view → `.today` and the key; a second reveal → the second key
- [ ] `WorkspaceShortcutsTests`: 1 → first; 9 of 10 → ninth; 10 of 10 → nil; 0, -1 → nil; 3 of 2 → nil; 1 of none → nil
- [ ] `AppModelTests+Workspaces`: `switchWorkspace(number: 2)` → the second workspace active, its projects pulled from 0; `number: 3` of 2 → nothing called, active unchanged; the active workspace's own number → nothing called
- [ ] `AppModelTests`: two concurrent `launch()` calls → one vault read and one `updateOwner`; `launch()` after a finished launch → no new call
- [ ] The whole suite stays green — input: `swift test` from `apps/macos/TodzKit`; expected: every test passes, count recorded

## E2E

- [ ] No browser surface: the app is proven by the Orca walk below (ADR 0026). `pnpm verify all` stays green with the `macos` gate — expected: every gate green, summary recorded

## Prove it for real — Orca walk (ADR 0026, ADR 0031 § 5)

The Debug build of `Todz` against `wrangler dev`; background input only, never `--restore-window`. The popover opens with System Events and is read and screenshotted by its window id. Screenshots to `.pr-media/menu-bar/`.

- [ ] Status item: launch the app signed out — expected: one status item for `Todz` in the menu bar (System Events lists `menu bar item 1 of menu bar 2`), icon only, no title
- [ ] Signed out: open the popover — expected: the signed-out state of `design.md` with "Open todz"; no task row, no add field
- [ ] Naming: sign in as a new owner in the main window, then open the popover before naming the workspace — expected: the naming state of `design.md` and "Open todz"
- [ ] Empty Today: name `Logic Bit`, open the popover — expected: the workspace name in the header and the empty-Today state; the add field focused
- [ ] Add from the popover: type `Ship the menu bar`, Return — expected: the row appears in the popover at once with the field cleared and still focused; in the main window it is in the Inbox and in Today, due today, with a number after the server answers; one `POST …/tasks 201` in the server log
- [ ] Rejected input: a title of 501 characters, Return — expected: the field keeps the text and shows the same rule issue as the main window's add field; no request
- [ ] Complete and reopen from the popover: check `Ship the menu bar` — expected: it moves to the done-today rows (or as `design.md` says) at once, the footer count rises by one, the main window shows it in Done; check it again — expected: open again everywhere; two state requests in the server log
- [ ] Many: 30 tasks due today through MCP `add` — expected: the popover stays within `design.md`'s maximum height and the list scrolls; the header and the footer stay put
- [ ] Overdue and other projects: a task due yesterday in project `api` and one due today in the Inbox — expected: both in the popover with the subline of `design.md` (overdue, project name)
- [ ] An agent's add while the popover is open: MCP `add` of `From the agent` due today with client `Claude Code` — expected: the row appears in the popover within 2 seconds without ⌘R, with "via Claude Code"
- [ ] Pending add offline: stop `wrangler dev`, add `Offline add` from the popover — expected: a pending row (dashed ring, no id) and the offline line with "1 change waiting"; start the server — expected: within 30 seconds the row gets its number and the offline line goes
- [ ] Load failure: stop the server, relaunch with no cache for a new workspace (or as the briefing arranges) — expected: the load-failure state of `design.md` with "Open todz"
- [ ] Switching with ⌘1 to ⌘9: create `Pessoal` (owner API) and relaunch or reload the list; in the popover press ⌘2 — expected: the popover shows `Pessoal`'s Today and the main window's sidebar switches to `Pessoal`; ⌘1 back to `Logic Bit`; ⌘3 with two workspaces → nothing changes, no request
- [ ] Switching from the main window: with the main window key, ⌘2 through Orca's hotkey — expected: the sidebar shows `Pessoal`, and the popover shows `Pessoal`'s Today on its next open; the View menu lists both workspaces with ⌘1 and ⌘2 (read from the menu bar's accessibility tree, or recorded BLOCKED if menus cannot be read)
- [ ] One workspace: with only `Logic Bit` — expected: the header shows the name as plain text, no switch hint in the foot (O6)
- [ ] Launch with the main window closed: close the main window, quit (pkill), relaunch with `open -g` — expected: whether the main window reopens or not, the popover shows the ready Today (the model launched once; one `PATCH /owner` in the server log)
- [ ] Escape: type text in the add field, Escape — expected: the text clears and the popover stays; a second Escape closes it (or, if the close mechanism of plan step 6 was not proven, as the briefing states)
- [ ] Row click: click a task row's title in the popover — expected: the main window is in the CoreGraphics window list on screen, on Today, with that task selected in the list and the inspector shown, and the popover closed; whether the app became frontmost is recorded separately (background input may not activate it)
- [ ] Open todz with the main window closed: close the main window (⌘W through Orca hotkey), confirm the process still runs and the status item is still there; "Open todz" — expected: the main window opens on the active workspace, no second launch (one `PATCH /owner` in the server log since the app started)
- [ ] Session ends while the popover is open: delete the session rows on the server, trigger a request — expected: the popover shows the signed-out state
- [ ] Keys stay in the popover: with the main window on project `api`, press ⌘N, ⌘0, ⌘R and ⌘2 into the popover — expected: ⌘N focuses the popover's field and the main window's selected item stays `api`; ⌘0 opens the main window; ⌘R refreshes once; ⌘2 makes exactly one round of pulls of the second workspace's projects in the server log. If Orca's hotkey cannot reach the panel, BLOCKED with the reason
- [ ] Linger by surface: with the main window on project `api`, check a Today task in the popover — expected: it lingers in the popover about a second; a second click within it reopens it; it never shows twice in the popover
- [ ] Reopen after a close from code: click a row (the popover closes), then click the status item once — expected: the popover opens with the field focused; open → close (Escape on an empty field) → open focuses it each time; text typed before a close is still there after a reopen
- [ ] Growth: the popover open with two rows, an MCP add of ten tasks due today — expected: the popover grows, never past 520 points high, still under the status item
- [ ] Ten workspaces (owner API) — expected: the foot hint reads `Switch workspace ⌘1–9`; ⌘ digits reach the first nine; the tenth only through the switcher menu (the menu is an `NSMenu` pop-up: open it with System Events AXPress, else BLOCKED with the reason)
- [ ] Field after a ⌘ digit: type `draft`, press ⌘2 — expected: the field is empty
- [ ] Refused add with the main window closed: a refused add (the forwarding proxy of the sync walk answering `422 rule_violated`) — expected: the popover's banner; its Dismiss clears it, and the main window opened afterwards shows no banner
- [ ] Launch failed: no cache, the server stopped, launch — expected: the popover shows `FailureView` with Try Again; starting the server and Try Again loads Today
- [ ] Sign Out from the main window while the popover is open (the first-workspace screen's link, or BLOCKED as the sync walk's menu-only Sign Out) — expected: the popover shows the signed-out state
- [ ] Dock click with no window: close the main window, click the Dock icon (System Events `click UI element "Todz" of list 1 of application process "Dock"`) — expected: the main window opens
- [ ] Open todz with the main window minimised — expected: the main window is on screen (CoreGraphics list) and not minimised
- [ ] Light and dark: the popover in the system appearance the README uses (ADR 0030 says light) — expected: readable text and the accent on the checkboxes, as `design.md` § 3
- [ ] README shot: `docs/screenshots/menu-bar/01-today-popover.png` of the popover with a realistic Today (open, via Claude Code, overdue, done today), within ADR 0030's limits

## Edge cases found during execution

## Adversarial review

## Coverage honesty

- The app target has no test target: the popover's views are proven only by the walk.
- Key equivalents are pressed through Orca's background hotkey into the popover window; whether they reach a `MenuBarExtra` panel that is not key is a hypothesis the walk checks.
- Background input cannot make a window key or frontmost, and cannot click outside the popover to close it: "click elsewhere closes", "the main window is frontmost" and anything that needs the main window key are recorded as what the CoreGraphics window list shows, or BLOCKED with the reason.
- The switcher's menu is an `NSMenu` pop-up; opening it in the background is tried with System Events AXPress, else BLOCKED.
