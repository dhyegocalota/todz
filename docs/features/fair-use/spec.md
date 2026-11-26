# Fair use

**Status:** Building
**Tier:** 🔴
**Owner approval:** approved by inheritance: [docs/product/README.md](../../product/README.md) (approved 2026-11-23) plus the owner's words of 2026-11-26 ("apply some rules pra avoid free user abusers"), quoted in the loop brief. The numbers are the loop's call, recorded in [ADR 0086](../../adr/0086-fair-use-limits-are-fixed-numbers-sized-against-workers-paid-allowances-and-configurable-per-server.md).
**ADRs:** [0086](../../adr/0086-fair-use-limits-are-fixed-numbers-sized-against-workers-paid-allowances-and-configurable-per-server.md), [0087](../../adr/0087-daily-writes-and-stored-text-are-counted-in-d1-by-one-conditional-statement-per-write.md), [0088](../../adr/0088-sign-up-abuse-is-capped-per-client-per-day-and-disposable-email-domains-are-refused-for-new-accounts.md), [0089](../../adr/0089-suspension-blocks-writes-and-mcp-and-the-admin-sees-top-usage-by-owner.md)
**Not changing:** the app (`apps/macos`), the MCP tool names and their arguments, the sign-in providers, the Turnstile guard, the per-minute limiters, the existing rows of the directory, the sync protocol and the change feed.

## Problem

A free account can write without a bound beyond the per-minute limiters. One account can fill a project, a workspace or the daily write budget of the plan, and new accounts can be opened in bulk from one client with throwaway addresses. Some limits exist (20 workspaces, 50 projects per workspace, 10 live keys per project, 200-character titles, 20,000-character notes), but they are not documented together, some refusals carry no message, and there is no way to suspend an account that is abusing the service.

## Goals

