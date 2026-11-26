# Tester briefing: Telemetry

## What changed and where

- `apps/api/migrations/0011_metrics_daily.sql`, `apps/api/src/telemetry/` (the store, the nightly run, the usage endpoint, the Sparkle user agent), `apps/api/src/site/appcast.ts`, `admin-metrics.ts`, the cron `0 3 * * *`, four rate limiter bindings and `TELEMETRY` in `apps/api/wrangler.jsonc`.
- The Mac app: `UsageSharing*`, `UsageRollup`, `UpdateUserAgent` in TodzKit; the switch in Settings, the ask once and the daily send in `AppDelegate+UsageSharing.swift`.
- Docs: ADR 0082, the Privacy page, the self-host guide.

## How to run

`pnpm --filter @todz/api exec vitest run --project workers test/telemetry`, `swift test --package-path apps/macos/TodzKit --filter Usage`, then the walk of `/admin/metrics` on a local stack with `TELEMETRY` set to `on`.

## Red today, green after

The API tests were red at `5d44615e` with `... is not implemented` and are green at `a00f5b14`. The Swift tests landed with their code: pins.

## Hypotheses to attack

- No identifier, user agent or address reaches `metrics_daily` from the usage endpoint or the appcast.
- A body over 2 KB is a 413 before parsing, even when it is not JSON.
- The appcast still downloads with and without a Sparkle agent, and with the limiter missing.
- With `TELEMETRY` unset the cron, the appcast counter and the usage route do nothing.
- The Metrics page has no script, reads only `metrics_daily`, and its CSV needs the admin session.

## Known gaps

- Only popover opened is recorded by the app today; `day_closed`, `morning_glance`, `shortcut_used` and `multi_workspace` are in the enum and the server allow-list but their call sites are not wired.
- The landing-view and click counters are another lane's, through `incrementMetrics`.
- The nightly run was not tried with 500 projects, and nothing was deployed or run against Cloudflare.
- The Settings switch and the ask were built, not walked.
