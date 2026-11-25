# Tester briefing: Performance

Written by the developer sub-agents when their steps are done. The developers do not run `test-plan.md` and do not declare the feature works. Each lane keeps its own section.

## Lane L

### What changed

- Lane L fills this in.

### How to run

Lane L fills this in.

### Red today, green after

| Test | Red before the change because | Green after because |
|------|--------------------------------|---------------------|
| Lane L fills this in. |  |  |

### Hypotheses to attack

1. Lane L fills this in.

### Known gaps

- Lane L fills this in.

## Lane S

### What changed

- Lane S fills this in.

### How to run

Lane S fills this in.

### Red today, green after

| Test | Red before the change because | Green after because |
|------|--------------------------------|---------------------|
| Lane S fills this in. |  |  |

### Hypotheses to attack

1. Lane S fills this in.

### Known gaps

- Lane S fills this in.

## Lane A

### What changed

- **Probe, off by default.** TodzKit: `PerfProbeLine` (the four log lines, integers only), `PerfProbeSwitch` (reads an argument list; the app passes `ProcessInfo.processInfo.arguments`, never `UserDefaults`), `HitchCounter`, `LaunchInterval`. App target: `Todz/Perf/PerfProbe.swift` (a `Logger` on the bundle identifier, category `perf`; `launch-ready` from the `sysctl` process start to the first rows' `onAppear`; `footprint` every 30 s from `TASK_VM_INFO`; `task-arrived` through the model's observer) and `Todz/Perf/ScrollWalk.swift` (`-TodzPerfScroll YES` with the probe on: scrolls the list in about 200 steps of 50 ms with a display link feeding `HitchCounter`, then logs `scroll`). Hooks: `AppDelegate.applicationDidFinishLaunching` starts the probe, `TaskRows` adds `.onAppear` and `.task`. With neither argument `PerfProbe.shared` is `nil`: no logger, timer, display link or observer.
- **Arrival observer.** `AppModel.onTaskArrived`, called from a pull's `record` once per task number the board did not hold, only when the project was pulled before and is the Inbox or the project the sidebar selects.
- **Stored task views.** `AppModel.taskViews` returns a value built once and dropped by `didSet` on `board`, `outbox`, `workspaces` and `activeWorkspaceIdentifier`, and rebuilt when `today` differs from the day it was built for. The getter still reads the four inputs so SwiftUI keeps tracking them. `TaskBoard` keeps each project's numbers ordered when it merges, so `tasks(projectIdentifier:)` no longer sorts.
- **Background cache writer.** `ProjectCacheWriter` (new, internal) coalesces project-file writes per project (last write wins; tasks kept in a project file that is not shown merge into what the file holds, inside the writer) and drains on a `CacheScheduler` (`.background`: one serial utility queue, used by the app; `.immediate`: inline, the default, so every existing test is unchanged). A write lock is held during each write; `discard()` clears the queue and then takes that lock, so sign-out, server switch (ADR 0056), `forgetCache` and `eraseDataOfAnotherServer` never see a write after their erase, and `forgetProject` drops that project's queue. `flushCache()` drains on the calling thread; `AppDelegate.applicationWillTerminate` calls it. A failed background write raises `.cacheNotSaved` once per launch, hopping to the main actor.
- **Grouping by day.** `TaskViews.groupedByDay` appended with `last.tasks + [task]`, quadratic; it now appends in place.
- **Test helpers.** `InMemorySyncStore` is no longer `@MainActor` (locks instead) and counts `mainThreadProjectWrites`; `AppModelHarness` takes `cacheScheduler`; `HeldCacheDrains` holds drains until a test runs them off the main thread; `BigProject` seeds 20 projects and 5,000 tasks in one (2,500 open, 1,250 of them dated, 2,500 done).

### How to run

