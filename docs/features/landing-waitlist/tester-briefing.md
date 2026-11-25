# Tester briefing: Landing waitlist

Written by the developer sub-agent when its steps are done. The developer does not run `test-plan.md` and does not declare the feature works.

## What changed

- <file or module> — <one line>

## How to run

```bash
<commands to start the stack and open the feature>
```

## Red today, green after

| Test | Red before the change because | Green after because |
|------|--------------------------------|---------------------|
| `<path>::<name>` |  |  |

## Hypotheses to attack

Every "it works" is a hypothesis the tester tries to break.

1. Hypothesis: <claim>. Break it by: <suggested attack>.

## Known gaps

- <what the developer knows is missing or untested>

## G1: the store, the guard and the route

Written by the G1 developer on `feat/landing-waitlist-store`. The page and the mail are G2's; until the lanes merge, `landing-page.ts` ignores `siteKey` and renders the opens-soon text for every notice, and `waitlist-mail.ts` is a stub.

### What changed

- `apps/api/migrations/0005_waitlist.sql`: STRICT `waitlist` (`address` primary key, `joined_at`, `confirmation_claimed_at`, `confirmation_failed_at`).
- `apps/api/src/site/waitlist-store.ts`: `joinWaitlist` runs one `INSERT … VALUES (?1, ?2, ?2) ON CONFLICT (address) DO NOTHING` and claims the mail when `meta.changes === 1` (R11); `recordConfirmationFailure`.
- `apps/api/src/site/waitlist-limiter.ts`: `isWaitlistUnguarded`, `waitlistClientRefusal`, `waitlistAddressRefusal`, `waitlistGlobalRefusal`. Keys: `/join:<clientRateKey>`, `/join:<address digest>`, `/join`. Refusal → TryAgain; a missing binding, a missing `CF-Connecting-IP` or a throwing limiter → OpensSoon.
- `apps/api/src/local-origin.ts`: `isLocalSiteHost` (R4).
- `apps/api/src/email-address.ts`: `normalizedAddress`, moved from `sign-in-links.ts` (R6), named in AGENTS.md.
- `apps/api/src/site/waitlist-join.ts`: `serveWaitlistJoin` and `waitlistSiteKeyOf`, in the order of the plan: the up-front guard (R5), the client limit, `Content-Length` ≤ 4096 (R12), urlencoded, `normalizedAddress`, the token shape (R10), siteverify with `TurnstileAction.Waitlist` and the `SITE_ORIGIN` hostname (R4), the global cap then the address limit, the store, the mail through `waitUntil`. Statuses: Joined 200, TryAgain 429 with `Retry-After: 60`, OpensSoon 503 (R8).
- `apps/api/src/site/site-endpoint.ts` and `src/index.ts`: the site host gets the whole `HostContext` (R2); `GET`/`HEAD /` render the page with `waitlistSiteKeyOf(env)`; `POST /join` goes to `serveWaitlistJoin`.
- `apps/api/src/turnstile.ts`: `TurnstileAction.Waitlist`. `apps/api/src/turnstile-page.ts`: exports `SITE_KEY_PATTERN`, `TURNSTILE_ORIGIN` and a new `usableSiteKeyOf`, which `serveTurnstilePage` now uses.
- `apps/api/src/env.ts`, `apps/api/wrangler.jsonc`: `WAITLIST_LIMITER` 8604 (10/60 s), `WAITLIST_ADDRESS_LIMITER` 8605 (3/60 s), `WAITLIST_GLOBAL_LIMITER` 8606 (60/60 s). `libs/types/src/constants.ts`: the three maxima and `WAITLIST_RATE_LIMIT_PERIOD_SECONDS`.
- Tests: `test/waitlist-store.test.ts`, `test/waitlist-limiter.test.ts`, `test/waitlist-join.test.ts`, `test/email-address.test.ts`, helper `test/waitlist-client.ts`; `test/site-dispatch.test.ts` (POST /join → 503), the "through the Worker" block and the R14 import pin of `test/site-pages.test.ts`, `test/worker.test.ts` (nine directory tables), `tools/repository-shape/src/api-source.test.ts`.

### How to run

```bash
pnpm install --frozen-lockfile --offline
pnpm typecheck
pnpm --filter @todz/api test:unit
pnpm --filter @todz/api exec vitest run --project workers test/waitlist-join.test.ts test/waitlist-limiter.test.ts test/waitlist-store.test.ts
pnpm --filter @todz/repository-shape exec vitest run
```

### Red today, green after

