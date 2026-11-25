# Performance

Measure the API, the MCP server, the change feed, the macOS app and the landing against the budgets of [ADR 0061](../adr/0061-performance-has-written-budgets-a-fetch-based-load-harness-behind-pnpm-perf-and-work-count-budgets-in-verify.md), locally and, under bounds, on `api.todz.app`, and record every run in the results table at the end. The build loop runs steps 1 to 3 and, under the owner's authorization in the loop's prompt, steps 10 and 11 and 14; the rest needs the owner's Mac, the Debug app or the owner's Keychain.

Every command runs from the repository root. The harness is `pnpm perf <command>` (the package `@todz/perf`); `pnpm` prints two header lines before its output, and the harness reads only the lines it understands. The budgets: MCP and owner requests p95 under 150 ms and p99 under 400 ms with no 5xx at 50 requests a second for 2 minutes; a 2025-era `initialize` p95 under 400 ms; the change feed p95 under 1,000 ms; stress breaking at 200 requests a second or more; the app's cold launch under 1,000 ms (median of five, none over 1,500 ms), a scroll with no frame over 50 ms and at most 1% over 1.5 refresh intervals, a footprint within 10% between minute 5 and minute 30, model work under 8 ms; the landing's LCP under 2.5 s, CLS under 0.1 and TBT under 200 ms. Where a command takes `--port <n>`, it moves only the port of `localhost`; every command that names `--target production` is refused, because production has its own command.

1. **Start the local Worker.** In its own terminal:

   ```bash
   pnpm --filter @todz/api dev
   ```

   Expected: Wrangler applies the local migrations and prints `Ready on http://localhost:8787`; `curl -sS http://localhost:8787/health` answers `{"service":"todz","origin":"http://localhost:8787"}`. The fake sign-in provider is on, so no mail is needed.
   If it fails: a busy port 8787 means another Worker runs there; stop it, or run `pnpm --filter @todz/api exec wrangler dev` yourself on another `--port` with the `--var` settings of the `dev` script and `PUBLIC_ORIGIN` set to that port's origin, then add `--port <n>` to every `pnpm perf` command below. A migration error means the local state is stale; delete `apps/api/.wrangler/state` and start again.

2. **Run the local load, the baseline.** Fifty requests a second for 2 minutes on the mix of ADR 0061 (40% `list`, 20% `add`, 20% `done`, 20% owner API), both MCP eras half and half, on a hot project of 5,000 tasks and an owner with 200 projects in 20 workspaces, with a second client holding the hot project's socket:

   ```bash
   pnpm perf load
   ```

   Expected: it seeds a fresh owner and prints `seeded: 5000 tasks in the hot project (4900 done), <n> projects` before its first timed request, then one row per scenario under the header `scenario | requests | rate/s | p50 ms | p95 ms | p99 ms | max ms | 5xx | directory ms | project ms | verdict`, then `done tasks at the start: 4900`, and exits 0 with every verdict `PASS`. The `directory ms` and `project ms` columns are the medians of the `Server-Timing` header and stay empty until the Worker sends it.
   If it fails: a `FAIL` names the scenario; read its `directory ms` and `project ms` to see whether D1 or the project's Durable Object holds the time, and `5xx` for errors. Each request has 30 seconds and the run 10 seconds past its duration, so a Worker that accepts connections and never answers ends the run with the failures counted, never a hang. Two runs of the same commit that differ by more than 30% at p95 mean a loaded Mac; close other work, run three times and record the median run in the table.

3. **Stress the local Worker until it breaks.** The same mix from 50 requests a second, times 1.5 every 30 seconds, until failures pass 1% or p99 passes 2 seconds:

   ```bash
   pnpm perf stress
   ```

   Expected: one line per step, then `held: <rate> a second; broke: <rate>`; the exit is 0 when the first step that broke is 200 or more, whatever the step that held before it (the steps are 1.5 times apart). Write the rate that held, the rate that broke and the resource that failed first in the table. One Node process drives the load and the Worker runs on the same Mac, so the number bounds the lab, never production.
   If it fails: a breaking point under 200 a second goes through the decision rule of ADR 0061, point 9: read the failed step's p99 and `5xx` against the `Server-Timing` split of step 2 to name the first resource, and record it with its number whether it is fixed or not.

