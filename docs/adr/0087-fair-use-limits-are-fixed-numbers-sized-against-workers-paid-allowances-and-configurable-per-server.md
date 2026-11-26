# 0087. Fair use limits are fixed numbers sized against Workers Paid allowances and configurable per server

- Status: Accepted
- Date: 2026-11-26
- Deciders: Claude (the build loop's call, lane `fair-use`) on the owner's brief of 2026-11-26 ("apply some rules pra avoid free user abusers"); the loop decides every number below. The 5,000 writes a day is the loop's call, not the owner's: the owner's example was 20,000, and the owner may set it back with `FAIR_USE_WRITES_PER_DAY_MAX`.
- Inspired by: the owner's example numbers (20 workspaces, 100 projects, 5,000 open tasks, 500-character titles, 10 KB notes, 10 keys, 20,000 writes a day, 50 MB; the notes and writes examples were not taken, see Decision); [ADR 0073](0073-a-signed-in-limiter-that-is-missing-or-down-serves-the-request-only-a-refusal-stops-it.md); [ADR 0045](0045-the-public-sign-in-routes-are-limited-three-ways-and-turnstile-guarded-failing-closed.md)

## Context

Free accounts can write without a bound except per-minute limiters, so one account can fill a project with tens of thousands of tasks or push the Worker, the D1 directory and the project's Durable Object past what the plan includes. Some limits already exist (20 workspaces, 50 projects per workspace, 10 live keys per project, 200-character titles, 20,000-character notes; the shipped Mac app enforces 200 and 20,000 itself, so a server limit stricter than the app's would drop what a person typed). The brief asks for one documented set, enforced on the server, with refusals a person can read.

## Decision

The limits, per owner unless noted:

| Limit | Value | Was | Counted as |
|---|---|---|---|
| Workspaces | 20 | 20 | workspaces owned; a deleted workspace is hard-deleted, so it is no longer a row and no longer counts |
| Projects per workspace | 100 | 50 | projects in the workspace |
| Open tasks per project | 5,000 | none | open tasks; an add or a reopen over the cap is refused |
| Task title | 500 characters | 200 | code points, as today |
| Task notes | 20,000 characters | 20,000 characters | code points, as today and as the shipped app measures them |
| Live MCP keys per project | 10 | 10 | unrevoked keys |
| Task writes per day | 5,000 | none | task writes in a UTC day: each task added, edited, completed or reopened counts once |
| Stored text | 50 MiB | none | UTF-8 bytes of title, notes and completion notes written, edits included; an upper bound that never decreases, so the admin can reset an owner's counter ([ADR 0088](0088-daily-writes-and-stored-text-are-counted-in-d1-by-one-conditional-statement-per-write.md)) |
| New accounts per client per day | 5 | none | see [ADR 0089](0089-sign-up-abuse-is-capped-per-client-per-day-and-disposable-email-domains-are-refused-for-new-accounts.md) |

Every value is a default. A self-hosted server sets it with a Worker var, named `FAIR_USE_<LIMIT>` (`FAIR_USE_WORKSPACES_MAX`, `FAIR_USE_PROJECTS_PER_WORKSPACE_MAX`, `FAIR_USE_OPEN_TASKS_PER_PROJECT_MAX`, `FAIR_USE_LIVE_KEYS_PER_PROJECT_MAX`, `FAIR_USE_WRITES_PER_DAY_MAX`, `FAIR_USE_STORED_BYTES_MAX`, `FAIR_USE_SIGN_UPS_PER_CLIENT_DAY_MAX`). An unset var keeps the default; a set var that is not a positive whole number stops the Worker with an error instead of falling back. Title and notes sizes stay fixed: they are the text rules the app and the MCP copy both state, so changing them per server would make the copy lie.

The workspace count is the number of workspace rows the owner has. The delete-workspace feature deletes rows (hard delete), so the count needs no deleted-row filter. Deleting a workspace or a project is a write: a suspended owner is refused before the handler runs, like every other write.

### Sizing

