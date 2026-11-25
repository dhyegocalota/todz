# Plan: Siri shortcuts

**Spec:** spec.md
**Tier:** 🟡
**Seam:** new `AppModel` extensions and plain types in `TodzKit` that answer, add and complete for a Shortcut; in the app, `Todz/Shortcuts/` holds three `AppIntent`s, a `TodzTaskEntity` with its `EntityStringQuery` and an `AppShortcutsProvider`, all reading the `AppModel` the `AppDelegate` registers with `AppDependencyManager`, beside the gate the Focus filter reads
**Assumptions (decided, owner can override):**
- `design.md`'s recommendations are the loop's calls; its copy is the copy (§ 8) and its static metadata stays literal at each declaration (§ 4).
- "What's left" is the active workspace's Today as the menu bar count reads it (`taskViews.today.open`, `isTodayKnown(in:)`); its snippet rows are `AppModel.morningGlanceContent`, so a pending task is neither counted nor listed (ADR 0036, ADR 0062).
- Add reuses `addTaskDestination(for: .today)` and `addTaskDestination(for: .inbox)` and `addTask(title:projectIdentifier:dueDate:selection: .keepSelection)`; complete reuses `complete(task:)`. Both reach the outbox; nothing new is written to the App Group.
- Entity rows reuse `WidgetSnapshotTask.of(_:day:)`; a task without a number (pending) is never an entity.
- Matching is `localizedStandardContains`-style: case and diacritic insensitive, over the title only; Today's open tasks first in Today's order, then the active workspace's other open tasks in sidebar order (`TaskViews`' project order), at most `ShortcutLimits.taskLimit` (10).
- The readiness wait observes the model with `withObservationTracking` and bounds itself with the model's injected `pause`, so tests hold it with `HeldPause`; it calls `launch()` first, which returns at once once launched (ADR 0031).
- Every rule an intent follows is red in G1; G2 holds only App Intents and SwiftUI glue, proven by the builds, the metadata read from the product, and the walk.
- `openAppWhenRun` stays false; no `supportedModes` (macOS 26 only; the floor is 14).

## Siblings

`feat/day-email` edits `TodzKit/Sources/TodzKit/AppModel.swift`, `TodzKitTests/FakeOwnerService.swift`, `FakeCall.swift`, `OwnerFixtures.swift`, `Todz/Settings/SettingsView.swift` and `Copy/SettingsCopy.swift` (its diff on 2026-11-25). No step here edits any of them: G1 adds files and builds on `AppModelHarness` as it is; a missing harness helper goes in a new `ShortcutHarness.swift`, never in the shared files. Whichever branch merges second merges `origin/main` into itself, never rebases, and keeps both sides; the lead names any collision to the lane at its next task boundary.

## File map

| Group | Paths owned | Developer sub-agent |
|-------|-------------|---------------------|
| G1 (TodzKit) | `apps/macos/TodzKit/Sources/TodzKit/{ShortcutLimits,ShortcutReadiness,ShortcutToday,ShortcutAddition,ShortcutAddDestination,ShortcutCompletion,TaskKey+Shortcut,AppModel+Shortcuts}.swift` (new), `apps/macos/TodzKit/Tests/TodzKitTests/{TaskKeyShortcutTests,AppModelTests+ShortcutReads,AppModelTests+ShortcutWrites,AppModelTests+ShortcutReadiness,ShortcutHarness}.swift` (new), the `## G1` section of `docs/features/siri-shortcuts/tester-briefing.md` | `developer` (Opus) |
| G2 (App) | `apps/macos/Todz/Shortcuts/` (new: `TodzTaskEntity.swift`, `TodzTaskQuery.swift`, `LeftTodayIntent.swift`, `AddTaskIntent.swift`, `CompleteTaskIntent.swift`, `TodzShortcuts.swift`, `ShortcutRefusal.swift`, `LeftTodaySnippet.swift`), `apps/macos/Todz/Shared/TodayDigest.swift` (new), `apps/macos/Todz/MorningGlance/MorningGlanceView.swift`, `apps/macos/Todz/AppDelegate.swift` (the initializer only), `apps/macos/Copy/ShortcutsCopy.swift` (new), the `## G2` section of `docs/features/siri-shortcuts/tester-briefing.md` | `developer` (Sonnet) |
| Lead | `apps/macos/README.md`, `docs/product/README.md`, `README.md` (walk), `docs/screenshots/siri-shortcuts/`, the spec's status line and its index row | lead |

