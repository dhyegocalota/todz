# 0099. The todz cloud admits at most 13 active accounts, and a monthly budget guard stops heavy writes before any included quota runs out

- Status: Accepted
- Date: 2026-11-26
- Deciders: Claude (the build loop's call, lane `cloud-capacity`) on the owner's rule of 2026-11-26: "limita a quantidade de usuários pra eu não ter que pagar nada a mais nos bills; daí usuários a mais vão pra uma lista ou me avisa; mas não quero pagar mais que $5". The number 13 is arithmetic, not taste; the owner can raise it with `CLOUD_ACCOUNTS_MAX` and then accepts the overage that follows.
- Inspired by: [ADR 0087](0087-fair-use-limits-are-fixed-numbers-sized-against-workers-paid-allowances-and-configurable-per-server.md), [ADR 0088](0088-daily-writes-and-stored-text-are-counted-in-d1-by-one-conditional-statement-per-write.md), [ADR 0089](0089-sign-up-abuse-is-capped-per-client-per-day-and-disposable-email-domains-are-refused-for-new-accounts.md), [ADR 0090](0090-suspension-blocks-writes-and-mcp-and-the-admin-sees-top-usage-by-owner.md), [ADR 0061](0061-performance-has-written-budgets-a-fetch-based-load-harness-behind-pnpm-perf-and-work-count-budgets-in-verify.md)

## Context

The todz cloud must never cost more than the Workers Paid base of USD 5 a month. The fair-use caps bound one account; nothing bounds how many accounts exist. Every included quota is a monthly pool shared by every account, so the number of accounts is the lever that keeps the sum inside the pools.

## Decision

1. `CLOUD_ACCOUNTS_MAX` (a Worker var; unset means no cap, so a self-hosted server is never capped) is the number of active accounts the cloud admits. The todz cloud sets it to **13**.
2. An account is active when it was created, held a live session or wrote a task in the last 90 days. An account idle for 90 days frees its spot but can still sign in: when the cloud is full it is queued like a new address.
3. The cap gates only new and returned-after-idle accounts. An active account is never refused, never queued and never counted against.
4. Above the cap, requesting a sign-in link for an address that is not admitted answers `cloud_full` with a message and the self-host link, and sends no link. The address may then be left on the list through a Turnstile-guarded, limited route; it lands in `cloud_queue`. The owner gets one email a day, only when the queue grew (count and newest), and the admin has a "Cloud queue" page with Admit and Admit next N. Admitting stamps the row and mails an invite; an admitted address passes the cap.
5. A budget guard measures the month against each metered dimension, nightly. At 80% of any dimension the owner is emailed once for the month. At 95% every account whose writes this month are above the average per active account is refused new writes with "todz cloud is at capacity this month"; reads keep working and an account under the average keeps writing.

### Sizing

Published Workers Paid allowances, read from developers.cloudflare.com on 2026-11-26: Worker requests 10 million and CPU 30 million ms; Durable Object requests 1 million, duration 400,000 GB-s, SQLite rows read 25 billion, rows written 50 million, storage 5 GB; D1 rows read 25 billion, rows written 50 million, storage 5 GB; KV reads 10 million and writes 1 million; Email Sending 3,000 a month. todz uses no KV. The margin is 20%, so each pool is taken at 80%.

One account at its fair-use cap, in a 30-day month, in the profile where the cap is the worst case: 1,000 task writes a day, each its own request (30,000 a month), plus an assumed 1,000 read requests a day (30,000; the guard watches this assumption), 13 Durable Object rows per write (ADR 0087), 2 D1 rows per write, about 10 ms of CPU per request, 45 emails (welcome, sign-in links, the day email), 50 MiB of stored text.

| Quota | Pool at 80% | Per account at the cap | Accounts it allows |
|---|---|---|---|
| Durable Object requests | 800,000 | 60,000 | 13 |
| Worker CPU | 24,000,000 ms | 600,000 ms | 40 |
| Durable Object storage | 4 GB | 50 MiB | 81 |
| Durable Object rows written | 40,000,000 | 390,000 | 102 |
| Worker requests | 8,000,000 | 60,000 | 133 |
| Email Sending | 2,400 | 45 | 53 |
| D1 rows written | 40,000,000 | 60,000 | 666 |
| Durable Object duration | 320,000 GB-s | 150 GB-s | 2,133 |
| D1 rows read, Durable Object rows read | 20 billion | under 1 million | over 20,000 |

The smallest row is Durable Object requests: **13 accounts**. That is `CLOUD_ACCOUNTS_MAX`.

What the account cap bounds: every row above, because each per-account figure is bounded by a fair-use cap (writes by `FAIR_USE_WRITES_PER_DAY_MAX`, storage by `FAIR_USE_STORED_BYTES_MAX`) or by the per-minute limiters' reading profile. What it does not bound: a per-minute limiter alone allows 600 owner requests a minute, about 26 million a month for one account, so reads are bounded by the assumption above and by the budget guard, not by a cap. The guard counts, from D1, each account's task writes (`owner_usage`) times the per-write costs, plus the read profile per active account for the days elapsed, plus the day emails sent; Worker requests, Durable Object requests, Durable Object rows written, D1 rows written and emails are metered that way. CPU, duration, storage and rows read stay bounded by the account cap and cannot reach their pool at 13 accounts (the closest, CPU, is at 33% of its pool).

Why 95%: one day at the cap for every admitted account is under 3% of a pool (1/30 of the 80% sizing), so a nightly check at 95% stops writes before the pool runs out. The 80% email gives the owner a week to act.

## Alternatives considered

| Option | Pros | Cons | Why not |
|---|---|---|---|
| No account cap, only the budget guard | More users admitted | The guard acts on writes after the fact and cannot bound reads; one bad week breaks the rule | The owner's rule is a hard ceiling; the cap is the only lever that bounds every quota at once |
| Lower the daily write cap instead | Admits more accounts | Hurts every account, agent-heavy owners first, and does not bound reads | The write cap stays a fair-use rule; capacity is a separate rule |
| Count requests per dimension in D1 on every request | Exact | Every request becomes a D1 write, spending the quota it measures | The derived measure costs nothing at request time |
| A paid tier or paying overage | More users | The owner said never above $5 | Self-host is always offered instead |

## Consequences

- `cloud_queue` and `cloud_budget` tables (migration 0016); the owner is emailed by the existing sender.
- The existing 03:00 UTC cron runs the guard and the daily queue digest after the metrics rollup; the guard's measure is derived from D1 and costs nothing at request time except one read per write while the cap is on.
- A self-hosted server sets nothing and is never capped or guarded.
- The owner raises the cap knowingly: each account beyond 13 adds roughly 1/13 of the Durable Object request pool, and requests beyond it cost $0.15 per million.

## Evidence

- Allowances: Cloudflare pricing pages for Workers, Durable Objects, D1, KV and Email Service, 2026-11-26.
- Per-write costs: ADR 0087's measurement (13 rows).
- Tests: `apps/api/test/cloud-capacity.test.ts`, `apps/api/test/cloud-budget.test.ts`.

## Revisit when

- Cloudflare changes the Workers Paid allowances.
- Measured Durable Object requests per account differ from 60,000 a month by more than 2x.
- The owner decides to pay for more accounts.
