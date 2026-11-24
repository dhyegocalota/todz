# Sign in with an email link

**Status:** In review
**Tier:** 🔴
**Owner approval:** approved 2026-11-24 by the owner's queue (publish todz on `todz.app`: "an email magic link becomes the real `SignInProvider` behind the existing port; the fake provider stays for development; Sign in with Apple comes later"), within [the product design](../../product/README.md); the flow, the device binding and the email port are [ADR 0040](../../adr/0040-the-owner-signs-in-with-an-email-link-bound-to-the-mac-that-asked-for-it.md) and [ADR 0041](../../adr/0041-outgoing-email-goes-through-a-port-with-a-console-sender-for-development.md), the loop's calls, listed in the loop's questions for the owner
**ADRs:** [0040](../../adr/0040-the-owner-signs-in-with-an-email-link-bound-to-the-mac-that-asked-for-it.md), [0041](../../adr/0041-outgoing-email-goes-through-a-port-with-a-console-sender-for-development.md), [0020](../../adr/0020-sign-in-goes-through-a-provider-port-and-v1-ships-only-the-fake.md), [0021](../../adr/0021-owner-sessions-are-bearer-secrets-that-last-90-days.md), [0025](../../adr/0025-the-session-secret-lives-in-a-private-file-until-the-app-has-a-team.md)
**Not changing:** sessions (ADR 0021), the fake provider and every walk that uses it, the MCP keys, the Cloudflare mail sender and the HTML email (`transactional-email`), the deploy (`deploy-ready`)

## Problem

A deployed Worker has no sign-in: the only provider is the fake, which never deploys (ADR 0020). The owner cannot use todz on `todz.app` until a real provider exists, and Sign in with Apple waits for the paid membership.

## Goals

- The owner types an address in the app, receives a link, clicks it, and the app that asked is signed in.
- A link works once, for 15 minutes, only in the app that asked for it.
- The answer to "send me a link" never says whether an owner exists.
- Development keeps the fake identity field; a development Worker can also run the email kind and print the link in its console.
- A Worker without a provider, an origin or a sender fails closed with 503.

## Non-goals

- The mail itself beyond plain text (the HTML template and the Cloudflare sender are `transactional-email`), Sign in with Apple, a code to type, a web app, signing out other devices.

## Design

### Data flow

```
App                               Worker                              Mail
 │ GET /owner/sign-in-method ───▶ {"method":"link"}
 │ verifier = 32 random bytes; keeps {email, verifier, expiry} in a private file
 │ POST /owner/sign-in-links {email, link_challenge = sha256(verifier)}
 │                               ─▶ rate check (5 per address per 15 min)
 │                                  insert sign_in_links(digest(token), email, challenge, expires_at)
 │                                  EmailSender.send(text with https://<origin>/sign-in#token=…) ──▶ inbox
 │ ◀── 202 {}                                                          │
 │                                                                     ▼ the owner clicks
 │                               GET /sign-in (static page) ◀── browser
 │ ◀── todz://sign-in?token=… (page script reads the fragment)
 │ POST /owner/sessions {identity_token: token, link_verifier, time_zone}
 │                               ─▶ UPDATE … SET consumed_at WHERE digest, unspent, unexpired, challenge = sha256(verifier) RETURNING email
 │                                  owner by ("email", address); openOwnerSession
 │ ◀── 201 {session_token, owner}
```

### Interfaces

Worker:

