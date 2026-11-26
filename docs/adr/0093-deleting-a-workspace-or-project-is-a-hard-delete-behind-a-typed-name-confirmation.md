# 0093. Deleting a workspace or project is a hard delete behind a typed-name confirmation

- Status: Accepted
- Date: 2026-11-26
- Deciders: Dhyego Calota (owner); Claude (advisor). The loop's call under the owner's standing instruction to decide every call.
- Inspired by: the owner's question "como eu posso deletar um workspace?", [ADR 0029](0029-the-app-pulls-each-project-from-its-cursor-when-its-socket-says-changed.md), [ADR 0019](0019-mcp-keys-are-prefixed-and-shown-once.md)

## Context

Owners can create and rename workspaces and projects, but cannot remove them. Removing one must revoke every MCP key of its projects at once and wipe each project's Durable Object storage, and the other Macs must drop the cache.

## Decision

`DELETE /owner/workspaces/:id` and `DELETE /owner/projects/:id` delete permanently. The D1 rows and the project keys with their MCP sessions go in one batch, so a key answers 401 as soon as the batch lands. The project storage is then wiped and each socket is told `changed` and closed, so the other Macs re-pull and receive 404, which reloads the workspace list. The Inbox cannot be deleted. The apps confirm by typing the name of the workspace or project; the destructive button enables only when the typed text equals that name exactly, after the same trimming the server applies to names. Deleting the last workspace leaves the owner with none, and the app then offers to create one.

No soft delete, no restore window and no migration. Because nothing is kept as a live-looking row, fair-use's workspace count needs no exclusion.

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| Soft delete with a 7-day restore | Undo for a mistake | A restore route, a purge cron, a deleted-row filter in every listing and in fair-use's count, and keys that must stay revoked while storage waits | Too much surface for a single-owner to-do app; the typed-name confirmation is the guard |
| Hard delete, typed-name confirmation (chosen) | One batch, immediate revocation, no new schema | No undo | Accepted: the owner asked for simple |
| Hard delete with no confirmation | Smallest code | One misclick loses a project | Rejected: destructive, needs the typed name |

## Consequences

- Owner-scoped queries join `workspaces.owner_id` in every statement of the batch, so a foreign id deletes nothing and answers the same 404 an absent id answers.
- The ids to wipe come from `RETURNING` on the batch itself, so exactly the projects whose rows went are wiped, including one created while the request ran.
- The batch has committed when a wipe runs, so a wipe that throws does not fail the request: the answer stays 204, because the directory rows are gone and a 500 would tell the Mac the change was not saved. The residue is Durable Object storage nobody can reach, since routing starts from the directory; nothing retries it and no cron sweeps it.
- Other Macs learn through the existing `changed` signal and the existing 404 reload; no new wire message.

## Accepted risk

A stolen owner session can erase every workspace and project in one request sequence, and no later step restores them. The typed-name confirmation guards the app against a slip, not against an attacker holding the session. Accepted for a single-owner to-do app; soft delete is the revisit.

## Evidence

- `apps/api/test/owner-delete.test.ts` (19 tests): 204, keys answer 401 right after, storage tables gone, 204 when a wipe throws, Inbox 409, another owner answers the same as an absent id.

## Revisit when

- Users ask to undo a deletion, or the typed-name confirmation proves insufficient. Then a soft delete supersedes this one and fair-use's count must exclude deleted rows.
