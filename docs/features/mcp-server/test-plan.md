# Test plan: MCP server

Every checkbox states the input and the exact expected outcome. A ticked box carries evidence after ` — evidence: ` (commit hash, log path, counts, screenshot path).

Fixtures: every test creates its own owner, workspace, project and key with fresh random ids, because storage persists across the tests of one file (ADR 0012). "Legacy client" is `new Client({ name: 'Claude Code', version: '1.0.0' })` with the default `versionNegotiation` (`legacy`); "modern client" is `new Client({ name: 'Codex', version: '1.0.0' }, { versionNegotiation: { mode: { pin: '2026-07-28' } } })`. Both use `StreamableHTTPClientTransport` on `https://api.todz.test/mcp` with `Authorization: Bearer <key>` and the Worker's `fetch`.

## The failing test first

- [ ] Steps 2 to 7 each have a test commit that precedes its implementation commit in `git log`, and the red run of each fails on a named assertion or on `<name> is not implemented`, recorded in `tester-briefing.md` — evidence:
- [ ] Spot check in a throwaway worktree: check out the red commits of steps 3 and 6, run their tests; expected: the failure text the briefing records — evidence:
- [ ] Steps 1 and 8 land as pins and their commits say `pin` — evidence:

## Unit (inside workerd)

### Credentials and keys

- [ ] `generateCredentialSecret()` → matches `^[A-Za-z0-9_-]{43}$`; 100 calls give 100 distinct values — evidence:
- [ ] `issueProjectKey` for a seeded project → matches `^todz_[A-Za-z0-9_-]{43}$`; `project_keys` holds one row for that project whose `digest` is `digestCredential(secret)`, `revoked_at` null; no column of any directory row equals the secret — evidence:
- [ ] Two `issueProjectKey` calls for one project → two different secrets, two rows, both resolve through `openKeyProject` to that project — evidence:
- [ ] `issueProjectKey` for a project id that does not exist → rejects; `project_keys` unchanged — evidence:

### Directory and routing

- [ ] `findKeyProject` for a live key of an owner in `America/Sao_Paulo` → `{ projectId, timeZone: 'America/Sao_Paulo' }`; for a revoked key or an unknown digest → `null` — evidence:
- [ ] `openKeyProject` → `{ project, keyDigest, timeZone }` with `keyDigest` equal to `digestCredential(secret)`; the existing refusals (blank, non-string, unknown, revoked) still answer `null` without addressing a Durable Object — evidence:
- [ ] `findMcpSessionClient`: a stored session → its client name; with another key's digest → `null`; at `now` equal to `expires_at` → `null`; at `expires_at - 1` → the name; an unknown digest → `null` — evidence:
- [ ] `0001_directory.sql` refuses an owner with `time_zone` `''` or missing (constraint error) — evidence:
- [ ] `mcp_sessions` refuses a `key_digest` with no key row, and a digest whose length is not 64 — evidence:
- [ ] The directory lists exactly six tables, `mcp_sessions` included, and still has no task column — evidence:

### Today

- [ ] `calendarDateInTimeZone` at `2026-11-24T01:30:00Z`: `America/Sao_Paulo` → `2026-11-23`; `UTC` → `2026-11-24`; `Pacific/Kiritimati` → `2026-11-24`; at `2026-12-31T23:30:00Z` in `Asia/Tokyo` → `2027-01-01` — evidence:
- [ ] `calendarDateInTimeZone` with `Not/A_Zone` → throws `RangeError` — evidence:

### Compact text

- [ ] Task line: `T-3` titled `Ship it` without a due date → `T-3 Ship it`; with `2026-11-24` → `T-3 Ship it · due 2026-11-24` — evidence:
- [ ] Task block: with notes `Line one\nLine two` → the line, a blank line, the notes verbatim; with `notes: null` → the line only — evidence:
- [ ] List: 2 shown of 5 open → first line `Open tasks: 2 of 5`, then two task lines; 0 done → exactly `Done tasks: 0 of 0` — evidence:
- [ ] Every `RuleIssue` value has a non-empty sentence in the copy record (iterate the enum) — evidence:
- [ ] Rule error with `index` 1 and `TitleEmpty` → `Task 2: ` followed by the title-empty sentence; with `index` null → the sentence alone; `TaskNotFound` 99 → `T-99 not found.` — evidence:
- [ ] No answer contains `{` from a JSON dump: each formatted answer for a task with notes `plain` has no `{` or `"number"` — evidence:

