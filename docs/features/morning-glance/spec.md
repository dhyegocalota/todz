# Morning glance

**Status:** Approved
**Tier:** 🟡 (the app's first panel, five system signals, a coordinator through the gate, one Settings switch)
**Owner approval:** approved 2026-11-25 by the owner's request to the loop (2026-11-24, ~20:30: "1,4,5,6,7,9,10 e também 11 … seja criativo, add no cron e só para quando tiver pronto"; every item "features opcionais", off by default, no push notifications), recorded in `todz-loop/STATE.md` "Owner requirements queued" → `proactive-day` item 3: "on the first wake or unlock of the day, a small glass panel shows Today for about 5 seconds and fades, with no focus steal and a click to open the window". The behaviour is the loop's call in [ADR 0062](../../adr/0062-the-morning-glance-is-a-non-activating-glass-panel-that-shows-today-on-the-first-wake-or-unlock-of-the-day.md).
**ADRs:** [0062](../../adr/0062-the-morning-glance-is-a-non-activating-glass-panel-that-shows-today-on-the-first-wake-or-unlock-of-the-day.md), [0055](../../adr/0055-the-day-closes-once-a-day-in-the-menu-bar-popover-at-the-owner-s-time.md), [0054](../../adr/0054-the-app-learns-focus-through-a-todz-focus-filter-not-the-focus-status-api.md), [0036](../../adr/0036-the-menu-bar-icon-counts-today-s-open-tasks-behind-a-setting.md), [0031](../../adr/0031-the-menu-bar-extra-is-a-swiftui-window-over-the-app-s-one-model.md)
**Not changing:** the server, the widgets, the menu bar count, the popover's content, the day close's behaviour, the main window, the gate

## Problem

The owner sits down and starts working without looking at what is due. He wants todz to show him Today once, the moment he arrives, without asking and without taking the keyboard from the app he opens first.

## Goals

- Settings: a switch "Morning glance" (off by default), kept in the app's defaults.
- On the first chance of each calendar day (a launch, a wake from sleep, a display wake, a screen unlock, a return to the session), when Today of the active workspace has open tasks, a small glass panel appears at the top right under the menu bar with the heading, what is left and up to five open tasks, then fades after about 5 seconds.
- The panel never becomes key or main and never activates todz: the frontmost app and its keyboard focus stay where they were.
- A click anywhere on it closes it, activates todz and opens the main window on Today.
- During a Focus with the todz filter, the glance is held and shows once when the Focus ends, if it is still the day of its chance.
- Never twice a day; nothing shows when nothing is left, while the screen is locked, or when Today is already in front of the owner.

## Non-goals

- A time of day, notifications, actions on the rows, more than the active workspace, more than one screen, a server-side setting, a glance from the widgets.

## Design

### Data flow

```
Settings: showsMorningGlance (defaults)                 lastMorningGlanceDay (defaults)
launch (after the bounded Focus read) / didWake / screensDidWake / screenIsUnlocked / sessionDidBecomeActive
   → coordinator.check()          day = today in the Mac's current time zone
       off, or lastMorningGlanceDay == day, or a show in flight or on screen  → nothing
       Today unknown → wait for it, at most 60 s from the chance; later → nothing, unmarked
       0 open → lastMorningGlanceDay = day
       Today in front (popover shown, day close opening, todz active with a window) → lastMorningGlanceDay = day
       screen locked → pending for day; the unlock or the next app switch checks again
       gate.admit(.morningGlance)
          .held → on release: claimRelease(.morningGlance); shows only if today == day
          .show → unhide without activation, order the panel front (content captured now)
                  seen on screen → lastMorningGlanceDay = day; not seen → unmarked
panel: 5 s (paused while hovered, restarted on leave) → 0.5 s fade (none with Reduce Motion) → gone
       click → close, windowState.waitingLink = .today → the main window opens on Today, todz active
       the popover shows → the panel closes at once
```

### Interfaces

- `TodzKit`: `MorningGlancePreference` (keys, default, registration, the last shown day, as `DayClosePreference`); `MorningGlanceContent` (the heading count, up to five `WidgetSnapshotTask` rows, the count of the rest) and `AppModel.morningGlanceContent` (nil until Today is known); `MorningGlanceDwell` (pure: when the panel starts to fade, given the show, the hover and its end); `MorningGlanceCoordinator` (injected gate, defaults, time zone, clock, content, lock, "Today in front" and the panel's show; it decides, asks the gate, shows, marks only once seen, observes releases, waits for Today within its window, retries a locked chance).
- App: `MorningGlancePanel` (the `NSPanel` subclass), `MorningGlanceView` (glass or material, heading, rows), `MorningGlancePresenter` (placement, unhide, order front, the visibility answer, the dwell and fade, the click), `MorningGlanceTrigger` (the five observers and the app switch), the Settings switch, copy in the `*Copy.swift` files `design.md` names.

### Failure handling

| Case | Effect |
|---|---|
| the glance is off | no chance does anything; turning it on shows nothing until the next chance |
| a second chance the same day after it showed | nothing |
| Today is loading, failed to load, or the owner is signed out at the chance | wait; shows if Today becomes known within 60 s of the chance; later, nothing and the day stays unmarked |
| Today has nothing open | nothing shows; the day is marked |
| the screen is locked at the chance (a wake with "require password") | nothing shows or is marked; the unlock checks again; if the unlock is never delivered, the first switch between apps that day checks again; an unreadable session counts as locked |
| a Focus with the todz filter is on | held; shown once at the release if it is still the chance's day; a release on a later day is claimed and dropped |
| a Focus read at launch is pending or throws | the launch chance waits for the read at most 3 s, as the day close does; a throw is not quiet |
| the popover shows, the day close is opening it, or todz is active with a window on screen | the day is marked; nothing shows |
| the popover opens while the panel shows | the panel closes at once; the day stays marked |
| a check while a show is in flight or on screen | nothing more |
| the panel is ordered front but not on screen (no screen with a menu bar, a hidden app that stays hidden) | nothing marked; the next chance that day tries again (no fallback) |
| the chance's day ends before the panel is seen | the chance's day is marked, not the new one; the new day gets its own chance |
| the Mac's time zone changes | the next chance computes the day in the new zone |
| the Mac stays awake and unlocked across midnight | no glance until its next launch, wake or unlock |
| a key is typed while the panel shows | it reaches the frontmost app; the panel never takes the keyboard |
| the owner clicks the panel while offline | the main window opens on the cached Today |
| todz was hidden with ⌘H with its window open | the window comes back with the glance, behind the frontmost app |

### Rollback

Revert the app change; the preference keys stay unread in the defaults.

## Open questions → answers

| Question | Options | Owner's answer | Date |
|----------|---------|----------------|------|
| What counts as a chance? | wake and unlock; also launch, display wake and session return | the loop's call: all five (ADR 0062 §2) | 2026-11-25 |
| How long to wait for Today? | forever; 60 s; not at all | the loop's call: 60 s from the chance (§3) | 2026-11-25 |
| When the popover or todz is already in front? | show anyway; mark and skip | the loop's call: mark and skip (§6) | 2026-11-25 |
| Hover and click? | fixed 5 s; pause on hover; click opens a row | the loop's call: pause on hover, a click anywhere opens Today (§8) | 2026-11-25 |
| Where on screen? | top right under the menu bar; under the status item; top centre | the loop's call: top right (§7, `design.md` O1) | 2026-11-25 |

## Test strategy summary

Swift tests for the preference (defaults, registration keeps a choice, a stored day reads back, an unreadable day reads as never), the content (empty, one, five, seven with "+2 more", overdue), the dwell (5 s, a hover pauses, a leave restarts), and the coordinator (off; once a day; nothing open marks; Today unknown then known within 60 s shows, after 60 s does not; locked shows nothing and the unlock or an app switch shows; held, released the same day shows, a later day is claimed and dropped; Today in front marks without showing; a show that is not seen marks nothing; a re-entrant check shows once; the chance's day is marked across midnight; the day in the injected zone). A build. A walk with Orca with at most two panel showings, launch as the trigger (`open -g -j`): the Settings switch; one glance with seven open tasks (frontmost app unchanged, never key, the fade); one glance clicked (todz active, the main window on Today); no-show launches for off, nothing open and a second launch the same day. The real unlock, wake, Focus, Reduce Motion and VoiceOver are Human checklist rows.
