# Owner API

**Status:** Approved
**Tier:** 🔴
**Owner approval:** approved 2026-11-23, by inheritance from [the v1 product design](../../product/README.md) (Order of delivery, item 4; Model; Views; Isolation; Sync; Calls made without the owner), approved by the owner on 2026-11-23; the calls below that the product design does not make are ADRs marked as the loop's calls and listed in the loop's questions for the owner
**ADRs:** [0013](../../adr/0013-a-project-is-reached-only-through-the-directory.md), [0014](../../adr/0014-credentials-are-stored-as-sha-256-digests.md), [0015](../../adr/0015-the-project-store-answers-with-results-not-thrown-errors.md), [0018](../../adr/0018-the-mcp-server-reads-today-in-the-owner-s-time-zone.md), [0019](../../adr/0019-mcp-keys-are-prefixed-and-shown-once.md), [0020](../../adr/0020-sign-in-goes-through-a-provider-port-and-v1-ships-only-the-fake.md), [0021](../../adr/0021-owner-sessions-are-bearer-secrets-that-last-90-days.md), [0022](../../adr/0022-the-owner-api-is-json-routes-and-the-app-builds-the-cross-project-views.md), [0023](../../adr/0023-each-project-numbers-its-changes-and-its-socket-only-says-changed.md)
**Not changing:** the task rules in `libs/core`; the MCP tools and their answers (they gain only the "changed" broadcast after a write); no app, no Apple verifier, no deletion of workspaces, projects or tasks. Nothing is deployed.

## Problem

The Worker serves agents through MCP, but the owner has no way in: no sign-in, no workspaces or projects, no way to change tasks, read history, learn what changed, or create the MCP key an agent needs. The macOS app (`mac-app-shell`, `mac-sync`, `connect-an-agent`) needs all of it against the local API.

## Goals

- Sign-in through a provider port with the fake provider in development and tests, a session secret shown once (ADRs 0020, 0021), and the owner's IANA time zone written at sign-in and on change, validated (carry-over a of run 3).
- Workspaces that start with an Inbox project, and projects inside them, named with the core's name rules (ADR 0022).
- Every task write the core offers (add, update, complete, reopen) as the owner, and each task's history (carry-over d).
- A per-project change feed with an integer cursor, and a WebSocket that says only `changed` after any write, the owner's or an agent's (ADR 0023).
- Issue, list and revoke the MCP keys of a project; a key is shown once (ADR 0019, carry-over b).
- The isolation suite extended: another owner's session never reads, changes, pulls, watches or keys a project it does not own, and gets answers identical to an id that never existed.

## Non-goals

- The Apple verifier, sign-out everywhere, listing sessions (ADRs 0020, 0021).
- Deleting or archiving a workspace, project or task (open question for the owner).
- A cross-project or per-view route (ADR 0022); a task list route (the app reads the feed).
- Quotas on workspaces, projects or keys per owner; rate limits.
- Closing open sockets at sign-out or key revocation.

## Design

### Data flow

```
app ── POST /owner/sessions { identity_token, time_zone } ──▶ SignInProvider (fake) ─ null → 401
                                                                │ subject
                     owner_identities (provider, subject) → owner (created if new), time_zone written
                                                                │
                                     session secret (shown once) ◀── sessions row (digest, +90 days, cap 20)

app ── Authorization: Bearer <session> ──▶ /owner/... ──▶ resolveSessionOwner ─ null → 401
                                                                │ SessionOwner
               workspace routes ──▶ directory (owner_id = ?)    │ project routes
                                                                ▼
                                              openOwnedProject ─ null → 404 not_found
                                                                │ stub
                     ProjectStore RPC (actor = OWNER_ACTOR) ─▶ result → JSON, or error JSON
                                                                │ change counter moved?
                                                                ▼
                                          every socket of this project ◀── "changed"
MCP write (agent) ──▶ the same ProjectStore methods ──▶ the same broadcast
```

### Directory

`migrations/0001_directory.sql` is edited once more before any deploy (ADR 0018 point 3): `projects` gains `is_inbox INTEGER NOT NULL CHECK (is_inbox IN (0, 1))`; `project_keys` gains `id TEXT NOT NULL UNIQUE` and `hint TEXT NOT NULL CHECK (length(hint) = 4)`, the last four characters of the key.

