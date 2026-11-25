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

- Lane A fills this in.

### How to run

Lane A fills this in.

### Red today, green after

| Test | Red before the change because | Green after because |
|------|--------------------------------|---------------------|
| Lane A fills this in. |  |  |

### Hypotheses to attack

1. Lane A fills this in.

### Known gaps

- Lane A fills this in.
