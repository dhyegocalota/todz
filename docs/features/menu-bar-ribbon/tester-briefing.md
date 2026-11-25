# Tester briefing: Menu bar ribbon

Written by the developer sub-agents when their steps are done, each in its own section: G1 (TodzKit) and G2 (the app). The developers do not run `test-plan.md` and do not declare the feature works.

## G1

### What changed

Everything is on `lane/menu-bar-ribbon-g1`, in `apps/macos/TodzKit`. No app file, no copy file and no server file changed.

Sources (`Sources/TodzKit`):

- `RibbonCadence.swift`, `RibbonPreference.swift` — `hourly`, `dayClose`, `agentChange`; keys `showsMenuBarRibbon` and `menuBarRibbonCadence`, off and hourly by default; `cadence` is nil for a stored value the app does not know (no fallback), `pickerCadence(stored:)` is the default for the picker only.
- `RibbonPreference.closeMinutesAfterMidnight` — **an addition the plan did not name**: the coordinator needs the Close the day time, `DayClosePreference.minutesAfterMidnight` is internal and the init list of the plan carries no minutes, so the preference builds a `DayClosePreference` over the same defaults domain and serves it.
- `DayClosePreference.swift` — `isOn` is `public`.
- `RibbonTask.swift`, `RibbonContent.swift` — the line: `.remaining(left:next:)`, `.last(_:)`, nil for nil or empty. `RibbonTask.number` is `Int?` as the plan says, but it is always set today (see gaps).
- `RibbonSchedule.swift` — the next hour (`Calendar.nextDate(matching: minute 0, second 0, .nextTime)`) or the next close of day (`DayCloseSchedule.instant`), nil for `.agentChange` and for `.dayClose` with no time.
- `RibbonFrame.swift`, `RibbonMotion.swift` — the pure timeline and its constants (`// NB ADR 0071:`). The fold frames carry the offset the scroll ended on, so a scrolled strip does not jump while folding.
- `RibbonTrigger.swift` — `isAgentChange(previous:arrived:today:)`.
- `AppModel.swift` (`agentChangeCount`), `AppModel+Pull.swift` (one line in `record(_:)`), `AppModel+Ribbon.swift` (`ribbonContent`, `isAgentChange(projectIdentifier:changes:)`).
- `RibbonPresentation.swift`, `RibbonCoordinator.swift` — `@MainActor @Observable`; `presentation`, `refresh()`, `agentChanged()`, `end()`. One `waiting` task to the next boundary, re-armed after the ribbon ends (or at once when `refresh()` replaces it); one `running` task for the frames; one `settling` task for an agent burst; `observeReleases()` over `gate.released` and `observeQuiet()` over `gate.isQuiet`. `agentSettle` is 3 s and `agentCooldown` is 10 minutes (`// NB ADR 0071:`). The cooldown is measured from the last ribbon shown while the cadence was `agentChange`.

Tests (`Tests/TodzKitTests`): `RibbonPreferenceTests`, `RibbonPublicSurfaceTests`, `RibbonContentTests`, `RibbonScheduleTests`, `RibbonMotionTests`, `RibbonTriggerTests`, `AppModelTests+Ribbon`, `RibbonCoordinatorTests`. The coordinator tests route waits of a minute or more and frames (and the 3 s settle) to two separate `HeldPause`s, so releasing a frame never releases a boundary.

### How to run

```bash
swift test --package-path apps/macos/TodzKit
swift test --package-path apps/macos/TodzKit --skip-build --no-parallel --filter RibbonCoordinatorTests/aBoundaryUnfoldsHoldsAndFoldsTheLineThenArmsTheNextHour
```

Final count on `c43b99ba`: 1109 tests in 88 suites passed. `RibbonCoordinatorTests` ran four times in a row, green each time.

### Red first

Each red commit stands alone and each test ran alone (`--skip-build --no-parallel --filter Suite/test`). A stub that is a `fatalError` kills the run, so the text is the crash line.