## HTTP surface (`exports.default.fetch`)

- [ ] `GET /` and `POST /other` → 404, empty body — evidence:
- [ ] `POST /mcp` with no `Authorization`, with `Basic abc`, with `Bearer ` and spaces, with an unknown `todz_` key, with a revoked key → each 401, `WWW-Authenticate: Bearer`, empty body; a counting namespace records no Durable Object addressed — evidence:
- [ ] Legacy `initialize` with a valid key and client name `Claude Code` → 200, an `Mcp-Session-Id` header of 43 base64url characters, one `mcp_sessions` row whose digest is the header's digest, whose `key_digest` is the key's, `client_name` `Claude Code`, `expires_at - created_at` equal to 30 days — evidence:
- [ ] Legacy `initialize` with client name `"  "`, with a name of 65 characters, with a name containing a line feed → 400, JSON-RPC error `-32602` with the `client_name_invalid` sentence and the request's `id`; no session row added — evidence:
- [ ] Legacy `tools/list` with no `Mcp-Session-Id` → 400, error `-32000`, `Bad Request: Mcp-Session-Id header is required` — evidence:
- [ ] Legacy `tools/list` with a random session id, with an expired session (row inserted with `expires_at` in the past), with a live session issued to another key of the same project → each 404, error `-32001`, `Session not found` — evidence:
- [ ] A session issued to key A of project A, sent with key B of project B → 404 `Session not found`, and nothing of project A answers — evidence:
- [ ] A legacy session, then its key revoked → the next call answers 401 — evidence:
- [ ] Legacy `GET /mcp` with a live session → 405 — evidence:
- [ ] A legacy `POST` whose body is not JSON → not treated as `initialize`: answered by the session check (400 without a session header) — evidence:

## End to end with the real client, both eras

Each box runs once with the legacy client and once with the modern client unless it says otherwise.

