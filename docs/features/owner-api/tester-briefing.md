# Tester briefing: Owner API

Written by the developer sub-agent when its steps are done. The developer does not run `test-plan.md` and does not declare the feature works.

## What changed

Lane G1, the project store (`apps/api/src`):

- `project-schema.ts`, `sqlite-task-store.ts` — project schema version 2: a change number per task and a change counter; the upgrade runs in one transaction.
- `project-store.ts` — `readChanges`, `readHistory`, `fetch` (socket upgrade, 426 otherwise) and the `changed` broadcast after a write that moved the counter.
- `project-result.ts`, `mcp-format.ts` — `ProjectFailureKind.CursorAhead`; `mcp-format.ts` gained one line that throws for it.
- `project-keys.ts`, `project-routing.ts` — keys carry an id and a hint; `findOwnedProjectId` and `findOwnedWorkspaceId` look up ownership without opening a Durable Object.
- `time-zone.ts`, `sign-in-provider.ts`, `bearer-secret.ts`, migrations — the canonical time zone, the fake sign-in provider, the shared bearer parsing and the directory columns.
- `owner-json.ts`, `owner-routes.ts` — the JSON shapes and the route table.

Lane G2, sign-in, workspaces, projects and keys:

- `owner-endpoint.ts`, `owner-request.ts`, `owner-errors.ts`, `owner-sign-in.ts`, `owner-account.ts`, `owner-sessions.ts` — routing, sessions, sign-in, read and update of the owner.
- `owner-workspaces.ts`, `owner-keys.ts` — workspace, project and key routes.
- Extra files: `http-status.ts`, `owner-records.ts`, `directory-owners.ts`, `directory-workspaces.ts`, `directory-keys.ts`, `owner-sign-in.ts`, `owner-account.ts`.
- `signInKindOf` replaced `signInProviderOf`.

Lane G3, tasks, feed and socket:

- `owner-tasks.ts` — the record of task route handlers.
- `owner-task-writes.ts` — add, update, complete, reopen and history.
- `owner-changes.ts` — the change feed and the socket.
- `owner-project.ts` — opens the project a session owns, or answers nothing.
- `owner-errors.ts` — `cursor_ahead` answers 409.
- `owner-request.ts` — the unbuilt handler is gone: every route has one.
- Tests: `owner-tasks.test.ts`, `owner-changes.test.ts`, `owner-isolation.test.ts`; `owner-client.ts` gained `createOwnedProject`, `issueMcpKey` and `projectCall`.
- `apps/api/README.md` states the owner API's purpose.

## How to run

```bash
pnpm --filter @todz/api test:unit
pnpm --filter @todz/api typecheck
pnpm --filter @todz/api dev
```

`dev` runs `wrangler dev --var SIGN_IN_PROVIDER:fake`. Delete a local `.wrangler` directory once first: `0001_directory.sql` changed and project stores may hold version 2.

## Red today, green after

Each red run printed the text below against the unbuilt code; the green commit followed.

