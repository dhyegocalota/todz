# 0097. The waitlist is removed: the join route, its mails, its admin list and its table are deleted

- Status: Accepted (the build loop's call where it decides below, the owner may overturn it); supersedes [0050](0050-the-waitlist-answers-alike-for-every-address-mails-once-and-is-guarded-like-sign-in.md), [0052](0052-the-waitlist-digest-goes-to-the-admin-address-once-a-day-from-a-cron.md) and [0067](0067-the-waitlist-joins-in-place-over-fetch-behind-a-visible-check-a-honeypot-and-a-signed-render-time.md); amends [0049](0049-todz-app-is-served-by-the-same-worker-dispatched-by-host-in-three-features.md), [0051](0051-the-admin-signs-in-by-a-mail-link-bound-to-the-browser-that-asked-into-a-cookie-session.md) §7, [0060](0060-the-landing-describes-itself-from-the-copy-modules-and-offers-webmcp-tools-over-its-own-turnstile-form.md) §5, [0061](0061-performance-has-written-budgets-a-fetch-based-load-harness-behind-pnpm-perf-and-work-count-budgets-in-verify.md) and [0073](0073-signed-in-writes-have-quotas-and-signed-in-routes-a-rate-limit-per-owner-and-per-key.md)
- Date: 2026-11-26
- Deciders: Dhyego Calota (owner), who told the loop on 2026-11-26 "pode retirar as métricas da waitlist, etc. já não precisamos de código de waitlist nem nada"; Claude (the build loop's call for the details marked below)
- Inspired by: the `waitlist-off` feature, which closed the waitlist and left its code, table and admin list in place

## Context

todz is live. `waitlist-off` made `POST /join` answer 410 and removed the form, the Turnstile widget and the digest cron, but kept the rest: the route, three limiter bindings, the Turnstile action, the confirmation mail and its template, the digest mail, the admin list with its CSV export and its failed confirmations, the `waitlist` table and a daily join cap. None of it serves a visitor any more, and the owner asked for none of it to stay.

## Decision

1. **The code goes.** The join route, its closed answer, the waitlist store, the Turnstile action `waitlist`, the confirmation and digest mails with their templates and copy, the three `WAITLIST_*` limiter bindings and constants, the join cap `WAITLIST_DAILY_JOINS_MAX`, the admin list, `GET /admin/export.csv`, the failed confirmations and every waitlist figure of the admin are deleted. The admin keeps its sign-in, its session, its metrics and their CSV export.
2. **The join path is 404.** (The loop's call.) With no route, `/join` answers like any unknown path: 404 with no body, for every method. A 410 would keep a route and a handler alive for a path nobody links to.
3. **`GET /admin` sends a signed-in owner to the metrics.** (The loop's call.) The panel was the waitlist; the metrics page is what the admin is now, so the panel path answers 303 to `/admin/metrics` and a visitor without a session still gets the sign-in card. Other admin routes keep their paths.
4. **A migration drops the table, after a one-time export.** (The loop's call.) `0013_drop_waitlist.sql` drops the `waitlist` table and its index. The deploy runbook exports the rows to a local file in the loop's notes, outside the repository and never committed, before the migration is applied, and records the path and the row count. A migration can only move forward, so the export is the only way back, besides the Time Travel bookmark taken in the same runbook. The number `0013` leaves `0012` to `fair-use`.
5. **The limiter namespaces stay contiguous.** (The loop's call.) Removing `8604` to `8606` would leave a hole in `8601` to `8618` that the self-host guide and its shape test forbid, so the remaining limiters take `8604` to `8615`. A rate limit namespace holds only per-minute counters, so the renumbering loses nothing but the current window.
6. **The records stay.** The superseded ADRs, the feature folders, the learnings and the run-log rows of the runbooks are history and are not rewritten; the live steps of the runbooks, the docs, the tests and the self-host guide describe the product without a waitlist.

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| Keep the 410 on `/join` | A person following an old link learns where to download | A route, a handler and a copy string for a dead path | The owner asked for no waitlist code; the landing links the download already |
| Keep the table and delete only the code | No migration, no export | A table nothing reads or writes holds addresses of people who never agreed to keep them stored | A schema that outlives its feature, and stored personal data |
| Drop the table with no export | Simplest | The addresses are gone for good, in case the owner wants to mail them once | The export costs one command and the owner can delete the file |
| Leave the namespace ids with a gap | No limiter changes | The self-host guide and its test name one contiguous range | Fork owners would read a gap as a mistake |
| Make the admin panel the metrics page at `/admin` | One fewer redirect | Moves the metrics paths a sibling lane builds on | The redirect leaves every other admin path where it is |

## Consequences

- The Worker has fifteen limiter bindings; the self-host guide says so.
- `GET /join`, `POST /join` and `GET /admin/export.csv` answer 404; `GET /admin` redirects a signed-in owner to the metrics.
- A rollback to a version older than `waitlist-off` fails on the missing table; the deploy runbook says never to go past `waitlist-off`.
- The exported file holds addresses and lives only in the loop's notes; deleting it is the owner's call.

## Evidence

`apps/api/test/waitlist-removed.test.ts`, `tools/repository-shape/src/waitlist-removed.test.ts`, `apps/api/test/scheduled.test.ts`, `tools/repository-shape/src/api-source.test.ts`.

## Revisit when

The owner wants a way to tell people about a future launch: a mailing list belongs in a mail service, not in the Worker's database.
