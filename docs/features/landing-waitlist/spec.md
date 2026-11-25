# Landing waitlist

**Status:** Approved
**Tier:** 🔴 (a public write path, a schema migration, mail to strangers' addresses)
**Owner approval:** approved 2026-11-25 by inheritance from the owner's request in PROMPT.md "Landing" ("cria uma landing page hiper mega simples com fila de espera, painel admin, digest etc … pra ser um prod ready mesmo"; the waitlist confirmation mail) and "Security" (a rate limit and Turnstile on every public endpoint, failing closed). The behaviour is the loop's call in [ADR 0050](../../adr/0050-the-waitlist-answers-alike-for-every-address-mails-once-and-is-guarded-like-sign-in.md).
**ADRs:** [0050](../../adr/0050-the-waitlist-answers-alike-for-every-address-mails-once-and-is-guarded-like-sign-in.md), [0049](../../adr/0049-todz-app-is-served-by-the-same-worker-dispatched-by-host-in-three-features.md), [0045](../../adr/0045-the-public-sign-in-routes-are-limited-three-ways-and-turnstile-guarded-failing-closed.md), [0046](../../adr/0046-the-app-solves-the-challenge-in-a-web-view-and-the-link-page-solves-it-for-the-sign-in.md), [0042](../../adr/0042-emails-are-react-email-templates-rendered-at-build-time-into-a-generated-module.md), [0043](../../adr/0043-mail-leaves-through-cloudflare-email-service-from-noreply-at-todz-app.md)
**Not changing:** the API host; the sign-in routes and their limiters; the admin, the list, the export and the digest (`landing-admin`); the page's layout and copy outside the form's notices

## Problem

The landing's form answers "The waitlist opens soon." and keeps nothing. The owner wants a production-ready waitlist: the address kept, a confirmation mail, and the same abuse guard as sign-in.

## Goals

- `POST https://todz.app/join` with a solved Turnstile check keeps the address and answers the landing with "You're on the list. Check your inbox." under the form that posted.
- The first join of an address sends one confirmation mail from `noreply@todz.app`, a React Email template rendered at build time like the sign-in and welcome mails. A later join of the same address sends nothing and answers the same.
- Every refusal stores nothing and sends nothing:
  - over a limit, or a refused or missing challenge: "Couldn't add you right now. Try again in a minute.";
  - a guard that is not configured (no site key, no secret, no binding, no client address) or a siteverify outage: "The waitlist opens soon.", as today.
- The Turnstile widget sits in both forms when the site key is present, with action `waitlist`. Without a site key the forms render as today and `/join` answers "opens soon".
- The address is never logged, never echoed, and never in a URL.

## Non-goals

- Double opt-in, unsubscribe, referral codes, locales, retries of a failed mail.
- The admin list, the export, the digest (`landing-admin`).

## Design

### Data flow

```
POST todz.app/join
  → per-client limit (WAITLIST_LIMITER, key = route + clientRateKey(CF-Connecting-IP))   refusal → "try again"; unguarded → "opens soon"
  → body: urlencoded only, ≤ 4 KB; fields email, cf-turnstile-response, form (join | final)   bad body → "try again"
  → address normalised (trim, lowercase) and checked (one @, ≤ 254)                             invalid → "try again"
  → Turnstile siteverify (action waitlist, hostname = SITE_ORIGIN host)                         refused → "try again"; unavailable → "opens soon"
  → per-address limit (digest of the address) and global limit                                  refusal → "try again"
  → INSERT … ON CONFLICT DO NOTHING into waitlist
  → claim: UPDATE … SET confirmation_sent_at WHERE confirmation_sent_at IS NULL
      claimed → waitUntil(send confirmation; on failure set confirmation_failed_at)
  → 200, the landing with "You're on the list." under the posting form
```

### Interfaces

- `apps/api/migrations/0005_waitlist.sql`: `waitlist(address TEXT PRIMARY KEY, joined_at INTEGER NOT NULL, confirmation_sent_at INTEGER, confirmation_failed_at INTEGER) STRICT`.
- `apps/api/src/site/waitlist-join.ts`: `serveWaitlistJoin({ request, env, executionContext })`, the route behind `POST /join` in `site-endpoint.ts`.
- `apps/api/src/site/waitlist-store.ts`: `joinWaitlist({ database, address, now })` answering whether this join claimed the confirmation, and `recordConfirmationFailure(...)`.
- `apps/api/src/site/waitlist-limiter.ts`: the three limits, reusing `clientRateKey` and `digestCredential`, keyed and typed on its own enum, failing closed as `sign-in-limiter.ts` does.
- `TurnstileAction.Waitlist = 'waitlist'` in `turnstile.ts`; `verifyTurnstileToken` unchanged. The local predicate keys on `SITE_ORIGIN` (`landing` R14).
- `LandingNotice` gains `Joined` and `TryAgain`; `serveLandingPage({ notice, form, siteKey })` places the notice under the form that posted and the widget in both forms when a site key exists.
- The landing's CSP adds `https://challenges.cloudflare.com` to `script-src` and `frame-src` only when the widget renders (`turnstilePagePolicy`'s origin constant is reused).
- `scripts/emails/waitlist-template.ts` and `waitlist-email-copy.ts`; `EmailTemplateName.Waitlist`; `src/emails/waitlist-mail.ts`; `pnpm emails:generate`.
- `wrangler.jsonc`: `WAITLIST_LIMITER` 8604 (10 / 60 s), `WAITLIST_ADDRESS_LIMITER` 8605 (3 / 60 s), `WAITLIST_GLOBAL_LIMITER` 8606 (60 / 60 s); `env.ts` and `api-source.test.ts` follow.
- `docs/self-host.md` names the three namespaces; the deploy runbook's step 8 expects six limiters and gains a waitlist smoke check that a post with an unsolved token stores nothing.

