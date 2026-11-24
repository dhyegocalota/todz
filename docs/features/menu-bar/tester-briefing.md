# Tester briefing: Menu bar

Written by `developer-app` (G2, plan steps 5 to 9) on 2026-11-24. G1 (steps 1 to 4) wrote no briefing; its red texts are in `git log` (`06747ab`, `d14ef65`, `362ec14`, `36a6d28`). The developer does not run `test-plan.md` and does not declare the feature works.

## What changed

TodzKit (step 5):

- `AppModel.swift` — `launch()` runs once per process: a second call, during or after the first, returns at once (`hasLaunched`, `// NB ADR 0031`).
- `AppModelTests.swift` — two tests for it (below).

The app target (steps 6 to 8):

- `Shared/WorkspaceSwitcher.swift`, `Shared/AddTaskField.swift`, `Shared/SyncStatusItem.swift` — moved from `MainWindow/` with `git mv` (`1637b9a`), then (`2c62904`): the switcher takes `isMainWindow` (outside it: workspaces only, a sole workspace as plain text, the menu truncates instead of keeping its full width); the add field is generic over its focus value and reports its Escape as `AddTaskFieldEscape` (`.clearedTitle` or `.wasEmpty`), and clears its title and issue when its destination changes; the sync item announces "Offline" only with `announcesChanges`.
- `Shared/TaskCheckbox.swift`, `MainWindowState.swift`, `MainWindow/TaskList/TaskRow.swift`, `TaskRows.swift`, `TaskListState.swift`, `TaskListView.swift`, `MainWindow/Inspector/TaskInspector.swift`, `TaskMenuItems.swift` — `toggleDone(task:item:model:)` and `TaskListState.of(workspace:item:…)` take the item; the main window passes `model.selectedItem`, the popover `.today`.
- `TodzApp.swift` — the `MenuBarExtra` scene (`.window` style, 360 wide) beside the `Window`, both over the one `model` and `windowState`; `@NSApplicationDelegateAdaptor`.
- `AppDelegate.swift` — `applicationShouldTerminateAfterLastWindowClosed` → false.
- `MainWindowScene.swift` — the main window's identifier, shared with `openWindow`.
- `Shared/OpenWindowAction+MainWindow.swift` — opens or raises the main window, then `NSApp.activate()`.
- `MenuBar/MenuBarLabel.swift` — the status item: `checkmark.square`, labelled "todz", whose `.task` starts the launch.
- `MenuBar/MenuBarPanel.swift`, `MenuBar/MenuBarPanelReader.swift` — the panel's `NSWindow`: becoming key focuses the field; a close from code clicks the status item's own `NSStatusBarButton`.
- `MenuBar/MenuBarPopover.swift` — the root: one state per phase, the launch, the reader. `MenuBarLoading`, `MenuBarPrompt` (signed out, naming), `MenuBarToday` (ready: header, banner, field, heading, rows, foot, the hidden ⌘N button, the 520-point cap), `MenuBarHeader` (switcher, Open todz with ⌘0), `MenuBarTodayHeading`, `MenuBarTodayBody`, `MenuBarTodayRows`, `MenuBarRow` (row click, hover, accessibility hint and default action), `MenuBarFoot`, `MenuBarFocus`.
- `Copy/MenuBarCopy.swift` (new), `Copy/AccessibilityCopy.swift` (`rowOpensWindow`) — every string of `design.md` § 8.
- `AppCommands.swift`, `WorkspaceMenuItems.swift`, `Shared/WorkspaceShortcuts+Keyboard.swift` — the View menu's ⌘1 to ⌘9, the one registration of the keys; the switcher shows the same keys on its first nine items.
- `apps/macos/README.md` — names the menu bar extra.

## How to run

The server, from `apps/api`, with a new scratch folder `<state>` and port 8787 free:

```
pnpm exec wrangler d1 migrations apply directory --local --persist-to <state>
pnpm exec wrangler dev --var SIGN_IN_PROVIDER:fake --persist-to <state> --port 8787
```

The app, from the repository root:

```
xcodegen generate --spec apps/macos/project.yml
xcodebuild build -project apps/macos/Todz.xcodeproj -scheme Todz -configuration Debug -derivedDataPath apps/macos/build
open -g apps/macos/build/Build/Products/Debug/Todz.app
```

`open -g` keeps the app in the background. To see what the app prints, add `--stderr <file>`. Quit with ⌘Q, `osascript -e 'tell application id "dev.todz.Todz" to quit'` or `pkill -f Todz.app/Contents/MacOS/Todz`. The session file is `~/Library/Containers/dev.todz.Todz/Data/Library/Application Support/session` and the cache is the `Cache` folder beside it. The session already there belongs to an earlier run: back it up first and put it back at the end. Writing a fresh session token into that file (no newline) and deleting `Cache` starts the app signed in as that owner.

