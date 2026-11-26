# Plan: Telemetry

**Spec:** spec.md
**Tier:** 🔴
**Seam:** `incrementMetrics` in `apps/api/src/telemetry/metrics-store.ts`, the function the site's follow-up commit calls to count landing views and clicks
**Assumptions (decided, owner can override):**
- The hosted `wrangler.jsonc` carries `TELEMETRY` set to `on`; a self-hoster removes it.
- Nothing is deployed by this feature; the deploy applies migration 0011 and creates the four limiter bindings.

## File map

| Group | Paths owned | Developer sub-agent |
|-------|-------------|---------------------|
| G1 | `apps/api/migrations/0011_metrics_daily.sql`, `apps/api/src/telemetry/`, `apps/api/src/site/appcast.ts`, `admin-metrics.ts`, `admin-copy.ts`, `apps/api/test/telemetry/`, the cron and route wiring | `developer-1` |
| G2 | `apps/macos/TodzKit` usage files, `apps/macos/Copy/UsageSharingCopy.swift`, the app wiring | `developer-2` |
| G3 | `docs/`, `apps/docs/privacy.mdx`, `apps/docs/docs.json`, `apps/docs/self-host.mdx` | `developer-3` |

## Sequencing

G1, G2 and G3 are disjoint and run in parallel; the Privacy page waits for the final list of counts.

## Steps

### G1

- [ ] **Step 1:** red tests and stubs for the store, the nightly run, the appcast, the usage report and the admin page, then the migration and wiring.
- [ ] **Step 2:** the store with the dimension allow-lists, the cap and retention.
- [ ] **Step 3:** the nightly run, the appcast counter, the usage endpoint and the admin page with its CSV.

### G2

- [ ] **Step 4:** the switch off by default, the rotating identifier, the counts-only rollup, the daily send and the ask once.

### G3

- [ ] **Step 5:** ADR 0082, the Privacy page, the navigation, the self-host guide and the index rows.

## Failure modes

| Step | What breaks | How I notice (the concrete signal) | How I back out |
|------|-------------|------------------------------------|----------------|
| 1 | The migration fails on remote | The deploy's migrate step errors | Drop the table; nothing reads it before the code |
| 3 | The appcast route breaks Sparkle | Updates stop; the appcast answers non-200 | Remove the path from `run_worker_first` and redeploy |
| 3 | The usage endpoint is flooded | `usage_rollups` hits its daily cap; 429s | Set `TELEMETRY` away from `on` |
| 4 | The ask appears on every launch | The alert shows twice | Fix the stored `askedAboutSharingUsage` key |

**Steps with no backout:** none; the rows are rollups and can be deleted.

## Z. Prove and ship

- [ ] **Tester briefing:** a developer wrote `tester-briefing.md`.
- [ ] **Tester run:** a fresh `tester` sub-agent executed `test-plan.md` and ticked every box with evidence.
- [ ] **Reviewer:** a fresh `reviewer` sub-agent returned a verdict; refutation of the three riskiest claims is recorded in `test-plan.md`.
- [ ] **/check-ui:** screenshots and video recorded and uploaded (the admin page and the Settings switch).
- [ ] **/open-pr:** gates passed, learnings sweep stated, PR opened.
