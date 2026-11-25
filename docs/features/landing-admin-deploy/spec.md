# Landing admin deploy

**Status:** Building
**Tier:** 🟢
**Owner approval:** approved 2026-11-25 by PROMPT.md "Publishing on todz.app" (the loop runs `deploy-the-api.md` from `main` and records it, and creates todz-only Worker secrets) and [ADR 0044](../../adr/0044-the-wrangler-configuration-is-production-on-api-todz-app-and-development-overrides-it.md) §6
**ADRs:** [0044](../../adr/0044-the-wrangler-configuration-is-production-on-api-todz-app-and-development-overrides-it.md), [0051](../../adr/0051-the-admin-signs-in-by-a-mail-link-bound-to-the-browser-that-asked-into-a-cookie-session.md), [0052](../../adr/0052-the-waitlist-digest-goes-to-the-admin-address-once-a-day-from-a-cron.md)
**Not changing:** code, configuration, the Turnstile widget (the owner's step 10). The 🔴 and 🟡 changes themselves, migration 0006, the admin's routes, its three limiters, the `ADMIN_EMAIL` secret and the digest's cron, were reviewed in `landing-admin` (PR #29) and `landing-digest` (PR #30); this folder only records their run.

## Problem

`landing-admin` and `landing-digest` merged as PRs #29 and #30, `main` at 217d5c3. The loop ran `docs/runbooks/deploy-the-api.md` from `main` to put both live: migration `0006_admin.sql` applied, `todz-api` deployed as version `2148e758-9c33-4d5d-a168-5468fe89ff11` with nine limiters and the `0 11 * * *` schedule, then the `ADMIN_EMAIL` secret put, which made version `f98645a5-c4ac-468d-b003-4bb60b248ada` current. Step 16 asks for the run's rows in a pull request.

## Change

- The run log gains one row per step, 1 to 15. Step 10 puts `ADMIN_EMAIL`; the Turnstile widget and its secret are still the owner's.
- The first digest's arrival (step 9's check after 11:00 UTC) is a row a later run adds.
- Nothing else changes: the runbook's steps held as written.

## Test list

- The run-log shape test stays green with the new rows.
- A tester re-reads production, read-only, and confirms each row a read can confirm: the migration list and the two admin tables, the deployments and the current version's D1 binding, nine limiters and the `ADMIN_EMAIL` secret, the domains, the smoke answers including `/admin` on both hosts, the `www` redirect, plain HTTP answering 301, the link, waitlist and admin probes answering 503 with unchanged counts. The limiter's 429 is not re-read, because a re-read spends the quota it checks.
- The rows carry no token, secret value, link or personal address.
