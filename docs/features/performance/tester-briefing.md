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