4. **Measure the app's cold launch.** Seed the owner the app signs in with, sign the Debug app in with the printed identity, quit it, then launch it five times in the background, each quit before the next:

   ```bash
   pnpm perf seed --tasks 5000 --projects 200
   open -g -a <Debug app> --args -TodzPerfProbe YES
   pnpm perf app
   ```

   Expected: `seed` prints `identity: todz-perf-seed`, the hot project and `done tasks: 4900`. After five launches `app` prints `launch: median <n> ms, max <n> ms over 5 launches PASS`. The app logs only integers under its bundle identifier, category `perf`; read them yourself with `/usr/bin/log show --info --last 10m --predicate '(subsystem == "dev.todz.Todz" OR subsystem == "dev.todz.Todz.debug") AND category == "perf"'` (`--info` because the probe logs at info level, `/usr/bin/log` because `log` is a builtin of zsh).
   If it fails: no `perf` line means the argument was not passed (the probe reads the process arguments only, never a default); a miss names the launch, so run the five again and look at which phase is slow before changing anything. Launches stay few and short because a window that takes focus disturbs the owner.

5. **Measure the scripted scroll.** One launch with the scroll walk, after the probe's `launch-ready` line:

   ```bash
   open -g -a <Debug app> --args -TodzPerfProbe YES -TodzPerfScroll YES
   pnpm perf app
   ```

   Expected: `scroll: <frames> frames, <n> over budget, worst <n> ms PASS`: no frame over 50 ms and at most 1% of the frames over 1.5 refresh intervals.
   If it fails: the worst frame and the count say whether one stall or a steady cost; the model counters in step 7 and the views of the task list are the first suspects.

6. **Measure the footprint over a soak.** With the Debug app open in the background on the seeded owner, change the same 50 tasks for 30 minutes:

   ```bash
   pnpm perf soak --minutes 30
   pnpm perf app
   ```

   Expected: `soak: <n> updates, <n> lists, 0 failed`, and `app` prints `footprint: <n> MB at 5 minutes, <n> MB after 60 samples PASS`: the last footprint is at most 10% above the one at minute 5. Each launch is its own series, told apart by its process identifier, and the launch with the most samples is the one judged.
   If it fails: growth means something keeps what the soak changes; compare the two numbers after a second soak before blaming a cache. `footprint: not enough samples: the longest launch has <n> of 11 SKIP` means no launch lasted 5 minutes; it hides no other verdict and the exit stays 0.

7. **Record the model benchmark.** The app's model work for one change at 5,000 tasks, printed and never asserted:

   ```bash
   TODZ_BENCHMARK=1 swift test --package-path apps/macos/TodzKit --filter ModelBenchmark
   ```

   Expected: it prints the median of seven runs, after one warm-up, for the task views, `inbox`, `today`, `upcomingDays`, `doneDays`, `project(identifier:)`, one pulled task with its cache write, the widget snapshot and the menu bar count. Record each against the 8 ms budget.
   If it fails: a median over 8 ms names the call to fix; the benchmark skips itself without `TODZ_BENCHMARK=1`, so a run that prints nothing means the variable was not set.

8. **Measure the landing.** Against the site Worker, on the phone profile Lighthouse uses by default, three runs, the median of each number:

   ```bash
   pnpm --filter @todz/api dev:site
   pnpm dlx lighthouse@13.6.0 http://localhost:8788/ --only-categories=performance --output=json --output-path=<scratch>/landing-1.json
   ```

   Expected: repeat the second command into `landing-2.json` and `landing-3.json`; the median LCP is under 2.5 s, CLS under 0.1 and Total Blocking Time under 200 ms (the lab stand-in for INP). The procedure is the one of ADR 0060.
   If it fails: a miss caused by the Worker's files is fixed in `apps/api/src/site` red-first; a miss caused by the machine or by Lighthouse is recorded with its number and not fixed.