`migrations/0003_owner_api.sql`:

| Object | Definition |
|---|---|
| `owner_identities` | `provider TEXT NOT NULL`, `subject TEXT NOT NULL`, `owner_id TEXT NOT NULL REFERENCES owners (id)`, `created_at INTEGER NOT NULL`, `PRIMARY KEY (provider, subject)`, `STRICT` |
| `projects_inbox` | unique index on `projects (workspace_id) WHERE is_inbox = 1` |
| `workspaces_owner` | index on `workspaces (owner_id, created_at)` |
| `projects_workspace` | index on `projects (workspace_id, created_at)` |
| `sessions_owner` | index on `sessions (owner_id, created_at)` |
| `project_keys_project` | index on `project_keys (project_id, created_at)` |

`directory.ts` gains one function per statement, each taking one named object with `directory: D1Database`; the plan lists them. Every workspace and project read or write carries `owner_id = ?` from the `SessionOwner`.

### Sign-in

- `sign-in-provider.ts`: `enum SignInProviderKind { Fake = 'fake' }`; `type SignInProvider = { verify(identityToken: string): Promise<string | null> }`; `SIGN_IN_PROVIDER_OF_KIND: Record<SignInProviderKind, SignInProvider>`. The fake accepts `^[A-Za-z0-9._-]{1,64}$` and answers the token itself as the subject.
- `Env` gains `SIGN_IN_PROVIDER?: string`. An absent or unknown value → 503 `sign_in_unavailable`. `apps/api/package.json`'s `dev` script becomes `wrangler dev --var SIGN_IN_PROVIDER:fake`; the Vitest configuration sets the binding; `wrangler.jsonc` never names it (ADR 0020).
- `time-zone.ts`: `canonicalTimeZone(raw: string): string | null` → `new Intl.DateTimeFormat('en-US', { timeZone: raw }).resolvedOptions().timeZone` when that does not throw and the result starts with a letter (an offset such as `+01:00` is refused: it ignores daylight saving), else `null`. Input longer than `TIME_ZONE_MAX_LENGTH` (64) is refused before `Intl` sees it. The canonical name is what is stored (`america/sao_paulo` → `America/Sao_Paulo`).
- Sign-in: find the identity; if absent, insert `owners` and `owner_identities` in one batch; else update the owner's `time_zone`. Then store the session (`digest`, `owner_id`, `now`, `now + OWNER_SESSION_LIFETIME_MS`) with the cap batch of ADR 0021. Two first sign-ins racing on one subject: the second insert fails the primary key, and the handler reads the identity again and proceeds as an existing owner.
- `bearer-secret.ts`: the MCP endpoint's `bearerSecret` moves here unchanged and both endpoints import it.

### Routes

`owner-endpoint.ts` receives every path under `/owner` from `index.ts` (`ROUTE_OF_PATH` becomes a prefix check for `/owner`, the `/mcp` entry unchanged). `owner-routes.ts` holds `enum OwnerRoute` and `OWNER_ROUTES: Record<OwnerRoute, { method: string; pattern: URLPattern }>`; `OWNER_HANDLERS: Record<OwnerRoute, OwnerHandler>` lives with the handlers. The first route whose method and pattern match wins; none → 404 with an empty body. `:number` matches `[1-9][0-9]{0,8}`.

