# 0086. Fair use limits are fixed numbers sized against Workers Paid allowances and configurable per server

- Status: Accepted
- Date: 2026-11-26
- Deciders: Claude (the build loop's call, lane `fair-use`) on the owner's brief of 2026-11-26 ("apply some rules pra avoid free user abusers"); the loop decides every number below
- Inspired by: the owner's example numbers (20 workspaces, 100 projects, 5,000 open tasks, 500-character titles, 10 KB notes, 10 keys, 20,000 writes a day, 50 MB); [ADR 0073](0073-a-signed-in-limiter-that-is-missing-or-down-serves-the-request-only-a-refusal-stops-it.md); [ADR 0045](0045-the-public-sign-in-routes-are-limited-three-ways-and-turnstile-guarded-failing-closed.md)

## Context

Free accounts can write without a bound except per-minute limiters, so one account can fill a project with tens of thousands of tasks or push the Worker, the D1 directory and the project's Durable Object past what the plan includes. Some limits already exist (20 workspaces, 50 projects per workspace, 10 live keys per project, 200-character titles, 20,000-character notes). The brief asks for one documented set, enforced on the server, with refusals a person can read.

## Decision

The limits, per owner unless noted:

| Limit | Value | Was | Counted as |
|---|---|---|---|
| Workspaces | 20 | 20 | workspaces owned |
| Projects per workspace | 100 | 50 | projects in the workspace |
| Open tasks per project | 5,000 | none | open tasks; an add or a reopen over the cap is refused |
| Task title | 500 characters | 200 | code points, as today |
| Task notes | 10 KB (10,240 bytes) | 20,000 characters | UTF-8 bytes |
| Live MCP keys per project | 10 | 10 | unrevoked keys |
| Task writes per day | 1,000 | none | task writes in a UTC day: each task added, edited, completed or reopened counts once |
| Stored text | 50 MiB | none | UTF-8 bytes of title, notes and completion notes written; an upper bound, because nothing is deleted yet |
| New accounts per client per day | 5 | none | see [ADR 0088](0088-sign-up-abuse-is-capped-per-client-per-day-and-disposable-email-domains-are-refused-for-new-accounts.md) |

Every value is a default. A self-hosted server sets it with a Worker var, named `FAIR_USE_<LIMIT>` (`FAIR_USE_WORKSPACES_MAX`, `FAIR_USE_PROJECTS_PER_WORKSPACE_MAX`, `FAIR_USE_OPEN_TASKS_PER_PROJECT_MAX`, `FAIR_USE_LIVE_KEYS_PER_PROJECT_MAX`, `FAIR_USE_WRITES_PER_DAY_MAX`, `FAIR_USE_STORED_BYTES_MAX`, `FAIR_USE_SIGN_UPS_PER_CLIENT_DAY_MAX`). An unset var keeps the default; a set var that is not a positive whole number stops the Worker with an error instead of falling back. Title and notes sizes stay fixed: they are the text rules the app and the MCP copy both state, so changing them per server would make the copy lie.

### Sizing

The owner's example for writes (20,000 a day) was rejected by arithmetic. Workers Paid includes 10 million Worker requests, 50 million D1 rows written, 1 million Durable Object requests and 50 million Durable Object SQLite rows written a month, with 5 GB-month of Durable Object storage (published allowances at the time of writing; re-check the Cloudflare pricing page before a release). Each task write costs about 2 to 3 Durable Object SQLite rows (the task, its history, its change record) and at most one request.

- At 1,000 task writes a day, one account at the cap writes at most 30,000 tasks a month, about 90,000 rows. A thousand accounts held at the cap for a whole month would write about 90 million rows against 50 million included, and make at most 30 million requests against 10 million included. The overage is a ceiling of roughly $50 a month, a number a single bill can absorb.
- At 20,000 a day the same thousand accounts would write about 1.8 billion rows, twenty times the cap above and an overage in the order of a thousand dollars a month.
- Stored text at 50 MiB for a thousand accounts is 50 GiB at most; over the 5 GB-month included, the overage is about $9 a month.
- A personal to-do list does not approach 1,000 task writes a day: an agent batches up to 50 tasks a call.

Open tasks at 5,000 per project keeps `listTasks`, `nextTask` and the change feed bounded per project, which the performance budgets of [ADR 0061](0061-the-performance-budgets-are-written-and-measured.md) assume.

## Alternatives considered

| Option | Pros | Cons | Why not |
|---|---|---|---|
| The owner's examples as written (20,000 writes a day, 100 projects, 10 KB notes in bytes) | Matches the brief literally | 20,000 writes a day lets a thousand abusers cost about a thousand dollars a month over the plan | The brief asks that the bill stay inside the plan; the write cap is the number that decides it |
| Vary every limit through a per-server config file | One place to change everything | More parsing and more ways to misconfigure; the copy the app shows would drift | Worker vars cover the counts that matter to operators; text rules stay in code |
| Count stored bytes exactly, deletions included | Accurate storage | Needs a per-task byte ledger in the Durable Object and a migration of existing rows | No delete exists yet; the upper bound is honest and cheap ([ADR 0087](0087-daily-writes-and-stored-text-are-counted-in-d1-by-one-conditional-statement-per-write.md)) |

## Consequences

- `libs/types` holds the defaults and the enum of limits; `apps/api` reads the vars once per request through one function.
- Existing titles longer than 500 characters or notes longer than 10 KB do not exist in the directory today beyond the old cap, so no row is rewritten; an edit to an old long note is refused until it fits.
- The MCP and app copy for these limits is generated from the same constants.

## Evidence

- Current values: `libs/types/src/constants.ts`, `libs/types/src/task.ts` (before this change).
- Sizing arithmetic above; the allowances are the published Workers Paid numbers at the time of writing.

## Revisit when

- Cloudflare changes the Workers Paid allowances, or a measured bill differs from the ceiling by more than 2x.
- A delete exists: the stored-text measure then becomes exact by subtraction.
- A user with a legitimate workload reaches 1,000 task writes a day more than once a month.
