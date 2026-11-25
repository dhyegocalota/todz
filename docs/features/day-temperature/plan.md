# Plan: Day temperature

**Spec:** [spec.md](spec.md)
**Tier:** 🟡
**Seam:** the menu bar label (`MenuBarLabel`) and the widget snapshot writer (`AppModel+Widgets`, `FileWidgetStore`) on the app side; the widget timeline provider (`TodayTimelineProvider`) and the Today rows on the widget side; the Settings form beside the morning-glance row; the shared gate (`ProactiveGate`) read, never changed.
**Assumptions (decided, owner can override):**
- The Mac's current time zone decides the steps, as the morning glance and the day close do.
- The widget's overdue age uses the snapshot's day, as the widget's "today" already does.
- The tone is text alpha. A spike (step 1) confirms the system keeps alpha and drops colour in the status item; a failure supersedes ADR 0065 before any lane builds on it.
- The widget logic stays in TodzKit; the widget lane adds no test target (spec open question, default).
- Red-first commits are separate from their green commit; a green-on-landing test is a `pin`.

## File map

| Group | Paths owned | Developer sub-agent |
|-------|-------------|---------------------|
| G0 | scratch worktree only, nothing committed | `developer-1` (spike) |
| G1 | `apps/macos/TodzKit/**` (sources and tests), `apps/macos/Todz/**` | `developer-1` |
| G2 | `apps/macos/TodzWidgets/**` | `developer-2` |

G1 and G2 touch disjoint paths. G2 reads TodzKit's API and must not edit it: a TodzKit change G2 needs goes back to G1 through the lead.

## Sequencing

1. G0 runs first, alone, in a scratch worktree. Its answer goes into ADR 0065 "Evidence" and into `design.md` §1.1 before any commit of G1.
2. G1 steps 2 to 11 run first: the pure TodzKit API and the snapshot key. G2 may start once G1 has committed steps 3, 5, 7 and 11 on the lane branch and the lead has merged that lane to `feat/day-temperature`.
3. G1 steps 12 to 16 and G2 steps 17 to 19 run in parallel after that merge.
4. Z runs after both lanes merge.

## Steps

Author this list with every box empty. A sub-agent ticks its own line. A wrong step is struck through with the reason, not deleted.

### G0 (spike, scratch only)

- [ ] **Step 1:** Spike in a scratch worktree, not committed: a `MenuBarExtra` label with a `Text` count at opacities 1.0, 0.85, 0.75 and 0.65 on a light, a dark and a tinted bar, plus a width check between steps; a widget row with a red wash at 0.06, 0.12 and 0.18 with the title's contrast read in Accessibility Inspector in light and dark. Record the answer in ADR 0065 "Evidence" and `design.md` §1.1, and supersede the ADR if alpha is dropped.

### G1 (TodzKit and the app)

- [ ] **Step 2:** Red: `DayTemperatureStepTests` for `step(at:in:)` at 11:59:59, 12:00:00, 14:59:59, 15:00:00, 17:59:59, 18:00:00, 23:59:59 and 00:00:00 in `America/Sao_Paulo`; the stub throws `DayTemperatureStep is not implemented`. Commit alone.
- [ ] **Step 3:** Green: `DayTemperatureStep` (`plain`, `noon`, `afternoon`, `evening`) and `step(at:in:)` in `apps/macos/TodzKit/Sources/TodzKit/DayTemperatureStep.swift`, the hours as constants at the top.
- [ ] **Step 4:** Red: `DayTemperatureStepTests` for `countOpacity(step:isToneOn:openCount:)`: 1.0 for plain, off, zero, nil; 0.85, 0.75, 0.65 for the three steps with a count of 1, 6 and 120; and `OverdueWashTests` for `opacity(daysOverdue:isOpen:isOverdue:)`: 0 for done, not overdue and nil due date; 0.06 at 1; 0.12 at 2, 6; 0.18 at 7, 30. Commit alone.
- [ ] **Step 5:** Green: `countOpacity` in `DayTemperatureStep.swift` and `apps/macos/TodzKit/Sources/TodzKit/OverdueWash.swift`, the bands and the opacities as constants.
- [ ] **Step 6:** Red: `DayTemperatureStepTests` for `boundaries(on:in:)` and `nextBoundary(after:in:)`: the three boundaries and midnight of a day in `America/Sao_Paulo`; the next boundary from 11:30, 12:00, 14:59:59, 23:59:59; across the spring-forward day of `America/New_York` (01:30 → 03:00 is not a boundary, next is 12:00); across the fall-back day (the 15:00 boundary exists once); a zone change from `America/Sao_Paulo` to `Europe/Lisbon` at 14:00 local recomputes 15:00 in Lisbon. Commit alone.
- [ ] **Step 7:** Green: `boundaries(on:in:)` and `nextBoundary(after:in:)` using `Calendar` in the given zone, in `DayTemperatureStep.swift`.
- [ ] **Step 8:** Red: `DayTemperaturePreferenceTests`: a fresh suite reads `showsDayTemperature` as `false`; the key is `showsDayTemperature`; `registerDefaults` registers `false`; the set value survives a new `PersistentDomain`. Commit alone.
- [ ] **Step 9:** Green: `apps/macos/TodzKit/Sources/TodzKit/DayTemperaturePreference.swift`, as `MorningGlancePreference`, with a `isOn` read and no last-shown day.
- [ ] **Step 10:** Red: `WidgetSnapshotTests`: a snapshot JSON without `showsDayTemperature` throws on decode (no default); a snapshot with `showsDayTemperature: true` round-trips as true. Commit alone.
- [ ] **Step 11:** Green: `showsDayTemperature: Bool` as a required key in `WidgetSnapshot`; every construction site (the app's writer, the test harness, the widgets' sample) passes it; no default. Commit.
- [ ] **Step 12:** Red: `AppModelWidgetsTests` (the existing harness): with the setting on and the gate quiet, the written snapshot has `showsDayTemperature == false`; with the setting on and the gate open, `true`; a gate change from quiet to open writes a new snapshot and calls the reload once. Commit alone.
- [ ] **Step 13:** Green: `AppModel+Widgets` writes `showsDayTemperature` as the setting and not `gate.isQuiet`; the gate's release path calls the existing reload. Commit.
- [ ] **Step 14:** Red: `DayTemperatureTimerTests` with an injected scheduler protocol: arming schedules one callback at `nextBoundary`; re-arming cancels the earlier one; with the setting off, nothing is armed; a fired callback re-arms for the following boundary; at 18:00 with no later boundary the timer arms for 00:00. Commit alone.
- [ ] **Step 15:** Green: `DayTemperatureTimer` in `apps/macos/Todz/MenuBar/DayTemperatureTimer.swift`: one `Timer` with a tolerance, a scheduler protocol for tests, invalidated before each re-arm.
- [ ] **Step 16:** Green: `MenuBarLabel` applies `countOpacity` to the badge text only, reading `DayTemperaturePreference` through `@AppStorage`, the gate from the environment, and `colorSchemeContrast`; arms and re-arms `DayTemperatureTimer` on the count, the setting, the gate, a time zone change, a wake and an activation; `SettingsView` gains the switch row with `SettingsCopy.dayTemperature` and `dayTemperatureDetail` (option B of `design.md` §3). Commit. Test: the copy strings are non-empty constants, a pin.

