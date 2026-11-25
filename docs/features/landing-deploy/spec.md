# Landing deploy

**Status:** Shipped 2026-11-25
**Tier:** 🟢
**Owner approval:** approved 2026-11-25 by PROMPT.md "Publishing on todz.app" (the loop runs `deploy-the-api.md` from `main` and records it) and [ADR 0044](../../adr/0044-the-wrangler-configuration-is-production-on-api-todz-app-and-development-overrides-it.md) §6
**ADRs:** [0044](../../adr/0044-the-wrangler-configuration-is-production-on-api-todz-app-and-development-overrides-it.md), [0049](../../adr/0049-todz-app-is-served-by-the-same-worker-dispatched-by-host-in-three-features.md)
**Not changing:** code, configuration, the Turnstile widget (the owner's step 10). The 🔴 change itself, the new public hosts and their DNS records, was reviewed in `landing` (PR #25); this folder only records its run.

## Problem

`landing` merged as PR #25 at fe34431, and the loop ran `docs/runbooks/deploy-the-api.md` from `main` to put it live: `todz.app` and `www.todz.app` attached to `todz-api` as version `bafcf42c-9857-4ada-9ff1-6d1d068711dc`. Step 16 asks for the run's rows in a pull request.

## Change

- The run log gains one row per step, 1 to 15. Step 10 is not run (the owner's widget). Step 15 ran once after the reviews, because the security review asked for proof of the limit through the new host dispatch.
- Nothing else changes: the runbook's steps held as written.

## Test list

- The run-log shape test stays green with the new rows.
- A tester re-reads production, read-only, and confirms each row a read can confirm: the three domain entries, the version at 100 percent with its D1 binding, the site and API smoke answers, the www redirect, plain HTTP answering 301, and `sign_in_unavailable`.
- The rows carry no token, secret, link or address.