- `swift test --package-path apps/macos/TodzKit` (889 tests at the head of this lane).
- Benchmark medians, printed and never asserted: `TODZ_BENCHMARK=1 swift test -c release -Xswiftc -enable-testing --package-path apps/macos/TodzKit --filter ModelBenchmark` (the runbook's step 7 uses debug; release is the number to compare with 8 ms).
- Launch the Debug app with `-TodzPerfProbe YES` (and `-TodzPerfScroll YES`) and read `log show --predicate 'category == "perf"'`. Not run by this developer: it needs Lane L's `pnpm perf seed` and `pnpm perf app`, and a launch can open the menu bar popover.

### Red today, green after

| Test | Red before the change because | Green after because |
|------|--------------------------------|---------------------|
| `PerfProbeLineTests` (4), `HitchCounterTests` (3), `LaunchIntervalTests` (2), `PerfProbeSwitchTests` `theProbeIsOnWhen…` and `theScrollWalkNeedsBothSwitches` (d2bdfae) | stubs returned `""`, `false`, `-1`; e.g. `Expectation failed: PerfProbeLine.launchReady(milliseconds: 640).text == "launch-ready ms=640"`, `Expectation failed: counter.report.overBudget == 0`; 14 issues in 13 tests | 888eb10 |
| `AppModelTests+Pull` `anArrivalObserverHearsEachNewTaskOfTheProjectTheWindowShowsOnce` (e7692c2) | `Expectation failed: arrivals == [3, 4]` (the property existed and was never called) | 5622a59 |
| `ModelBudgetTests` `readsOfTheViewsWithoutAChangeBuildThemOnce` (8459a30) | `Expectation failed: builds <= 1` / `views built 10 times` | 46172a1 |
| `ModelBudgetTests` `aPulledTaskIsWrittenToTheProjectFileOffTheMainActor` | `Expectation failed: writesOnTheMainActor == 0` / `1 project file writes on the main actor` | 16f14f9 |
| `ModelBudgetTests` `tenSavesInARowWriteTheProjectFileAtMostTwice` | `Expectation failed: writeCount(harness) <= writesAllowedForABurst` / `10 project file writes` | 16f14f9 |
| `ProjectCacheWriterTests` (9) and `ModelCacheWriterTests` (5) (e650d2f) | the writer was an empty shell: 13 of 14 failed, e.g. nothing written after the drain, `drains.count == 1` failed, no banner | 16f14f9 |

Pins (green when they landed, guards only): the off cases of `PerfProbeSwitchTests` and the defaults-alone case (d2bdfae); `anArrivalObserverHearsNothingOfAnotherProject` and `aPullWorksTheSameWithNoArrivalObserver` (e7692c2); `discardDropsWhatIsQueued` (e650d2f); `StoredTaskViewsTests` (midnight, lingering completion, board and outbox changes) and the two `TaskBoardTests` ordering tests (46172a1); `TaskViewsGroupingTests` (4d287b9); `CacheSchedulerTests` and the `PerfProbeLine` instant test (16f14f9, 98c2b2b).

Benchmark medians of seven runs after one warm-up, 20 projects and 5,000 tasks in one, release build, before (8459a30) and after (head): `taskViews` then `inbox` 2.72 and 1.80 ms; `today` 4.94 and 3.20; `upcomingDays` 10.25 and 4.41; `doneDays` 97.96 and 2.51; `project(identifier:)` 2.67 and 1.84; one pulled task with its cache write 11.09 and 7.13; widget snapshot 4.97 and 3.23; menu bar count 4.94 and 3.23. Debug build, before and after the stored views and writer only: `inbox` 20.4 and 8.4 ms, `doneDays` 117 and 101, one pulled task 81 and 22. Release project file of 5,000 tasks: write 36.5 ms (now off the main actor), read and decode 205 ms (still on it at launch, see gaps).

### Hypotheses to attack

1. With no `-TodzPerfProbe YES` the app starts no probe: `log show` finds no category `perf` line after a plain launch.
2. Sign out while a write is queued or in flight, then relaunch: nothing of the old session is in the cache folder and the next sign-in starts clean.
3. Quit with ⌘Q right after changing a task: relaunch shows the change (flush on termination); a force quit can lose at most the last coalesced write, never reorder files.
4. Switch the server with queued writes: the new server's cache folder holds nothing of the old server.
5. Move the Mac's clock past midnight with the window open: Today, Upcoming and Done follow without a restart (the stored views rebuild on the day key; an NSSystemTimeZoneDidChange alone is not tested).
6. A cache that cannot be written (read-only folder) raises the banner once, from the background writer, and the window goes on.
7. Done (5,000 tasks) and Upcoming open in a few milliseconds (was ~100 ms for Done).

### Known gaps

- Steps 34 and 39 (baseline and after rows of the app against `wrangler dev` through `pnpm perf seed` and `pnpm perf app`) are not done: Lane L's harness is not on this branch and a launch can open the menu bar popover. The probe's `launch-ready`, scroll and footprint numbers are therefore unmeasured; the scroll walk and the display link are compiled and built (Debug and Release, no warnings) but never run.
- The time zone is a `let` of the model and `CalendarDate.today` is recomputed in it on every read; a zone change is covered by the day key, with no unit test that moves the system zone.
- The `ProjectCacheWriter` write lock makes a main-thread `discard()` wait for a write in flight (a few ms to tens of ms for a large project); no test holds a write open to prove the wait.
- Reads of a project file (`loadCachedProject`) can see a file older than a queued write for the same project; the cursor in it is older too, so the next pull catches up. Not tested.
- Decoding the 5,000-task file takes 205 ms (release) on the main actor at launch; moving it off the actor would not shorten the time to the first rows. Recorded as "measured, not fixed" under step 38; its share of the 1 s launch is unknown until the probe runs.
- `TaskRows`' identity or body work, the widget snapshot coalescing and `TaskSections` have no unit test or probe number; the benchmark puts the snapshot at 3.2 ms (release), under 8 ms.
- `groupedByDay`'s fix has no red commit: no deterministic counter sees a quadratic copy; the benchmark is its evidence.
- The arrival observer is silent for Today, Upcoming and Done (no single project), and for a project's first load.