**Open the popover in the background** (ADR 0031 § 5), with a file holding:

```
tell application "System Events"
	tell process "Todz"
		click menu bar item 1 of menu bar 2
	end tell
end tell
```

and `osascript <file>`. The status item answers as `menu bar item todz`. The same click closes an open popover.

**Find the popover's window id.** Orca's `list-windows` does not list it. CoreGraphics does: the popover is the on-screen window of layer 101 (`swift <scratchpad>/spike/list-windows.swift Todz`, or a binary compiled from it with `swiftc`, prints `number layer onScreen bounds`). The id stays the same each time the popover opens. Then:

```
orca computer get-app-state --app dev.todz.Todz --window-id <id> --json
orca computer type-text --app dev.todz.Todz --window-id <id> --text "…"
orca computer press-key --app dev.todz.Todz --window-id <id> --key Escape
orca computer hotkey --app dev.todz.Todz --window-id <id> --key Cmd+2
orca computer click --app dev.todz.Todz --window-id <id> --x <x> --y <y>
```

Element indexes change from one snapshot to the next: read them again before each click. A row is a single accessibility element whose checkbox has no index, so click the checkbox by its coordinates (left edge of the row, about 23 points in). Orca refuses to open a menu in the background (`background_unavailable`), so the switcher's menu can only be read with `--restore-window`, which needs the owner's OK. System Events reads the View menu without opening it (`value of attribute "AXMenuItemCmdChar"` of each `menu item of menu 1 of menu bar item "View" of menu bar 1`).

**The main window from System Events:** its close button is `first button of (first window whose subrole is "AXStandardWindow") whose subrole is "AXCloseButton"`; a Dock click with no window is `osascript -e 'tell application id "dev.todz.Todz" to reopen'`. The CoreGraphics list keeps a closing window "on screen" for a moment; count `AXStandardWindow`s instead.

**Counting a switch.** One workspace activation shows two `GET /owner/projects/<inbox>/changes` in the server log, the pull from zero and the pull when its socket opens, exactly as at launch. A double registration of a ⌘ digit would show four.

## Mechanisms proved by the developer (step 6 and risks a to c)

All against `wrangler dev` with a seeded owner (two workspaces, `acme` and `side`; Today with an overdue task, open tasks and one done today), background input only.

| Risk | What was done | What was seen |
|---|---|---|
| (a) the label's `.task` launches with no window | quit with the main window closed, relaunched with `open -g`, counted `PATCH /owner` after the launch; then the same with the label's `.task` removed from a scratch build | no main window was restored; one `PATCH /owner`, then the workspace list and the Inbox's pulls. Without the label's task: no request at all. So the label, not a hidden popover, starts the launch |
| (b) a close from code, then one click reopens with the field focused | first try, `window.close()`: the panel closed, but the next click on the status item did nothing and a second click opened it, because the item still thought it was open. Final: `MenuBarPanel.close()` clicks the item's own `NSStatusBarButton` (found in `NSApp.windows`). Three rounds of open → Escape on the empty field → one click; then type a draft → click the item (closes) → click (opens); then Open todz → one click | every reopen took one click; the field was focused each time (Orca: "The focused UI element is … text field"); the draft "Draft survives" was still in the field. Focus on open needs the reader to call back when it joins a window that is already key, and the focus request goes through a `Task`; with only `didBecomeKey`, the field was not focused on the first open |
| (c) ⌘ digits from the View menu while the popover is key | `orca computer hotkey … --window-id <popover> --key Cmd+2`, before the switcher showed any keys | the popover's header changed from `acme` to `side`, the server logged two `GET …/changes` of side's Inbox (one activation). ⌘1 back the same; ⌘3 with two workspaces: no request; ⌘2 with `side` active: no request; ⌘2 into the main window: one activation. ⌘R into the popover refreshed (one `GET …/changes`), so the View menu reaches the popover. No popover-local digit buttons were added |

Also seen: Open todz closes the popover and shows the main window, also after the main window was closed; ⌘0 into the popover does the same; with the main window closed the process kept running and the status item stayed; a `reopen` event with no window opened the main window, through SwiftUI's own handling (no `applicationShouldHandleReopen` was needed, so none was written); ⌘N into the popover focused its field; a row click opened the main window on Today with that task selected and the inspector shown; a task added from the field was posted once and appeared under the open rows with the field still focused; a checked row lingered in place, then moved to the done rows; 32 open tasks held the popover at 360 × 520 with the rows scrolling; after ⌘1 with a draft in the field, the draft cleared and the field kept the focus; a workspace named with 60 characters truncated in the header; signed out, the popover showed "Sign in to see what's due today." and Open todz.

