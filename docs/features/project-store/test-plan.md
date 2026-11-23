# Test plan: Project store

Every checkbox states the input and the exact expected outcome. A ticked box carries evidence after ` — evidence: ` (commit hash, log path, counts, screenshot path).

Fixtures: every test creates its own owner, workspace and project ids with `crypto.randomUUID()`, because storage persists across the tests of one file (ADR 0012). An agent actor is `agentActor('Claude Code')`; `today` is `2026-11-23`.

## The failing test first

- [x] Steps 2 to 6 each have a test commit that precedes its implementation commit in `git log`, and the red run of each fails on a named assertion or on `<name> is not implemented`, recorded in `tester-briefing.md` — evidence: git log order: ab86c32 red then f3b8316 green (step 2); 1e2b585 then ff3004a (3); e89818d then 47ece3a (4); da09333 then f30293b (5); 56a3bf4 then dda28fd (6); red texts in the briefing reproduced exactly (see the spot check)
- [x] Spot check in a throwaway worktree: check out the red commit of `SqliteTaskStore` and of the routing functions, run their tests; expected: they fail with the text the briefing records — evidence: throwaway worktree: ab86c32 sqlite-task-store 16/16 failed, "applyProjectSchema is not implemented"; 56a3bf4 routing 10/10 failed, openKeyProject x4, resolveSessionOwner x5, openOwnedProject x1 "is not implemented"; 1e2b585 project-store 18 failed / 3 passed, addTasks x17, listTasks, nextTask; e89818d digest 2 failed; da09333 directory 9/9 failed 3+3+3; worktree removed
- [x] Steps 1, 7 and 8 land as pins and their commits say `pin`; step 8's two mutations turn `api-source.test.ts` red and are restored — evidence: subjects of 5e87da0, f48e3ab, 8c8fcde each say "pin"; mutations run by the tester: console.log appended to src/index.ts turned api-source.test.ts "no file calls console" red with received [apps/api/src/index.ts]; PROJECT_STORE.idFromName appended to src/project-store.ts turned "only the routing module" red with received [apps/api/src/project-store.ts]; both restored with git checkout

## Unit (inside workerd)

### Worker

- [x] `GET /` and `POST /mcp` with a bearer header → status 404, empty body — evidence: test/worker.test.ts "GET / answers 404 with an empty body" and "POST /mcp with a bearer header answers 404 with an empty body"; green 76/76 at f792a9b
- [x] The directory migration applies and the directory lists exactly `owners`, `workspaces`, `projects`, `project_keys`, `sessions` (ignoring SQLite's and D1's own tables) — evidence: test/worker.test.ts "lists exactly the five directory tables" (toEqual of the sorted five, excluding sqlite_, _cf_ and d1_migrations)
- [x] No directory table has a column named `title`, `notes`, `note`, `due_date` or `order_key` — evidence: test/worker.test.ts "has no column that holds a task field" (columns of every directory table filtered to the five names, toEqual [])

### SqliteTaskStore

