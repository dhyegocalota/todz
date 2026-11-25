# Production smoke walk

**Status:** Approved
**Tier:** 🟢
**Owner approval:** approved 2026-11-25 as the loop's call under the owner's 2026-11-24 instruction to decide every call (todz-loop/PROMPT.md, "Everything is done")
**ADRs:** none
**Not changing:** every route, the app, the deploy and performance runbooks' steps, the probe bodies under `scripts/deploy-bodies`

## Problem

The loop is done only when a production smoke walk passed and is recorded in `docs/runbooks/` with its date: a real magic-link mail signs in, the app and a real MCP client add and complete a task, the menu bar count and the widget follow. No runbook holds that walk, so the minute the last deploy lands there is nothing to run and nowhere to record it.

## Change

- `docs/runbooks/production-smoke-walk.md`: seventeen numbered steps, each with an expected result and an `If it fails` line, and a Run log table at the end. It reuses the deploy runbook's probes for the limits and Turnstile, and steps 9 to 13 of the performance runbook for the budgets; the sign-in mail, the app, the menu bar and widget, the waitlist's admin panel and the day email's reply are the owner's session; the version line and the day email are conditional on their features being deployed; the forged reply runs only with the owner's explicit OK.
- `docs/runbooks/README.md`: the index row, and the agent exception sentence names the walk's loop steps (`runbooks.test.ts` pins the sentence).

## Test list

- Shape: `runbooks.test.ts` (numbered steps, an `If it fails` line each, relative links, root pnpm scripts, the index row, the exception sentence) and `feature-status.test.ts` stay green.
