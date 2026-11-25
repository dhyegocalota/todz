# Menu bar ribbon

**Status:** Approved
**Tier:** 🟡 (one Settings row with two app-local keys, a pure timeline, a coordinator over the proactive gate, a change counter on the pulls, and frames in the status item; no server, no schema, no widget change, no new entitlement)
**Owner approval:** approved 2026-11-25 by the owner's request to the loop (2026-11-24, ~20:30: "1,4,5,6,7,9,10 e também 11 … seja criativo, add no cron e só para quando tiver pronto"; every item "features opcionais", off by default, no push notifications), recorded in `todz-loop/STATE.md` "Owner requirements queued" → `proactive-day` item 8 (`menu-bar-ribbon`, idea 11, his own idea: "de tempos em tempos o menu bar pode mostrar algo discreto como se fosse uma faixa expandida ou sei lá; seja criativo"): "now and then, the status item briefly widens into a quiet ribbon beside the glyph: the next task's title, or '3 left · next: T-12 Review PR'; it scrolls once in a marquee if long, then collapses back to the glyph and the count after a few seconds; the cadence is the owner's choice (hourly, at day-close, or when an agent adds or completes a task), and the ribbon never shows during Focus; be creative but Apple-quiet: a frontend-designer pass with options (a ribbon, a progress sliver under the glyph, a one-line ticker), and the loop picks; it stays a template look and reads on light and dark bars." The picks and the default are the loop's call in [ADR 0071](../../adr/0071-the-menu-bar-ribbon-unfolds-what-is-next-beside-the-glyph-for-a-few-seconds-as-template-frames-behind-a-setting-off-by-default.md); the options are in [design.md](design.md).
**ADRs:** [0071](../../adr/0071-the-menu-bar-ribbon-unfolds-what-is-next-beside-the-glyph-for-a-few-seconds-as-template-frames-behind-a-setting-off-by-default.md), [0065](../../adr/0065-the-day-temperature-steps-the-menu-bar-count-s-opacity-after-noon-and-washes-overdue-widget-rows-by-age-behind-a-setting.md), [0054](../../adr/0054-the-app-learns-focus-through-a-todz-focus-filter-not-the-focus-status-api.md), [0055](../../adr/0055-the-day-closes-once-a-day-in-the-menu-bar-popover-at-the-owner-s-time.md), [0036](../../adr/0036-the-menu-bar-icon-counts-today-s-open-tasks-behind-a-setting.md), [0031](../../adr/0031-the-menu-bar-extra-is-a-swiftui-window-over-the-app-s-one-model.md), [0061](../../adr/0061-performance-has-written-budgets-a-fetch-based-load-harness-behind-pnpm-perf-and-work-count-budgets-in-verify.md)
**Not changing:** the glyph's asset, the count's text and its 99+ cap, the day temperature's steps, the popover, the main window, the widgets and their snapshot, the server, the sync and the outbox, the Today rule, the gate's rule and its surface kinds (`.ribbon` already exists), the day close and the morning glance

## Problem

The count says how many tasks are left, never which one is next, and the owner only learns what an agent did to Today when he opens the popover. He wants the menu bar itself to say it, briefly and now and then, without a notification.

## Goals

- Settings: a row "Menu bar ribbon" with a switch, **off by default**, and a cadence picker ("Every hour", default; "At the close of the day"; "When an agent adds or completes a task"), kept in the app's defaults.
- With the switch on, at its cadence, the status item unfolds beside the glyph into one line, "3 left · next: T-12 Review PR" ("Last one: T-12 Review PR" with one left), holds for a few seconds, scrolls once if the line is longer than the ribbon, and folds back to the glyph and the count. The longest ribbon lasts 9.5 s.
- A template look: the system tints it on light, dark and tinted bars; no colour of its own.
- Never at zero, while the count is unknown, while the screen is locked, while the popover is shown, or while the proactive gate is quiet; a cadence held by the gate shows once when it releases.
- Reduce Motion: no unfolding, no scroll, no folding; the line is tail-truncated.
- VoiceOver reads the ribbon line while it shows.

## Non-goals

- Notifications, sounds, badges, Dock changes, a colour or a brand mark in the menu bar.
- Several cadences at once, a custom interval, or a per-workspace ribbon.
- A line that names the agent, or any server change to record who completed a task.
- A ribbon in the popover, the main window or the widgets.
- A new status item, a panel under the bar, or replacing the `MenuBarExtra` (ADR 0031).
- Its own Focus switch or Focus copy: Focus is the gate's, and `focus-switch-defaults` owns its one switch.

## Design

### Data flow