| Test | Red before the change because | Green after because |
|------|--------------------------------|---------------------|
| G1 `project-schema.test.ts` | `AssertionError: expected 1 to be 2`; `no such table: change_counter`; `no such column: change_number`; unique index missing; half-applied upgrade left a trace | the upgrade runs in one transaction |
| G1 `sqlite-task-store.test.ts` | `Error: lastChangeNumber is not implemented`; `Error: listChangesSince is not implemented` (cursors 0 and 1 with limit 10) | the adapter stamps and reads change numbers |
| G1 `project-keys.test.ts`, `project-routing.test.ts` | `AssertionError: expected '' to match /^[0-9a-f]{8}-...`; `expected '' not to be ''`; `Error: findOwnedProjectId is not implemented`; `Error: findOwnedWorkspaceId is not implemented` | keys get an id and hint; lookups answer an id or null |
| G1 `project-changes.test.ts` (changes, history) | `Error: expected an ok result, got {"kind":"task_not_found","number":0}` (and 3, and 1); `AssertionError: expected { ok: false, ... } to deeply equal { ok: false, ... }`; the missing history number passes against the stub (pin) | `readChanges` and `readHistory` answer |
| G1 `project-changes.test.ts` (socket) | `AssertionError: expected 501 to be 426`; `expected 501 to be 101`; `Error: the project did not accept the socket` (7 broadcast tests) | `fetch` accepts the upgrade and writes broadcast |
| G1 `sign-in-provider.test.ts`, `time-zone.test.ts` | `Error: canonicalTimeZone is not implemented`; `Error: the fake sign-in provider is not implemented`; `Error: signInProviderOf is not implemented` (37 failures) | the canonicaliser and the fake exist |
| G1 `owner-json.test.ts`, `owner-routes.test.ts` | `Error: ownerJson / projectJson / workspaceJson / keyJson / actorJson / taskJson / historyEntryJson is not implemented`; `Error: matchOwnerRoute is not implemented` (61 failures, 1 pass) | the shapes and the matcher exist |
| G2 `owner-sign-in.test.ts` | `Error: serveOwner is not implemented` (49 of 51 failures); one `AssertionError: expected [Function] to throw error including 'the directory is unavailable' but got 'serveOwner is not implemented'` | `serveOwner` matches routes and runs sign-in |
| G2 `owner-workspaces.test.ts` | 31 failures, 5 passes (the 401 cases): 16x `Error: create workspace answered 404`; 4x `expected 404 to be 400`; 2x `expected 404 to be 201`; 1x `expected 404 to be 200`; 1x `expected 404 to be 422`; 1x `SyntaxError: Unexpected end of JSON input` | the workspace routes answer |
| G2 `owner-keys.test.ts` | 13 failures, 3 passes (the 401 cases): 8x `Error: issue key answered 404`; 3x `SyntaxError: Unexpected end of JSON input`; 1x `expected 404 to be 201`; 1x `expected 404 to be 200` | the key routes answer |
| G3 `owner-tasks.test.ts` | 35 failures: `AssertionError: expected 404 to be 201 // Object.is equality`; `SyntaxError: Unexpected end of JSON input` (the unbuilt handler answers 404 with an empty body) | the five task handlers answer through the project store |
| G3 `owner-changes.test.ts` | 19 failures, 2 passes (the 401 cases): `expected 404 to be 200`; `expected 404 to be 400`; `expected 404 to be 409`; `expected 404 to be 101`; `expected 404 to be 426`; `Error: the socket answered 404` | the feed and the socket handlers answer |
| G3 `owner-isolation.test.ts` | pin: green on landing | — |
| G3 `owner-changes.test.ts` paging | pin: green on landing | — |

Also pins from G1: the directory schema and the sign-in provider guard (`2bab72f`), the change numbers stamped on tasks, the schema upgrade, the change feed and history of a project.

## Hypotheses to attack

Every "it works" is a hypothesis the tester tries to break.

1. Hypothesis: another owner's session gets the same answer for every project, workspace and key route as for an id that never existed. Break it by: diffing status, body and headers, including the 426 route without the upgrade header, and by timing a foreign id against a never-issued one.
2. Hypothesis: a refused credential never opens a Durable Object. Break it by: watching `wrangler dev` for a Durable Object start after a call with no, blank or expired session.
3. Hypothesis: a patch copies a key into the task patch only when the body has it. Break it by: sending `{"title":"x","notes":null}`, `{"notes":null,"due_date":null}`, `{}` and keys with the value `undefined` spelled in strings.
4. Hypothesis: `cursor` accepts `0` or digits with no leading zero up to a safe integer, nothing else. Break it by: `+1`, `1e3`, `0x10`, `1 `, `%31`, a repeated `cursor` parameter, a very long digit string.
5. Hypothesis: an open socket receives `changed` once per write that moved the project's change counter, from an owner or an agent, and nothing for a refused or replayed write. Break it by: replaying an idempotency key, completing a done task, many sockets on one project, a socket closed mid-write.
6. Hypothesis: `WatchChanges` without `Upgrade: websocket` answers 426 with an empty body and the header, after ownership. Break it by: `Upgrade: WebSocket`, `Upgrade: h2c`, a `Connection` header alone.
7. Hypothesis: a task number outside `1` to `999999999` never reaches a handler. Break it by: `0`, `01`, `1000000000`, `1.5`, `-1` on the update and history routes.
8. Hypothesis: history names the actor, and an agent's task shows the agent's client name through the owner route. Break it by: an agent that connects with an odd client name, then reading the history as the owner.
9. Hypothesis: a session token is not an MCP key and an MCP key is not a session token. Break it by: each in the other's `Authorization` header, with and without the `todz_` prefix.

