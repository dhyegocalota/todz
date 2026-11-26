# Owner route order

**Status:** Shipped 2026-11-26
**Tier:** 🟡
**Owner approval:** approved by inheritance from `docs/product/README.md` (approved 2026-11-23) and the owner's 2026-11-24 instruction to decide every call; the order is the loop's call in [ADR 0086](../../adr/0086-an-owner-route-checks-the-credential-before-the-app-version.md)
**ADRs:** [0086](../../adr/0086-an-owner-route-checks-the-credential-before-the-app-version.md)
**Not changing:** the 426 body and headers, the minimum version, the public sign-in routes, `/mcp`, `/health`, the rate limits

## Problem

1. `GET /owner` and `GET /owner/workspaces` with no credential answer 426 (the app-version gate) where 401 is the honest answer: the gate ran before the credential was read, so an unauthenticated probe learned about versions and a client with a revoked key was told to upgrade.
2. The landing was reported to answer 500 on an odd download redirect.
3. The landing's `llms.txt` was reported to still say "in development" and "the waitlist is open".

## Change

1. Session routes (every `/owner` route except sign-in, the sign-in method and the sign-in link request): no bearer secret or an unknown one answers 401 first; a known credential with a missing or old version answers 426 next, before the owner limiter spends budget. Public routes keep the version gate first, since they carry no credential (ADR 0086).
2. Pin: every odd path under `/download` and every method answers below 500 on the site host (`download-paths.test.ts`). Findings below.
3. Already true on `main` since [PR #84](https://github.com/dhyegocalota/todz/pull/84) (`agentic-site`): `llms.txt` and `llms-full.txt` say todz is out and name `https://todz.app/download`, and `agentic-site.test.ts` bans the stale phrases from them. Production serves the same. No change.

## Findings

- `/download` and `/download/latest` are static `_redirects` rules written by `scripts/deploy-worker.sh`, not Worker code, and there is no R2 bucket (ADR 0072). A path that is not a staged file falls to the Worker and answers the site 404.
- Probed read-only on `https://todz.app` with `/download/`, `/download//latest`, `/download/latest/x`, `/download/%2e%2e`, `/download/latest?x`, `%00`, `%ZZ`, a missing version, Range and conditional headers on the appcast, and every method: no 5xx. `%00` and `%ZZ` answer 400 from the edge. The 500 could not be reproduced on production or in the Worker harness; the pin stands so a regression is caught.

## Test list

- `apps/api/test/app-version-gate.test.ts`: five unauthenticated session routes with no version header answer 401; an unknown credential with an old version answers 401; a known credential with an old version answers 426 and spends no owner limiter budget; the existing 426 cases stay green.
- `apps/api/test/download-paths.test.ts`: pin, odd paths by three methods never answer 5xx; an unstaged version answers the empty 404.