| Step | Red commit | Test | Printed on the red commit |
|------|------------|------|---------------------------|
| 1 | `bc22d686` | `RibbonPreferenceTests/theRegisteredDefaultsReadOffAndEveryHour`, `aSetValueSurvivesANewPreferenceOverTheSameDomain` | `RibbonPreference.swift:24: Fatal error: RibbonPreference.isOn is not implemented` |
| 1 | `bc22d686` | `aStoredCadenceTheAppDoesNotKnowReadsAsNone`, `aStoredCadenceReadsBackAsItself` | `RibbonPreference.swift:28: Fatal error: RibbonPreference.cadence is not implemented` |
| 1 | `bc22d686` | `thePickerShowsEveryHourForAStoredCadenceTheAppDoesNotKnow` | `RibbonPreference.swift:20: Fatal error: RibbonPreference.pickerCadence is not implemented` |
| 1 | `bc22d686` | `theStorageKeysAreTheOnesTheSettingsRowWrites` | pin: the constants are real in the stub |
| 1 | `e56dcfa6` | `RibbonPublicSurfaceTests/theCloseTheDaySwitchIsReadableOutsideTheModule` | compile error, no test runs: `RibbonPublicSurfaceTests.swift:8:29: error: 'isOn' is inaccessible due to 'internal' protection level` |
| 3 | `1ee87810` | all five `RibbonContentTests` | `RibbonContent.swift:6: Fatal error: RibbonContent.of is not implemented` |
| 5 | `26b59649` | all eleven `RibbonScheduleTests` | `RibbonSchedule.swift:5: Fatal error: RibbonSchedule.nextShowing is not implemented` |
| 7 | `277171d4` | all seven `RibbonMotionTests` | `RibbonMotion.swift:3: Fatal error: RibbonMotion.timeline is not implemented` |
| 9 | `f5c2e53b` | all eleven `RibbonTriggerTests` | `Fatal error: RibbonTrigger.isAgentChange is not implemented` |
| 11 | `fd34ee2d` | `AppModelTests/aSecondPullWithOneAgentTaskDueTodayCountsOnce`, `aSecondPullWithTwoAgentTasksDueTodayCountsOnce`, `aSecondPullWhereATaskOfTodayArrivesDoneCountsOnce` | `Expectation failed: harness.model.agentChangeCount == 1`, then `↳ harness.model.agentChangeCount == 1 → false` |
| 11 | `fd34ee2d` | `theFirstPullOfAProjectCountsNothing`, `aPullFromTheStartCountsNothing`, `aSecondPullWithAnOwnerTaskCountsNothing`, `theOwnersOwnCompletionAndThePullThatConfirmsItCountNothing`, `aPullForAProjectOfAnotherWorkspaceAfterASwitchCountsNothing`, `theRibbonContentIsNoneWhileSignedOut`, `theRibbonContentCountsTodaysOpenTasksAndNamesTheFirst` | pins: green when they landed (the count is a stored zero in the red commit, `ribbonContent` was green from step 4) |
| 13 | `67a4e040` | 18 `RibbonCoordinatorTests` that call `refresh()` first | `RibbonCoordinator.swift:30: Fatal error: RibbonCoordinator.refresh is not implemented` |
| 13 | `67a4e040` | the five that call `agentChanged()` first | `RibbonCoordinator.swift:34: Fatal error: RibbonCoordinator.agentChanged is not implemented` |
| 13 | `67a4e040` | `endingWithNoRibbonShowingChangesNothing` | `RibbonCoordinator.swift:38: Fatal error: RibbonCoordinator.end is not implemented` |

Green commits: step 2 `a4ed0571`, 4 `43919d10`, 6 `a804fef2`, 8 `65cee565`, 10 `3f323b6f`, 12 `a3b894cc`, 14 `c43b99ba`.

### Hypotheses for the tester

Each is something I believe works, stated so it can be refuted.

- A task an agent creates, open and due today or earlier, in a project already pulled and not pulled from the start, raises `agentChangeCount` by one however many such tasks the pull carries; a Today task that arrives done does the same; an owner-created task, the first pull of a project, a from-start pull, the app's own completion and a pull for a project of another workspace leave it at zero. Mutation to try: drop the `isPulledBefore` guard, the `isFromStart` guard, or read `previous` after the merge, and expect the first-pull, from-start and own-completion tests to go red.
- The hourly boundary is the next top of the hour in the Mac's zone, never nil and never the same instant twice, across the spring-forward and fall-back nights of `America/New_York` and in a half-hour zone. Mutation: use `.strict` matching or `.nextTimePreservingSmallerComponents` and expect the DST tests red.
- No width outlasts 9.5 s or 285 frames (checked for every integer width 0 to 2000), a fitting line holds 5 s, an overflowing one holds 1.5 s, scrolls once at 40 points per second and holds 1.5 s, and the scroll ends exactly at the overflow (100 for a 280-point line, 240 at the cap).
- The coordinator never holds a skipped ribbon: a visible popover or a locked screen skips before it asks the gate, so a Focus ending later releases nothing. A quiet gate holds it, and the release shows it once with the line of that moment.
- A gate turning quiet mid-ribbon, `end()`, or the switch off followed by `refresh()` clears `presentation` at once and no later frame lands.
- An agent burst shows one ribbon 3 s after its last change; a change 5 minutes after a shown agent ribbon is dropped without arming a wait, and one 10 minutes after shows.
- `refresh()` twice leaves one held wait.

### Gaps I know about

- The plan's "a first task with no number (pending) reads `number == nil`" is not tested and is struck in the plan: a `BoardTask` always carries a number and pending tasks never enter `taskViews.today.open`, so the nil branch of `RibbonTask.number` cannot be reached from `of(open:)` today. G2's `ribbonTask(_:)` still handles it as the plan says. A pending task that is the only Today task has no ribbon (count zero), which matches the heading count.
- The wait is armed again after a ribbon ends. During a ribbon the boundary task is blocked on it, so a boundary that would fall inside the 9.5 s is not missed by the clock: it is armed when the ribbon ends from the clock of that moment (the next one after it), and a `refresh()` mid-ribbon arms the wait at once.
- Nothing in G1 reads the real screen lock, popover, Reduce Motion or the real font width: those are the closures G2 injects, so no test here proves them.
- `swift test` runs the whole TodzKit suite in 2 s; nothing here proves the frames land in the live status item (ADR 0071 spike, step 0, and G2's renders).
