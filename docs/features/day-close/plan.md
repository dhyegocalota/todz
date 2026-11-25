# Plan: Day close

**Spec:** spec.md
**Tier:** 🟡
**Seam:** a pure `DayCloseSchedule` and a `DayClosePreference` in `TodzKit`; in the app, a `DayCloseScheduler` owned by the `AppDelegate` beside the `ProactiveGate`, which opens the popover through `MenuBarPanel` (ADR 0031's status-button helper) into a day-close mode the popover reads from the model
**Assumptions (decided, owner can override):**
- `design.md`'s recommendations are the loop's calls; its copy is the copy.
- The spike's answer on opening the popover from code is the mechanism; if it fails, the step is struck with the reason and the fallback the spike names.
- The preference and `lastClosedDay` live in `UserDefaults.standard` with registered defaults, as `MenuBarBadge` does; `lastClosedDay` is a `CalendarDate` string.
- "Today" is the active workspace's Today, as the menu bar count and the popover read it (ADR 0036).

## File map

| Group | Paths owned | Developer sub-agent |
|-------|-------------|---------------------|
| G1 | `apps/macos/TodzKit/Sources/TodzKit/{DayCloseSchedule,DayCloseDecision,DayClosePreference}.swift` (new), `apps/macos/TodzKit/Sources/TodzKit/AppModel+DayClose.swift` (new), `apps/macos/TodzKit/Tests/TodzKitTests/{DayCloseScheduleTests,DayClosePreferenceTests,AppModelTests+DayClose}.swift` (new), `apps/macos/Todz/DayClose/` (new), `apps/macos/Todz/MenuBar/`, `apps/macos/Todz/Settings/SettingsView.swift`, `apps/macos/Todz/AppDelegate.swift`, `apps/macos/Todz/TodzApp.swift`, `apps/macos/Copy/` (the files `design.md` names), `docs/features/day-close/tester-briefing.md` | `developer` (Opus) |
| Lead | `apps/macos/README.md`, `docs/product/README.md`, `README.md` (walk), `docs/screenshots/day-close/` | lead |

## Sequencing

One lane: the scheduler, the opener and the popover mode all read G1's types, and the popover files are one surface.

## Steps

### G1

- [ ] **Step 1:** Red: `DayCloseScheduleTests` (a fixed calendar and time zone): off → `.off`; on, before the time → `.notYet(next: today at the time)`; at the time and after it the same day, not closed today → `.due`; closed today → `.doneToday(next: tomorrow at the time)`; a missed time found at 23:59 → `.due`, at 00:01 the next day before the time → `.notYet`; the time moved later after closing today → `.doneToday`; turned on after today's time, not closed → `.due`; a DST-change day keeps the wall-clock time. `DayClosePreferenceTests`: the registered defaults read off and 18:00; registering never overwrites a stored choice. Commit alone with stubs that `fatalError("<name> is not implemented")`.
- [ ] **Step 2:** Green: `DayCloseSchedule`, `DayCloseDecision`, `DayClosePreference`.
- [ ] **Step 3:** Red then green: `AppModelTests+DayClose`: entering the mode with open Today tasks shows them; Done completes, Tomorrow sets tomorrow's date, Drop clears the date (each one write through the existing calls); a due day close with nothing open marks the day closed and asks nothing; leaving the mode restores the usual Today; the decision through the gate: held during quiet, shown on release the same day, dropped when released after midnight; `lastClosedDay` set only when the popover actually opened.
- [ ] **Step 4:** The app: `DayCloseScheduler` (a timer to the next decision, re-checked on wake from sleep, at launch and when the preference changes); the popover opened through `MenuBarPanel` per the spike; the day-close heading, row actions and end state from `design.md`; the two Settings controls. Copy in the `*Copy.swift` files.
- [ ] **Step 5:** `swift test --package-path apps/macos/TodzKit` green with its count; `xcodegen` and a Debug `xcodebuild` succeed. Tester briefing (how to force a day close a minute ahead without waiting; the two-opening limit for the walk).

### Lead

- [ ] **Step 6:** The app README and the product design name the day close (purpose only); the README walk gains the day-close popover and the Settings controls from the tester's screenshots.

## Failure modes

| Step | What breaks | How I notice (the concrete signal) | How I back out |
|------|-------------|------------------------------------|----------------|
| 4 | Opening from code does not open the popover | the time passes and nothing appears | the spike's fallback, struck here with the reason |
| 4 | The timer does not survive sleep | a day close missed after a nap past the time | re-check on `NSWorkspace.didWakeNotification` (Step 4) |
| 4 | The popover opens twice the same day | two openings in one day | `lastClosedDay` written when it opens; the schedule test pins once a day |
| 4 | The mode leaks into a normal opening | the next click shows the action buttons | the mode ends when the popover closes (Step 3 test) |

**Steps with no backout:** none.

## Z. Prove and ship

- [ ] **Tester briefing:** the developer wrote `tester-briefing.md`.
- [ ] **Tester run:** a fresh `tester` sub-agent executed `test-plan.md` and ticked every box with evidence.
- [ ] **Reviewer:** a verdict; refutation recorded in `test-plan.md`.
- [ ] **Security reviewer:** a verdict.
- [ ] **/check-ui:** the Settings controls and the day-close popover, from real builds (ADR 0026: Orca).
- [ ] **/open-pr:** gates passed, learnings sweep stated, PR opened.
