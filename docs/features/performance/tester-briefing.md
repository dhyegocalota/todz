# Tester briefing: Performance

Written by the developer sub-agents when their steps are done. The developers do not run `test-plan.md` and do not declare the feature works. Each lane keeps its own section.

## Lane L

### What changed

- New package `tools/perf` (`@todz/perf`, branch `lane/performance-l`): the harness behind `pnpm perf`. Budgets as constants (`budgets.ts`), nearest-rank percentiles, the open-model schedule and the ten-slot mix (`schedule.ts`), the run plan with the production caps (`run-plan.ts`), the timed `fetch` and the report with verdicts (`timed-fetch.ts`, `report.ts`), the MCP client scenarios for both eras (`mcp-scenario.ts`), the owner scenarios (`owner-scenario.ts`), the change feed with Node's `WebSocket` (`change-feed.ts`, `socket-signals.ts`), the seed (`seed.ts`), the local load, stress ramp and soak (`local-run.ts`, `stress.ts`, `soak.ts`), the wire guard, the Keychain read and the bounded production run with its cleanup (`wire-guard.ts`, `keychain-key.ts`, `production-run.ts`), the probe and tail readers (`probe-log.ts`, `tail-log.ts`, `app-command.ts`) and the command line (`cli.ts`, `commands.ts`).
- Shared files: root `package.json` (`perf` script), `pnpm-lock.yaml` (only the `tools/perf` importer, no new package), `scripts/verify-gates.tsv` (`tools/perf/*` is `product`, `typecheck unit`), `scripts/verify.test.sh` (one classification case), `AGENTS.md` and `tools/README.md` (one line each), `docs/runbooks/performance.md` (new, with the local baseline rows), `docs/runbooks/README.md` and `tools/repository-shape/src/runbooks.test.ts` (the exception sentence).
- No product code is touched. Test doubles live beside the harness (`fake-mcp-server.ts`, `fake-owner-server.ts`, `fake-task-server.ts`, `recording-fetch.ts`, `routed-fetch.ts`); they are source, not tests, and are used only by the tests.
- Deviations from the plan: the production caps live in `budgets.ts` (the budgets test pins them) and `run-plan.ts` imports them; every local command takes `--port <n>` (only the port of `localhost` moves, production never takes it) because port 8787 was busy on the build machine and `PUBLIC_ORIGIN` must match; `pnpm` prints two header lines on stdout, so `pnpm perf app --sends` skips every sends line that is not JSON.

### How to run