```
cadence boundary (hour, close of day) ─┐
pull applies an agent change to Today ─┼─▶ RibbonCoordinator ─▶ gate.admit(.ribbon) ─▶ RibbonMotion.timeline ─▶ presentation (frame by frame)
gate releases .ribbon ─────────────────┘        │                                                                   │
                                                └─ skips: off, zero, locked, popover, showing, Close the day on     ▼
                                                                                             MenuBarLabel ─▶ MenuBarRibbonImage (template crop)
```

1. **Boundaries.** `RibbonCoordinator.refresh()` arms one wait on the continuous clock to the next boundary of the cadence (`RibbonSchedule`): the next hour in the Mac's time zone, or the next close-of-day time from `DayClosePreference`; nothing for the agent cadence. The app's `RibbonScheduler` calls `refresh()` on wake, unlock, time zone, system clock, calendar day and defaults changes, as `DayTemperatureScheduler` does. A boundary missed asleep is not replayed.
2. **Agent changes.** `AppModel.record(_:)` compares each task a pull applies with the task the board held before (`RibbonTrigger.isAgentChange(previous:arrived:today:)`): an agent-created task that is open and due today or earlier, new to the board; or a task open and due today or earlier that arrives done. A pull with at least one bumps the observable `agentChangeCount` once. Only a pull of a project already pulled before and not from the start counts. The scheduler forwards each bump to `agentChanged()`, which waits 3 s for the burst to settle and shows if the last agent ribbon is 10 minutes old or more; inside the window it drops the change.
3. **Show.** `show()` reads the switch, the cadence, the screen lock, the popover, whether a ribbon is showing, and the line (`RibbonContent.of(open:)` over the first open task of Today and the open count, nil at zero or unknown). It then asks `gate.admit(.ribbon)`. On `.show` it measures the line's width once (an injected closure, the app's font metrics), builds the timeline (`RibbonMotion.timeline(textWidth:isMotionReduced:)`) and steps the observable `presentation` through its frames with the injected `pause`, ending with `nil`. On `.held` it waits for `claimRelease(.ribbon)` and then runs `show()` again with the line of that moment.
4. **Draw.** `MenuBarLabel` draws `MenuBarRibbonLabel` while `presentation` is set, otherwise the count as today. `MenuBarRibbonImage` renders the glyph and the line once per presentation's content, at most 420 points wide with a tail ellipsis, as a template `NSImage`, and crops each frame (visible width = reveal × min(text width, 180); offset into the strip; text alpha = reveal). The accessibility label is the ribbon line while it shows.
5. **End early.** The popover becoming visible, the switch turning off, or `gate.isQuiet` turning true calls `end()`: `presentation` becomes `nil` at once and the running timeline is cancelled.

### Interfaces

TodzKit (`apps/macos/TodzKit/Sources/TodzKit/`):

- `RibbonCadence: String, CaseIterable, Sendable` — `hourly`, `dayClose`, `agentChange`.
- `RibbonPreference` — `isOnStorageKey = "showsMenuBarRibbon"`, `cadenceStorageKey = "menuBarRibbonCadence"`, `isOnByDefault = false`, `cadenceByDefault = .hourly`, `init(defaults:domainName:)`, `registerDefaults(in:)`, `pickerCadence(stored:) -> RibbonCadence` (the default for an unknown stored value, for the picker only), `isOn: Bool`, `cadence: RibbonCadence?` (nil for an unknown stored value).
- `RibbonTask: Equatable, Sendable` — `number: Int?`, `title: String`.
- `RibbonContent: Equatable, Sendable` — `.remaining(left: Int, next: RibbonTask)`, `.last(RibbonTask)`; `static func of(open: [BoardTask]?) -> RibbonContent?`.
- `RibbonSchedule` — `static func nextShowing(after: Date, cadence: RibbonCadence, closeMinutesAfterMidnight: Int?, timeZone: TimeZone) -> Date?`.
- `RibbonFrame: Equatable, Sendable` — `reveal: Double` (0…1), `offset: Double` (points into the strip), `duration: Duration`.
- `RibbonMotion` — the ADR 0071 §4 constants (`windowWidth` 180, `stripMaxWidth` 420, `framesPerSecond` 30, `foldDuration` 0.25 s, `dwell` 5 s, `edgeHold` 1.5 s, `scrollSpeed` 40) and `static func timeline(textWidth: Double, isMotionReduced: Bool) -> [RibbonFrame]`.
- `RibbonPresentation: Equatable, Sendable` — `content: RibbonContent`, `frame: RibbonFrame`, `textWidth: Double`.
- `RibbonTrigger` — `static func isAgentChange(previous: TaskRecord?, arrived: TaskRecord, today: CalendarDate) -> Bool`.
- `RibbonCoordinator` (`@MainActor @Observable`) — `presentation: RibbonPresentation?`, `init(gate:preference:isDayCloseOn:timeZone:now:pause:content:isScreenLocked:isPopoverVisible:isMotionReduced:textWidth:)`, `refresh()`, `agentChanged()`, `end()`; the `agentSettle` (3 s) and `agentCooldown` (10 minutes) constants.
- `AppModel` — `agentChangeCount: Int` (`public internal(set)`), `ribbonContent: RibbonContent?` (`AppModel+Ribbon.swift`, nil whenever `todayHeadingCount` is nil).
- `DayClosePreference.isOn` becomes `public`, so the coordinator's `isDayCloseOn` reads it.