### G2 (widgets)

- [ ] **Step 17:** Pin: the widget target builds against the merged TodzKit, and `DayTemperatureStep.boundaries` (G1 step 7) is the list the provider reads. No commit; recorded as a `pin` row in the briefing, because the red test is G1 step 6.
- [ ] **Step 18:** Green: `TodayTimelineProvider.getTimeline` adds one entry per boundary of the day plus the existing midnight entry, each carrying the snapshot; `TodayEntry` derives the step from its own date and the Mac's zone; the existing `.never` policy stays. Commit.
- [ ] **Step 19:** Green: `TodayListView` rows and `NextUpView`'s card draw `Color.red.opacity(OverdueWash.opacity(...))` behind an overdue open row when `snapshot.showsDayTemperature` is true and `colorSchemeContrast` is not `.increased`; the ring and the views' layout are unchanged. Commit. No unit target (spec open question): the proof is the build and the walk.

## Failure modes

| Step | What breaks | How I notice (the concrete signal) | How I back out |
|------|-------------|------------------------------------|----------------|
| 1 | the status item drops the text alpha, or the wash fails the title's contrast | the spike's screenshots show no difference between steps, or Accessibility Inspector reports below 4.5:1 for the title at 0.18 | supersede ADR 0065 and re-decide before step 3; or lower the wash cap in step 5 |
| 3, 5, 7 | the step or boundary is off by an hour at a zone or DST edge | a red test named in step 2 or 6 goes green on the wrong value, or a DST test fails | revert the green commit; the red test stays |
| 7 | the next boundary is computed in UTC, not the Mac's zone | the zone test in step 6 fails | revert the green commit |
| 11 | the widget shows its prompt after an update until the app launches | the walk's first widget capture after installing over an old snapshot is the prompt | revert the green commit; an older build ignores the key |
| 13 | the gate change rewrites the snapshot twice or not at all | the step 12 count of reloads is not one | revert the green commit |
| 15 | the timer fires every minute or never | the step 14 scheduler test counts callbacks; the walk's CPU sample at 14:00 shows wakes | revert the green commit; the label keeps the count |
| 16 | the item's width changes between steps | the walk's screenshots at two steps show a moved glyph or count | revert the label change; the glyph keeps the count |
| 16 | the tone shows during a quiet Focus | the walk's Focus capture shows opacity below 1.0 | revert the label's gate read |
| 18 | the entries miss a boundary, or the day's first entry draws the previous step | the timeline test (step 17's pin) or a widget capture at 12:00 | revert the provider change |
| 19 | the wash is drawn on done rows or on a row not overdue | the walk's widget capture | revert the view change; the widget stays as today |

**Steps with no backout:** none. Each green step is a revert of one commit; step 1 is a scratch spike that leaves nothing to revert.

## Z. Prove and ship

- [ ] **Tester briefing:** each developer wrote its part of `tester-briefing.md`, with the pins (step 17) and the red-first hashes.
- [ ] **Tester run:** a fresh `tester` sub-agent executed `test-plan.md` and ticked every box with evidence; the walk keeps to the menu bar and one Settings window.
- [ ] **Reviewer:** a fresh `reviewer` sub-agent returned a verdict; refutation of the three riskiest claims is recorded in `test-plan.md`.
- [ ] **/check-ui:** screenshots recorded with Orca into `.pr-media/day-temperature/` and attached with `scripts/pr-media.sh`.
- [ ] **/open-pr:** gates passed, learnings sweep stated, PR opened.
