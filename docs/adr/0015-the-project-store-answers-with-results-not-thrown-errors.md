# 0015. The project store answers with results, not thrown errors

- Status: Proposed
- Date: 2026-11-23
- Deciders: Claude (the build loop's call, pending the owner); Dhyego Calota (owner) may overturn it
- Inspired by: the `project-store` spike of 2026-11-23, [ADR 0010](0010-the-task-rules-run-behind-synchronous-ports.md)

## Context

The task rules throw `RuleViolation` and `TaskNotFoundError` (ADR 0010). The Worker calls the project's Durable Object over RPC. An error thrown across that boundary loses its class and its fields, and the runtime logs it as an uncaught exception, so the caller could only tell a rule violation from a broken database by parsing a message.

## Decision

1. Each RPC method of the project's Durable Object runs one use case inside `transactionSync` and returns `{ ok: true, value }` or `{ ok: false, failure }`.
2. A failure is `{ kind: TaskNotFound, number }` or `{ kind: RuleViolated, issue, index }`, built from the core's errors, and the transaction has rolled back.
3. Anything else, a SQL error or a bug, is thrown: the transaction rolls back and the caller answers with a server error.

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| Result values over RPC (chosen) | typed failures, no log noise for expected outcomes | every caller checks `ok` | the check is what the callers need anyway |
| Throw and map by message on the caller | no wrapper type | stringly typed; a message change breaks callers; expected failures logged as crashes | fragile |
| A `fetch` interface with JSON bodies and status codes | familiar | a second serialisation layer inside one Worker; loses the types | RPC already carries plain values |

## Consequences

- The MCP server and the owner API map failures to their own words; a missing task and a task of another project carry the same failure.

## Evidence

The spike: a custom error thrown inside a Durable Object reached the caller without its class and printed an uncaught-exception stack.

## Revisit when

- Workers RPC preserves custom error classes and fields.
