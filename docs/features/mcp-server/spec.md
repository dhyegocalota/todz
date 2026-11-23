# MCP server

**Status:** Approved
**Tier:** 🔴
**Owner approval:** approved 2026-11-23, by inheritance from [the v1 product design](../../product/README.md) (Order of delivery, item 3; MCP server; Isolation), approved by the owner on 2026-11-23; the calls below that the product design does not make are ADRs marked as the loop's calls and listed in the loop's questions for the owner
**ADRs:** [0011](../../adr/0011-due-dates-are-calendar-dates-and-the-caller-names-today.md), [0013](../../adr/0013-a-project-is-reached-only-through-the-directory.md), [0014](../../adr/0014-credentials-are-stored-as-sha-256-digests.md), [0015](../../adr/0015-the-project-store-answers-with-results-not-thrown-errors.md), [0016](../../adr/0016-the-mcp-server-runs-on-the-sdk-v2-and-serves-both-protocol-eras.md), [0017](../../adr/0017-a-2025-era-client-is-named-by-a-session-in-the-directory.md), [0018](../../adr/0018-the-mcp-server-reads-today-in-the-owner-s-time-zone.md), [0019](../../adr/0019-mcp-keys-are-prefixed-and-shown-once.md)
**Not changing:** the task rules in `libs/core`; the `ProjectStore` methods; no HTTP route for the owner, no sign-in, no key listing or revocation route, no app; those are `owner-api`, `mac-app-shell` and `connect-an-agent`. Nothing is deployed.

## Problem

The project store keeps tasks, but nothing outside the Worker can reach them. An agent in Claude Code, Codex or Cursor needs to read and change the tasks of one project with one key, in output small enough not to flood its context, and with no way to learn that another project exists.

## Goals

- `POST /mcp` on the Worker speaks MCP over Streamable HTTP, authenticated with `Authorization: Bearer <key>`, to clients of both protocol eras (ADR 0016).
- Five tools, `next`, `add`, `list`, `update`, `done`, and one prompt, `next`, all bound to the key's project.
- Every write names the client as its actor; a 2025-era client is named through a session (ADR 0017).
- `next` and `list` see today in the owner's time zone (ADR 0018).
- `issueProjectKey` creates a key, shown once and stored as a digest (ADR 0019), for `owner-api` to expose.
- Compact text answers with short ids.
- End-to-end tests with a real MCP client in both eras, and the isolation suite extended through MCP.

## Non-goals

- An HTTP route that issues, lists or revokes keys: `owner-api` and `connect-an-agent`.
- Reopening a task, reading history, or deleting a task through MCP: the product design's tool list has none of them.
- Server-initiated messages: no `GET` stream, no subscriptions, no progress notifications.
- OAuth, `/.well-known` metadata, or a claude.ai connector.
- Cleaning up expired sessions.

## Design

### Data flow

```
MCP client ── POST /mcp, Authorization: Bearer todz_… ──▶ Worker fetch
                                                             │ path other than /mcp → 404
                                                             ▼
                        openKeyProject (digest → project_keys ⋈ projects ⋈ workspaces ⋈ owners)
                              │ null → 401                    │ { project stub, keyDigest, timeZone }
                              ▼                               ▼
              isLegacyRequest(request)? ── no ──▶ modern: client name from the request's envelope
                              │ yes
                              ▼
              initialize? ── yes ──▶ agentActor(clientInfo.name) ─ invalid → 400
                              │                 └─ insert mcp_sessions(digest(id), keyDigest, name, expiry) → Mcp-Session-Id: id
                              │ no
                              ▼
              Mcp-Session-Id ── missing → 400 ── unknown, expired or another key's → 404
                              │ client name
                              ▼
     McpServer for this request (project stub, today in timeZone, client name)
                              │ tool → ProjectStore RPC (ADR 0015 results)
                              ▼
                     compact text, or a tool error with isError: true
```

### HTTP surface

`src/index.ts` dispatches on the pathname from a record keyed by the path: `/mcp` → the MCP endpoint, anything else → 404 with an empty body, as today.

