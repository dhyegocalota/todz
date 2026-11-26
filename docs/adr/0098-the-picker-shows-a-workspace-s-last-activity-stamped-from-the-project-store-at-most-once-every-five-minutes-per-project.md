# 0098. The picker shows a workspace's last activity, stamped from the project store at most once every five minutes per project

- Status: Accepted
- Date: 2026-11-26
- Deciders: Dhyego Calota (owner); Claude (advisor, the loop's call under the v1.1 list)
- Inspired by: [0076](0076-an-account-with-several-workspaces-and-no-remembered-choice-opens-a-picker-of-names-and-project-counts.md) decision 6 and its "Revisit when"; `todz-loop/PROMPT.md` v1.1 list

## Context

[0076](0076-an-account-with-several-workspaces-and-no-remembered-choice-opens-a-picker-of-names-and-project-counts.md) shipped the picker with name and project count and named last activity a follow-up, rejecting the throttled directory write while the performance lane was open. That lane has closed, and the owner wants the line the picker was specified with.

## Decision

1. Decisions 1 to 5 of 0076 stand. Decision 6 is replaced by this record.
2. `workspaces.last_activity_at` (nullable, epoch milliseconds, migration `0013_workspace_last_activity.sql`) holds the last time a task write moved a project store's change number in that workspace. A workspace nobody wrote to holds `null`.
3. The project store stamps it after a write that moved its change number, through `ctx.waitUntil`, so the write never waits on D1 and a failed stamp never fails the task write.
4. The stamp is throttled per project store instance: at most one directory write every `WORKSPACE_ACTIVITY_WRITE_INTERVAL_MS` (five minutes, `libs/types`). The time of the last stamp lives in the store's own storage, a local write, so eviction does not reset the throttle; a failed stamp clears it so the next write retries. A store opened without its project name refuses the write before it commits. The stamp only moves forward.
5. The owner API lists `last_activity_at` on every workspace, `null` when there is none. A new workspace answers `null`.
6. The picker and the Settings workspace list share one row view. The row shows the name, the project count and, when there is a stamp, a short relative line ("Active 5 minutes ago", "Active yesterday"). Without a stamp the row shows no activity line.
7. The Mac app decodes the field as optional, so a cache or a server written before this change still reads.

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| Stamp on every write | Exact | One D1 write per task write, on the hot path | The throttle costs at most five minutes of precision |
| A shared throttle in D1 (`WHERE last_activity_at < ?`) | Survives eviction | The statement still runs on every write | The throttle must avoid the statement, not filter it |
| Fan out to the project stores on listing | No migration | Unbounded reads per list call | Rejected in 0076 |
| Show "never" for a workspace without a stamp | Explicit | A fresh workspace reads as abandoned | No line is calmer |

## Consequences

- A migration and a deploy: the column lands before the Worker that writes it, and an old app ignores the new field.
- A workspace with tasks written before the deploy shows no activity line until its next write.
- One extra D1 statement per project per five minutes of writing. It runs inside the Durable Object, so the Worker-side statement counters and budgets do not see it.
- `scripts/deploy-worker.sh` refuses to deploy while the remote directory has pending migrations, so the Worker never runs ahead of the column.

## Evidence

- `apps/api/test/workspace-activity.test.ts`: the throttle decision, the stamp after a write, no stamp after a read, a second stamp after the interval.
- `apps/api/test/owner-workspaces.test.ts`: the field on a created workspace.

## Revisit when

The directory write shows up in the task write budget, or the owner wants the activity of a single project.
