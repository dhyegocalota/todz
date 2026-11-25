# Plan: Morning glance

**Spec:** spec.md
**Tier:** 🟡
**Seam:** a `MorningGlanceCoordinator` in `TodzKit` beside the `DayCloseCoordinator`, built on the shared `ProactiveGate`; in the app, a `MorningGlanceTrigger` owned by the `AppDelegate` that calls `check()` on each chance, and a `MorningGlancePresenter` that shows the app's first panel and answers whether it is on screen
**Assumptions (decided, owner can override):**
- `design.md`'s recommendations are the loop's calls; its copy is the copy.
- The spike's panel is the mechanism (ADR 0062 Evidence): an `NSPanel` subclass with `canBecomeKey` and `canBecomeMain` false, `[.borderless, .nonactivatingPanel]`, `.statusBar`, `[.canJoinAllSpaces, .fullScreenAuxiliary, .stationary]`, `hidesOnDeactivate = false`, `becomesKeyOnlyIfNeeded`, shown with `NSApp.unhideWithoutActivation()` (only when `NSApp.isHidden`) then `orderFrontRegardless()`.
- The preference and `lastMorningGlanceDay` live in `UserDefaults.standard` with a registered default, as `DayClosePreference`; the day is a `CalendarDate` string.
- "Today" is the active workspace's Today as the menu bar count reads it (`todayHeadingCount`, ADR 0036); the rows are `taskViews.today.open` mapped with `WidgetSnapshotTask.of(_:day:)`, so pending tasks are neither counted nor listed, as in the count.
- The click reuses the widget's Today link: the presenter sets `windowState.waitingLink = .today`, and `MenuBarLabel`'s existing observer follows it and calls `openWindow.mainWindow()`, which activates todz.
- Every decision the app can make from plain values is a pure `TodzKit` type with red tests (`MorningGlanceDwell`, `MorningGlanceFront`, the coordinator's inputs), so the app lane holds only AppKit glue; the panel's traits are proven by the walk (R9).

## Lessons from the day close, folded in up front

| Day-close round | What it taught | Where it lives here |
|---|---|---|
| security finding 1, round 6 | a surface that shows itself must never take keystrokes meant for another app | the panel can never become key or main and has no keys (Step 7); walk boxes read the frontmost app, the panel's subrole and level, and a typed key |
| review 3, round 6 A | mark the day only once the surface is seen | `showPanel` answers true only when the occlusion turns visible within 1 s; the coordinator marks only then (Steps 3, 7) |
| round 7 R2, security-fixes | a mode left from an earlier day must not count as today's | the chance records its day; only that day is marked; a release, a late Today or an unlock on another day is a fresh chance or nothing (Step 3) |
| review 4 | a locked screen opens nothing | `isScreenLocked` before the gate, again right before ordering front and after the answer; the unlock and the app switch retry (Steps 3, 7, 8) |
| review 1 | the day follows the Mac's time zone | the app passes `model.timeZone` (`.autoupdatingCurrent`); the coordinator computes the day at each chance (Steps 3, 8) |
| review 7, round 7 R3 | the launch Focus read is bounded and a throw is not quiet | the trigger starts after the existing `readFocusFilter()` (3 s bound) (Step 8) |
| tester E1 | a re-entrant check while one opening is in flight crashed the app | a check while a show is in flight or on screen does nothing; the Today wait continues its chance instead of calling `check()`; no `UserDefaults.didChangeNotification` observer (Steps 3, 8) |
| round 7 S1, R4 | engagement and activation belong to an explicit click | only the click activates todz, after a 0.4 s pointer grace; a hover never does (Step 7) |

## Siblings

`feat/performance` Lane A edits `apps/macos/Todz/AppDelegate.swift`, `apps/macos/Todz/TodzApp.swift` and `apps/macos/TodzKit/Tests/TodzKitTests/AppModelHarness.swift`, stores `taskViews` (its step 36) and writes the cache in the background (its step 37). G1 never edits `AppModelHarness.swift`: `AppModelTests+MorningGlance` builds on the harness as it is. G2's `AppDelegate.swift` and `TodzApp.swift` edits collide; the lead tells G2 which hunks landed. Whichever branch merges second merges `origin/main` into itself (never a rebase) and keeps both sides. `AppModel+MorningGlance` reads only `taskViews.today.open` and `isTodayKnown(in:)`.

## File map

| Group | Paths owned | Developer sub-agent |
|-------|-------------|---------------------|
| G1 (TodzKit) | `apps/macos/TodzKit/Sources/TodzKit/{MorningGlancePreference,MorningGlanceContent,MorningGlanceDwell,MorningGlanceFront,MorningGlanceCoordinator}.swift` (new), `apps/macos/TodzKit/Sources/TodzKit/AppModel+MorningGlance.swift` (new), the `isDueAndIdle` lines of `apps/macos/TodzKit/Sources/TodzKit/DayCloseCoordinator.swift`, `apps/macos/TodzKit/Tests/TodzKitTests/{MorningGlancePreferenceTests,MorningGlanceDwellTests,MorningGlanceFrontTests,MorningGlanceCoordinatorTests,AppModelTests+MorningGlance}.swift` (new), one test in `apps/macos/TodzKit/Tests/TodzKitTests/DayCloseCoordinatorTests.swift`, the `## G1` section of `docs/features/morning-glance/tester-briefing.md` | `developer` (Opus) |
| G2 (App) | `apps/macos/Todz/MorningGlance/` (new: `MorningGlancePanel.swift`, `MorningGlanceView.swift`, `MorningGlancePresenter.swift`, `MorningGlanceTrigger.swift`), `apps/macos/Todz/Shared/Notification.Name+ScreenIsUnlocked.swift` (new), `apps/macos/Todz/Shared/ScreenLock.swift` (moved from `apps/macos/Todz/DayClose/ScreenLock.swift`), `apps/macos/Todz/DayClose/DayCloseScheduler.swift` (drops its private copy of the name), `apps/macos/Todz/AppDelegate.swift`, `apps/macos/Todz/TodzApp.swift`, `apps/macos/Todz/MenuBar/MenuBarPopover.swift`, `apps/macos/Todz/Settings/SettingsView.swift`, `apps/macos/Copy/MorningGlanceCopy.swift` (new), `apps/macos/Copy/SettingsCopy.swift`, `apps/macos/Copy/AccessibilityCopy.swift`, the `## G2` section of `docs/features/morning-glance/tester-briefing.md` | `developer` (Opus) |
| Lead | `apps/macos/README.md`, `docs/product/README.md`, `README.md` (walk), `docs/screenshots/morning-glance/`, the `tester-briefing.md` scaffold | lead |

## Sequencing

G1 first through Step 3: its red commits carry stubs for every public symbol, so the app compiles against the final interfaces. G2 starts in its own worktree after Step 3's red commit, merges G1's branch (never rebase), and merges it again after Step 4. The two groups never touch the same file. The lead's Step 11 waits for the tester's screenshots.

## Steps

### G1

- [ ] **Step 1:** Red, one commit with stubs that `fatalError("<name> is not implemented")`, as `test(morning-glance): … (red)`:
  - `MorningGlancePreferenceTests`: the registered default reads off with no day; registering never overwrites a stored choice; `markShown(day:in:)` reads back and stores `2026-11-25`; a stored day that is not a calendar date reads as never shown.
  - `MorningGlanceDwellTests`: shown at T → fades at T+5 s; a hover at T+3 → no fade while hovered; the leave at T+10 → fades at T+15; a second hover at T+12 and leave at T+20 → T+25; a hover from T+1 never left → fades at T+30 (the cap); a leave at T+28 → T+30, not T+33; `fadeDuration(reducesMotion: false)` 0.5 s, `(reducesMotion: true)` 0; `pointerGrace` 0.4 s.
  - `MorningGlanceFrontTests`: `isInFront` false when every input is false; true when each one alone is true (`isDayCloseDue`, `isClosingDay`, `isPopoverShown`); `isApplicationActive` alone false, `hasVisibleMainCapableWindow` alone false, both true → true.
  - `AppModelTests+MorningGlance`: `morningGlanceContent` nil before Today is known and while signed out; empty Today → count 0, no rows; one open → one row; five → five rows, rest 0; seven → the first five in Today's order, rest 2, count 7; an overdue task → `isOverdue`; a pending task is neither counted nor listed, matching `todayHeadingCount`; the active workspace's identifier is carried; a task due 2026-11-25 read at 23:59 and again at 2026-11-26 00:01 → not overdue, then overdue (two reads across midnight).
- [ ] **Step 2:** Green: `MorningGlancePreference` (`isOnStorageKey` `showsMorningGlance`, `lastShownDayStorageKey` `lastMorningGlanceDay`, `isOnByDefault` false, `registerDefaults(in:)`, `isOn(in:)`, `lastShownDay(in:)`, `markShown(day:in:)`); `MorningGlanceContent` (`workspaceIdentifier`, `openCount`, `rows`, `restCount`; `// NB ADR 0062` on the five-row constant); `MorningGlanceDwell` (`showDuration` 5 s, `longestShow` 30 s, `pointerGrace` 0.4 s, `fadeDuration(reducesMotion:)`, `fadeStart`, `hovered(at:)`, `left(at:)`); `MorningGlanceFront.isInFront(isDayCloseDue:isClosingDay:isPopoverShown:isApplicationActive:hasVisibleMainCapableWindow:)`; `AppModel.morningGlanceContent` reading only `taskViews.today.open` and `isTodayKnown(in:)`.
- [ ] **Step 3:** Red, one commit:
  - `DayCloseCoordinatorTests/isDueAndIdle…`: due and nothing in flight → true; within the click's wait → false; closed today → false; off → false. `DayCloseCoordinator.isDueAndIdle` stubbed.
  - `MorningGlanceCoordinatorTests`, a harness mirroring `DayCloseHarness`: a `FakeGlanceContent` that is `@Observable` and is driven by mutating it, a `FakeScreen` (`isLocked`, `isMirrored`), a `FakeFront`, a `FakeGlancePanel` counting attempts, showings and closings with `answers` and an optional `whileShowing`, `HarnessClock`, `emptyDefaults()`, the São Paulo zone. One test per row of `test-plan.md` → Unit → Coordinator.
  - `MorningGlanceCoordinator`'s public surface stubbed: `init(gate:defaults:timeZone:now:content:isScreenLocked:isScreenMirrored:isTodayInFront:showPanel:closePanel:)`, `isShowing`, `check()`, `retryLockedChance()`, `popoverShown()`, `closeNow()`, `dismissed()`.
- [ ] **Step 4:** Green:
  - `DayCloseCoordinator.isDueAndIdle` as a public computed property; `check()` reads it, behaviour unchanged.
  - `MorningGlanceCoordinator` (`@MainActor @Observable`, as `DayCloseCoordinator`). A chance is its day and its start. The order: off → shown that day → in flight or on screen → content (nil: observe it with `withObservationTracking`, and the change continues this chance, never `check()`; after `countWait` 60 s on the injected clock, the chance ends) → nothing open (mark) → in front (mark) → mirrored (end) → locked (a locked chance pending) → the gate (held: the held day becomes this chance's day) → show. The show: in flight; a `popoverShown()` or `closeNow()` meanwhile is remembered; a false answer clears in flight and on screen and ends; a true answer with the screen now locked closes and ends unmarked; otherwise mark the chance's day (`// NB ADR 0062` here), then close at once if the popover showed or `isTodayInFront()` turned true meanwhile, else observe the content while on screen and close when it turns nil or its workspace changes. `retryLockedChance()` runs a fresh chance only while a locked chance is pending. `observeReleases()` and `takeRelease()` as the day close's: a claimed release runs a fresh chance only when today is the held day. Closing from the coordinator clears on screen itself.
- [ ] **Step 5:** `swift test --package-path apps/macos/TodzKit` green with its count. The `## G1` section of `tester-briefing.md`: each red run's printed text (serial and parallel), the count.

### G2

- [ ] **Step 6:** Copy: `MorningGlanceCopy` (new), the `SettingsCopy` and `AccessibilityCopy` strings of `design.md` § 8.
- [ ] **Step 7:** The panel:
  - `MorningGlancePanel` per the assumptions.
  - `MorningGlanceView` per `design.md` § 1.1 and § 3 (`if #available(macOS 26.0, *)` glass, else `.regularMaterial`; one accessibility element with the label, value, hint, button trait and default action of § 5).
  - `MorningGlancePresenter.show(_:) async -> Bool`: `NSScreen.screens.first` or answer false; `ScreenLock.isLocked` or answer false; `NSApp.unhideWithoutActivation()` only when `NSApp.isHidden`; the frame at the visible frame's top right inset 12; `ignoresMouseEvents = true`; `orderFrontRegardless()`; answer true at once if the occlusion state is already visible, else wait for `NSWindow.didChangeOcclusionStateNotification` with it visible, at most 1 s; on false, `orderOut` and cancel the dwell.
  - On true: post the announcement; after `MorningGlanceDwell.pointerGrace`, `ignoresMouseEvents = false`; the dwell Task sleeps to `fadeStart` and is cancelled by a hover (an `NSTrackingArea` with `.activeAlways`, so it works while todz is inactive), restarted on leave, capped by `longestShow`; then the fade (`NSAnimationContext` over `fadeDuration(reducesMotion: NSWorkspace.shared.accessibilityDisplayShouldReduceMotion)`, `ignoresMouseEvents` during it), `orderOut` and `coordinator.dismissed()`.
  - The click: `orderOut`, `dismissed()`, `windowState.waitingLink = .today`.
  - `close()` (the coordinator's `closePanel`): cancels the dwell, `orderOut` without the fade.
- [ ] **Step 8:** The wiring:
  - `Notification.Name.screenIsUnlocked` moves to `Todz/Shared/Notification.Name+ScreenIsUnlocked.swift` (with `screenIsLocked` for `com.apple.screenIsLocked`) and `ScreenLock` moves to `Todz/Shared/ScreenLock.swift`; `DayCloseScheduler` uses the shared name.
  - `MorningGlanceTrigger.start()` checks once (the launch chance) and observes `NSWorkspace.didWakeNotification`, `screensDidWakeNotification`, `sessionDidBecomeActiveNotification` (on `NSWorkspace.shared.notificationCenter`) and `.screenIsUnlocked` (on `DistributedNotificationCenter.default()`) for `check()`; `didActivateApplicationNotification` for `retryLockedChance()`; `.screenIsLocked` and `NSWorkspace.willSleepNotification` for `closeNow()`. Never `UserDefaults.didChangeNotification`.
  - `AppDelegate`: a lazy `morningGlance` coordinator with `timeZone: model.timeZone`, `content: { model.morningGlanceContent }`, `isScreenLocked: { ScreenLock.isLocked }`, `isScreenMirrored` from `CGDisplayIsInMirrorSet` of the first screen's display identifier (a screen that cannot be read counts as mirrored, so nothing shows), `isTodayInFront` from `MorningGlanceFront.isInFront` with `dayClose.isDueAndIdle`, `dayClose.isClosingDay`, `panel.isShown`, `NSApp.isActive` and a visible window that can become main, `showPanel` and `closePanel` through the presenter. In the launch `Task`, after `readFocusFilter()`: `dayCloseScheduler.start()` first, then `morningGlanceTrigger.start()`, in that order (R5).
  - `TodzApp`: `MorningGlancePreference.registerDefaults(in: .standard)` and the coordinator into the popover's environment. `MenuBarPopover`: `onShow` also calls `morningGlance.popoverShown()`.
- [ ] **Step 9:** Settings: the switch of `design.md` § 1.2 after the Close the day row, `@AppStorage(MorningGlancePreference.isOnStorageKey)`.
- [ ] **Step 10:** `xcodegen generate` and a Debug `xcodebuild` print `BUILD SUCCEEDED` with no `warning:` or `error:` line; `swift test --package-path apps/macos/TodzKit` green with its count. The `## G2` section of `tester-briefing.md`: how to force a glance (delete `lastMorningGlanceDay` from the app container's defaults, quit, `open -g -j`), the two-showing budget, the folder backups the day-close testers took, and every "it works" as a hypothesis.

### Lead

- [ ] **Step 11:** The app README and the product design name the morning glance (purpose only); the README walk gains the glance from the tester's screenshot, within ADR 0047's budget.

## Failure modes

| Step | What breaks | How I notice (the concrete signal) | How I back out |
|------|-------------|------------------------------------|----------------|
| 7 | The panel does not appear after a hidden launch | the walk's `open -g -j` shows nothing and `lastMorningGlanceDay` stays absent | the spike's order (unhide without activation, then order front); the false answer keeps the day unmarked; strike the step with the reason if it never shows |
| 7 | The occlusion never turns visible within 1 s though the panel shows | the panel flashes and goes, `lastMorningGlanceDay` absent; the walk's window-list timing | raise the wait from the walk's measured timing and record it in ADR 0062's Evidence |
| 7 | The panel takes focus | the frontmost-app sampler changes, or the panel's window is key | `canBecomeKey` and `canBecomeMain` false, `.nonactivatingPanel`, no `makeKey` anywhere; a learning if a non-activating panel still activates |
| 7 | The hover never fires while todz is inactive | the panel fades under a resting pointer | the `.activeAlways` tracking area; else drop the hover (O3 B) and record it in `design.md` |
| 7 | A faded panel still catches clicks | a click at the top right does nothing after a glance | `ignoresMouseEvents` during the fade and `orderOut` at its end |
| 7 | The click does not open the window | todz stays inactive after the click | `MenuBarLabel` follows `waitingLink` already for widgets; if it does not run while inactive, the presenter activates todz before setting the link |
| 7 | `glassEffect` on macOS 14 or 15 | a build error or a crash at show | `if #available(macOS 26.0, *)` with the material |
| 8 | The unlock never reaches the sandboxed app | Human checklist: no glance after a morning unlock | the app switch retries a locked chance; a learning and an ADR 0062 revisit |
| 8 | The glance and the day close on one wake | both on screen | the start order, `isDueAndIdle` in the front rule, `popoverShown()` closes the panel |
| 8 | A glance long after its chance | a panel mid-work long after launch | the 60 s window continued by the observation (Step 3's late test) |
| 8 | A re-entrant check during the show | two panels or a crash | the in-flight guard (Step 3's re-entrant test); no defaults observer |
| 8 | A merge with `feat/performance` drops a hunk | the launch order or a model property missing after the merge | merge, never rebase; Step 10's build and test count after the merge |

**Steps with no backout:** none.

## Z. Prove and ship

- [ ] **Tester briefing:** G1 and G2 wrote their sections of `tester-briefing.md`.
- [ ] **Tester run:** a fresh `tester` sub-agent executed `test-plan.md` and ticked every box with evidence.
- [ ] **Reviewer:** a verdict; refutation recorded in `test-plan.md`.
- [ ] **Security reviewer:** a verdict.
- [ ] **/check-ui:** the Settings switch and the glance, from real builds (ADR 0026: Orca), from the tester's two showings.
- [ ] **/open-pr:** gates passed, learnings sweep stated, PR opened.

## Plan review answers (R1–R18)

The plan review of 2026-11-25 answered NO; the lead accepted every fix and picked R5 and R13. Each answer is folded into the spec, the design, ADR 0062, the steps above and the test plan.

| # | Finding | Answer | Where |
|---|---|---|---|
| R1 | CRITICAL: one `Task.yield()` then the occlusion state is unreliable | wait for `didChangeOcclusionStateNotification` with it visible, at most 1 s; on false `orderOut` and cancel the dwell; the coordinator clears on screen itself on a false answer; the timing is a walk box and an ADR Evidence line | ADR §7, Evidence; Steps 3, 4, 7; test plan Coordinator "Not seen", Showing 1 |
| R2 | an unbounded hover; nothing closes the panel on lock, sleep, sign-out, workspace switch | hover capped at 30 s from the appearance; `.screenIsLocked` and `willSleep` call `closeNow()`; the coordinator closes when the content turns nil or changes workspace; a test per trigger | ADR §8; spec; design § 1.1; Steps 1, 4, 8; test plan Dwell, Coordinator |
| R3 | the lock is read once, before the gate | the presenter re-reads `ScreenLock.isLocked` right before ordering front; the coordinator re-reads it after a true answer; a test where the screen locks inside `showPanel` | ADR §4; Steps 4, 7; test plan Coordinator |
| R4 | the popover opened during the glance's in-flight show | `popoverShown()` and "in front" during the show are remembered; the panel closes the moment `showPanel` answers; the day stays marked; a test | ADR §6; Step 4; test plan Coordinator |
| R5 | ordering against the day close (PICK: the day close wins) | public `DayCloseCoordinator.isDueAndIdle` with its test; `isTodayInFront` reads it; the glance trigger starts after `dayCloseScheduler.start()`; a test with the day close due | ADR §6; spec; Steps 3, 4, 8; test plan |
| R6 | stale-day cases | a held chance moves the held day forward; an unlock on the next day is a fresh chance; a release while locked waits for the unlock; a release with nothing open marks; boxes and red tests | ADR §4, §5; spec; Step 4; test plan Coordinator |
| R7 | a click aimed at the app beneath activates todz | `ignoresMouseEvents` for `MorningGlanceDwell.pointerGrace` (0.4 s) after showing; in the ADR; a pure test | ADR §7; design; Steps 1, 7; test plan Dwell |
| R8 | Reduce Motion lived in the presenter | `MorningGlanceDwell.fadeDuration(reducesMotion:)` red in Step 1; the presenter only passes the system value | design § 5; Steps 1, 2, 7; test plan Dwell |
| R9 | G2 has no red step | `MorningGlanceFront.isInFront(…)` and the mirroring input are pure `TodzKit` inputs red in G1; walk boxes read the panel's subrole, level, window list and that todz is never key; a coverage-honesty line | Assumptions; Steps 1, 3; test plan Showing 1, Showing 2, Coverage honesty |
| R10 | the walk budget | Showing 1: the screenshot, the fade and occlusion timing, a background frontmost-app sampler; Showing 2: the AX tree and a typed key with the pointer held, then the click, and the tester restores the frontmost app; a re-run after a fix spends a fresh two-showing budget | test plan Prove it for real |
| R11 | overlap with `feat/performance` Lane A | the Siblings section and merge order; `AppModel+MorningGlance` reads only `taskViews.today.open` and `isTodayKnown(in:)`; a test with two reads across midnight; the lead names the colliding files to G2 | spec Siblings; Siblings; Step 1; failure modes |
| R12 | the Today wait called public `check()` | the observation continues the original chance and its start; a late arrival at 61 s shows nothing; the test mutates the `@Observable` fake | Step 4; test plan Coordinator |
| R13 | screen sharing and mirroring (PICK: skip when mirrored) | the ADR states that sharing, recording and other Focus modes still show titles; a mirrored menu bar screen (`CGDisplayIsInMirrorSet`) skips the chance, unmarked, as a pure input tested in `TodzKit`; no `sharingType` change | ADR §9, Consequences; Steps 3, 8; test plan |
| R14 | the Settings height | the window grows by exactly one row with its two reserved detail lines; nothing clipped | design § 1.2; test plan Settings |
| R15 | one screen, the unhide, the dwell's life | `NSScreen.screens.first`; `unhideWithoutActivation()` only when `NSApp.isHidden`; the dwell Task cancelled on `close()` and on a false answer | ADR §7; design O1; Step 7 |
| R16 | the briefing scaffold | the lead scaffolded `## G1` and `## G2` in `tester-briefing.md` | `tester-briefing.md` |
| R17 | stale content on a wake | one ADR sentence accepts that a wake's glance may be minutes stale | ADR Consequences; spec failure handling |
| R18 | `ScreenLock` lives under `DayClose` | moved to `Todz/Shared/` with the `Notification.Name` file | File map; Step 8 |