- [x] An empty project: `lastIssuedTaskNumber()` → `null`, `listTasksInState(Open)` → `[]`, `findTask(1)` → `null`, `findTaskByIdempotencyKey('k1')` → `null` — evidence: test/sqlite-task-store.test.ts "an empty project has no tasks, no issued number and no matches" (toEqual null, [], null, null)
- [x] Round trip: a task with notes, a due date, an idempotency key and an agent creator inserted, then `findTask` → deep-equal to the inserted task; the same for a task with `notes: null`, `dueDate: null`, `idempotencyKey: null` and the owner as creator — evidence: test/sqlite-task-store.test.ts "a task with notes, a due date, a key and an agent creator round trips" and "a task without notes, due date or key and an owner creator round trips" (toEqual on the inserted task)
- [x] A done task replaced with `state: Done` and `completedAt` set → `findTask` returns both; `listTasksInState(Done)` holds it and `listTasksInState(Open)` does not — evidence: test/sqlite-task-store.test.ts "a replaced done task keeps its state and completion and moves between the state lists"
- [x] `findTaskByIdempotencyKey('k1')` → the task inserted with `k1`; case is kept (`'K1'` → `null`) — evidence: test/sqlite-task-store.test.ts "the idempotency key lookup keeps case" ({ exact: task, upper: null })
- [x] `listTasksInState(Open)` with order keys `'a1'`, `'Zz'`, `'a0V'` inserted in that order → `'Zz'`, `'a0V'`, `'a1'`, the order of `Array.prototype.sort` on the keys — evidence: test/sqlite-task-store.test.ts "open tasks come back in the order JavaScript sorts their order keys" (equals [...keys].sort())
- [x] Counter: insert `T-1`, `T-2` with no history line; delete row 2 by hand through SQL; `lastIssuedTaskNumber()` → `2` — evidence: test/sqlite-task-store.test.ts "the counter survives a task row that stopped existing" (toBe 2)
- [x] Counter: insert `T-5` into an empty project → `lastIssuedTaskNumber()` → `5`; then insert `T-3` → still `5` — evidence: test/sqlite-task-store.test.ts "the counter never goes down when a lower number is inserted" ({ afterFive: 5, afterThree: 5 })
- [x] `appendHistory` twice for `T-1` (a `Created` line by the owner, an `Updated` line by an agent with fields `[Title, DueDate]` and a note) → `listHistory(1)` returns both in that order, deep-equal — evidence: test/sqlite-task-store.test.ts "history comes back in insertion order" (toEqual [created, updated])
- [x] Edge, each written by hand with title "Row secret": a task row whose `state` is `'archived'`; a task row with `created_by_kind` `'agent'` and `created_by_client` `NULL`; a task row with `created_by_kind` `'owner'` and `created_by_client` `'Claude Code'` → `findTask` throws for each; a history row whose `action` is `'deleted'`, and one whose `fields` is `'["colour"]'` → `listHistory` throws for each; every thrown message names the column and the task number and contains neither "Row secret" nor the bad value — evidence: test/sqlite-task-store.test.ts "a row that does not map": 3 findTask cases and 2 listHistory cases; each asserts the message contains the column and "1" and contains neither "Row secret" nor the bad value; the task number check is the weak substring "1", accepted because the full message is pinned in test/project-store.test.ts as "tasks.created_by_client of task 1 is not valid"
- [x] Edge: the schema survives eviction: insert `T-1` through the stub, `evictDurableObject(stub)` from `cloudflare:test`, then `findTask(1)` inside a fresh `runInDurableObject` → the task — evidence: test/sqlite-task-store.test.ts "the schema survives eviction"
- [x] Edge: the schema is applied once: after the eviction above, `schema_version` holds one row with `1` and `task_counter` at most one row — evidence: test/sqlite-task-store.test.ts "the schema is applied once" (versions [{version:1}], counters <= 1)

### ProjectStore RPC

