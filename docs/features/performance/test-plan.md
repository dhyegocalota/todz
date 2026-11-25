# Test plan: Performance

Every checkbox states the input and the exact expected outcome. A ticked box carries evidence after ` — evidence: ` (commit hash, log path, counts, screenshot path).

The budgets are ADR 0061 § 1. "The 5,000-task project" is 100 open and 4,900 done tasks with 10,000 history rows unless a row says otherwise. Local runs use `pnpm --filter @todz/api dev` on `:8787`.

## The failing test first

- [ ] `tools/perf/src/percentiles.test.ts` — input: `[1…100]` at 95; expected: red with `percentileOf is not implemented` at the red commit, `95` after.
- [ ] `tools/perf/src/run-plan.test.ts` — input: a production plan at 51 a second; expected: red at the red commit, then throws `production is capped at 50 requests a second`.
- [ ] `tools/perf/src/keychain-key.test.ts` — input: `execFile` exiting 44; expected: red at the red commit, then throws `the todz-perf-key Keychain item is missing` and the injected transport saw zero requests.
- [ ] `apps/api/test/server-timing.test.ts` — input: an MCP `tools/call` `list` with a valid key; expected: red with `timedEnv is not implemented`, then the answer's `Server-Timing` matches `directory;dur=\d+(\.\d+)?, project;dur=\d+(\.\d+)?`.
- [ ] `apps/api/test/budgets/work-budgets.test.ts` (C1 row) — input: one `add` on the 5,000-task project; expected: red at step 23's commit with the rows-read count the run printed (about 5,000 or more), at most 10 after step 24.
- [ ] `apps/api/test/budgets/work-budgets.test.ts` (C2, C3 rows) — input: `list` open with limit 20 on the 5,000-task project; expected: red at step 25's commit (about 5,000 rows read), at most 105 after step 26; `readHistory` of a task with 2 history rows among 10,000: at most 7 after.
- [ ] TodzKit `ModelBudgetTests` — input: the 5,000-task model of plan step 35; expected: red at step 35's commit with the printed medians and a build count of 10 for (d), green after steps 36 and 37 (each median under 8 ms, build count 1).
- [ ] Confirmed each red fails for the right reason: the recorded failure is the stub's message or the budget assertion naming the count, never a type error, a missing import or a timeout. The tester checks out each red commit in a throwaway worktree and compares.

## Unit

