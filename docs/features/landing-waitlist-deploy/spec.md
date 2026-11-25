# Landing waitlist deploy

**Status:** Building
**Tier:** 🟢
**Owner approval:** approved 2026-11-25 by PROMPT.md "Publishing on todz.app" (the loop runs `deploy-the-api.md` from `main` and records it) and [ADR 0044](../../adr/0044-the-wrangler-configuration-is-production-on-api-todz-app-and-development-overrides-it.md) §6
**ADRs:** [0044](../../adr/0044-the-wrangler-configuration-is-production-on-api-todz-app-and-development-overrides-it.md), [0050](../../adr/0050-the-waitlist-answers-alike-for-every-address-mails-once-and-is-guarded-like-sign-in.md)
**Not changing:** code, configuration, the Turnstile widget (the owner's step 10). The 🔴 change itself, migration 0005, the join route and its three limiters, was reviewed in `landing-waitlist` (PR #27); this folder only records its run.

## Problem

`landing-waitlist` merged as PR #27 at 6a65b68, and the loop ran `docs/runbooks/deploy-the-api.md` from `main` to put it live: migration `0005_waitlist.sql` applied to `todz-directory`, and `todz-api` deployed as version `15252c7f-ec20-42f9-9e53-17db3a4c7ba1` with the six limiters. Step 16 asks for the run's rows in a pull request.

## Change

- The run log gains one row per step, 1 to 15. Step 10 is not run (the owner's widget).
- Nothing else changes: the runbook's steps held as written.

## Test list

- The run-log shape test stays green with the new rows.
- A tester re-reads production, read-only, and confirms each row a read can confirm: the migration list, the `waitlist` table, the version at 100 percent with its D1 binding and six limiters, the smoke answers, the waitlist probe answering 503 with a count of 0, and `sign_in_unavailable`.
- The rows carry no token, secret, link or address.
