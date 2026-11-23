# Test plan: Project store

Every checkbox states the input and the exact expected outcome. A ticked box carries evidence after ` — evidence: ` (commit hash, log path, counts, screenshot path).

Fixtures: every test creates its own owner, workspace and project ids with `crypto.randomUUID()`, because storage persists across the tests of one file (ADR 0012). An agent actor is `agentActor('Claude Code')`; `today` is `2026-11-23`.

## The failing test first

- [ ] Steps 2 to 6 each have a test commit that precedes its implementation commit in `git log`, and the red run of each fails on a named assertion or on `<name> is not implemented`, recorded in `tester-briefing.md`
- [ ] Spot check in a throwaway worktree: check out the red commit of `SqliteTaskStore` and of the routing functions, run their tests; expected: they fail with the text the briefing records
- [ ] Steps 1, 7 and 8 land as pins and their commits say `pin`; step 8's two mutations turn `api-source.test.ts` red and are restored

## Unit (inside workerd)

### Worker

- [ ] `GET /` and `POST /mcp` with a bearer header → status 404, empty body
- [ ] The directory migration applies and the directory lists exactly `owners`, `workspaces`, `projects`, `project_keys`, `sessions` (ignoring SQLite's and D1's own tables)
- [ ] No directory table has a column named `title`, `notes`, `note`, `due_date` or `order_key`

### SqliteTaskStore

- [ ] An empty project: `lastIssuedTaskNumber()` → `null`, `listTasksInState(Open)` → `[]`, `findTask(1)` → `null`, `findTaskByIdempotencyKey('k1')` → `null`
- [ ] Round trip: a task with notes, a due date, an idempotency key and an agent creator inserted, then `findTask` → deep-equal to the inserted task; the same for a task with `notes: null`, `dueDate: null`, `idempotencyKey: null` and the owner as creator
- [ ] A done task replaced with `state: Done` and `completedAt` set → `findTask` returns both; `listTasksInState(Done)` holds it and `listTasksInState(Open)` does not
- [ ] `findTaskByIdempotencyKey('k1')` → the task inserted with `k1`; case is kept (`'K1'` → `null`)
- [ ] `listTasksInState(Open)` with order keys `'a1'`, `'Zz'`, `'a0V'` inserted in that order → `'Zz'`, `'a0V'`, `'a1'`, the order of `Array.prototype.sort` on the keys
- [ ] Counter: insert `T-1`, `T-2` with no history line; delete row 2 by hand through SQL; `lastIssuedTaskNumber()` → `2`
- [ ] Counter: insert `T-5` into an empty project → `lastIssuedTaskNumber()` → `5`; then insert `T-3` → still `5`
- [ ] `appendHistory` twice for `T-1` (a `Created` line by the owner, an `Updated` line by an agent with fields `[Title, DueDate]` and a note) → `listHistory(1)` returns both in that order, deep-equal
- [ ] Edge, each written by hand with title "Row secret": a task row whose `state` is `'archived'`; a task row with `created_by_kind` `'agent'` and `created_by_client` `NULL`; a task row with `created_by_kind` `'owner'` and `created_by_client` `'Claude Code'` → `findTask` throws for each; a history row whose `action` is `'deleted'`, and one whose `fields` is `'["colour"]'` → `listHistory` throws for each; every thrown message names the column and the task number and contains neither "Row secret" nor the bad value
- [ ] Edge: the schema survives eviction: insert `T-1` through the stub, `evictDurableObject(stub)` from `cloudflare:test`, then `findTask(1)` inside a fresh `runInDurableObject` → the task
- [ ] Edge: the schema is applied once: after the eviction above, `schema_version` holds one row with `1` and `task_counter` at most one row

### ProjectStore RPC

- [ ] `addTasks` with two drafts by the agent → `ok: true`, `T-1` and `T-2`, `replayed: false`; `listTasks` (open, any window, no text, limit 100) → both, `totalMatched: 2`
- [ ] `addTasks` replayed with the same idempotency key → `ok: true`, the first task, `replayed: true`; the project holds one task
- [ ] `addTasks` with three drafts whose third title is blank → `ok: false`, `{ kind: RuleViolated, issue: TitleEmpty, index: 2 }`; the project holds zero tasks
- [ ] `addTasks` with 51 drafts → `{ kind: RuleViolated, issue: BatchTooLarge, index: null }`
- [ ] `updateTask` on `T-1` with a new title → `ok: true`, the new title; `updateTask` on `T-9` → `{ kind: TaskNotFound, number: 9 }`; `updateTask` with `number: 0` → `{ kind: RuleViolated, issue: TaskNumberInvalid, index: null }`
- [ ] `updateTask` with `placement: { kind: After, anchor: 9 }` where `T-9` does not exist → `{ kind: TaskNotFound, number: 9 }`
- [ ] `completeTasks` on `[1, 2]` with a note → both done, `alreadyDone: false`; again on `[1]` → `alreadyDone: true`
- [ ] `completeTasks` on `[1, 9]` → `{ kind: TaskNotFound, number: 9 }` and `T-1` is still open
- [ ] `reopenTasks` on `[1]` after completing it → `alreadyOpen: false`, state open, `completedAt: null`
- [ ] `nextTask` with `T-1` undated and `T-2` due `2026-11-23` → `T-2`; on an empty project → `ok: true`, `value: null`
- [ ] `listTasks` with `limit: 0` → `{ kind: RuleViolated, issue: LimitInvalid, index: null }`
- [ ] Edge: `addTasks` with drafts "B secret alpha" (notes "B notes") then a blank title → the failure's `JSON.stringify` contains neither "secret" nor "notes"
- [ ] Edge: an agent actor whose client name is `''` → `{ kind: RuleViolated, issue: ClientNameInvalid, index: null }` and nothing written; an actor of kind `'robot'` → the promise rejects
- [ ] Edge: `listTasks` and `nextTask` with `today` `'2026-13-01'` → the promise rejects
- [ ] Edge: a store failure rolls back: `T-1` added, then its `state` corrupted to `'archived'` through `runInDurableObject`; `listTasks` (done state) → rejects; `addTasks` with one draft → rejects, and afterwards the `tasks` row count, the `task_counter` value and the `task_history` row count are what they were before the call

