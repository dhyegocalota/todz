# Landing waitlist

**Status:** In review
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
  → INSERT … (address, joined_at, confirmation_claimed_at) ON CONFLICT DO NOTHING; one changed row claims the mail (R11)
      claimed → waitUntil(send confirmation; on failure set confirmation_failed_at)
  → 200, the landing with "You're on the list." under both forms (R7)
```

### Interfaces

- `apps/api/migrations/0005_waitlist.sql`: `waitlist(address TEXT PRIMARY KEY, joined_at INTEGER NOT NULL, confirmation_claimed_at INTEGER, confirmation_failed_at INTEGER) STRICT`.
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

## Plan review answers

The plan review (2026-11-25, `todz-loop/notes/landing-waitlist-plan-review.md`) said NO with two CRITICAL findings. Each answer below wins over an older line of this spec, the plan or the test plan.

- **R1 (the E2E).**
  - The suite stubs Turnstile: `page.route('https://challenges.cloudflare.com/turnstile/v0/api.js')` answers a small script that writes a `cf-turnstile-response` input holding `TURNSTILE_DUMMY_TOKEN` into every `.cf-turnstile`. The URL is the same, so the CSP still applies, and nothing touches the network.
  - The foreign-request tests allow exactly that one URL. The console tests keep main-frame messages only. The keyboard order adds nothing, because the stub renders no focusable element.
  - Each test joins with an address unique to the test and its project (`test.info().project.name`).
  - The mail count stays in `waitlist-join.test.ts`. The E2E proves the notices.
  - The real dummy widget is proven only by the tester's walk, and coverage honesty says so.
- **R2 (wiring).** G1 owns `src/index.ts`: `[HostKind.Site]` passes the whole `HostContext` (request, `env`, `executionContext`). `SiteRoute` takes that context, and `GET`/`HEAD /` and `POST /join` pass the site key to the page. A test row: `GET /` with a site key renders both widgets.
- **R3 (ownership).**
  - G1 also owns:
    - `src/local-origin.ts`;
    - a new `src/email-address.ts`;
    - `src/sign-in-links.ts` (it imports the moved helper);
    - `src/turnstile-page.ts` (it exports `TURNSTILE_ORIGIN` and `SITE_KEY_PATTERN`);
    - `libs/types/src/constants.ts` (`WAITLIST_RATE_LIMIT_MAX` 10, `WAITLIST_ADDRESS_RATE_LIMIT_MAX` 3, `WAITLIST_GLOBAL_RATE_LIMIT_MAX` 60);
    - the "through the Worker" block of `site-pages.test.ts`.
  - On conflict, the lead keeps G2's `landing-page.ts`, `waitlist-mail.ts` and the generated email module over G1's stubs.
  - Nobody edits `package.json`.
- **R4 (the local predicate).**
  - `local-origin.ts` gains `isLocalSiteHost({ env, request })`: `isLocalOrigin(SITE_ORIGIN) && isLocalOrigin(request.url)`, mirroring `isLocalHost`.
  - The `landing` R14 pin becomes "`src/site` imports only `isLocalSiteHost` from `local-origin`".
  - A red row: a public `SITE_ORIGIN` with a local `PUBLIC_ORIGIN` and `TURNSTILE_DUMMY_TOKEN` answers "try again", calls siteverify and keeps no row.
  - siteverify's hostname is `new URL(SITE_ORIGIN).hostname`.
- **R5 (one up-front guard).**
  - Before any limiter or body read, `POST /join` answers "opens soon" when any of these is missing or unusable:
    - `SITE_ORIGIN`;
    - a site key matching `SITE_KEY_PATTERN`;
    - the secret;
    - a mail sender (`emailSenderOf` with `SITE_ORIGIN` as the public origin);
    - one of the three bindings;
    - `CF-Connecting-IP`.
  - A local site host skips only the bindings and the client address.
  - A limiter that throws also answers "opens soon".
  - Both cases get failure-table rows, with no row stored.
- **R6 (the address).**
  - `normalizedAddress` and its `ADDRESS_PATTERN` move from `sign-in-links.ts` to `src/email-address.ts`, the one shared helper, named in AGENTS.md.
  - Rows:
    - `a@b`, `a b@c.d` and `a@b.c\r\nBcc:x@y.z` answer "try again";
    - `Maria@X.COM` and `maria@x.com` count against one per-address limit.
- **R7 (the notice's place).** No `form` field. Every notice renders under both forms, as the "opens soon" notice does today. The page script focuses the one the URL fragment names. `serveLandingPage({ notice, siteKey })`.
- **R8 (statuses).**

  | Notice | Status |
  |---|---|
  | `Joined` | 200 |
  | `TryAgain` | 429 with `Retry-After: 60` |
  | `OpensSoon` | 503 |

  "The same answer for every address" concerns `Joined`. This amends the `landing` R10 row for `POST /join`, whose "opens soon" was 200 and never read the body. The unguarded production path still reads no body, now with 503.
- **R9 (ADR 0049).** ADR 0050 amends 0049 §3.2 (a confirmation mail), and 0049 says so.
- **R10 (the widget).**
  - Each form gets `<div class="cf-turnstile" data-sitekey data-action="waitlist" data-appearance="interaction-only" data-theme="auto">`, after the capsule and before the note. The layout stays unchanged unless Cloudflare asks for an interaction.
  - `TURNSTILE_SCRIPT_TAG` is included once, and only with a usable key.
  - A submit with an empty or missing token answers "try again" without calling siteverify.
  - `site-pages.test.ts`'s "no remote asset" test narrows to "only `TURNSTILE_SCRIPT_TAG`, only with a key".
  - The page is rendered per notice and per key presence, as `serveTurnstilePage` does.
- **R11 (one statement).**
  - `INSERT INTO waitlist (address, joined_at, confirmation_claimed_at) VALUES (?1, ?2, ?2) ON CONFLICT (address) DO NOTHING`; the join claims the mail when `meta.changes === 1`.
  - The column is `confirmation_claimed_at`, so `landing-admin` never counts a failure as sent.
  - A row: two joins of one address in `Promise.all` leave one row and send one mail.
- **R12 (the 4 KB cap).** A missing `Content-Length`, or one above 4096, answers "try again" before the body is read. Rows: no `Content-Length`; 5 KB.
- **R13 (tests and `waitUntil`).** Rows that assert `confirmation_failed_at` or a sent mail first await `waitOnExecutionContext`.
- **R14 (claim 3).** It reads: "the address never reaches a log, except the console sender's line, which ADR 0041 refuses on a public host".
- **R15 (the mail).**
  - Subject: "You're on the todz waitlist".
  - Heading: "You're on the list."
  - Body: "Thanks for joining the todz waitlist. We'll write once, when todz opens for you." Then: "Didn't sign up? Ignore this mail and you'll hear nothing more."
  - The lockup header, as the other mails have.
  - The `origin` slot is `SITE_ORIGIN`; `/brand/` answers on both hosts.
- **R16 (gates).** The lead adds `apps/api/wrangler.jsonc` and `apps/api/migrations/*` to the `e2e` rows of `verify-gates.tsv`, with a `verify.test.sh` case.
- **R17 (runbook and guide).**
  - Step 8 expects six limiters (8601–8606).
  - A waitlist smoke check after step 13 posts an unsolved token:
    - with no widget: 503 and the "opens soon" text;
    - with the widget: 429 and the "try again" text;
    - `SELECT COUNT(*) FROM waitlist` is read before and after (a count, never addresses) and does not change.
  - The rollback: the table stays, and `wrangler rollback` loses no rows.
  - `docs/self-host.md` names six bindings, 8601 to 8606, and says that without a site key the waitlist stays closed. The lead owns `site:generate`'s output.
- **R18 (more rows).**
  - A key without a secret, and a secret without a key: two rows, each answering "opens soon".
  - A 2049-character token: "try again" with zero `fetcher` calls.
  - siteverify `timeout-or-duplicate`: "try again".
  - siteverify `invalid-input-secret`: "opens soon".
  - An unusable site key: no widget, and "opens soon".

## Test strategy summary

- **Red first:** the store (insert, idempotence, one claim), the limiter (each limit, fail closed), the join route (every row of the failure table), the page's notices and the CSP with and without the widget, the mail template.
- **Shape:** the three namespaces, the migration, the generated mail fresh.
- **E2E:** with the dummy keys on a local site host, a join shows "You're on the list.", a second join of the same address too, and the console sender prints one mail.
- **The tester's walk:** both forms in light and dark at 1280 and 375, the notices, and a D1 read that shows one row.
