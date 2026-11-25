# Plan: Morning glance

**Spec:** spec.md
**Tier:** 🟡
**Seam:** a `MorningGlanceCoordinator` in `TodzKit` beside the `DayCloseCoordinator`, built on the shared `ProactiveGate`; in the app, a `MorningGlanceTrigger` owned by the `AppDelegate` that calls `check()` on each chance, and a `MorningGlancePresenter` that shows the app's first panel and answers whether it is on screen
**Assumptions (decided, owner can override):**
- `design.md`'s recommendations are the loop's calls; its copy is the copy.
- The spike's panel is the mechanism (ADR 0062 Evidence): an `NSPanel` subclass with `canBecomeKey` and `canBecomeMain` false, `[.borderless, .nonactivatingPanel]`, `.statusBar`, `[.canJoinAllSpaces, .fullScreenAuxiliary, .stationary]`, `hidesOnDeactivate = false`, `becomesKeyOnlyIfNeeded`, shown with `NSApp.unhideWithoutActivation()` then `orderFrontRegardless()`.
- The preference and `lastMorningGlanceDay` live in `UserDefaults.standard` with a registered default, as `DayClosePreference`; the day is a `CalendarDate` string.
- "Today" is the active workspace's Today as the menu bar count reads it (`todayHeadingCount`, ADR 0036); the rows are `taskViews.today.open` mapped with `WidgetSnapshotTask.of(_:day:)`, so pending tasks are neither counted nor listed, as in the count.
- The click reuses the widget's Today link: the presenter sets `windowState.waitingLink = .today`, and `MenuBarLabel`'s existing observer follows it and calls `openWindow.mainWindow()`, which activates todz.

## Lessons from the day close, folded in up front

| Day-close round | What it taught | Where it lives here |
|---|---|---|
| security finding 1, round 6 | a surface that shows itself must never take keystrokes meant for another app | the panel can never become key or main and has no keys (Step 7); a walk box checks the frontmost app and the focused element |
| review 3, round 6 A | mark the day only once the surface is seen | `showPanel` answers true only when the panel's occlusion state is visible on the next turn; the coordinator marks only then (Steps 3, 7) |
| round 7 R2, security-fixes | a mode left from an earlier day must not count as today's | the chance records its day; only that day is marked, and a release or a late Today on another day shows nothing (Step 3) |
| review 4 | a locked screen opens nothing | `isScreenLocked` before the gate; the unlock and the app switch retry (Steps 3, 8) |
| review 1 | the day follows the Mac's time zone | the app passes `model.timeZone` (`.autoupdatingCurrent`); the coordinator computes the day at each check (Steps 3, 8) |
| review 7, round 7 R3 | the launch Focus read is bounded and a throw is not quiet | the trigger starts after the existing `readFocusFilter()` (3 s bound) (Step 8) |
| tester E1 | a re-entrant check while one opening is in flight crashed the app | a check while a show is in flight or on screen does nothing; the trigger does not observe `UserDefaults.didChangeNotification` (Steps 3, 8) |
| round 7 S1, R4 | engagement and activation belong to an explicit click | only the click activates todz; a hover never does (Step 7) |

## File map

