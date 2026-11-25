# Plan: Day temperature

**Spec:** [spec.md](spec.md)
**Tier:** 🟡
**Seam:** the menu bar label (`MenuBarLabel`) and the widget snapshot writer (`AppModel+Widgets`, `FileWidgetStore`) on the app side; the widget timeline provider (`TodayTimelineProvider`) and the Today rows on the widget side; the Settings form beside the morning-glance row; the shared gate (`ProactiveGate`) read, never changed.
**Assumptions (decided, owner can override):**
- The Mac's current time zone decides the steps, as the morning glance and the day close do.
- The widget's overdue age uses the snapshot's day, as the widget's "today" already does.
- The tone is text alpha. A spike (step 1) measures whether the status item keeps it; if it does not, the fallback is decided now: an `ImageRenderer` template image (ADR 0065 §3), never a superseded ADR.
- The widget logic stays in TodzKit; the widget lane adds no test target (spec open question, default).
- Red-first commits are separate from their green commit; a green-on-landing test is a `pin`. Every red stubs `fatalError("<Type>.<member> is not implemented")` and each suite runs alone with `--filter`, stopping on that text, recorded in the briefing.

## File map

| Group | Paths owned | Developer sub-agent |
|-------|-------------|---------------------|
| G0 | scratch worktree only, nothing committed; the lead commits the evidence | `developer-1` (spike) |
| G1 | `apps/macos/TodzKit/**` (sources and tests), `apps/macos/Todz/**`, `apps/macos/Copy/**`, and the one line of `apps/macos/TodzWidgets/TodayEntry+Sample.swift` that passes `showsDayTemperature: false` (step 11, before G2 starts) | `developer-1` |
| G2 | `apps/macos/TodzWidgets/**` except that one line | `developer-2` |

G1 and G2 touch disjoint paths. G2 reads TodzKit's API and must not edit it: a TodzKit change G2 needs goes back to G1 through the lead.

## Sequencing

1. G0 runs first, alone, in a scratch worktree. Its answer goes into ADR 0065 "Evidence" and into `design.md` §1.1; the lead commits it as `docs(day-temperature): record the spike` on `feat/day-temperature` before G1 branches.
2. G1 steps 2 to 11 run first: the pure TodzKit API and the snapshot key. G2 may start once G1 has committed steps 5 and 11 on the lane branch and the lead has merged that lane to `feat/day-temperature` (the widgets need `OverdueWash` and the snapshot key only).
3. G1 steps 12 to 16 and G2 step 19 run in parallel after that merge.
4. Z runs after both lanes merge.

## Steps

Author this list with every box empty. A sub-agent ticks its own line. A wrong step is struck through with the reason, not deleted.

### G0 (spike, scratch only)

- [ ] **Step 1:** Spike in a scratch worktree, not committed: a `MenuBarExtra` label with a `Text` count at opacities 1.0, 0.85, 0.75 and 0.65 on a light, a dark and a wallpaper-tinted (macOS 26 transparent) bar, plus a width check between steps; a widget row with a red wash at 0.06, 0.12 and 0.18 in `widgetRenderingMode` `.fullColor`, `.vibrant` and `.accented`, light and dark, with the due words' contrast read in Accessibility Inspector on the 9-day row. The spike tries, in order, `.opacity` on the `Text`, `.foregroundStyle(.primary.opacity(...))`, then the `ImageRenderer` template image, and records which first shows a measured difference. Pass when the mean luminance of the count's pixels differs from the plain capture at every step on all three bars, and the evening count still measures at least 3:1 against the bar. The spike also confirms `colorSchemeContrast` updates inside the `MenuBarExtra` label; if it does not, the label reads `NSWorkspace.shared.accessibilityDisplayShouldIncreaseContrast` and observes `NSWorkspace.accessibilityDisplayOptionsDidChangeNotification`. Record the answers in ADR 0065 "Evidence" and `design.md` §1.1.

If the label drops `.opacity` on the `Text`, the fallback is decided: `MenuBarLabel` renders the glyph and the count with `ImageRenderer` into one `NSImage` with `isTemplate = true`, the count drawn at the step's opacity. A template image keeps its alpha channel, so the tone survives and the glyph stays a template; the accessibility label is unchanged. ADR 0065 §3 is amended with the evidence, not superseded.

