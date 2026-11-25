# Morning glance

**Status:** Building
**Tier:** 🟡 (the app's first panel, five system signals, a coordinator through the gate, one Settings switch)
**Owner approval:** approved 2026-11-25 by the owner's request to the loop (2026-11-24, ~20:30: "1,4,5,6,7,9,10 e também 11 … seja criativo, add no cron e só para quando tiver pronto"; every item "features opcionais", off by default, no push notifications), recorded in `todz-loop/STATE.md` "Owner requirements queued" → `proactive-day` item 3: "on the first wake or unlock of the day, a small glass panel shows Today for about 5 seconds and fades, with no focus steal and a click to open the window". The behaviour is the loop's call in [ADR 0062](../../adr/0062-the-morning-glance-is-a-non-activating-glass-panel-that-shows-today-on-the-first-wake-or-unlock-of-the-day.md).
**ADRs:** [0062](../../adr/0062-the-morning-glance-is-a-non-activating-glass-panel-that-shows-today-on-the-first-wake-or-unlock-of-the-day.md), [0055](../../adr/0055-the-day-closes-once-a-day-in-the-menu-bar-popover-at-the-owner-s-time.md), [0054](../../adr/0054-the-app-learns-focus-through-a-todz-focus-filter-not-the-focus-status-api.md), [0036](../../adr/0036-the-menu-bar-icon-counts-today-s-open-tasks-behind-a-setting.md), [0031](../../adr/0031-the-menu-bar-extra-is-a-swiftui-window-over-the-app-s-one-model.md)
**Not changing:** the server, the widgets, the menu bar count, the popover's content, the day close's behaviour (one read-only property is added), the main window, the gate

## Problem

The owner sits down and starts working without looking at what is due. He wants todz to show him Today once, the moment he arrives, without asking and without taking the keyboard from the app he opens first.

## Goals

- Settings: a switch "Morning glance" (off by default), kept in the app's defaults.
- On the first chance of each calendar day (a launch, a wake from sleep, a display wake, a screen unlock, a return to the session), when Today of the active workspace has open tasks, a small glass panel appears at the top right of the screen with the menu bar with the heading, what is left and up to five open tasks, then fades after about 5 seconds.
- The panel never becomes key or main and never activates todz: the frontmost app and its keyboard focus stay where they were.
- A click anywhere on it, released after the pointer entered it once the 0.4 s grace ended, closes it, activates todz and opens the main window on Today with the list focused, never the add field.
- The panel stays hidden with a hidden todz and out of screen sharing and captures.
- During a Focus with the todz filter, the glance is held and shows once when the Focus ends, on the day of its latest held chance.
- Never twice a day; nothing shows when nothing is left, while the screen is locked or its menu bar screen is mirrored, or when the day close or Today is already in front of the owner.

## Non-goals

- A time of day, notifications, actions on the rows, more than the active workspace, more than one screen, a server-side setting, a glance from the widgets, skipping a captured screen (no public API reports one).

## Design

### Data flow

```
Settings: showsMorningGlance (defaults)                 lastMorningGlanceDay (defaults)
launch (after the bounded Focus read and after the day close's scheduler starts)
  / didWake / screensDidWake / screenIsUnlocked / sessionDidBecomeActive → coordinator.check(): a new chance
didActivateApplication → coordinator.retryLockedChance(): a new chance only while a locked chance is pending
   chance day = today in the Mac's current time zone
       off, or lastMorningGlanceDay == day, or a show in flight or on screen  → nothing
       Today unknown → observe it; the observation continues this chance (its day, its start), never check();
                       known more than 60 s after the chance → nothing, unmarked
       0 open → lastMorningGlanceDay = day
       MorningGlanceFront.isInFront (day close due and idle, day close opening, popover shown,
                                     todz active with a main-capable window) → lastMorningGlanceDay = day
       menu bar screen mirrored → nothing, unmarked
       screen locked → a locked chance pending; the unlock or the next app switch is a fresh chance
       gate.admit(.morningGlance)
          .held → held day = day (a later held chance moves it forward)
                  on release: claimRelease(.morningGlance); a fresh chance only if today == held day
          .show → showPanel(content captured now)
                  presenter: locked now → false; unhide without activation if hidden; order front on
                             NSScreen.screens.first; wait ≤ 1 s for the occlusion to turn visible → true,
                             else order out → false
                  false → nothing marked, the chance ends
                  true  → locked again → close, nothing marked
                          else lastMorningGlanceDay = day; in front meanwhile → close at once
panel: ignores the pointer 0.4 s; 5 s (paused while hovered, at most 30 s in all) → fade 0.5 s (0 with Reduce Motion) → gone
       click → close, windowState.waitingLink = .today → the main window opens on Today, todz active
       popover shows, screen locks, Mac sleeps, signed out, workspace changes → closed at once
```

### Interfaces

- `TodzKit`:
  - `MorningGlancePreference`: keys, default, registration, the last shown day, as `DayClosePreference`.
  - `MorningGlanceContent`: the workspace identifier, the heading count, up to five `WidgetSnapshotTask` rows, the count of the rest; `AppModel.morningGlanceContent` reads only `taskViews.today.open` and `isTodayKnown(in:)`, nil until Today is known.
  - `MorningGlanceDwell` (pure): when the panel starts to fade given the show, the hovers and their ends, capped at 30 s; `fadeDuration(reducesMotion:)`; the pointer grace of 0.4 s.
  - `MorningGlanceFront.isInFront(isDayCloseDue:isClosingDay:isPopoverShown:isApplicationActive:hasVisibleMainCapableWindow:)` (pure).
  - `MorningGlanceCoordinator`: injected gate, defaults, time zone, clock, content, lock, mirroring, "in front", the panel's show and close; it decides, asks the gate, shows, marks only once seen, observes releases and Today, retries a locked chance, closes the panel when the popover shows, on `closeNow()`, or when the content turns nil or changes workspace.
  - `DayCloseCoordinator.isDueAndIdle`: public, read-only.
- App: `MorningGlancePanel` (the `NSPanel` subclass), `MorningGlanceView` (glass or material, heading, rows), `MorningGlancePresenter` (placement, unhide, lock re-read, order front, the occlusion wait, the dwell, the pointer grace, the fade, the click), `MorningGlanceTrigger` (the chance observers, the app switch, and the lock and sleep observers that call `closeNow()`), `ScreenLock` and the unlock name moved to `Todz/Shared/`, the Settings switch, copy in the `*Copy.swift` files `design.md` names.

### Failure handling

| Case | Effect |
|---|---|
| the glance is off | no chance does anything; turning it on shows nothing until the next chance |
| a second chance the same day after it showed | nothing |
| Today is loading, failed to load, or the owner is signed out at the chance | the chance waits; shows if Today becomes known within 60 s of the chance; later, nothing and the day stays unmarked |
| Today has nothing open | nothing shows; the day is marked |
| the day close is due on the same chance | the day close decides first; the glance marks the day and shows nothing |
| the popover shows, the day close is opening it, or todz is active with a window on screen | the day is marked; nothing shows |
| the popover opens while the panel shows or is on its way | the panel closes the moment it is on screen; the day stays marked |
| the screen is locked at the chance (a wake with "require password") | nothing shows or is marked; the unlock checks again; if the unlock is never delivered, the first switch between apps checks again; an unreadable session counts as locked |
| the screen locks between the gate and the show | the presenter answers false or the coordinator closes it; nothing marked |
| locked on one day, unlocked on the next | the unlock is a fresh chance of the new day |
| the menu bar screen is mirrored | nothing shows or is marked; the next chance after mirroring ends shows it |
| a Focus with the todz filter is on | held; a later chance while still quiet moves the held day forward; the release shows once if today is the held day; a release on another day is claimed and dropped |
| the release finds the screen locked | a locked chance pending; the unlock shows it |
| the release finds nothing open | the day is marked; nothing shows |
| a Focus read at launch is pending or throws | the launch chance waits for the read at most 3 s, as the day close does; a throw is not quiet |
| a check while a show is in flight or on screen | nothing more |
| the panel is ordered front but its occlusion never turns visible within 1 s | ordered out, the dwell cancelled, nothing marked; the next chance that day tries again (no fallback) |
| the chance's day ends before the panel is seen | the chance's day is marked, not the new one; the new day gets its own chance |
| the Mac's time zone changes | the next chance computes the day in the new zone |
| the Mac stays awake and unlocked across midnight | no glance until its next launch, wake or unlock |
| the pointer rests on the panel | it stays, at most 30 s from its appearance |
| a click lands in the first 0.4 s | it goes to the app beneath; the panel ignores the pointer |
| the screen locks, the Mac sleeps, the owner signs out or switches workspace while it shows | it closes at once |
| a key is typed while the panel shows | it reaches the frontmost app; the panel never takes the keyboard |
| the owner clicks the panel while offline | the main window opens on the cached Today |
| a wake after hours asleep | the panel shows the cached Today, possibly minutes stale (ADR 0062) |
| todz was hidden with ⌘H with its window open | the window comes back with the glance, behind the frontmost app |

### Siblings

`feat/performance` (Lane A) also edits `apps/macos/Todz/AppDelegate.swift`, `apps/macos/Todz/TodzApp.swift` and `apps/macos/TodzKit/Tests/TodzKitTests/AppModelHarness.swift`, stores `taskViews` (its step 36) and moves cache writes to the background (its step 37). Whichever branch merges second merges `main` into itself, never rebases, and keeps both sides. `AppModel+MorningGlance` reads only `taskViews.today.open` and `isTodayKnown(in:)`, so a stored `taskViews` changes nothing here; a test reads the content twice across midnight to pin it.

### Rollback

Revert the app change; the preference keys stay unread in the defaults.

## Open questions → answers

| Question | Options | Owner's answer | Date |
|----------|---------|----------------|------|
| What counts as a chance? | wake and unlock; also launch, display wake and session return | the loop's call: all five (ADR 0062 §2) | 2026-11-25 |
| How long to wait for Today? | forever; 60 s; not at all | the loop's call: 60 s from the chance (§3) | 2026-11-25 |
| When the popover, the day close or todz is already in front? | show anyway; mark and skip | the loop's call: mark and skip; the day close wins deterministically (§6) | 2026-11-25 |
| Hover and click? | fixed 5 s; pause on hover; click opens a row | the loop's call: pause on hover up to 30 s, a click anywhere opens Today after a 0.4 s grace (§7, §8) | 2026-11-25 |
| Where on screen? | top right under the menu bar; under the status item; top centre | the loop's call: top right of the screen with the menu bar (§7, `design.md` O1) | 2026-11-25 |
| Screen sharing and presenting? | hide from capture; skip when mirrored; nothing | the loop's call: skip when the menu bar screen is mirrored, nothing else (§9) | 2026-11-25 |

## Test strategy summary

Swift tests for the preference, the content (empty, one, five, seven with "+2 more", overdue, pending, two reads across midnight), the dwell (5 s, hovers, the 30 s cap, the fade with and without Reduce Motion, the 0.4 s grace), the front rule (each input alone), `DayCloseCoordinator.isDueAndIdle`, and the coordinator (off; once a day; nothing open; Today in time and late through observation; locked, unlocked, the app switch, locked across midnight, locked inside the show; held, moved forward, released the same day, another day, while locked, with nothing open; the day close due; in front; mirrored; not seen; re-entrant; the popover during an in-flight show; `closeNow()`; the content nil or another workspace while shown; midnight during the show; the zone's day). A build. A walk with Orca with at most two panel showings, launch as the trigger (`open -g -j`). The real unlock, wake, Focus, Reduce Motion, VoiceOver and mirroring are Human checklist rows.
