# Plan: Day close

**Spec:** spec.md
**Tier:** 🟡
**Seam:** a pure `DayCloseSchedule` and a `DayClosePreference` in `TodzKit`; in the app, a `DayCloseScheduler` owned by the `AppDelegate` beside the `ProactiveGate`, which opens the popover through `MenuBarPanel` (ADR 0031's status-button helper) into a day-close mode the popover reads from the model
**Assumptions (decided, owner can override):**
- `design.md`'s recommendations are the loop's calls; its copy is the copy.
- The spike's answer on opening the popover from code is the mechanism (ADR 0055 Evidence): `performClick` on the status button after `NSApp.unhideWithoutActivation()`, never when the popover is already visible.
- The preference and `lastClosedDay` live in `UserDefaults.standard` with registered defaults, as `MenuBarBadge` does; `lastClosedDay` is a `CalendarDate` string.
- "Today" is the active workspace's Today, as the menu bar count and the popover read it (ADR 0036).

## Plan review answers (2026-11-25) — these override the steps below where they differ

- **R1** "What is left" is three-way: `todayHeadingCount == nil` (loading, failed, signed out) → wait and decide again when it becomes non-nil, never writing `lastClosedDay`; `0` → mark the day closed, open nothing; `> 0` → ask the gate. Tests: due at launch while loading, then 2 open → opens; due while signed out → not marked.
- **R2** The opener calls `NSApp.unhideWithoutActivation()` before clicking, and never clicks when the popover window is already visible (R10). Test-plan box: a hidden launch (`open -g -j`), then due → the popover is visible.
- **R3** The decision logic is a `DayCloseCoordinator` in `TodzKit` with injected values: the opener (`() -> Bool`, true when it opened), the clock (`now`), the defaults, the count, the gate. It owns: decide, ask the gate, open, write `lastClosedDay` only on a successful open, re-decide on release. The app keeps only timers and notifications that call `coordinator.check()`.
- **R4** The coordinator observes the gate's `released` (`withObservationTracking`, re-armed); on a change it calls `claimRelease(.dayClose)` and, if claimed, decides again: the schedule's `.due` covers "same day" and "once a day", so a release after midnight is claimed and dropped. Tests: held at 18:00 and released at 18:20 → opens; released at 00:10 the next day → nothing opens, the entry is claimed.
- **R5** The launch check runs after `readFocusFilter()` finishes (the AppDelegate awaits it before the first `check()`). Test: quiet from the launch read → held.
- **R6** `MenuBarPanel` moves from the popover's `@State` to the `AppDelegate` beside `windowState`, injected into the popover's environment, so the opener can use it. The mode ends when the popover window stops being visible (observe its visibility or occlusion, not key status), and is cleared when the opener fails. `apps/macos/Todz/MenuBar/MenuBarPopover.swift` and `MenuBarPanel.swift` are in G1's map.
- **R7** The linger records what happened (done, tomorrow, no date) and finds its task across the board, not only in `views.done`, so all three actions show their result for 1 s. `apps/macos/TodzKit/Sources/TodzKit/CompletionLingers.swift`, `apps/macos/Todz/MainWindow/MainWindowState.swift` (and their tests) join G1's map, with red tests for moving to tomorrow and clearing the date.
- **R8** In the mode the "Done today" section is hidden; "Day closed" shows when the mode is on, Today's open list is empty and nothing lingers. Test on the model or the view state.
- **R9** No fallback: if the opener cannot open, nothing opens and the day is not marked, so a later check that day tries again. The failure rows that named "the spike's fallback" read so.
- **R10** If the popover is already open when the day close is due, the mode starts in place without clicking; the add field hides but keeps its draft, which returns when the mode ends. Test-plan box.
- **R11** In the mode: ⌘N is off; D, T and N act only with no modifiers on the focused row; ⌘1–9 switches workspace and ends the mode; Escape closes the popover. Test-plan boxes.
- **R12** The time is stored as minutes after midnight (`Int`, default 1080). The schedule uses the model's `timeZone` and `now`, as `model.today` does. The app re-checks on wake (`NSWorkspace.shared.notificationCenter`, `didWakeNotification`), `NSSystemTimeZoneDidChange`, `NSSystemClockDidChange`, `.NSCalendarDayChanged` and `UserDefaults.didChangeNotification`.
- **R13** The test-plan boxes are made concrete (below).
- **R14** The model's Done, Tomorrow and No date reuse `complete` and `updateDueDate`: their tests are pins; Step 3's red carries the coordinator and the linger. `design.md` § 7 records O1–O7 as each one's recommendation.

## File map

| Group | Paths owned | Developer sub-agent |
|-------|-------------|---------------------|
| G1 | `apps/macos/TodzKit/Sources/TodzKit/{DayCloseSchedule,DayCloseDecision,DayClosePreference,DayCloseCoordinator}.swift` (new), `apps/macos/TodzKit/Sources/TodzKit/AppModel+DayClose.swift` (new), `apps/macos/TodzKit/Sources/TodzKit/CompletionLingers.swift`, `apps/macos/TodzKit/Tests/TodzKitTests/{DayCloseScheduleTests,DayClosePreferenceTests,DayCloseCoordinatorTests,AppModelTests+DayClose}.swift` (new), the `CompletionLingers` tests, `apps/macos/Todz/MainWindow/MainWindowState.swift`, `apps/macos/Todz/DayClose/` (new), `apps/macos/Todz/MenuBar/`, `apps/macos/Todz/Settings/SettingsView.swift`, `apps/macos/Todz/AppDelegate.swift`, `apps/macos/Todz/TodzApp.swift`, `apps/macos/Copy/` (the files `design.md` names), `docs/features/day-close/tester-briefing.md` | `developer` (Opus) |
| Lead | `apps/macos/README.md`, `docs/product/README.md`, `README.md` (walk), `docs/screenshots/day-close/` | lead |

## Sequencing

One lane: the scheduler, the opener and the popover mode all read G1's types, and the popover files are one surface.

## Steps

### G1

- [x] **Step 1:** Red: `DayCloseScheduleTests` (a fixed calendar and time zone): off → `.off`; on, before the time → `.notYet(next: today at the time)`; at the time and after it the same day, not closed today → `.due`; closed today → `.doneToday(next: tomorrow at the time)`; a missed time found at 23:59 → `.due`, at 00:01 the next day before the time → `.notYet`; the time moved later after closing today → `.doneToday`; turned on after today's time, not closed → `.due`; a DST-change day keeps the wall-clock time. `DayClosePreferenceTests`: the registered defaults read off and 18:00; registering never overwrites a stored choice. Commit alone with stubs that `fatalError("<name> is not implemented")`. — evidence: red `4b1f8a8`, each suite run alone stops on its stub (texts in `tester-briefing.md`); the schedule tests also cover the spring-gap time (02:30 → 03:30) and the time-of-day round trip
- [x] **Step 2:** Green: `DayCloseSchedule`, `DayCloseDecision`, `DayClosePreference`. — evidence: `55f1ce5`, 15 tests in 2 suites green
- [x] **Step 3:** Red then green: `AppModelTests+DayClose`: entering the mode with open Today tasks shows them; Done completes, Tomorrow sets tomorrow's date, Drop clears the date (each one write through the existing calls); a due day close with nothing open marks the day closed and asks nothing; leaving the mode restores the usual Today; the decision through the gate: held during quiet, shown on release the same day, dropped when released after midnight; `lastClosedDay` set only when the popover actually opened. — evidence: pins `6fa03d0` (the three writes, R14); red `c39ec33`, green `1166857`. Per R3 the gate, release, leaving-the-mode and `lastClosedDay` cases are `DayCloseCoordinatorTests` (the mode is the coordinator's `isClosingDay`); the mode's list and "Day closed" are `AppModelTests+DayClose` (R8); the outcomes of the linger are `CompletionLingersTests` (R7)
- [x] **Step 4:** The app: `DayCloseScheduler` (a timer to the next decision, re-checked on wake from sleep, at launch and when the preference changes); the popover opened through `MenuBarPanel` per the spike; the day-close heading, row actions and end state from `design.md`; the two Settings controls. Copy in the `*Copy.swift` files. — evidence: `3ef8dbe`; it also re-checks on time zone, clock and day changes (R12), waits for the launch Focus read (R5) and ends the mode when the popover hides or the workspace changes (R6, R11)
- [x] **Step 5:** `swift test --package-path apps/macos/TodzKit` green with its count; `xcodegen` and a Debug `xcodebuild` succeed. Tester briefing (how to force a day close a minute ahead without waiting; the two-opening limit for the walk). — evidence: at `3ef8dbe`, `Test run with 726 tests in 51 suites passed`; `xcodegen generate` and the Debug `xcodebuild` print `BUILD SUCCEEDED`; `tester-briefing.md`

