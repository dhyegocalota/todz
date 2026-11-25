# Test plan: Day temperature

Every checkbox states the input and the exact expected outcome. A ticked box carries evidence after ` — evidence: ` (commit hash, log path, counts, screenshot path).

The surface is native macOS: there is no browser surface, so there is no Playwright E2E spec. The user-facing walk is run with Orca (`orca computer …`) and Accessibility Inspector, not Playwright MCP. Walks keep the popover closed and open the Settings window once; the menu bar item is read, not clicked. Every step that needs 12:00, 15:00 or 18:00 is proven by the scratch render and the unit tests, not by waiting.

## The failing test first

- [ ] `apps/macos/TodzKit/Tests/TodzKitTests/DayTemperatureStepTests.swift::stepsAtEachBoundary` — input: `2026-11-25T11:59:59` then `12:00:00`, `14:59:59`, `15:00:00`, `17:59:59`, `18:00:00`, `23:59:59`, `2026-11-26T00:00:00`, all in `America/Sao_Paulo`; expected: `plain`, `noon`, `noon`, `afternoon`, `afternoon`, `evening`, `evening`, `plain`
- [ ] Confirmed it fails for the right reason: the suite run alone with `--filter` stops on `DayTemperatureStep.step is not implemented`, not a compile error in the test; the same for each red step's own text (steps 4, 6, 8, 12 and 14, and the `#expect(throws:)` of step 10) — evidence: (to be recorded by the developer)

## Unit (TodzKit)

