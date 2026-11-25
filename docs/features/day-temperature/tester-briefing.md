# Tester briefing: Day temperature

Written by the developer sub-agents when their steps are done, each in its own section: G1 (TodzKit and the app) and G2 (the widgets). The developers do not run `test-plan.md` and do not declare the feature works.

## G1

### What changed

Spike evidence `c666bca` (ADR 0065 Evidence, plan step 1, design §1.1). Everything below is on `lane/day-temperature-g1`.

TodzKit (`apps/macos/TodzKit/Sources/TodzKit`):

- `DayTemperatureStep.swift` — `step(at:in:)`, `countOpacity(step:isSettingOn:isQuiet:isContrastIncreased:openCount:)`, `boundaries(on:in:)`, `nextBoundary(after:in:)`; the hours 12, 15, 18 and the opacities 1.0, 0.85, 0.75, 0.65 are constants at the top.
- `OverdueWash.swift` — `opacity(of:on:isShown:isContrastIncreased:)`. **The bands are 0.06 (one day), 0.09 (two to six) and 0.12 (seven and more), not the 0.06, 0.12, 0.18 of the spec**: the spike measured the red due words at 2.78:1 in light at 0.18, so the decided fallback of ADR 0065 §5 applies (the numbers are in the ADR Evidence).
- `CalendarDate.swift` — `days(since:)` on the Gregorian GMT calendar.
- `DayTemperaturePreference.swift` — key `showsDayTemperature`, off by default, `isOn` public.
- `DayTemperatureTone.swift` — `isShown(isSettingOn:isQuiet:)`.
- `DayTemperatureClock.swift` — `@MainActor @Observable`, `step`, `refresh()`, one pending wait to the next boundary through the injected `pause`, off when the injected `isOn` says so.
- `WidgetSnapshot.swift` — required key `showsDayTemperature` (no default on decode, wire name `shows_day_temperature`); `WidgetSnapshot.of(...)` takes it; `WidgetToggle.swift` carries it.
- `AppModel.swift`, `AppModel+DayTemperature.swift`, `AppModel+Widgets.swift` — `showsDayTemperature` (observable) and `showDayTemperature(_:)`; `readyWidgetSnapshot` passes the flag, so the existing observation writes and reloads once per change.

App (`apps/macos/Todz`, `apps/macos/Copy`):

- `AppDelegate+DayTemperature.swift` and two stored properties and two lines in `AppDelegate.swift` — after `readFocusFilter()` settles the flag is set from the preference and `gate.isQuiet`, then again on `UserDefaults.didChangeNotification` and on every `gate.isQuiet` change.
- `MenuBar/DayTemperatureScheduler.swift` — refreshes the clock on wake, unlock, time zone, system clock, calendar day and defaults changes; started after `readFocusFilter()`.
- `MenuBar/MenuBarCountImage.swift` and `MenuBar/MenuBarLabel.swift` — **the status item drops both `.opacity` and `.foregroundStyle(.primary.opacity)`** (spike), so with the setting on and a count showing, the label draws the glyph and the count with `ImageRenderer` into one template `NSImage` with the count at the step's opacity; with the setting off the label is the plain `HStack` as before. Increase Contrast is read from `NSWorkspace.shared.accessibilityDisplayShouldIncreaseContrast` and `NSWorkspace.accessibilityDisplayOptionsDidChangeNotification`, not from `colorSchemeContrast`.
- `TodzApp.swift` — registers the preference default and puts the gate and the clock in the label's environment.
- `Settings/SettingsView.swift`, `Copy/SettingsCopy.swift` — the switch row under "Morning glance", with option B's detail.
- `TodzWidgets/TodayEntry+Sample.swift` — the one G1 line, `showsDayTemperature: false`.

### How to run

```bash
swift test --package-path apps/macos/TodzKit
swift test --package-path apps/macos/TodzKit --filter DayTemperatureStepTests
cd apps/macos && xcodegen generate && xcodebuild -project Todz.xcodeproj -scheme Todz -configuration Debug build
```

Final count on `276db99`: 1023 tests in 80 suites passed (976 before the lane). The Debug `xcodebuild` build of the `Todz` scheme (app and widget extension) succeeded; the app was not launched.

### Red today, green after

A stub's `fatalError` kills the test process, so each red run stops at the first stub it reaches; each suite was run alone with `--filter`. Printed at the red commits:

