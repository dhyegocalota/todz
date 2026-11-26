# Remove waitlist

**Status:** In review
**Tier:** 🟡
**Owner approval:** approved 2026-11-26 by the owner's words to the loop ("pode retirar as métricas da waitlist, etc. já não precisamos de código de waitlist nem nada"), inheriting the product scope of [docs/product/README.md](../../product/README.md) approved 2026-11-23
**ADRs:** [0097](../../adr/0097-the-waitlist-is-removed-the-join-route-its-mails-its-admin-list-and-its-table-are-deleted.md), superseding [0050](../../adr/0050-the-waitlist-answers-alike-for-every-address-mails-once-and-is-guarded-like-sign-in.md), [0052](../../adr/0052-the-waitlist-digest-goes-to-the-admin-address-once-a-day-from-a-cron.md) and [0067](../../adr/0067-the-waitlist-joins-in-place-over-fetch-behind-a-visible-check-a-honeypot-and-a-signed-render-time.md)
**Not changing:** the admin sign-in, its session and its metrics with their CSV export, the sign-in Turnstile guard, the day email and its cron, the landing, the `fair-use` lane's admin additions

## Problem

[`waitlist-off`](../waitlist-off/spec.md) closed the waitlist but kept its code: the `/join` route answering 410, three limiter bindings, a Turnstile action, two mails and their templates, the admin list with its CSV export and failed confirmations, a daily join cap and the `waitlist` table. todz is live and the owner wants none of it.

## Goals

- `/join` answers 404 for every method, like any unknown path.
- The waitlist mails, templates, copy, limiter bindings, Turnstile action, constants and join cap are deleted.
- The admin has no waitlist list, no `export.csv` and no failed confirmations; `GET /admin` sends a signed-in owner to the metrics, which keep working with their CSV export.
- A migration drops the `waitlist` table and its index, after the deploy runbook exports the rows once to a local file outside the repository.
- The docs, the runbooks' live steps, the tests and the current state of the ADRs describe a product without a waitlist; history rows stay.

## Non-goals

- Building the admin's "Top usage" and suspend (`fair-use`).
- Rewriting the feature folders, the learnings, the superseded ADRs or the run-log rows.
- Touching production: the loop's deploy runs the export and the migration.

## Design

### Data flow

`/join` has no route, so the site dispatcher answers 404. `GET /admin` with a session answers 303 to `/admin/metrics`; without one it answers the sign-in card as before. Migration `0013_drop_waitlist.sql` drops the index and the table. The deploy runbook's step 6 writes `SELECT address, joined_at, confirmation_claimed_at, confirmation_failed_at FROM waitlist` as JSON to `~/Projects/todz/todz-loop/notes/waitlist-export-2026-11-26.json` before step 7 applies the migration.

### Interfaces

Removed: `POST /join`, `GET /join`, `GET /admin/export.csv`, `TurnstileAction.Waitlist`, the `WAITLIST_*` limiter bindings and the shared `WAITLIST_*` constants, the email slots only the digest used. Changed: `AdminNotice` moves to `admin-notice.ts`; `adminRedirectAnswerOf` takes an optional `location`. The remaining limiters take namespaces `8604` to `8615` so the range stays contiguous ([ADR 0097](../../adr/0097-the-waitlist-is-removed-the-join-route-its-mails-its-admin-list-and-its-table-are-deleted.md) §5).

### Failure handling

An export that does not match its count stops the deploy before the migration. A rollback past `waitlist-off` fails on the missing table; the runbook says never to go there. The table comes back only through the Time Travel bookmark of the deploy run.

## Open questions → answers

| Question | Options | Owner's answer | Date |
|----------|---------|----------------|------|
| Keep the 410 on `/join`? | 410 or 404 | The loop's call: 404 ("it just 404s") | 2026-11-26 |
| Where does the admin land? | metrics at `/admin` or a redirect | The loop's call: a redirect to `/admin/metrics` | 2026-11-26 |
| The migration number | `0012` or `0013` | The loop's call: `0013`, because `fair-use` holds `0012` | 2026-11-26 |

## Test strategy summary

Red-first: the join route answers 404, the admin has no export and redirects to the metrics, migration 0013 leaves no waitlist table or index, the wrangler configuration holds no waitlist limiter, no current source, script, end-to-end test, doc or constant names the waitlist, and no test touches the dropped table. The cron dispatch, the metrics and the admin sign-in tests keep passing.