- [ ] `DayTemperatureStepTests::stepReadsTheZonePassedIn` — input: the instant 15:00 in `Europe/Lisbon`, zone passed `Europe/Lisbon`; the same instant with zone passed `America/Sao_Paulo` (12:00 there); expected: `afternoon` for Lisbon and `noon` for Sao Paulo; the function reads its argument, never the process zone
- [ ] `DayTemperatureStepTests::countOpacityPlainWhenSettingOff` — input: `step: evening, isSettingOn: false, isQuiet: false, isContrastIncreased: false, openCount: 6`; expected: `1.0`
- [ ] `DayTemperatureStepTests::countOpacityPlainWhileQuiet` — input: the same with `isSettingOn: true, isQuiet: true`; expected: `1.0`
- [ ] `DayTemperatureStepTests::countOpacityPlainWhenContrastIncreased` — input: the same with `isQuiet: false, isContrastIncreased: true`; expected: `1.0`
- [ ] `DayTemperatureStepTests::countOpacityPlainAtZero` — input: `step: evening`, all switches allowing, `openCount: 0`; expected: `1.0`
- [ ] `DayTemperatureStepTests::countOpacityPlainWhenCountUnknown` — input: `step: evening`, all switches allowing, `openCount: nil`; expected: `1.0`
- [ ] `DayTemperatureStepTests::countOpacityNoonStep` — input: `step: noon`, all switches allowing, `openCount: 1`; expected: `0.85`
- [ ] `DayTemperatureStepTests::countOpacityAfternoonStep` — input: `step: afternoon`, all switches allowing, `openCount: 6`; expected: `0.75`
- [ ] `DayTemperatureStepTests::countOpacityEveningStep` — input: `step: evening`, all switches allowing, `openCount: 120`; expected: `0.65`, and the menu bar text reads `99+` (ADR 0036 cap, unchanged)
- [ ] Edge: a negative count — input: `openCount: -1`, all switches allowing; expected: `1.0` (no tone; `MenuBarBadge` already refuses it, the tone agrees)
- [ ] `DayTemperatureStepTests::boundariesOfADay` — input: `boundaries(on: 2026-11-25, in: America/Sao_Paulo)`; expected: `[12:00, 15:00, 18:00, 00:00 of 2026-11-26]` as instants in that zone, in order
- [ ] `DayTemperatureStepTests::nextBoundaryFromMorning` — input: `nextBoundary(after: 11:30)`; expected: 12:00 the same day
- [ ] `DayTemperatureStepTests::nextBoundaryAtExactBoundary` — input: `nextBoundary(after: 12:00:00)`; expected: 15:00:00, not 12:00:00 again
- [ ] `DayTemperatureStepTests::nextBoundaryLateEvening` — input: `nextBoundary(after: 18:00:00)` then `nextBoundary(after: 23:59:59)`; expected: `00:00` of the next day for both
- [ ] Edge: spring-forward DST in `America/New_York` on 2026-03-08 — input: `nextBoundary(after: 01:30)`; expected: 12:00 the same day (the 02:00 jump is not a boundary); and `boundariesOfADay` for that date still returns 12:00, 15:00, 18:00, midnight in New York
- [ ] Edge: fall-back DST in `America/New_York` on 2026-11-01 — input: `boundaries(on: 2026-11-01, in: America/New_York)`; expected: the 15:00 boundary appears exactly once; the list has four entries
- [ ] Edge: a zone change — input: the instant 2026-11-25T16:00:00Z; `nextBoundary` in `America/Sao_Paulo` (13:00 local); expected: 2026-11-25T18:00:00Z; in `Europe/Berlin` (17:00 local); expected: 2026-11-25T17:00:00Z; the test asserts the instants, not the local text
- [ ] Edge: a zone that skips midnight — input: `America/Santiago` on 2026-09-06 (00:00 to 01:00): `nextBoundary(after: 2026-09-05 23:00 local)`; expected: 2026-09-06 01:00 local (`startOfDay`); and `boundaries(on: 2026-09-05)` ends at that instant, never nil and never a crash
- [ ] `CalendarDateTests+Days::daysSince` — input: same day; 2026-11-24 to 2026-11-25; across the New York spring-forward day and the fall-back day; across a year; expected: 0, 1, 1 and 1, 365
- [ ] `DayTemperaturePreferenceTests::defaultsOff` — input: a fresh defaults domain, `registerDefaults`; expected: `isOn == false`
- [ ] `DayTemperaturePreferenceTests::keyIsShowsDayTemperature` — input: `DayTemperaturePreference.isOnStorageKey`; expected: `"showsDayTemperature"`
- [ ] `DayTemperaturePreferenceTests::survivesRelaunch` — input: set true in one `PersistentDomain`, read in a new one with the same name; expected: `isOn == true`
- [ ] `WidgetSnapshotTests::missingKeyFailsToDecode` — input: a snapshot JSON without `showsDayTemperature`; expected: decode throws (no default); the error names the key
- [ ] `WidgetSnapshotTests::flagRoundTrips` — input: a snapshot with `showsDayTemperature: true`, encode then decode; expected: `true`, every other field unchanged
- [ ] Edge: an unknown extra key — input: a snapshot JSON with a future key `"tone": "x"` plus the required key; expected: decodes; the extra key is ignored (the rollback path)
- [ ] `OverdueWashTests::doneRowNeverWashes` — input: a done task due 2026-11-16, day 2026-11-25, switches allowing; expected: `0`
- [ ] `OverdueWashTests::notOverdueNeverWashes` — input: an open task with `isOverdue: false`; expected: `0`
- [ ] `OverdueWashTests::noDueDateNeverWashes` — input: an open task with no due date; expected: `0`
- [ ] `OverdueWashTests::offSwitchesNeverWash` — input: an open overdue task with `isShown: false`, then with `isContrastIncreased: true`; expected: `0` for each alone
- [ ] `OverdueWashTests::oneDayBand` — input: due 2026-11-24, day 2026-11-25; expected: `0.06`
- [ ] `OverdueWashTests::lateBandStart` — input: 2 days; expected: `0.12`
- [ ] `OverdueWashTests::lateBandEnd` — input: 6 days; expected: `0.12`
- [ ] `OverdueWashTests::longBandStart` — input: 7 days; expected: `0.18`
- [ ] Edge: the cap — input: 30 and 365 days; expected: `0.18` for both; no value above `0.18` for any input in `1...400`
- [ ] `DayTemperatureClockTests::refreshWaitsForTheNextBoundary` — input: injected `now` 11:30 and the `HeldPause`, switch on, `refresh()`; expected: `step == .plain`, one wait until 12:00
- [ ] `DayTemperatureClockTests::releaseAtNoonSetsNoonAndWaitsForAfternoon` — input: release the pause at 12:00; expected: `step == .noon`, one wait until 15:00
- [ ] `DayTemperatureClockTests::releaseAtEveningWaitsForTheNextDay` — input: release at 18:00; expected: `step == .evening`, one wait until the next day's start
- [ ] `DayTemperatureClockTests::refreshDuringAWaitCancelsTheEarlierWait` — input: `refresh()` twice; expected: one pending wait
- [ ] `DayTemperatureClockTests::offWaitsForNothing` — input: switch off; expected: `step == .plain`, no wait
- [ ] `DayTemperatureToneTests::isShownOnlyWithSettingOnAndNotQuiet` — input: the four combinations; expected: true only for setting on and not quiet
- [ ] `AppModelTests+Widgets::turning the day temperature on writes the snapshot with the flag and reloads once` — input: `model.showDayTemperature(true)` from off; expected: `harness.widgets.routes()` is `[.writeSnapshot, .reload]` and the snapshot's flag is true
- [ ] `AppModelTests+Widgets::showing the day temperature twice writes nothing the second time` — input: `showDayTemperature(true)` twice; expected: no second route
- [ ] `AppModelTests+Widgets::turning the day temperature off writes the snapshot with the flag false` — input: `showDayTemperature(false)` from on; expected: a write and a reload, flag false
- [ ] `WidgetToggleTests::toggling a row keeps the day temperature flag` — input: a snapshot with `showsDayTemperature: true`, one row toggled; expected: the changed snapshot's flag is `true`
- [ ] Edge: the snapshot writer is called with no workspace — input: signed out; expected: the existing behaviour (no snapshot written, as today); the flag is not written partially
- [ ] `MenuBarLabel` pin: the label's accessibility label is `AccessibilityCopy.menuBarCount` unchanged — input: count 6, tone on, evening; expected: "todz, 6 left today" (ADR 0036), a pin