| Group | Paths owned | Developer sub-agent |
|-------|-------------|---------------------|
| G1 (TodzKit) | `apps/macos/TodzKit/Sources/TodzKit/{MorningGlancePreference,MorningGlanceContent,MorningGlanceDwell,MorningGlanceCoordinator}.swift` (new), `apps/macos/TodzKit/Sources/TodzKit/AppModel+MorningGlance.swift` (new), `apps/macos/TodzKit/Tests/TodzKitTests/{MorningGlancePreferenceTests,MorningGlanceDwellTests,MorningGlanceCoordinatorTests,AppModelTests+MorningGlance}.swift` (new), `docs/features/morning-glance/tester-briefing.md` (the G1 section) | `developer` (Opus) |
| G2 (App) | `apps/macos/Todz/MorningGlance/` (new: `MorningGlancePanel.swift`, `MorningGlanceView.swift`, `MorningGlancePresenter.swift`, `MorningGlanceTrigger.swift`), `apps/macos/Todz/Shared/Notification.Name+ScreenIsUnlocked.swift` (new), `apps/macos/Todz/DayClose/DayCloseScheduler.swift` (drops its private copy of the name), `apps/macos/Todz/AppDelegate.swift`, `apps/macos/Todz/TodzApp.swift`, `apps/macos/Todz/MenuBar/MenuBarPopover.swift`, `apps/macos/Todz/Settings/SettingsView.swift`, `apps/macos/Copy/MorningGlanceCopy.swift` (new), `apps/macos/Copy/SettingsCopy.swift`, `apps/macos/Copy/AccessibilityCopy.swift`, `docs/features/morning-glance/tester-briefing.md` (the G2 section) | `developer` (Opus) |
| Lead | `apps/macos/README.md`, `docs/product/README.md`, `README.md` (walk), `docs/screenshots/morning-glance/` | lead |

## Sequencing

G1 first through Step 3: its red commits carry stubs for every public symbol, so the app compiles against the final interfaces. G2 starts in its own worktree after Step 3's red commit, merges G1's branch (never rebase), and merges it again after Step 4. The two groups never touch the same file. The lead's Step 11 waits for the tester's screenshots.

## Steps

### G1

