# Test plan: Owner API

Every checkbox states the input and the exact expected outcome. A ticked box carries evidence after ` — evidence: ` (commit hash, log path, counts, screenshot path).

Run: `pnpm --filter @todz/api test:unit` (Vitest inside workerd, ADR 0012). Requests go through `exports.default.fetch` at `https://api.todz.test`. "Owner A" and "owner B" are two fresh owners signed in with the fake provider and random subjects.

## The failing test first

- [ ] Each step of `plan.md` groups G1 to G3 has a red commit before its green commit, visible in `git log --oneline origin/main..HEAD`; pins say `pin` in the message.
- [ ] Each red run failed on its named assertion or on a stub's `<name> is not implemented`, recorded in `tester-briefing.md` with the text printed, not a module resolution or syntax error.

## Unit

### Time zone and provider

- [ ] `canonicalTimeZone('America/Sao_Paulo')` → `'America/Sao_Paulo'`; `('america/sao_paulo')` → `'America/Sao_Paulo'`; `('UTC')` → `'UTC'`.
- [ ] `canonicalTimeZone` → `null` for `'Nope/Zone'`, `''`, `'+01:00'`, `'-03:00'`, and a 65-character string of letters.
- [ ] The fake provider: `verify('alice.dev_1-x')` → `'alice.dev_1-x'`; a 64-character token → itself; `''`, a 65-character token, `'a b'`, `'a/b'`, `'é'` → `null`.

### Project store (G1)

- [ ] A new store reads `schema_version` 2 and `tasks` has a `change_number` column; a store created at version 1 with tasks 1 and 2 is upgraded to 2, keeps both with change numbers 1 and 2, `lastChangeNumber()` 2, and `readChanges({ cursor: 0 })` returns both; a third task then gets change number 3.
- [ ] Two task rows given one change number → the unique index refuses the second write.
- [ ] `lastChangeNumber()` is `null` on a new store; adding two tasks gives change numbers 1 and 2; updating the first gives it 3; `lastChangeNumber()` is 3.
- [ ] `readChanges({ cursor: 0 })` on three tasks → the three in change order, `cursor` equal to the last one's change number, `hasMore` false.
- [ ] 101 tasks, cursor 0 → 100 tasks, `hasMore` true; the returned cursor → 1 task, `hasMore` false; that cursor → `[]`, the same cursor, `hasMore` false.
- [ ] A task updated twice after the cursor appears once, in its latest state.
- [ ] `readChanges({ cursor: 4 })` on a store whose last change number is 3 → `CursorAhead`; on a new store, `cursor: 1` → `CursorAhead`, `cursor: 0` → `[]`, cursor 0.
- [ ] A failing write (an empty title) and an idempotent replay leave `lastChangeNumber()` unchanged.
- [ ] `readHistory({ number })` on a created then completed task → two entries, `created` then `completed`; a number never issued → `TaskNotFound` with that number.
- [ ] `fetch` with `Upgrade: websocket` → 101 with a socket; without → 426.
- [ ] One open socket: an `addTasks` → the socket receives exactly `changed`; a failed write then a successful one → exactly one `changed` before the sentinel.
- [ ] Two sockets on one project both receive `changed`; a socket on another project receives nothing (checked with a sentinel write on the other project).

### JSON and routes (G2)

- [ ] `taskJson` of an owner task → `created_by` `{ kind: 'owner', client_name: null }`, `due_date` `null` when absent, every field of the spec's task shape and no other.
- [ ] `taskJson` of an agent task → `created_by` `{ kind: 'agent', client_name: 'Claude Code' }`; `historyEntryJson` carries `fields` as the `TaskField` values.
- [ ] Route matching: `PATCH /owner/projects/p/tasks/12` → `UpdateTask` with `{ projectId: 'p', number: '12' }`; `.../tasks/0`, `.../tasks/012`, `.../tasks/1234567890`, `.../tasks/-1` → no match; `POST .../tasks/complete` → `CompleteTasks`, not `UpdateTask`.
- [ ] `GET /owner/nothing`, `PUT /owner` and `GET /ownerx` → 404, empty body.
- [ ] `api-source.test.ts`: `apps/api/wrangler.jsonc` does not contain `SIGN_IN_PROVIDER`.

## HTTP

### Sign-in and owner