| Test | Red before the change because (printed) | Green after because |
|------|------------------------------------------|----------------------|
| `DayTemperatureStepTests` step cases (`cd11bba`) | `TodzKit/DayTemperatureStep.swift:10: Fatal error: DayTemperatureStep.step is not implemented` | `d82d8e0`: the hour picks the last step started |
| `DayTemperatureStepTests` count opacity (`4d4b816`) | `TodzKit/DayTemperatureStep.swift:32: Fatal error: DayTemperatureStep.countOpacity is not implemented` | `bfdf336` |
| `CalendarDateTests` days since (`4d4b816`) | `TodzKit/CalendarDate.swift:76: Fatal error: CalendarDate.days is not implemented` | `bfdf336` |
| `OverdueWashTests` (`4d4b816`) | `TodzKit/OverdueWash.swift:3: Fatal error: OverdueWash.opacity is not implemented` | `bfdf336` |
| `DayTemperatureStepTests+Boundaries` (`cc671ff`) | `TodzKit/DayTemperatureStep.swift:30: Fatal error: DayTemperatureStep.boundaries is not implemented`; the single case `theNextBoundaryIsTheFirstOneAfterTheInstant` printed `TodzKit/DayTemperatureStep.swift:34: Fatal error: DayTemperatureStep.nextBoundary is not implemented` | `52065c0` |
| `DayTemperaturePreferenceTests` (`2d73b3b`) | `TodzKit/DayTemperaturePreference.swift:18: Fatal error: DayTemperaturePreference.isOn is not implemented` | `562862d` |
| `WidgetSnapshotTests/missingKeyFailsToDecode` (`5baa2d6`, key spelling fixed in `f51a813`) | `Expectation failed: an error was expected but none was thrown and "WidgetSnapshot(workspaceName: "Acme", day: TodzKit.CalendarDate(year: 2026, month: 11, day: 24), …, doneToday: [])" was returned` | `68ec2a4`: `showsDayTemperature` is a required key |
| `DayTemperatureToneTests` (`60c2484`) | `TodzKit/DayTemperatureTone.swift:3: Fatal error: DayTemperatureTone.isShown is not implemented` | `6b9b570` |
| `AppModelTests+Widgets` three `…DayTemperature…` cases (`60c2484`) | `TodzKit/AppModel+DayTemperature.swift:3: Fatal error: AppModel.showDayTemperature is not implemented` | `6b9b570` |
| `DayTemperatureClockTests` (`4e91890`) | `TodzKit/DayTemperatureClock.swift:25: Fatal error: DayTemperatureClock.refresh is not implemented` | `c703b08` |

Red inside a green commit (`68ec2a4`, as the plan allows): `WidgetToggleTests/togglingARowOfASnapshotThatShowsTheDayTemperatureKeepsItShown` printed `Expectation failed: toggled.snapshot.showsDayTemperature` against a toggle that wrote `false`, then went green when the toggle carried `snapshot.showsDayTemperature`.

Pins (green on landing): `WidgetSnapshotTests/flagRoundTrips` (`68ec2a4`). `DayTemperaturePreferenceTests/theStorageKeyIsShowsDayTemperature` only reads a constant and so ran green beside its suite.

`5baa2d6` removed the key as `showsDayTemperature`, but the owner coding spells it `shows_day_temperature`, so the case would have stayed red after the green; `f51a813` fixes the spelling and is red for the same printed reason.

### Hypotheses for the tester

- With the switch on, a count above zero, no Focus and no Increase Contrast, the menu bar count is drawn at 1.0 before 12:00, 0.85 from 12:00, 0.75 from 15:00, 0.65 from 18:00 and 1.0 from midnight, in the Mac's zone; the glyph and the item's width do not change between steps.
- With the switch off the label is the same view as before this lane (the plain `HStack`); nothing waits and `widget-snapshot.json` has `shows_day_temperature` false.
- A Focus that holds todz turns the count plain and rewrites the snapshot once with the flag false; when it ends the tone comes back; with the switch already off nothing is written.
- Increase Contrast toggled in System Settings turns the tone off and back on without a relaunch.
- The wash bands are 0.06, 0.09 and 0.12 by days overdue and a done or not-overdue task has none (unit-pinned; the widgets draw it in G2).
- An old snapshot without the key reads as the widget prompt until the app writes the new one at launch.
- Turning the switch on writes one snapshot and reloads the widgets once.

### Gaps I know about

- The views have no unit target (spec): `MenuBarLabel`, `MenuBarCountImage`, `DayTemperatureScheduler`, `AppDelegate+DayTemperature` and the Settings row are proved by the build only. I did not launch the app, so the template image's size, vertical alignment and width against the plain `HStack`, and the tint on a light or tinted bar, are unseen for the real glyph asset (the spike used a system symbol).
- With the switch on and a count showing, the label always takes the image path, including at the plain step; only the switch off or no count takes the `HStack` path, so no step change swaps paths.
- The spike did not toggle Increase Contrast or switch the system to light (both repaint the owner's screen); the light-bar numbers are the same capture composited in linear light, and the wash contrast was computed, not read in Accessibility Inspector.
- `DayTemperatureClock.refresh()` also runs on every `UserDefaults.didChangeNotification` (as `DayCloseScheduler` does), cancelling and re-arming its single wait each time.
- `UserDefaults.didChangeNotification` and `gate.isQuiet` both call `showDayTemperature` after `readFocusFilter()`; before the filter read settles the flag stays false.
