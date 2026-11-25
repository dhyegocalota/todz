# Tester briefing: Day close

Written by the developer sub-agent (lane G1) when its steps were done. The developer does not run `test-plan.md` and does not declare the feature works. The app was built, never launched: every behaviour below is a hypothesis.

## What changed

- `apps/macos/TodzKit/Sources/TodzKit/DayCloseSchedule.swift`, `DayCloseDecision.swift` — the pure decision (`.off`, `.notYet(next:)`, `.due`, `.doneToday(next:)`) from the instant, the minutes after midnight, the last closed day, the switch and the time zone; the time of day to and from an instant.
- `DayClosePreference.swift` — the defaults keys `closesTheDay` (Bool, off), `dayCloseMinutes` (Int, 1080 = 18:00) and `lastClosedDay` (a `YYYY-MM-DD` string), registered like `MenuBarBadge`.
- `DayCloseCoordinator.swift` — decides, reads the count (nil waits and re-decides when it changes, 0 marks the day, more asks the gate), opens through an injected opener, writes `lastClosedDay` only when the opener returns true, holds the mode (`isClosingDay`), claims `.dayClose` releases from the gate and decides again.
- `LingerOutcome.swift`, `CompletionLingers.swift` — a linger records `done`, `dueTomorrow` or `noDueDate` and finds its task among the project's open tasks and the done tasks, so Tomorrow and No date rows stay in place for 1 s.
- `AppModel+DayClose.swift` — the mode's list (Today's open tasks plus lingering rows, no Done today) and "Day closed" (Today known, nothing open, nothing lingering, nothing pending).
- `apps/macos/Todz/DayClose/DayCloseScheduler.swift` — a timer to the next decision; re-checks on wake, `NSSystemTimeZoneDidChange`, `NSSystemClockDidChange`, `.NSCalendarDayChanged` and `UserDefaults.didChangeNotification`.
- `apps/macos/Todz/AppDelegate.swift`, `TodzApp.swift` — `MenuBarPanel` and the coordinator live on the delegate and reach the popover's environment; the scheduler starts after the launch read of the Focus filter; the preference defaults are registered at launch.
- `apps/macos/Todz/MenuBar/MenuBarPanel.swift` — `open()`: returns true without clicking when the popover window is visible; otherwise finds the status button (false when absent), `NSApp.unhideWithoutActivation()`, `performClick`.
- `MenuBarPanelReader.swift` — `onHide` on the popover window's occlusion change when the window is no longer visible; it ends the mode.
- `MenuBarPopover.swift`, `MenuBarToday.swift`, `MenuBarTodayHeading.swift`, `MenuBarTodayBody.swift`, `MenuBarRow.swift`, `MenuBarDayCloseActions.swift` (new) — the mode: heading `Close the day` with `N left`, the add field collapsed (its draft kept) and ⌘N off, an action line under each open row, D / T / N on a focused row, Escape closes, the "Day closed" state that closes the popover after 2 s, the mode ends on a workspace change.
- `apps/macos/Todz/MainWindowState.swift` — `closeDay(task:outcome:model:)` dispatches Done to the existing toggle, Tomorrow to `updateDueDate(today + 1)`, No date to `updateDueDate(nil)`, each with its linger.
- `apps/macos/Todz/Settings/SettingsView.swift` — a fourth row: title, detail, a stepper-field time picker (disabled when off) and the switch.
- `apps/macos/Copy/MenuBarCopy.swift`, `AccessibilityCopy.swift`, `SettingsCopy.swift` — the strings of `design.md` § 8, plus `MenuBarCopy.result(of:)` and `AccessibilityCopy.announcement(of:)`.

## How to run

```bash
swift test --package-path apps/macos/TodzKit
cd apps/macos && xcodegen generate
xcodebuild build -project Todz.xcodeproj -scheme Todz -configuration Debug -derivedDataPath build
open -g -j build/Build/Products/Debug/Todz.app
```

Forcing a day close one minute ahead without waiting. The Debug app is sandboxed, so its defaults live in its container; write them with the app quit:

```bash
PREFS=~/Library/Containers/dev.todz.Todz.debug/Data/Library/Preferences/dev.todz.Todz.debug
defaults delete "$PREFS" lastClosedDay
defaults write "$PREFS" closesTheDay -bool true
defaults write "$PREFS" dayCloseMinutes -int 877
```

