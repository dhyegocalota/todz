# Test plan: Performance

Every checkbox states the input and the exact expected outcome. A ticked box carries evidence after ` — evidence: ` (commit hash, log path, counts, screenshot path).

The budgets are ADR 0061 § 1. "The 5,000-task project" is 100 open and 4,900 done tasks with 10,000 history rows, seeded by one transactional SQL insert inside `runInDurableObject`, unless a row says otherwise. Local runs use `pnpm --filter @todz/api dev` on `:8787`. Budget constants live in `apps/api/test/budgets/budget-limits.ts`; "at or under" means the count is `<=` the named constant.

## The failing test first

- [ ] `tools/perf/src/percentiles.test.ts` — input: `[1…100]` at 95; expected: red with `percentileOf is not implemented` at the red commit, `95` after.
- [ ] `tools/perf/src/run-plan.test.ts` — input: a production plan at 51 a second; expected: red at the red commit, then throws `production is capped at 50 requests a second`.
- [ ] `tools/perf/src/wire-guard.test.ts` — input: the SDK asks the production `fetch` for `GET https://api.todz.app/.well-known/oauth-protected-resource`; expected: red at the red commit, then throws `production sends only POST https://api.todz.app/mcp` and the recording transport saw zero requests.
- [ ] `tools/perf/src/keychain-key.test.ts` — input: `execFile` exiting 44; expected: red at the red commit, then throws `the todz-perf-key Keychain item is missing` and the injected transport saw zero requests.
- [ ] `apps/api/test/server-timing.test.ts` — input: an MCP `tools/call` `list` with a valid key; expected: red with `timedEnv is not implemented`, then the answer's `Server-Timing` matches `directory;dur=\d+(\.\d+)?, project;dur=\d+(\.\d+)?` with `project` greater than 0.
- [ ] `apps/api/test/budgets/work-budgets.test.ts` (C1 rows) — input: one `add` on the 5,000-task project; expected: red at step 23's commit with the rows-read count the run printed (about 5,000 or more), at or under 10 after step 26.
- [ ] `apps/api/test/budgets/work-budgets.test.ts` (C2, C3 rows) — input: `list` open with limit 20 on the 5,000-task project; expected: red at step 23's commit (about 5,000 rows read), at or under 105 after step 26; `readHistory` of a task with 2 history rows among 10,000: at or under 7 after.
- [ ] `apps/api/test/project-schema.test.ts` (version 3) — input: a fresh store; expected: red at step 25's commit (version 2, no new index), version 3 with the three indexes after step 26.
- [ ] TodzKit `ModelBudgetTests` — input: the 5,000-task model of plan step 35; expected: red at step 35's commit with the printed counts (views built 10 for ten reads, 1 main-actor project-file write per pulled task, 10 writes for ten saves); after steps 36 and 37: 1, 0 and at most 2.
- [ ] Confirmed each red fails for the right reason: the recorded failure is the stub's message or the budget assertion naming the count, never a type error, a missing import or a timeout. The tester checks out each red commit in a throwaway worktree and compares.

## Unit