## Red today, green after

| Test | Red before the change because | Green after because |
|------|--------------------------------|---------------------|
| `AppModelTests::aSecondLaunchWhileTheFirstWaitsOnTheServiceReturnsAtOnceWithoutReadingTheVault` | red run `d15f4bb`: `AppModelTests.swift:51: Expectation failed: harness.model.phase == .loading (harness.model.phase → .signedOut(notice: .sessionUnreadable))`: the second launch read the vault, made unreadable after the first launch started | `5e24604`: the second call returns before the vault is read; one `updateOwner`, and the first launch still reaches `.ready` |
| `AppModelTests::aLaunchAfterAFinishedLaunchCallsNothing` | red run `d15f4bb`: `AppModelTests.swift:64: Expectation failed: harness.service.calls == [] (… → [listWorkspaces, readChanges(acme-inbox, cursor: 0)])` | `5e24604`: no call after a finished launch |

"One vault read" is proven without touching the shared `InMemorySessionVault` (not this lane's file): the vault is made unreadable while the first launch waits on `updateOwner`, so a second read would have signed the model out.

`swift test` from `apps/macos/TodzKit`: 355 tests in 23 suites, all green at `42a72ac`. The app builds at every commit of this lane with no warning from `apps/macos/Todz/` or `TodzKit/Sources/`. Steps 6 to 8 have no unit seam (the app target has no test target); their proof is the build, the checks above and the walk.

One trap for the tester: `swift test` run from a `zsh <script>` on this Mac also launched the XCTest runner as x86_64 and exited 1 ("doesn't contain a version for the current architecture") although every Swift Testing test passed; run it directly from the shell, as the `macos` gate does.

## Hypotheses to attack

Every "it works" is a hypothesis the tester tries to break.

1. Hypothesis: one click on the status item reopens the popover after every close from code (Escape on an empty field, Open todz, ⌘0, a row click). Break it by: alternating each close with a click-outside close and a status-item close, ten times; with the main window closed and open; after a workspace switch.
2. Hypothesis: the field is focused every time the popover opens, and a draft survives a close. Break it by: opening it while another app is frontmost, after Open todz activated the app, and after a sign-in from the main window.
3. Hypothesis: a ⌘ digit switches exactly once from either surface. Break it by: pressing ⌘2 into the popover and into the main window with both open; counting `GET …/changes` of the new Inbox (two per activation); with ten workspaces, ⌘9 and the tenth through the menu.
4. Hypothesis: the switcher's first nine items show ⌘1 to ⌘9 and the keys still fire once. Unread by the developer: Orca cannot open the menu in the background. Break it by: reading the menu with the owner's OK for `--restore-window`, then pressing ⌘1 with the menu closed and counting pulls.
5. Hypothesis: a check in the popover lingers in the popover whatever the main window shows, and never shows a task twice. Break it by: selecting a project in the main window, then checking a Today task in the popover; checking twice during the linger (undo).
6. Hypothesis: ⌘N in the popover never changes the main window's selection. Break it by: selecting Upcoming in the main window, opening the popover, pressing ⌘N, then reading the main window's sidebar selection.
7. Hypothesis: the launch runs once, whichever surface asks first. Break it by: relaunching with the window open and with it closed, opening the popover at once, and counting `PATCH /owner` (one).
8. Hypothesis: closing the main window keeps the app and the status item; ⌘Q quits both; a Dock click (or `reopen`) brings the window back. Break it by: closing the window from its button and with ⌘W, then Dock, then ⌘Q from the popover.
9. Hypothesis: every phase has its popover state (signed out with and without a notice, loading, launch failed, naming, first load, load failed, empty, all done, offline, a refused add with the banner). Break it by: the walk of `test-plan.md`; offline with the server stopped, and the offline item in the foot refreshing on click.
10. Hypothesis: the popover stays 360 wide and at most 520 high, with the header, field and foot pinned. Break it by: many tasks, a long workspace name, long titles, a raised banner and an inline rule issue at once.
11. Hypothesis: Escape on an empty field closes the popover, and Escape with text only clears it; Escape with the focus elsewhere closes it too. Break it by: Tab to a row or to Open todz, then Escape (not checked by the developer).
12. Hypothesis: the main window behaves as before: Escape in its add field clears it and moves to the list at once; its switcher keeps New Workspace and Sign Out and its full width. Break it by: the shell's own keyboard checks.

## Known gaps

- ADR 0031 → Consequences says a close from code goes through the panel's `close()`. That left the status item open (the next click did nothing). The close clicks the item's own button instead; the ADR needs that line amended by the lead (not this lane's file). For the same reason `MenuBarPanel.close()` carries no `// NB ADR` pointer.
- Plan step 6 asked for `applicationShouldHandleReopen`. SwiftUI already reopens the `Window` scene on a reopen event (seen), so the delegate holds only `applicationShouldTerminateAfterLastWindowClosed`.
- Plan step 7 asked for the rows' height measured with a `GeometryReader`. It is measured with `onGeometryChange` (back-deployed to macOS 13) on the pinned top, the foot and the rows' content; the rows take `min(content, 520 − pinned − foot)`.
- The popover's field is not rebuilt per destination (the main window's still is): rebuilding it dropped the focus after a ⌘ digit, so the field clears its own title and issue when its destination changes (`bf99e43`).
- Rows are not reachable with Tab or Full Keyboard Access as separate rows, and Return or Space on a row is not wired; VoiceOver has the row's default action (opens the main window) and its hint. `design.md` § 5 asks for keyboard rows.
- The "Today, 5 left" heading uses `.font(.headline)`, not the system `List` section header style (the popover has no `List`).
- The switcher's shown keys (hypothesis 4) were not seen.
- Not exercised by the developer: offline, the launch-failed and load-failed states, naming, a refused add, the banner's Dismiss across both surfaces, Reduce Motion, VoiceOver, light mode, ten workspaces.

## Fix round 1

Written by `developer-app` on 2026-11-24 after the tester's walk (defects D1, D2 and edge case 3) and the review (findings 1, 3, 4, 5, 6). The owner was working at this Mac, so the app was **not launched** in this round: no popover, no main window, no System Events or Orca. The proof is `swift test`, the app build and the reasoning below; every behaviour of the app target is a hypothesis for the rerun.

### What changed

| Fix | Commits | Where |
|-----|---------|-------|
| D2: a popover add selected the new task in the main window | red `8ab331c`, green `d324d2a` | `TodzKit/AddedTaskSelection.swift` (new: `selectWhenSaved`, `keepSelection`), `AppModel+Tasks.swift` (`addTask(…, selection:)`, default `selectWhenSaved`; only `selectWhenSaved` records the selection to restore), `Shared/AddTaskField.swift` (takes `selection`), `TaskListView.swift` passes `selectWhenSaved`, `MenuBarToday.swift` passes `keepSelection` |
| D1: one click did not always reopen after Open todz or ⌘0 | `aea915b` | `MenuBar/MenuBarPanel.swift`: `openMainWindow` closes the panel, then opens the main window and activates the app in a `Task`, on the next main-actor turn |
| Review 1: ⌘1 to ⌘9 registered twice; the active-workspace guard on one path | red `983217e`, green `c5258ae` | `Shared/WorkspaceSwitcher.swift`: its items carry no key and show none (the View menu is the one registration and the one place the keys show); its binding's guard goes. `AppModel+Workspaces.swift`: `switchWorkspace(identifier:)` returns before any call for the active workspace; `switchWorkspace(number:)` loses its own copy. `AppModelTests+Cache.swift`: the once-per-launch test switched to the already active workspace to write the owner file again, which is now a no-op, so it goes to a second workspace and back (mutation: with the once-per-launch guard removed it fails for `writeOwner` and `writeProject`) |
| Review 4: shortcut logic in the app | red `1621b24`, green `69f58a2` | `TodzKit/WorkspaceShortcuts.swift`: `numbers` (1…9, replaces `count`), `numbered(_:)` (the first nine with their numbers), `lastNumber(of:)`; `Shared/WorkspaceShortcuts+Keyboard.swift` keeps only the `KeyboardShortcut`; `WorkspaceMenuItems.swift` no longer trims the list |
| Review 3: rows not reachable by keyboard | `0445e1c` | `MenuBar/MenuBarRow.swift`: `.focusable()` and `onKeyPress` for Return and Space, both calling the click's `reveal()`; the VoiceOver default action and hint are unchanged |
| Review 5: no ADR pointer on the close | `4a63f6f` | `MenuBarPanel.close()` carries `// NB ADR 0031` |
| Review 6, edge case 3: heading and empty body styles | `0248a08` | `MenuBarTodayHeading.swift` drops `.font(.headline)` and reads as `TaskSectionHeader` (title primary, count secondary); `MenuBarTodayBody.swift`: both empty lines `.secondary`, the body still `.subheadline` |

This supersedes two lines above: "the switcher shows the same keys on its first nine items" (What changed) and "Rows are not reachable with Tab" and "The switcher's shown keys" (Known gaps).

### Red today, green after

| Test | Red run | Green after |
|------|---------|-------------|
| `AppModelTests::anAddThatKeepsTheSelectionLeavesItWhenTheServerAnswers` | `8ab331c`: `AppModelTests+Outbox.swift:121:9: Expectation failed: harness.model.selectedTask == firstTask` (the confirmed add selected task 3) | `d324d2a` |
| `AppModelTests::switchingToTheActiveWorkspaceMakesNoCall` | `983217e`: `AppModelTests+Workspaces.swift:80:9: Expectation failed: harness.service.calls == []` with `harness.service.calls → [readChanges(session: …, projectIdentifier: "acme-inbox", cursor: 0)]` | `c5258ae` |
| `WorkspaceShortcutsTests::theFirstNineWorkspacesAreNumberedFromOne`, `aShortListIsNumberedWhole`, `theLastNumberIsTheListLengthUpToNine` | `1621b24`: `TodzKit/WorkspaceShortcuts.swift:12: Fatal error: numbered(_:) is not implemented` and `:16: Fatal error: lastNumber(of:) is not implemented` | `69f58a2` |

`anAddShowsAPendingRowThenItsTaskSelectedWhenTheSelectionStayed` and `switchingWorkspaceByTheActiveNumberMakesNoCall` stay green. `swift test` from `apps/macos/TodzKit`: 360 tests in 23 suites, all green at `0248a08`. A clean `xcodebuild build` after `xcodegen generate` succeeds with no warning from `apps/macos/Todz/` or `TodzKit/Sources/` (only the usual `appintentsmetadataprocessor` line).

### Why D1 should be gone (reasoning, not a run)

Open todz, ⌘0 and a row click already shared `openMainWindow`; before this round it clicked the status item's button and then, in the same turn, opened the main window and called `NSApp.activate()`. Activating made the panel resign key while the status item was still toggling it shut, so the menu bar extra's own close-on-resign and the toggle raced: when the resign won, the item kept believing the panel was open and the next click only "closed" it (the 4 misses), or the panel reopened while the main window still held key (the 2 unfocused fields). A row click calls `model.reveal` first, which changes observed state and likely gave the toggle the time it needed, so it never lost (0 of 32); the tester's repro is `.pr-media/menu-bar/cycles-open-todz.log` and `cycles-window-open.log`. Now the toggle runs alone in the click's or the key's turn, and the window opens and the app activates in a `Task` queued after it on the main actor, so the panel is shut, with the item agreeing, before anything else takes key.

### Hypotheses for the rerun

1. D1: after Open todz, and separately after ⌘0, one click on the status item reopens the popover with the field focused, 30 cycles of each, with the main window open and with it closed, about 0.7 s between the close and the click as in the tester's repro; then the same with the click sent at once. Also check that Open todz still brings the main window to the front and makes it key every time, and a row click still selects its task with the inspector.
2. D2: with a task selected in the main window, an add from the popover leaves the main window's selection on that task after the server answers (the POST in the log); an add from the main window's field still selects the new task.
3. ⌘ digits: ⌘2 into the popover and into the main window each make exactly one round of pulls of the new workspace's Inbox (two `GET …/changes`, as at launch); ⌘ with the active workspace's number and choosing the active workspace in the switcher make none.
4. The switcher's menu shows the workspaces without ⌘ keys; the View menu lists the first nine with ⌘1 to ⌘9.
5. Tab from the add field reaches each popover row in turn (a focus ring on the row), and Return or Space on a focused row closes the popover and shows that task in the main window with the inspector. Untested whether Tab needs Full Keyboard Access (System Settings → Keyboard → Keyboard navigation); `design.md` § 5 says rows are reached with it. Space on a focused checkbox still toggles done, not the row.
6. The Today heading reads in the body font like a main-window section header, and both lines of the empty Today are secondary.

### Known gaps

- `design.md` § 2 still says the switcher's items carry ⌘1 to ⌘9; after review finding 1 they do not. Not this lane's file: the lead amends it.
- The heading matches `TaskSectionHeader`'s own view, which sets no font; in the main window the `List` adds its section header treatment, which a `VStack` in the popover does not inherit. If the rerun's screenshots show the two differ, the owner picks the font.
- D1's fix and the keyboard rows have no unit seam (the app target has no test target); only the rerun proves them.
