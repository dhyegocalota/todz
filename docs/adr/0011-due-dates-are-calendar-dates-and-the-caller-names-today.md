# 0011. Due dates are calendar dates and the caller names today

- Status: Proposed
- Date: 2026-11-23
- Deciders: Claude (the build loop's call, pending the owner); Dhyego Calota (owner) may overturn it
- Inspired by: [the v1 product design](../product/README.md) (an optional due date, the Today and Upcoming views, `list` by due window)

## Context

A task has an optional due date. Today, Upcoming and the `next` tool compare it with the owner's today, which depends on where the owner is. The server does not know the owner's time zone, and a due date stored as an instant would move to another day when the owner travels.

## Decision

1. A due date is a calendar date, `YYYY-MM-DD`, with no time and no zone. It is compared as a string.
2. Every rule that needs today takes it as a `today` calendar date from its caller. The core never reads a clock to find the day.
3. Instants (created, updated, completed, history) are milliseconds since the epoch in server time, from the `Clock` port.

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| Calendar date, today given by the caller (chosen) | the date the owner picked never moves; pure rules | each caller must know the owner's day | — |
| Instant at the start of the day in the owner's zone | one numeric type | the day shifts with the zone; needs the zone at write time | a task due Friday must stay Friday |
| Calendar date, today from the server clock in UTC | callers pass nothing | the owner in São Paulo sees tomorrow's tasks after 21:00 | wrong day for most of the owner's evening |

## Consequences

- The app passes its local date. The MCP server needs the owner's day; `mcp-server` decides where it comes from.

## Evidence

The `task-core` unit tests pin the windows around a fixed `today`, including the last and the first day of a month and of a year.

## Revisit when

- Tasks get a due time, not only a date.
