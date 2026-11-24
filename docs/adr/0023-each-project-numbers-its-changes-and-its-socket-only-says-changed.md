# 0023. Each project numbers its changes, and its socket only says "changed"

- Status: Proposed
- Date: 2026-11-23
- Deciders: Claude (the build loop's call, pending the owner); Dhyego Calota (owner) may overturn it
- Inspired by: [the v1 product design](../product/README.md) (Sync: the app pulls each project's changes from a cursor; while the app is open, a WebSocket from the project's Durable Object only says "changed"; last write wins per field by server time), [ADR 0010](0010-the-task-rules-run-behind-synchronous-ports.md)

## Context

The app keeps a local cache and must learn what changed in a project since its last pull, whether the change came from itself, another Mac or an agent. v1 never deletes a task, so every change is an insert or an update of a task row. Clocks of different Macs disagree; the project's Durable Object is the one writer of its tasks.

## Decision

1. Project schema version 2 adds `tasks.change_number` and a `change_counter`. The SQLite adapter gives every inserted or replaced task row the next number, inside the use case's transaction, so a number is never seen before its write commits.
2. `GET /owner/projects/<id>/changes?cursor=<n>` answers the tasks whose `change_number` is greater than `n`, in that order, at most `CHANGE_PAGE_SIZE` (100), with the new `cursor` (the last number returned, or `n` when nothing changed) and `has_more`. A cursor of `0` is the whole project. The cursor is an integer the app stores per project; a task appears once per page, in its latest state.
3. `GET /owner/projects/<id>/socket` with `Upgrade: websocket` is accepted by the project's Durable Object through the hibernation API. After a write that moved the project's change counter, from the owner or an agent, the object sends the text `changed` to every socket of that project. The socket carries nothing else and ignores what the app sends.
4. Conflicts resolve last write wins per field by arrival at the Durable Object: the app sends only the fields the owner changed, and the object applies writes one at a time.

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| A change number per task row (chosen) | one indexed column; no log to compact; a page is always latest state | no tombstones, so a future delete needs one | v1 has no delete |
| A change log table of every write | replays each step | grows forever; the app only needs latest state | compaction for no benefit |
| `updated_at` as the cursor | no new column | two writes in one millisecond share a cursor and one can be skipped | loses changes |
| Push the changed tasks over the socket | one round trip | a second data path that must match the feed, and task text on a long-lived channel | the design says the socket only says "changed" |

## Consequences

- Reading a project's history is a separate route; the feed carries task rows only.
- A later delete adds a tombstone row with its own change number, without changing the cursor's meaning.

## Evidence

The spike of 2026-11-23 accepted a hibernated socket in the Durable Object under the Vitest pool and received `changed` after an RPC call. The `owner-api` tests pin paging, the empty page, an agent's write moving the cursor, and the socket message after owner and MCP writes.

## Revisit when

- Tasks can be deleted.
- A project grows past a few thousand tasks and the first pull is slow.