- [x] `addTasks` with two drafts by the agent → `ok: true`, `T-1` and `T-2`, `replayed: false`; `listTasks` (open, any window, no text, limit 100) → both, `totalMatched: 2` — evidence: test/project-store.test.ts "two drafts by the agent become T-1 and T-2 and are listed"
- [x] `addTasks` replayed with the same idempotency key → `ok: true`, the first task, `replayed: true`; the project holds one task — evidence: test/project-store.test.ts "the same idempotency key replays the first task and adds nothing"
- [x] `addTasks` with three drafts whose third title is blank → `ok: false`, `{ kind: RuleViolated, issue: TitleEmpty, index: 2 }`; the project holds zero tasks — evidence: test/project-store.test.ts "a blank third title fails at index 2 and nothing is written"
- [x] `addTasks` with 51 drafts → `{ kind: RuleViolated, issue: BatchTooLarge, index: null }` — evidence: test/project-store.test.ts "more than the batch limit fails without an index"
- [x] `updateTask` on `T-1` with a new title → `ok: true`, the new title; `updateTask` on `T-9` → `{ kind: TaskNotFound, number: 9 }`; `updateTask` with `number: 0` → `{ kind: RuleViolated, issue: TaskNumberInvalid, index: null }` — evidence: test/project-store.test.ts "a new title is stored and returned", "a missing task fails as not found", "task number 0 fails as an invalid number"; tester added test/edge-cases.test.ts "updateTask with number 1.5, -1, NaN" (c389491)
- [x] `updateTask` with `placement: { kind: After, anchor: 9 }` where `T-9` does not exist → `{ kind: TaskNotFound, number: 9 }` — evidence: test/project-store.test.ts "a placement anchor that does not exist fails as not found"
- [x] `completeTasks` on `[1, 2]` with a note → both done, `alreadyDone: false`; again on `[1]` → `alreadyDone: true` — evidence: test/project-store.test.ts "completing two tasks marks both done, and completing one again says it was already done"
- [x] `completeTasks` on `[1, 9]` → `{ kind: TaskNotFound, number: 9 }` and `T-1` is still open — evidence: test/project-store.test.ts "a missing number fails the whole batch and leaves the other task open"
- [x] `reopenTasks` on `[1]` after completing it → `alreadyOpen: false`, state open, `completedAt: null` — evidence: test/project-store.test.ts "reopening a completed task opens it and clears its completion"
- [x] `nextTask` with `T-1` undated and `T-2` due `2026-11-23` → `T-2`; on an empty project → `ok: true`, `value: null` — evidence: test/project-store.test.ts "nextTask prefers the task due today over an undated one" and "nextTask on an empty project is ok with a null value"
- [x] `listTasks` with `limit: 0` → `{ kind: RuleViolated, issue: LimitInvalid, index: null }` — evidence: test/project-store.test.ts "a limit of 0 fails as an invalid limit"
- [x] Edge: `addTasks` with drafts "B secret alpha" (notes "B notes") then a blank title → the failure's `JSON.stringify` contains neither "secret" nor "notes" — evidence: test/project-store.test.ts "a failure carries neither a title nor a note"
- [x] Edge: an agent actor whose client name is `''` → `{ kind: RuleViolated, issue: ClientNameInvalid, index: null }` and nothing written; an actor of kind `'robot'` → the method throws (asserted inside the Durable Object through `runInDurableObject`, because an error thrown across RPC surfaces in Vitest as an unhandled error that fails the run even when caught) — evidence: test/project-store.test.ts "an agent whose client name is empty fails and nothing is written" and "an actor of an unknown kind throws" (asserted inside the Durable Object, message "the actor kind is not known")
- [x] Edge: `listTasks` and `nextTask` with `today` `'2026-13-01'` → the method throws (asserted inside the Durable Object, as above) — evidence: test/project-store.test.ts "$name throws for a today that is not a calendar date" for listTasks and nextTask
- [x] Edge: a store failure rolls back: `T-1` added, then its `created_by_kind` and `created_by_client` corrupted through `runInDurableObject` (a corrupt `state` is never selected by a state query, so it cannot make a read throw); `listTasks` (open state) → throws; `addTasks` with one draft → throws, and afterwards the `tasks` row count, the `task_counter` value and the `task_history` row count are what they were before the call — evidence: test/project-store.test.ts "a row that does not map throws from the reads and the write" proves both throw; it did not assert the counts, so the tester added test/edge-cases.test.ts "a row that does not map leaves the tasks, the counter and the history as they were after a failed add" (c389491)
- [x] Edge: a failure after the first write rolls back: a `BEFORE INSERT` trigger on `task_history` that raises an error; `addTasks` with one draft → throws, and the task row and the counter written before the history line are gone; removing `transactionSync` turns this test red — evidence: test/project-store.test.ts "a failure after the task row is written rolls the whole call back"; mutation by the tester: replacing transactionSync(useCase) with useCase() made exactly this test fail (75 passed, 1 failed); restored with git checkout

### Credentials, directory and routing

