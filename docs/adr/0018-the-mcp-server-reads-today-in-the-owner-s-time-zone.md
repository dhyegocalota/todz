# 0018. The MCP server reads today in the owner's time zone

- Status: Proposed
- Date: 2026-11-23
- Deciders: Claude (the build loop's call, pending the owner); Dhyego Calota (owner) may overturn it
- Inspired by: [ADR 0011](0011-due-dates-are-calendar-dates-and-the-caller-names-today.md) (the caller names today; `mcp-server` decides where the MCP server's today comes from)

## Context

`next` and `list` compare due dates with today. The app passes its local date, but an MCP client sends no date and no zone. The owner works in São Paulo, where UTC is already tomorrow after 21:00.

## Decision

1. Every owner has an IANA time zone, `owners.time_zone TEXT NOT NULL`. `owner-api` writes it from the app at sign-in and whenever the app reports a new one.
2. The key lookup returns the key's project and its owner's time zone in one query. The MCP server computes today as the calendar date of the request's instant in that zone, with `Intl.DateTimeFormat`.
3. The column is added to `0001_directory.sql` itself: no database outside a test has ever applied it, and a `NOT NULL` column cannot be added later without a default. From the first deploy on, every schema change is a new migration.

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| The owner's zone in the directory (chosen) | right for every client; the agent passes nothing | the app must keep it current | — |
| A `today` argument on `list` and `next` | no stored zone | each agent must know the owner's date; a wrong one silently returns the wrong tasks; more to type on every call | correctness would depend on the agent |
| A zone stored per key | set once by the connect screen | goes stale when the owner moves, key by key | the zone belongs to the owner |
| UTC | nothing to store | the wrong day for the owner's evening | ADR 0011 already rejected it |

## Consequences

- A local `.wrangler` directory created before this change must be deleted once, because Wrangler records `0001` as applied.
- Until `owner-api` exists, tests seed the zone.

## Evidence

The `mcp-server` tests pin the zone conversion at 2026-11-24T01:30Z: `America/Sao_Paulo` gives `2026-11-23`, `UTC` gives `2026-11-24`.

## Revisit when

- The owner wants a zone per workspace.
- Tasks get a due time.