`877` is 14:37 (hours × 60 + minutes); write the minute after the current one, then launch with `open -g -j`. The launch check finds `.notYet` and arms a timer to that minute.

From Settings instead: set the time one minute ahead **before** turning the switch on. Turning it on after today's time with open tasks opens the popover at once (the spec's "first chance after the time"), which spends one of the walk's two openings.

To run a second forced day close the same day, quit, delete `lastClosedDay` as above and relaunch.

The popover lands on the owner's screen: two openings at most in the whole walk (`test-plan.md`), counting any opening a forced day close triggers.

## Red today, green after

Each red test was run alone with `swift test --filter <name>`; a stub's `fatalError` stops the process, so the first stub hit is the printed text.

| Test | Red commit | Printed when red | Green at |
|------|-----------|------------------|----------|
| `DayCloseScheduleTests` | `4b1f8a8` | `TodzKit/DayCloseSchedule.swift:11: Fatal error: DayCloseSchedule.decision is not implemented` | `55f1ce5` |
| `DayClosePreferenceTests` | `4b1f8a8` | `TodzKit/DayClosePreference.swift:12: Fatal error: DayClosePreference.registerDefaults is not implemented` (and `:28 … markClosed is not implemented` for `aClosedDayReadsBack`) | `55f1ce5` |
| `AppModelTests+DayClose`: `doneInTheDayClose…`, `tomorrowInTheDayClose…`, `dropInTheDayClose…` | `6fa03d0` | **pin**: green when they landed (the existing `complete` and `updateDueDate`, R14) | `6fa03d0` |
| `DayCloseCoordinatorTests` | `c39ec33` | `TodzKit/DayCloseCoordinator.swift:33: Fatal error: DayCloseCoordinator.check is not implemented` | `1166857` |
| `CompletionLingersTests/aCheckedTaskLingersAsDone` | `c39ec33` | `TodzKit/CompletionLingers.swift:46: Fatal error: CompletionLingers.outcome is not implemented` | `1166857` |
| `CompletionLingersTests/aTaskMovedOutOfTodayStaysAtItsPlaceWithItsOutcome`, `anEndedMoveLetsTheTaskLeaveToday`, `aMovedTaskCompletedElsewhereLeavesToday` | `c39ec33` | `TodzKit/CompletionLingers.swift:42: Fatal error: CompletionLingers.starting is not implemented` | `1166857` |
| `AppModelTests+DayClose`: `theDayCloseListShowsTodaysOpenTasksWithoutDoneToday`, `theDayIsNotClosedBeforeTodayIsKnown` | `c39ec33` | `TodzKit/AppModel+DayClose.swift:3: Fatal error: AppModel.dayCloseTasks is not implemented` | `1166857` |
| `AppModelTests+DayClose/aTaskMovedToTomorrowStaysInTheDayCloseListWhileItLingers` | `c39ec33` | `TodzKit/CompletionLingers.swift:42: Fatal error: CompletionLingers.starting is not implemented` | `1166857` |
| `AppModelTests+DayClose/theDayIsClosedWhenNothingIsLeftAndNothingLingers` | `c39ec33` | `TodzKit/AppModel+DayClose.swift:7: Fatal error: AppModel.isDayClosed is not implemented` | `1166857` |

At `3ef8dbe`: `swift test --package-path apps/macos/TodzKit` → `Test run with 726 tests in 51 suites passed`; `xcodegen generate` and the Debug `xcodebuild` → `BUILD SUCCEEDED`, no warnings.

## Hypotheses to attack