1. One documented set of per-owner limits, enforced on the server, with the numbers of [ADR 0086](../../adr/0086-fair-use-limits-are-fixed-numbers-sized-against-workers-paid-allowances-and-configurable-per-server.md): 20 workspaces, 100 projects per workspace, 5,000 open tasks per project, 500-character titles, 10 KB notes, 10 live MCP keys per project, 1,000 task writes per UTC day, 50 MiB of stored text.
2. Every refusal names the limit and carries a human-readable message, over the owner API (`message` in the body) and over MCP (the tool's error text).
3. Sign-up abuse: a daily cap of new accounts per client and a refusal for disposable email domains, both only for new accounts ([ADR 0088](../../adr/0088-sign-up-abuse-is-capped-per-client-per-day-and-disposable-email-domains-are-refused-for-new-accounts.md)).
4. The admin (owner only, the existing admin session) sees Top usage over seven days by task writes and by stored text bytes, and suspends or restores an account. A suspended account reads and cannot write nor use MCP ([ADR 0089](../../adr/0089-suspension-blocks-writes-and-mcp-and-the-admin-sees-top-usage-by-owner.md)).
5. Self-hosted servers set every count with a Worker var, defaults unchanged ([ADR 0086](../../adr/0086-fair-use-limits-are-fixed-numbers-sized-against-workers-paid-allowances-and-configurable-per-server.md)).
6. The docs site has a short "Fair use" section.

## Non-goals

- Any change to `apps/macos`. The owner API's new `limit_reached`, `account_suspended` and `sign_up_refused` codes are not in the app's error enum; the app shows its generic "change not saved" banner until a follow-up decodes them (see `plan.md` → v1.1).
- Billing, plans, or any paid tier.
- Deleting data of any account, including a suspended one.
- Counting reads.
- Exact storage accounting. Stored text is an upper bound because nothing is deleted yet.

## Design

### Data flow

Owner API and MCP, for a write:

1. The request is authenticated as today (owner session or MCP key).
2. A suspended owner's write answers `account_suspended` (403) before the handler runs; MCP answers a JSON-RPC error with the same copy.
3. The task write is validated as today; title and notes sizes are checked by `libs/core`.
4. The reservation statement adds the request's task writes and its bytes to `owner_usage` for the UTC day, only if the owner is not suspended, the day stays within the daily cap and the owner's stored bytes stay within the cap. No row back means refused, and a read says which limit.
5. The project's Durable Object adds or reopens tasks only if the project's open tasks stay within the cap; a refusal is a `LimitViolation` that becomes a `limit_reached` failure.

Sign-up, for a sign-in that would create an owner:

1. The provider verifies the subject as today.
2. If the subject is not an existing owner: a disposable domain answers `sign_up_refused` (403); the client's daily count is incremented by one conditional upsert, and at the cap the answer is `limit_reached` with `limit: daily_sign_ups` (429) and `Retry-After`.
3. Only then is the owner row inserted.

Admin:

1. `GET /admin/usage` renders two tables (top owners by task writes, top owners by bytes) over the last seven UTC days, with a suspend or restore button per row.
2. `POST /admin/suspensions` (same origin, admin session) sets or clears `owners.suspended_at`, then redirects to `/admin/usage`.

### Interfaces

- `libs/types`: the limit defaults (`OWNER_WORKSPACES_MAX`, `WORKSPACE_PROJECTS_MAX` = 100, `PROJECT_OPEN_TASKS_MAX`, `PROJECT_LIVE_KEYS_MAX`, `OWNER_WRITES_PER_DAY_MAX`, `OWNER_STORED_BYTES_MAX`, `SIGN_UPS_PER_CLIENT_DAY_MAX`, `BYTES_PER_KIBIBYTE`), `TASK_TITLE_MAX_LENGTH` = 500, `TASK_NOTES_MAX_BYTES` = 10 KB, and the enum `FairUseLimit`.
- `libs/core`: notes are measured in UTF-8 bytes; `LimitViolation` carries a `FairUseLimit`.
- `apps/api`: `fairUseLimitsOf(env)`; the `FAIR_USE_*` Worker vars (optional strings, positive whole numbers, a bad value stops the Worker); `reserveOwnerWrites`; `findOwnerSuspension`; `setOwnerSuspension`; `signUpAllowance`; `isDisposableEmailDomain`; the admin usage page and the suspension route.
- Error bodies (owner API): `{ error: 'limit_reached', limit, message }` with the status of the limit (409 for counts, 429 for the two daily limits, which also carry `Retry-After` to the next UTC midnight); `{ error: 'account_suspended', message }` (403); `{ error: 'sign_up_refused', message }` (403).
- MCP: a refusal is an error tool result whose text is the message; a suspended key answers JSON-RPC error code -32000 with status 403.

### Failure handling

- A reservation the database cannot answer is a write refused as unavailable (503), never a write let through.
- A missing or invalid `FAIR_USE_*` var stops the Worker at the first request that reads it, with the name of the var, rather than falling back silently.
- The sign-up counter failing refuses the sign-up as unavailable ([ADR 0088](../../adr/0088-sign-up-abuse-is-capped-per-client-per-day-and-disposable-email-domains-are-refused-for-new-accounts.md)).
- Refusals never delete data.
- A suspended owner's keys stop working at once; restoring the owner restores them without reissue.

## Open questions → answers

| Question | Options | Owner's answer | Date |
|----------|---------|----------------|------|
| The numbers | the owner's examples, or sized ones | Loop's call: [ADR 0086](../../adr/0086-fair-use-limits-are-fixed-numbers-sized-against-workers-paid-allowances-and-configurable-per-server.md) (1,000 writes a day, not 20,000) | 2026-11-26 |
| Disposable list source | vendored by hand, or a service | Loop's call: vendored by hand, updated in reviewed commits | 2026-11-26 |
| What a suspended owner can do | read; or nothing | Owner's brief: reads, no writes, no MCP | 2026-11-26 |
| The app's copy | change the app now, or follow-up | Loop's call: follow-up, the server carries the message | 2026-11-26 |

## Test strategy summary

Red-first unit tests for the constants, the note byte rule, the env parsing, the reservation statement (including concurrency at the last unit), the open-task cap in the Durable Object, the suspension on every write route and MCP, the sign-up caps and the admin page's owner-only access. The test plan lists each edge case with its expected outcome.
