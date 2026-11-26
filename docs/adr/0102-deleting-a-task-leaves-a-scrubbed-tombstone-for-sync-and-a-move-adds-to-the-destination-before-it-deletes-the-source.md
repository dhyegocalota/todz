# 0102. Deleting a task leaves a scrubbed tombstone for sync, and a move adds to the destination before it deletes the source

- Status: Accepted
- Date: 2026-11-26
- Deciders: Dhyego Calota (owner); Claude (advisor). The loop's call under the owner's standing instruction to decide every call.
- Inspired by: [ADR 0101](0101-an-owner-key-is-a-separate-off-by-default-scope-for-the-account-and-project-keys-never-gain-account-powers.md), [ADR 0029](0029-the-app-pulls-each-project-from-its-cursor-when-its-socket-says-changed.md), [ADR 0010](0010-the-task-rules-run-behind-synchronous-ports.md)

## Context

An agent must be able to delete a task and move one to another project of the workspace. Until now a task could only be completed: the project store has no delete, the history table references the task row, and the Macs learn about changes by pulling the rows whose change number is above their cursor, so a row that vanishes is never learned about.

## Decision

1. **A delete is a tombstone.** Project store schema version 4 adds `tasks.deleted_at`. Deleting keeps the row and its number, blanks the title, notes, due date and idempotency key, empties the completion notes of its history, and gives the row the next change number. The number is never issued again. Every read (find, lists, the next task, the order keys of a placement) skips a row with `deleted_at`.
2. **Sync learns by a list.** The change feed returns the tasks changed and, beside them, `deleted_numbers`: the numbers of tombstones since the cursor, so a Mac drops them. No shipped Mac (0.2.3 and older) reads the field, and a Mac pulls from cursor 0 only after a refused outbox change or a `cursor_ahead`, which is practically never. So on every Mac up to 0.2.3 a task deleted or moved over MCP stays visible, with its title and notes, in the window, the widgets and the project cache, and a moved task shows in both projects, until the app lane ships the reader. The tools ship first on purpose: the loop's call is to accept those ghosts and duplicates for the owner's Macs, and the delete and move tool descriptions tell the agent that the owner's Mac shows the change after its next update. The 0.2.4 app reads `deleted_numbers`, and the same release raises `MINIMUM_APP_VERSION` so an older app is refused instead of drifting (spec: the contract). The server does not fake a `cursor_ahead` to force a pull from 0: the app only catches it on the first page of a chain and a later page ends the session.
3. **The check is inside the transaction.** `deleteTask` compares the confirmation with the title it just read, in the same synchronous transaction that removes it, so a rename between the read and the delete cannot slip a delete past a stale confirmation.
4. **A move is add, then delete.** The Worker reads the task from the source project, adds a task with the same title, notes and due date to the destination under the idempotency key `move:<source project>:<number>`, completes it there when the source one was done, then deletes the source. The two Durable Objects have no shared transaction, so the order makes a failure leave a visible copy and never a loss, and a retry replays the add (same key), finds the task done already and finishes the delete. The task gets a new number in the destination and the completion note and time of a done task are not carried over.
5. **No history of the delete.** The tombstone carries no text and the row has no history line of its own; the destination's history starts with a created line by the agent that moved it, carrying the note "Moved from <source project>", which `history` and `show` print. The idempotency keys that start with `move:` are reserved: an add with one is refused, and a move whose replayed arrival has another title or notes than the source is refused too.

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| Hard delete of the row and its history | Nothing remains | The history table references the row; a Mac never learns of it, so the task stays on the screen of every Mac forever | Breaks sync |
| A new task state `deleted` | Fits the change feed as it is | The app decodes the state as a closed enum: an old Mac fails to decode a project | Breaks the existing app |
| Soft delete with a restore window | Undo | A restore tool, a purge, a filter in every reader and a clause in the fair-use count, for one confirmation guard | Same call as ADR 0093 |
| A move as a copy that leaves the source | No second step | Not a move | It is the interim state of the chosen design, not a result |
| A move that deletes the source first | No duplicate on failure | A failure between the steps loses the task | Loss is worse than a duplicate |

## Consequences

- A project store migrates from version 3 to 4 with one `ALTER TABLE`, run once per Durable Object on its next wake; the column is null for every existing row.
- `readChanges` returns `deletedNumbers` and the owner API `deleted_numbers`; the existing tests and the app ignore an unknown key.
- Deleted tombstones are never purged: a project's table grows by one scrubbed row per delete, which a project's open-task cap and its owner's quota bound in practice.

## Evidence

- `apps/api/test/project-task-removal.test.ts` (scrub, feed, number, idempotency key), `apps/api/test/project-schema.test.ts` (version 4), `apps/api/test/mcp-project-tools.test.ts` (the tools).

## Revisit when

- The app offers a delete with an undo, a project holds thousands of tombstones, or the two Durable Objects can share a transaction.
