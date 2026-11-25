# Agent nudge deploy

**Status:** Shipped 2026-11-25
**Tier:** 🟢
**Owner approval:** approved 2026-11-25 by PROMPT.md "Publishing on todz.app" (the loop runs `deploy-the-api.md` from `main` and records it) and [ADR 0044](../../adr/0044-the-wrangler-configuration-is-production-on-api-todz-app-and-development-overrides-it.md) §6
**ADRs:** [0044](../../adr/0044-the-wrangler-configuration-is-production-on-api-todz-app-and-development-overrides-it.md), [0053](../../adr/0053-agents-mention-today-s-tasks-in-next-when-the-owner-turns-it-on.md)
**Not changing:** code, configuration, secrets, the Turnstile widget (the owner's step 10). Migration 0007 and the nudge itself were reviewed in `agent-nudge` (PR #32); this folder only records their run.

## Problem

`agent-nudge` merged as PR #32, `main` at 59d3966. The loop ran `docs/runbooks/deploy-the-api.md` from `main` to put it live: migration `0007_agent_nudge.sql` applied and `todz-api` deployed as version `25bc8121-a464-448e-9548-d4c10aa9c339`. Step 16 asks for the run's rows in a pull request.

## Change

- The run log gains one row per step, 1 to 15. Step 10 put nothing: no new secret, and the Turnstile widget is still the owner's.
- Nothing else changes: the runbook's steps held as written.

## Test list

- The run-log shape test stays green with the new rows.
- A tester re-reads production, read-only, and confirms each row a read can confirm: the migration list and the `agent_nudge` column, the deployments and the current version's D1 binding and nine limiters, the secret names, the domains, the smoke answers, the `www` redirect, plain HTTP answering 301, the link, waitlist and admin probes answering 503 with unchanged counts. The limiter's 429 is not re-read, because a re-read spends the quota it checks.
- The rows carry no token, secret value, link or personal address.