## Sequencing

G1 first through Step 3: its red commits carry a stub for every public symbol, so the app compiles against the final interfaces. G2 starts in its own worktree after Step 3's red commit, merges G1's branch (never rebase), and merges it again after Step 4. Steps 6 and 7 need nothing from G1 and may start at once. The groups never touch the same file. The lead's Step 12 waits for the tester's screenshots.

## Steps

### G1

- [ ] **Step 1:** Red, one commit `test(siri-shortcuts): the identifier, Today's answer and the task reads (red)`, with stubs that `fatalError("<Type>.<member> is not implemented")`: `TaskKey.shortcutIdentifier`, `TaskKey.init(shortcutIdentifier:)`, `AppModel.shortcutToday`, `AppModel.shortcutSuggestedTasks`, `AppModel.shortcutTasks(matching:)`, `AppModel.shortcutTasks(for:)`; `ShortcutLimits` (`readinessWait` 5 s, `taskLimit` 10) and `ShortcutToday` are plain declarations.
  - `TaskKeyShortcutTests`: `acme-inbox`/12 → `acme-inbox/12` and back; a project identifier holding `-` round-trips; `abc`, `abc/`, `/3`, `abc/0`, `abc/-1`, `abc/x`, `abc/1.5` and `` → nil; `a/b/3` → project `a/b`, number 3 (the last separator).
  - `AppModelTests+ShortcutReads`, Today: nil while loading and while signed out; empty Today → count 0, no rows, no tasks; one; five; seven → five rows, rest 2, seven tasks in Today's order; overdue kept on its row; a pending task neither counted nor listed and equal to `todayHeadingCount`; `workspaceName` is the active workspace's; `isOffline` true after an unreachable pull with a cache, false online.
  - Reads: suggestions are Today's open in Today's order, eleven open → ten; done-today tasks never suggested; an undated Inbox task is not suggested; matching `review` finds `Review PR` and `Code review` (case), `revisao` finds `Revisão do contrato` (diacritics), `ship` finds `🚀 Ship it` (emoji), a Today match comes before an undated one, twelve matches → ten, `""` and only spaces → none, a done task never matches, a task of another workspace never matches; `for:` resolves an open and a done task of the active workspace in the order asked, drops an unknown key and a key of another workspace, and drops everything while signed out.
