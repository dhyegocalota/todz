# 0045. The public sign-in routes are limited three ways and Turnstile-guarded, failing closed

- Status: Proposed; amends [0044](0044-the-wrangler-configuration-is-production-on-api-todz-app-and-development-overrides-it.md) §4 and [0040](0040-the-owner-signs-in-with-an-email-link-bound-to-the-mac-that-asked-for-it.md)'s refusal codes
- Date: 2026-11-24
- Deciders: Claude (the build loop's call, pending the owner); Dhyego Calota (owner) asked for it on 2026-11-24 ("o send link: cuidado pra não abusarem do servidor, queremos captcha e rate limit"; PROMPT.md "Security") and may overturn the details
- Inspired by: zapbip's `apps/api/src/site/turnstile.ts` and `site/join-route.ts` (read-only), [Turnstile server-side validation](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/), [Workers rate limiting](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)

## Context

Three routes answer without a session: `GET /owner/sign-in-method`, `POST /owner/sign-in-links` (sends a mail) and `POST /owner/sessions` (spends a link). After ADR 0044 the two posts carry a per-client limit of 10 a minute, and sending carries ADR 0040's five links per address per 15 minutes. Nothing stops a botnet spread over many addresses from mailing strangers through `noreply@todz.app`, which burns the domain's sending reputation. The limiter also fails open: with no binding or no `CF-Connecting-IP` it lets the request through. The owner wants a captcha and rate limits on every public endpoint, failing closed.

## Decision

1. **Three limits, before anything else costs money.** On a public host, every public route passes, in order:
   - a per-client limit, `SIGN_IN_LIMITER`, keyed by route and client address as ADR 0044 §4 keys it (10 a minute);
   - a global cap, `SIGN_IN_GLOBAL_LIMITER`, keyed by route alone (100 a minute per Cloudflare location, which is how Workers rate limits count);
   - on `POST /owner/sign-in-links` only, after the body parses, a per-address limit, `SIGN_IN_ADDRESS_LIMITER`, keyed by the SHA-256 digest of the normalized address, never the address itself (3 a minute). ADR 0040's five per 15 minutes in D1 stays behind it.

   The local-host skip of ADR 0044 §4 stays for all three.
2. **Turnstile on every write.** `POST /owner/sign-in-links` always, and `POST /owner/sessions` whenever the provider is `email`, require a `turnstile_token` (1 to 2048 characters of `[A-Za-z0-9._-]`). The Worker posts it to siteverify with `TURNSTILE_SECRET_KEY` and the client address, with a 5-second timeout, and accepts it only when `success` is true, `hostname` is `PUBLIC_ORIGIN`'s host and `action` is the route's own: `request_link` or `sign_in`. A token is spent once by Cloudflare, so a replay is refused. The fake provider is exempt because it answers only on a local host (ADR 0044 §7). `GET /owner/sign-in-method` writes nothing and returns a constant, so it is limited but never challenged.
3. **Fail closed.** A missing limiter binding, a missing client address on a public host, a missing `TURNSTILE_SECRET_KEY`, a siteverify that times out, errors or answers malformed JSON: each answers 503 `sign_in_unavailable`, and the link is neither created nor spent.
4. **One refusal.** Every limit (client, global, address, and ADR 0040's D1 count) and every refused token answer 429 `sign_in_refused` with `Retry-After: 60`. `too_many_links` and `too_many_requests` go away. The answer never depends on whether the address has an account.
5. **Development.** On a local host (`PUBLIC_ORIGIN` and the request both local, the fake provider's test), the Worker accepts Cloudflare's documented dummy token `XXXX.DUMMY.TOKEN.XXXX` without a network call, and the dev scripts pass Cloudflare's always-passing test site key `1x00000000000000000000AA`, whose widget yields that token. Any other token on a local host still goes to siteverify.
6. **Configuration.** `TURNSTILE_SITE_KEY` is a var and `TURNSTILE_SECRET_KEY` a Worker secret, put with `wrangler secret put` after the first deploy. Until both exist, production answers `sign_in_unavailable` on the two posts. The limits are constants in `libs/types`; the two new rate-limit bindings take `namespace_id` `8602` and `8603`.
7. **Logs.** Nothing on these paths writes the address, the link token or the Turnstile token to a log.

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| Bindings plus Turnstile, failing closed (chosen) | no zone rule, no extra token permission; a botnet must solve a challenge per mail | siteverify is one more network call per post | the owner asked for both |
| A WAF rate-limiting rule on the zone | no code | needs a WAF permission the token lacks; counts at the edge without the address | the address limit needs the body |
| Turnstile only on sending | simpler app | spending a link stays open to token guessing at 10 a minute per client | the owner's "every public endpoint" |
| Keep distinct refusal codes | the app can say which limit | tells a prober which limit hit | the owner's generic message |
| Fail open when siteverify is down | sign-in survives a Cloudflare outage | an attacker who can make siteverify slow gets through | the owner's "failing closed" |

## Consequences

- The app needs a Turnstile token before each link request and each sign-in: [ADR 0046](0046-the-app-solves-the-challenge-in-a-web-view-and-the-link-page-solves-it-for-the-sign-in.md).
- The deploy runbook gains the widget and the secret; production sign-in stays closed until the owner creates the widget, because the `todz-cloudflare` token lacks Turnstile Edit (checked 2026-11-24: listing widgets succeeds, creating one answers `10000 Authentication error`).
- A Cloudflare outage of siteverify stops sign-in; existing sessions keep working.

## Evidence

On 2026-11-24 the token listed the account's Turnstile widgets and was refused `POST /accounts/{account}/challenges/widgets` with code 10000. Cloudflare documents the test site key `1x00000000000000000000AA`, the test secret `1x0000000000000000000000000000000AA` and the dummy token `XXXX.DUMMY.TOKEN.XXXX` for development.

## Revisit when

Sign-in gains a second public route, the owner moves to a WAF plan, or Turnstile's per-widget limits bite.
