# Plan: Owner API

**Spec:** spec.md
**Tier:** 🔴
**Seam:** `apps/api`, one guard in `tools/repository-shape` and one line of `AGENTS.md`; the Worker's `fetch` gains every path under `/owner`
**Assumptions (decided, owner can override):**
- ADRs 0020 to 0023 are the loop's calls, listed in the loop's questions. No new dependency: `zod` and `URLPattern` are already available.
- Tests drive the Worker through `exports.default.fetch` from `cloudflare:workers`, as the MCP tests do. The fake provider is switched on by a Miniflare binding in `vitest.config.mts`; the one 503 test calls `serveOwner` with an `Env` copy whose `SIGN_IN_PROVIDER` is removed.
- Secrets and identity tokens in tests are generated at run time (`crypto.randomUUID()`), never written as literals.
- Fresh random ids in every test: storage persists across the tests of a file (STATE carry-over e).
- Files are written with the Write and Edit tools: `guard-secrets.sh` blocks code heredocs (carry-over e).
- An SDK or Durable Object error answered as HTTP 200 is never trusted from `response.ok` alone (carry-over f).

## File map

| Group | Paths owned | Developer sub-agent |
|-------|-------------|---------------------|
| G1 | `apps/api/src/{project-schema,sqlite-task-store,project-store,project-result}.ts`, `apps/api/test/task-fixtures.ts`, `apps/api/test/{project-schema,sqlite-task-store,project-store,project-changes}.test.ts` | `developer-store`, worktree lane |
| G2 | `apps/api/migrations/{0001_directory,0003_owner_api}.sql`, `apps/api/package.json`, `apps/api/vitest.config.mts`, `apps/api/src/{env,index,bearer-secret,mcp-endpoint,directory,project-keys,project-routing,time-zone,sign-in-provider,owner-errors,owner-json,owner-routes,owner-endpoint,owner-request,owner-sessions,owner-workspaces,owner-keys}.ts`, `apps/api/test/{directory-seed,owner-client}.ts`, `apps/api/test/{worker,directory,project-keys,project-routing,mcp-endpoint,time-zone,sign-in-provider,owner-json,owner-routes,owner-sign-in,owner-workspaces,owner-keys}.test.ts`, `tools/repository-shape/src/api-source.test.ts`, `AGENTS.md` (the shared-helper line) | `developer-owner`, worktree lane |
| G3 | `apps/api/src/owner-tasks.ts` (and `owner-endpoint.ts`'s handler record, handed over by G2), `apps/api/test/{owner-tasks,owner-changes,owner-isolation}.test.ts`, `apps/api/README.md`, `docs/features/owner-api/tester-briefing.md` | `developer-owner`, after the lead merges G1 |

A G2 source file past about 150 lines may be split; the split is named in the briefing.

**Briefing.** G1 and G2 never write `tester-briefing.md`: each red commit's body carries the failure text its red run printed, and G3 copies those texts from `git log` into the briefing with its own.

## Sequencing

G1 and G2 run in parallel, one worktree each, branched from `feat/owner-api`; G2 never touches a G1 path and the reverse. G2's `owner-json.ts` takes the core's `Task` and `HistoryEntry`, which exist today. The lead merges G1, then G2, into `feat/owner-api` (merge, never rebase), runs the api tests, and hands G3 to `developer-owner` on the merged branch, because G3 calls G1's `readChanges`, `readHistory` and `fetch`.

## Steps

Author this list with every box empty. A sub-agent ticks its own line. A wrong step is struck through with the reason, not deleted.

### G1

- [x] **Step 1:** red then green: project schema version 2 (`change_number` numbered by task number, its unique index, `change_counter` seeded with the highest number), applied inside `transactionSync` to a new store and to a version-1 store; `PROJECT_SCHEMA_VERSION` in `project-schema.ts` is 2 (`project-schema.test.ts`). — evidence: red `7f71f65` and `4905f91`, green `c45b658` (one green for steps 1 and 2: the unique index refuses every insert until the store stamps change numbers); `@todz/api` 332 tests green
- [x] **Step 2:** red then green: `insertTask` and `replaceTask` stamp increasing change numbers; `lastChangeNumber()` (`null` before any write) and `listChangesSince({ cursor, limit })` (`sqlite-task-store.test.ts`). — evidence: red `4905f91`, green `c45b658`
- [x] **Step 3:** red then green: `ProjectStore.readChanges({ cursor })` with `CHANGE_PAGE_SIZE` 100 at the top of `project-store.ts`, answering `{ tasks, cursor, hasMore }`, and `ProjectFailureKind.CursorAhead` for a cursor above the last change number; `readHistory({ number })` with `TaskNotFound` for a missing number (`project-changes.test.ts`). — evidence: red `b0c8e52`, green `4270159`; `mcp-format.ts` rejects `CursorAhead` because the typecheck forced it
- [x] **Step 4:** red then green: `ProjectStore.fetch` accepts a socket upgrade and answers 426 without one; every write that moves the change counter sends `changed` to each socket, a write that fails or replays sends nothing (`project-changes.test.ts`). — evidence: red `05f6865`, green `cb8033b`; `@todz/api` 349 tests green

### G2

- [ ] **Step 5:** pin: `0001_directory.sql` gains `projects.is_inbox`, `project_keys.id` and `project_keys.hint`; `0003_owner_api.sql`; `seedProject`, `seedKey` and every caller follow; `worker.test.ts` lists the seven tables; schema pins in `directory.test.ts`; `bearerSecret` moves to `bearer-secret.ts` and joins the shared-helper line of `AGENTS.md`; `api-source.test.ts` fails when `wrangler.jsonc` names `SIGN_IN_PROVIDER`. All existing tests stay green.
- [ ] **Step 6:** red then green: `issueProjectKey` returns `{ id, secret }` and stores `id` and `hint`; its callers in `directory-seed.ts` and `mcp-endpoint.test.ts` follow (`project-keys.test.ts`); `findOwnedProjectId` and `findOwnedWorkspaceId` in `project-routing.ts`, brand-checked, opening no stub (`project-routing.test.ts`).
- [ ] **Step 7:** red then green: `canonicalTimeZone` (`time-zone.test.ts`) and the fake provider (`sign-in-provider.test.ts`).
- [ ] **Step 8:** red then green: the JSON shapes (`owner-json.test.ts`) and the route table matching, including `:number` bounds and the empty 404 (`owner-routes.test.ts`).
- [ ] **Step 9:** red then green: `SignIn`, `SignOut`, `ReadOwner`, `UpdateOwner`, the session cap and expiry, the 503 without a provider and with `apple`, the check order, the race on a first sign-in (`owner-sign-in.test.ts`, helper `owner-client.ts`).
- [ ] **Step 10:** red then green: `ListWorkspaces`, `CreateWorkspace` with its Inbox, `RenameWorkspace`, `CreateProject`, `RenameProject` with `inbox_is_fixed` (`owner-workspaces.test.ts`).
- [ ] **Step 11:** red then green: `ListKeys`, `IssueKey`, `RevokeKey`; a revoked key answers 401 on `/mcp` and loses its MCP sessions (`owner-keys.test.ts`).

### G3

- [ ] **Step 12:** red then green: `AddTasks`, `UpdateTask`, `CompleteTasks`, `ReopenTasks`, `ReadHistory`, every row of the error table they reach; history names the owner (`owner-tasks.test.ts`).
- [ ] **Step 13:** red then green: `ReadChanges` paging and cursor validation; `WatchChanges` 101 and 426; `changed` after an owner write and after an MCP `add` (`owner-changes.test.ts`).
- [ ] **Step 14:** the owner isolation suite (`owner-isolation.test.ts`); cases green on landing are marked `pin`.
- [ ] **Step 15:** `apps/api/README.md` states the owner API's purpose; `tester-briefing.md` written with the red texts each red run printed.

## Failure modes

| Step | What breaks | How I notice (the concrete signal) | How I back out |
|------|-------------|------------------------------------|----------------|
| 1 | `ALTER TABLE` inside the Durable Object fails on a store already at version 1 | the upgrade test throws `duplicate column` or the version stays 1 | apply version 2 only when `schema_version` reads 1 |
| 2 | a replay or failed write still consumes a change number | the cursor jumps with no task returned | stamp inside `insertTask` and `replaceTask` only; the transaction rolls the counter back |
| 4 | a broadcast inside the transaction runs before the commit | a socket receives `changed` for a write that rolled back | broadcast after `transactionSync` returns an ok result |
| 4 | the hibernation API is unavailable in the pool | the upgrade answers 500 | the spike of 2026-11-23 proved it; compare the plugin version |
| 5 | an existing seed inserts a project or key without the new columns | `NOT NULL constraint failed` | route every insert through the seeds |
| 9 | two first sign-ins on one subject create two owners | the race test finds two owner rows | the primary key on `(provider, subject)` refuses the second; read again |
| 9 | the fake provider answers outside tests and `wrangler dev` | the 503 test passes but `wrangler.jsonc` names the variable | the repository-shape check of the reviewer; ADR 0020 |
| 11 | a revoked key's MCP session still names a client | the MCP call after revocation answers 200 | `openKeyProject` refuses the revoked key first; the batch also deletes sessions |
| 13 | the socket test hangs waiting for a message that never comes | the test times out at 30 s | race the message against a short `Promise` that rejects, never `sleep` |
| 14 | another owner's project answers differently from a never-issued id | the suite's body equality fails | both come from the same `not_found` response |

**Steps with no backout:** none; nothing is deployed or migrated outside a local runtime.

## Z. Prove and ship

- [ ] **Tester briefing:** a developer wrote `tester-briefing.md`.
- [ ] **Tester run:** a fresh `tester` sub-agent executed `test-plan.md` and ticked every box with evidence.
- [ ] **Reviewer:** a fresh `reviewer` sub-agent returned a verdict; refutation of the three riskiest claims is recorded in `test-plan.md`.
- [ ] **/check-ui:** not applicable: no UI.
- [ ] **/open-pr:** gates passed, learnings sweep stated, PR opened.
