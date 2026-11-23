# Project store

**Status:** Shipped 2026-11-23
**Tier:** 🔴
**Owner approval:** approved 2026-11-23, by inheritance from [the v1 product design](../../product/README.md) (Order of delivery, item 2; Isolation), approved by the owner on 2026-11-23; the calls below that the product design does not make are ADRs marked as the loop's calls and listed in the loop's questions for the owner
**ADRs:** [0010](../../adr/0010-the-task-rules-run-behind-synchronous-ports.md), [0012](../../adr/0012-worker-tests-run-inside-workerd.md), [0013](../../adr/0013-a-project-is-reached-only-through-the-directory.md), [0014](../../adr/0014-credentials-are-stored-as-sha-256-digests.md), [0015](../../adr/0015-the-project-store-answers-with-results-not-thrown-errors.md)
**Not changing:** the task rules in `libs/core`; no HTTP route, no MCP tool, no sign-in, no key or session issuance, no change feed, no WebSocket, no app; those are `mcp-server`, `owner-api` and the macOS features. Nothing is deployed.

## Problem

The task rules exist, but nothing stores a task. The MCP server and the owner API both need the same place to keep a project's tasks, and the same way to get from a credential to that place, with the guarantee the product design puts first: no read or write ever crosses a project boundary.

## Goals

- `apps/api`, a Cloudflare Worker run locally with Wrangler, with a D1 directory (owners, workspaces, projects, MCP key digests, session digests) and no task data in it.
- One Durable Object with its own SQLite database per project, holding that project's tasks and history, implementing the core's `TaskStore` port.
- RPC methods on that Durable Object that run each core use case in one synchronous transaction and answer with results (ADR 0015).
- A routing module that turns a credential into a project stub through the directory, and only that way (ADR 0013).
- An isolation suite in the unit gate that attacks project B with project A's credentials and with another owner's session, and always gets the answer an id that never existed gets.

## Non-goals

- Creating owners, workspaces, projects, keys or sessions from a request: `owner-api` and `mcp-server`. Tests seed the directory directly.
- The change feed, cursors and the "changed" WebSocket: `owner-api`.
- Reading a task's history from outside the Durable Object: `owner-api` adds the RPC when the inspector needs it.
- Deploying, a remote D1 database, a domain.

## Design

### Data flow

```
credential secret ──▶ digestCredential (SHA-256 hex, ADR 0014)
                         │
                         ▼
  D1 directory ── project_keys (digest → project, unrevoked)        ──▶ projectId | null
               ── sessions (digest → owner, unexpired) + projects    ──▶ ownerId | null ──▶ owned projectId | null
                         │ projectId from the directory only
                         ▼
  routing: PROJECT_STORE.get(idFromName(projectId)) ──▶ ProjectStore stub | null   (ADR 0013)
                         │ RPC
                         ▼
  ProjectStore Durable Object ── transactionSync ── core use case ── SqliteTaskStore ── this project's SQLite
                         │
                         ▼
  { ok: true, value } | { ok: false, failure }   (ADR 0015)
```

### Interfaces

Package `@todz/api` under `apps/api`, depending on `@todz/core` and `@todz/types`.

**Wrangler configuration** (`wrangler.jsonc`): Worker `todz-api`, entry `src/index.ts`, a D1 binding `DIRECTORY` with `migrations_dir` `migrations` and a placeholder database id (nothing is deployed), a Durable Object binding `PROJECT_STORE` for the class `ProjectStore`, declared in a `new_sqlite_classes` migration.

**Directory** (`migrations/0001_directory.sql`, D1, `STRICT` tables, foreign keys):

| Table | Columns |
|---|---|
| `owners` | `id TEXT PRIMARY KEY`, `created_at INTEGER NOT NULL` |
| `workspaces` | `id TEXT PRIMARY KEY`, `owner_id TEXT NOT NULL REFERENCES owners`, `name TEXT NOT NULL`, `created_at INTEGER NOT NULL` |
| `projects` | `id TEXT PRIMARY KEY`, `workspace_id TEXT NOT NULL REFERENCES workspaces`, `name TEXT NOT NULL`, `created_at INTEGER NOT NULL` |
| `project_keys` | `digest TEXT PRIMARY KEY CHECK (length(digest) = 64)`, `project_id TEXT NOT NULL REFERENCES projects`, `created_at INTEGER NOT NULL`, `revoked_at INTEGER` |
| `sessions` | `digest TEXT PRIMARY KEY CHECK (length(digest) = 64)`, `owner_id TEXT NOT NULL REFERENCES owners`, `created_at INTEGER NOT NULL`, `expires_at INTEGER NOT NULL` |