9. **Check the production prerequisite.** The owner creates a workspace named `todz-perf`, issues an MCP key for its Inbox in the app and stores it in the Keychain, where `-T /usr/bin/security` lets `security` read it without an approval dialog:

   ```bash
   security add-generic-password -U -s todz-perf-key -a todz -T /usr/bin/security -w
   security find-generic-password -s todz-perf-key
   ```

   Expected: the first prompts for the key and stores it; the second exits 0 and prints the item's attributes without its password. The harness reads the key itself, never from an argument, a variable or a file.
   If it fails: a missing item stops the production run before any request with `the todz-perf-key Keychain item is missing`; ask the owner to create it. A run that says the same with the item present means an approval dialog waited past 5 seconds: recreate the item with `-T /usr/bin/security`.

10. **Run the bounded production load.** Off-peak, at most one run a day, with the Free-plan line below in mind. In one terminal, write the window of the Worker's own log; in another, run the load, which sends only `POST https://api.todz.app/mcp` at 50 a second for at most 120 seconds, adds for the first 100 seconds, and writes each answered `add`'s number and send time to the file:

    ```bash
    scripts/todz-cloudflare.sh pnpm --filter @todz/api exec wrangler tail todz-api --format json | jq -R -c 'fromjson? | {outcome, cpuTime}' > <scratch>/tail.json
    pnpm perf production > <scratch>/sends.jsonl
    pnpm perf tail <scratch>/tail.json
    ```

    Expected: the error output prints `run: <id>` before the first request, then the report: one row per scenario (`list`, `add`, `done`), `dropped`, `failed requests` and `open tasks left: 0`; `tail` prints the count per outcome and `cpuTime p50` and `p99`. The tail reaches the disk only as `outcome` and `cpuTime` per event, because `jq` drops the rest (URLs, headers, logs) before the file is written. The harness refuses a rate over 50, a duration over 120 seconds, any scenario but MCP, any path but `POST /mcp`, any redirect, a retry after a 401, more than 50 in flight, more than 6,010 requests and anything after 120 seconds; it refuses to start when the project holds more than 20 open tasks that are not `todz-perf` tasks; it stops sending after the first 401 or 10 failures in a row; and Ctrl-C stops it, runs the cleanup of its own run and exits 1. Its tasks are titled `todz-perf <run> #<slot>`. One run sends at most 6,000 requests (50 a second for 120 seconds, cleanup inside), reads about 6,000 directory rows (one key lookup each; the 2026-07-28 era writes none) and writes about 12,000 project-store rows (about 1,000 adds and 1,000 completions, each a task row, a history row and the counters), well under the daily caps of the Free plan, which is why one run a day, off-peak, is the rule.
    If it fails: a 5xx or an `exceededCpu` outcome in `tail` is a server finding (the Free plan allows 10 ms of CPU a request), never a harness bug; the run ends by itself within 120 seconds and nothing needs rolling back. A run that stopped on a 401 or on 10 failures in a row leaves `open tasks left: null`; run step 11 with the `run:` identifier it printed. A 429, a 3xx or a refused request counts as a failure on its row.

11. **Check that nothing is left open.** The report's `open tasks left` is the count of a final list filtered by the run's own prefix. When it is not 0:

    ```bash
    pnpm perf production --cleanup <run>
    ```

    Expected: `open tasks left: 0`; the cleanup lists by the run's prefix and completes only those tasks, at most 50 a second for at most 60 seconds, and never a task without the prefix.
    If it fails: a count that stays above 0 with no task of the run left means a task of the owner's whose title contains the prefix; leave it, say so in the table.

12. **Measure the change feed in production.** With the owner present, the Release app open on `todz-perf` in the background, during step 10, launched with the probe:

    ```bash
    open -g -a <Release app> --args -TodzPerfProbe YES
    pnpm perf app --sends <scratch>/sends.jsonl
    ```

    Expected: `change feed: p95 <n> ms over <n> tasks PASS`, under 1,000 ms, from each send time to the app's `task-arrived` line for the same task number.
    If it fails: no joined task means the app showed another project; open the `todz-perf` Inbox and run step 10 again the next day.