- [x] `digestCredential('abc')` → `'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'`; `digestCredential('')` → `'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'` — evidence: test/credential-digest.test.ts both digests, exact strings
- [x] `findKeyProject` with the digest of a seeded key → its project id; with the digest of an unknown secret → `null`; with a revoked key's digest → `null` — evidence: test/directory.test.ts findKeyProject "a seeded key resolves to its project", "an unknown secret resolves to nothing", "a revoked key resolves to nothing"
- [x] `findSessionOwner` with a session expiring one millisecond after `now` → the owner; expiring exactly at `now` → `null`; an unknown digest → `null` — evidence: test/directory.test.ts findSessionOwner "expiring one millisecond after now", "exactly at now", "an unknown digest"
- [x] `findOwnedProject` for the owner's project → the id; for another owner's project → `null`; for a random UUID → `null` — evidence: test/directory.test.ts findOwnedProject "the owner of the project gets its id", "another owner gets nothing", "a project id that never existed gets nothing"
- [x] `openKeyProject` with a seeded key's secret → a stub whose `addTasks` lands in that project (read back through `openOwnedProject` for its owner) — evidence: test/project-routing.test.ts "a seeded key opens its project, and a task added through it is read back through the owner"
- [x] `openKeyProject` with an unknown secret and a revoked key's secret → `null` — evidence: test/project-routing.test.ts "an unknown secret and a revoked key open nothing"
- [x] `openKeyProject` with `''` while a key row holds `digestCredential('')` → `null`; `resolveSessionOwner` with `''` while a live session row holds that digest → `null` — evidence: test/project-routing.test.ts "an empty secret opens nothing even when a key row holds its digest" and "an empty secret resolves to nothing even when a live session holds its digest"
- [x] `resolveSessionOwner` with a live session → a `SessionOwner` naming the owner; with an expired one → `null` — evidence: test/project-routing.test.ts "a live session resolves to a session owner naming the owner" (toMatchObject) and "an expired session resolves to nothing"
- [x] `openOwnedProject` for the owner's project → a stub; for another owner's project and for a random UUID → `null` — evidence: test/project-routing.test.ts "the owner of a project opens it" and "another owner and a project id that never existed open nothing and address no Durable Object"
- [x] Typecheck pin: a test line passes a plain `{ ownerId: '…' }` object as `owner` under `// @ts-expect-error`; `pnpm --filter @todz/api typecheck` is green, and removing the brand from `SessionOwner` makes it red (unused directive) — evidence: test/project-routing.test.ts "a plain object is not accepted as a session owner"; typecheck green; mutation by the tester: removing the SessionOwner brand made pnpm --filter @todz/api typecheck fail with test/project-routing.test.ts(91,5) TS2578 Unused @ts-expect-error directive; restored

## Isolation suite (`test/isolation.test.ts`)

Seed: owner O1 with workspace W1 holding projects A and B; owner O2 with project C holding `T-1` "C one". Key kA for A, kB for B, kC for C, a revoked key for A; a live and an expired session for O1, a live session for O2. The routing calls get an `env` whose `PROJECT_STORE` is wrapped by `test/counting-namespace.ts`, which counts `idFromName` and `get` calls. B holds `T-1` "B secret alpha" (notes "B notes"), `T-2`, `T-3`; A holds `T-1` "A one". A never-existing number is `T-99`.

- [x] Through kA: `updateTask` `T-2` → the failure equals, deep, the failure of `updateTask` `T-99` with `99` replaced by `2`, and B's `T-2` is unchanged — evidence: test/isolation.test.ts "updating a task of B answers exactly what a task that never existed answers, and B is unchanged" (asserts the literal failure for number 2 and for number 99, same shape)
- [x] Through kA: `completeTasks [2]` and `reopenTasks [2]` → `TaskNotFound 2`; B's `T-2` is still open with no new history line — evidence: test/isolation.test.ts "completing and reopening a task of B fail as not found and B gains no history line"
- [x] Through kA: `updateTask` `T-1` with `placement: { kind: Before, anchor: 3 }` → `TaskNotFound 3` — evidence: test/isolation.test.ts "placing a task of A before an anchor that only B has fails as not found"; also edge-cases.test.ts with an After anchor
- [x] Through kA: `listTasks` with text `'secret'`, open and done states → zero tasks, `totalMatched: 0`; `listTasks` with no text → only "A one" — evidence: test/isolation.test.ts "searching for text only B has finds nothing, and listing shows only its own task" (open and done, 0 tasks and totalMatched 0)
- [x] Through kA: `nextTask` → "A one", never a task of B — evidence: test/isolation.test.ts "the next task is its own, never one of B"
- [x] Numbers are per project: completing `T-1` through kA leaves B's `T-1` open — evidence: test/isolation.test.ts "completing T-1 leaves T-1 of B open"
- [x] Idempotency keys are per project: the same key `run-1` added through kA and through kB creates one task in each, both `replayed: false` — evidence: test/isolation.test.ts "the same idempotency key adds one task in each project" ([false, false])
- [x] A batch through kA mixing its own `T-1` with B's `T-2` → `TaskNotFound 2` and A's `T-1` stays open — evidence: test/isolation.test.ts "a batch mixing its own T-1 with T-2 of B fails as not found and T-1 stays open"
- [x] O2's session: `openOwnedProject` for A → `null`, the same answer as for a random UUID; O1's session for A and B → stubs that see only their own project's tasks — evidence: test/isolation.test.ts "the second owner opens nothing of A, exactly what a random id gets" and "the first owner opens A and B and each sees only its own tasks"
- [x] The revoked key → `openKeyProject` returns `null` — evidence: test/isolation.test.ts "the revoked key opens nothing"
- [x] O1's expired session → `resolveSessionOwner` returns `null` — evidence: test/isolation.test.ts "the expired session resolves to nothing"
- [x] kC → a stub whose `listTasks` (open, no text) returns exactly "C one" — evidence: test/isolation.test.ts "the key of C lists exactly the task of C"
- [x] Every refusal addresses no Durable Object: for an unknown key, the revoked key, `''`, O2 opening A and O2 opening a random UUID, the counting namespace records 0 `idFromName` and 0 `get` calls — evidence: test/isolation.test.ts "every refusal addresses no Durable Object" (five refusals, the counting namespace records [])