- [ ] `listTools` → exactly `add`, `done`, `list`, `next`, `update`; no input schema has a property whose name contains `project` or `workspace`; `next` and `list` have `readOnlyHint: true` — evidence:
- [ ] `listPrompts` → exactly `next`, with no arguments — evidence:
- [ ] `next` on an empty project → `No open tasks.`, `isError` not set — evidence:
- [ ] `add` with three tasks (one with notes and `due_date` today in the owner's zone, one with an `idempotency_key` `k-1`, one bare) → three lines `Added T-1 …`, `Added T-2 …`, `Added T-3 …`; the same `add` of `k-1` again → `Already added T-2 …` and no T-4 — evidence:
- [ ] The history of `T-1` (read inside the Durable Object with `listHistory`) names an agent actor `Claude Code` for the legacy client and `Codex` for the modern client — evidence:
- [ ] `add` with an empty title in the second item → `isError: true`, `Task 2: ` and the title-empty sentence; no task was added (`list` shows the earlier count) — evidence:
- [ ] `add` with 51 tasks → `isError: true`, the batch-too-large sentence — evidence:
- [ ] `list` with defaults → `Open tasks: 3 of 3` and the three lines in manual order — evidence:
- [ ] `list` with `limit` 1 → `Open tasks: 1 of 3` and one line — evidence:
- [ ] `list` with `due: ['today']` in an owner zone of `Pacific/Kiritimati` → the task due on Kiritimati's today, computed by the test with `calendarDateInTimeZone` at the call — evidence:
- [ ] `list` with `text` matching only the notes of T-1 → T-1 alone — evidence:
- [ ] `list` with `limit` 0 or 101 → `isError: true`, the limit sentence — evidence:
- [ ] `next` with a task due today and an undated one → the task due today, with its notes after a blank line — evidence:
- [ ] `update` `t-3` (lower case) with `title` `Renamed` and `due_date` `2026-12-01` → `Updated T-3 Renamed · due 2026-12-01`; `update` with `due_date: null` → the line without `· due`; `update` with only `id` → `isError: true`, the nothing-to-update sentence — evidence:
- [ ] `update` with `placement: { kind: 'first' }` on T-3 → `list` shows T-3 first; `placement: { kind: 'after', anchor: 'T-9' }` with no T-9 → `T-9 not found.` — evidence:
- [ ] `update` with `id` `12` or `task-1` → `isError: true`, `"12" is not a task id like T-12.` — evidence:
- [ ] `done` `['T-1', 'T-2']` with note `Shipped in PR 9` → `Done T-1 …`, `Done T-2 …`; again → `Already done …` for both; the history of T-1 holds a `Completed` line with that note and the client's name — evidence:
- [ ] `done` `['T-1', 'T-404']` where T-1 is open → `T-404 not found.` and T-1 is still open — evidence:
- [ ] `list` with `state: 'done'` → `Done tasks: 2 of 2`, newest completed first — evidence:
- [ ] Prompt `next` with an open task → one user message: `Work on this task from todz.`, the task block, `When it is finished, call the todz done tool with id T-n and a note of what was done.`; with none → `There is nothing to do in todz right now: no open tasks.` — evidence:
- [ ] Arguments that break the schema (`add` without `tasks`; `list` with `state: 'archived'`) → the SDK's invalid-params answer, and no task changes — evidence:
- [ ] Modern client with a client name that `agentActor` refuses (65 characters) → `add` answers `isError: true` with the client-name sentence, nothing added; `list` still works — evidence:

## Isolation through MCP

- [ ] Project B holds T-1 and T-2; a client with project A's key (A empty) → `list` shows `Open tasks: 0 of 0`; `next` → `No open tasks.` — evidence:
- [ ] With A's key: `update` T-1, `done` T-1, `update` with `placement` anchored on T-2 → each `T-1 not found.` (or `T-2 not found.`), the same text, byte for byte, as for `T-77` never issued in A; B's tasks unchanged — evidence:
- [ ] With A's key: `list` with `text` equal to B's task title → `0 of 0` — evidence:
- [ ] With A's key: `add` → `Added T-1 …` in A; B's T-1 keeps its title — evidence:
- [ ] Two owners, each with one project and key, in parallel → each sees only its own tasks — evidence:

## Prove it for real

No browser surface. The tester runs the Worker with `pnpm --filter @todz/api dev` on a free port, seeds an owner, a project and a key in the local D1 with `wrangler d1 execute --local`, and drives it from a Node script in the scratchpad with `@modelcontextprotocol/client`:

- [ ] Legacy client: connect, `add` two tasks, `list`, `next`, `done` one, prompt `next`; every answer is the compact text above — evidence:
- [ ] Modern client: the same walk on a second key of the same project → the history names `Codex` on its writes — evidence:
- [ ] `curl` without a key → 401; with a key and a legacy `tools/list` without a session → 400 — evidence:
- [ ] The `wrangler dev` output during the walk holds no task title, note, key or session id — evidence:

## Edge cases found during execution

Empty on purpose. The tester adds one checkbox per new case (input, exact expected outcome) and a regression test for each.

## Adversarial review

The reviewer picks the three claims most likely to be wrong and tries to refute each.

- [ ] Claim 1: <claim> — attack: <how>; result: <refuted | held>
- [ ] Claim 2: <claim> — attack: <how>; result: <refuted | held>
- [ ] Claim 3: <claim> — attack: <how>; result: <refuted | held>

## Coverage honesty

What is not tested and why.

- Claude Code, Codex and Cursor themselves are not driven: the SDK's client stands in for them in both eras; the owner's first real connection happens once `connect-an-agent` can show a key.
- Expired session rows are never deleted (ADR 0017); not tested because nothing deletes them.
- Performance under many concurrent sessions is not measured locally.