App (`apps/macos/`): `Todz/MenuBar/MenuBarRibbonImage.swift`, `Todz/MenuBar/MenuBarRibbonLabel.swift`, `Todz/MenuBar/RibbonScheduler.swift`, `Todz/AppDelegate+Ribbon.swift`, the label's branch in `MenuBarLabel.swift`, the coordinator in `AppDelegate.swift` and the environment in `TodzApp.swift`, the row in `SettingsView.swift`, the strings in `Copy/MenuBarCopy.swift`, `Copy/AccessibilityCopy.swift` and `Copy/SettingsCopy.swift`.

### Failure handling

| Case | Behaviour |
|---|---|
| A stored cadence the app does not know | `cadence` is nil, no ribbon; the picker shows "Every hour" until the owner picks |
| The count is unknown or zero when a boundary fires | no ribbon; the next boundary is armed |
| The popover is shown, the screen is locked, a ribbon is showing | skipped, not held; the next boundary is armed |
| The gate is quiet when a boundary fires | held; shown once on release, with the line of that moment, if nothing else skips it then |
| The gate turns quiet, the switch turns off or the popover opens mid-ribbon | the ribbon ends at once, no fold |
| "At the close of the day" while Close the day is on | skipped every day; Settings says so on the row |
| A burst of agent changes | one ribbon 3 s after the last of the burst; others in the next 10 minutes dropped |
| A completion from the owner's other Mac | counts as an agent change (a task record carries no completer); accepted, ADR 0071 Consequences |
| The widened item does not fit a crowded notched bar | macOS hides it while it is wide; it returns at rest; accepted, ADR 0071 Consequences |
| The spike shows frames do not land at 20 per second or tear | the Reduce Motion presentation becomes the only one (ADR 0071 §8) |
| The spike shows the 180-point item leaves the screen | the window becomes 120 points (ADR 0071 §8) |
| The workspace changes mid-ribbon | the line stays the one it started with until it folds (at most 9.5 s) |

### The overlap with `focus-switch-defaults`

That feature, planned beside this one, replaces per-feature Focus copy with one "Respect Focus" switch (off by default) that decides whether `ProactiveGate` goes quiet. This feature reads only the gate (`admit`, `claimRelease`, `isQuiet`), so it needs no change when that lands: with Respect Focus off the gate never goes quiet and the ribbon shows during a Focus, which is the owner's newer call. The two branches both add rows to `SettingsView.swift` and strings to `SettingsCopy.swift`; whichever merges second takes both. The ribbon's detail line never mentions Focus, so it needs no edit there. `feat/day-email` also adds a Settings row, and `feat/siri-shortcuts` also edits `AppDelegate.swift`; the ribbon's AppDelegate change is two properties and one start call, the rest lives in `AppDelegate+Ribbon.swift`.

## Open questions → answers

| Question | Options | Owner's answer | Date |
|----------|---------|----------------|------|
| Which shape? | ribbon, progress sliver, one-line ticker | the loop's pick, delegated: the ribbon (design.md §7) | 2026-11-25 |
| On or off by default? | off (standing rule), on (newest defaults) | the loop's call: off; the newest defaults list does not name it (ADR 0071 §1) | 2026-11-25 |
| One cadence or several? | a picker, three switches | the loop's call: one picker, every hour by default | 2026-11-25 |
| How are agent bursts kept quiet? | settle and cool down, queue, every change | the loop's call: settle 3 s, at most once in 10 minutes, drop inside | 2026-11-25 |
| What if the frames do not land? | drop the motion, a native status item | decided now: drop the motion for everyone (ADR 0071 §8) | 2026-11-25 |

## Test strategy summary

Red-first unit tests in TodzKit for the preference, the line, the schedule (including DST and zone changes), the timeline (fit, overflow, the cap, Reduce Motion, the 9.5 s bound), the agent trigger, the model's counter over real pulls through the test harness, and the coordinator through `HeldPause` (every skip, the hold and release, the early end, the settle and the cooldown). The app's drawing is proven by scratch renders of `MenuBarRibbonImage` on light and dark bars (frames at each phase, widths measured), and the live item by at most three short ribbons on the owner's Mac, read with `screencapture -l`, never with the popover or Settings opened more than once. See [test-plan.md](test-plan.md).