### Lead

- [ ] **Step 6:** The app README and the product design name the day close (purpose only); the README walk gains the day-close popover and the Settings controls from the tester's screenshots.

## Failure modes

| Step | What breaks | How I notice (the concrete signal) | How I back out |
|------|-------------|------------------------------------|----------------|
| 4 | Opening from code does not open the popover | the time passes and nothing appears | no fallback (R9): the day stays unmarked and a later check that day tries again; strike the step with the reason if it never opens |
| 4 | The timer does not survive sleep | a day close missed after a nap past the time | re-check on `NSWorkspace.didWakeNotification` (Step 4) |
| 4 | The popover opens twice the same day | two openings in one day | `lastClosedDay` written when it opens; the schedule test pins once a day |
| 4 | The mode leaks into a normal opening | the next click shows the action buttons | the mode ends when the popover closes (Step 3 test) |

**Steps with no backout:** none.

## Z. Prove and ship

- [x] **Tester briefing:** the developer wrote `tester-briefing.md`. — evidence: `tester-briefing.md` (lane G1)
- [ ] **Tester run:** a fresh `tester` sub-agent executed `test-plan.md` and ticked every box with evidence.
- [ ] **Reviewer:** a verdict; refutation recorded in `test-plan.md`.
- [ ] **Security reviewer:** a verdict.
- [ ] **/check-ui:** the Settings controls and the day-close popover, from real builds (ADR 0026: Orca).
- [ ] **/open-pr:** gates passed, learnings sweep stated, PR opened.