13. **Revoke the key.** The owner revokes the key in the app's key screen and deletes the Keychain item:

    ```bash
    security delete-generic-password -s todz-perf-key
    rm <scratch>/tail.json
    ```

    Expected: the command prints the deleted item's attributes; `security find-generic-password -s todz-perf-key` exits 44; the saved tail window is gone.
    If it fails: a missing item is already deleted; revoke the key in the app first and check it no longer opens `/mcp`.

14. **Record the numbers.** One row per scenario of every run in the table below: the date, the short commit, where it ran (`local`, `app` or `production`), the scenario, the load, the hot project's done count at the start of the run, p50, p95, p99, the 5xx count and the verdict. A candidate the decision rule did not select goes in the second table with its number.
    If it fails: a row without its done count cannot be compared with a later run on a larger project; rerun, never guess it.

## Results

| Date | Commit | Where | Scenario | Load | Done tasks | p50 ms | p95 ms | p99 ms | 5xx | Verdict |
|------|--------|-------|----------|------|------------|--------|--------|--------|-----|---------|
| 2026-11-25 | c80c272 | local | list | 50/s for 120 s | 4900 | 4 | 9 | 17 | 0 | PASS |
| 2026-11-25 | c80c272 | local | add | 50/s for 120 s | 4900 | 17 | 23 | 30 | 0 | PASS |
| 2026-11-25 | c80c272 | local | done | 50/s for 120 s | 4900 | 4 | 9 | 13 | 0 | PASS |
| 2026-11-25 | c80c272 | local | owner | 50/s for 120 s | 4900 | 4 | 9 | 14 | 0 | PASS |
| 2026-11-25 | c80c272 | local | workspaces (200 projects) | 50/s for 120 s | 4900 | 3 | 8 | 14 | 0 | PASS |
| 2026-11-25 | c80c272 | local | initialize (2025 era) | 20 clients | 4900 | 4 | 6 | 10 | 0 | PASS |
| 2026-11-25 | c80c272 | local | change feed | 50/s for 120 s | 4900 | 19 | 28 | 37 | 0 | PASS |
| 2026-11-25 | c80c272 | local | stress, step that held | 169/s for 30 s | 4900 | - | - | 806 | 0 | PASS |
| 2026-11-25 | c80c272 | local | stress, step that broke | 253/s for 30 s | 4900 | - | - | 8880 | 0 | FAIL |
| 2026-11-25 | cbb90fd | local | list | 50/s for 120 s | 4900 | 4 | 7 | 13 | 0 | PASS |
| 2026-11-25 | cbb90fd | local | add | 50/s for 120 s | 4900 | 5 | 8 | 14 | 0 | PASS |
| 2026-11-25 | cbb90fd | local | done | 50/s for 120 s | 4900 | 4 | 7 | 12 | 0 | PASS |
| 2026-11-25 | cbb90fd | local | owner | 50/s for 120 s | 4900 | 4 | 7 | 13 | 0 | PASS |
| 2026-11-25 | cbb90fd | local | workspaces (200 projects) | 50/s for 120 s | 4900 | 4 | 6 | 9 | 0 | PASS |
| 2026-11-25 | cbb90fd | local | initialize (2025 era) | 20 clients | 4900 | 4 | 7 | 12 | 0 | PASS |
| 2026-11-25 | cbb90fd | local | change feed | 50/s for 120 s | 4900 | 6 | 11 | 17 | 0 | PASS |
| 2026-11-25 | cbb90fd | local | stress, step that held | 253/s for 30 s | 4900 | - | - | 30 | 0 | PASS |
| 2026-11-25 | cbb90fd | local | stress, step that broke | 380/s for 30 s | 4900 | - | - | 7677 | 0 | FAIL |

The stress ramp of 2026-11-25 on `c80c272` held 169 requests a second (p99 806 ms) and broke at 253 (p99 8.9 s, no failed request), under the budget of 200. In the Worker's log every route slowed together at the breaking step (`/mcp`, `/owner/workspaces`, the change reads and the task writes all took over a second), so the first resource to fail is the local runtime as a whole; the split between the directory and the hot project's Durable Object waits for the `Server-Timing` header.

## Measured, not fixed

| Date | Commit | Candidate | Number | Why it stays |
|------|--------|-----------|--------|--------------|