No directory column holds a task's title, notes or any task field. Ids are UUIDs from `crypto.randomUUID()`; instants are epoch milliseconds.

**Project database** (the Durable Object's SQLite, created by the constructor inside `blockConcurrencyWhile`, versioned by a one-row `schema_version` table because Durable Object SQLite refuses `PRAGMA user_version` with `SQLITE_AUTH`, `STRICT` tables):

| Table | Columns |
|---|---|
| `tasks` | `number INTEGER PRIMARY KEY`, `title TEXT NOT NULL`, `notes TEXT`, `due_date TEXT`, `state TEXT NOT NULL`, `order_key TEXT NOT NULL COLLATE BINARY`, `idempotency_key TEXT UNIQUE`, `created_by_kind TEXT NOT NULL`, `created_by_client TEXT`, `created_at INTEGER NOT NULL`, `updated_at INTEGER NOT NULL`, `completed_at INTEGER` |
| `task_history` | `id INTEGER PRIMARY KEY AUTOINCREMENT`, `task_number INTEGER NOT NULL REFERENCES tasks`, `at INTEGER NOT NULL`, `actor_kind TEXT NOT NULL`, `actor_client TEXT`, `action TEXT NOT NULL`, `fields TEXT NOT NULL` (a JSON array of `TaskField`), `note TEXT` |
| `task_counter` | one row: `last_issued_number INTEGER NOT NULL` |
| `schema_version` | one row: `version INTEGER NOT NULL`, `1` for this schema |

**`SqliteTaskStore`** implements `TaskStore` over `SqlStorage`:

- `lastIssuedTaskNumber()` reads `task_counter`, `null` when it has no row; `insertTask` sets the counter to the larger of the counter and the task's number (inserting `T-3` after `T-5` leaves 5), so a number is never issued twice even if a task row stopped existing.
- `listTasksInState(state)` returns that state's tasks ordered by `order_key` (BINARY, the order JavaScript string comparison gives the ASCII keys of ADR 0009).
- Rows map to `Task` and `HistoryEntry` exactly: an owner actor has no client name, an agent actor always has one; a row that breaks that (an unknown state, action or field, an agent without a client, an owner with one) throws, never defaults, with a message that names only the column and the task number, never a row value.
- `listHistory(number)` (not on the port) returns a task's history in insertion order, for tests and the future inspector.

**`ProjectStore`** Durable Object (`extends DurableObject`), RPC methods, each one named object, each one use case inside `ctx.storage.transactionSync` with a clock that reads `Date.now()`:

| Method | Runs | Value |
|---|---|---|
| `addTasks({ actor, drafts })` | `addTasks` | `AddedTask[]` |
| `updateTask({ actor, number, patch })` | `updateTask` | `Task` |
| `completeTasks({ actor, numbers, note })` | `completeTasks` | `CompletedTask[]` |
| `reopenTasks({ actor, numbers })` | `reopenTasks` | `ReopenedTask[]` |
| `listTasks({ today, filter })` | `listTasks` | `TaskList` |
| `nextTask({ today })` | `nextTask` | `Task \| null` |

Each returns `ProjectResult<Value> = { ok: true; value: Value } | { ok: false; failure: ProjectFailure }` where `ProjectFailure = { kind: ProjectFailureKind.TaskNotFound; number: number } | { kind: ProjectFailureKind.RuleViolated; issue: RuleIssue; index: number | null }`. `ProjectFailureKind` is an enum in `apps/api` (`TaskNotFound = 'task_not_found'`, `RuleViolated = 'rule_violated'`). Any other error is rethrown.

Arguments arrive as structured clones, so the Durable Object does not trust their brands: it rebuilds an agent actor with `agentActor(clientName)` (an invalid name → `{ kind: RuleViolated, issue: ClientNameInvalid, index: null }`), and parses `today` with `parseCalendarDate`; an actor of an unknown kind or a `today` that does not parse is a caller's bug and is thrown.

**Credentials** (`credential-digest.ts`): `digestCredential(secret)` → `Promise<string>`, the lowercase hex SHA-256 of the UTF-8 secret (ADR 0014).

**Directory reads** (`directory.ts`), each one named object with `directory: D1Database`:

| Function | Returns |
|---|---|
| `findKeyProject({ directory, digest })` | the `project_id` of the key with that digest whose `revoked_at IS NULL`, else `null` |
| `findSessionOwner({ directory, digest, now })` | the `owner_id` of a session with that digest whose `expires_at` is after `now`, else `null` |
| `findOwnedProject({ directory, ownerId, projectId })` | `projectId` when that project's workspace belongs to `ownerId`, else `null` |

**Routing** (`project-routing.ts`), the only module under `apps/api/src` that names `PROJECT_STORE` apart from the `Env` type in `env.ts`, which a repository-shape test enforces on the bare identifier:

| Function | Returns |
|---|---|
| `openKeyProject({ env, secret })` | the stub of the key's project, else `null`; a secret that is not a string or is blank once trimmed is refused before any lookup |
| `resolveSessionOwner({ env, secret, now })` | a `SessionOwner` for a live session, else `null`; a secret refused as above before any lookup |
| `openOwnedProject({ env, owner, projectId })` | the stub of that project when `owner` owns it, else `null`; an `owner` that `resolveSessionOwner` did not build is refused before any lookup |

`SessionOwner` is a branded type (`{ readonly ownerId: string } & { readonly sessionOwner: unique symbol }`) that only `resolveSessionOwner` builds, frozen, and recorded in a module-level `WeakSet` that `openOwnedProject` checks at run time, so it cannot be handed an owner id taken from a request, at compile time or at run time.

**Worker** (`src/index.ts`): exports `ProjectStore` and a default `fetch` that answers `404` with an empty body to every request; the HTTP surfaces arrive with `mcp-server` and `owner-api`.

### Failure handling

- A rule violation or a missing task inside a use case → `{ ok: false, failure }` and nothing written (the transaction rolled back).
- A task number of another project is a missing task: the failure is the one an id that never existed gets, field for field.
- An unknown, revoked or empty key, an expired or unknown session, another owner's project and a project id that never existed → `null` from routing; no Durable Object is addressed.
- A SQL error or a row that does not map → thrown; `transactionSync` rolls back; the RPC caller sees a rejected promise.
- No module under `apps/api/src` calls `console`: logs never carry task titles, notes, secrets or digests.

## Open questions → answers

| Question | Options | Owner's answer | Date |
|----------|---------|----------------|------|
| How do Worker tests run? | vitest-plugin in workerd / vitest-pool-workers on Vitest 4 / Node over HTTP / fakes | Loop's call: vitest-plugin in workerd ([ADR 0012](../../adr/0012-worker-tests-run-inside-workerd.md)); listed for the owner | 2026-11-23 |
| How is a project's Durable Object addressed? | `idFromName(projectId)` behind the directory / `newUniqueId` stored | Loop's call: `idFromName` behind the directory ([ADR 0013](../../adr/0013-a-project-is-reached-only-through-the-directory.md)); listed for the owner | 2026-11-23 |
| How are credentials stored? | SHA-256 / HMAC with pepper / slow hash | Loop's call: SHA-256 of 256-bit secrets ([ADR 0014](../../adr/0014-credentials-are-stored-as-sha-256-digests.md)); listed for the owner | 2026-11-23 |
| How do expected failures cross RPC? | result values / thrown errors / fetch with JSON | Loop's call: result values ([ADR 0015](../../adr/0015-the-project-store-answers-with-results-not-thrown-errors.md)); listed for the owner | 2026-11-23 |

## Rollback

Nothing is deployed and no production data exists: reverting the merge commit removes `apps/api` and the ADRs' code. Once a later feature deploys, a change to either schema ships as a new migration, never an edit of `0001_directory.sql` or of the project schema version 1.

## Test strategy summary

Vitest inside workerd (ADR 0012), in `apps/api`: the SQLite adapter against the core's expectations (round trips, counter, BINARY order, mapping failures, rollback), each RPC method's value and failure, the directory reads and the routing, and the isolation suite. A repository-shape test fails when a file under `apps/api/src` names `console`, or when a file other than `project-routing.ts` and `env.ts` names `PROJECT_STORE`. No browser surface, so no Playwright.
