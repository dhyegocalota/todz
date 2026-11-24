# Plan: Menu bar

**Spec:** spec.md
**Tier:** 🟡
**Seam:** `apps/macos/TodzKit` (the destination of an add moves in, `reveal(task:)`, `WorkspaceShortcuts` and `switchWorkspace(number:)`) and `apps/macos/Todz` (the `MenuBarExtra` scene, the popover's views under `Todz/MenuBar/`, `MenuBarCopy`, and the main window reading the moved destination). Nothing outside `apps/macos` changes but this folder's docs, the root README gallery and `docs/screenshots/menu-bar/`.
**Assumptions (decided, owner can override):**
- ADR 0031 and `design.md` § 7 are the loop's calls, listed in the loop's questions. No third-party Swift dependency.
- Swift 6 language mode, strict concurrency, Swift Testing, `swift test` from `apps/macos/TodzKit`, as in the shell's and sync's plans; their convention bullets hold here word for word (no comments but `// NB ADR NNNN:`, no `??` default, flat `guard`s, enums over literals, file-top `private let lowerCamel` constants, labels, array methods, no acronyms, function declarations).
- Files are written with the Write and Edit tools: `guard-secrets.sh` blocks code heredocs and any shell line with an expansion. Commits use `git commit -F <file>`.
- Red-first as before: each red commit holds the failing test alone, plus stubs that `fatalError("<name> is not implemented")` and the types the test compiles against; its body records the failure the red run printed. A test that is green when it lands is a `pin`.
- Every group leaves `swift test` and the app build (`xcodegen generate` then `xcodebuild build`, as the `macos` gate runs them) green at its last commit, and every red commit leaves the app build green (stubs compile).

## File map

| Group | Paths owned | Developer sub-agent |
|-------|-------------|---------------------|
| G1 model | `apps/macos/TodzKit/Sources/TodzKit/`: `AddTaskDestination.swift` (moved from `apps/macos/Todz/MainWindow/TaskList/`), `AppModel+Destinations.swift` (new), `WorkspaceShortcuts.swift` (new), `AppModel+Workspaces.swift`; `apps/macos/TodzKit/Tests/TodzKitTests/`: `AppModelTests+Destinations.swift` (new), `WorkspaceShortcutsTests.swift` (new), `AppModelTests+Workspaces.swift`; and, so the app compiles, `apps/macos/Todz/AppModel+Window.swift` and `apps/macos/Todz/MainWindow/TaskList/TaskListView.swift` | `developer-model` (Sonnet), on `feat/menu-bar` |
| G2 app | `apps/macos/Todz/TodzApp.swift`, `apps/macos/Todz/MenuBar/**` (new), `apps/macos/Todz/Copy/MenuBarCopy.swift` (new), shared views under `apps/macos/Todz/Shared/` or `MainWindow/` only where a component is made reusable without changing its look, `apps/macos/README.md`, `docs/features/menu-bar/tester-briefing.md` | `developer-app` (Opus), after G1 |

## Sequencing

G1 runs first on `feat/menu-bar` (small, red then green per step). G2 starts after the lead has `design.md` § 7 filled and G1 merged on the branch, because the popover reads G1's API. One lane at a time: no worktrees.

## Steps

Author this list with every box empty. A sub-agent ticks its own line. A wrong step is struck through with the reason, not deleted.

### G1 model

- [ ] **Step 1:** red then green: `AddTaskDestination` moves to `TodzKit` (public, `Hashable`, `Sendable`, same fields and `target`). `AppModel.addTaskDestination(for item: SidebarItem) -> AddTaskDestination?` in `AppModel+Destinations.swift`: no active workspace or no Inbox → nil; `.inbox` → the Inbox, no due date; `.today` → the Inbox, due `today`; `.project(id)` → that project, no due date; `.upcoming`, `.done` → nil. The app's `addTaskDestination` property is deleted and `TaskListView` calls `model.addTaskDestination(for: model.selectedItem)`. `AppModelTests+Destinations`: each item with a seeded workspace; a workspace without an Inbox → nil for Inbox and Today; signed out (no active workspace) → nil.
- [ ] **Step 2:** red then green: `AppModel.reveal(task key: TaskKey)` sets `selectedItem = .today` and `selectedTask = key`. `AppModelTests+Destinations`: from `.project(…)` with no selection → `.today` and the key; called twice with two keys → the second key.
- [ ] **Step 3:** red then green: `WorkspaceShortcuts` (an `enum` namespace): `public static let count = 9`; `public static func workspace(number: Int, in workspaces: [Workspace]) -> Workspace?` → the workspace at position `number - 1` when `1...count` contains `number` and the list has it, else nil. `WorkspaceShortcutsTests`: 1 → first, 9 of 10 → ninth, 10 of 10 → nil, 0 → nil, -1 → nil, 3 of 2 → nil, 1 of none → nil.
- [ ] **Step 4:** red then green: `AppModel.switchWorkspace(number: Int) async` in `AppModel+Workspaces.swift` calls `switchWorkspace(identifier:)` with `WorkspaceShortcuts.workspace(number:in: workspaces)`; nil → returns with no call. `AppModelTests+Workspaces`: with `acme`, `side` seeded, `switchWorkspace(number: 2)` → `activeWorkspace == side` and its projects pulled from 0 (as `switchingWorkspaceResetsTheBoardAndPullsItsProjectsFromZero`); `number: 3` → active stays `acme` and no service call after sign-in; `number: 1` while `acme` is active → no service call.

### G2 app

- [ ] **Step 5:** the scene: `TodzApp` declares `MenuBarExtra` with the `.window` style beside the `Window`, the label an SF Symbol per `design.md`, content `MenuBarPopover` with the same `model` and `windowState` in the environment. Closing the main window keeps the app running; the app keeps its Dock icon. Builds with no warning from `apps/macos/Todz/` or `TodzKit/Sources/`.
- [ ] **Step 6:** the popover's states and views under `Todz/MenuBar/` per `design.md` §§ 1–5 and every string of § 8 in `Copy/MenuBarCopy.swift`: the header (workspace switcher and "Open todz"), "Add a task" (through `model.addTaskDestination(for: .today)`, the same inline rule issue as `AddTaskField`, keeps focus), Today's open rows, pending adds and done-today rows (checkbox → `model.toggleDone(task:)`; row click → `model.reveal(task:)` then open the main window and activate the app), the footer, the signed-out, loading, naming, empty, offline and load-failure states, ⌘1 to ⌘9 through `model.switchWorkspace(number:)` for `1...WorkspaceShortcuts.count`. Reuse `TaskCheckbox`, `TaskRowTitle`, `TaskRowSubline`, `PendingTaskRow` and the sync status where `design.md` says so; a shared component that needs a parameter to fit the popover gains it without changing the main window's look.
- [ ] **Step 7:** `apps/macos/README.md`'s purpose line names the menu bar extra; `tester-briefing.md`: what changed, how to start `wrangler dev` and the app, how to open the popover in the background (ADR 0031 § 5: System Events `click menu bar item 1 of menu bar 2` of process `Todz`, then the popover's window id from CoreGraphics at layer 101 and `orca computer get-app-state --window-id`), the red texts from `git log`, hypotheses to attack, known gaps.