## Known gaps

- The "nothing sent" socket checks settle by message count plus one RPC; a stray late message could go unseen.
- G1 added one line to `mcp-format.ts` that throws for `CursorAhead`; the MCP tools never read changes.
- `Asia/Kolkata` canonicalises to `Asia/Calcutta` on this runtime; that name is stored.
- Names collapse a line break to a space, so a name is never refused for one.
- `WatchChanges` forwards the request to the project and takes its 426 and 101 answers as they come; the Worker itself does not read the `Upgrade` header.
- No test sends an update with an explicit `placement` plus other fields in one body.

## Fix round 1

What changed:

- `apps/api/package.json` — `dev` applies the directory migrations locally before `wrangler dev`; a pin in `tools/repository-shape/src/api-source.test.ts`. Checked by hand against a fresh `--persist-to` directory: the apply runs without a prompt and lists 0001 to 0003 as applied.
- `owner-changes.ts` — a repeated `cursor` query answers 400 `invalid_request`.
- `owner-task-writes.ts` — `numbers` and `placement.anchor` must be positive integers, else 400 `invalid_request`.
- `directory-workspaces.ts`, `owner-workspaces.ts` — every workspace and project write carries the owner and answers whether a row changed; none changed answers 404 `not_found`. `findOwnedWorkspace` moved here from `directory.ts`; renaming a workspace reads only that workspace and its projects (`findOwnerWorkspace`).
- Refactors with no behaviour change: `task-field-patch.ts` (`fieldPatchOf`, shared by the MCP update tool and the owner update route), `FORMATTER_LOCALE` in `libs/types`, `HttpStatus` gains 101 and 405, `LAST_INDEX` in the change page, the concurrent first sign-in test renamed a smoke test.

Red texts:

| Test | Red before the change because | Green after because |
|------|--------------------------------|---------------------|
| `api-source.test.ts` dev script | `AssertionError: expected -1 to be greater than or equal to 0` | the script names the migrations command before `wrangler dev` |
| `owner-changes.test.ts` repeated cursors | `expected 409 to be 400` (`cursor=1&cursor=2`); `expected 200 to be 400` (`cursor=0&cursor=abc`) | `getAll` must hold exactly one value |
| `owner-tasks.test.ts` numbers and anchors | `expected 422 to be 400`, nine times (fractional, zero and negative numbers and anchors) | the schemas are positive integers |
| `directory-workspaces.test.ts` | `expected true to be false` (4x); `D1_ERROR: FOREIGN KEY constraint failed`; `findOwnerWorkspace is not implemented` (2x) | the writes check the owner and count changed rows |

Hypotheses to attack:

1. Hypothesis: `pnpm --filter @todz/api dev` works on a fresh checkout with no local state. Break it by: deleting `.wrangler`, running it, signing in with the fake provider, creating a workspace and adding a task; then running it a second time (the apply must be a no-op).
2. Hypothesis: a repeated `cursor` is always 400. Break it by: `cursor=0&cursor=0`, `cursor=0&Cursor=1`, `cursor=0&cursor=`.
3. Hypothesis: a task number or anchor that is not a positive integer never reaches the core. Break it by: `1e0`, `1.0`, `9007199254740993`, `true`, `null`, a string.
4. Hypothesis: no directory write changes another owner's workspace or project. Break it by: racing a rename with a session of another owner on the same ids; renaming a project of one's own workspace by an id of another's.

Known gaps:

- `insertWorkspaceWithInbox` still trusts the ids it is handed; the workspace row carries the owner and the Inbox row carries the new workspace id.
- `findProject` reads by id after ownership was proven; it carries no owner of its own.
