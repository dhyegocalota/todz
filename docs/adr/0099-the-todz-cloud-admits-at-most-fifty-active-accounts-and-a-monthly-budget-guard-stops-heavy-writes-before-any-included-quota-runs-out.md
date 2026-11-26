# 0099. The todz cloud admits at most 50 active accounts, and a monthly budget guard stops heavy writes before any included quota runs out

- Status: Accepted
- Date: 2026-11-26
- Deciders: the owner, on his own rule of 2026-11-26 ("limita a quantidade de usuários pra eu não ter que pagar nada a mais nos bills; daí usuários a mais vão pra uma lista ou me avisa; mas não quero pagar mais que $5") and his number ("50 contas e deixa claro que vagas free no cloud são extremamente limitadas"); Claude (the build loop's call, lane `cloud-capacity`) on the mechanism. The loop's own arithmetic gave 13 and the owner's 50 overrides it: the 95% guard below, not the account count, is what keeps the bill at USD 5 above 13 accounts. The owner can change the number with `CLOUD_ACCOUNTS_MAX`.
- Inspired by: [ADR 0087](0087-fair-use-limits-are-fixed-numbers-sized-against-workers-paid-allowances-and-configurable-per-server.md), [ADR 0088](0088-daily-writes-and-stored-text-are-counted-in-d1-by-one-conditional-statement-per-write.md), [ADR 0089](0089-sign-up-abuse-is-capped-per-client-per-day-and-disposable-email-domains-are-refused-for-new-accounts.md), [ADR 0090](0090-suspension-blocks-writes-and-mcp-and-the-admin-sees-top-usage-by-owner.md), [ADR 0061](0061-performance-has-written-budgets-a-fetch-based-load-harness-behind-pnpm-perf-and-work-count-budgets-in-verify.md)

## Context

The todz cloud must never cost more than the Workers Paid base of USD 5 a month. The fair-use caps bound one account; nothing bounds how many accounts exist. Every included quota is a monthly pool shared by every account, so the number of accounts is one lever, and watching the pools is the other.

## Decision

1. `CLOUD_ACCOUNTS_MAX` (a Worker var; unset means no cap, so a self-hosted server is never capped) is the number of active accounts the cloud admits. The todz cloud sets it to **50**. Free todz cloud spots are extremely limited, and the landing, the docs, `llms.txt` and the mails say so, with self-hosting as the path that is always open.
2. An account is active when it was created, held a live session, wrote a task, or was seen signed in (`owners.last_seen_day`, stamped at most once a day on a signed-in request, so a read-only owner keeps its spot) in the last 90 days. An account idle for 90 days frees its spot but can still sign in: when the cloud is full it is queued like a new address.
3. The cap gates only new and returned-after-idle accounts. An active account, an admitted address and the owner whose address is `ADMIN_EMAIL` are never refused, never queued and never refused a write at 95%. The account is created by one conditional insert that counts the active accounts in the same statement, so two sign-ins with one spot left end at the cap, not above it.
4. Above the cap, a sign-in link request answers `202` with `{}` exactly as it does for an admitted address, so no answer tells an address that may sign in from one that may not. An address that may not gets a "todz cloud is full right now" mail instead of a link, naming the queue page `todz.app/cloud-queue` and the self-host guide. The page is a Turnstile-guarded form on the site host (its own `cloud_queue` action, a strict policy with no inline script beyond one hashed block); `POST /owner/cloud-queue` serves the same join for the apps. A joined address lands in `cloud_queue`. The owner gets one email a day, only when the queue grew since the last mail that was sent (count and newest), and the admin has a "Cloud queue" page with Admit and Admit next N. Admit next N admits at most the free spots: the cap minus the active accounts minus the admissions not yet signed in. Admitting stamps the row and mails an invite; an admitted address passes the cap, and an admission lapses after 90 days like an account: the address then waits again.
5. A budget guard measures the month against each metered dimension, nightly. With the Worker secret `CLOUDFLARE_ANALYTICS_TOKEN` (a separate token with Account Analytics Read only, never the deploy token) it reads the month's real Durable Object requests, Worker requests and D1 rows written from Cloudflare's GraphQL Analytics API; the real totals are the production path. Without the secret it uses the estimate below; the source is a `BudgetSource` chosen in one place, and when the cap is on and the secret is missing the nightly run logs "budget guard: estimate only" and the admin Cloud queue page says the same. A server with no cap needs no secret and nothing warns. A failing analytics call fails the nightly run, and the previous night's level stands until it is fixed. At 80% of any dimension the owner is emailed once for the month, and the mail is stamped only after it was sent. At 95% every account whose writes this month are above the average per active account is refused new writes with HTTP `429` and the body `{ "error": "limit_reached", "limit": "cloud_capacity", "message": ... }`, the message "todz cloud is at capacity this month" with the self-host link, and `Retry-After` set to the seconds until the first of next month, UTC; the same accounts are read-throttled to 10 requests a minute per owner (`CLOUD_READ_LIMITER`, over the owner API and MCP, answering `429 rate_limited`). The USD 5 rule is firmer than "reads keep working"; this throttle is the loop's call.
6. Every mail the cloud sends through the Cloudflare sender (sign-in links, welcome, day emails, the admin's sign-in, invites, alerts, digests, the full notice) writes one row to `mail_meter`, and the guard counts the month from it. A self-hosted server meters nothing. An address that has been sent 10 mails in the last day gets no more link mail and the usual sign-in refusal.

### Sizing

Published Workers Paid allowances, read from developers.cloudflare.com on 2026-11-26: Worker requests 10 million and CPU 30 million ms; Durable Object requests 1 million, duration 400,000 GB-s, SQLite rows read 25 billion, rows written 50 million, storage 5 GB; D1 rows read 25 billion, rows written 50 million, storage 5 GB; KV reads 10 million and writes 1 million. todz uses no KV. Email Sending: "3,000 included per month, then $0.35 per 1,000 emails" (developers.cloudflare.com/email-service/platform/pricing, page modified 2026-11-24, read 2026-11-26; the included emails apply per account and per billing month). The margin is 20%, so each pool is taken at 80%.

One account at its fair-use cap, in a 30-day month, in the profile where the cap is the worst case: 1,000 task writes a day, each its own request (30,000 a month), plus an assumed 1,000 read requests a day (30,000), 13 Durable Object rows per write (ADR 0087), 2 D1 rows per write, about 10 ms of CPU per request, 45 emails (welcome, sign-in links, the day email), 50 MiB of stored text.

| Quota | Pool at 80% | Per account at the cap | Accounts it allows |
|---|---|---|---|
| Durable Object requests | 800,000 | 60,000 | 13 |
| Worker CPU | 24,000,000 ms | 600,000 ms | 40 |
| Durable Object storage | 4 GB | 50 MiB | 81 |
| Durable Object rows written | 40,000,000 | 390,000 | 102 |
| Worker requests | 8,000,000 | 60,000 | 133 |
| Email Sending | 2,400 | 45 | 53 |
| D1 rows written | 40,000,000 | 60,000 | 666 |
| D1 rows read, Durable Object rows read | 20 billion | under 1 million | over 20,000 |

The smallest row is Durable Object requests: 13 accounts at the cap. The table is the worst case, every account at its cap all month. **50 accounts** fit while the average account uses about a quarter of that profile: 16,000 Durable Object requests a month (800,000 / 50), about 530 a day. An account that uses more is what the guard watches: the table's 13 is where the guard, not the count, starts to carry the USD 5 rule.

Durable Object duration is the one pool no one has measured. No run log or perf record holds a GB-s figure, and the guard does not read it (only the documented request and row fields are read). The assumption, stated plainly: an object stays resident about 10 s after a request and bills at 128 MB, so a request that finds the object idle costs about 1.25 GB-s. At that price the 80% pool of 320,000 GB-s allows about 256,000 spaced-out requests a month, which is below the request pool, and at the full cap profile (60,000 requests, 75,000 GB-s per account) about 4 accounts. At the average above (16,000 requests an account, 20,000 GB-s) 50 accounts use 1,000,000 GB-s, which is 2.5 times the included 400,000. So duration, not requests, is the pool that can make the bill rise above USD 5 if every request is spaced out, and the guard cannot see it. Requests that arrive close together share one residency and bill far less, and a project open in the app holds its socket, so the real figure is lower, but the number is not known. It must be measured before the cap goes above 50 and the first month's Durable Object duration read from the dashboard goes into the run log.

What the cap bounds: each per-account figure above is bounded by a fair-use cap (writes by `FAIR_USE_WRITES_PER_DAY_MAX`, storage by `FAIR_USE_STORED_BYTES_MAX`) or by the per-minute limiters' reading profile. A per-minute limiter alone allows 600 owner requests a minute, about 26 million a month for one account, so reads are bounded by the guard and the 95% read throttle, not by a cap.

How the guard measures, and what it assumed before: with the token, Worker requests, Durable Object requests and D1 rows written are the month's real totals; Durable Object rows written are the month's task writes (`owner_usage`) times 13; emails are the metered mails. Cloudflare says these datasets are for monitoring, not for billing reconciliation, so the 20% margin stands. Without the token, the estimate is each account's task writes (`owner_usage`) times the per-write costs, plus an assumed 1,000 read requests per active account per day for the days elapsed, plus the metered mails. That read assumption is a stand-in, and at 50 accounts it reaches 80% of the Durable Object requests by day 16: with no token the guard warns early every month and refuses heavy writers from about day 19, which is the safe direction. The earlier text of this ADR said the guard watched the read assumption; it did not, and it does not now except through the token. CPU, storage and rows read stay bounded by the account cap and cannot reach their pool at 50 accounts at the average profile (the closest, CPU, is at 31% of its 80% pool).

Who is "heavy": an account whose writes this month are above the average per active account (`cloud_budget.heavy_writes`). Reads are not counted per account, so an account that only reads is never throttled however much it reads; the cap and the 95% guard on the pools are what bound it.

Why 95%: one day at the cap for every admitted account is under 3% of a pool (1/30 of the 80% sizing), so a nightly check at 95% stops writes before the pool runs out. One night can still add up to 5% of a pool before the next check, which is 50,000 Durable Object requests, and requests beyond the pool cost $0.15 per million. The 80% email gives the owner a week to act.

## Alternatives considered

| Option | Pros | Cons | Why not |
|---|---|---|---|
| 13 accounts, the loop's arithmetic | A worst-case bound with no guard | Admits very few people | The owner chose 50 and the guard carries the rule |
| No account cap, only the budget guard | More users admitted | The guard acts after the fact; one bad week breaks the rule | The cap bounds every quota at once |
| Lower the daily write cap instead | Admits more accounts | Hurts every account, agent-heavy owners first, and does not bound reads | The write cap stays a fair-use rule; capacity is a separate rule |
| Count requests per dimension in D1 on every request | Exact | Every request becomes a D1 write, spending the quota it measures | The nightly read of Cloudflare's totals costs nothing at request time |
| A `cloud_full` answer to a refused address | Plain | Tells an address that may sign in from one that may not | The answer is alike and the mail says it |
| A paid tier or paying overage | More users | The owner said never above $5 | Self-host is always offered instead |

## Consequences

- `cloud_queue`, `cloud_budget` and `mail_meter` tables and `owners.last_seen_day` (migration 0016); the owner is emailed by the existing sender.
- The existing 03:00 UTC cron runs the guard and the daily queue digest after the metrics rollup. A digest counts joins up to the run time and stamps only those, only after the mail was sent, so a join in between is reported the next night.
- `wrangler.jsonc` sets `CLOUD_ACCOUNTS_MAX` to 50 and binds `CLOUD_READ_LIMITER` (10 requests a minute). A self-hosted server sets nothing, is never capped, guarded or metered, and must delete the var its fork inherits.
- The 95% refusal reuses the `limit_reached` body on purpose. The Mac app reads a `429` with an unknown error code as an unexpected failure, which keeps a change for two answered attempts and drops it on the third (`SendOutcome`, ADR 0028), while a `limit_reached` body with a message and status 429 decodes to `fairUsePaused`, which pauses sending and keeps the whole queue (`OwnerErrorBody`, ADR 0088); the app ignores the `limit` field, so `cloud_capacity` decodes. Every installed app (0.2.4 and later) therefore pauses and shows the message with no app change. The body stays honest: the error is a limit that was reached, and `limit` names which.
- The owner raises the cap knowingly: each account beyond the average adds to the pools above, and requests beyond them cost $0.15 per million.

## Evidence

- Allowances: Cloudflare pricing pages for Workers, Durable Objects, D1 and Email Service, 2026-11-26.
- Per-write costs: ADR 0087's measurement (13 rows).
- Tests: `apps/api/test/cloud-capacity.test.ts`, `apps/api/test/cloud-budget.test.ts`, `apps/api/test/cloud-queue-page.test.ts`, `apps/api/test/admin-cloud-queue.test.ts`.

## Revisit when

- Cloudflare changes the Workers Paid allowances.
- Measured Durable Object requests per account differ from 16,000 a month by more than 2x, or the first measured Durable Object duration differs from 1.25 GB-s a request.
- The owner decides to pay for more accounts.