1. Hypothesis: at the forced minute the popover opens by itself under the status item, in the mode, with nothing focused and no add field. Break it by: the hidden launch (`open -g -j`), another app frontmost, the main window open on another Space.
2. Hypothesis: `performClick` opens the popover on its first ever opening (the popover window does not exist yet). Break it by: forcing the day close as the first thing after a launch, before any click on the status item.
3. Hypothesis: the mode ends when the popover closes by an outside click, Escape, the 2 s "Day closed" close or a click on the status item, because the window's occlusion changes and `isVisible` is false. Break it by: closing each way, then clicking the status item: the usual Today with the add field and no action line is expected. A screen lock while the popover shows should not end the mode.
4. Hypothesis: if the popover is already open at the time, the mode starts in place without a click, the add field collapses and its typed draft returns when the popover closes and reopens. Break it by: typing a draft, waiting for the minute, then closing and reopening.
5. Hypothesis: Done, Tomorrow and No date each show their result (`Done` row checked, `Due tomorrow`, `No due date`) for 1 s, then the row leaves and the heading count drops at once. Break it by: acting on two rows inside one second; acting offline.
6. Hypothesis: D, T and N act only on a focused row with no modifier; ⌘N does nothing in the mode; ⌘1–9 switches workspace and ends the mode. Break it by: Shift-D, Caps Lock on, ⌘N, ⌘2.
7. Hypothesis: the last row leaving shows `Day closed` / `Nothing left for today.` and the popover closes about 2 s later. Break it by: a pending (unsent) add due today, which keeps the list open.
8. Hypothesis: nothing opens a second time the same day: relaunch, wake, change of time to later, toggling the switch. Break it by: each of those after the first opening.
9. Hypothesis: with Today empty at the time, nothing opens and `lastClosedDay` is written (`defaults read "$PREFS" lastClosedDay`).
10. Hypothesis: the Settings row keeps the window height when the switch flips, the picker is dimmed while off and shows the Mac's 12 or 24 hour format.

## Known gaps