## Repository shape

- [x] `tools/repository-shape/src/api-source.test.ts` — input: the files under `apps/api/src`; expected: none contains `console.`; mutation: a `console.log` added to `src/index.ts` turns it red with the file named — evidence: tools/repository-shape/src/api-source.test.ts "no file calls console"; mutation run by the tester, red with received [apps/api/src/index.ts], restored
- [x] `tools/repository-shape/src/api-source.test.ts` — input: the same files; expected: only `src/project-routing.ts` contains `PROJECT_STORE.`; mutation: `PROJECT_STORE.idFromName` added to `src/project-store.ts` turns it red with the file named — evidence: tools/repository-shape/src/api-source.test.ts "only the routing module reads a member of the project store namespace"; mutation run by the tester, red with received [apps/api/src/project-store.ts], restored

## Edge cases found during execution

All in `apps/api/test/edge-cases.test.ts`, commit c389491 (a pin: green when it landed). No bug found.

- [x] `openKeyProject` with a seeded key's secret plus a trailing space, with a leading newline, upper-cased, or missing its last character → `null`, and the counting namespace records 0 calls — evidence: c389491, "the key secret with $name" x4
- [x] `openKeyProject` with the digest of a seeded key used as the secret → `null`, 0 calls — evidence: c389491, "the digest of a seeded key used as a secret"
- [x] `openKeyProject` with a secret of 1,000,000 characters → `null`, 0 calls — evidence: c389491, "a secret of a million characters"
- [x] `openKeyProject` and `resolveSessionOwner` with `'   '` → `null` for both — evidence: c389491, "a whitespace-only secret"
- [x] A live session's secret offered to `openKeyProject`, and a key's secret offered to `resolveSessionOwner` → `null` for both — evidence: c389491, "a session secret offered as a key and a key secret offered as a session"
- [x] A key with `revoked_at` `0` → `openKeyProject` returns `null` — evidence: c389491, "a key revoked at instant 0"
- [x] A session expiring at `now - 1` → `resolveSessionOwner` returns `null` — evidence: c389491, "a session that expired one millisecond before now"
- [x] `openOwnedProject` for the owner with the project id carrying SQL characters, upper-cased, with a trailing space, or `''` → `null`, 0 calls — evidence: c389491, "a project id that is not exactly the owned one opens nothing" x4
- [x] Through kA: `updateTask` `T-1` with `placement: { kind: After, anchor: 2 }`, where only B has `T-2` → `TaskNotFound 2` — evidence: c389491, "placing after an anchor that only B has fails as not found"
- [x] Through kA: `listTasks` with text `'SECRET'`, `'secret'`, `'%'`, `'_'`, `'alpha'` → no title of B in any result — evidence: c389491, "a text search with any case or wildcard finds no task of B"
- [x] The same project: idempotency keys `run-x` and `RUN-X` → two tasks, both `replayed: false` — evidence: c389491, "an idempotency key that differs only in case adds a second task in the same project"
- [x] A key used in B, then the same key with another title through kA → A's `T-2` is created with that title, `replayed: false` — evidence: c389491, "an idempotency key used in B replays nothing in A"
- [x] `T-2` and its history deleted by hand, then `addTasks` → the new task is `T-3` — evidence: c389491, "a number is never reissued after the last task row is deleted by hand"
- [x] `updateTask` with number `1.5`, `-1` or `NaN` → `{ kind: RuleViolated, issue: TaskNumberInvalid, index: null }` — evidence: c389491, "updateTask with number $number is an invalid number" x3
- [x] An owner actor carrying an extra `ownerId` field at runtime → the stored creator equals `{ kind: Owner }` and nothing of the extra field persists — evidence: c389491, "extra fields on an owner actor are dropped from the stored creator"
- [x] A row corrupted so it does not map, then `addTasks` → throws `tasks.created_by_client of task 1 is not valid` and the `tasks` rows, `task_counter` and `task_history` rows equal what they were before (the original test did not assert the counts) — evidence: c389491, "a row that does not map leaves the tasks, the counter and the history as they were after a failed add"

