# 0013. A project is reached only through the directory

- Status: Proposed
- Date: 2026-11-23
- Deciders: Claude (the build loop's call, pending the owner); Dhyego Calota (owner) may overturn it
- Inspired by: [the v1 product design](../product/README.md) (Isolation: the Worker resolves the project from the credential, once; one Durable Object with its own SQLite per project)

## Context

Every task lives in its project's Durable Object. Whatever names a Durable Object decides which tasks a request can touch, so that name must never come from a request.

## Decision

1. A project's Durable Object is addressed with `idFromName` of the project's directory id, a random UUID the directory issues.
2. Only the routing module turns a project id into a stub, and it does so only with an id the directory has just returned for the credential: the project of an unrevoked MCP key, or a project of the workspace owner a live session names.
3. A credential that resolves to nothing, a revoked key, an expired session and another owner's project all end the same way: no stub. The caller answers "not found" for all of them.
4. The Durable Object knows only its own tables. Task numbers, idempotency keys and order keys are unique per project, never across projects.

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| `idFromName(projectId)` behind the directory (chosen) | deterministic, no extra column, testable by name | a code path that skipped the directory could open any project by id | the routing module is the only caller, and the isolation suite attacks it |
| `newUniqueId()` stored in the directory | an id cannot be derived from the project id | one more column and a lookup to keep in step; the directory check is still what grants access | the grant, not the id's shape, is the boundary |
| One Durable Object per workspace | fewer objects | tasks of two projects in one database, one query away from each other | the product names the project as the isolation unit |

## Consequences

- An id that never existed reaches a fresh, empty Durable Object only through a bug in the routing module; the isolation suite checks that every refusal yields no stub before any Durable Object is touched.
- Renaming or moving a project between workspaces never moves its tasks.

## Evidence

The `project-store` isolation suite: a key for project A, and an owner without project A, never read, change, complete, reopen, search or guess a task of project A, and every refusal equals the answer for an id that never existed.

## Revisit when

- A project can be shared with a second owner.
- Durable Objects must be placed in a jurisdiction, which `idFromName` alone does not choose.