- [ ] `tools/perf/src/percentiles.test.ts::nearest rank` — input: `[1…100]` at 50, 95, 99; expected: `50`, `95`, `99`.
- [ ] Edge: one sample — input: `[7]` at 50, 95 and 99; expected: `7` each.
- [ ] Edge: unsorted — input: `[100…1]` at 95; expected: `95`.
- [ ] Edge: empty — input: `[]`; expected: throws `no samples`.
- [ ] `tools/perf/src/schedule.test.ts::open model` — input: 50 a second for 1,000 ms; expected: 50 offsets `0, 20, …, 980`, whatever the answers' latencies.
- [ ] Edge: zero rate — input: `ratePerSecond: 0`; expected: throws `the rate must be positive`.
- [ ] `schedule.test.ts::mix` — input: 100 slots; expected: exactly 40 `list`, 20 `add`, 20 `done`, 20 `owner`.
- [ ] Edge: `done` before any `add` answered — input: slot 3 with the add of slot 1 still in flight; expected: slot 3 is sent as a `list` and counted in the `list` row; the run's rate stays 50 a second (R19).
- [ ] `run-plan.test.ts::origins` — input: `local`, `production`, `staging`; expected: `http://localhost:8787`, `https://api.todz.app`, a parse failure.
- [ ] Edge: production duration — input: 120,001 ms; expected: throws `production is capped at 120 seconds`; 120,000 ms is accepted.
- [ ] Edge: production scenario — input: a plan with `owner`; expected: throws `production runs MCP only`; with `socket`, the same.
- [ ] Edge: stress on production — input: `stress` with `PerfTarget.Production`; expected: throws `stress runs on local only`.
- [ ] `run-plan.test.ts::add cutoff` — input: a 120 s production plan; expected: no `add` at or after 100,000 ms, only `done` slots from there to the end.
- [ ] `wire-guard.test.ts::refused before sending` — input, each on its own: `GET /mcp`, `DELETE /mcp`, `POST https://api.todz.app/owner/workspaces`, `POST https://evil.example/mcp`, `POST http://api.todz.app/mcp`; expected: each throws `production sends only POST https://api.todz.app/mcp`, zero requests recorded.
- [ ] `wire-guard.test.ts::no redirect` — input: a `POST /mcp` answered 307 to another URL; expected: the request was sent with `redirect: 'error'`, a failure is recorded, and no second request exists.
- [ ] `wire-guard.test.ts::401` — input: a `tools/call` answered 401; expected: exactly one request on the wire, one failure, no discovery, no retry.
- [ ] `wire-guard.test.ts::in flight` — input: a transport holding every answer, 60 slots planned in 1.2 s; expected: 50 requests in flight, 10 slots recorded `dropped`.
- [ ] `wire-guard.test.ts::stalled server` — input: a transport that never answers, a 120 s run on an injected clock; expected: every request aborted at 120 s and nothing sent after 120 s, cleanup included.
- [ ] `timed-fetch.test.ts::status classes` — input: answers 200, 503 and a thrown `TypeError`; expected: one latency each for 200 and 503, one 5xx, one failure with status `0`.
- [ ] `timed-fetch.test.ts::server timing` — input: `Server-Timing: directory;dur=12, project;dur=30`; expected: `{ directory: 12, project: 30 }`; absent header → `null`.
- [ ] `report.test.ts::verdicts` — input: p95 149, p99 399, 0 5xx; expected: `PASS`. Input: p95 150; expected: `FAIL`. Input: p99 400; expected: `FAIL`. Input: one 5xx; expected: `FAIL`.
- [ ] `report.test.ts::row` — input: one scenario with `Server-Timing` on its answers; expected: the columns `scenario | requests | rate/s | p50 ms | p95 ms | p99 ms | max ms | 5xx | directory ms | project ms | verdict` in that order, integers for milliseconds, the two split columns the medians; without the header, those two empty.
- [ ] `scenarios.test.ts::modern era on the wire` — input: two `tools/call` `list`; expected: exactly two `POST /mcp`, no `GET`, no `DELETE`, no `initialize`.
- [ ] `scenarios.test.ts::legacy era on the wire` — input: two `tools/call` `list`; expected: the handshake requests exactly as the test lists them (`initialize` first), both calls carry the `Mcp-Session-Id` the `initialize` answer gave, and no handshake request is in the `list` row.
- [ ] `scenarios.test.ts::owner` — input: one owner slot of each kind; expected: the four paths of plan step 11, each with `Authorization: Bearer <session>`.
- [ ] `scenarios.test.ts::change feed` — input: send at 100, `changed` at 150, task in the pull at 180 (injected clock); expected: `80`.
- [ ] Edge: change feed, `changed` without the task in the first page — input: the task arrives on the second page at 260; expected: `160`.
- [ ] `scenarios.test.ts::seed` — input: 5,000 tasks; expected: 100 `POST …/tasks` of 50 drafts each. Input: the many-projects owner; expected: 20 workspaces, 200 projects with the Inboxes.
- [ ] `socket-headers.test.ts` — input: a `node:http` server on an ephemeral port accepting the upgrade, Node's `WebSocket` opened with `{ headers: { Authorization: 'Bearer probe' } }`; expected: the server recorded `authorization: Bearer probe`.
- [ ] `keychain-key.test.ts::command` — input: any run; expected: `execFile` called once with `security`, `['find-generic-password', '-s', 'todz-perf-key', '-w']` and a 5,000 ms timeout.
- [ ] Edge: Keychain dialog — input: `execFile` that never returns, injected clock past 5,000 ms; expected: throws `the todz-perf-key Keychain item is missing`, zero requests.
- [ ] `production-run.test.ts::no leak` — input: the key `todz_leakprobe…`; expected: absent from the report, every thrown message and the sends file.
- [ ] `production-run.test.ts::run identifier` — input: a run with identifier `r1`, slot 4 an `add`; expected: the title `todz-perf r1 #4` and the idempotency key `todz-perf-r1-4`.
- [ ] `production-run.test.ts::cleanup only touches its own` — input: the Inbox holds open `Buy milk`, `todz-perf r0 #1` and the run's `todz-perf r1 #2`, `#6`; expected: only `#2` and `#6` are completed; `Buy milk` and `todz-perf r0 #1` stay open.
- [ ] `production-run.test.ts::lost add` — input: the `add` of slot 8 times out on the client but the server kept it; expected: the tail's filtered `list` finds `todz-perf r1 #8` and completes it.
- [ ] `production-run.test.ts::open count` — input: after cleanup the final `list` with `text` `todz-perf r1` answers `totalMatched` 0; expected: `open tasks left: 0`; answering 3; expected: `open tasks left: 3` and exit 1.
- [ ] `production-run.test.ts::cleanup command` — input: `production --cleanup r1`; expected: only filtered `list` and `done` requests, at most 50 a second, none after 60 s.
- [ ] `production-run.test.ts::sends file` — input: 3 answered adds numbered 7, 8, 9; expected: three JSON lines `{"number":7,"sentAtMs":…}` in order.
- [ ] `probe-log.test.ts::launch` — input: `[620, 700, 710, 690, 1_600]`; expected: median 700, max 1,600, `FAIL`; `[620, 700, 710, 690, 900]` → `PASS`.
- [ ] `probe-log.test.ts::scroll` — input: 600 frames, 5 over budget, worst 42; expected: `PASS`; 7 over budget → `FAIL`; worst 51 → `FAIL`.
- [ ] `probe-log.test.ts::footprint` — input: 180 MB at 5 minutes, 199 MB at 30; expected: `FAIL`; 197 MB → `PASS`.
- [ ] `probe-log.test.ts::join` — input: send `{7, 1_000}`, arrival `task-arrived number=7 at-ms=1_640`; expected: `640`. Edge: an arrival with no send → ignored; a send with no arrival → counted as `missing` and the verdict is `FAIL`.
- [ ] Edge: foreign log lines — input: lines of category `default` and of another subsystem; expected: ignored.
- [ ] `tail-log.test.ts` — input: tail events with outcomes `ok` ×98, `exceededCpu` ×1, `exception` ×1 and `cpuTime` 1…100; expected: the three counts and `cpuTime` p50 50, p99 99.
- [ ] `cli.test.ts` — input: `pnpm perf nonsense`; expected: usage on stderr, exit 2. Input: `stress --target production`; expected: exit 2 and zero requests. Input: `load` with one failing scenario; expected: exit 1.
- [ ] `apps/api/test/server-timing.test.ts::refused` — input: `/mcp` without a key; expected: 401 with no `Server-Timing`.
- [ ] `server-timing.test.ts::socket` — input: the change feed's upgrade with a valid session; expected: 101 with its `webSocket`, no `Server-Timing`.
- [ ] `server-timing.test.ts::bytes` — input: a `tools/call` answer, with and without the timing wrap; expected: identical bodies; the answer mode (JSON or SSE) step 20 recorded is named in the test.
- [ ] `work-budgets.test.ts::round trips and statements` — input: one owner project route, one `tools/call` per era, `next` with the nudge on, `GET /owner/workspaces` for 200 projects; expected: each round-trip, statement and Durable Object count at or under its constant; after C4 the owner project route at 1 round trip; after C5 the 2025-era call at 1 round trip and 2 statements.
- [ ] `work-budgets.test.ts::counter sees a batch` — input: a `DIRECTORY.batch` of two statements in a probe; expected: 1 round trip, 2 statements.
- [ ] `project-schema.test.ts::version 3` — input: a fresh store; expected: version 3 and the indexes `tasks_order`, `tasks_state_order`, `task_history_task`. Input: a version-2 store with 3 tasks and their history; expected: version 3 and the same rows. Input: a version-3 store; expected: unchanged.
- [ ] `project-schema.test.ts::backout` — input: a version-3 store opened with the version-2 migration list; expected: no statement runs, and `add`, `list`, `next`, `dueNow`, `readChanges` and `readHistory` answer as on version 2.
- [ ] `libs/core` order reads — input: an empty store, one task, 5 tasks; expected: the first, last, before and after order keys (`null` where none), excluding the moving task, equal to what `listAllTasks` gave.
- [ ] Edge: the moving task is the first neighbour — input: move the first task `after` the second, and `first` while already first; expected: the same order keys `listAllTasks` gave.
- [ ] Edge: the moving task is the last neighbour — input: move the last task `before` the one above it, and `last` while already last; expected: the same order keys.
- [ ] Edge: anchor equal to the moving task — input: `after` itself; expected: `RuleViolation` `PlacementAnchorInvalid`, unchanged.
- [ ] Edge: missing anchor — input: `before` task 999; expected: `TaskNotFoundError(999)`, unchanged.
- [ ] Edge: `add` to an empty project — input: the first task; expected: the order key `listAllTasks` gave.
- [ ] C8 pages per sync (only if C8 is selected) — input: a first sync of the 5,000-task project; expected: 50 pages before the change, the new count after, at or under its constant.
- [ ] TodzKit `PerfProbeLineTests` — input: each event; expected: exactly `launch-ready ms=640`, `scroll frames=600 over-budget=3 worst-ms=55 refresh-ms=17`, `footprint mb=180`, `task-arrived number=7 at-ms=1700000000640`.
- [ ] TodzKit `PerfProbeSwitchTests` — input: `["Todz", "-TodzPerfProbe", "YES"]`; expected: on. Input: `[]`, `["-TodzPerfProbe"]`, `["-TodzPerfProbe", "NO"]`, and `[]` with `TodzPerfProbe` set in `UserDefaults`; expected: off each.
- [ ] TodzKit `HitchCounterTests` — input: 600 frames at 60 Hz with one 55 ms and two 30 ms gaps; expected: 3 over budget, worst 55. At 120 Hz with one 14 ms gap; expected: 1 over budget.
- [ ] TodzKit `AppModelTests+Pull::arrivals` — input: a pull bringing tasks 3 and 4 of the shown project; expected: `3` and `4` once each; a pull of another project: nothing; a second pull with nothing new: nothing.
- [ ] TodzKit stored views, midnight — input: views read at 23:59, the clock moved to 00:01; expected: the next read's `today` is the new day's.
- [ ] TodzKit stored views, time zone — input: the time zone changed from UTC to Asia/Kolkata across a day boundary; expected: the next read's `today` follows it.
- [ ] TodzKit stored views, lingering — input: a task completed inside `CompletionLingers`' window; expected: it still shows where it was, and leaves after the window.
- [ ] TodzKit cache writer, two projects — input: writes queued for projects p1 (values a, b) and p2 (values c, d); expected: the store ends with p1 = b and p2 = d.
- [ ] TodzKit cache writer, sign-out — input: writes queued, then sign-out; expected: nothing reaches the store after its wipe.
- [ ] TodzKit cache writer, server switch — input: writes queued, then a switch to another server; expected: nothing of the old server reaches the new one's store.
- [ ] TodzKit cache writer, termination — input: writes queued, then `flush()`; expected: every project's last value is in the store when `flush()` returns.
- [ ] TodzKit cache writer, owner not confirmed — input: ten saves before the owner is confirmed; expected: zero writes.
- [ ] `scripts/verify.test.sh` — input: `classify tools/perf/src/x.ts`; expected: `product` with `typecheck unit`.
- [ ] `runbooks.test.ts` — input: the new runbook; expected: every step has `If it fails:`, every `pnpm` command it names exists, and the index sentence names `performance`.