| Commit | Test | Red text the run printed | Green after |
|------|------|--------------------------|-------------|
| 649d83d | `waitlist-store.test.ts`, 6 tests | `Error: joinWaitlist is not implemented` (5), `Error: recordConfirmationFailure is not implemented` (1) | bfdb2f0 |
| 4536123 | `waitlist-limiter.test.ts`, 27 tests | `Error: waitlistClientRefusal is not implemented` (10), `Error: waitlistAddressRefusal is not implemented` (5), `Error: waitlistGlobalRefusal is not implemented` (5), `Error: isWaitlistUnguarded is not implemented` (5) | 3d3ba18 |
| 527c6b5 | `waitlist-join.test.ts`, 58 tests | `Error: serveWaitlistJoin is not implemented` (58) | 58b8879 |
| d8bdf6d | `site-dispatch.test.ts` "POST /join with no Turnstile keys …" and "… with the Turnstile keys but no waitlist limiter …" | `AssertionError: expected 200 to be 503 // Object.is equality` | f3151ff |
| d8bdf6d | `site-pages.test.ts` "POST /join with the dummy token answers the joined landing …" | `AssertionError: expected "log" to be called 1 times, but got 0 times` | f3151ff |
| d8bdf6d | `site-pages.test.ts` "POST /join without a token answers the try-again landing …" | `AssertionError: expected null to be '60' // Object.is equality` | f3151ff |
| d8bdf6d | `api-source.test.ts` "the wrangler configuration limits sign-in and the waitlist …" | `AssertionError: expected [ …(3) ] to deeply equal [ …(6) ]` | f3151ff |

Pins (green when they landed): `email-address.test.ts` (d2dda62); `site-pages.test.ts` `GET`/`HEAD /` through the Worker with the configured key (equal today only because the stub ignores the key); `api-source.test.ts` "every rate-limit binding … is an optional RateLimit"; the amended R14 import pin (3d3ba18; mutation: importing `isLocalHost` into `waitlist-limiter.ts` turns it red). `worker.test.ts` "lists exactly the nine directory tables" was red between bfdb2f0 and ce8653f.

Mutations run on `waitlist-join.ts`: accepting a missing `Content-Length` reddens "no Content-Length, before the body is read"; dropping `recordConfirmationFailure` reddens "a mail that fails still answers joined, records the failure and logs nothing".

### Hypotheses to attack

1. No refusal stores a row or sends a mail. Break it by: each failure row with a fresh address, then `SELECT COUNT(*) FROM waitlist`.
2. An unguarded production (no site key, no secret, no binding, no `CF-Connecting-IP`, the console sender on a public host) answers 503 without reading the body or touching a limiter. Break it by: posting to `https://todz.app/join` shapes on a stack with one piece missing at a time.
3. Only a site host whose `SITE_ORIGIN` and request are both local skips the limits and takes `TURNSTILE_DUMMY_TOKEN`; a local `PUBLIC_ORIGIN` alone does not. Break it by: public `SITE_ORIGIN`, local `PUBLIC_ORIGIN`, dummy token.
4. Two concurrent joins of one address send one mail. Break it by: firing many parallel posts of one address at `wrangler dev` and counting console mails.
5. The answer never echoes or logs the address, including when the mail throws. Break it by: an address with markup, a failing sender, and reading the Worker log.
6. `Maria@X.COM` and `maria@x.com` are one row and one address bucket. Break it by: joining both, then reading the table.

### Known gaps and decisions

- The global cap is checked before the address limit, as sign-in does (commit 0c010e6), so a capped join never spends an address slot.
- The page gets a site key only when the key is usable and a secret exists (`waitlistSiteKeyOf`), following the failure table's "no key or secret: the page renders without the widget".
- `self-host.test.ts` "the rate-limit namespaces it names are the configured ones" is red on this lane until the guide names 8601–8606 (R17, the lead's).
- `apps/api/e2e/landing.spec.ts` (G2's) still expects the opens-soon answer; on this lane a join without a widget token answers try again.
- `site-pages.test.ts` (G2's): besides the R14 pin and the Worker block, the `landingPage` helper passes `siteKey: null` and the `vitest` import gains `vi`, both needed to compile.
- `joined_at` and `confirmation_failed_at` come from `Date.now()` inside the route, since `serveWaitlistJoin` takes no `now`; the tests bound them instead of matching exact values.
- No retry of a failed mail; `confirmation_claimed_at` stays set, so a later join sends nothing (tested).
- `vitest.config.mts` needed no change: the Miniflare bindings come from `wrangler.jsonc`.
