# 0050. The waitlist answers alike for every address, mails once, and is guarded like sign-in

- Status: Proposed; amends [0049](0049-todz-app-is-served-by-the-same-worker-dispatched-by-host-in-three-features.md) §3.2 (a confirmation mail in v1). The plan review answers in `docs/features/landing-waitlist/spec.md` (R5, R8, R11) refine §3 to §5: one up-front guard, the statuses 200, 429 and 503, and one `INSERT … ON CONFLICT DO NOTHING` that claims the mail in a `confirmation_claimed_at` column.
- Date: 2026-11-25
- Deciders: Claude (the build loop's call, pending the owner); Dhyego Calota (owner) asked for "uma landing page hiper mega simples com fila de espera … pra ser um prod ready mesmo", for the waitlist confirmation mail through the same React Email and Cloudflare Email Service as `transactional-email`, and for a rate limit and Turnstile on every public endpoint, failing closed (PROMPT.md "Landing" and "Security"), and may overturn the details
- Inspired by: zapbip's `site/join-route.ts`, `site/join-waitlist.ts` and `site/welcome-delivery.ts` (read-only), [ADR 0045](0045-the-public-sign-in-routes-are-limited-three-ways-and-turnstile-guarded-failing-closed.md), [ADR 0049](0049-todz-app-is-served-by-the-same-worker-dispatched-by-host-in-three-features.md) §3.2, the run-13 research in `todz-loop/notes/landing-research.md`

## Context

`landing` shipped the form on `todz.app`; `POST /join` answers "The waitlist opens soon." and never reads the body. The next step stores the address, mails a confirmation, and feeds `landing-admin`'s list and digest. The form is public: anyone can type anyone's address, and every accepted address costs a mail from `noreply@todz.app`, whose sending reputation sign-in depends on.

## Decision

1. **One table.** D1 migration `0005_waitlist.sql` adds a STRICT `waitlist` table: the normalised address as the primary key, `joined_at`, `confirmation_claimed_at` and `confirmation_failed_at` (milliseconds, the last two nullable). No referral code, no name, no locale.
2. **The same answer for every address.** A joined address, a new one and one already on the list all answer the same "You're on the list." notice, so the form never says whether an address is known.
3. **One mail per address, ever.** The first join claims the mail in the same statement that stores it (`INSERT … (address, joined_at, confirmation_claimed_at) VALUES (?1, ?2, ?2) ON CONFLICT (address) DO NOTHING`, claimed when one row changed; `confirmation_claimed_at` means claimed, not delivered) and sends a short confirmation mail through `waitUntil`; a later join of the same address sends nothing. A failed send records `confirmation_failed_at` and is not retried in this feature. The mail says how the address got there and that ignoring it is fine. It is single opt-in: the address is on the list from the first join.
4. **Guarded like sign-in (ADR 0045), on its own namespaces.** Before anything is stored or sent:
   - a per-client limit (`WAITLIST_LIMITER`, namespace 8604) before Turnstile;
   - Turnstile siteverify with action `waitlist` and hostname the `SITE_ORIGIN` host, failing closed;
   - a per-address limit on the address digest (`WAITLIST_ADDRESS_LIMITER`, 8605) and a global limit (`WAITLIST_GLOBAL_LIMITER`, 8606).

   A missing binding, a missing client address, a missing site key or secret, or a siteverify outage answers the "opens soon" notice and stores nothing. A refusal answers one generic "Try again in a minute." notice. Only a site host whose `SITE_ORIGIN` is local skips the limits and accepts the dummy token.
5. **A plain form.** The page posts a normal HTML form with the Turnstile widget's hidden field; no `fetch`. The body is read only after the per-client limit, capped at 4 KB, and only as `application/x-www-form-urlencoded`. The address is never logged and never echoed.

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| Same answer, one mail, single opt-in (chosen) | no membership oracle; a mail costs one per address ever; no token table | anyone can add someone else's address once | Turnstile and three limits bound the abuse to one mail per address |
| Double opt-in (a confirm link) | only owners of an address join | a token table, a confirm route and page, a second mail type, and a list that undercounts | heavier than "hiper mega simples"; revisit if abuse appears |
| "Already on the list" for known addresses | friendlier | tells strangers who signed up | the sign-in routes already refuse to leak membership (ADR 0040) |
| A mail on every join | simple | a free mail cannon at any one address | the per-address limit alone would still allow one mail a minute |
| zapbip's referral codes and locale | growth loops | more columns, more copy, more tests | out of scope for todz v1 (ADR 0049) |
| `fetch` from the page | no reload | a `connect-src`, more script, a JSON route | the form works without script, and the landing already re-renders on `/join` |

## Consequences

- `wrangler.jsonc` gains three rate-limit bindings at 8604–8606, pinned in `api-source.test.ts`; the self-host guide names them.
- `TurnstileAction` gains `Waitlist`. The owner's `todz` widget must list `todz.app`; until it exists, production answers "opens soon" as today.
- The landing's CSP gains `https://challenges.cloudflare.com` in `script-src` and `frame-src` when the site key is present.
- `landing-admin` reads the same table for its list, its export and its digest.

## Revisit when

Abuse shows up in the digest (many addresses from one source, or many `+tag` and dotted variants of one inbox, which are distinct addresses here and each get one mail), or the owner wants a double opt-in or referral codes. The global limit counts per Cloudflare location, so a D1 ceiling on claims per hour is the next step if variants of one inbox appear.
