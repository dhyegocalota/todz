# Test plan: Telemetry

Every checkbox states the input and the exact expected outcome. A ticked box carries evidence after ` — evidence: ` (commit hash, log path, counts, screenshot path).

## The failing test first

- [ ] `apps/api/test/telemetry/*.test.ts` — input: the stubs of commit `5d44615e`; expected: every test reaches `... is not implemented`
- [ ] Confirmed it fails for the right reason: `Error: utcDayOf is not implemented`, `serveUsageRollup is not implemented`, `serveAppcast is not implemented`, `runMetricsNightly is not implemented`, `incrementMetrics is not implemented`, `sparkleClientOf is not implemented`, `isTelemetryOn is not implemented`
- [ ] The Swift tests landed with their code (no separate red commit): a pin

## Unit

- [ ] `metrics-store.test.ts` — the table has the columns `day, metric, dimension, count` and nothing else
- [ ] `metrics-store.test.ts` — input: 50 appcast versions, then a 51st; expected: 51 rows, the 51st counted into `other`, an existing value still counted
- [ ] `metrics-store.test.ts` — input: rows 396 and 394 days old; expected: only the newer one stays after `pruneMetrics`
- [ ] `metrics-nightly.test.ts` — input: owners before, inside and after the day; expected: total 2, new 1; a rerun leaves the same numbers
- [ ] `appcast.test.ts` — input: `Todz/0.2.1 Sparkle/2.6.4 macOS/15`; expected: one row `0.2.1|15`, no stored user agent or address; a browser agent counts nothing
- [ ] `usage-rollup.test.ts` — input: a 2,049-byte body; expected: 413 before parsing; the install identifier is in no stored row; each limiter's refusal is a 429; past 5,000 rollups a 429
- [ ] `admin-metrics.test.ts` — input: no session; expected: the sign-in card, no numbers; the page has no script and reads only `metrics_daily` and `admin_sessions`
- [ ] `metric.test.ts` — input: `TELEMETRY` unset, `off`, `ON`; expected: off; only `on` is on
- [ ] `UsageSharingTests.swift` — fresh domain is off and not asked; the identifier rotates at 30 days; the rollup has four keys and counts only, under 1 KB

## E2E (Playwright specs)

- Not added: the admin page has no script, and the walk is the tester's.

## Prove it for real — Playwright MCP

- [ ] Happy path: sign in to `/admin`, open Metrics, see the sparklines and totals, download the CSV
- [ ] Empty: a fresh database; expected: "No numbers yet."
- [ ] Console and network clean: zero console errors and no blocked inline style, the policy has no `script-src`
- [ ] Desktop and narrow widths: the tiles wrap without sideways scroll
- [ ] Settings: the "Share anonymous usage" switch is off on a fresh profile; the ask appears once

## Edge cases found during execution

Empty on purpose.

## Adversarial review

- [ ] Claim 1: no identifier or user agent reaches D1 — attack: read every statement and row after a rollup and an appcast request; result: pending
- [ ] Claim 2: the appcast still downloads — attack: request it with and without a Sparkle agent and with the limiter off; result: pending
- [ ] Claim 3: self-host is off — attack: unset `TELEMETRY` and hit the three entry points; result: pending

## Coverage honesty

- The Sparkle user agent with a system version is built by the app and parsed by the server; no test runs Sparkle itself.
- The nightly run is tested with a handful of projects, not 500.
- The D1 numbers in the ADR are an estimate, not a measurement.
