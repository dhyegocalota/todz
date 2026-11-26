# Fair use: test plan

Each box is one case with its input and its exact expected outcome. Evidence is filled when run: the command, the counts, the commit of the red run.

Class: `product` (the owner's brief changes what a person and an agent see). No Playwright walk for the owner app (`apps/macos` is out of this lane); the admin page is covered by its server test. See `plan.md` → v1.1.

## Constants and text rules (A)

- [ ] A-1 Input: `PROJECT_OPEN_TASKS_MAX`, `OWNER_WRITES_PER_DAY_MAX`, `OWNER_STORED_BYTES_MAX`, `SIGN_UPS_PER_CLIENT_DAY_MAX`, `WORKSPACE_PROJECTS_MAX`. Expected: 5000, 1000, 52428800, 5, 100.
- [ ] A-2 Input: `TASK_TITLE_MAX_LENGTH`, `TASK_NOTES_MAX_BYTES`. Expected: 500 and 10240.
- [ ] A-3 Input: a title of 500 characters. Expected: accepted, stored whole.
- [ ] A-4 Input: a title of 501 characters. Expected: `title_too_long`.
- [ ] A-5 Input: notes of exactly 10,240 ASCII bytes. Expected: accepted.
- [ ] A-6 Input: notes of 10,241 ASCII bytes. Expected: `notes_too_long`.
- [ ] A-7 Input: notes of 3,413 three-byte characters (10,239 bytes) plus one ASCII byte (10,240). Expected: accepted; one more ASCII byte is refused: `notes_too_long`.
- [ ] A-8 Input: `FairUseLimit` values. Expected: `workspaces`, `projects`, `open_tasks`, `live_keys`, `daily_writes`, `stored_bytes`, `daily_sign_ups`.

## Configuration (B)

- [ ] B-1 Input: no `FAIR_USE_*` var set. Expected: `fairUseLimitsOf(env)` equals the defaults.
- [ ] B-2 Input: `FAIR_USE_OPEN_TASKS_PER_PROJECT_MAX` = `"3"`. Expected: the open-task limit is 3; others keep defaults.
- [ ] B-3 Input: `FAIR_USE_WRITES_PER_DAY_MAX` = `"0"`, `"-1"`, `"1.5"`, `"ten"`, `""`. Expected: each throws an error naming `FAIR_USE_WRITES_PER_DAY_MAX`.

## Storage and reservation (C)

- [ ] C-1 Input: one owner, a reservation of 2 writes and 100 bytes on day D. Expected: one `owner_usage` row (writes 2, bytes 100); the reservation returns a row.
- [ ] C-2 Input: the same owner, a further reservation of 1 write, with the cap at 2 on day D. Expected: no row returned; `owner_usage` writes still 2.
- [ ] C-3 Input: a reservation that stays within the writes cap but passes the bytes cap. Expected: refused; no row changed.
- [ ] C-4 Input: a reservation on day D+1 after the cap was reached on day D. Expected: accepted (a fresh count); the bytes sum includes day D.
- [ ] C-5 Input: 20 concurrent reservations of 1 write each with 5 units left. Expected: exactly 5 accepted; `owner_usage` writes = cap.
- [ ] C-6 Input: a suspended owner's reservation. Expected: refused; no row inserted.
- [ ] C-7 Input: diagnosis after a daily refusal. Expected: `daily_writes`; after a bytes refusal: `stored_bytes`; after a suspended owner: `account_suspended`.
- [ ] C-8 Input: a reservation when the database throws. Expected: the write answers 503 (`sign_in_unavailable`-style unavailable), no task written.

## Owner API: suspension and messages (D)

- [ ] D-1 Input: a suspended owner calls each session write route: create workspace, rename workspace, create project, rename project, add tasks, update task, complete tasks, reopen tasks, issue key, revoke key, update owner settings. Expected: each answers 403 `{error: 'account_suspended', message}`; no row changes (checked by a count before and after).
- [ ] D-2 Input: a suspended owner's `GET /owner`, `GET /owner/workspaces`, `GET` changes, `GET` history. Expected: 200 with data.
- [ ] D-3 Input: a suspended owner's sign-out. Expected: 204 or the sign-out status; the session is removed.
- [ ] D-4 Input: the owner restored (`suspended_at` cleared) and writes again. Expected: 201 on create workspace.
- [ ] D-5 Input: the 21st workspace. Expected: 409 `{error: 'limit_reached', limit: 'workspaces', message}`; list keeps 20.
- [ ] D-6 Input: the 101st project in one workspace. Expected: 409 `{error: 'limit_reached', limit: 'projects', message}`.
- [ ] D-7 Input: the 11th live key in one project. Expected: 409 `{error: 'limit_reached', limit: 'live_keys', message}`.
- [ ] D-8 Input: a daily-writes refusal. Expected: 429 `{error: 'limit_reached', limit: 'daily_writes', message}` with `Retry-After` in seconds to the next UTC midnight (greater than 0, at most 86400).
- [ ] D-9 Input: a stored-bytes refusal. Expected: 409 `{error: 'limit_reached', limit: 'stored_bytes', message}`.
- [ ] D-10 Input: a message is a string on every refusal above. Expected: non-empty, no raw code in it.

## Open tasks (E)

- [ ] E-1 Input: cap 3; three adds, then a fourth. Expected: fourth refused 409 `{error: 'limit_reached', limit: 'open_tasks', message}`; no fourth task.
- [ ] E-2 Input: cap 3; three open tasks; complete one; add one. Expected: add accepted.
- [ ] E-3 Input: cap 3; a batch of four adds. Expected: refused whole; zero tasks added.
- [ ] E-4 Input: cap 3; two open, one done; reopen the done one. Expected: accepted (3 open).
- [ ] E-5 Input: cap 3; three open; reopen a done one. Expected: refused 409 `open_tasks`.
- [ ] E-6 Input: 10 concurrent adds of 1 with 3 open-task slots. Expected: exactly 3 accepted.

## MCP (F)

- [ ] F-1 Input: a suspended key calls `next`. Expected: HTTP 403 with a JSON-RPC error, code -32000, message the suspension copy.
- [ ] F-2 Input: a suspended key calls `add`. Expected: 403 as F-1; no task written.
- [ ] F-3 Input: a key whose owner is over the daily cap calls `add`. Expected: an error tool result (`isError: true`) whose text is the daily-cap message; no task written.
- [ ] F-4 Input: a key at the open-task cap calls `add`. Expected: error tool result with the open-task message.
- [ ] F-5 Input: a normal `add` by an active key. Expected: unchanged success text (`Added T-…`).
- [ ] F-6 Input: a restored owner's key calls `next`. Expected: works again without reissue.

## Sign-up (G)

- [ ] G-1 Input: six sign-ins with six different new addresses from one client in one UTC day. Expected: the first five create owners; the sixth answers 429 `{error: 'limit_reached', limit: 'daily_sign_ups'}` with `Retry-After`; `owner_identities` has five new rows.
- [ ] G-2 Input: after the cap, an existing owner's sign-in from the same client. Expected: 201 (not counted).
- [ ] G-3 Input: a new owner whose address is `someone@mailinator.com`. Expected: 403 `{error: 'sign_up_refused', message}`; no owner row.
- [ ] G-4 Input: an existing owner whose address is on the list (added to the owner through a fixture before the list applies). Expected: 201.
- [ ] G-5 Input: `isDisposableEmailDomain('x@MAILINATOR.com')` and `'x@notmailinator.com'`. Expected: true, false.
- [ ] G-6 Input: the sign-up counter cannot be written. Expected: 503 unavailable; no owner row.

## Admin (H)

- [ ] H-1 Input: `GET /admin/usage`, no session. Expected: 200 sign-in card; no owner id in the body.
- [ ] H-2 Input: `GET /admin/usage`, session of a non-admin email. Expected: the same sign-in card; no owner id.
- [ ] H-3 Input: `GET /admin/usage`, admin session, seeded usage for three owners over seven days. Expected: the writes table lists owners in descending writes; the bytes table lists them in descending bytes; a day outside seven is not counted.
- [ ] H-4 Input: `POST /admin/suspensions` with a foreign `Origin`. Expected: refused by `isSameOriginPost`; `suspended_at` unchanged.
- [ ] H-5 Input: `POST /admin/suspensions`, no admin session. Expected: refused; unchanged.
- [ ] H-6 Input: `POST /admin/suspensions` with `suspended=true` then `suspended=false`, admin session. Expected: `suspended_at` set then null; each answers 303 to `/admin/usage`.
- [ ] H-7 Input: the page's CSP and `Cache-Control: no-store`. Expected: the admin headers as the panel's.
- [ ] H-8 Input: MCP has no route to suspension or usage (`/mcp` with the admin session cookie). Expected: no admin data; the admin paths are not MCP tools.

## Docs and records (I)

- [ ] I-1 Input: `tools/repository-shape` `docs-pages.test.ts`, `document-indexes.test.ts`, `feature-status.test.ts`, `self-host.test.ts`. Expected: all green.
- [ ] I-2 Input: `docs/adr/README.md` rows 0086 to 0089 present in number order with the record's title, status and date.

## Adversarial (hunted during the run)

- [ ] X-1 A suspended owner's second session (signed in on another device before suspension). Expected: writes refused (the check reads the owner, not the session).
- [ ] X-2 A key revoked and reissued while over the cap. Expected: the reissued key writes under the same owner's cap.
- [ ] X-3 A project moved to another workspace is not a thing; a workspace of another owner's project is refused by routing, not by quota. Expected: 404 as today.
- [ ] X-4 Owner-id case in the admin POST body (`OWNER-…`). Expected: no match, unchanged.