- Unit and typecheck: `pnpm --filter @todz/perf test:unit` (162 tests in 19 files) and `pnpm --filter @todz/perf typecheck`; the gate is `pnpm verify`, which printed `9 gates green at cbf8807 (product)` on the lane's head before this line.
- Live, local only: start the Worker (runbook step 1; if 8787 is busy run `pnpm --filter @todz/api exec wrangler dev --port <n> --inspector-port <m>` with the `dev` script's `--var` settings and `PUBLIC_ORIGIN` for that port), then `pnpm perf load --port <n>`, `pnpm perf stress --port <n>`, `pnpm perf seed --tasks 5000 --projects 200 --port <n>`, `pnpm perf soak --minutes 1 --port <n>`.
- `pnpm perf production`, `pnpm perf production --cleanup <run>`, `pnpm perf app` and `pnpm perf tail <file>` are the lead's or the owner's: production is never run by the developer. `app` and `tail` can be tried on recorded text through their tests.

### Red today, green after

Every red commit adds stubs that throw `<name> is not implemented`, so typecheck stays green. Texts are what each red run printed.

| Test | Red before the change because | Green after because |
|------|--------------------------------|---------------------|
| `budgets.test.ts` | pin, green when it landed (`5e48794`) | the constants are ADR 0061's numbers |
| `percentiles.test.ts` (`7185fdd`) | 4 failed: `Error: percentileOf is not implemented` | `4d111db` |
| `schedule.test.ts` (`8a97b27`) | 8 failed: `plannedStarts`, `slotScenario` and `resolvedSlot is not implemented`; the rate-zero test: `expected [Function] to throw error including 'the rate must be positive' but got 'plannedStarts is not implemented'` | `17e3127` |
| `run-plan.test.ts` (`10a3d3d`) | 12 failed: `perfTargetOf`, `validatedPlan` and `scenarioAt is not implemented`; e.g. `expected [Function] to throw error including 'production is capped at 50 requests a second' but got 'validatedPlan is not implemented'` | `db750d8` |
| `timed-fetch.test.ts`, `report.test.ts` (`9bdd5c7`) | 20 failed: `serverTimingOf`, `timedFetch` and `reportRows is not implemented`; the header test: `expected '' to be 'scenario \| requests \| rate/s \| p50 ms…'` | `249cd1a` |
| `scenarios.test.ts`, `socket-headers.test.ts` (`36144f3`) | 24 failed: `connectMeasuredMcp` (9), `listWorkspaces` (2), `measureInitialize`, `openChangeFeed` (5), `openSocketSignals` (2), `seedFixture` (4), `signInOwner` `is not implemented` | `e0cc4f6` (Node's `WebSocket` sends `Authorization` on the upgrade, so the undici fallback of failure row L11 is not needed) |
| `open-loop.test.ts`, `keychain-key.test.ts`, `wire-guard.test.ts`, `production-run.test.ts` (`dc06d8b`) | 27 failed and 9 skipped (the production run's `beforeAll`): `runOpenLoop` (4), `readKeychainKey` (5), `guardedFetch` (7), `runProduction` (3), `cleanupProduction` (1) `is not implemented` | `d106e29`; a mutation that dropped the cleanup's prefix filter first passed, so the cleanup test gained a lookalike foreign title and then failed as it should |
| `probe-log.test.ts`, `tail-log.test.ts` (`75eb05f`) | 21 failed: `probeEventsOf`, the four checks, `arrivalLatencies` and `tailSummaryOf is not implemented` | `f5113e5` |
| `app-command.test.ts` (`a3960a7`) | 3 failed: `appChecks is not implemented` | `810c1e3` |
| `cli.test.ts`, `local-run.test.ts`, `stress.test.ts`, `soak.test.ts` (`bd1b251`) | 31 failed: `runCli` (15), `runLocalLoad` (6), `runSoak`, `runStress` (3), `stepBroke` (6) `is not implemented` | `7d85600` |
| `cli.test.ts` `--port` (`1a134dd`) | 2 failed: `expected false to be true` (the URLs kept port 8787) and `expected +0 to be 2` (a bad port was accepted) | `c496792` |
| `scenarios.test.ts` stream GET (`477b239`), found by the first live run | 3 failed: `expected [ [ 'list', 200 ], [ 'list', 405 ] ] to deeply equal [ [ 'list', 200 ] ]`, and two counts off by the extra row: the SDK opens its stream `GET` after `connect` returns, so a 2025-era client added a 405 to its scenario row | `c80c272` |
| `runbooks.test.ts` exception sentence (`277c7bd`) | 1 failed: `expected '# Runbooks…' to contain 'agents never run them, except \`deploy-the-api\`, the loop's steps of \`mintlify-publish\` and the loop's steps of \`performance\`'` | `7543f4a` |

### Hypotheses to attack

1. On the wire, the production run sends only `POST https://api.todz.app/mcp`: no `GET`, `DELETE`, discovery path, other origin or redirect, and nothing after 120 s. Attack: a server that answers 401, a 302, a stall, a 429; the SDK's behaviour after each.
2. The cleanup completes only tasks whose title starts with `todz-perf <run> #`, never a foreign one. The final `open tasks left` is the server's matched count for that text, so a foreign title that merely contains the prefix is counted but never completed (the cleanup test pins it as `1`). Attack: titles with the prefix in the middle, another run's identifier, Unicode lookalikes.
3. The key never reaches a report, a message, the sends file or a command line; a missing item, a non-zero exit or the 5 s timeout stops the run before any request. The tests use a fake `execFile`; the real `security` call and the `-T /usr/bin/security` behaviour are for the owner's Mac. Nothing here read the Keychain.
4. The change feed measures from the harness's own send time to the pull that holds the task. It started at the end of the hot project's changes, so the first pull is not 5,000 tasks. Attack: a socket that drops, a `changed` that arrives before the add's answer (covered), many `changed` bursts.
5. Only POST calls are timed; a 2025-era client's `initialize` is measured on its own (20 fresh clients, first request only). Attack: any row whose count is off by the handshake.
6. The fixed ten-slot mix, `done` becoming `list` when no add is answered (R19), the era split by blocks of ten slots, the owner share rotating workspaces, changes, add and complete, one project per round of four.
7. `pnpm perf production > sends.jsonl` also captures the two `pnpm` header lines; `app --sends` skips them. Attack: the real `log show` compact format against `probe-log.ts`'s `[<subsystem>:perf] <line>` pattern (untested against a real app until Lane A lands).
8. The local baseline: 50 requests a second for 120 s on the lane's head passed every scenario; stress held 169 and broke at 253 (budget 200). Re-run both; the verdict is the lead's after merge.

### Known gaps

- Nothing ran against production, and the Keychain item was never read; `production`, `production --cleanup` and the app joins are proven on fakes only.
- `probe-log.ts` assumes the compact `log show` shape `[<subsystem>:perf] <name> key=value…`, and `tail-log.ts` assumes `outcome` and `cpuTime` per event line; neither was checked against real output. Lane A's probe and a real `wrangler tail` are the proof.
- The stress break at 253 a second cannot be split between the local runtime and the client (one Node process drives it); the Worker's own log shows every route slowed together. `Server-Timing` (Lane S) is the split; the harness already prints the two medians once the header exists.
- The baseline rows were taken on the lane's head `c80c272` against a `wrangler dev` on port 8791; its product code is `feat/performance`'s (`b2d147c`), but step 19 asks for the rows on `feat/performance` after the merge, which the lead may repeat.
- Runbook steps 4 to 8 (the app, the model benchmark, Lighthouse) and 9 to 13 (production, Keychain) were written, not run.
- The first live run found one defect the fakes had hidden (the stream `GET`, red `477b239`); a second class of difference between the fake MCP server and the real Worker may remain, for example how the real handler frames a `tools/call` answer.

## Lane S

### What changed

- `Server-Timing` on `/mcp` and `/owner` answers: `apps/api/src/server-timing.ts` (`timedEnv`, `serveTimed`), `apps/api/src/timed-call.ts`, `withTimedProjects` in `apps/api/src/project-routing.ts`, wired in `apps/api/src/index.ts`. The header is `directory;dur=<ms>, project;dur=<ms>` with one decimal; none on a 401 and none on the socket's 101. **Answer mode (step 20):** a 2026-era `tools/call` answers `application/json`; a 2025-era one answers `text/event-stream`, so the stream is read to its end before the header is set and the same bytes are answered.
- Work budgets in `pnpm verify`'s `unit` gate: `apps/api/test/budget-counters.ts`, `apps/api/test/budgets/budget-limits.ts` and `work-budgets.test.ts` count D1 round trips and statements, Durable Object calls and SQLite rows read on a 5,000-task project (100 open, 4,900 done, 10,000 history rows, seeded by one transactional insert).
- C1 to C3, version 3: `TaskStore` gained `firstOrderKey`, `lastOrderKey`, `orderKeyBefore` and `orderKeyAfter` (each excluding the moving task); `add-tasks.ts` and `update-task.ts` use them in place of `listAllTasks` (removed). The project schema's version 3 is one migration with `tasks_order`, `tasks_state_order` and `task_history_task`. Rows read on the 5,000-task project: add 15,008 to 9, update 15,007 to 8 or 9, list open, next and due now 5,100 to 100, read history 10,001 to 4; read changes from 0 stays 102.
- C4 (owner project route, 2 to 1 round trips): `resolveSessionOwner` takes the route's `projectId` and answers session and ownership in one statement; the `SessionOwner` it returns carries the ownership it checked, so `findOwnedProjectId` does not ask again. The other-owner 404 costs the same one round trip. C5 (2025-era call, 2 to 1 round trips): `openKeyProject` takes an optional `mcpSession` and reads the key and the session in one `DIRECTORY.batch`; `findSessionClientName` is gone.
- Test-support changes: `connectClient` takes `onResponse` and `serve`; two existing "a row that does not map" tests complete a task instead of adding one (an add no longer reads every row), in a pin commit.
- Not done, awaiting Lane L's baseline: step 27's shares, C6 to C9 (step 28), step 29 (stress), step 30 (landing, also waits on `landing-seo`).

### How to run

- `pnpm --filter @todz/api typecheck`, `pnpm --filter @todz/api test:unit`, `pnpm --filter @todz/core test:unit`, `pnpm --filter @todz/api test:e2e` (the e2e specs are the site's, untouched), `pnpm verify`.
- Work budgets alone: `pnpm --filter @todz/api exec vitest run test/budgets`. Server-Timing alone: `... vitest run test/server-timing.test.ts`. Schema: `... vitest run test/project-schema.test.ts`.

### Red today, green after

Failure texts are what the red run printed. Pins (green when they landed) are marked.

| Test | Red before the change because | Green after because |
|------|--------------------------------|---------------------|
| `server-timing.test.ts` (red `9ee6d87`, green `41af1b8`) | `Error: timedEnv is not implemented`; four answers: `TypeError: .toMatch() expects to receive a string, but got object` (no `Server-Timing` header). The 401 (owner and MCP) and 101 cases are pins. | the proxies time the directory and the project store; the header is set before `withSecurityHeaders`. |
| `budgets/work-budgets.test.ts` rows (pin `9cf6643`, red `f135eb3`, green `6c5936e`) | `expected 15008 to be less than or equal to 10` (add), `expected 15007 ... 10` (update first and last), `expected 5100 ... 105` (list open, next, due now), `expected 10001 ... 7` (read history) | nine rows green together once version 3 holds the indexes; the new reads alone leave them red (`ec8deaa` still printed 10,008 for add) |
| `in-memory-task-store.test.ts` and `sqlite-task-store.test.ts` "order key reads" (red `77465a1`, green `ec8deaa`) | `Error: firstOrderKey is not implemented`, `Error: orderKeyBefore is not implemented` (6 core tests, 7 API tests) | the reads answer what `listAllTasks` gave. The three `update-task.test.ts` placement tests of that commit are pins. |
| `project-schema.test.ts` (red `71c9d65`, green `6c5936e`) | `expected 2 to be 3`; `expected [ { version: 2 } ] to deeply equal [ { version: 3 } ]`; `expected [ 'tasks_change_number' ] to deeply equal ArrayContaining`; `expected [ 2 ] to deeply equal [ 3 ]`. "left alone" and "every use case answers as on version 2" are pins. | version 3 migration. |
| `work-budgets.test.ts` C4 and C5 rows (red `db7c15d`, green `7d676d4`) | `expected 2 to be less than or equal to 1` (owner project route, other-owner 404, unknown 2025-era session, 2025-era `list` and `next`) | one statement for session and ownership; one batch for key and session. |
| `project-store.test.ts` and `edge-cases.test.ts` "a row that does not map" (pin `432b691`) | not red: green before and after | they use a completion because an add no longer maps every row |

### Hypotheses to attack

1. Every `/mcp` and `/owner` answer other than a 401 or a socket carries `Server-Timing` with both durations, and the project duration is above zero on a `tools/call` in both eras; the streamed 2025-era answer has the same bytes as without the header (compare `serveMcp` against the Worker on an `initialize`).
2. No answer changed except for the header: every existing API and core test is green, apart from the two re-aimed tests above. Try an add on a project whose task row does not map (`UPDATE tasks SET created_by_kind = 'agent', created_by_client = NULL`): it now succeeds where it used to throw; confirm that is acceptable.
3. Placement is unchanged: move tasks with `first`, `last`, `before` and `after`, onto and away from the first and last position, with open and done tasks mixed, against the previous behaviour (`git show 77465a1:libs/core/src/update-task.ts` ran on `listAllTasks`).
4. Version 3 is additive: open a project store at version 2 with data (the migration test does), roll the code back to `main` against a version-3 store and use every tool and route; nothing errors and no migration statement runs.
5. A session of owner A reaching a project of owner B on `/owner/projects/<B's project>/...` answers 404, never 200 and never 401, in one round trip, for every project route (changes, history, tasks, keys, socket, rename); an expired or unknown session still answers 401; a session of one key with another key's session id answers 404 `session not found` and a revoked key 401.
6. The `SessionOwner` brand: a handler that builds its own owner object still gets `null` from `findOwnedProjectId`; the checked ownership of one project is never reused for another project id.
7. `Server-Timing` leaks nothing a caller cannot already time, but it also appears on public `/owner` routes (`POST /owner/sessions`, sign-in links); the security reviewer should decide whether those should drop it.

### Known gaps

- The budget rows hold at today's counts on the in-process Workers pool; the production round trips and CPU come from Lane L's harness and `wrangler tail`, not from here.
- `performance.now()` in a Worker advances only on I/O; a project duration of `0.0` is possible for a store call that answers from memory in production.
- `findMcpSessionClient` in `directory.ts` is only used by its own test now (the batch path replaced its caller); left in place because `directory.test.ts` covers the session query through it.
- The 5,000-task project is seeded with order keys `a0NNNNNV`, not the keys the API would have issued; placement budgets measure reads, not key length.
- Steps 27 (shares), C6 to C9, 29 and 30 are open: "awaiting the baseline".

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