- [ ] `tools/perf/src/percentiles.test.ts::nearest rank` — input: `[1…100]` at 50, 95, 99; expected: `50`, `95`, `99`.
- [ ] Edge: one sample — input: `[7]` at 50, 95 and 99; expected: `7` each.
- [ ] Edge: unsorted — input: `[100…1]` at 95; expected: `95`.
- [ ] Edge: empty — input: `[]`; expected: throws `no samples`.
- [ ] `tools/perf/src/schedule.test.ts::open model` — input: 50 a second for 1,000 ms; expected: 50 offsets `0, 20, …, 980`, whatever the answers' latencies.
- [ ] Edge: zero rate — input: `ratePerSecond: 0`; expected: throws `the rate must be positive`.
- [ ] `schedule.test.ts::mix` — input: 100 slots; expected: exactly 40 `list`, 20 `add`, 20 `done`, 20 `owner`.
- [ ] Edge: `done` before any `add` answered — input: slot 3 with the add of slot 1 still in flight; expected: recorded `skipped`, counted in neither latency nor failures.
- [ ] `run-plan.test.ts::origins` — input: `local`, `production`, `staging`; expected: `http://localhost:8787`, `https://api.todz.app`, a parse failure.
- [ ] Edge: production duration — input: 120,001 ms; expected: throws `production is capped at 120 seconds`; 120,000 ms is accepted.
- [ ] Edge: production scenario — input: a plan with `owner`; expected: throws `production runs MCP only`; with `socket`, the same.
- [ ] Edge: stress on production — input: `stress` with `PerfTarget.Production`; expected: throws `stress runs on local only`.
- [ ] `timed-fetch.test.ts::status classes` — input: answers 200, 503 and a thrown `TypeError`; expected: one latency each for 200 and 503, one 5xx, one failure with status `0`.
- [ ] `timed-fetch.test.ts::server timing` — input: `Server-Timing: directory;dur=12, project;dur=30`; expected: `{ directory: 12, project: 30 }`; absent header → `null`.
- [ ] `report.test.ts::verdicts` — input: p95 149, p99 399, 0 5xx; expected: `PASS`. Input: p95 150; expected: `FAIL`. Input: p99 400; expected: `FAIL`. Input: one 5xx; expected: `FAIL`.
- [ ] `report.test.ts::row` — input: one scenario; expected: the columns `scenario | requests | rate/s | p50 ms | p95 ms | p99 ms | max ms | 5xx | verdict` in that order, integers for milliseconds.
- [ ] `scenarios.test.ts::legacy era` — input: two `tools/call` `list`; expected: one `initialize` first, then both calls carry the `Mcp-Session-Id` it returned; the handshake's requests are not in the `list` row.
- [ ] `scenarios.test.ts::modern era` — input: two `tools/call` `list`; expected: no `initialize`, two requests.
- [ ] `scenarios.test.ts::owner` — input: one owner slot of each kind; expected: the four paths of plan step 11, each with `Authorization: Bearer <session>`.
- [ ] `scenarios.test.ts::change feed` — input: send at 100, `changed` at 150, task in the pull at 180 (injected clock); expected: `80`.
- [ ] Edge: change feed, `changed` without the task in the first page — input: the task arrives on the second page at 260; expected: `160`.
- [ ] `scenarios.test.ts::seed` — input: 5,000 tasks; expected: 100 `POST …/tasks` of 50 drafts each. Input: the many-projects owner; expected: 20 workspaces, 200 projects with the Inboxes.
- [ ] `keychain-key.test.ts::command` — input: any run; expected: `execFile` called once with `security`, `['find-generic-password', '-s', 'todz-perf-key', '-w']`.
- [ ] `production-run.test.ts::no leak` — input: the key `todz_leakprobe…`; expected: absent from the report, every thrown message and the sends file.
- [ ] `production-run.test.ts::only MCP` — input: a full run; expected: every request is `POST https://api.todz.app/mcp`.
- [ ] `production-run.test.ts::cleanup` — input: 30 adds answered, 25 dones answered; expected: 5 more `done` calls before the end, then `open tasks left: 0`; `--cleanup` alone sends only `done`.
- [ ] `production-run.test.ts::sends file` — input: 3 answered adds numbered 7, 8, 9; expected: three JSON lines `{"number":7,"sentAtMs":…}` in order.
- [ ] `probe-log.test.ts::launch` — input: `[620, 700, 710, 690, 1_600]`; expected: median 700, max 1,600, `FAIL`; `[620, 700, 710, 690, 900]` → `PASS`.
- [ ] `probe-log.test.ts::scroll` — input: 600 frames, 5 over budget, worst 42; expected: `PASS`; 7 over budget → `FAIL`; worst 51 → `FAIL`.
- [ ] `probe-log.test.ts::footprint` — input: 180 MB at 5 minutes, 199 MB at 30; expected: `FAIL`; 197 MB → `PASS`.
- [ ] `probe-log.test.ts::join` — input: send `{7, 1_000}`, arrival `number=7 at-ms=1_640`; expected: `640`. Edge: an arrival with no send → ignored; a send with no arrival → counted as `missing` and the verdict is `FAIL`.
- [ ] Edge: foreign log lines — input: lines of category `default` and of another subsystem; expected: ignored.
- [ ] `cli.test.ts` — input: `pnpm perf nonsense`; expected: usage on stderr, exit 2. Input: `stress --target production`; expected: exit 2 and zero requests. Input: `load` with one failing scenario; expected: exit 1.
- [ ] `apps/api/test/server-timing.test.ts::refused` — input: `/mcp` without a key; expected: 401 with no `Server-Timing`.
- [ ] `server-timing.test.ts::socket` — input: the change feed's upgrade with a valid session; expected: 101 with its `webSocket`, no `Server-Timing`.
- [ ] `work-budgets.test.ts::round trips` — input: one owner project route, one `tools/call` per era, `next` with the nudge on, `GET /owner/workspaces` for 200 projects; expected: the D1 statement and Durable Object call counts pinned at step 22, or the lower counts of each step-28 box.
- [ ] `project-schema.test.ts::version 3` — input: a fresh store; expected: version 3 and the indexes `tasks_order`, `tasks_state_order`, `task_history_task`. Input: a version-2 store with 3 tasks and their history; expected: version 3 and the same rows. Input: a version-3 store; expected: unchanged.
- [ ] `libs/core` order reads — input: an empty store, one task, 5 tasks; expected: the first and last order keys (`null` when empty) and the neighbour after a key, excluding the moving task, equal to what `listAllTasks` gave.
- [ ] Edge: `update` placement `after` the last task — input: anchor the last task; expected: the same order key `listAllTasks` gave before the change.
- [ ] TodzKit `PerfProbeLineTests` — input: each event; expected: exactly `launch-ready ms=640`, `scroll frames=600 over-budget=3 worst-ms=55 refresh-ms=17`, `footprint mb=180`, `task-arrived project=p1 number=7 at-ms=1700000000640`.
- [ ] TodzKit `HitchCounterTests` — input: 600 frames at 60 Hz with one 55 ms and two 30 ms gaps; expected: 3 over budget, worst 55. At 120 Hz with one 14 ms gap; expected: 1 over budget.
- [ ] TodzKit `AppModelTests+Pull::arrivals` — input: a pull bringing tasks 3 and 4; expected: `(project, 3)` and `(project, 4)` once each; a second pull with nothing new: nothing.
- [ ] TodzKit cache writer — input: ten task saves in a row; expected: at most two project-file writes, none on the main thread; with the owner not yet confirmed: zero writes.
- [ ] `scripts/verify.test.sh` — input: `classify tools/perf/src/x.ts`; expected: `product` with `typecheck unit`.
- [ ] `runbooks.test.ts` — input: the new runbook; expected: every step has `If it fails:`, every `pnpm` command it names exists, and the index sentence names `performance`.