- [ ] **Step 1:** Red: `MorningGlancePreferenceTests` (the registered default reads off with no day; registering never overwrites a stored choice; `markShown(day:in:)` reads back and stores `2026-11-25`; a stored day that is not a calendar date reads as never shown), `MorningGlanceDwellTests` (shown at T → fades at T+5 s; a hover at T+3 → no fade while hovered; the leave at T+10 → fades at T+15; a second hover and leave restart again), `AppModelTests+MorningGlance` (`morningGlanceContent` is nil before Today is known and while signed out; empty Today → count 0, no rows; one open → one row; five → five rows, rest 0; seven → the first five in Today's order, rest 2, count 7; an overdue task → `isOverdue`; a pending task is neither counted nor listed, matching `todayHeadingCount`). Commit alone, with stubs that `fatalError("<name> is not implemented")`, as `test(morning-glance): … (red)`.
- [ ] **Step 2:** Green: `MorningGlancePreference` (`isOnStorageKey` `showsMorningGlance`, `lastShownDayStorageKey` `lastMorningGlanceDay`, `isOnByDefault` false, `registerDefaults(in:)`, `isOn(in:)`, `lastShownDay(in:)`, `markShown(day:in:)`), `MorningGlanceContent` (`openCount`, `rows`, `restCount`; `// NB ADR 0062` on the five-row constant), `MorningGlanceDwell` (`showDuration` 5 s, `fadeDuration` 0.5 s, `fadeStart`, `hovered(at:)`, `left(at:)`), `AppModel.morningGlanceContent`.
- [ ] **Step 3:** Red: `MorningGlanceCoordinatorTests`, a harness mirroring `DayCloseHarness` (a `FakeGlanceContent` that is `@Observable`, a `FakeScreen`, a `FakeGlancePanel` counting showings and closings with `isSeen` and an optional `whileShowing`, `HarnessClock`, `emptyDefaults()`, the São Paulo zone), each test named for its row: off → no showing; a first chance with 3 open → one showing, `lastMorningGlanceDay` today; a second chance the same day → still one; the next day → two; 0 open → no showing, the day marked; Today unknown, then 2 open 30 s later → one showing; Today unknown, then known 61 s later → no showing, nothing marked; signed out (nil throughout) → nothing marked; locked → no showing, nothing marked, then unlocked and `check()` → one showing; locked, then `retryLockedChance()` after the unlock → one showing, and `retryLockedChance()` with no locked chance → nothing; quiet from the launch read → held, no showing; released the same day → one showing; released the next day → no showing and `.morningGlance` no longer in `gate.released`; Today in front → no showing, the day marked; a show that is not seen → nothing marked, the next chance → a second showing; a `check()` from inside `showPanel` (re-entrant) → one showing; `popoverShown()` while shown → one closing, the day still marked; `popoverShown()` with nothing shown → no closing; `dismissed()` then a chance the same day → nothing; the clock passes midnight inside `showPanel` → the chance's day is marked, and a chance on the new day shows again; an instant that is 2026-11-26 in Asia/Tokyo and 2026-11-25 in America/Sao_Paulo with `lastMorningGlanceDay` 2026-11-25 → the Tokyo harness shows, the São Paulo one does not; the content handed to `showPanel` is the content at the show (7 open → 5 rows, rest 2). Commit alone with `MorningGlanceCoordinator`'s public surface stubbed (`init(gate:defaults:timeZone:now:content:isScreenLocked:isTodayInFront:showPanel:closePanel:)`, `isShowing`, `check()`, `retryLockedChance()`, `popoverShown()`, `dismissed()`).
- [ ] **Step 4:** Green: `MorningGlanceCoordinator` (`@MainActor @Observable`, as `DayCloseCoordinator`): `countWait` 60 s measured on the injected clock from the chance; the chance's day; the order off → shown today → in flight → content (wait) → nothing open → in front → locked → gate → show; `// NB ADR 0062` on the method that marks only once seen; `observeReleases()` and `takeRelease()` as the day close's, dropping a release whose day is not today.
- [ ] **Step 5:** `swift test --package-path apps/macos/TodzKit` green with its count. The G1 section of `tester-briefing.md`: each red run's printed text, the count.

### G2

- [ ] **Step 6:** Copy: `MorningGlanceCopy` (new), the `SettingsCopy` and `AccessibilityCopy` strings of `design.md` § 8.
- [ ] **Step 7:** The panel: `MorningGlancePanel` per the assumptions; `MorningGlanceView` per `design.md` § 1.1 and § 3 (`if #available(macOS 26.0, *)` glass, else `.regularMaterial`; one accessibility element with the label, value, hint, button trait and default action of § 5); `MorningGlancePresenter.show(_:) async -> Bool`: `NSScreen.main` or answer false, `NSApp.unhideWithoutActivation()`, frame at the visible frame's top right inset 12, `orderFrontRegardless()`, `await Task.yield()`, answer `occlusionState.contains(.visible)`; on a true answer post the announcement and run the dwell (`MorningGlanceDwell`, a cancellable `Task.sleep` to `fadeStart`, the hover from an `NSTrackingArea` with `.activeAlways` so it works while todz is inactive), then the fade (`NSAnimationContext`, `ignoresMouseEvents` during it) or none with Reduce Motion, then `orderOut` and `coordinator.dismissed()`; the click: `orderOut`, `dismissed()`, `windowState.waitingLink = .today`; `close()` for the coordinator's `closePanel`.
- [ ] **Step 8:** The wiring: `Notification.Name.screenIsUnlocked` moves to `Todz/Shared/Notification.Name+ScreenIsUnlocked.swift` and `DayCloseScheduler` uses it; `MorningGlanceTrigger.start()` checks once (the launch chance) and observes `NSWorkspace.didWakeNotification`, `screensDidWakeNotification`, `sessionDidBecomeActiveNotification` (on `NSWorkspace.shared.notificationCenter`) and `.screenIsUnlocked` (on `DistributedNotificationCenter.default()`) for `check()`, and `didActivateApplicationNotification` for `retryLockedChance()`; never `UserDefaults.didChangeNotification`. `AppDelegate`: a lazy `morningGlance` coordinator with `timeZone: model.timeZone`, `content: { model.morningGlanceContent }`, `isScreenLocked: { ScreenLock.isLocked }`, `isTodayInFront` true when `panel.isShown`, `dayClose.isClosingDay`, or `NSApp.isActive` with a visible window that can become main, `showPanel` and `closePanel` through the presenter; the trigger starts in the launch `Task` after `readFocusFilter()`, beside `dayCloseScheduler.start()`. `TodzApp`: `MorningGlancePreference.registerDefaults(in: .standard)` and the coordinator into the popover's environment. `MenuBarPopover`: `onShow` also calls `morningGlance.popoverShown()`.
- [ ] **Step 9:** Settings: the switch of `design.md` § 1.2 after the Close the day row, `@AppStorage(MorningGlancePreference.isOnStorageKey)`.
- [ ] **Step 10:** `xcodegen generate` and a Debug `xcodebuild` print `BUILD SUCCEEDED` with no `warning:` or `error:` line; `swift test --package-path apps/macos/TodzKit` green with its count. The G2 section of `tester-briefing.md`: how to force a glance (delete `lastMorningGlanceDay` from the app container's defaults, quit, `open -g -j`), the two-showing budget, the folder backups the day-close testers took, and every "it works" as a hypothesis.

### Lead

- [ ] **Step 11:** The app README and the product design name the morning glance (purpose only); the README walk gains the glance from the tester's screenshot, within ADR 0047's budget.

## Failure modes

| Step | What breaks | How I notice (the concrete signal) | How I back out |
|------|-------------|------------------------------------|----------------|
| 7 | The panel does not appear after a hidden launch | the walk's `open -g -j` shows nothing and `lastMorningGlanceDay` stays absent | the spike's order (unhide without activation, then order front); the visibility answer keeps the day unmarked, so nothing is lost; strike the step with the reason if it never shows |
| 7 | The panel takes focus | the frontmost app before differs from the one after, or Orca reports a todz element focused | `canBecomeKey` and `canBecomeMain` false, `.nonactivatingPanel`, no `makeKey` anywhere; a learning if a non-activating panel still activates |
| 7 | The hover never fires while todz is inactive | the panel fades under a resting pointer | the `.activeAlways` tracking area named in Step 7; else drop the hover (O3 B) and record it in `design.md` |
| 7 | A faded panel still catches clicks | a click at the top right does nothing after a glance | `ignoresMouseEvents` during the fade and `orderOut` at its end |
| 7 | The click does not open the window | todz stays inactive after the click | `MenuBarLabel` follows `waitingLink` already for widgets; if it does not run while inactive, the presenter activates todz before setting the link |
| 7 | `glassEffect` on macOS 14 or 15 | a build error or a crash at show | `if #available(macOS 26.0, *)` with the material |
| 8 | The unlock never reaches the sandboxed app | Human checklist: no glance after a morning unlock | the app switch retries a locked chance; a learning and an ADR 0062 revisit |
| 8 | The glance and the day close on one wake | both on screen | `isTodayInFront` reads `dayClose.isClosingDay`; `popoverShown()` closes the panel |
| 8 | A glance hours after its chance | a panel mid-work long after launch | the 60 s window (Step 3's tests) |
| 8 | A re-entrant check during the show | two panels or a crash | the in-flight guard (Step 3's re-entrant test); no defaults observer |

**Steps with no backout:** none.

## Z. Prove and ship

- [ ] **Tester briefing:** G1 and G2 wrote `tester-briefing.md`.
- [ ] **Tester run:** a fresh `tester` sub-agent executed `test-plan.md` and ticked every box with evidence.
- [ ] **Reviewer:** a verdict; refutation recorded in `test-plan.md`.
- [ ] **Security reviewer:** a verdict.
- [ ] **/check-ui:** the Settings switch and the glance, from real builds (ADR 0026: Orca), from the tester's two showings.
- [ ] **/open-pr:** gates passed, learnings sweep stated, PR opened.