### Failure handling

| Case | Outcome |
|------|---------|
| No `CF-Connecting-IP`, or a missing waitlist binding, on a public site host | "opens soon", nothing stored |
| No `TURNSTILE_SITE_KEY` or `TURNSTILE_SECRET_KEY` | the page renders without the widget; `/join` answers "opens soon" |
| siteverify times out or answers an own-fault code | "opens soon", nothing stored |
| siteverify refuses, or the action or hostname differ | "try again", nothing stored |
| A limiter refuses | "try again", nothing stored |
| A body that is not urlencoded, over 4 KB, or without a valid address | "try again", nothing stored |
| The same address joins twice | "You're on the list." both times; one row, one mail |
| The mail fails | the join still answers "You're on the list."; `confirmation_failed_at` is set; nothing logs the address |
| D1 fails | "try again"; nothing sent |

## Open questions → answers

| Question | Options | Owner's answer | Date |
|----------|---------|----------------|------|
| Opt-in | single with a notice mail / double with a confirm link | Loop's call (ADR 0050): single, one mail per address ever | 2026-11-25 |
| Known address | same answer / "already on the list" | Loop's call (ADR 0050): the same answer | 2026-11-25 |
| Transport | plain form post / `fetch` | Loop's call (ADR 0050): plain form | 2026-11-25 |
| Limits | 10, 3 and 60 a minute on 8604–8606 | Loop's call, mirroring ADR 0045's shape | 2026-11-25 |

## Test strategy summary

- **Red first:** the store (insert, idempotence, one claim), the limiter (each limit, fail closed), the join route (every row of the failure table), the page's notices and the CSP with and without the widget, the mail template.
- **Shape:** the three namespaces, the migration, the generated mail fresh.
- **E2E:** with the dummy keys on a local site host, a join shows "You're on the list.", a second join of the same address too, and the console sender prints one mail.
- **The tester's walk:** both forms in light and dark at 1280 and 375, the notices, and a D1 read that shows one row.