| Route | Method and path | Session | Body or query | Answer |
|---|---|---|---|---|
| `SignIn` | `POST /owner/sessions` | none | `{ identity_token: string, time_zone: string }` | 201 `{ session_token, owner }` |
| `SignOut` | `DELETE /owner/sessions/current` | yes | — | 204 |
| `ReadOwner` | `GET /owner` | yes | — | 200 `{ owner }` |
| `UpdateOwner` | `PATCH /owner` | yes | `{ time_zone: string }` | 200 `{ owner }` |
| `ListWorkspaces` | `GET /owner/workspaces` | yes | — | 200 `{ workspaces }`, each with its `projects`, oldest first |
| `CreateWorkspace` | `POST /owner/workspaces` | yes | `{ name: string }` | 201 `{ workspace }` with its Inbox |
| `RenameWorkspace` | `PATCH /owner/workspaces/:workspaceId` | yes | `{ name: string }` | 200 `{ workspace }` |
| `CreateProject` | `POST /owner/workspaces/:workspaceId/projects` | yes | `{ name: string }` | 201 `{ project }` |
| `RenameProject` | `PATCH /owner/projects/:projectId` | yes | `{ name: string }` | 200 `{ project }`; the Inbox → 409 `inbox_is_fixed` |
| `AddTasks` | `POST /owner/projects/:projectId/tasks` | yes | `{ tasks: [{ title, notes?, due_date?, idempotency_key? }] }` | 201 `{ tasks: [{ task, replayed }] }` |
| `UpdateTask` | `PATCH /owner/projects/:projectId/tasks/:number` | yes | any of `title`, `notes`, `due_date`, `placement` | 200 `{ task }` |
| `CompleteTasks` | `POST /owner/projects/:projectId/tasks/complete` | yes | `{ numbers: number[], note?: string \| null }` | 200 `{ tasks: [{ task, already_done }] }` |
| `ReopenTasks` | `POST /owner/projects/:projectId/tasks/reopen` | yes | `{ numbers: number[] }` | 200 `{ tasks: [{ task, already_open }] }` |
| `ReadHistory` | `GET /owner/projects/:projectId/tasks/:number/history` | yes | — | 200 `{ history }`, oldest first |
| `ReadChanges` | `GET /owner/projects/:projectId/changes?cursor=<n>` | yes | `cursor`: a non-negative safe integer | 200 `{ tasks, cursor, has_more }` |
| `WatchChanges` | `GET /owner/projects/:projectId/socket` | yes | `Upgrade: websocket` | 101 from the project's Durable Object; without the header 426 |
| `ListKeys` | `GET /owner/projects/:projectId/keys` | yes | — | 200 `{ keys }`, unrevoked, oldest first |
| `IssueKey` | `POST /owner/projects/:projectId/keys` | yes | — | 201 `{ key, secret }`, the secret only here |
| `RevokeKey` | `DELETE /owner/projects/:projectId/keys/:keyId` | yes | — | 204; its MCP sessions are deleted in the same batch |

Bodies are parsed with zod from `parsedJson(await request.text())`; optional task fields use `.nullable().default(null)` as the MCP tools do, and `UpdateTask` copies a key only when it is present, so `null` clears notes or the due date. `placement` is `{ kind, anchor? }` with `kind` from `TaskPlacement` and `anchor` a task number. Names and texts go to the core unbounded; its rule issues are the only limits.

### JSON shapes (`owner-json.ts`, pure functions)

| Shape | Fields |
|---|---|
| owner | `id`, `time_zone` |
| workspace | `id`, `name`, `created_at`, `projects` |
| project | `id`, `name`, `is_inbox` (boolean), `created_at` |
| task | `number`, `title`, `notes`, `due_date`, `state`, `order_key`, `idempotency_key`, `created_by`, `created_at`, `updated_at`, `completed_at` |
| actor | `kind`, `client_name` (`null` for the owner) |
| history entry | `at`, `actor`, `action`, `fields`, `note` |
| key | `id`, `hint`, `created_at` |

Times are epoch milliseconds; enum values are the `libs/types` values.

### Errors (`owner-errors.ts`)

`enum OwnerErrorCode`; every error body is `{ error }` plus the fields named here.

| Status | `error` | When |
|---|---|---|
| 400 | `invalid_request` | body not JSON or failing its schema; a bad cursor |
| 401 | — (empty body, `WWW-Authenticate: Bearer`) | no, blank, unknown or expired session on a session route |
| 401 | `identity_rejected` | the provider refused the identity token |
| 404 | — (empty body) | no route matches |
| 404 | `not_found` | a workspace, project or key the owner does not have, including another owner's |
| 404 | `task_not_found`, `number` | the core's `TaskNotFound` |
| 409 | `inbox_is_fixed` | renaming an Inbox project |
| 422 | `rule_violated`, `issue`, `index` | the core's `RuleViolated` |
| 422 | `time_zone_invalid` | `canonicalTimeZone` answered `null` |
| 426 | — (empty body, `Upgrade: websocket`) | `WatchChanges` without the upgrade header |
| 503 | `sign_in_unavailable` | no sign-in provider configured |

