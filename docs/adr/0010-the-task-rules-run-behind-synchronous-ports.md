# 0010. The task rules run behind synchronous ports

- Status: Proposed
- Date: 2026-11-23
- Deciders: Claude (the build loop's call, pending the owner); Dhyego Calota (owner) may overturn it
- Inspired by: [the v1 product design](../product/README.md) (rules in `libs/core` behind ports, one Durable Object with its own SQLite per project)

## Context

The task rules (titles, short ids, order, history, the next task, filters) live in `libs/core` so the MCP server and the owner API apply the same ones. Their storage is the project's Durable Object SQLite database, whose query API is synchronous, and whose synchronous transaction is the simplest way to make a batch add or a batch completion all or nothing.

## Decision

1. `libs/core` declares a `TaskStore` port and a `Clock` port. Their methods are synchronous.
2. Each use case takes its ports and its input as one named object, validates the whole input before it writes anything, and throws a typed error on a rule violation or a missing task.
3. The caller wraps a use case in its storage transaction. The core never opens one.
4. The core filters and sorts in memory the tasks the store returns for a state of one project. A list and the next task read one state; an add and a move read both, because order keys are unique across states (ADR 0009).

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| Synchronous ports (chosen) | runs inside the Durable Object's synchronous transaction; no awaits in the rules | an asynchronous store would need an adapter | the only task store in v1 is synchronous |
| Asynchronous ports | fits any store | a batch can interleave with another request between awaits unless the caller adds locking | atomicity is the point |
| No ports: the rules written as SQL in the Worker | fewer layers | rules untestable without the runtime; the owner API and the MCP server would copy them | one source of rules is the point |

## Consequences

- Tests use an in-memory store; the Durable Object adapter arrives with `project-store`.
- In-memory filtering reads every task of one state on each list, and every task of the project on each add and move; with no delete, done tasks only accumulate. That is fine for a project of a few thousand tasks, and a store method for the neighbouring keys replaces the full read when it is not.

## Evidence

The `task-core` unit tests run every use case against the in-memory store, including the batch that fails on its last item and writes nothing.

## Revisit when

- A store that is not synchronous is added.
- One project holds more than ten thousand tasks and a list, an add or a move is measurably slow.
