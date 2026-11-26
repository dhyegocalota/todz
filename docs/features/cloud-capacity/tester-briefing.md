# Cloud capacity: tester briefing

## What changed

- `apps/api/migrations/0016_cloud_capacity.sql`: `cloud_queue`, `cloud_budget`.
- `apps/api/src/cloud-*.ts`: the cap (`CLOUD_ACCOUNTS_MAX`), admission, queue store, join route, budget guard, nightly run, mail, copy.
- Gates: `sign-in-links.ts` (link request) and `owner-sign-in.ts` (sign-in); `owner-write-quota.ts` (95% refusal).
- Admin: `apps/api/src/site/admin-cloud-queue.ts`, `admin-cloud-admissions.ts`, a link on the metrics page.
- `wrangler.jsonc` sets `CLOUD_ACCOUNTS_MAX` to 13; the self-host guide says to delete it.

## How to run

`pnpm --filter @todz/api exec vitest run test/cloud-capacity.test.ts test/cloud-budget.test.ts test/cloud-queue-join.test.ts test/admin-cloud-queue.test.ts`

## Red-first

Not red-first: the lane was time-boxed and tests landed with their code, so every test is a pin.

## Hypotheses

- With the var unset nothing changes for any account or server.
- At the cap an active account signs in; a new address and an account idle for 90 days get `cloud_full` and no link.
- An admitted address passes the cap; Admit next N takes the oldest.
- The guard mails the owner once a month at 80% and refuses writes at 95% only from accounts above the month's average per active account; reads and the rest keep working.
- The queue digest mails only when the queue grew since the last digest.

## Gaps

- No client screen (Mac app) for `cloud_full` or the join route; the join route reuses the request-link Turnstile action.
- The warning and the digest stamp before they send: a failed send loses that mail (v1.1).
- The read measure is a profile (1,000 read requests per active account a day), not a count.
- The new admin page has no visual walk; the cap number is arithmetic (ADR 0099), the owner may change it.
