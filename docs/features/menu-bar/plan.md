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
| G2 app | `apps/macos/TodzKit/Sources/TodzKit/AppModel.swift` and `apps/macos/TodzKit/Tests/TodzKitTests/AppModelTests.swift` (step 5 only), `apps/macos/Todz/**` (the app target: `TodzApp.swift`, `AppCommands.swift`, `RootView.swift`, `MenuBar/**` new, `Copy/MenuBarCopy.swift` new, `Copy/AccessibilityCopy.swift`, and the components `design.md` § 2 moves to `Shared/`), `apps/macos/README.md`, `docs/features/menu-bar/tester-briefing.md` | `developer-app` (Opus), after G1 |

## Sequencing

G1 runs first on `feat/menu-bar` (small, red then green per step). G2 starts after the lead has `design.md` § 7 filled and G1 merged on the branch, because the popover reads G1's API. One lane at a time: no worktrees.

## Steps

Author this list with every box empty. A sub-agent ticks its own line. A wrong step is struck through with the reason, not deleted.

### G1 model

- [x] **Step 1:** red then green: `AddTaskDestination` moves to `TodzKit` (public, `Hashable`, `Sendable`, same fields and `target`). `AppModel.addTaskDestination(for item: SidebarItem) -> AddTaskDestination?` in `AppModel+Destinations.swift`: no active workspace or no Inbox → nil; `.inbox` → the Inbox, no due date; `.today` → the Inbox, due `today`; `.project(id)` → that project, no due date; `.upcoming`, `.done` → nil. The app's `addTaskDestination` property is deleted and `TaskListView` calls `model.addTaskDestination(for: model.selectedItem)`. `AppModelTests+Destinations`: each item with a seeded workspace; a workspace without an Inbox → nil for Inbox and Today; signed out (no active workspace) → nil. — evidence: red 06747ab, green 2b495ee
- [x] **Step 2:** red then green: `AppModel.reveal(task key: TaskKey)` sets `selectedItem = .today` and `selectedTask = key`. `AppModelTests+Destinations`: from `.project(…)` with no selection → `.today` and the key; called twice with two keys → the second key. — evidence: red d14ef65, green 785af7e
- [x] **Step 3:** red then green: `WorkspaceShortcuts` (an `enum` namespace): `public static let count = 9`; `public static func workspace(number: Int, in workspaces: [Workspace]) -> Workspace?` → the workspace at position `number - 1` when `1...count` contains `number` and the list has it, else nil. `WorkspaceShortcutsTests`: 1 → first, 9 of 10 → ninth, 10 of 10 → nil, 0 → nil, -1 → nil, 3 of 2 → nil, 1 of none → nil. — evidence: red 362ec14, green f28a8b8
- [x] **Step 4:** red then green: `AppModel.switchWorkspace(number: Int) async` in `AppModel+Workspaces.swift` calls `switchWorkspace(identifier:)` with `WorkspaceShortcuts.workspace(number:in: workspaces)`; nil → returns with no call. `AppModelTests+Workspaces`: with `acme`, `side` seeded, `switchWorkspace(number: 2)` → `activeWorkspace == side` and its projects pulled from 0 (as `switchingWorkspaceResetsTheBoardAndPullsItsProjectsFromZero`); `number: 3` → active stays `acme` and no service call after sign-in; `number: 1` while `acme` is active → no service call. — evidence: red 36a6d28, green 3f03337


### G2 app

Answers to the plan review of 2026-11-24 (13 findings) are folded into the steps below; the review's numbers are in brackets.

