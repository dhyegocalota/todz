# Day temperature

**Status:** Building
**Tier:** 🟡 (one Settings switch, one required key in the widget snapshot, the menu bar label's alpha and a clock, and a row wash; no server, no schema, no new entitlement)
**Owner approval:** approved 2026-11-25 by the owner's request to the loop (2026-11-24, ~20:30: "1,4,5,6,7,9,10 e também 11 … seja criativo, add no cron e só para quando tiver pronto"; every item "features opcionais", off by default, no push notifications), recorded in `todz-loop/STATE.md` "Owner requirements queued" → `proactive-day` item 4 (`day-temperature`, idea 6): "the menu bar count shifts tone as the afternoon advances with Today still full, and overdue tasks age visually in the widgets (fade or tint). It stays subtle, uses the template glyph, and reads in light and dark." The behaviour is the loop's call in [ADR 0065](../../adr/0065-the-day-temperature-steps-the-menu-bar-count-s-opacity-after-noon-and-washes-overdue-widget-rows-by-age-behind-a-setting.md).
**ADRs:** [0065](../../adr/0065-the-day-temperature-steps-the-menu-bar-count-s-opacity-after-noon-and-washes-overdue-widget-rows-by-age-behind-a-setting.md), [0054](../../adr/0054-the-app-learns-focus-through-a-todz-focus-filter-not-the-focus-status-api.md), [0036](../../adr/0036-the-menu-bar-icon-counts-today-s-open-tasks-behind-a-setting.md), [0032](../../adr/0032-widgets-read-a-snapshot-in-an-app-group-that-a-team-prefix-replaces-later.md), [0055](../../adr/0055-the-day-closes-once-a-day-in-the-menu-bar-popover-at-the-owner-s-time.md), [0062](../../adr/0062-the-morning-glance-is-a-non-activating-glass-panel-that-shows-today-on-the-first-wake-or-unlock-of-the-day.md)
**Not changing:** the count's text and its 99+ cap, the template glyph's asset, the popover, the main window, the Today list, the server, the widgets' layout and sizes, the day close, the morning glance, the gate's rule (the gate gains no new surface kind for this feature beyond its existing use)

## Problem

The menu bar count says how many tasks are left, but not how far into the day the owner is. Overdue tasks in the widgets look the same on the first day as on the seventh. The owner wants both to carry time, quietly, without a notification and without a colour the template glyph cannot hold.

## Goals

- Settings: a switch "Day temperature", off by default, kept in the app's defaults, next to the other proactive switches.
- With the switch on, the menu bar count's opacity steps down at 12:00, 15:00 and 18:00 in the Mac's time zone, from 1.0 to 0.65. Before 12:00 and at midnight it is plain. The glyph does not change.
- The tone applies only while the menu bar shows a count (open Today tasks above zero). At zero, the icon only.
- With the switch on, an open overdue row in the Today list and the next-up card of the widgets sits on a red wash that deepens with the days overdue: 0.06 for one day, 0.09 for two to six days, 0.12 from seven (0.18 measured 2.78:1 for the red due words in light, so the fallback caps of ADR 0065 Evidence apply). The title keeps its contrast; the existing due label stays.
- During a Focus that holds todz, neither the menu bar nor the widgets show a tone; when the Focus ends the tone returns without a notification.
- Increase Contrast turns the tone off in both places.
- The clock wakes the app only at a step boundary; the widgets need no new timeline entries (the wash changes only with the day).

## Non-goals

- Colour in the menu bar, a tinted glyph, a dot or any extra shape in the menu bar.
- Notifications, badges, Dock changes, sounds or a Focus-time message.
- A per-widget setting, a tone in the popover, the main window or the Inbox or Upcoming.
- A tone that follows the owner's day close time or the share of the day finished.
- A change to the server, the sync, the outbox or the Today rule.
- A widget row that fades its title.

## Design

### Data flow

```
Settings: showsDayTemperature (defaults, off)        gate.isQuiet (ProactiveGate, Focus filter)
   │                                                        │
   ▼                                                        ▼
MenuBarLabel: DayTemperatureStep.step(at: Date(), in: Mac zone), openCount (todayHeadingCount),
              Increase Contrast, gate.isQuiet            → count alpha  (1.0 / 0.85 / 0.75 / 0.65)
   │   DayTemperatureClock (TodzKit, observable): one wait to the next boundary (≤ 4 a day);
   │   refreshed by DayTemperatureScheduler on wake, unlock, time zone, clock and day changes, defaults changes
   │
AppDelegate+DayTemperature: model.showDayTemperature(DayTemperatureTone.isShown(isSettingOn:isQuiet:))
   │   after readFocusFilter() settles, on defaults changes and on gate.isQuiet changes
AppModel: showsDayTemperature (observable) → WidgetSnapshot.of(…showsDayTemperature:)
   │   the existing observation writes once and reloads once per change
   ▼
App Group snapshot (FileWidgetStore)  ──►  TodayTimelineProvider (unchanged: the existing midnight entry)
                                             OverdueWash.opacity(of:on:isShown:isContrastIncreased:) per open overdue row
                                           ──►  TodayListView rows, NextUpView card (wash behind)
```

### Interfaces

- `TodzKit`:
  - `DayTemperatureStep` (enum: `plain`, `noon`, `afternoon`, `evening`): `step(at:in:)` from a date and a Mac zone; `countOpacity` per step; `boundaries(on:in:)` for the clock's next wait; `nextBoundary(after:in:)`.
  - `DayTemperatureStep.countOpacity(step:isSettingOn:isQuiet:isContrastIncreased:openCount:)`: 1.0 unless the setting is on, the gate is not quiet, contrast is not increased, the count is above zero and the step is not plain; the constants at the top of the file.
  - `OverdueWash.opacity(of:on:isShown:isContrastIncreased:)` with a `WidgetSnapshotTask` and a `CalendarDate`: 0 unless the task is open and overdue and both switches allow it; otherwise 0.06 / 0.09 / 0.12 by the bands of `day.days(since: dueDate)`; the constants at the top of the file.
  - `CalendarDate.days(since:)`: the whole calendar days between two dates.
  - `DayTemperatureTone.isShown(isSettingOn:isQuiet:)`: the one composition the app and the snapshot share.
  - `DayTemperatureClock` (`@MainActor @Observable`): `step`, `refresh()`, built as `DayTemperatureClock(now:timeZone:isOn:pause:)`, `.plain` until the first `refresh()`; one pending wait to the next boundary.
  - `DayTemperaturePreference`: `showsDayTemperature` key, default `false`, registration, as `MorningGlancePreference`.
  - `WidgetSnapshot.showsDayTemperature: Bool`: a required key in the Codable shape, carried by `WidgetToggle.setting`.
  - `AppModel.showsDayTemperature` (observable) and `showDayTemperature(_:)`.
- App:
  - `MenuBarLabel` reads the preference through `@AppStorage`, the gate and the clock from the environment and Increase Contrast as the spike decides; applies `countOpacity` to the badge text only, or draws the count into a template image if the spike requires it.
  - `DayTemperatureScheduler` (`apps/macos/Todz/MenuBar`, modelled on `DayCloseScheduler`): calls `clock.refresh()` on wake, unlock, time zone, system clock and calendar day changes and on defaults changes.
  - `AppDelegate+DayTemperature`: calls `model.showDayTemperature(...)` after `readFocusFilter()` settles, on defaults changes and on `gate.isQuiet` changes.
  - `SettingsView`: one switch row with `SettingsCopy` title and detail.
- Widgets:
  - `TodayTimelineProvider` and `TodayEntry` are unchanged: the wash depends only on days overdue, which changes at the existing midnight entry.
  - `TodayListView` and `NextUpView`: the wash behind an overdue row, from `OverdueWash`.

### Failure handling

| Case | Effect |
|---|---|
| the switch is off | plain count; no wait armed; snapshot flag false; no wash |
| the count is zero, or signed out, or no workspace | icon only, as ADR 0036; no wash |
| a Focus that holds todz is on | plain count; `model.showDayTemperature(false)` rewrites the snapshot with the flag false and reloads the widgets; with the switch already off nothing is written |
| the Focus ends | `model.showDayTemperature(true)` brings the tone back; nothing is pushed |
| launch under a Focus | the flag and the clock start only after `readFocusFilter()` settles, so the tone never shows and the snapshot is never written true then false |
| Increase Contrast is on | plain count; no wash; the words stay |
| the Mac sleeps across a boundary | the wait uses the continuous clock and the scheduler refreshes on wake and unlock, so the step is the clock's step at that moment |
| the snapshot is written by an older build without the key | the widget cannot read it and shows its prompt until the app writes the new one at launch; the same while an old running process keeps writing the old shape after the bundle is replaced, until relaunch |
| a snapshot is unreadable | the widget shows its prompt, as today |
| the Mac's time zone changes after launch | the steps follow the new zone at once; the wash follows the snapshot's day until the next write |
| an overdue task is completed during the day | its wash goes at the next snapshot write |
| a row's title is longer than the row | one line, tail-truncated, as today; the wash behind it is unchanged |

### Siblings

`feat/morning-glance` and `feat/day-close` (merged) already touch `AppModel+Widgets` and the Settings view. This feature adds one key to the Settings view and one flag to the snapshot writer; it does not reshape either. `feat/performance` changes how `taskViews` is stored; the count reads `todayHeadingCount`, which does not change.

### Rollback

Revert the app and widget commits. The preference key stays unread in the defaults. An older build ignores the extra snapshot key, so no migration is needed.

## Open questions → answers

| Question | Options | Owner's answer | Date |
|----------|---------|----------------|------|
| What shifts the count: colour, weight, opacity, a shape? | colour in a non-template variant; weight; opacity; a dot | the loop's call: opacity only, the template glyph untouched (ADR 0065 §3) | 2026-11-25 |
| What curve? | a ramp by minute; the owner's day close; fixed steps from noon | the loop's call: fixed steps at 12:00, 15:00, 18:00 in the Mac's zone (§2) | 2026-11-25 |
| What is "Today still full"? | above zero; a share still open; a count against the morning | the loop's call: above zero (§4) | 2026-11-25 |
| How do overdue tasks age? | fade the row; fade the title; a wash; a leading bar | the loop's call: a red wash by days overdue, the title at full contrast (§5) | 2026-11-25 |
| Does a Focus silence it? | yes in both places; menu bar only; neither | the loop's call: yes in both, through the gate and the snapshot (§6) | 2026-11-25 |
| Where is the switch? | Settings; per-widget; the popover | the loop's call: one Settings switch, as the other proactive switches (§7) | 2026-11-25 |
| Does the tone follow Increase Contrast? | tone on; tone off; a stronger tone | the loop's call: tone off, the count and words unchanged (§9) | 2026-11-25 |
| Does the widget lane get a unit test target? | add `TodzWidgetsTests`; keep the logic in TodzKit | open for the build: the default is the logic in TodzKit and no new target; the owner may ask for a widget target | — |

## Test strategy summary

Swift tests in `TodzKit` for the step at every boundary and around midnight, the opacity by step, tone off at zero and for each of the switch, Focus and Increase Contrast alone; the next boundary across DST, a zone change and a zone that skips midnight; `CalendarDate.days(since:)`; the clock with a held pause; the preference's default and key; the snapshot's required key (a missing key fails to decode, a round trip keeps the flag); the wash bands and the cap; and the routes the model produces when `showDayTemperature` changes. The widget lane is proven by a build and the walk in three rendering modes. Screenshots of each step in light and dark are taken from a scratch render of the label, not committed. The walk keeps to the menu bar and one Settings window: no popover opening. Test plan: [test-plan.md](test-plan.md).