- `open()` reports success when it clicked; it does not confirm the popover appeared. A click that opens nothing marks the day closed (the spec's "the open fails" row is covered only for a missing status button).
- The mode's end relies on `NSWindow.didChangeOcclusionStateNotification` firing when the `MenuBarExtra` window orders out; unverified without a launch.
- The rotor carries Tomorrow and No date as named actions; Done stays as the row's existing `Mark as Done` action rather than a third, duplicate one.
- The Done button's accessibility label is `Mark <title> as done` (`design.md` § 5); the test plan's tree box reads `Done` for it.
- `UserDefaults.didChangeNotification` is not posted for `defaults write` from Terminal while the app runs; write the defaults with the app quit.
- A held day close released by a real Focus is proven by `DayCloseCoordinatorTests` only (coverage honesty in `test-plan.md`).
- `EmptyDefaults.swift` (tests) repeats `MenuBarBadgeDefaultsTests`' private helper under another name; that file is outside G1's paths. `DayCloseSchedule.swift` repeats `CalendarDate.swift`'s private Gregorian-calendar helper for the same reason.
- READMEs and screenshots are the lead's (Step 6).

## Fix round 1

The security review's two findings, red first. The app was built, never launched.

### What changed

- Finding 1 (IMPORTANT, keystrokes meant for another app): `DayCloseCoordinator` gains `isEngaged` (false each time the coordinator starts the mode, including in place while the popover shows), `engage()` and `acceptsKeyActions` (true outside the mode, and in the mode only once engaged). `MenuBarRow` refuses D / T / N and Return / Space while `acceptsKeyActions` is false, and engages on pointer hover. `MenuBarToday` engages on a click anywhere in it (a simultaneous tap gesture) and on Tab or Shift-Tab. `MenuBarPopover` sets its `@FocusState` to nil when the mode starts. The Done, Tomorrow and No date buttons and the rotor actions are not gated: they take a click, a hover first, or VoiceOver.
- Finding 2 (MINOR, crafted defaults): `DayClosePreference.minutesAfterMidnight(in:)` returns nil outside `0..<1440`, and the coordinator decides `.off` on nil. `DayCloseScheduler` never sleeps less than `shortestCheckDelay` (1 s).

### Red today, green after

Each red test run alone with `swift test --filter`.

| Test | Red commit | Printed when red | Green at |
|------|-----------|------------------|----------|
| `DayCloseCoordinatorTests/aModeStartedByTheCoordinatorIsNotEngagedAndRefusesKeyActions` | `09ca7b4` | `TodzKit/DayCloseCoordinator.swift:45: Fatal error: DayCloseCoordinator.isEngaged is not implemented` | `676e309` |
| `DayCloseCoordinatorTests/engagingTheModeAcceptsKeyActions`, `aNewModeIsNotEngagedAgain`, `aModeStartingInPlaceAfterTheOwnerEngagedIsNotEngaged` | `09ca7b4` | `TodzKit/DayCloseCoordinator.swift:53: Fatal error: DayCloseCoordinator.engage is not implemented` | `676e309` |
| `DayCloseCoordinatorTests/theUsualPopoverAcceptsKeyActions` | `09ca7b4` | `TodzKit/DayCloseCoordinator.swift:49: Fatal error: DayCloseCoordinator.acceptsKeyActions is not implemented` | `676e309` |
| `DayClosePreferenceTests/aStoredTimeOutsideADayReadsAsOff` (-2880, 1440, Int.max) | `705e101` | `Expectation failed: DayClosePreference.minutesAfterMidnight(in: defaults) == nil`, once per argument (3 issues) | `51aa146` |
| `DayCloseCoordinatorTests/aStoredTimeOutsideADayIsOffAndOpensNothing` (-2880, 1440) | `705e101` | `Expectation failed: harness.coordinator.check() == .off` for both arguments, plus `harness.popover.openings == 0` and `harness.lastClosedDay == nil` for -2880 (4 issues) | `51aa146` |
| `DayClosePreferenceTests/aStoredTimeInsideADayReadsAsSet` (0, 1439) | `705e101` | **pin**: green when it landed | `705e101` |

At `51aa146`: `swift test --package-path apps/macos/TodzKit` → `Test run with 734 tests in 51 suites passed`; `xcodegen generate` and the Debug `xcodebuild` → `BUILD SUCCEEDED`, no warnings.

### Hypotheses to attack

11. Hypothesis: when the day close opens by itself, no row and no field shows a focus ring, and D, T, N, Return and Space typed before touching the popover change nothing and open no window. Break it by: clicking a row in the usual popover so it holds focus, closing it, then forcing a day close and typing `d` at once.
12. Hypothesis: hovering any row, clicking anywhere in the popover, or pressing Tab enables D / T / N on the focused row for the rest of that opening. Break it by: a first Tab when nothing is focused (the Tab that moves focus onto a row may not reach the handler; the second one does), Shift-Tab, a click on the heading.
13. Hypothesis: the next day close starts unengaged again even if the owner had hovered the popover before it started in place.
14. Hypothesis: with `dayCloseMinutes` written as -2880, 1440 or a huge number (app quit), the app launches, nothing opens, and the CPU stays idle (no re-check loop).

### Known gaps

- ~~Settings still converts the stored minutes straight to the picker's date~~ closed by the lead at 37b3e97 (red: `DayClosePreference.pickerMinutes is not implemented`) / 8392f4e: the picker shows 18:00 for a stored time outside a day.
- With Full Keyboard Access, a stale focus on a Done, Tomorrow or No date button would still take Space before engagement; the buttons are not gated so VoiceOver keeps working.
- Hover engagement fires if the popover appears under a resting pointer.

## Fix round 2 (the lead, after the first tester run)

- Tester E1 (crash on the first opening after launch): `DayCloseCoordinator.check()` now does nothing while a day close is opening or open (`isClosingDay`). Red at df293f0: `aCheckWhileTheDayCloseIsOpeningOpensNothingMore` and `aCheckWhileTheDayCloseIsOpenOpensNothingMore` re-enter until the test process dies (the run reports `TodzKitTests (Swift Testing)` failed, both tests started, none finished). Green at the next commit: 738 tests pass.
- Tester E2 (the first row focused on opening): fix round 1 clears the focus and gates D/T/N on engagement (676e309); re-walk it.
- Hypotheses for the re-walk: a hidden launch (`open -g -j`) with the time a minute ahead opens the popover once and does not crash; the first row has no focus; D before any click, hover or Tab does nothing; Escape closes the popover.
- Still without a test or a walk: Many (12 rows) and Offline at the time; add a model test for each before the re-walk.

## Fix round 3: Many and Offline

Both are pins: green when they landed, no product code changed. At `4451a51`, `swift test --package-path apps/macos/TodzKit` gives `Test run with 740 tests in 51 suites passed`.

| Test | Proves |
|------|--------|
| `AppModelTests/twelveOpenTasksFillTheDayCloseListInOrderAndTheHeadingReadsTwelve` | 12 open Today tasks: `dayCloseTasks` holds all 12 in order, `todayHeadingCount` (the `N left` the heading shows) is 12, the day is not closed |
| `DayCloseCoordinatorTests/dueWhileOfflineOpensOnTheCachedRowsAndAnActionIsQueuedAndShown` | Launched from the cache with the server unreachable: the count reads the 2 cached rows and the coordinator opens; Done is queued in the outbox (`waitingChangeCount == 1`), the heading drops to 1, and the row lingers until its linger ends |

The list scrolling inside the 360-wide popover is a view concern: the existing popover list ScrollView covers it, so it stays a walk item, not a unit.

## Fix round 4: engagement only by a click; a mode that never showed does not block later days

Security re-check findings, fixed red-first.

- Engagement: `DayCloseCoordinator.engage(by:)` takes a `DayCloseEngagementInput` (`click`, `tab`, `hover`) and only `.click` sets `isEngaged`. The Tab handler in `MenuBarToday` and the hover engagement in `MenuBarRow` are gone; the tap gesture on the popover is the only caller (`.click`). The Done, Tomorrow and No date buttons are `.focusable(dayClose.isEngaged)`, so Full Keyboard Access cannot land on them or press them with Space before a click; a mouse click on them still works.
- Blocking mode: `check()` is guarded by a private `isOpening` flag held only around the synchronous `openPopover()` call, not by `isClosingDay`. A re-entrant check during the open (E1) still opens nothing more; a mode left on by an opener that returned true but never showed no longer stops the next day's due check, which opens again and resets the engagement. `aCheckWhileTheDayCloseIsOpeningOpensNothingMore` and `aCheckWhileTheDayCloseIsOpenOpensNothingMore` are unchanged and green: the second one's same-day rule holds because the day is marked.

| Test | Red commit | Printed failure | Green commit |
|------|------------|-----------------|--------------|
| `DayCloseCoordinatorTests/onlyAClickEngagesTheMode` (`.tab`, `.hover`) | `5510143` | `Expectation failed: !harness.coordinator.isEngaged` and `Expectation failed: !harness.coordinator.acceptsKeyActions`, once per argument (4 issues) | `1b845b0` |
| `DayCloseCoordinatorTests/aModeLeftOnByAnOpenerThatNeverShowedDoesNotBlockTheNextDay` | `5510143` | `Expectation failed: harness.popover.openings == 2`, `Expectation failed: harness.lastClosedDay == tomorrow`, `Expectation failed: !harness.coordinator.isEngaged` (3 issues) | `1b845b0` |

At `5510143` the run printed `Test run with 742 tests in 51 suites failed after 0.140 seconds with 7 issues`. At `1b845b0`: `swift test --package-path apps/macos/TodzKit` gives `Test run with 742 tests in 51 suites passed`; `xcodegen generate` and the Debug `xcodebuild` give `BUILD SUCCEEDED`, no warnings.

### Walk rows to re-walk

Opening 1; hidden launch (`open -g -j`); keys in the mode, including Tab twice then D does nothing, hover then D does nothing, a click then D acts; E2 (no focused row on opening).

### Hypotheses to attack

15. Hypothesis: with Full Keyboard Access on and no click yet, Tab skips the Done, Tomorrow and No date buttons and Space on a focused row does nothing; after one click they take focus and work.
16. Hypothesis: a click on a Done, Tomorrow or No date button before any other click acts at once and also engages the mode.
17. Hypothesis: if the popover never shows (full screen, Stage Manager) the next day's due check still opens the day close.

### Known gaps

- The `.tab` and `.hover` cases exist so the rule is testable; no view reports them any more.
- Whether `.focusable(false)` removes a borderless Button from the Full Keyboard Access loop is a walk item, not a unit.
- Hypothesis 16 is not certain: a click on a button may act through the button without the popover tap gesture firing; if so, `engage(by: .click)` is not reached by that click and the row stays unengaged.

## Fix round 5: the reviewer's findings

At `3af98d9` (code) and `93137ec` (docs), `swift test --package-path apps/macos/TodzKit` gives `Test run with 743 tests in 51 suites passed` (742 before, plus the never-showed pin and the locked-screen test, minus the deleted `onlyAClickEngagesTheMode`); `xcodegen generate` and the Debug `xcodebuild` give `BUILD SUCCEEDED`, no warnings.

| Finding | What changed | Red commit and printed text | Green commit |
|---------|--------------|-----------------------------|--------------|
| 1. time zone captured at launch | `AppDelegate` builds the model with `TimeZone.autoupdatingCurrent`; the coordinator reads `model.timeZone`, so `.NSSystemTimeZoneDidChange` re-checks compute the new instant. No unit seam: the zone is already injected and tests already pass fixed zones; the argument itself is a walk item | none (no seam) | `3af98d9` |
| 2. keyboard contract | `design.md` § 1.1 and § 5 and the Keys row of `test-plan.md` say: a day close the app opens by itself acts only after a click inside the popover; Escape always closes | none (docs) | `93137ec` |
| 3. opener true without a window | `MenuBarPanel.open()` is async: click, `Task.yield()`, answers `window?.isVisible == true`; the coordinator's `check()` and opener are async, `isOpening` is held across the await, a false answer calls `end()` and marks nothing. `DayCloseScheduler` runs the check in a task and skips rescheduling when cancelled | no honest red: the coordinator already handled a false answer and the visibility read lives in the app target (no test target). Pin `be65d67` (`anOpenerThatClicksButShowsNothingMarksNothingEndsTheModeAndALaterCheckOpens`, green when it landed) plus the existing re-entrancy tests, now across an await | `be65d67` (async plumbing), `1d9b6d7` (visibility confirmed) |
| 4. screen locked | the coordinator takes `isScreenLocked` and returns before the gate and before marking while locked; `ScreenLock.isLocked` (app target) reads `CGSSessionScreenIsLocked`; the scheduler also re-checks on the distributed `com.apple.screenIsUnlocked` (name in a private `Notification.Name` constant) | `f0b57b3` `aLockedScreenOpensNothingMarksNothingAndTheNextCheckAfterTheUnlockOpens`: `Expectation failed: await harness.coordinator.check() == .due`, `harness.popover.openings == 0`, `!harness.coordinator.isClosingDay`, `harness.lastClosedDay == nil` (4 issues; `Test run with 744 tests in 51 suites failed after 0.158 seconds with 4 issues`) | `9a04738` |
| 5. dead engagement inputs | `DayCloseEngagementInput` deleted, `engage()` takes nothing and the popover click is its only caller; `onlyAClickEngagesTheMode` deleted, `aModeStartedByTheCoordinatorIsNotEngagedAndRefusesKeyActions` and `engagingTheModeAcceptsKeyActions` assert the behaviour that exists | none (removal) | `9c31b5e` |
| 6. conventions | `MenuBarRow` names `isActionable`; `MenuBarDayCloseActions` row extracted so no `if` nests; `DayCloseSchedule.minutesPerHour` and `hoursPerDay` are the one constant `DayClosePreference` reads (`defaultHour` replaces `18 * 60`) | none (refactor, suite green) | `5906acc` |
| 7. unbounded focus read | `readFocusFilter` races the read against `focusFilterReadTimeoutMilliseconds` (3000) through an `AsyncStream`; the first answer wins and a timeout leaves the gate on its launch default; `dayCloseScheduler.start()` runs either way | none (app target, no seam) | `3af98d9` |

### Walk rows to re-walk

Opening 1, including a click before D; the hidden launch (`open -g -j`); Keys in the mode, including Tab twice then D does nothing before a click; E2; leaving the mode by an outside click and by Escape, then reopening the popover shows the add field; a time-zone change in System Settings while running re-decides in the new zone.

### Human checklist (not walked)

- [ ] A day close due while the screen is locked opens after the unlock: lock at 17:59, unlock after 18:00, the popover shows in day-close mode once.

### Hypotheses to attack

18. Hypothesis: one `Task.yield()` is enough for the popover window to report visible after the click, including on the first opening after launch when `panel.window` is set by the view's first appearance; if not, the day close does not open and stays unmarked until the next trigger (the scheduler does not retry on `.due`).
19. Hypothesis: `com.apple.screenIsUnlocked` is delivered to the sandboxed app; registration was proven in a spike, delivery is not. If it is not, a wake, a clock or time-zone change or a Settings change re-checks instead.
20. Hypothesis: with the Focus read stalled, the day close still opens within about 3 s of launch (the gate's launch default).

### Known gaps

- Finding 3 has no red test; the visibility confirmation is app-target code covered only by the walk.
- Findings 1 and 7 have no unit seam; the first is one argument, the second a race inside the app delegate.

## Fix round 6: the day is marked when the popover is seen

At `e72000d`, `swift test --package-path apps/macos/TodzKit` gives `Test run with 748 tests in 51 suites passed` (743 before, plus the round 6 coordinator tests, minus the folded pin, plus two gate pins); `xcodegen generate` and the Debug `xcodebuild` give `BUILD SUCCEEDED`, no warnings.

| Item | What changed | Red commit and printed text | Green commit |
|------|--------------|-----------------------------|--------------|
| A. mark on seen | the opener answers "a click was sent" (false only when the status button is not found); `MenuBarPanel.open()` lost the `Task.yield()` guess; the coordinator takes `isPopoverVisible`, keeps the mode on and the day unmarked after a click, and marks in `popoverShown()`, which `MenuBarPanelReader` calls when the window becomes visible (also at `viewDidMoveToWindow`) and which the coordinator also takes at once when the popover was already visible; `onHide` still ends the mode; a later check clicks again while unmarked, never while opening or visible. The pin at the old line 218 is folded into the new tests | `f6f81ef` `aClickSentAndNeverShownKeepsTheModeOnUnmarkedAndUnengagedThenShownMarks`: `Expectation failed: await harness.coordinator.check() == .due`, `Expectation failed: harness.lastClosedDay == nil`; `aLaterCheckWhileUnmarkedClicksAgainAndAShownPopoverStopsFurtherClicks`: `Expectation failed: harness.popover.openings == 2` (twice). `Test run with 746 tests in 51 suites failed after 0.217 seconds with 4 issues`. Pins when they landed: `aPopoverAlreadyVisibleWhenTheModeStartsMarksTheDayAtOnce`, `noStatusButtonEndsTheModeMarksNothingAndALaterCheckThatDayOpens`, `aShownPopoverWithTheModeOffMarksNothing` | `e72000d` |
| B. focus read | on the 3 s timeout the gate applies the launch read as quiet (fail closed) and the read stays alive, so a late answer still goes through `applyLaunchRead`; the timer task is cancelled when the answer arrives first; the timeout is `focusFilterReadTimeout: Duration = .seconds(3)`; the stream is `settlements`. `ProactiveGate` needed no change | pins `a986f88` (`aLateLaunchReadAfterTheTimeoutQuietedTheGateReleasesWhatItHeld`, `aPerformThatArrivesAfterTheTimeoutWinsOverTheLateLaunchRead`), green when they landed; the race itself is app-target code with no seam | `e72000d` |
| C. ADR | one Consequences line on `com.apple.screenIsUnlocked`; decision 5 states the mark-when-seen rule the `// NB ADR 0055` comments point to | none (docs) | `e72000d` |
| D. lock fails closed | `ScreenLock.isLocked` is true when `CGSessionCopyCurrentDictionary()` returns nil | none (app target, no seam) | `e72000d` |
| E. engagement | Done, Tomorrow and No date call `MenuBarPanel.engage(_:)` before acting; the popover container uses `.contentShape(Rectangle()).onTapGesture` instead of the simultaneous gesture; `engage(_:)` engages the coordinator, then `NSApp.activate()` and makes the popover window key | none (view and AppKit, no seam) | `e72000d` |
| F. docs | spec failure table: unlock wake, 3 s Focus wait then quiet, locked screen, time-zone change, click-sent-never-shown rows; the `// NB ADR 0055` on `MenuBarPanel.open()` is cut to the rule | none (docs) | the docs commit after `e72000d` |

### The ONE-opening walk to re-check

Launch hidden (`open -g -j`) with the day close due, and look at one opening:

- the popover shows in the mode; `lastClosedDay` is written only after it shows (read the defaults key right after launch, then after the popover appears);
- a click on the heading (not on a button or a row), then D on a focused row acts; Tab to a row first and D before any click does nothing;
- a click on Done, Tomorrow or No date acts on the first click;
- Escape closes.

### Hypotheses to attack

21. Hypothesis: the popover window reports visible through `didChangeOcclusionState` (or is already visible at `viewDidMoveToWindow`) on the first opening after a hidden launch; if not, the day stays unmarked and the mode stays on until the next check clicks again.
22. Hypothesis: after a click in the popover, `NSApp.activate()` plus `makeKey()` gives the popover keyboard focus so D, T and N reach the focused row; if the tester's FAIL on E6 persists, the cause is the window not becoming key, not the tap gesture.
23. Hypothesis: with the Focus read stalled, the gate holds as quiet for 3 s after launch, then a late `isQuiet = false` releases the held day close the same day.

### Known gaps

- A, the visibility signal, B's race, D and E are app-target code; only the coordinator, the gate and their pins are unit-tested.

## Fix round 7: a click in flight, a due day only, a workspace change closes

`swift test --package-path apps/macos/TodzKit` gives `Test run with 754 tests in 51 suites passed` (748 before, plus six round 7 coordinator tests); `xcodegen generate` and the Debug `xcodebuild` give `BUILD SUCCEEDED`, no warnings.

| Item | What changed | Red commit and printed text | Green commit |
|------|--------------|-----------------------------|--------------|
| R1. click in flight | `isOpening` is replaced by `clickedAt`; a check refuses to click while `now() < clickedAt + popoverShowWait` (5 s); `popoverShown()` and `end()` clear it | `a14d2f0` `aCheckBetweenTheClickAndTheShowClicksNothingAndOneAfterTheWaitClicksAgain`: `Expectation failed: harness.popover.openings == 1`, `Expectation failed: harness.popover.openings == 2` | `ff474e5` |
| R2. due day only | `popoverShown()` marks only when the decision is `.due`, leaves a marked day alone and ends a stale mode | `bb059af` `aShownPopoverOfAModeLeftFromYesterdayEndsItMarksNothingAndTomorrowIsDue`: `Expectation failed: harness.lastClosedDay == nil`, `Expectation failed: !harness.coordinator.isClosingDay`, `Expectation failed: harness.popover.openings == 2`. Pin: `aPopoverShownAgainAfterTheDayWasMarkedKeepsTheMode` | `ff474e5` |
| S1. workspace change | `DayCloseCoordinator.workspaceChanged()` answers whether to close the popover: an unengaged mode answers yes and stays on (the hide ends it), an engaged mode ends in place; the view closes the panel on yes; `⌘1-9` returns early unless `acceptsKeyActions` | `902e8b6` `aWorkspaceChangeDuringAnUnengagedModeAsksToCloseThePopoverAndKeepsTheMode`: `Expectation failed: harness.coordinator.workspaceChanged()`; `aWorkspaceChangeDuringAnEngagedModeEndsItInPlace`: `Expectation failed: !harness.coordinator.isClosingDay`. Pin: `aWorkspaceChangeOutsideTheModeAsksNothing` | `ff474e5` for the coordinator, the app commit after it for the views |
| R3. Focus read throws | a throwing read counts as not quiet: applied before the timeout, releasing the held quiet after it | none (app target, no seam) | the app commit |
| R4. tap | back to `.simultaneousGesture(TapGesture())` with `.contentShape(Rectangle())`; `engage(_:)` returns unless the mode is on and unengaged, so a normal tap never activates the app | none (view and AppKit) | the app commit |
| S2. focus return | `engage(_:)` remembers the frontmost application when it is not todz; the timed close and Escape in the mode reactivate it when no other todz window is visible | none (AppKit) | the app commit |
| R5, R6. docs | NB comment, ADR 0055 decision 5, spec data flow and failure table rows, the false gap deleted | none (docs) | the docs commit |

### The ONE-opening walk to re-check

Launch hidden (`open -g -j`) with the day close due and a second workspace seeded:

- the day close is the first popover; it shows with no second click and no crash; `lastClosedDay` is written once the popover is seen;
- before any click, press ⌘2: the popover closes and no add field ever appears; no relaunch is needed beyond that.

### Hypotheses to attack

24. Hypothesis: a status button click queued by the click's own defaults change lands inside the 5 s wait and is refused, so the popover is never toggled closed (E1).
25. Hypothesis: engaging from another app and then pressing Escape or waiting out the timed close returns the front to that app, and a normal popover tap never activates todz.

### Known gaps

- R3, R4 and S2 are app-target code covered only by the walk.