| Request to `/mcp` | Answer |
|---|---|
| no `Authorization` header, a scheme other than `Bearer`, a blank secret, an unknown or revoked key | 401, `WWW-Authenticate: Bearer`, empty body; no Durable Object addressed |
| a modern request (the SDK's `isLegacyRequest` is false) | the SDK's modern handler (`createMcpHandler` with `legacy: 'reject'`) |
| a 2025-era `POST` whose JSON body is one `initialize` request with a valid client name | the SDK's stateless legacy answer, plus an `Mcp-Session-Id` header with a new session id |
| the same with a client name that `agentActor` refuses | 400, a JSON-RPC error `-32602` whose message is the `client_name_invalid` copy, `id` echoed; no session stored |
| any other 2025-era request without `Mcp-Session-Id` | 400, a JSON-RPC error `-32000`, `Bad Request: Mcp-Session-Id header is required`, `id: null` |
| any other 2025-era request whose session is unknown, expired or belongs to another key | 404, a JSON-RPC error `-32001`, `Session not found`, `id: null` |
| any other 2025-era request with a live session of this key | the SDK's stateless legacy answer (`GET` and `DELETE` get its 405) |

The body is parsed with `request.clone()` so the SDK still reads the original. A body that is not JSON or is a batch array is not an `initialize`.

### Directory

`migrations/0001_directory.sql`: `owners` gains `time_zone TEXT NOT NULL CHECK (time_zone <> '')` (ADR 0018, point 3).

`migrations/0002_mcp_sessions.sql`:

| Table | Columns |
|---|---|
| `mcp_sessions` | `digest TEXT PRIMARY KEY CHECK (length(digest) = 64)`, `key_digest TEXT NOT NULL REFERENCES project_keys (digest)`, `client_name TEXT NOT NULL`, `created_at INTEGER NOT NULL`, `expires_at INTEGER NOT NULL`; `STRICT` |

`directory.ts`, each function one named object with `directory: D1Database`:

| Function | Does |
|---|---|
| `findKeyProject({ directory, digest })` | now returns `{ projectId, timeZone }` of the unrevoked key, joined through its project's workspace to the owner, else `null` |
| `insertProjectKey({ directory, digest, projectId, now })` | inserts the key row with `revoked_at` null |
| `insertMcpSession({ directory, digest, keyDigest, clientName, now, expiresAt })` | inserts the session row |
| `findMcpSessionClient({ directory, digest, keyDigest, now })` | the `client_name` of the session with that digest, that key and `expires_at > now`, else `null` |

### Routing

`openKeyProject({ env, secret })` returns `KeyProject | null`, where `KeyProject = { project: DurableObjectStub<ProjectStore>; keyDigest: string; timeZone: string }`. Everything else in `project-routing.ts` is unchanged, and it stays the only module that opens a stub.

### Credentials

- `credential-secret.ts`: `generateCredentialSecret()` → 32 bytes from `crypto.getRandomValues`, base64url without padding (43 characters).
- `project-keys.ts`: `issueProjectKey({ directory, projectId, now })` → `Promise<string>`, the secret `todz_` + `generateCredentialSecret()`, after inserting its digest. A project id that does not exist fails the foreign key and rejects.
- A session id is `generateCredentialSecret()`, stored as its digest, with `expiresAt = now + MCP_SESSION_LIFETIME_MS` (30 days).

`PROJECT_KEY_PREFIX` (`'todz_'`) lives in `libs/types`, because the app shows and recognises keys; `MCP_SESSION_LIFETIME_MS` sits at the top of the module that issues sessions.

### Today

`owner-today.ts`: `calendarDateInTimeZone({ timeZone, now })` → the `YYYY-MM-DD` of `now` in `timeZone` through `Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' })`. An invalid zone throws the runtime's `RangeError`: the directory only ever holds zones `owner-api` validated, so it is a bug, not an input.

### The server

A fresh `McpServer` per request, named `todz`, with `instructions` from the copy, built from `{ project, today, clientNameOf }` where `clientNameOf(ctx)` returns the envelope's `io.modelcontextprotocol/clientInfo` name on the modern leg (throwing when the SDK let a modern request through without it) and the session's name on the legacy leg. Writes send `{ kind: ActorKind.Agent, clientName }` to the Durable Object, which validates it (an invalid name → the `client_name_invalid` tool error). No tool takes a project or workspace id, and no answer names a project, a workspace or a count beyond this project.

| Tool | Input (zod) | Calls | Answer |
|---|---|---|---|
| `next` | none | `nextTask({ today })` | the task block, or `No open tasks.` |
| `add` | `tasks`: array of `{ title: string, notes?: string, due_date?: string, idempotency_key?: string }` | `addTasks` | one line per task: `Added <line>` or, for a replay, `Already added <line>` |
| `list` | `state?: 'open' \| 'done'` (default `open`), `due?: ('overdue' \| 'today' \| 'upcoming' \| 'undated')[]` (default all), `text?: string`, `limit?: integer` (default 20) | `listTasks({ today, filter })` | `<State> tasks: <shown> of <matched>` then one line per task |
| `update` | `id: string`, `title?: string`, `notes?: string \| null`, `due_date?: string \| null`, `placement?: { kind: 'first' } \| { kind: 'last' } \| { kind: 'before' \| 'after', anchor: string }` | `updateTask` | `Updated <line>` |
| `done` | `ids: string[]`, `note?: string` | `completeTasks` | one line per task: `Done <line>` or `Already done <line>` |

- The defaults are declared in the zod schema, so the agent sees them in the tool's JSON Schema. A field left out of `update` is left out of the patch; `null` clears notes or the due date.
- Ids are short ids (`T-12`, any case) parsed with `parseShortId`; the first one that does not parse is a tool error, `"<input>" is not a task id like T-12.`, and nothing is called.
- `next` and `list` carry `readOnlyHint: true`; `add`, `update` and `done` carry `destructiveHint: false`.
- The array sizes, text lengths and dates are validated by the core, so its rule issues are the only limits and the messages agree with the app's.

**Prompt `next`**, no arguments: one user message. With a task: `Work on this task from todz.`, a blank line, the task block, a blank line, `When it is finished, call the todz done tool with id <T-n> and a note of what was done.` With none: `There is nothing to do in todz right now: no open tasks.`

### Compact text

`mcp-format.ts`, pure functions:

- Task line: `<T-n> <title>`, plus ` · due <YYYY-MM-DD>` when it has a due date.
- Task block: the task line, then a blank line and the notes when it has notes.
- List header: `Open tasks: <shown> of <matched>` or `Done tasks: <shown> of <matched>`; zero matches still prints the header with `0 of 0`.
- Lines are joined with `\n`; every answer is one `text` content item, never JSON.

### Errors

Every expected failure is a tool result with `isError: true` and one text line from `mcp-copy.ts`:

| Failure | Text |
|---|---|
| `TaskNotFound` | `<T-n> not found.`, the same for another project's task as for a number never issued |
| `RuleViolated`, `index` null | the issue's sentence, e.g. `The title is empty.` |
| `RuleViolated`, `index` set | `Task <index + 1>: <the issue's sentence>` |
| an id that does not parse | `"<input>" is not a task id like T-12.` |

`mcp-copy.ts` holds a `Record<RuleIssue, string>`, so a new issue fails the typecheck until it has a sentence. Arguments that break the zod schema get the SDK's own invalid-params answer. Anything else (a thrown RPC, a bad zone) is not caught: the SDK turns it into an internal error, and nothing is logged.

### Failure handling

- A refused credential never reaches a Durable Object or the session table.
- A write that fails rolls back inside the Durable Object (ADR 0015); the tool error is the only effect.
- Logs: no module under `apps/api/src` calls `console`; the SDK gets no `onerror` that logs.

## Open questions → answers

| Question | Options | Owner's answer | Date |
|----------|---------|----------------|------|
| Which MCP implementation, which eras? | SDK v2, both eras / SDK v1 / `agents` / by hand | Loop's call: SDK v2, both eras ([ADR 0016](../../adr/0016-the-mcp-server-runs-on-the-sdk-v2-and-serves-both-protocol-eras.md)); listed for the owner | 2026-11-23 |
| How is a 2025-era client named after `initialize`? | directory session / Durable Object session / name per key / refuse the era / signed id | Loop's call: directory session bound to the key ([ADR 0017](../../adr/0017-a-2025-era-client-is-named-by-a-session-in-the-directory.md)); listed for the owner | 2026-11-23 |
| Where does the MCP server's today come from? | owner's zone / `today` argument / zone per key / UTC | Loop's call: the owner's zone ([ADR 0018](../../adr/0018-the-mcp-server-reads-today-in-the-owner-s-time-zone.md)); listed for the owner | 2026-11-23 |
| What does a key look like? | `todz_` + base64url / hex / UUID | Loop's call: `todz_` + base64url ([ADR 0019](../../adr/0019-mcp-keys-are-prefixed-and-shown-once.md)); listed for the owner | 2026-11-23 |

## Rollback

Nothing is deployed and no production data exists: reverting the merge commit removes the endpoint, the sessions table and the time zone column. A local `.wrangler` directory is deleted once after either direction (ADR 0018).

## Test strategy summary

Vitest inside workerd (ADR 0012). Unit: the compact text, the copy record, today in a zone, the credential secret, key issuance, the new directory reads. HTTP: every row of the HTTP surface table through `exports.default.fetch`. End to end: the real `@modelcontextprotocol/client` connected through the Worker's `fetch`, once with `versionNegotiation` `legacy` and once pinned to `2026-07-28`, calling each tool and the prompt, checking the actor in the task's history, and the isolation suite repeated through MCP. The tester also runs `wrangler dev` and drives it with the same client from Node. No browser surface, so no Playwright.