The owner's example for writes was 20,000 a day. The loop chose 5,000 for an agent-heavy owner; it is the loop's call and the owner can overrule it with one var. Workers Paid includes 10 million Worker requests, 50 million D1 rows written, 1 million Durable Object requests and 50 million Durable Object SQLite rows written a month, with 5 GB-month of Durable Object storage (published allowances at the time of writing; re-check the Cloudflare pricing page before a release). Overage rates used: $0.30 per million Worker requests, $1.00 per million D1 rows written, $0.15 per million Durable Object requests, $1.00 per million Durable Object SQLite rows written, $0.20 per GB-month of storage. Each task write costs the Durable Object SQLite rows its indexes and history need, measured with `SqlStorageCursor.rowsWritten` on 2026-11-26: 11 for one added task, 13 per task in a batch of ten, 9 for an edit, 10 for a completion or a reopen; 13 is used below. Each write request costs at most one Worker request, one Durable Object request and two D1 rows (the reservation upsert and its index).

- One account at the cap writes at most 150,000 tasks a month (5,000 a day for 30 days): about 1.95 million Durable Object rows.
- A thousand accounts held at the cap for a whole month would write 150 million tasks: 1,950 million Durable Object rows against 50 million included (about $1,900), at most 150 million Worker requests against 10 million (about $42), at most 150 million Durable Object requests against 1 million (about $22) and at most 300 million D1 rows against 50 million (about $250). The ceiling is roughly $2,200 a month, about $2.20 an account. That is the price of a thousand accounts all abusing the cap every day for a month; the per-client sign-up cap and the suspension switch are what keep that scenario hypothetical.
- At 1,000 a day the same ceiling is about $360 a month; at 20,000 it is about $9,200 a month. A host that wants the lower ceiling sets `FAIR_USE_WRITES_PER_DAY_MAX`.
- Stored text at 50 MiB for a thousand accounts is 50 GiB at most; over the 5 GB-month included, the overage is about $9 a month.
- A personal to-do list does not approach 5,000 task writes a day: an agent batches up to 50 tasks a call, so 5,000 writes is about a hundred calls of fifty.

Open tasks at 5,000 per project keeps `listTasks`, `nextTask` and the change feed bounded per project, which the performance budgets of [ADR 0061](0061-performance-has-written-budgets-a-fetch-based-load-harness-behind-pnpm-perf-and-work-count-budgets-in-verify.md) assume.

## Alternatives considered

| Option | Pros | Cons | Why not |
|---|---|---|---|
| The owner's examples as written (20,000 writes a day) | Matches the brief literally | A thousand abusers at the cap would cost about $9,200 a month over the plan | The write cap is the number that decides the bill; 5,000 keeps the ceiling near $2,200 |
| 1,000 writes a day | Ceiling near $360 a month | Tight for an agent-heavy owner | The owner asked for a generous cap |
| Vary every limit through a per-server config file | One place to change everything | More parsing and more ways to misconfigure; the copy the app shows would drift | Worker vars cover the counts that matter to operators; text rules stay in code |
| Count stored bytes exactly, deletions included | Accurate storage | Needs a per-task byte ledger in the Durable Object and a migration of existing rows | No delete exists yet; the upper bound is honest and cheap ([ADR 0088](0088-daily-writes-and-stored-text-are-counted-in-d1-by-one-conditional-statement-per-write.md)) |

## Consequences

- `libs/types` holds the defaults and the enum of limits; `apps/api` reads the vars once per request through one function.
- No existing row is rewritten. Notes keep the limit the shipped app enforces; a 10 KB byte cap needs the app to enforce it first, so it waits for an app release.
- The open-task cap keeps a one-row counter in each project (schema version 4). An add reads that row once, so the add row budget of ADR 0061's work-count budgets moves from 10 to 11 rows read; the counter is what keeps the cap from reading every open task.
- The MCP and app copy for these limits is generated from the same constants.

## Evidence

- Current values: `libs/types/src/constants.ts`, `libs/types/src/task.ts` (before this change).
- Sizing arithmetic above; the allowances are the published Workers Paid numbers at the time of writing.

## Revisit when

- Cloudflare changes the Workers Paid allowances, or a measured bill differs from the ceiling by more than 2x.
- A delete exists: the stored-text measure then becomes exact by subtraction.
- A legitimate owner reaches 5,000 task writes a day more than once a month.
