# 0108. A move deletes its source only if unchanged, and owner keys share one budget and count as writes

- Status: Accepted
- Date: 2026-11-26
- Deciders: Dhyego Calota (owner); Claude (advisor, the loop's call under the owner's instruction to decide every call)
- Inspired by: [0101](0101-an-owner-key-is-a-separate-off-by-default-scope-for-the-account-and-project-keys-never-gain-account-powers.md), [0102](0102-deleting-a-task-leaves-a-scrubbed-tombstone-for-sync-and-a-move-adds-to-the-destination-before-it-deletes-the-source.md)

## Decision

A move deletes its source in the same transaction that compares it with the task it read (title, notes, due date, state, order and change time); an edit in between fails the move with a retryable `task_changed` answer, the destination copy is deleted and a retry carries the edit. After the add, the move asks the directory whether the destination project still exists; if not, it wipes the orphaned storage and fails with `destination_gone`. A move cleans up the destination copy only for that edit, never when the source is simply gone (a parallel move won), and only if the copy is itself unchanged. Owner key issue reserves one write like every other write, after the five-key limit is checked; revoke never does, because revoking a credential must not be blockable by an exhausted budget. A rename or create against an id of another owner answers not found before it spends one, and the MCP limiter of an owner key is keyed by the owner, so five keys share one budget. The activity counts skip tombstones.

## Consequences

- A project key gains no power: the new checks only refuse more.
- A deleted task still records no actor of its own; its tombstone is scrubbed (ADR 0102).
