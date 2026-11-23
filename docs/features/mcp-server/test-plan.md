# Test plan: MCP server

Every checkbox states the input and the exact expected outcome. A ticked box carries evidence after ` — evidence: ` (commit hash, log path, counts, screenshot path).

Fixtures: every test creates its own owner, workspace, project and key with fresh random ids, because storage persists across the tests of one file (ADR 0012). "Legacy client" is `new Client({ name: 'Claude Code', version: '1.0.0' })` with the default `versionNegotiation` (`legacy`); "modern client" is `new Client({ name: 'Codex', version: '1.0.0' }, { versionNegotiation: { mode: { pin: '2026-07-28' } } })`. Both use `StreamableHTTPClientTransport` on `https://api.todz.test/mcp` with `Authorization: Bearer <key>` and the Worker's `fetch`. `COPY` below means the entry of `mcp-copy.ts` named after it, e.g. `COPY.ruleIssue[BatchTooLarge]`; the test compares with the entry, not a retyped string.

## The failing test first

- [ ] Steps 2 to 7 each have a test commit that precedes its implementation commit in `git log`, and the red run of each fails on a named assertion or on `<name> is not implemented`, recorded in `tester-briefing.md` — evidence:
- [ ] Spot check in a throwaway worktree: check out the red commits of steps 3 and 6, run their tests; expected: the failure text the briefing records — evidence:
- [ ] Steps 1 and 8 land as pins and their commits say `pin` — evidence:

## Unit (inside workerd)

### Schema (step 1, pins)

- [ ] Inserting an owner with `time_zone` `''`, or without `time_zone` → a constraint error; with `America/Sao_Paulo` → inserted — evidence:
- [ ] `mcp_sessions` refuses a `key_digest` with no key row (foreign key error) and a `digest` of 63 characters (check error) — evidence:
- [ ] The directory lists exactly `mcp_sessions`, `owners`, `project_keys`, `projects`, `sessions`, `workspaces`, and still has no task column — evidence:
- [ ] `PROJECT_KEY_PREFIX` is `todz_` and `LIST_LIMIT_DEFAULT` is 20, at most `LIST_LIMIT_MAX` — evidence:

### Credentials and keys

- [ ] `generateCredentialSecret()` → matches `^[A-Za-z0-9_-]{43}$`; 100 calls give 100 distinct values — evidence:
- [ ] `issueProjectKey` for a seeded project → matches `^todz_[A-Za-z0-9_-]{43}$`; `project_keys` holds one row for that project whose `digest` is `digestCredential(secret)`, `revoked_at` null; no column of any directory row equals the secret — evidence:
- [ ] Two `issueProjectKey` calls for one project → two different secrets, two rows, both resolve through `openKeyProject` to that project — evidence:
- [ ] `issueProjectKey` for a project id that does not exist → rejects; `project_keys` row count unchanged — evidence:

### Directory and routing

- [ ] `findKeyProject` for a live key of an owner in `America/Sao_Paulo` → `{ projectId, timeZone: 'America/Sao_Paulo' }`; for a revoked key → `null`; for an unknown digest → `null` — evidence:
- [ ] `openKeyProject` → `{ project, keyDigest, timeZone }` with `keyDigest` equal to `digestCredential(secret)`; the existing refusals (blank, non-string, unknown, revoked) still answer `null` and the counting namespace records no call — evidence:
- [ ] `findMcpSessionClient`: a stored session at `now` = `expires_at - 1` → its client name; at `now` = `expires_at` → `null`; with another key's digest → `null`; an unknown digest → `null` — evidence:

### Today

- [ ] `calendarDateInTimeZone` at `2026-11-24T01:30:00Z`: `America/Sao_Paulo` → `2026-11-23`; `UTC` → `2026-11-24`; `Pacific/Kiritimati` → `2026-11-24`; at `2026-12-31T23:30:00Z` in `Asia/Tokyo` → `2027-01-01`; at `2026-03-01T02:00:00Z` in `America/Los_Angeles` → `2026-02-28` — evidence:
- [ ] `calendarDateInTimeZone` with `Not/A_Zone` → throws `RangeError` — evidence:

### Compact text

- [ ] Task line: `T-3` titled `Ship it` without a due date → `T-3 Ship it`; with `2026-11-24` → `T-3 Ship it · due 2026-11-24` — evidence:
- [ ] Task block: with notes `Line one\nLine two` → `T-3 Ship it\n\nLine one\nLine two`; with `notes: null` → `T-3 Ship it` — evidence:
- [ ] List: 2 shown of 5 open (T-1 `A`, T-2 `B`) → `Open tasks: 2 of 5\nT-1 A\nT-2 B`; 0 done → exactly `Done tasks: 0 of 0` — evidence:
- [ ] Every `RuleIssue` value has a non-empty sentence in `COPY.ruleIssue` (iterate the enum) — evidence:
- [ ] Rule error with `index` 1 and `TitleEmpty` → `Task 2: ` + `COPY.ruleIssue[TitleEmpty]`; with `index` null → the sentence alone; `TaskNotFound` 99 → `T-99 not found.` — evidence:
- [ ] `COPY.taskIdInvalid` is `Not a task id: use one like T-12.` built from `TASK_SHORT_ID_PREFIX` — evidence:

