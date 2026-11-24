# 0028. The app's task writes are optimistic and go through a persisted outbox

- Status: Proposed
- Date: 2026-11-24
- Deciders: Claude (the build loop's call, pending the owner); Dhyego Calota (owner) may overturn it
- Inspired by: [the v1 product design](../product/README.md) (macOS app → Sync: "queues writes while offline", "last write wins, per field, by server time"), `docs/features/mac-app-shell/design.md` § 7 (O4: the shell waits for the server; `mac-sync` brings optimism), [ADR 0027](0027-the-app-caches-each-owner-s-data-as-json-files-in-its-own-container-until-it-has-a-team.md)

## Context

In the shell every task write waits for the server, and an unreachable server ends in a banner with "Try again". The product design asks the app to queue writes while offline and to resolve conflicts last write wins, per field, by server time. The owner API already takes one field per `PATCH`, adds with an idempotency key that replays the first task, and completes or reopens idempotently (`already_done`, `already_open`).

## Decision

1. Every task write the owner makes (add, complete, reopen, title, notes, due date, order) becomes a pending change appended to the outbox, which is written to `outbox.json` (ADR 0027) before the screen shows it.
2. The screen shows the server's records with the outbox applied on top, field by field. A pending add shows as a pending row: it has no task number until the server answers, so it cannot be opened, completed or edited until then.
3. A change for a task and field that is already waiting, and not yet sent, replaces the waiting one in place. Complete and reopen are the same field.
4. The outbox is sent one change at a time, oldest first, while the server is reachable:
   - an answer removes the change and replaces the task with the server's record;
   - unreachable stops sending and keeps the change; sending resumes when a project socket opens (ADR 0029), on ⌘R and at launch;
   - a refusal (`rule_violated`, `task_not_found`, `not_found`, `invalid_request`) drops the change, pulls its project from cursor 0 so the screen shows the server's truth, and tells the owner once;
   - an unexpected server answer keeps the change; after three attempts on the same change it is dropped as a refusal, so one change cannot block the outbox forever;
   - a 401 stops sending and keeps the outbox for the same owner (ADR 0027).
5. An add keeps its idempotency key in the outbox, so a resend after a lost answer or a relaunch returns the first task and never duplicates it.
6. "By server time" means the order in which the server applies the writes. A change made offline and sent later overwrites what an agent wrote meanwhile to the same field; other fields of the task are untouched, because each change carries one field.
7. Workspace and project creation, project renames and sign-in still wait for the server, as in the shell.

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| Optimistic writes through a persisted, ordered outbox (chosen) | works offline and across relaunches; one field per change keeps the product's per-field rule; idempotent adds never duplicate | pending adds have no number; a refused change rolls the screen back | the product asks for an offline queue |
| Optimistic writes kept in memory only | simpler | a quit or crash while offline loses the changes | the queue must survive the gap it exists for |
| Keep waiting for the server (the shell) | never shows a refused state | nothing works offline | contradicts the product design |
| Client-side merge with timestamps from the Mac (or a CRDT) | an offline edit loses to a newer agent edit | Mac clocks drift; the server would need vector clocks; the product says server time | heavier than the product's rule |
| Local task numbers for pending adds | pending adds editable at once | numbers are the server's per project; a remap touches every reference | the window can wait one round trip |

## Consequences

- Checking, editing and reordering feel instant online and work offline.
- A stale offline edit can overwrite an agent's newer value on that field; this is the product's rule, stated in the spec.
- The overlay and the outbox are new state in `AppModel`; the shell's per-write "Try again" banner goes away for task writes.

## Evidence

The owner API contract (`docs/features/owner-api/spec.md`): one field per `PATCH`, `replayed: true` on an add with a known idempotency key, `already_done` and `already_open` on repeats.

## Revisit when

- The owner wants a different conflict rule, or pending adds that can be edited.
- Deletes arrive (a change for a deleted task must be dropped without a banner).