- `SignInProviderKind.Email = 'email'`. `SignInProvider.verify({identityToken, linkVerifier, directory, now})` → subject or `null`; the fake ignores the last three.
- `OwnerRoute.ReadSignInMethod`: `GET /owner/sign-in-method` → 200 `{"method":"link"|"identity"}`, 503 `sign_in_unavailable`.
- `OwnerRoute.RequestSignInLink`: `POST /owner/sign-in-links` `{email, link_challenge}` → 202 `{}`; 400 `invalid_request` (address not one line of at most 254 characters with one `@` and a dot after it, or a challenge that is not 64 lower-case hex); 429 `too_many_links`; 503 `sign_in_unavailable` (no `email` kind, no `PUBLIC_ORIGIN`, no sender).
- `OwnerRoute.SignIn` body gains an optional `link_verifier` (43 base64url characters).
- Public routes dispatch from one record keyed by route, as session routes already do.
- `GET /sign-in`: a static HTML page, its copy in a `*-copy.ts` module, `Cache-Control: no-store`, `Referrer-Policy: no-referrer`, a content security policy that allows only its own inline script by hash.
- Migration `0004_sign_in_links.sql`: `sign_in_links(digest TEXT PRIMARY KEY CHECK(length(digest) = 64), email TEXT NOT NULL, challenge TEXT NOT NULL CHECK(length(challenge) = 64), created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, consumed_at INTEGER) STRICT`, an index on `(email, created_at)`.
- `EmailSender` port and the `console` kind (ADR 0041); env gains `EMAIL_SENDER?` and `PUBLIC_ORIGIN?`; the `dev` script keeps `SIGN_IN_PROVIDER:fake` and documents how to run `email`.

App (`TodzKit` and `Todz`):

- `SignInMethod` (`link`, `identity`), read when the sign-in screen opens.
- `OwnerAPI`: `signInMethod()`, `requestSignInLink(email:challenge:)`, `signIn(identityToken:linkVerifier:timeZone:)`.
- `PendingSignInLink` {email, verifier, expiresAt}, kept by a `PendingLinkVault` port with a file adapter on `PrivateFile` in the app's container and an in-memory one for tests.
- `SignInLink(url:)` parses `todz://sign-in?token=…`; `AppDelegate` hands it to `AppModel.redeem(signInLink:)` while signed out, and drops it while signed in.
- The sign-in screen: by method, the identity field (unchanged) or the address field, then a "check your inbox" state; its states, copy and errors are in `design.md`.

### Failure handling

| Case | Worker answer | App shows |
|------|---------------|-----------|
| Address malformed | 400 `invalid_request` | the address hint under the field |
| Sixth link in 15 minutes | 429 `too_many_links` | "Too many links. Wait a few minutes and try again." |
| Sender rejects | 503 `sign_in_unavailable`, the link row deleted | the unavailable line |
| Link expired, spent, unknown, or verifier wrong | 401 `identity_rejected` | "That link has expired or was already used. Send a new one." |
| Link arrives with no pending request on this Mac | nothing sent | "Open the link on the Mac that asked for it, or send a new one." |
| Link arrives while signed in | nothing sent | nothing |
| Offline when asking or redeeming | — | the existing offline sign-in error |

## Plan review answers (2026-11-24)

These bind the build and win over any line above that disagrees.