- [ ] **Step 2:** Green: `TaskKey+Shortcut` (`// NB ADR 0066` on the separator); `AppModel+Shortcuts` reads: `shortcutToday` from `activeWorkspace`, `isTodayKnown(in:)`, `morningGlanceContent`, `taskViews.today.open` and `isOffline`; the three reads over `taskViews` (Today, then the projects' open tasks), `WidgetSnapshotTask.of(_:day:)`, capped at `ShortcutLimits.taskLimit`.
- [ ] **Step 3:** Red, one commit `test(siri-shortcuts): readiness, add and complete (red)`, with stubs for `AppModel.shortcutReadiness()`, `AppModel.addFromShortcut(title:isDueToday:)`, `AppModel.completeFromShortcut(key:)`; `ShortcutReadiness`, `ShortcutAddition`, `ShortcutAddDestination` and `ShortcutCompletion` are plain enums.
  - `AppModelTests+ShortcutReadiness`: a launched, loaded model → `.ready` with no pause taken; an unlaunched model with a cache → `.ready` and `launch()` ran; signed out → `.signedOut`; signed in with no workspace → `.noWorkspace`; the workspace listing held → `.loading` once the held `readinessWait` pause is released, and the pause asked for is 5 s; the listing answers before the pause ends → `.ready`; a sign-out while waiting → `.signedOut`.
  - `AppModelTests+ShortcutWrites`, add: `Book the dentist`, due today → `.added(title:, destination: .today, workspaceName: "acme", isOffline: false)`, one `.add` in the outbox for the Inbox with today's date; `isDueToday: false` → `.inbox`, no date; a selected task stays selected; `""` and three spaces → `.refused(.titleEmpty)`, outbox unchanged; 200 characters → added; 201 → `.refused(.titleTooLong)`; an emoji title is kept as typed; offline (unreachable) → `isOffline: true` and the change kept in the store's outbox; signed out → `.signedOut`, nothing queued; no workspace → `.noWorkspace`; after a workspace switch the add goes to the new workspace's Inbox and names it.
  - Complete: an open Today task → `.completed(title:isOffline: false)`, one `.state(key, .done, …)` queued; an open undated Inbox task → completed; a done task → `.alreadyDone(title:)`, nothing queued; an unknown number → `.notFound`; a task of another workspace → `.notFound`, nothing queued; offline → `isOffline: true`, kept in the store; signed out → `.signedOut`; completing the same key twice in a row → the second answers `.alreadyDone` (the outbox overlay already shows it done).
- [ ] **Step 4:** Green: `shortcutReadiness()` (launch, then the first of the four by observation, bounded by `pause(ShortcutLimits.readinessWait)`, `// NB ADR 0066` on the bound); `addFromShortcut` (readiness of the phase, `TextCheck.issue(ofTitle:)`, the destination, `addTask(… selection: .keepSelection)`); `completeFromShortcut` (the active workspace's board with the outbox applied, then `complete(task:)`).
- [ ] **Step 5:** `swift test --package-path apps/macos/TodzKit` green with its count. The `## G1` section of `tester-briefing.md`: each red run's printed text, run serially (`--no-parallel --filter <suite>`), the count, the hypotheses.

### G2

- [ ] **Step 6:** Copy: `ShortcutsCopy` with every string of `design.md` § 8.
- [ ] **Step 7:** `TodayDigest` in `Todz/Shared/`: the heading with the count, an optional subtitle, the rows with the overdue word, the rest line and the empty line, moved out of `MorningGlanceView`, which now draws it inside its glass; the glance's look and accessibility unchanged. Commit as `refactor(siri-shortcuts): …` with `pin` in its body (no red test: the app target has none; the build and the glance's unchanged `TodzKit` tests are the proof).
- [ ] **Step 8:** `TodzTaskEntity` (identifier `TaskKey.shortcutIdentifier`, title, project name, `displayRepresentation` title and subtitle) and `TodzTaskQuery: EntityStringQuery` (each method awaits `shortcutReadiness()`, then the three reads; anything but `.ready` answers `[]` for the reads); `ShortcutRefusal: Error, CustomLocalizedStringResourceConvertible` with one case per refusal and the rule issue, its text from `ShortcutsCopy` and `RuleIssue.copy`.
- [ ] **Step 9:** The intents, each `@MainActor` `perform()` with `@Dependency private var model: AppModel`, titles and parameters literal per `design.md` § 4:
  - `LeftTodayIntent`: `ReturnsValue<[TodzTaskEntity]> & ProvidesDialog & ShowsSnippetView`; the dialog `IntentDialog(full:supporting:)` per § 1.1, `offline` appended when offline; the snippet `LeftTodaySnippet` (`TodayDigest` with the workspace name, one accessibility element per § 5).
  - `AddTaskIntent`: `Title` with `requestValueDialog` `ShortcutsCopy.askTitle`, `Due Today` default true; `ReturnsValue<String> & ProvidesDialog`.
  - `CompleteTaskIntent`: `Task` with `requestValueDialog` `ShortcutsCopy.askTask`; `ProvidesDialog`; the key from the entity's identifier; a nil key throws the gone refusal.
  - Anything but `.ready`, `.added` or `.completed`/`.alreadyDone` throws its `ShortcutRefusal`. No title is logged anywhere.
- [ ] **Step 10:** `TodzShortcuts: AppShortcutsProvider` with the three shortcuts, their phrases, short titles and symbols of § 4 and § 1.5, no tile colour; `AppDelegate.init` adds `AppDependencyManager.shared.add(dependency: model)` beside the gate's line.
- [ ] **Step 11:** `xcodegen generate`, Debug and Release `xcodebuild` print `BUILD SUCCEEDED` with no `error:` and no `warning:` other than the metadata processor's known noise (quoted in the briefing); `Metadata.appintents/extract.actionsdata` of the Debug product lists `LeftTodayIntent`, `AddTaskIntent`, `CompleteTaskIntent` and `TodzFocusFilter`, the entity, and three `autoShortcuts` with the six phrases; `codesign -dv --entitlements -` shows the same keys as before (no Siri key); `swift test --package-path apps/macos/TodzKit` green with its count. The `## G2` section of `tester-briefing.md`: what changed, the printed metadata and entitlements, each action's identifier as Shortcuts will name it, and every "it works" as a hypothesis.

### Lead

- [ ] **Step 12:** The app README names the three shortcuts (purpose only); the product design's macOS section gains one bullet for Siri and Shortcuts; the README walk gains `docs/screenshots/siri-shortcuts/left-today.png` from the tester's capture if ADR 0047's dozen cells allow it, else the PR alone carries it and this box says so. The spec's status and its row move with the build (`Building` at the first commit).

## Failure modes

| Step | What breaks | How I notice (the concrete signal) | How I back out |
|------|-------------|------------------------------------|----------------|
| 2 | Matching misses diacritics or emoji | the `revisao` or `ship` test stays red | compare with `range(of:options: [.caseInsensitive, .diacriticInsensitive])` over the title |
| 4 | The readiness wait never ends when the model changes | a test hangs past its time limit; in the app a Siri timeout | the observation re-arms on each change; else a pause-driven loop that re-reads the four outcomes each 100 ms within the bound |
| 4 | An add queued while the owner's confirmation is pending is never sent | the offline test passes but the walk's task never reaches the server | it is the outbox's existing path (`startSending` asks for a reload); a learning and a fix in the outbox, never a second write path |
| 7 | The extraction changes the glance | the glance looks different in a capture or loses its accessibility element | revert Step 7 and let `LeftTodaySnippet` draw its own rows; strike the step with the reason |
| 8 | `@Dependency` read before registration crashes a cold run | a crash report `Todz-*.ips` naming `AppDependencyManager` after `shortcuts run` with todz quit | register in `TodzApp.init` before the delegate's model is used, or pass a static model reference; a learning |
| 9 | `requestValueDialog` from `ShortcutsCopy` is rejected by the metadata processor | a build `error:` naming the parameter | a literal at the declaration, the same text, and `design.md` § 4 says so |
| 9 | The snippet is not shown on macOS | the walk's result shows the dialog only | accept it (design O1 B) and record it in `design.md` |
| 10 | The shortcuts do not appear after a launch | the Shortcuts app lists no todz tile | `lsregister -f` on the Debug product and a second launch; a learning if still absent |
| 10 | A cold run opens the main window or activates todz | the walk's frontmost sampler changes, or a todz window appears | the delegate closes the main window when the launch is not the default launch (`NSApplication.launchIsDefaultLaunchKey` false), a new step with its own walk box; ADR 0066 Consequences revisited |
| 11 | A new entitlement appears | `codesign` lists a key that was not there | remove it; nothing in this feature needs one |
| walk | `shortcuts run` cannot reach the intents | the import of the helper shortcuts fails, or a run prints that the action is missing | the tester runs the shortcuts inside the Shortcuts app with Orca, one session; the rows it cannot reach go to the Human checklist |

**Steps with no backout:** none.

## Z. Prove and ship

- [ ] **Tester briefing:** G1 and G2 wrote their sections of `tester-briefing.md`.
- [ ] **Tester run:** a fresh `tester` sub-agent executed `test-plan.md` and ticked every box with evidence.
- [ ] **Reviewer:** a verdict; refutation recorded in `test-plan.md`.
- [ ] **Security reviewer:** a verdict (titles in dialogs and logs, the outbox path, the entity identifiers across workspaces).
- [ ] **/check-ui:** the Shortcuts list and a "what's left" result, from the walk's single Shortcuts session, by Orca (ADR 0026).
- [ ] **/open-pr:** gates passed, learnings sweep stated, PR opened.