Security hardening (red 5602987, green 5dab82c, pin 7ac7b89):

- [x] `openOwnedProject` with a forged `{ ownerId } as SessionOwner` for the owner's own project → `null`, and the counting namespace records 0 calls; a plain object under `@ts-expect-error` → `null` — evidence: red 5602987 replayed in a throwaway worktree (since removed), `expected [JsRpcPromise ...] to be null` for both tests; green 5dab82c; mutation: deleted the `resolvedOwners.has(owner)` line in `project-routing.ts`, both tests went red, restored with git checkout
- [x] `openKeyProject` and `resolveSessionOwner` with `'   '` while a key row and a live session row hold its digest → `null` for both, 0 calls — evidence: red 5602987 "a whitespace-only secret opens nothing even when rows hold its digest"; mutation: `isBlankSecret` reduced to `secret === ''` turned this test and the undefined test red, restored with git checkout
- [x] `openKeyProject` and `resolveSessionOwner` with `undefined` as the secret while rows hold the digest of `''` → `null` for both — evidence: red 5602987 "a secret that is not a string opens nothing even when rows hold the digest of nothing"; mutation: dropping only the `typeof` half of `isBlankSecret` turned it red (the `'   '` test stayed green), restored
- [x] Inserting the raw digest `'secret'` into `project_keys` and into `sessions` → each insert rejects (`CHECK (length(digest) = 64)`) — evidence: red 5602987 `promise resolved ... instead of rejecting` x2 ("the directory digests"); mutation: removed both CHECK clauses from `0001_directory.sql`, both tests went red, restored
- [x] `api-source.test.ts` matches bare identifiers: `console['log']('x')` in `src/index.ts` turns it red naming the file, and a destructured `PROJECT_STORE` in `src/project-store.ts` turns it red naming the file — evidence: 7ac7b89 (pin); appended `console['log']('x');` to `src/index.ts`, received `["apps/api/src/index.ts"]`; appended a destructured `PROJECT_STORE` to `src/project-store.ts`, received `['apps/api/src/project-store.ts']`; both restored with git checkout
- [x] An owner resolved for O1 offered with O2's project → `openOwnedProject` returns `null`, 0 calls — evidence: 22ef48b, "an owner resolved for one owner opens nothing of another owner project and addresses no Durable Object"
- [x] One resolved owner used twice for its own project → both calls return a stub, 2 `get` calls recorded — evidence: 22ef48b, "the same resolved owner opens its project on every call" (the first draft counted 2 addressing calls; each open records `idFromName` and `get`, a test mistake, not a defect)

Hardening run: `pnpm install --frozen-lockfile --offline` succeeds with `onlyBuiltDependencies`; `@todz/api` 107 passed, typecheck clean, `repository-shape` 144 passed; workerd boots (the api suite runs inside it). Red replay of 5602987: 6 failed, 99 passed, the 6 named in the briefing.

Observed, not a defect (closed by the first box above): `SessionOwner` is a brand known to the compiler only; at runtime `openOwnedProject` accepts any object with an `ownerId`, so isolation from a forged owner rests on the type check and on the rule that only `resolveSessionOwner` builds the value. A `null` actor throws a `TypeError` ("Cannot read properties of null") rather than the "the actor kind is not known" message; both are thrown.

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
