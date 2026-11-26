# 0082. Telemetry is daily rollups in D1, counted by a nightly cron, the appcast and an opt-in app report, with no raw event, and self-host off

- Status: Accepted (the build loop's call, the owner may overturn it)
- Date: 2026-11-26
- Deciders: the build loop's call, on the owner's request of 2026-11-26 ("telemetria sim, mas de forma leve sem estourar meu billing? e onde vou conferir estes números?") and his limits ("payload leve, pra não acumular gigas e eu ter que pagar"); Claude (advisor)
- Inspired by: [ADR 0063](0063-the-day-email-is-claimed-once-a-day-per-owner-from-a-quarter-hour-cron.md) (a cron that fans out over owners with a cap), [ADR 0072](0072-the-mac-app-downloads-from-todz-app-as-a-development-signed-dmg-with-an-ssh-signature-and-updates-through-sparkle.md) (the appcast), [ADR 0045](0045-the-public-sign-in-routes-are-limited-three-ways-and-turnstile-guarded-failing-closed.md) (fail closed without limiters)

## Context

The owner wants to know how many people use todz, which app versions are alive and what the agents do, without a third-party script, a new token or product, or a bill that grows with traffic. Task contents, addresses and anything personal must never enter the numbers. The server is open source and self-hosted by others, so a copy of the server must not report anything unless its own owner turns it on.

Two facts shape the design. The tasks live in one Durable Object per project, not in D1, so a count of tasks is a read of every project. And `/download/appcast.xml` is a static asset, so no Worker code sees a Sparkle check unless the Worker runs first for that path.

## Decision

1. **One table of daily rollups.** Migration `0011_metrics_daily.sql` creates `metrics_daily (day, metric, dimension, count)`, primary key `(day, metric, dimension)`, `STRICT, WITHOUT ROWID` so a row is one write and one storage record. There is no raw event, IP address, user agent, identifier, task content or email column anywhere: a test reads the column list and every stored row.
2. **Metrics and dimensions are enums.** `Metric` has 14 values. A dimension comes from a fixed allow-list per metric: the agent client (`claude-code`, `codex`, `cursor`, `gemini`, `windsurf`, `zed`, `vscode`, `other`, matched by name marker), the usage event (5 names), or an app version pair `a.b.c|major`, where the version must be one the deploy staged (the Worker asks the assets for that version's checksum file) and `major` a macOS major from 14 to 30 or `unknown`. Anything else is stored as `other`, and a metric without a dimension stores none. A metric holds at most 50 dimension values per day; a new one after that counts into `other`.
3. **Nightly aggregates from the cron, no write on the hot path.** A new cron `0 3 * * *` counts the previous UTC day: owners, workspaces and projects (total and new) and day mails sent from D1, and tasks added, tasks completed and agent writes by client from each project's own history through one read per project, capped at 500 projects per run (a larger account base needs sharding, recorded below). Each run replaces its day's rows, so a rerun changes nothing. No task, MCP or owner request writes anything for telemetry. "MCP calls" are counted as agent writes from the project history: counting reads would cost one D1 write per call.
4. **The appcast is counted by running the Worker first for that one path.** `run_worker_first` gains `/download/appcast.xml`; the Worker serves the asset unchanged and counts the request in `waitUntil` after the response is on its way. The count needs a user agent that is exactly `Todz/<a.b.c> Sparkle/<x.y[.z]>` with an optional ` macOS/<major>` (the app sets Sparkle's `userAgentString` to that), so a browser or `curl` is not counted. The user agent is parsed to two small values and dropped. Two rate limiters bound the counting, one check a minute per client address (keyed with `clientRateKey`) and 60 a minute overall; a refused or missing limiter still serves the file. The Worker sets the feed's `Content-Type` and `Cache-Control: public, max-age=300` itself, because the headers file does not apply to a Worker response.
5. **The app report is opt-in, tiny and capped.** The Mac app has a "Share anonymous usage" switch, off by default, asked once on the first launch after the update. When on, it keeps a local tally of five events (`popover_opened`, `day_closed`, `morning_glance`, `shortcut_used`, `multi_workspace`) and sends one rollup the day after: integer counts for that enum, each at most 500, the app version, the macOS major version and an identifier that changes every 30 days; no per-event timestamp and no other string. The body is under 1 KB. `POST /telemetry/usage` on the API host refuses any body over 2 KB with `413` before parsing it, validates a strict shape (`422`), rate limits by client address (one a minute), by identifier and globally, and refuses past 5,000 rollups a day. The identifier only keys the per-install limiter; it is dropped after the request and never stored or used as a dimension.
6. **13 months of retention, deleted by the cron.** Each nightly run deletes rows older than 395 days.
7. **Self-host is off by default.** `TELEMETRY` must be exactly `on` to count anything; unset or any other value turns the cron, the appcast counter and the usage route off (the route answers `404`). The hosted `wrangler.jsonc` sets it to `on`; the self-host guide tells a forker to remove it. The app only sends to the server it is signed in to, so a self-hosted server that has it off receives nothing useful.
8. **One owner-only page reads the rollups.** `todz.app/admin/metrics` shows 30-day sparklines in inline SVG with totals, and `/admin/metrics.csv` exports every retained row, behind the existing admin session, with no script and a strict policy. It reads `metrics_daily` and the admin session table and nothing else.
9. **A seam for the site.** Landing views and download or star clicks are another lane's: `incrementMetrics` in `apps/api/src/telemetry/metrics-store.ts` is the function the site calls (a new `Metric` member with its dimension rule), counted in `waitUntil`, never awaited on the page.

## Sizing and cost

Included in Workers Paid, as published when this was written (to be rechecked on the Cloudflare pricing page): D1 storage 5 GB, rows read 25 billion a month, rows written 50 million a month; beyond them, $0.75 per GB-month, $0.001 per million rows read and $1 per million rows written.

- **Storage.** Ceiling: about 50 metrics × 20 dimensions × 400 days ≈ 400,000 rows at about 60 bytes, tens of MB, under 1% of 5 GB. Today's design has 14 metrics and about 130 rows a day at most, so 400 days is about 52,000 rows, about 3 MB.
- **Rows written per day.** Nightly: 9 plain metrics plus at most 8 agent clients, so at most 17, plus the prune of about 130 expired rows. Appcast: one upsert per Sparkle check, about one a day per install. App report: at most 7 per opted-in install a day (1 counter, 1 version, 5 events). With 1,000 installs and 300 opted in: 1,000 + 2,100 + 150 ≈ 3,250 a day, about 100,000 a month, 0.2% of 50 million.
- **Rows read.** Each upsert reads at most the day's rows of its metric (under 60), so a few hundred thousand reads a day at that size, about 10 million a month, 0.04% of 25 billion. A page view reads at most 30 days × 130 rows.
- **Bounds.** Both appcast limiters are per Cloudflare location. One address is counted once a minute, so a `curl` loop from one address writes at most 1,440 rows a day, and the 60 a minute overall limit caps a location at about 86,000; a forged-user-agent flood spread over many addresses and locations costs $1 per million extra rows written, and a Cloudflare rule can close it. Forged versions never take a row of their own: only published versions and a fixed list of macOS majors name a dimension.
- **Accepted forgery risk.** The usage report cannot prove an install is real: one address can send one report a minute, so up to 1,440 a day, against the cap of 5,000 reports, each event at most 500 a day, and a flood of fresh identifiers can fill that cap and crowd out honest reports for the day. The cap bounds the cost at 35,000 rows written a day and the damage at skewed counts for that day; the owner accepts it for a count of features, not of people.

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| Workers Analytics Engine | Built for high volume, no table | A new dataset binding and SQL API token to read it from the admin page; sampling | The owner asked for no new token or product, and the volume is tiny |
| A raw event table with a TTL | Any question can be asked later | Grows with traffic, holds an identifier and a user agent, PII risk | Violates "no raw event" and the cost limit |
| One D1 write per MCP call | Exact call counts | A write on the hot path per tool call, unbounded | Agent writes from project history are free to read and enough |
| Counting the appcast from Cloudflare's own analytics | No Worker in front of the asset | No per-version split, nothing in the admin page | The split by version is the point |
| Third-party analytics script | Ready dashboards | A script, a CSP change, tracking of readers | Rejected by the owner |
| Storing the identifier to count installs per day | A real unique-install count | A persistent identifier on the server | Active installs come from the appcast; the identifier only rate limits |

## Consequences

The hosted server needs `TELEMETRY` set to `on` and four more rate limiter bindings, deployed with the migration; none of it is deployed by this change. A nightly run reads at most 500 projects; past that the task counts are a lower bound, and the run fails loudly when a read fails. The appcast request passes through the Worker, adding one Worker invocation per Sparkle check (the invocation is counted against the plan's included requests). The Privacy page in the docs lists exactly what is counted.

## Evidence

`apps/api/test/telemetry/` (store, caps, retention, nightly run, appcast, usage report, admin page, CSV, self-host default) and `apps/macos/TodzKit/Tests/TodzKitTests/UsageSharingTests.swift` (off by default, rotation after 30 days, counts only, under 1 KB).

## Revisit when

The project count passes 500 (shard the nightly read), the owner wants a metric that needs a write per event, Cloudflare changes the D1 allowances, or a self-hoster asks to send to the hosted server.