## Failure modes

| Step | What breaks | How I notice (the concrete signal) | How I back out |
|------|-------------|------------------------------------|----------------|
| 1 | the main window's add field adds to the wrong place after the move | `AppModelTests+Destinations` or the walk's main-window add lands in another project or date | the rule is moved verbatim; revert the move |
| 4 | a ⌘-digit beyond the list crashes on an index | `WorkspaceShortcutsTests` with 3 of 2 traps | bounds checked before indexing |
| 5 | two model launches (main window and popover) race | the walk sees two `PATCH /owner` at launch in the server log | only `RootView` launches; the popover never calls `launch()` |
| 5 | closing the main window quits the app and the status item goes | the walk's close-the-window box finds no `Todz` process | `MenuBarExtra` keeps the app alive; check the scene declaration |
| 6 | "Open todz" or a row click does nothing when the main window is closed | the walk finds no main window after the click | `openWindow(id:)` with the scene's identifier, then activate |
| 6 | the popover's field steals focus from the main window when the popover is closed | the walk's main-window typing lands in the popover | focus is set only when the popover appears |
| 6 | the popover renders a huge Today list beyond the screen | the walk with 30 tasks sees a window taller than the design's maximum | the list scrolls inside the design's maximum height |

**Steps with no backout:** none; nothing is deployed and no data shape changes.

## Z. Prove and ship

- [ ] **Tester briefing:** a developer wrote `tester-briefing.md`.
- [ ] **Tester run:** a fresh `tester` sub-agent executed `test-plan.md` and ticked every box with evidence.
- [ ] **Reviewer:** a fresh `reviewer` sub-agent returned a verdict; refutation of the three riskiest claims is recorded in `test-plan.md`.
- [ ] **Security reviewer:** a fresh `security-reviewer` sub-agent returned its verdict.
- [ ] **/check-ui:** screenshots and video recorded from the Orca walk and uploaded; the README gallery shot under `docs/screenshots/menu-bar/`.
- [ ] **/open-pr:** gates passed, learnings sweep stated, PR opened.