## Unit (widgets, through the TodzKit API)

- [ ] `WidgetContentTests::snapshotOfAnotherDayIsThePrompt` — input: `WidgetContent.of(snapshot dated 2026-11-25, on: 2026-11-26)`; expected: `.prompt`; and `OverdueWash.opacity(of: due 2026-11-16, on: 2026-11-26)` with the switches allowing is `0.18`
- Struck: the widget entries at the boundaries and the entry's step (R5: the widgets draw no step; the existing midnight entry is unchanged).

## Build

- [ ] `pnpm verify` class `product` for the macOS paths — input: the branch; expected: the gate passes; the Swift test run for TodzKit reports the count of new tests as the red-first count plus the green ones; evidence: (developer records the log path)
- [ ] `xcodebuild` of the `Todz` scheme and the `TodzWidgets` extension — input: the branch at the end of step 19; expected: both BUILD SUCCEEDED, no new warnings in the touched files

## Walk (Orca, native, not Playwright MCP)

Each walk line uses `orca computer` per the global computer-use rule. Reading is free; the walk changes only the switch it names. Popover: never opened. Openings: the Settings window once, the menu bar read at each state.

- [ ] Happy path, switch off to on: Settings → Day temperature switch on; expected: the count is plain until the next boundary; the switch's detail reads option B; screenshot `.pr-media/day-temperature/walk/settings-on.png`
- [ ] Noon step (scratch render, light bar): input: the render at 12:00 with 6 open; expected: count opacity 0.85; the glyph pixels identical to plain — evidence: (path)
- [ ] Afternoon step (scratch render, light bar): input: 15:00 with 6 open; expected: 0.75, glyph identical — evidence: (path)
- [ ] Evening step (scratch render, light bar): input: 18:00 with 6 open; expected: 0.65, glyph identical — evidence: (path)
- [ ] Noon, afternoon, evening on the dark bar: input: the same three; expected: the same opacities, the glyph still reads (pixel contrast of the glyph to the bar above the threshold chosen in the spike) — evidence: (path)
- [ ] Tinted or transparent bar at evening: input: the owner's wallpaper bar, evening, 6 open; expected: the count is visible and dimmer; the glyph and count both read — evidence: `.pr-media/day-temperature/walk/tinted-evening.png`
- [ ] Width stays put across steps: input: the item's frame at plain, noon, afternoon, evening; expected: the same width at all four; evidence: (frame values)
- [ ] Zero count, evening: input: a 18:00 render with the count at zero (the walk does not complete or move any of the owner's tasks; the render supplies the zero); expected: icon only, no count, no tone
- [ ] Live, shipped label: input: at the walk's real clock time (after 12:00 on the walk day), the shipped label with the switch on, then off; expected: the on capture's count is dimmer by the step for the current hour, glyph pixels identical — evidence: two paths
- [ ] Focus quiet, evening: input: a real Focus with the todz filter, switch on, after 12:00; expected: count at 1.0 and `widget-snapshot.json` has `showsDayTemperature: false` — evidence: (path)
- [ ] Focus ends: input: the Focus off; expected: the next snapshot write carries `true`, the widget reload happens once, the count returns to the step for the current hour without any notification — evidence: (log lines)
- [ ] Focus starts with the switch off: input: a Focus with the todz filter begins and ends, switch off; expected: no snapshot write and no reload (`routes()` unchanged)
- [ ] Increase Contrast on, evening: input: System Settings → Accessibility → Display → Increase contrast on; expected: count at 1.0, widget without wash, words unchanged
- [ ] Widget, medium, light: input: an overdue row at 1 day, one at 3, one at 9, one not overdue, one done; expected: washes at 0.06, 0.12, 0.18, none, none; the titles and the due words unchanged — evidence: `.pr-media/day-temperature/walk/widget-medium-light.png`
- [ ] Widget, medium, dark: the same data in dark; expected: the same washes, the red reads in dark; the title is legible — evidence: `.pr-media/day-temperature/walk/widget-medium-dark.png`
- [ ] Widget, small (next-up), overdue next-up at 2 days, light and dark; expected: 0.12 wash behind the card; the card's text unchanged — evidence: (paths)
- [ ] Widget, medium, vibrant: another app's window in front; expected: three distinct washes visible at 1, 3 and 9 days — evidence: (path)
- [ ] Widget, medium, accented/monochrome widget style (System Settings, Appearance); expected: the same three distinct washes — evidence: (path)
- [ ] Due-word contrast on the widest wash: Accessibility Inspector on the due words of the 9-day row, light and dark, against the wash; expected: contrast at or above 3:1; any value below applies the decided fallback (`lateOpacity` 0.09, `longOverdueOpacity` 0.12, ADR 0065 Evidence) — evidence: inspector export path
- [ ] Settings row: input: the row in light and dark; expected: the title "Day temperature" and the two-line detail, not truncated at the default window width — evidence: `.pr-media/day-temperature/walk/settings-row.png`
- [ ] Midnight rollover: covered by the unit test `WidgetContentTests::snapshotOfAnotherDayIsThePrompt` above; the walk does not change the owner's clock
- [ ] Zone change after launch: input: the Mac's zone changed in System Settings once; expected: the steps follow the new zone at once; the wash follows the snapshot's day until the next write
- [ ] Old snapshot after update: input: a snapshot file from the previous build (no key) in the App Group; expected: the widget shows its prompt until the app launches, then the new snapshot replaces it at launch
- [ ] Popover untouched: input: the walk above; expected: the popover is never opened by the walk; evidence: the walk's log has no popover event

## The failing test first

Covered by the first red checkbox in this file. The red commits are the seven `Red:` commits of plan steps 2, 4, 6, 8, 10, 12 and 14; each red commit's test is named in the plan's step text.

## Edge cases found during execution

Empty on purpose. The tester adds one checkbox per new case (input, exact expected outcome) and a regression test for each.

## Adversarial review

The reviewer picks the three claims most likely to be wrong and tries to refute each.

- [ ] Claim 1: the status item keeps text alpha and drops colour, so the tone shows on every bar — attack: the tinted and transparent bar screenshots at evening, and a second macOS release if one is installed; result: `refuted | held`
- [ ] Claim 2: the red due words keep 3:1 or better on the 0.18 wash — attack: Accessibility Inspector on the due words of the 9-day row, light and dark, with the owner's widget background; result: `refuted | held`
- [ ] Claim 3: the clock waits at most four times per day and a gate change reloads the widgets once — attack: the clock test with a DST day and a Focus toggled twice in a row; result: `refuted | held`

## Coverage honesty

- The widget views have no unit target. Their wiring is proven by the build and the walk. Risk accepted: a view-only regression (a wash on a done row) is caught by the walk, not by a test. The owner may ask for a `TodzWidgetsTests` target; that is a spec open question.
- The real clock never reaches 12:00, 15:00 or 18:00 during the build. The steps are proven by the pure functions and the scratch render. Risk accepted: the first real boundary on the owner's machine is the first live check (a Human checklist row below).
- The screen lock, a real Focus on the owner's account, and a real DST change are not run. Risk accepted: the DST behaviour is pinned by the zone tests; a real Focus is a Human checklist row.
- The contrast of the title on the wash is measured in one appearance setup (the owner's). Risk accepted: other wallpapers do not change the widget's background, so the measurement holds for the widget.

## Human checklist (for the owner, before the feature is called shipped)

- [ ] Turn "Day temperature" on in Settings, then look at the menu bar count at the next boundary after the switch: the count is dimmer at 12:00 (or at the next boundary), the glyph unchanged.
- [ ] Open a Focus that holds todz, look at the count at a boundary: plain; end the Focus: the tone returns, with no notification.
- [ ] Look at a widget with an overdue task at least seven days old: a faint red field behind the row, the title readable.
- [ ] Turn on Increase Contrast: the count is plain, the widget has no field.
