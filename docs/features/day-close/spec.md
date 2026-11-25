# Day close

**Status:** Building
**Tier:** 🟡 (a scheduler in the app, the popover opened from code, a mode of the popover, two Settings controls)
**Owner approval:** approved 2026-11-25 by the owner's request to the loop (2026-11-24, ~20:30: "1,4,5,6,7,9,10 e também 11 … seja criativo, add no cron e só para quando tiver pronto"; every item "features opcionais", off by default, no push notifications), recorded in `todz-loop/STATE.md` "Owner requirements queued" → `proactive-day` item 2. The behaviour is the loop's call in [ADR 0055](../../adr/0055-the-day-closes-once-a-day-in-the-menu-bar-popover-at-the-owner-s-time.md).
**ADRs:** [0055](../../adr/0055-the-day-closes-once-a-day-in-the-menu-bar-popover-at-the-owner-s-time.md), [0054](../../adr/0054-the-app-learns-focus-through-a-todz-focus-filter-not-the-focus-status-api.md), [0036](../../adr/0036-the-menu-bar-icon-counts-today-s-open-tasks-behind-a-setting.md), [0031](../../adr/0031-the-menu-bar-extra-is-a-swiftui-window-over-the-app-s-one-model.md)
**Not changing:** the server, the widgets, the menu bar count, the agent nudge, the main window

## Problem

Tasks due today are forgotten when the day ends with nobody looking at them. The owner wants todz to ask him once, at a time he picks, what happens to each.

## Goals

- Settings: a switch "Close the day" (off by default) and the time (default 18:00), kept in the app's defaults.
- Once a day, at that time or at the first wake or launch after it on the same day, when Today of the active workspace has open tasks, the popover opens by itself in a day-close mode: a heading with what is left and, on each row, Done, Tomorrow and Drop.
- Done completes the task; Tomorrow sets its due date to tomorrow; Drop clears its due date (the task stays open, out of Today).
- During a Focus with the todz filter, the day close is held and shows when the Focus ends, if it is still the same day.
- Never twice a day; nothing opens when nothing is left.

## Non-goals

- Server-side scheduling, notifications, a per-workspace time, closing more than the active workspace, deleting tasks.

## Design

### Data flow

```
Settings: isDayCloseOn, dayCloseTime (defaults)        lastClosedDay (defaults)
timer / wake / launch → DayCloseSchedule.decision(now, time, lastClosedDay, isOn)
   → .notYet(next) | .due | .doneToday | .off
.due → Today has open tasks?  no → lastClosedDay = today
                              yes → gate.admit(.dayClose)
                                    .show → open the popover in day-close mode, lastClosedDay = today
                                    .held → on release (same day): claimRelease(.dayClose) → open, lastClosedDay = today
row: Done → complete · Tomorrow → updateDueDate(tomorrow) · Drop → updateDueDate(nil)
popover closes → the mode ends
```

### Interfaces

- `TodzKit`: `DayCloseSchedule` (pure: decision from the instant, the time of day, the last closed day, the switch and a calendar), `DayClosePreference` (the defaults keys and defaults, as `MenuBarBadge` does), the day-close mode on the model or the popover's state.
- App: a scheduler that wakes at the next decision time, on wake from sleep and at launch; the popover opener through the status button (ADR 0031's helper, opening instead of closing); the day-close rows and heading; two Settings controls; copy in the `*Copy.swift` files `design.md` names.

### Failure handling

| Case | Effect |
|---|---|
| the Mac sleeps through the time | fires at the first wake that day; not after midnight |
| the app launches after the time | fires at launch that day |
| the owner changes the time to a later one after it fired today | does not fire again today |
| the owner turns it on after today's time | fires now if not closed today (a first chance after the time) |
| held through midnight by a Focus | dropped; tomorrow's day close is due as usual |
| the status button cannot be found, or the open fails | nothing opens and the mode is cleared; `lastClosedDay` is not set, so a later check tries again that day (no fallback) |
| Today is still loading, failed to load, or the owner is signed out | wait; decide again when the count is known; nothing is marked |
| the popover is already open when the day close is due | the mode starts in place without a click; the add field hides and keeps its draft until the mode ends |
| a Focus read at launch is still pending | the first check waits for it |
| a row action fails (offline) | the outbox queues it as any write; the row reflects the change at once |

### Rollback

Revert the app change; the preference keys stay unread in the defaults.

## Open questions → answers

| Question | Options | Owner's answer | Date |
|----------|---------|----------------|------|
| What does Drop do? | clear the due date; complete; delete | the loop's call: clear the due date (ADR 0055 §5) | 2026-11-25 |
| Where does the preference live? | the app; the owner's account | the loop's call: the app (ADR 0055 §1) | 2026-11-25 |
| A missed time? | skip; the first chance the same day | the loop's call: the first chance the same day (§2) | 2026-11-25 |

## Test strategy summary

Swift tests for `DayCloseSchedule` (before, at and after the time; once a day; a missed time the same day; after midnight; off; a later time after firing; time zone and DST days), the preference defaults, the decision through the gate (held, released the same day, dropped after midnight), the row actions on the model (done, tomorrow's date, cleared date). A build. A walk with Orca: the Settings controls; one forced day close (a time a minute ahead) opening the popover with the mode, one action of each kind, and nothing on a second chance the same day; screenshots of Settings and the day-close popover. The popover appears on the owner's screen: the walk keeps to two openings.
