# Tester briefing: Morning glance

Written by the developer sub-agents when their steps are done, each in its own section: G1 (TodzKit) and G2 (the app). The developers do not run `test-plan.md` and do not declare the feature works.

## G1

### What changed

All under `apps/macos/TodzKit`; commits `831f914` (red), `8a1befb` (green), `2ef05c6` (red), `5350267` (green).

- `Sources/TodzKit/MorningGlancePreference.swift` — keys `showsMorningGlance` and `lastMorningGlanceDay`, off by default, as `DayClosePreference`.
- `Sources/TodzKit/MorningGlanceContent.swift` — the workspace identifier, the count, up to five `WidgetSnapshotTask` rows and the rest.
- `Sources/TodzKit/AppModel+MorningGlance.swift` — `morningGlanceContent`, reading only `taskViews.today.open` and `isTodayKnown(in:)`; nil until Today is known.
- `Sources/TodzKit/MorningGlanceDwell.swift` — the pure fade timing: 5 s, hover pause, 30 s cap, 0.5 s fade (0 with Reduce Motion), 0.4 s pointer grace.
- `Sources/TodzKit/MorningGlanceFront.swift` — the pure "Today is already in front" rule.
- `Sources/TodzKit/MorningGlanceCoordinator.swift` — the chance, the gate, the 60 s Today wait by observation, the locked chance, held and released days, the in-flight show, the mark once seen, the close on popover, `closeNow()`, signed out or another workspace.
- `Sources/TodzKit/DayCloseCoordinator.swift` — `isDueAndIdle` is public; `check()` reads it, behaviour unchanged.

### How to run

```bash
swift test --package-path apps/macos/TodzKit
swift test --package-path apps/macos/TodzKit --no-parallel --filter MorningGlance
```

Final count on `5350267`: 908 tests in 62 suites passed (the whole package); the focused run of `MorningGlance` and `DayCloseCoordinatorTests` is 101 tests in 6 suites.

### Red today, green after

A stub's `fatalError` kills the test process, so each red run stops at the first stub it reaches. Serial runs (`--no-parallel --filter <suite>`) at the red commits printed:

| Test | Red before the change because (printed) | Green after because |
|------|------------------------------------------|----------------------|
| `MorningGlancePreferenceTests` (`831f914`) | `MorningGlancePreference.swift:9: Fatal error: MorningGlancePreference.registerDefaults is not implemented` | the four functions read and write the defaults |
| `MorningGlanceDwellTests` (`831f914`) | `MorningGlanceDwell.swift:13: Fatal error: MorningGlanceDwell.init is not implemented` | the dwell is a value of the show instant and the pointer state |
| `MorningGlanceFrontTests` (`831f914`) | `MorningGlanceFront.swift:9: Fatal error: MorningGlanceFront.isInFront is not implemented` | the rule is the three flags or the active app with a window |
| `AppModelTests/theMorningGlanceContentIsNoneWhileTodayLoads` (`831f914`, and the rest of `AppModelTests+MorningGlance`) | `AppModel+MorningGlance.swift:3: Fatal error: AppModel.morningGlanceContent is not implemented` | the content is built from `taskViews.today.open` |
| `MorningGlanceCoordinatorTests` (`2ef05c6`) | `MorningGlanceCoordinator.swift:21: Fatal error: MorningGlanceCoordinator.init is not implemented` | the coordinator is built |
| `DayCloseCoordinatorTests/aDayCloseIsDueAndIdleOnlyWhenOnDueAndNoClickIsInFlight` (`2ef05c6`) | `DayCloseCoordinator.swift:55: Fatal error: DayCloseCoordinator.isDueAndIdle is not implemented` | the property is `decision == .due && !isClickInFlight` |

Parallel runs differ, as the day close's E3 warned: `swift test --filter MorningGlance` at `831f914` printed `MorningGlanceFront.isInFront is not implemented` seven times and `MorningGlanceDwell.fadeDuration is not implemented` once, whichever worker crashed first; `--filter "MorningGlanceCoordinatorTests|aDayCloseIsDueAndIdle"` at `2ef05c6` printed only `DayCloseCoordinator.isDueAndIdle is not implemented`. Run the red boxes serially.

Pins: none. The stubs make every new test red; the coordinator's red text is its `init` for all 35 tests, because its stub does not build the object.

### Hypotheses to attack

Every "it works" is a hypothesis the tester tries to break.

1. Hypothesis: the day is marked only after the panel answers true. Break it by: a `showPanel` that answers false, then true; a screen that locks inside `showPanel`; `lastMorningGlanceDay` must stay absent until the true answer on an unlocked screen.
2. Hypothesis: the Today wait continues its own chance and never starts a new one. Break it by: two `check()` calls while Today is nil, the second 70 s after the first, and Today arriving 10 s after the second (it shows: the latest chance carries on); and arriving 61 s after the only one (nothing).
3. Hypothesis: a held chance on day D shows on release only if today is D. Break it by: holding on D, a second held chance on D+1, release on D+1 (shows), release on D+2 (nothing, gate released list empty).
4. Hypothesis: the popover, `closeNow()` or Today in front during the in-flight show close the panel the moment `showPanel` answers, and the day stays marked. Break it by: each inside `whileShowing`; and `closeNow()` while the screen is also locked (unmarked).
5. Hypothesis: a content change while on screen closes only for nil or another workspace. Break it by: a task added, a task completed, the active workspace switched, a sign-out, repeatedly, then `dismissed()` followed by a change (nothing closes, no second close).
6. Hypothesis: `morningGlanceContent` is the heading count's twin. Break it by: pending adds and completions offline; the count and the rows must agree with `todayHeadingCount`.
7. Hypothesis: `DayCloseCoordinator.check()` is unchanged. Break it by: the whole `DayCloseCoordinatorTests` suite, which stays green.

### Known gaps

- `hovered(at:)` takes the instant for symmetry with `left(at:)`; a hover's start does not move the fade, so the instant is unused.
- No real signal, panel, lock or Focus is exercised here; the app lane and the walk prove those.
- The coordinator's `contentWaiting`, `releaseTaking` and `shownContentReviewing` tasks are internal handles for tests, as the day close's.
- The latest chance wins a Today wait, so a second chance while Today is still unknown extends the 60 s window to that chance's start; the plan reads "its chance" and R12's test pins only the single-chance case.

## G2

### What changed

- <file or module> — <one line>

### How to run

```bash
<commands to build, force a glance and launch hidden>
```

### Red today, green after

| Test | Red before the change because | Green after because |
|------|--------------------------------|---------------------|
| `<path>::<name>` |  |  |

### Hypotheses to attack

Every "it works" is a hypothesis the tester tries to break.

1. Hypothesis: <claim>. Break it by: <suggested attack>.

### Known gaps

- <what the developer knows is missing or untested>