- [ ] `POST /owner/sessions { identity_token: <random>, time_zone: 'America/Sao_Paulo' }` → 201, `session_token` of 43 base64url characters, `owner.time_zone` `'America/Sao_Paulo'`; `GET /owner` with that token → 200, the same owner.
- [ ] The same identity token again with `time_zone: 'UTC'` → 201, the same `owner.id`, a different `session_token`, and the owner's zone is now `UTC`.
- [ ] `time_zone: 'Nope/Zone'` → 422 `{ error: 'time_zone_invalid' }`, no owner row created for a new subject.
- [ ] `identity_token: 'a b'` → 401 `{ error: 'identity_rejected' }`.
- [ ] Body not JSON, `identity_token` missing, `time_zone` a number → 400 `{ error: 'invalid_request' }`.
- [ ] Without `SIGN_IN_PROVIDER` in the environment, and with it set to `apple` → 503 `{ error: 'sign_in_unavailable' }`, no owner row created.
- [ ] Check order: no provider and a non-JSON body → 503; a non-JSON body and a refused identity → 400; a refused identity and a bad zone → 401 `identity_rejected`.
- [ ] Two concurrent first sign-ins with one new identity token → both 201, one `owner.id`, one `owner_identities` row.
- [ ] The 21st sign-in of one owner, all 21 at the same `now` → the first session's token answers 401 on `GET /owner`, the 2nd to 21st answer 200.
- [ ] A session at its expiry instant (`expires_at` equal to now) → 401; the stored `expires_at` is sign-in time plus 90 days.
- [ ] `GET /owner` with no `Authorization`, `Basic x`, `Bearer ` with a blank secret, an unknown token → 401, empty body, `WWW-Authenticate: Bearer`.
- [ ] `DELETE /owner/sessions/current` → 204; the same token then → 401 on `GET /owner`; another session of the owner still → 200.
- [ ] Signed in with `Pacific/Kiritimati` (UTC+14), a task due on Kiritimati's today: an MCP `list` with `due: ['today']` lists it; `PATCH /owner { time_zone: 'Pacific/Pago_Pago' }` (UTC−11) → 200 with the new zone, and the same `list` no longer does (the two zones' dates always differ); `{ time_zone: '+01:00' }` → 422 `time_zone_invalid`, zone unchanged.

### Workspaces and projects

- [ ] A new owner: `GET /owner/workspaces` → `{ workspaces: [] }`.
- [ ] `POST /owner/workspaces { name: '  Logic Bit ' }` → 201, `name` `'Logic Bit'`, `projects` is one project named `Inbox` with `is_inbox` true.
- [ ] Two workspaces, one with a second project → `GET /owner/workspaces` lists both oldest first, each with its projects oldest first, the Inbox first.
- [ ] `name: ''` → 422 `rule_violated`, `issue` `name_empty`, `index` null; an 81-character name → `name_too_long`; nothing created.
- [ ] `PATCH /owner/workspaces/<id> { name: 'Pessoal' }` → 200 with the new name; an unknown id → 404 `not_found`.
- [ ] `POST /owner/workspaces/<id>/projects { name: 'api' }` → 201, `is_inbox` false; an unknown workspace id → 404 `not_found`.
- [ ] `PATCH /owner/projects/<id> { name: 'web' }` → 200; on the Inbox → 409 `inbox_is_fixed`, name unchanged; a regular project renamed `Inbox` → 200, `is_inbox` still false.

### Tasks

- [ ] `POST /owner/projects/<id>/tasks { tasks: [{ title: 'Ship it' }] }` → 201, one task `number` 1, `replayed` false, `created_by.kind` `owner`, `notes` null, `due_date` null.
- [ ] The same body with `idempotency_key: 'k1'` twice → the second answers `replayed` true with the same number.
- [ ] `tasks: []` → 422 `batch_empty`; 51 tasks → `batch_too_large`; the second task's title empty → 422 `title_empty`, `index` 1, nothing added.
- [ ] `PATCH .../tasks/1 { notes: '# hi', due_date: '2026-12-01' }` → 200 with both; then `{ title: 'Renamed' }` → title changed, notes and due date kept; `{ notes: null }` → notes cleared, due date kept; `{}` → 422 `nothing_to_update`.
- [ ] `PATCH .../tasks/1 { placement: { kind: 'after', anchor: 2 } }` on three tasks → task 1's `order_key` sorts between tasks 2 and 3; `anchor` 1 (itself) → 422 `placement_anchor_invalid`.
- [ ] `PATCH .../tasks/99` on a project with one task → 404 `{ error: 'task_not_found', number: 99 }`.
- [ ] `POST .../tasks/complete { numbers: [1, 2], note: 'done in PR' }` → 200, both `state` `done`, `already_done` false; again → `already_done` true.
- [ ] `POST .../tasks/reopen { numbers: [1] }` → 200, `state` `open`, `already_open` false.
- [ ] `GET .../tasks/1/history` → entries `created`, `updated`, `completed`, `reopened` in order, each `actor` `{ kind: 'owner', client_name: null }`, the completion carrying the note; `GET .../tasks/99/history` → 404 `task_not_found`.
- [ ] A task added through MCP by `Claude Code` → its history entry's actor is `{ kind: 'agent', client_name: 'Claude Code' }` through the owner route.

