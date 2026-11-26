# Cloud capacity: tester briefing

## What changed

- `apps/api/migrations/0016_cloud_capacity.sql`: `cloud_queue`, `cloud_budget`, `mail_meter`, `owners.last_seen_day`.
- `apps/api/src/cloud-*.ts`: the cap (`CLOUD_ACCOUNTS_MAX`), admission, queue store, join, budget guard, Cloudflare analytics reader, nightly run, mail and its meter, read throttle, copy.
- Gates: `sign-in-links.ts` (link request), `owner-sign-in.ts` (sign-in and the count-guarded insert), `owner-write-quota.ts` (95% refusal), `owner-endpoint.ts` and `mcp-endpoint.ts` (read throttle, last seen).
- Site: `apps/api/src/site/cloud-queue-form.ts` and `cloud-queue-page.ts` (`todz.app/cloud-queue`); admin: `admin-cloud-queue.ts`, `admin-cloud-admissions.ts`.
- `wrangler.jsonc` sets `CLOUD_ACCOUNTS_MAX` to 50 and binds `CLOUD_READ_LIMITER`; the self-host guide says to delete the var.

## How to run

`pnpm --filter @todz/api exec vitest run test/cloud-capacity.test.ts test/cloud-budget.test.ts test/cloud-capacity-requests.test.ts test/cloud-queue-page.test.ts test/admin-cloud-queue.test.ts`

## Hypotheses

- With the var unset nothing changes for any account or server, and nothing is metered.
- At the cap a link request answers 202 alike; a refused address is mailed the full notice and no link is stored.
- An admitted address passes the cap; Admit next N takes the oldest, at most the free spots.
- The guard mails the owner once a month at 80% and refuses writes at 95% only from accounts above the month's average per active account, with 429 and `Retry-After` to the first of next month; their reads are throttled.
- The queue digest mails only when the queue grew since the last digest that was sent.

## Gaps

- No client screen (Mac app) for the capacity message; installed apps already pause on the 429 `limit_reached` body.
- Without the analytics token the read measure is a profile (1,000 read requests per active account a day), not a count.
- Durable Object duration is not measured or guarded (ADR 0099).
- A read-only heavy account is not throttled: reads are not counted per account.
- The `/cloud-queue` page has no recorded visual walk.
