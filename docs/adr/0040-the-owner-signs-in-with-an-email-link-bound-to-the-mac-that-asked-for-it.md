# 0040. The owner signs in with an email link, bound to the Mac that asked for it

- Status: Proposed; amends [0020](0020-sign-in-goes-through-a-provider-port-and-v1-ships-only-the-fake.md) §1 (the port's input) and §3 (a deployed Worker may name `email`)
- Date: 2026-11-24
- Deciders: Claude (the build loop's call, pending the owner); Dhyego Calota (owner) queued the magic link on 2026-11-24 and may overturn this
- Inspired by: the owner's queue of 2026-11-24 (publish todz on `todz.app`: "an email magic link becomes the real `SignInProvider` behind the existing port"), [ADR 0020](0020-sign-in-goes-through-a-provider-port-and-v1-ships-only-the-fake.md), [ADR 0021](0021-owner-sessions-are-bearer-secrets-that-last-90-days.md), [ADR 0025](0025-the-session-secret-lives-in-a-private-file-until-the-app-has-a-team.md)

## Context

ADR 0020 left the Worker with one sign-in provider, the fake, which a deployed Worker never selects, so production has no way in. Sign in with Apple needs the paid membership, which waits. An email link needs nothing the owner has not already bought. The link is opened by a mail client in a browser, possibly on another device, and the macOS app is sandboxed with no listening port, so the only way back into the app is its `todz://` scheme, which any other app on the Mac may also claim. Mail scanners fetch links before the person does.

## Decision

1. A second provider kind, `email`, beside `fake`, chosen by the same `SIGN_IN_PROVIDER` variable. Its subject in `owner_identities` is the address, trimmed and lower-cased; a later Apple identity adds rows, never columns (ADR 0020).
2. `GET /owner/sign-in-method` is public and answers `{"method":"link"}` for `email` and `{"method":"identity"}` for `fake`, or 503 `sign_in_unavailable` with no provider; the app shows the form that matches.
3. **Asking.** The app makes a random 32-byte verifier and keeps it; `POST /owner/sign-in-links` is public and takes `{email, link_challenge}`, where the challenge is the verifier's SHA-256 in hex. The Worker stores a new link in D1 `sign_in_links`: the digest of a fresh 32-byte token, the address, the challenge, `created_at`, `expires_at` 15 minutes later and an empty `consumed_at`, then mails `https://<origin>/sign-in#token=<token>`. It answers 202 with an empty body for every well-formed address, known or not, so the answer never says whether an owner exists. A sixth link for one address within 15 minutes answers 429 `too_many_links` and sends nothing; one statement counts and inserts, so parallel requests cannot pass the limit together. Public POSTs require `Content-Type: application/json`.
4. **Opening.** `GET /sign-in` is a static page with no secret in its URL path or query: its script reads the fragment, which browsers never send to a server or a referrer, and hands it to `todz://sign-in?token=…`, with a button for browsers that block the jump. A GET never spends a link, so a mail scanner that fetches it changes nothing.
5. **Redeeming.** The app posts `POST /owner/sessions` with `{identity_token: token, link_verifier, time_zone}`. One D1 statement spends the link: it sets `consumed_at` where the digest matches, `consumed_at` is empty, `expires_at` is later than now and the challenge equals the SHA-256 of the verifier, and returns the address. No row means 401 `identity_rejected`, the same answer for an unknown, expired, spent or foreign link. Then the owner is found or created and a session opens, exactly as ADR 0021 does. The port's `verify` takes the token, the optional verifier, the directory and the time; the fake ignores the last three.
6. **The verifier stays on the Mac that asked.** The app keeps the address, the verifier and the expiry in a private file in its own container, beside the session file of ADR 0025, so a link that launches the app after a quit still redeems; the file goes once the link is spent, refused or expired. Another app that claims `todz://` and catches the token cannot redeem it without the verifier, and a link opened on a phone cannot sign in a Mac that never asked.
7. The origin in the link is the `PUBLIC_ORIGIN` variable. With no variable, or no way to send mail ([ADR 0041](0041-outgoing-email-goes-through-a-port-with-a-console-sender-for-development.md)), `POST /owner/sign-in-links` answers 503 `sign_in_unavailable`.

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| An emailed link bound to the asking Mac by a verifier (chosen) | one click; a stolen link is useless; no password | a link opened on another device does nothing | the product is macOS only, so the asking Mac is where the owner is |
| A six-digit code the owner types | works across devices; scanners cannot spend it | typing; a code space small enough to guess needs strict attempt limits | the owner asked for a link |
| A link that redeems on GET in the browser, then hands a session to the app | no app state | a scanner's fetch spends it; the session crosses the custom scheme, which any app can claim | fails open |
| The token in the query string | simplest page | the token reaches server logs and referrers | the fragment never leaves the browser |
| Sign in with Apple now | the planned provider | needs the paid membership | waits for publishing |

## Consequences

- Migration `0004` adds `sign_in_links`. Spent and expired rows are deleted when the same address asks again; a scheduled sweep can come later.
- The rate limit is per address only; a limit per client address belongs to the zone's rate-limiting rules in `deploy-ready`. Anyone can keep an address at its limit and so delay its sign-in; accepted until those rules exist.
- Residual risk: an attacker who asks for a link for the owner's address, with the attacker's own challenge, and who also has an app on the owner's Mac that claims `todz://`, can redeem the link if the owner clicks the unasked mail. The mail tells the owner to ignore a link they did not ask for. A link tied to a verified web domain (universal links), possible once the app has a paid team, closes it.
- `deploy-ready` names `SIGN_IN_PROVIDER=email` in `wrangler.jsonc`, which ADR 0020 §3 forbade for the fake only.
- The sign-in screen changes shape: an address field and a "check your inbox" state when the server says `link`, the identity field when it says `identity`.

## Evidence

The shapes are the ones the Worker already uses: `generateCredentialSecret` and `digestCredential` make and store the token as sessions and keys are; `owner_identities` keys owners by `(provider, subject)`. Browsers drop the fragment from requests and referrers (RFC 3986 §3.5; Fetch's referrer policy strips it).

## Revisit when

The paid Apple Developer membership exists (Sign in with Apple joins as a third kind, and universal links can replace the custom scheme), or the product gains a device that is not a Mac.