## HTTP surface

Rows that need the counting namespace call `serveMcp({ request, env: countedEnv, now })` directly; the rest go through `exports.default.fetch`.

- [ ] `GET /` and `POST /other` → 404, empty body — evidence:
- [ ] `POST /mcp` with: no `Authorization`; `Basic <valid key>`; `Bearer ` followed by three spaces; `Bearer  <valid key>` (two spaces); `Bearer todz_` plus 43 random characters never issued; `Bearer <key without prefix>`; a revoked key → each 401, `WWW-Authenticate: Bearer`, empty body; the counting namespace records no call and `mcp_sessions` is unchanged — evidence:
- [ ] `POST /mcp` with `bearer <valid key>` (lower-case scheme) and a legacy `initialize` → 200 — evidence:
- [ ] `GET /mcp` and `DELETE /mcp` with a valid key (and, for `DELETE`, a live session) → 405, `Allow: POST`, empty body; the session row still exists after the `DELETE` — evidence:
- [ ] Legacy `initialize` with a valid key and client name `  Claude Code  ` → 200, an `Mcp-Session-Id` header matching `^[A-Za-z0-9_-]{43}$`, one `mcp_sessions` row whose digest is `digestCredential(header)`, whose `key_digest` is the key's, `client_name` `Claude Code` (trimmed), `expires_at - created_at` = `30 * MILLISECONDS_PER_DAY` — evidence:
- [ ] Legacy `initialize` with client name `"   "`; a name of 65 characters; `Claude\nCode`; `name: 42`; `clientInfo` missing; `params` missing → each 400, body `{ jsonrpc: '2.0', id: <the request's id>, error: { code: -32602, message: COPY.ruleIssue[ClientNameInvalid] } }`; no session row added — evidence:
- [ ] Legacy `tools/list` with no `Mcp-Session-Id`, and with `Mcp-Session-Id:` blank → each 400, body `{ jsonrpc: '2.0', id: null, error: { code: -32000, message: 'Bad Request: Mcp-Session-Id header is required' } }` — evidence:
- [ ] Legacy `tools/list` with a random 43-character session id; with an expired session (row inserted with `expires_at` one millisecond before `now`); with a live session issued to another key of the same project → each 404, body `{ jsonrpc: '2.0', id: null, error: { code: -32001, message: 'Session not found' } }` — evidence:
- [ ] A session issued to key A of project A, sent with key B of project B → 404 `Session not found`; nothing of project A in the body — evidence:
- [ ] A legacy session, then its key revoked → the next `tools/list` answers 401 — evidence:
- [ ] A legacy `POST` whose body is `not json` with no session header → 400 `-32000` (treated as not `initialize`); a batch array `[initialize]` → 400 `-32000` — evidence:

## End to end with the real client, both eras

Each box is one test, run once with the legacy client and once with the modern client (`test.each`), on its own fresh project, unless it says otherwise.

