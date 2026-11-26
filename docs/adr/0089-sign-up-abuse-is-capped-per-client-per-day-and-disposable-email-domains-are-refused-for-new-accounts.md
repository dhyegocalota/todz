# 0089. Sign-up abuse is capped per client per day and disposable email domains are refused for new accounts

- Status: Accepted
- Date: 2026-11-26
- Deciders: Claude (the build loop's call, lane `fair-use`) on the owner's brief of 2026-11-26
- Inspired by: [ADR 0045](0045-the-public-sign-in-routes-are-limited-three-ways-and-turnstile-guarded-failing-closed.md) (per-client, per-address and global limits with Turnstile); [ADR 0087](0087-fair-use-limits-are-fixed-numbers-sized-against-workers-paid-allowances-and-configurable-per-server.md)

## Context

Turnstile and the per-minute limits slow a script that signs up, but not one that waits a minute between accounts. A free account is the unit an abuser multiplies, so the cost of an account is what has to rise: a daily cap on how many new accounts one client may open, and a refusal for addresses from disposable mail services, which exist to be thrown away.

## Decision

- **Daily cap.** A sign-in that would create a new owner counts against its client's day: at most 5 new accounts per client (the rate key of [ADR 0045](0045-the-public-sign-in-routes-are-limited-three-ways-and-turnstile-guarded-failing-closed.md), so an IPv6 client is counted by its /64) per UTC day. The count is one row per client and day in `sign_up_usage`, incremented by one conditional upsert that refuses at the cap. Existing owners signing in are never counted.
- **Refusal.** The refusal is `limit_reached` with `limit: daily_sign_ups` and a `Retry-After` to the next UTC midnight, status 429. It is decided before the owner row exists, so a refused client creates nothing.
- **Disposable domains.** A new owner whose sign-in address (the provider subject of the email provider) is on the vendored list is refused with `sign_up_refused` (403). The list is `apps/api/src/disposable-email-domains.ts`, a hand-maintained array of domains of well-known disposable mail services; it is updated by hand in a reviewed commit. Existing owners are never refused by it, so a list update cannot lock anyone out.
- **Fail closed on the count.** If the sign-up counter cannot be written, the sign-up is refused as unavailable. [ADR 0073](0073-a-signed-in-limiter-that-is-missing-or-down-serves-the-request-only-a-refusal-stops-it.md) serves signed-in requests when a limiter is down; a sign-up is not a signed-in request and is the one thing this cap exists to count.
- The per-minute limits, Turnstile and the global limit of [ADR 0045](0045-the-public-sign-in-routes-are-limited-three-ways-and-turnstile-guarded-failing-closed.md) are unchanged and run first.

## Alternatives considered

| Option | Pros | Cons | Why not |
|---|---|---|---|
| Verify the domain's mail exchanger at sign-up | Catches new disposable services | A DNS lookup in the sign-in path; slow and unreliable from a Worker | The vendored list is cheap and auditable |
| Block at sign-in for every owner on the list | Simplest | Locks out an existing owner when the list changes | The list only gates the creation of an owner |
| No per-client day cap; rely on Turnstile | No new storage | A solver farm still mints accounts | Turnstile raises cost per account; a day cap bounds the count per client |
| Cap by address domain instead of client | Catches one provider's floods | Legitimate users of one domain are capped together | Client is the unit an abuser controls less easily |

## Consequences

- One more D1 row per new account; the same statement batch deletes counter rows for earlier days, so the table stays one day deep.
- The list is short by design; coverage is partial and the docs say so. Anyone can add a domain by a reviewed commit.
- Client counts are stored as an HMAC-SHA-256 of the client rate key under the Worker secret `SIGN_UP_KEY_SECRET`, never as a raw IP and never as an unkeyed hash, which could be turned back into an address by trying every address. A Worker without the secret refuses a new account's sign-up with 503 `sign_in_unavailable` (an existing owner still signs in). The secret is put once, as the deploy runbook's step 25 says.
- A listed domain also matches its subdomains and a trailing dot (`mail.mailinator.com`, `mailinator.com.`); a longer unrelated name that merely ends in the same letters does not.

## Evidence

- `apps/api/test/owner-sign-up-limits.test.ts`: the sixth new account from one client is refused and writes nothing; an existing owner signs in past the cap; a listed domain is refused for a new owner and accepted for an existing one.

## Revisit when

- Accounts are created by a route other than the email sign-in (a second provider).
- Abuse arrives from addresses on services the list does not cover, which the admin's Top usage view makes visible.