### G1 (TodzKit and the app)

- [ ] **Step 2:** Red: `DayTemperatureStepTests` for `step(at:in:)` at 11:59:59, 12:00:00, 14:59:59, 15:00:00, 17:59:59, 18:00:00, 23:59:59 and 00:00:00 in `America/Sao_Paulo`. Stubs `fatalError("DayTemperatureStep.step is not implemented")`; the suite run alone with `--filter` stops on that text, recorded in the briefing. Commit alone.
- [ ] **Step 3:** Green: `DayTemperatureStep` (`plain`, `noon`, `afternoon`, `evening`) and `step(at:in:)` in `apps/macos/TodzKit/Sources/TodzKit/DayTemperatureStep.swift`, the hours as constants at the top.
- [ ] **Step 4:** Red, three suites each run alone: `DayTemperatureStepTests` for `countOpacity(step:isSettingOn:isQuiet:isContrastIncreased:openCount:)` (1.0 for plain, for each of the three off-switches alone at evening with 6 open, for zero and nil; 0.85, 0.75, 0.65 for the three steps with a count of 1, 6 and 120); `CalendarDateTests+Days` for `CalendarDate.days(since:)` (same day 0; 2026-11-24 to 2026-11-25 is 1; across the New York spring-forward and fall-back days is 1; across a year is 365); `OverdueWashTests` for `OverdueWash.opacity(of task: WidgetSnapshotTask, on day: CalendarDate, isShown: Bool, isContrastIncreased: Bool) -> Double` (0 unless `task.state == .open && task.isOverdue`, and 0 for each of the two off-switches alone; otherwise the band of `day.days(since: dueDate)`: 0.06 at 1, 0.12 at 2 and 6, 0.18 at 7 and 30). Stubs `fatalError("DayTemperatureStep.countOpacity is not implemented")`, `fatalError("CalendarDate.days is not implemented")` and `fatalError("OverdueWash.opacity is not implemented")`. Commit alone.
- [ ] **Step 5:** Green: `countOpacity` in `DayTemperatureStep.swift`, `CalendarDate.days(since:)` in `CalendarDate.swift`, and `apps/macos/TodzKit/Sources/TodzKit/OverdueWash.swift`, the bands and the opacities as constants.
- [ ] **Step 6:** Red: `DayTemperatureStepTests` for `boundaries(on:in:)` and `nextBoundary(after:in:)`: the three boundaries and midnight of a day in `America/Sao_Paulo`; the next boundary from 11:30, 12:00, 14:59:59, 23:59:59; across the spring-forward day of `America/New_York` (01:30 to 03:00 is not a boundary, next is 12:00); across the fall-back day (the 15:00 boundary exists once); the instant 2026-11-25T16:00:00Z gives 2026-11-25T18:00:00Z in `America/Sao_Paulo` and 2026-11-25T17:00:00Z in `Europe/Berlin`; `America/Santiago` skips midnight on 2026-09-06 (00:00 to 01:00): `nextBoundary(after: 2026-09-05 23:00 local)` is 2026-09-06 01:00 local (`startOfDay`) and `boundaries(on: 2026-09-05)` ends at that instant, never nil and never a crash. Stubs `fatalError("DayTemperatureStep.boundaries is not implemented")` and `fatalError("DayTemperatureStep.nextBoundary is not implemented")`. Commit alone.
- [ ] **Step 7:** Green: `boundaries(on:in:)` and `nextBoundary(after:in:)` using `Calendar` in the given zone, in `DayTemperatureStep.swift`.
- [ ] **Step 8:** Red: `DayTemperaturePreferenceTests`: a fresh suite reads `isOn` as `false`; the key is `showsDayTemperature`; `registerDefaults` registers `false`; the set value survives a new `PersistentDomain`. Stubs `fatalError("DayTemperaturePreference.isOn is not implemented")`. Commit alone.
- [ ] **Step 9:** Green: `apps/macos/TodzKit/Sources/TodzKit/DayTemperaturePreference.swift`, as `MorningGlancePreference` but with `isOn` `public` (the app reads it), and no last-shown day.
- [ ] **Step 10:** Red: `WidgetSnapshotTests.missingKeyFailsToDecode`: a snapshot JSON without `showsDayTemperature` throws on decode. It decodes today, so the `#expect(throws:)` fails: the failure text is that expectation, recorded in the briefing. The round-trip test lands with step 11 as a pin. Commit alone.
- [ ] **Step 11:** Green: `showsDayTemperature: Bool` as a required key in `WidgetSnapshot`, no default. Construction sites, all G1 in this step: `WidgetSnapshot.of(views:workspace:day:timeZone:showsDayTemperature:)` (passes the model's flag), `WidgetToggle.setting` (carries `snapshot.showsDayTemperature`), `TodzWidgets/TodayEntry+Sample.swift` (passes `false`; G1 owns this one line before G2 starts), and the tests `FileWidgetStoreTests`, `UnavailableWidgetStoreTests`, `WidgetToggleTests`, `WidgetContentTests`. Pins landing with it: `WidgetSnapshotTests.flagRoundTrips`, and a red-then-green case in `WidgetToggleTests`: toggling a row of a snapshot with `showsDayTemperature: true` keeps `true`. Commit.
- [ ] **Step 12:** Red: `DayTemperatureToneTests` for `DayTemperatureTone.isShown(isSettingOn:isQuiet:)` (true only with the setting on and not quiet), and, in `AppModelTests+Widgets.swift`, sentence-named tests driving `model.showDayTemperature(true)` and `model.showDayTemperature(false)` through the existing harness and asserting `harness.widgets.routes()`: off to on gives `[.writeSnapshot, .reload]` with the flag true; on to on gives no route; on to off gives a write and a reload with the flag false. Stubs `fatalError("DayTemperatureTone.isShown is not implemented")` and `fatalError("AppModel.showDayTemperature is not implemented")`. Commit alone.
- [ ] **Step 13:** Green: `AppModel` gains `public internal(set) var showsDayTemperature = false` (observable) and `public func showDayTemperature(_ isShown: Bool)`; `readyWidgetSnapshot` passes it to `WidgetSnapshot.of(...)`, so the existing `observeWidgets` observation and the `publishedWidgetSnapshot` dedup write once and reload once per change. `DayTemperatureTone` lives in `apps/macos/TodzKit/Sources/TodzKit/DayTemperatureTone.swift`. `AppDelegate` (new `AppDelegate+DayTemperature.swift`) calls `model.showDayTemperature(DayTemperatureTone.isShown(...))` after `readFocusFilter()` settles, on `UserDefaults.didChangeNotification`, and on `gate.isQuiet` changes through `withObservationTracking`. Commit.
- [ ] **Step 14:** Red, in TodzKit: `DayTemperatureClockTests` for `@MainActor @Observable public final class DayTemperatureClock` (`apps/macos/TodzKit/Sources/TodzKit/DayTemperatureClock.swift`) with injected `now` and `pause` (the `HeldPause` test helper): `refresh()` at 11:30 sets `step == .plain` and waits until 12:00; a release of the pause at 12:00 sets `.noon` and waits until 15:00; a release at 18:00 waits until the next day's start; a `refresh()` during a wait cancels the earlier wait (one pending); with the switch off, `step == .plain` and nothing waits. Stubs `fatalError("DayTemperatureClock.refresh is not implemented")`. Commit alone.
- [ ] **Step 15:** Green: the clock in TodzKit, and `apps/macos/Todz/MenuBar/DayTemperatureScheduler.swift` modelled on `DayCloseScheduler`: it calls `clock.refresh()` on `NSWorkspace.didWakeNotification`, `.screenIsUnlocked`, `.NSSystemTimeZoneDidChange`, `.NSSystemClockDidChange`, `.NSCalendarDayChanged` and `UserDefaults.didChangeNotification`, and is started in `applicationDidFinishLaunching` after `readFocusFilter()`. The wait uses the continuous clock (`Task.sleep`), as `DayCloseScheduler` does, so sleep is counted. The count does not re-arm the clock: the step does not depend on it. Commit.
- [ ] **Step 16:** Green: `TodzApp.swift` (around lines 43-45) passes the gate and the clock into `MenuBarLabel`'s SwiftUI environment, and `TodzApp.init` calls `DayTemperaturePreference.registerDefaults(in: .standard)`; `MenuBarLabel` reads `clock.step` from the environment and applies `countOpacity` to the badge text only (or the `ImageRenderer` template image, per step 1), reading the preference through `@AppStorage` and the contrast as step 1 decided; `SettingsView` gains the switch row with `SettingsCopy.dayTemperature` and `dayTemperatureDetail` (option B of `design.md` §3). Commit.

### G2 (widgets)

- [ ] ~~**Step 17:** Pin: the widget target builds against the merged TodzKit and `boundaries` is the list the provider reads.~~ Struck: the widgets draw no step; the wash changes only with the day and the midnight entry exists already (R5).
- [ ] ~~**Step 18:** Green: `TodayTimelineProvider.getTimeline` adds one entry per boundary of the day; `TodayEntry` derives the step.~~ Struck: unrequested state nothing reads; `TodayTimelineProvider` is unchanged (R5).
- [ ] **Step 19:** Green: `TodayListView` rows and `NextUpView`'s card draw the wash behind an overdue open row from `OverdueWash.opacity(of:on:isShown:isContrastIncreased:)`, with `isShown` from `snapshot.showsDayTemperature`. The wash reads `widgetRenderingMode` from the environment: `.fullColor` draws `Color.red.opacity(band)`; `.vibrant` and `.accented` draw `Color.primary.opacity(band)` at the same bands. Geometry: full row width, the row's own height (no padding added, the layout unchanged), `RoundedRectangle(cornerRadius:)` from a constant at the top of the view; pending rows (`WidgetPendingRow`, next-up without a key) get no wash; on the small widget the wash sits behind `NextUpTask` only, not the header. The ring and the views' layout are unchanged. Commit. No unit target (spec open question): the proof is the build and the walk.

## Failure modes

| Step | What breaks | How I notice (the concrete signal) | How I back out |
|------|-------------|------------------------------------|----------------|
| 1 | the status item drops the text alpha, or the wash fails the due words' contrast | the spike's pixel luminance shows no difference between steps, or Accessibility Inspector reports below 3:1 for the due words on the 9-day row | the decided fallbacks: the `ImageRenderer` template image for the count; `lateOpacity` 0.09 and `longOverdueOpacity` 0.12 for the wash (ADR 0065 §3 and §5) |
| 1 | `colorSchemeContrast` does not update inside the `MenuBarExtra` label | the spike's toggle of Increase Contrast leaves the count dim | read `NSWorkspace.shared.accessibilityDisplayShouldIncreaseContrast` and observe `NSWorkspace.accessibilityDisplayOptionsDidChangeNotification` |
| 3, 5, 7 | the step or boundary is off by an hour at a zone or DST edge | a red test named in step 2 or 6 goes green on the wrong value, or a DST test fails | revert the green commit; the red test stays |
| 7 | the next boundary is computed in UTC, not the Mac's zone, or a zone that skips midnight returns nil | the zone and Santiago tests in step 6 fail | revert the green commit |
| 11 | the widget shows its prompt after an update until the app launches | the walk's first widget capture after installing over an old snapshot is the prompt | revert the green commit; an older build ignores the key |
| 11 | an old running process keeps writing the old shape after the bundle is replaced, so the widget shows its prompt until relaunch | the walk's old-snapshot line | none in code; relaunch the app |
| 11 | one widget checkbox tap wipes the wash until the app rewrites | the `WidgetToggleTests` case of step 11 | revert the green commit |
| 13 | the gate change rewrites the snapshot twice or not at all | the step 12 routes are not `[.writeSnapshot, .reload]` once | revert the green commit |
| 13 | the flag is set before the Focus read settles, so the snapshot is written true and then false | the walk's launch under a Focus | start the flag only after `readFocusFilter()` settles |
| 15 | the clock fires every minute or never, or misses a boundary after sleep | the step 14 clock test counts waits; the walk's CPU sample at 14:00 shows wakes | revert the green commit; the label keeps the count |
| 16 | the item's width changes between steps | the walk's screenshots at two steps show a moved glyph or count | revert the label change; the glyph keeps the count |
| 16 | the tone shows during a quiet Focus | the walk's Focus capture shows opacity below 1.0 | revert the label's gate read |
| 19 | the wash is drawn on done rows or on a row not overdue, or reads as a grey band in vibrant mode | the walk's widget captures in the three rendering modes | revert the view change; the widget stays as today |

**Steps with no backout:** none. Each green step is a revert of one commit; step 1 is a scratch spike that leaves nothing to revert.

## Z. Prove and ship

- [ ] **Tester briefing:** each developer wrote its part of `tester-briefing.md`, with the pins (steps 10 and 11), the red-first hashes and each red step's failure text.
- [ ] **Tester run:** a fresh `tester` sub-agent executed `test-plan.md` and ticked every box with evidence; the walk keeps to the menu bar and one Settings window.
- [ ] **Reviewer:** a fresh `reviewer` sub-agent returned a verdict; refutation of the three riskiest claims is recorded in `test-plan.md`.
- [ ] **/check-ui:** screenshots recorded with Orca into `.pr-media/day-temperature/` and attached with `scripts/pr-media.sh`.
- [ ] **/open-pr:** gates passed, learnings sweep stated, PR opened.

## Plan review answers (R1–R24)

The plan review of 2026-11-25 returned two CRITICAL, thirteen IMPORTANT and nine MINOR findings and "Ship-ready? NO"; the lead accepted every fix. The decisions the review asked to make now are recorded in ADR 0065 §3, §5, §6 and §8.

| # | Severity | Finding | Answer | Where |
|---|---|---|---|---|
| R1 | CRITICAL | The timer's red test had no target, nothing told the label the step changed, and `Timer` does not count sleep | The clock moves into TodzKit as `DayTemperatureClock` (`@MainActor @Observable`, injected `now` and `pause`, tested with `HeldPause`); `DayTemperatureScheduler`, modelled on `DayCloseScheduler`, refreshes it on wake, unlock, time zone, system clock, calendar day and defaults changes; the label reads `clock.step` from the environment; "re-armed on count" and "app activation" struck | plan steps 14, 15, 16; spec Data flow and Interfaces; test-plan Unit; ADR 0065 §8 |
| R2 | CRITICAL | `AppModel` held neither the gate nor the preference, so the snapshot flag had no mechanism | `AppModel.showsDayTemperature` (observable) and `showDayTemperature(_:)`; `readyWidgetSnapshot` passes it to `WidgetSnapshot.of`; `DayTemperatureTone.isShown(isSettingOn:isQuiet:)` composes it; `AppDelegate+DayTemperature` drives it after `readFocusFilter()`, on defaults changes and on `gate.isQuiet`; tests assert `harness.widgets.routes()` | plan steps 12, 13; spec; test-plan Unit; ADR 0065 §6 |
| R3 | IMPORTANT | The spike's failure branch stopped the loop at its riskiest question | Fallback decided: an `ImageRenderer` template `NSImage` with the count at the step's opacity; the spike tries `.opacity`, `.foregroundStyle(.primary.opacity)`, then the image; a pass threshold of mean pixel luminance on three bars and 3:1 at evening; `colorSchemeContrast` confirmed or replaced by the `NSWorkspace` read; the ADR is amended, not superseded | plan Assumptions, step 1, failure modes; design §1.1; ADR 0065 §3, §9, Evidence |
| R4 | IMPORTANT | The wash was untested in the vibrant and accented widget modes | The wash reads `widgetRenderingMode`: red in `.fullColor`, `Color.primary` at the same bands in `.vibrant` and `.accented`; the spike captures all three; two walk lines added | plan steps 1, 19; design §1.2, §2, §6; test-plan Walk; ADR 0065 §5 |
| R5 | IMPORTANT | The widgets drew no step, so boundary entries added state nothing reads | Steps 17 and 18 struck and `TodayTimelineProvider` unchanged; the spec goal and ADR §8 reworded; the test-plan boundary lines struck; G2 needs only steps 5 and 11 | plan steps 17, 18, Sequencing; spec Goals; test-plan; ADR 0065 §8 |
| R6 | IMPORTANT | No owner of `daysOverdue`; three overlapping inputs; a "23:59 / 00:01" case for a `CalendarDate` | `CalendarDate.days(since:)` added (steps 4 and 5) with its tests; `OverdueWash.opacity(of:on:isShown:isContrastIncreased:)` takes the task and the day; the case replaced by due 2026-11-24, day 2026-11-25, 0.06 | plan steps 4, 5; spec Interfaces; test-plan Unit |
| R7 | IMPORTANT | Construction sites were not named; a widget tap could wipe the flag | Step 11 names `WidgetSnapshot.of`, `WidgetToggle.setting`, `TodayEntry+Sample.swift` (one G1 line before G2) and the four test files; a `WidgetToggleTests` case keeps `true` | plan steps 11, File map; test-plan Unit; failure modes |
| R8 | IMPORTANT | `apps/macos/Copy/**` was owned by no group | Added to G1's row | plan File map |
| R9 | IMPORTANT | The contrast check measured the title, not the red due words | The inspector measures the due words on the 9-day row, pass at least 3:1; the fallback caps 0.09 and 0.12 decided in ADR §5; adversarial Claim 2 re-aimed | plan step 1, failure modes; design §2, §4; test-plan Walk and Adversarial; ADR 0065 §5, Evidence |
| R10 | IMPORTANT | `countOpacity` took one Bool, so the composition went untested | `countOpacity(step:isSettingOn:isQuiet:isContrastIncreased:openCount:)` and the same switches on `OverdueWash.opacity`, each off-switch tested alone | plan step 4; spec Interfaces and Test strategy; test-plan Unit |
| R11 | IMPORTANT | The zone test had wrong numbers and could not catch a bug; midnight-gap zones missing | Replaced by 2026-11-25T16:00:00Z giving 18:00Z in `America/Sao_Paulo` and 17:00Z in `Europe/Berlin`; the `America/Santiago` 2026-09-06 case added | plan step 6; test-plan Unit |
| R12 | IMPORTANT | The Focus-with-switch-off expectation contradicted `publishWidgets` | The expectation is no snapshot write and no reload (`routes()` unchanged) | test-plan Walk; spec Failure handling |
| R13 | IMPORTANT | The midnight walk line expected the wrong result and changed the owner's clock | Replaced by a unit test: a snapshot of 2026-11-25 on 2026-11-26 is `.prompt`, and due 2026-11-16 on 2026-11-26 washes 0.18; the clock change dropped | test-plan Unit (widgets) and Walk |
| R14 | IMPORTANT | Every step capture was a scratch render; a line mixed a render with a real Focus | A live line with the shipped label, switch on then off, at the real clock time; the Focus line uses a real Focus and checks `widget-snapshot.json` | test-plan Walk |
| R15 | IMPORTANT | Red steps did not record failure text | Every red names its `fatalError("<Type>.<member> is not implemented")` and runs alone with `--filter`; step 10 split: `missingKeyFailsToDecode` red now, the round trip as a pin with step 11 | plan Assumptions and steps 2 to 14; test-plan first test |
| R16 | MINOR | The copy table held option A while the pick is B | The `dayTemperatureDetail` row set to B's text | design §3 |
| R17 | MINOR | The mock showed "3 days overdue", not the real words | The mock and table use `TaskRowCopy.overdue(date:)` ("Overdue · 22 November") | design §1.2 |
| R18 | MINOR | "The Mac in another zone from the owner" cannot be set up | Replaced by the zone-change case: the steps follow the new zone at once, the wash the snapshot's day until the next write | spec Failure handling; test-plan Walk; ADR 0065 §10 |
| R19 | MINOR | The tone could show briefly under a Focus at launch | The flag and the clock start only after `readFocusFilter()` settles | plan steps 13, 15; spec Failure handling; failure modes |
| R20 | MINOR | The wash's geometry and scope were left open | Full row width, own height, no padding, corner radius from a constant, no wash on pending rows, behind `NextUpTask` only on the small widget | plan step 19; design §1.2; ADR 0065 §5 |
| R21 | MINOR | Implied edits were unnamed; a copy-non-empty pin proved nothing | `TodzApp.swift` environment and `registerDefaults`, `isOn` `public`; the copy pin dropped | plan steps 9, 16 |
| R22 | MINOR | Miscounted red commits, a date-less midnight, wrong test names | "Seven `Red:` commits"; `2026-11-26T00:00:00`; `AppModelTests+Widgets` with sentence names | test-plan |
| R23 | MINOR | G0 was "nothing committed" yet writes evidence | The lead commits the evidence as `docs(day-temperature): record the spike` before G1 branches | plan File map, Sequencing |
| R24 | MINOR | The old-process prompt case was missing | Added to the failure-modes table and the spec's failure handling; no code change | plan Failure modes; spec |