- [ ] `listTools` → names exactly `add`, `done`, `list`, `next`, `update`; each description equals its `COPY` entry; no input schema property name contains `project` or `workspace`; `next` and `list` have `annotations.readOnlyHint: true`; `list`'s schema shows `"default": "open"` for `state` and `"default": 20` for `limit` — evidence:
- [ ] `listPrompts` → exactly `next`, with no arguments, description `COPY` entry — evidence:
- [ ] `next` on an empty project → text `No open tasks.`, `isError` absent — evidence:
- [ ] One sequential test: `add` `[{ title: 'Write the spec', notes: 'Line one', due_date: <today in the owner's zone> }, { title: 'Pin the SDK', idempotency_key: 'k-1' }, { title: 'Open the PR' }]` → `Added T-1 Write the spec · due <today>\nAdded T-2 Pin the SDK\nAdded T-3 Open the PR`; the same call with only the `k-1` task → `Already added T-2 Pin the SDK`; then `list` → `Open tasks: 3 of 3` and the three lines in that order; the history of `T-1` (read inside the Durable Object with `listHistory`) is one `Created` line by an agent named `Claude Code` (legacy) or `Codex` (modern) — evidence:
- [ ] `add` `[{ title: 'Fine' }, { title: '' }]` → `isError: true`, text `Task 2: ` + `COPY.ruleIssue[TitleEmpty]`; `list` → `Open tasks: 0 of 0` — evidence:
- [ ] `add` with 51 tasks titled `Task <n>` → `isError: true`, text `COPY.ruleIssue[BatchTooLarge]`; `add` with `tasks: []` → `COPY.ruleIssue[BatchEmpty]` — evidence:
- [ ] Three open tasks: `list` with `limit: 1` → `Open tasks: 1 of 3` and the first line only; `limit: 0` and `limit: 101` → `isError: true`, `COPY.ruleIssue[LimitInvalid]` — evidence:
- [ ] Owner in `Pacific/Kiritimati`; tasks due on Kiritimati's today (the test computes it with `calendarDateInTimeZone` right before the call) and on the day after: `list` with `due: ['today']` → only the first — evidence:
- [ ] `list` with `text` `zebra`, which only T-1's notes contain → `Open tasks: 1 of 1\nT-1 <its title>` — evidence:
- [ ] `next` with T-1 undated and T-2 due today with notes `Do it` → `T-2 <title> · due <today>\n\nDo it` — evidence:
- [ ] One sequential test on T-1 `Draft`: `update` `{ id: 't-1', title: 'Renamed', due_date: '2026-12-01' }` → `Updated T-1 Renamed · due 2026-12-01`; `update` `{ id: 'T-1', due_date: null }` → `Updated T-1 Renamed`; `update` `{ id: 'T-1' }` → `isError: true`, `COPY.ruleIssue[NothingToUpdate]` — evidence:
- [ ] T-1, T-2, T-3 open: `update` `{ id: 'T-3', placement: { kind: 'first' } }` → `list` lines start with T-3; `update` `{ id: 'T-1', placement: { kind: 'after', anchor: 'T-9' } }` → `isError: true`, `T-9 not found.`; `placement: { kind: 'after', anchor: 'nine' }` → `COPY.taskIdInvalid` — evidence:
- [ ] `update` with `id` `12`, `task-1` and `T-0` → each `isError: true`, `COPY.taskIdInvalid` — evidence:
- [ ] One sequential test on open T-1 `One` and T-2 `Two`: `done` `{ ids: ['T-1', 'T-2'], note: 'Shipped in PR 9' }` → `Done T-1 One\nDone T-2 Two`; again → `Already done T-1 One\nAlready done T-2 Two`; the history of T-1 ends with a `Completed` line whose note is `Shipped in PR 9` and whose actor is the client's name; `list` `{ state: 'done' }` → `Done tasks: 2 of 2` with the later completion first — evidence:
- [ ] `done` `{ ids: ['T-1', 'T-404'] }` with T-1 open → `isError: true`, `T-404 not found.`; T-1 still open — evidence:
- [ ] Prompt `next` with open T-1 `Ship` → one user message whose text is `Work on this task from todz.\n\nT-1 Ship\n\nWhen it is finished, call the todz done tool with id T-1 and a note of what was done.`; on an empty project → `There is nothing to do in todz right now: no open tasks.` — evidence:
- [ ] `add` with no `tasks`, and `list` with `state: 'archived'` → `isError: true`, text starting `Input validation error:`; `list` afterwards shows no change — evidence:
- [ ] Modern client only, named with 65 characters: `add` `[{ title: 'X' }]` → `isError: true`, `COPY.ruleIssue[ClientNameInvalid]`; `list` → `Open tasks: 0 of 0` — evidence:

## Isolation through MCP

- [ ] Project B holds T-1 `Secret B` and T-2; a client with project A's key (A empty) → `list` → `Open tasks: 0 of 0`; `next` → `No open tasks.` — evidence:
- [ ] With A's key (A empty): `update` `{ id: 'T-1', title: 'x' }` and `done` `{ ids: ['T-2'] }` → `T-1 not found.` and `T-2 not found.`, the whole tool result deep-equal to the one for `T-77` and `T-78` never issued anywhere; B's tasks unchanged (read through B's key) — evidence:
- [ ] With A's key: `list` with `text: 'Secret B'` → `Open tasks: 0 of 0` — evidence:
- [ ] With A's key: `add` `[{ title: 'Mine' }]` → `Added T-1 Mine`; B's T-1 still `Secret B` — evidence:
- [ ] Two owners, each with one project and key, adding and listing at once (`Promise.all`) → each list shows only its own titles — evidence:

## Prove it for real

No browser surface. The tester, in the scratchpad:

1. runs `pnpm --filter @todz/api exec wrangler d1 migrations apply directory --local` and `pnpm --filter @todz/api dev --port <free port>`;
2. seeds an owner (`America/Sao_Paulo`), a workspace, a project and two keys with `wrangler d1 execute directory --local --command`, the keys' digests computed in Node with SHA-256 of secrets made by `crypto.randomBytes(32).toString('base64url')` prefixed `todz_`;
3. drives the Worker from a Node script with `@modelcontextprotocol/client`.

- [ ] Legacy client: connect, `add` two tasks, `list`, `next`, `done` one with a note, prompt `next`; every answer is the compact text above — evidence:
- [ ] Modern client on the second key: the same walk, every answer the compact text above (the history's actor is checked by the unit suite, since no tool reads history) — evidence:
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
- Expired session rows are never deleted, and every `initialize` from a valid key adds one (ADR 0017): a key holder can grow `mcp_sessions` without bound. Accepted for v1; a cleanup job and a per-key cap are follow-ups.
- Performance under many concurrent sessions is not measured locally.
