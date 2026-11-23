# 0009. Manual order uses fractional keys

- Status: Proposed
- Date: 2026-11-23
- Deciders: Claude (the build loop's call, pending the owner); Dhyego Calota (owner) may overturn it
- Inspired by: [the v1 product design](../product/README.md) (a manual order per project, sync that resolves conflicts last write wins per field)

## Context

Every project lists its open tasks in a manual order that the owner and agents change. The app syncs each project from a change feed and resolves conflicts last write wins per field. A move must therefore change one field of one task: if a move rewrote the position of every task below it, two Macs reordering offline would overwrite each other's whole list.

## Decision

1. Each task carries an `orderKey` string. Tasks sort by comparing keys as plain strings, the same in TypeScript, SQLite and Swift.
2. A key is made of base-36 digits (`0-9a-z`) and never ends in `0`, so there is always room between two keys.
3. Placing a task first, last, before or after another computes one new key between its two neighbours and writes it to that task alone.
4. A new task is placed after the last key in the project.

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| Fractional string keys (chosen) | one field of one task per move; plain string order everywhere | keys grow by a digit when the same gap is split repeatedly | — |
| Integer positions, renumbered on each move | readable; tiny | a move rewrites every task after it; offline reorders clash | breaks last write wins per field |
| Integer positions with gaps, renumbered when a gap closes | most moves touch one task | the renumbering moves are the same clash, only rarer | rare data loss is still data loss |
| Floating-point positions | one field per move | precision runs out after about fifty splits of one gap | silent order corruption |

## Consequences

- `libs/core` owns the key generator; no other package computes keys.
- Keys are opaque: no screen or tool shows them.
- Keys grow only when the same gap is split again and again; a thousand inserts at the top of one list stay short, and a thousand splits of one gap add about one digit per five splits.

## Evidence

The `task-core` unit tests generate keys between neighbours across a thousand seeded random moves and assert strict order and the no-trailing-zero rule.

## Revisit when

- Key length becomes visible in storage or sync payloads.
- Two keys from different devices can collide, which needs a device suffix.