- **R1, a link the attacker asked for.** An attacker can ask for a link for the owner's address with the attacker's own challenge; if the owner clicks that unasked mail and another app on the owner's Mac catches `todz://`, the attacker redeems it. Accepted as a residual risk in ADR 0040: it needs a hostile app already installed on the owner's Mac. The mail says "If you didn't ask for this, ignore this email." The adversarial claim 3 is attacked this way.
- **R2, an atomic rate limit.** The new row is inserted by one statement, `INSERT … SELECT … WHERE (SELECT count(*) FROM sign_in_links WHERE email = ? AND created_at > ?) < 5`, and `meta.changes` of 0 means 429. Four parallel requests at the limit give exactly the remaining 202s and the rest 429.
- **R3, cross-site posts and lockout.** Public POSTs require `Content-Type: application/json` (with any parameters), else 400 `invalid_request`, so a web page cannot post one without a preflight. The limit is 5 links per address per 15 minutes. Anyone can keep an address at its limit; that is accepted in ADR 0040, and the per-client limit belongs to the zone's rules in `deploy-ready`. The count folds case and spaces like the stored address.
- **R4, a bad time zone never spends a link.** `signIn` checks `time_zone` and the shape of `link_verifier` before `verify`; an invalid time zone answers 422 and the same link then signs in.
- **R5, the challenge.** The verifier is 32 random bytes as 43 base64url characters; the challenge is the lower-case hex SHA-256 of that string's UTF-8 bytes, which is `digestCredential(verifier)`. Both lanes test the vector verifier `AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA` against the challenge the Worker's `digestCredential` gives for it, computed once in G1 and copied into G2's test.
- **R6, the pending link survives.** While a pending link is younger than 15 minutes, Send Again reuses its verifier, so every link of that window redeems. A 401 keeps the pending link unless it is past its expiry; the app erases it only 15 minutes plus a 5 minute margin after it was made, and the server judges expiry.
- **R7, a link during launch.** A link that arrives while the app is still loading is held by the model and redeemed or dropped once `launch()` settles on signed out or signed in; this logic and its test are in G2.
- **R8, failing closed.** `EMAIL_SENDER=console` is honoured only when `PUBLIC_ORIGIN`'s host is `localhost` or `127.0.0.1`; `PUBLIC_ORIGIN` must equal `new URL(PUBLIC_ORIGIN).origin`; otherwise 503 `sign_in_unavailable`. Both have tests.
- **R9, the page and the parser.** `GET /sign-in` sends `Content-Security-Policy: default-src 'none'; script-src 'sha256-…'; style-src 'sha256-…'; img-src data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer` and `Cache-Control: no-store`. Its script accepts a fragment `token=` of exactly `^[A-Za-z0-9_-]{43}$`, calls `history.replaceState` to drop it, and only then builds `todz://sign-in?token=…`; the icon is inline. `SignInLink(url:)` refuses any query item other than one `token`.
- **R10, ADR 0020 amended.** ADR 0040 amends 0020 §1 (the port's input) and §3 (a deployed Worker may now name `email`); 0020 gains an "Amended by 0040" line. `test/sign-in-provider.test.ts` is rewritten for the new input in step 5. `deploy-ready` sets `SIGN_IN_PROVIDER=email` in `wrangler.jsonc` vars.
- **R11, ownership.** G1 also owns `apps/api/src/http-status.ts` and adds a `dev:email` script to `apps/api/package.json`; G3 also owns `Copy/SignInNotice+Copy.swift` and `Todz/AppConfiguration.swift`. `tester-briefing.md` is written by G1 in its lane and extended by G3 after the merge.
- **R12, no enumeration and red first.** A known and an unknown address run the same statements, none on `owners` or `owner_identities` (pinned with a recording D1); expired rows are swept by `expires_at <= now`, never by address. A malformed `link_verifier` is the same 401 `identity_rejected`. Step 7 is split into red and green commits; the URL routing becomes a TodzKit `IncomingLink(url:)` with its red test in G2.

## Open questions → answers

| Question | Options | Owner's answer | Date |
|----------|---------|----------------|------|
| Link or code | link bound to the Mac / six-digit code / both | Loop's call (ADR 0040): link bound by a verifier | 2026-11-24 |
| Link lifetime and rate limit | 15 min, 5 per 15 min / 60 min, 5 per hour | Loop's call (ADR 0040): 15 min, 5 per address per 15 min | 2026-11-24 |
| How the app learns the method | asks the server / a build setting | Loop's call (ADR 0040): `GET /owner/sign-in-method` | 2026-11-24 |
| Development mail | console sender / a dev route listing links | Loop's call (ADR 0041): console sender | 2026-11-24 |

## Test strategy summary

Worker, red first, in Miniflare with real D1: the method route for each kind and none; the link request (202 for known and unknown addresses alike, one row with digests only, the console text carries the link with the configured origin, 400s, 429 on the sixth, 503 with no origin or sender, the row gone when the sender rejects); redeeming (201 and an owner keyed by the address, a second sign-in finds the same owner, 401 for spent, expired, unknown token and wrong verifier, concurrent redeems give one session); the page (no-store, no-referrer, CSP, no token in its HTML). App, red first, in TodzKit: the method decides the form; asking keeps the pending link and sends the challenge of the verifier; a link redeems with the kept verifier and clears it; a link with no pending request, an expired pending one, or while signed in sends nothing; the file vault keeps the file private. A walk: a development Worker with `email` and `console`, the app asks, the link from the console opens the app through the browser page, the app is signed in; and the unhappy paths.