- [x] **Step 5:** red then green in `TodzKit` (`AppModel.swift`, `AppModelTests.swift`): `launch()` runs once per process. A second call, while the first is suspended on the service or after it returned, returns at once without waiting, makes no vault read and no service call. `AppModelTests`: two concurrent `launch()` calls → one vault read and one `updateOwner`; `launch()` after a finished launch → no new call. Every surface may start it: `RootView`'s `.task` keeps its call (reopening the window re-runs it, harmlessly), and the popover's content and the status item's label start it too, so a launch with no main window still loads (ADR 0031 § 3, amended). [1, 12] — evidence: red d15f4bb, green 5e24604 (`aSecondLaunchWhileTheFirstWaitsOnTheServiceReturnsAtOnceWithoutReadingTheVault`, `aLaunchAfterAFinishedLaunchCallsNothing`; the vault read is proven by making it unreadable mid-launch, not by a counter)
- [x] **Step 6:** the scene and the panel. `TodzApp` declares `MenuBarExtra` with the `.window` style beside the `Window`, the label `checkmark.square`, content `MenuBarPopover` with the same `model` and `windowState`. An `NSApplicationDelegateAdaptor` answers `applicationShouldTerminateAfterLastWindowClosed` with false and `applicationShouldHandleReopen` by opening the main window (a Dock click with no window, O9). The main window's identifier becomes a shared constant (`MainWindowScene.identifier`) for `openWindow(id:)`. Opening the main window activates the app with `NSApp.activate()` (not the deprecated `activate(ignoringOtherApps:)`). A small `NSViewRepresentable` (`MenuBarPanelReader`) reaches the popover's `NSWindow`: its `didBecomeKey` is the popover's open signal (focus the field, never `onAppear`), and closing from code (row click, Open todz, the second Escape) goes through it. Prove before step 7, and record in the tester briefing: after a close from code, one click on the status item reopens the popover with the field focused; open → close → open focuses the field each time. Text typed in the field survives a close and a reopen (a draft), cleared only by Return, Escape or a ⌘ digit. If no close mechanism works, the popover stays open and the briefing says so. Builds with no warning from `apps/macos/Todz/` or `TodzKit/Sources/`. [1, 5, 6] — evidence: 1637b9a, 2c62904, 78814c1; the close from code clicks the status item's own button (`window.close()` left the item open), and `applicationShouldHandleReopen` was not needed (SwiftUI reopens the `Window` scene); proofs in `tester-briefing.md` → Mechanisms
- [x] **Step 7:** the popover's views under `Todz/MenuBar/` per `design.md` §§ 1–5 and every string of § 8 in `Copy/MenuBarCopy.swift` and `AccessibilityCopy`: — evidence: ded3efe, bf99e43 (the popover's field clears itself per destination instead of being rebuilt, which dropped its focus), 42a72ac (long names truncate); heights measured with `onGeometryChange`; rows not reachable by Tab (briefing → Known gaps)
  - header: `WorkspaceSwitcher` moved to `Shared`, gaining `isMainWindow: Bool` (the popover shows workspace items only, no New Workspace or Sign Out) and showing the plain name with one workspace (O6); the switcher only displays ⌘1 to ⌘9, it registers no key; "Open todz" with ⌘0 (a popover-local button).
  - "Add a task": `AddTaskField` moved to `Shared`, generic over its focus value (`focus: FocusState<Value?>.Binding`, `focusedValue: Value`, `onEscapeWhenEmpty: () -> Void`), so the main window keeps `MainWindowFocus.addField` and Escape-to-list, and the popover passes its own `MenuBarFocus` enum and closes on an empty Escape; destination `model.addTaskDestination(for: .today)`; ⌘N in the popover is a popover-local button that focuses the field and never reaches `MainWindowState.requestNewTask` (a key window's own key equivalent wins over the main menu's). [2, 4]
  - rows: built through `TaskSections` for the item `.today` (no second list of done rows, so a lingering task never shows twice); the shell's `TaskRow` (O10) with its checkbox; `MainWindowState.toggleDone(task:model:)` gains `item: SidebarItem`, and `TaskCheckbox` and `TaskRow`'s accessibility action pass theirs: the main window its `selectedItem`, the popover `.today`, so a popover check lingers there whatever the window shows. Row click → `model.reveal(task:)`, `windowState.isInspectorPresented = true`, open the main window, activate, close the popover. [3]
  - foot: the counts, `SyncStatusItem` moved to `Shared` with `announcesChanges: Bool` (only the main window announces "Offline", so VoiceOver hears it once), the switch hint `switchHint(last:)` with the real last number up to nine.
  - states: signed out, loading, launch failed (`loading` with a banner: `FailureView` with Try Again, as the main window), naming, first load, load failed (`FailureView` with Try Again, `design.md` § 1.3), empty, all done, offline; the popover's banner (`ErrorBanner`) for a refused add, whose Dismiss clears it on both surfaces (one `model.banner`). [7, 8]
  - height: the rows' `ScrollView` takes its content's height up to `private let maximumPopoverHeight: CGFloat = 520` (measured with a `GeometryReader` on the rows' content, `frame(height: min(content, maximum - pinned))`), width 360. [11]
- [x] **Step 8:** `AppCommands`: the View menu lists the first nine workspaces with ⌘1 to ⌘9 (O7) through `model.switchWorkspace(number:)`, disabled unless the model is ready; this is the one registration of ⌘1 to ⌘9. Prove in the walk that a ⌘ digit pressed into the popover reaches it exactly once (one pull of the new workspace's projects); if the main menu does not receive key equivalents while the panel is key, add popover-local buttons, never both, and say so in the briefing. [2] — evidence: bba2120; ⌘1 to ⌘9 reached the popover through the View menu, one activation each, so no popover-local buttons (briefing → Mechanisms, risk c)
- [x] **Step 9:** `apps/macos/README.md`'s purpose line names the menu bar extra; `tester-briefing.md`: what changed, how to start `wrangler dev` and the app, how to open the popover in the background (ADR 0031 § 5), the close and open-signal mechanism step 6 proved, the red texts from `git log`, hypotheses to attack, known gaps. — evidence: the `docs(menu-bar)` commit that ticks this box

Fix round 1 (2026-11-24, after the tester's walk and the review; the app was not launched, proofs in `tester-briefing.md` → Fix round 1):

- D2, a popover add selected the new task in the main window: red 8ab331c, green d324d2a (`AddedTaskSelection`, the popover passes `keepSelection`).
- D1, one click did not always reopen after Open todz or ⌘0: aea915b (the main window opens and activates on the turn after the panel closes).
- Review 1, ⌘1 to ⌘9 registered twice and the active-workspace guard on one path: red 983217e, green c5258ae.
- Review 4, shortcut numbering moved into TodzKit: red 1621b24, green 69f58a2.
- Review 3, popover rows by keyboard: 0445e1c.
- Review 5, the ADR 0031 pointer on the close: 4a63f6f.
- Review 6 and edge case 3, heading and empty body styles: 0248a08.

## Failure modes

| Step | What breaks | How I notice (the concrete signal) | How I back out |
|------|-------------|------------------------------------|----------------|
| 1 | the main window's add field adds to the wrong place after the move | `AppModelTests+Destinations` or the walk's main-window add lands in another project or date | the rule is moved verbatim; revert the move |
| 4 | a ⌘-digit beyond the list crashes on an index | `WorkspaceShortcutsTests` with 3 of 2 traps | bounds checked before indexing |
| 5 | two model launches (main window and popover) race | two `PATCH /owner` at launch in the server log | `launch()` runs once per process; the second call returns at once |
| 5 | a launch with no main window never loads | the popover stays on loading after a relaunch with the window closed | the popover's content and the label start the launch too |
| 6 | closing the main window quits the app and the status item goes | the walk's close-the-window box finds no `Todz` process | `applicationShouldTerminateAfterLastWindowClosed` returns false through the delegate adaptor |
| 6 | the status item stays "open" after a close from code, so the next click only closes | the walk's reopen box needs two clicks | close through the panel's own `close()` rather than `orderOut`; else leave the popover open and say so |
| 6 | focus-on-open works only the first time | the walk's open → close → open box finds the field unfocused | the open signal is the panel's `didBecomeKey`, not `onAppear` |
| 6 | "Open todz" or a row click does nothing when the main window is closed | no main window in the CoreGraphics list after the click | `openWindow(id: MainWindowScene.identifier)`, then `NSApp.activate()` |
| 7 | ⌘N in the popover changes the main window's selection | the main window's selected item changes after ⌘N in the popover | a popover-local ⌘N button wins over the main menu's |
| 7 | a lingering task shows twice, or the popover check lingers by the window's view | two rows of one task in the popover, or no linger with the window on a project | rows from `TaskSections` for `.today`; `toggleDone` takes the item |
| 7 | the popover renders a huge Today list beyond the screen | the walk with 30 tasks sees a window taller than 520 points | the rows scroll inside the maximum height |
| 7 | "Offline" announced twice | two announcements in the accessibility notifications | only the main window's status item announces |
| 8 | a ⌘ digit switches twice or never | two pulls of the new workspace's projects in the server log, or none | one registration, in `AppCommands`; popover-local buttons only if proven necessary, never both |

**Steps with no backout:** none; nothing is deployed and no data shape changes.

## Z. Prove and ship

- [x] **Tester briefing:** a developer wrote `tester-briefing.md` — evidence: e1dff1c (G2), the fix round 1 section in 09f01fb.
- [x] **Tester run:** a fresh `tester` sub-agent executed `test-plan.md` and ticked every box with evidence — evidence: pass 1 09e1764 (stopped at the owner's request), pass 2 e664df1 with his OK; 41 ticked, 12 open (BLOCKED or not reached, and the D1 timing gap accepted as the loop's call), each stated in the PR.
- [x] **Reviewer:** a fresh `reviewer` sub-agent returned a verdict; refutation of the three riskiest claims is recorded in `test-plan.md` — evidence: WITH RESERVATIONS at b699270 (answered by fix round 1), WITH RESERVATIONS at e0e79b3 (docs fixed in e0e79b3, D1 accepted); refutations under Adversarial review.
- [x] **Security reviewer:** a fresh `security-reviewer` sub-agent returned its verdict — evidence: CLEAR at b699270.
- [ ] **/check-ui:** screenshots and video recorded from the Orca walk and uploaded; the README gallery shot under `docs/screenshots/menu-bar/` and its cell in the root README, by the lead after the tester's walk. [13]
- [ ] **/open-pr:** gates passed, learnings sweep stated, PR opened.