## E2E (Playwright specs)

- [ ] None: the feature changes no page. The landing's numbers come from Lighthouse (runbook step 7), and `apps/api/e2e/` stays green unchanged in the `e2e` gate.

## Prove it for real — the runbook's walks

The browser walk of the template does not apply; these runs are its equivalent and every number lands in the runbook's results table.

- [ ] Local load, before (step 19) and after (step 40): `pnpm perf load`; expected: one row per scenario (`mcp-list-legacy`, `mcp-list-modern`, `mcp-add`, `mcp-done`, `mcp-initialize`, `owner`, `change-feed`, `many-projects`); after the fixes every row `PASS` (p95 under 150 ms, p99 under 400 ms, zero 5xx; change feed p95 under 1,000 ms), or the miss named with its next candidate.
- [ ] Stress, local (steps 19 and 29): `pnpm perf stress`; expected: the last step that held and the first that broke, with the breaking resource named; after the fixes the breaking point is at least 200 a second, or the shortfall is recorded with its cause.
- [ ] Empty: `pnpm perf load` against a stack with no seed yet; expected: the run seeds first and prints the seed's counts before any timed request.
- [ ] Single: an owner with one project and one task, `next` with the nudge on; expected: the `Server-Timing` of one answer names both stores.
- [ ] Many: the 200-project owner; expected: the `many-projects` row `PASS`, and `GET /owner/workspaces` answers 200 with 200 projects.
- [ ] Rejected input: `pnpm perf production` with no Keychain item; expected: `the todz-perf-key Keychain item is missing`, exit non-zero, zero requests (checked with `wrangler tail` showing no `/mcp` request from the run's window, or locally with the transport count).
- [ ] Rejected input: `pnpm perf stress --target production`; expected: refused before any request.
- [ ] Two clients at once: the change feed with the app open on the hot project and the harness adding through MCP; expected: `pnpm perf app` joins every arrival and the p95 is under 1,000 ms.
- [ ] Disconnect: stop `wrangler dev` for 10 s mid-run, then start it; expected: the run reports the failures in its rows (status `0`), never hangs past its duration, and exits 1.
- [ ] App cold launch (steps 34 and 39): five background launches; expected: median under 1,000 ms, none over 1,500 ms after the fixes.
- [ ] App scroll (steps 34 and 39): one scripted scroll over 5,000 rows; expected: no frame over 50 ms and at most 1% over 1.5 refresh intervals after the fixes.
- [ ] App soak (steps 34 and 39): 30 minutes of `pnpm perf soak`; expected: footprint at 30 minutes within 10% of 5 minutes.
- [ ] App without the probe: one `open -g` launch without arguments; expected: `log show` finds no line of category `perf` from that launch.
- [ ] The landing (step 30): three Lighthouse runs on the phone profile; expected: median LCP under 2.5 s, CLS under 0.1, TBT under 200 ms; before `landing-seo` merges, "waiting on landing-seo".
- [ ] Production baseline (step 41) and after (step 44): `pnpm perf production`; expected: at most 50 a second for at most 120 s, every row's verdict recorded, zero `exceededCpu` and zero `exception` outcomes in `wrangler tail`, `open tasks left: 0`.
- [ ] Production change feed (step 44, owner present): `pnpm perf app --sends …`; expected: every send joined, p95 under 1,000 ms.
- [ ] Console and output clean: no key, session or task title in any harness output or probe line (grep the run logs for `todz_` and for the seed's titles: zero matches).

## Edge cases found during execution

Empty on purpose. The tester adds one checkbox per new case (input, exact expected outcome) and a regression test for each.

## Adversarial review

The reviewer picks the three claims most likely to be wrong and tries to refute each.

- [ ] Claim 1: the production run can never exceed 50 requests a second or 120 s, nor reach a route other than `/mcp` — attack: read every path from the CLI to the transport for a way around `run-plan.ts` (a flag, an environment variable, a retry, the cleanup phase running past the cap); result: <refuted | held>
- [ ] Claim 2: the work-count budgets catch a new round trip or a full scan — attack: add a second `findOwnedProject` call to an owner route and a `SELECT * FROM tasks` to `add` in a throwaway worktree, run the `unit` gate; result: <refuted | held>
- [ ] Claim 3: the order reads of step 24 place every task exactly where `listAllTasks` did — attack: compare both implementations on random stores (open and done mixed, `first`, `last`, `after` every task) in a throwaway test; result: <refuted | held>

## Coverage honesty

What is not tested and why.

- Production owner API and change-feed latency under load — the loop holds no owner session in production (ADR 0061 § 5); the change feed is checked once in the smoke walk with the owner's app, the owner API not at all under load.
- Local latencies are not production latencies — `wrangler dev` has no network, a local D1 and one isolate; the budgets' acceptance is the production run, and local rows serve before/after comparison and stress.
- CPU time per request — `wrangler dev` does not enforce the 10 ms Free-plan limit; only `wrangler tail` in production shows `exceededCpu`.
- The landing's field Web Vitals (real INP) — no analytics runs on the landing; TBT in the lab stands in.
- SwiftUI rendering cost — no unit test sees it; the scroll walk's frame numbers are the only evidence, on the owner's Mac and display.
- The app's cold launch from a cold disk cache — `purge` needs root, which the loop does not use; "cold" means the process is not running.
- Memory over days, not 30 minutes — the soak is the longest run the owner's Mac hosts without disturbing him.
- Stress beyond one Mac's ability to generate load — the ramp stops where either the server or the generator saturates; the runbook row says which, from the generator's own CPU.
