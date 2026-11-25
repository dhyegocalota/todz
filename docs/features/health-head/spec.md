# Health HEAD

**Status:** Approved
**Tier:** 🟢
**Owner approval:** approved 2026-11-25 as the loop's call under the owner's 2026-11-24 instruction to decide every call (todz-loop/PROMPT.md), from todz-6f's production spot-check after PR #47
**ADRs:** none
**Not changing:** the body and headers of `GET /health`, every other method on `/health`, every other path, the `Server-Timing` routes

## Problem

`HEAD https://api.todz.app/health` answers 404 while `GET` answers 200, and uptime monitors probe with HEAD. `/health` also carries no `Server-Timing`, by design, and no runbook says so.

## Change

- `HEAD /health` answers like `GET`: 200, the same headers (`cache-control: no-store`, the security headers), an empty body, on every host where `GET /health` answers. Other methods keep their 404.
- `performance.md` and step 13 of `deploy-the-api.md` say in one sentence that `/health` has no `Server-Timing`; step 13 also probes `curl -sSI https://api.todz.app/health`, expecting `HTTP/2 200`.
- The performance deploy's run-log rows are appended to the runbook's Run log.

## Test list

- `apps/api/test/health.test.ts`: HEAD on the API, site and unknown host answers 200 with `no-store`, a JSON content type and an empty body; HEAD with a query string; GET unchanged; POST unchanged; HEAD on another path unchanged; HEAD with an unusable configured origin answers 404.
- Shape: `runbooks.test.ts` and `feature-status.test.ts` stay green.