### Project store

- Project schema version 2 (ADR 0023): `ALTER TABLE tasks ADD COLUMN change_number INTEGER NOT NULL DEFAULT 0`, index `tasks_change_number`, table `change_counter (last_change_number INTEGER NOT NULL)`. `applyProjectSchema` applies version 1 then 2 on a new store and only 2 on a version-1 store; `PROJECT_SCHEMA_VERSION` becomes 2.
- `SqliteTaskStore.insertTask` and `replaceTask` stamp the next change number; new reads `lastChangeNumber()`, `listChangesSince({ cursor, limit })` and the existing `listHistory(number)`.
- `ProjectStore` gains `readChanges({ cursor })`, `readHistory({ number })` (a missing task → `TaskNotFound`), and `fetch(request)` that accepts a socket upgrade with `ctx.acceptWebSocket` and answers 426 otherwise. Every write method compares `lastChangeNumber()` before and after its transaction and, when it moved, sends `changed` to `ctx.getWebSockets()`; a socket whose send throws is skipped. `webSocketMessage` does nothing.

### Keys

`issueProjectKey` now returns `{ id, secret }`, writing `id` (`crypto.randomUUID()`) and `hint` (the secret's last four characters). Listing returns unrevoked keys. Revoking sets `revoked_at` and deletes the key's `mcp_sessions` in one batch; an already revoked or another project's key → 404 `not_found`.

### Failure handling

- A refused credential never opens a Durable Object; a project route checks ownership in the directory first.
- A write that fails rolls back inside the Durable Object (ADR 0015) and broadcasts nothing.
- Logs: no module calls `console`; error bodies never echo task text, names or tokens.

## Open questions → answers

| Question | Options | Owner's answer | Date |
|----------|---------|----------------|------|
| How does v1 sign in without the paid membership? | fake behind a port, off unless dev / Apple now / fake in `vars` / no sign-in | Loop's call: the port, fake only, off by default ([ADR 0020](../../adr/0020-sign-in-goes-through-a-provider-port-and-v1-ships-only-the-fake.md)); listed for the owner | 2026-11-23 |
| How long does a session last? | 90 days fixed, capped / sliding / 30 days / refresh tokens | Loop's call: 90 days fixed, 20 per owner ([ADR 0021](../../adr/0021-owner-sessions-are-bearer-secrets-that-last-90-days.md)); listed for the owner | 2026-11-23 |
| What shape is the API, and who builds the views? | JSON routes with app-side views / server view routes / GraphQL; default workspace or none | Loop's call: JSON routes, views in the app, no default workspace, a fixed Inbox ([ADR 0022](../../adr/0022-the-owner-api-is-json-routes-and-the-app-builds-the-cross-project-views.md)); listed for the owner | 2026-11-23 |
| How does the app learn what changed? | change number per task / change log / `updated_at` / push data on the socket | Loop's call: change numbers, socket says `changed` ([ADR 0023](../../adr/0023-each-project-numbers-its-changes-and-its-socket-only-says-changed.md)); listed for the owner | 2026-11-23 |

## Rollback

Nothing is deployed and no production data exists: reverting the merge commit removes the routes, the identities table, the new columns and project schema version 2. A local `.wrangler` directory is deleted once after either direction, because `0001` changed and project stores may hold version 2.

## Test strategy summary

Vitest inside workerd (ADR 0012). Unit: the time zone canonicaliser, the fake provider, the JSON shapes, the route table matching, the change stamping and the schema upgrade from version 1. HTTP: every row of the route table and the error table through `exports.default.fetch`, including the socket receiving `changed` after an owner write and after an MCP write. Isolation: every project and workspace route with a second owner's session, compared byte for byte with a never-issued id. The tester also runs `wrangler dev` and drives the routes with `curl` and a WebSocket client from Node. No browser surface, so no Playwright.
