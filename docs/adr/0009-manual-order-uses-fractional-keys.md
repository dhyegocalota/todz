# 0009. Manual order uses fractional keys

- Status: Proposed
- Date: 2026-11-23
- Deciders: Claude (the build loop's call, pending the owner); Dhyego Calota (owner) may overturn it
- Inspired by: [the v1 product design](../product/README.md) (a manual order per project, sync that resolves conflicts last write wins per field)

## Context

Every project lists its open tasks in a manual order that the owner and agents change. The app syncs each project from a change feed and resolves conflicts last write wins per field. A move must therefore change one field of one task: if a move rewrote the position of every task below it, two Macs reordering offline would overwrite each other's whole list.

## Decision

1. Each task carries an `orderKey` string. Tasks sort by comparing keys as plain strings, the same in TypeScript, SQLite and Swift.
2. A key follows the published fractional-indexing scheme: a variable-length integer part whose first character encodes its length (`a`-`z` for the positive lengths, `A`-`Z` for the negative), then an optional fraction. Digits are base 62 in ASCII order (`0-9A-Za-z`), and a fraction never ends in `0`, so there is always room between two keys. Appending or prepending grows the integer part, which stays short; splitting a gap grows the fraction.
3. Keys compare byte by byte: SQLite columns that hold them use the default `BINARY` collation, never `NOCASE`.
4. Placing a task first, last, before or after another computes one new key between its two neighbours and writes it to that task alone.
5. A new task is placed after the last key in the project.

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| Fractional keys with an integer head (chosen) | one field of one task per move; plain string order everywhere; appends stay short | keys grow when the same gap is split repeatedly; case-sensitive comparison required | — |
| Fractional keys of base-36 digits only | one alphabet case | every append adds a character about every 35 tasks | a long-lived project grows long keys on the most common move |
| Integer positions, renumbered on each move | readable; tiny | a move rewrites every task after it; offline reorders clash | breaks last write wins per field |
| Integer positions with gaps, renumbered when a gap closes | most moves touch one task | the renumbering moves are the same clash, only rarer | rare data loss is still data loss |
| Floating-point positions | one field per move | precision runs out after about fifty splits of one gap | silent order corruption |

## Consequences

- `libs/core` owns the key generator; no other package computes keys.
- Keys are opaque: no screen or tool shows them.
- A thousand appends or prepends keep keys at most six characters; a thousand splits of one gap add about one character per six splits.

## Evidence

The `task-core` unit tests generate keys between neighbours across a thousand seeded random moves and assert strict order and the no-trailing-zero rule, and bound the length of a thousand appends, prepends and splits of one gap. The scheme is the one David Greenspan described for Figma and that the `fractional-indexing` package implements; it is reimplemented here, not added as a dependency.

## Revisit when

- Key length becomes visible in storage or sync payloads.
- Two keys from different devices can collide, which needs a device suffix.