### Changes and socket

- [ ] `GET .../changes?cursor=0` on an empty project → `{ tasks: [], cursor: 0, has_more: false }`.
- [ ] Two tasks added, cursor 0 → both, `cursor` 2; a third added by MCP, cursor 2 → only the third, `cursor` 3.
- [ ] `cursor` missing, `-1`, `1.5`, `abc`, `01`, `9007199254740992` → 400 `invalid_request`.
- [ ] `cursor` 9 on a project whose last change number is 3 → 409 `{ error: 'cursor_ahead' }`.
- [ ] `GET .../socket` with `Upgrade: websocket` and a live session → 101; without the header → 426; without a session → 401 and no Durable Object opened (counting namespace).
- [ ] An open socket receives `changed` after an owner `AddTasks`, after an MCP `add`, and after an MCP `done`; nothing after a 422.

### Keys

- [ ] `POST .../keys` → 201 `{ key: { id, hint, created_at }, secret }`, `secret` starts with `todz_`, `hint` equals its last four characters; that secret opens `/mcp` (an MCP `next` answers).
- [ ] `GET .../keys` → that key without any `secret` field; two keys → oldest first.
- [ ] `DELETE .../keys/<id>` → 204; the key no longer listed; its secret → 401 on `/mcp`; its `mcp_sessions` rows are gone; again → 404 `not_found`.

## Isolation

Owner B attacks owner A's workspace and project. Each answer is compared, status and body byte for byte, with the same request on an id that was never issued.

- [ ] `RenameWorkspace` and `CreateProject` on A's workspace → 404 `not_found`, identical to an unknown id; A's workspace unchanged.
- [ ] `RenameProject`, `AddTasks`, `UpdateTask`, `CompleteTasks`, `ReopenTasks`, `ReadHistory`, `ReadChanges` on A's project → 404 `not_found`, identical; no Durable Object opened (counting namespace); A's tasks unchanged.
- [ ] `RenameProject` on A's Inbox → 404 `not_found`, identical to an unknown id, never 409; `ReadChanges` with a cursor far ahead on A's project → 404, never 409.
- [ ] `WatchChanges` on A's project → 404 `not_found`, identical, no socket, no Durable Object opened (counting namespace).
- [ ] `ListKeys`, `IssueKey` on A's project and `RevokeKey` of A's key id → 404 `not_found`, identical; A's key still opens `/mcp`.
- [ ] `RevokeKey` with A's key id under B's own project → 404 `not_found`; A's key still listed for A.
- [ ] `GET /owner/workspaces` as B lists none of A's workspaces or projects.
- [ ] An MCP key of A's project used as a session on `/owner` → 401; a session token used as a key on `/mcp` → 401.

## Prove it for real — `wrangler dev`

- [ ] `pnpm --filter @todz/api dev` boots; `curl` signs in with the fake provider, creates a workspace, adds a task, reads the feed, issues a key; an MCP client from Node lists that task with the key; output in the tester's log.
- [ ] A WebSocket client from Node on `/owner/projects/<id>/socket` receives `changed` when `curl` adds a task.
- [ ] `wrangler dev` without `--var SIGN_IN_PROVIDER:fake` answers sign-in with 503.
- [ ] `grep` of `wrangler.jsonc` finds no `SIGN_IN_PROVIDER`.
- [ ] The `wrangler dev` output carries no task title, note, name or token after the walk.

## Edge cases found during execution

Empty on purpose. The tester adds one checkbox per new case (input, exact expected outcome) and a regression test for each.

## Adversarial review

The reviewer picks the three claims most likely to be wrong and tries to refute each.

- [ ] Claim 1: <claim> — attack: <how>; result: <refuted | held>
- [ ] Claim 2: <claim> — attack: <how>; result: <refuted | held>
- [ ] Claim 3: <claim> — attack: <how>; result: <refuted | held>

## Coverage honesty

What is not tested and why.

- The Apple verifier — not built in v1 (ADR 0020).
- Socket behaviour across a real Durable Object hibernation and wake — the pool runs the object in one process; the hibernation API is used as documented, and the tester's `wrangler dev` walk is the closest proof.
- Load: many sockets per project, large first pulls — no budget is set for v1.