### Credentials, directory and routing

- [ ] `digestCredential('abc')` → `'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'`; `digestCredential('')` → `'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'`
- [ ] `findKeyProject` with the digest of a seeded key → its project id; with the digest of an unknown secret → `null`; with a revoked key's digest → `null`
- [ ] `findSessionOwner` with a session expiring one millisecond after `now` → the owner; expiring exactly at `now` → `null`; an unknown digest → `null`
- [ ] `findOwnedProject` for the owner's project → the id; for another owner's project → `null`; for a random UUID → `null`
- [ ] `openKeyProject` with a seeded key's secret → a stub whose `addTasks` lands in that project (read back through `openOwnedProject` for its owner)
- [ ] `openKeyProject` with an unknown secret and a revoked key's secret → `null`
- [ ] `openKeyProject` with `''` while a key row holds `digestCredential('')` → `null`; `resolveSessionOwner` with `''` while a live session row holds that digest → `null`
- [ ] `resolveSessionOwner` with a live session → a `SessionOwner` naming the owner; with an expired one → `null`
- [ ] `openOwnedProject` for the owner's project → a stub; for another owner's project and for a random UUID → `null`
- [ ] Typecheck pin: a test line passes a plain `{ ownerId: '…' }` object as `owner` under `// @ts-expect-error`; `pnpm --filter @todz/api typecheck` is green, and removing the brand from `SessionOwner` makes it red (unused directive)

## Isolation suite (`test/isolation.test.ts`)

Seed: owner O1 with workspace W1 holding projects A and B; owner O2 with project C holding `T-1` "C one". Key kA for A, kB for B, kC for C, a revoked key for A; a live and an expired session for O1, a live session for O2. The routing calls get an `env` whose `PROJECT_STORE` is wrapped by `test/counting-namespace.ts`, which counts `idFromName` and `get` calls. B holds `T-1` "B secret alpha" (notes "B notes"), `T-2`, `T-3`; A holds `T-1` "A one". A never-existing number is `T-99`.

- [ ] Through kA: `updateTask` `T-2` → the failure equals, deep, the failure of `updateTask` `T-99` with `99` replaced by `2`, and B's `T-2` is unchanged
- [ ] Through kA: `completeTasks [2]` and `reopenTasks [2]` → `TaskNotFound 2`; B's `T-2` is still open with no new history line
- [ ] Through kA: `updateTask` `T-1` with `placement: { kind: Before, anchor: 3 }` → `TaskNotFound 3`
- [ ] Through kA: `listTasks` with text `'secret'`, open and done states → zero tasks, `totalMatched: 0`; `listTasks` with no text → only "A one"
- [ ] Through kA: `nextTask` → "A one", never a task of B
- [ ] Numbers are per project: completing `T-1` through kA leaves B's `T-1` open
- [ ] Idempotency keys are per project: the same key `run-1` added through kA and through kB creates one task in each, both `replayed: false`
- [ ] A batch through kA mixing its own `T-1` with B's `T-2` → `TaskNotFound 2` and A's `T-1` stays open
- [ ] O2's session: `openOwnedProject` for A → `null`, the same answer as for a random UUID; O1's session for A and B → stubs that see only their own project's tasks
- [ ] The revoked key → `openKeyProject` returns `null`
- [ ] O1's expired session → `resolveSessionOwner` returns `null`
- [ ] kC → a stub whose `listTasks` (open, no text) returns exactly "C one"
- [ ] Every refusal addresses no Durable Object: for an unknown key, the revoked key, `''`, O2 opening A and O2 opening a random UUID, the counting namespace records 0 `idFromName` and 0 `get` calls

## Repository shape

- [ ] `tools/repository-shape/src/api-source.test.ts` — input: the files under `apps/api/src`; expected: none contains `console.`; mutation: a `console.log` added to `src/index.ts` turns it red with the file named
- [ ] `tools/repository-shape/src/api-source.test.ts` — input: the same files; expected: only `src/project-routing.ts` contains `PROJECT_STORE.`; mutation: `PROJECT_STORE.idFromName` added to `src/project-store.ts` turns it red with the file named

## Edge cases found during execution

Empty on purpose. The tester adds one checkbox per new case (input, exact expected outcome) and a regression test for each.

## Adversarial review

The reviewer picks the three claims most likely to be wrong and tries to refute each.

- [ ] Claim 1: <claim> — attack: <how>; result: <refuted | held>
- [ ] Claim 2: <claim> — attack: <how>; result: <refuted | held>
- [ ] Claim 3: <claim> — attack: <how>; result: <refuted | held>

## Coverage honesty

What is not tested and why.

- A deployed Worker, a remote D1 database and Durable Object placement — nothing is deployed in v1's build; ADR 0012 accepts the local runtime as the proof.
- Concurrency between two requests to one project — the Durable Object serialises them and `transactionSync` holds no await; not exercised beyond the runtime's guarantee.
- HTTP parsing of `Authorization` headers — `mcp-server` owns it.