## E2E (Playwright specs)

- [ ] None: the feature changes no page. The landing's numbers come from Lighthouse (runbook step 8), and `apps/api/e2e/` stays green unchanged in the `e2e` gate.

## Prove it for real — the runbook's walks

The browser walk of the template does not apply; these runs are its equivalent and every number lands in the runbook's results table, with the hot project's done count.

- [ ] Local load, before (step 19) and after (step 40): `pnpm perf load`; expected: one row per scenario (`mcp-list-legacy`, `mcp-list-modern`, `mcp-add`, `mcp-done`, `mcp-initialize`, `owner`, `change-feed`, `many-projects`); after the fixes every row `PASS` (p95 under 150 ms, p99 under 400 ms, zero 5xx; change feed p95 under 1,000 ms), or the miss named with its next candidate.
- [ ] Stress, local (steps 19 and 29): `pnpm perf stress`; expected: the last step that held and the first that broke, with the breaking resource named; after the fixes the breaking point is at least 200 a second, or the shortfall is recorded with its cause.
- [ ] Empty: `pnpm perf load` against a stack with no seed yet; expected: the run seeds first and prints the seed's counts before any timed request.
- [ ] Single: an owner with one project and one task, `next` with the nudge on; expected: the `Server-Timing` of one answer names both stores.
- [ ] Many: the 200-project owner; expected: the `many-projects` row `PASS`, and `GET /owner/workspaces` answers 200 with 200 projects.
- [ ] Rejected input: `pnpm perf production` with no Keychain item; expected: `the todz-perf-key Keychain item is missing`, exit non-zero, zero requests (checked with `wrangler tail` showing no `/mcp` request from the run's window).
- [ ] Rejected input: `pnpm perf stress --target production`; expected: refused before any request.
- [ ] Two clients at once: the change feed with the app open on the hot project and the harness adding through MCP; expected: `pnpm perf app` joins every arrival and the p95 is under 1,000 ms.
- [ ] Disconnect: stop `wrangler dev` for 10 s mid-run, then start it; expected: the run reports the failures in its rows (status `0`), never hangs past its duration, and exits 1.
- [ ] App model medians (steps 34 and 39): `TODZ_BENCHMARK=1 swift test … --filter ModelBenchmark`; expected: three medians printed and recorded; after the fixes each under 8 ms, or the miss named.
- [ ] App cold launch (steps 34 and 39): five background launches; expected: median under 1,000 ms, none over 1,500 ms after the fixes.
- [ ] App scroll (steps 34 and 39): one scripted scroll over 5,000 rows; expected: no frame over 50 ms and at most 1% over 1.5 refresh intervals after the fixes.
- [ ] App soak (steps 34 and 39): 30 minutes of `pnpm perf soak`; expected: footprint at 30 minutes within 10% of 5 minutes.
- [ ] App without the probe: one `open -g` launch without arguments; expected: `log show` finds no line of category `perf` from that launch.
- [ ] The landing (step 30): three Lighthouse runs on the phone profile; expected: median LCP under 2.5 s, CLS under 0.1, TBT under 200 ms; before `landing-seo` merges, "waiting on landing-seo".
- [ ] Production baseline (step 41): `pnpm perf production`; expected: at most 50 a second for at most 120 s, every row's verdict recorded without a `Server-Timing` split (not yet deployed), the tail's outcomes and `cpuTime` p50 and p99 recorded, zero `exceededCpu` and zero `exception`, `open tasks left: 0` from the final filtered list.
- [ ] Production after (step 44): the same, now with the `directory` and `project` columns filled.
- [ ] Production cleanup filter, for real (step 41 or 44): before the run the owner's `todz-perf` Inbox holds one task he added by hand; expected: after the run it is still open.
- [ ] Production change feed (step 44, owner present): `pnpm perf app --sends …`; expected: every send joined, p95 under 1,000 ms.
- [ ] Console and output clean: no key, session or task title in any harness output or probe line (grep the run logs for `todz_` and for the seed's titles: zero matches).

## Edge cases found during execution

Empty on purpose. The tester adds one checkbox per new case (input, exact expected outcome) and a regression test for each.

## Adversarial review

The reviewer picks the three claims most likely to be wrong and tries to refute each.

- [ ] Claim 1: the production run can never exceed 50 requests a second or 120 s, nor reach anything but `POST https://api.todz.app/mcp` — attack: read every path from the CLI to the wire for a way around `wire-guard.ts` (a flag, an environment variable, a retry, the SDK's own requests, a redirect, the cleanup tail); result: <refuted | held>
- [ ] Claim 2: the work-count budgets catch a new round trip or a full scan — attack: add a second `findOwnedProject` call to an owner route, and a `SELECT * FROM tasks` to `add`, in a throwaway worktree, and run the `unit` gate; result: <refuted | held>
- [ ] Claim 3: the order reads of step 24 place every task exactly where `listAllTasks` did — attack: compare both implementations on random stores (open and done mixed, every placement, every anchor) in a throwaway test; result: <refuted | held>

## Coverage honesty

What is not tested and why.

- Production owner API and change-feed latency under load — the loop holds no owner session in production (ADR 0061 § 5); the change feed is checked once in the smoke walk with the owner's app, the owner API not at all under load.
- Local latencies are not production latencies — `wrangler dev` has no network, a local D1 that is a file, and one isolate; the budgets' acceptance is the production run, and local rows serve before/after comparison and stress. C4 and C5 are fixed by the round-trip rule, not by a local number.
- CPU time per request — `wrangler dev` does not enforce the 10 ms Free-plan limit; only `wrangler tail` in production shows `cpuTime` and `exceededCpu`.
- The production baseline's attribution — `Server-Timing` ships with this feature, so the "before" rows in production have only `cpuTime`.
- The app's 8 ms model budget — measured by a benchmark the runbook runs, never asserted in the gate, because a timing on a busy Mac is noise; the gate holds the counters.
- The landing's field Web Vitals (real INP) — no analytics runs on the landing; TBT in the lab stands in.
- SwiftUI rendering cost — no unit test sees it; the scroll walk's frame numbers stand in for the app-target views, on the owner's Mac and display.
- The app's cold launch from a cold disk cache — `purge` needs root, which the loop does not use; "cold" means the process is not running.
- Memory over days, not 30 minutes — the soak is the longest run the owner's Mac hosts without disturbing him.
- Stress beyond one Mac's ability to generate load — the ramp stops where either the server or the generator saturates; the runbook row says which, from the generator's own CPU.
