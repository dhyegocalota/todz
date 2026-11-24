# Test plan: Sign in with an email link

Every checkbox states the input and the exact expected outcome. A ticked box carries evidence after ` — evidence: ` (commit hash, log path, counts, screenshot path).

## The failing test first

- [ ] Worker red commits (steps 1, 3, 5, 7): each run in a throwaway worktree fails on the named assertion, not on a missing import; failure text recorded
- [ ] App red commits (steps 9, 11): same, with `swift test --filter` on the named suites

## Unit — Worker (Miniflare, real D1)

- [ ] `GET /owner/sign-in-method`: `email` → 200 `{"method":"link"}`; `fake` → 200 `{"method":"identity"}`; none → 503 `sign_in_unavailable`; no `Authorization` header needed
- [ ] Ask for a link, unknown address `maria@example.com`: 202 `{}`; one `sign_in_links` row: 64-hex digest, `maria@example.com`, the challenge, `expires_at = now + 15 min`, `consumed_at` null
- [ ] Ask for a known owner's address: the same 202 `{}`, byte for byte
- [ ] `  Maria@Example.COM ` is stored as `maria@example.com`
- [ ] The console text carries `<PUBLIC_ORIGIN>/sign-in#token=<43 base64url>` and the digest of that token is the row's; D1 holds no token
- [ ] 400 `invalid_request`: empty, no `@`, no dot after `@`, two lines, 255 characters, challenge of 63 characters, challenge with upper case
- [ ] Fourth request for one address within 15 minutes: 429 `too_many_links`, no new row, nothing logged; a request at `now + 15 min + 1 ms` after the first: 202
- [ ] 503 `sign_in_unavailable` with `SIGN_IN_PROVIDER=fake`, with no `PUBLIC_ORIGIN`, with no `EMAIL_SENDER`
- [ ] A sender that rejects: 503, no row left
- [ ] Redeem: 201 with a session; `owner_identities` holds `("email", "maria@example.com")`; a second link for the address signs into the same owner id
- [ ] Redeem refusals, each 401 `identity_rejected` with an identical body: the link spent; `now` past `expires_at`; an unknown token; a wrong verifier; no verifier
- [ ] Two concurrent redeems of one link: one 201, one 401
- [ ] The fake provider still signs in with `{identity_token, time_zone}` and ignores a `link_verifier`
- [ ] `GET /sign-in?token=leak`: 200 HTML with `Cache-Control: no-store`, `Referrer-Policy: no-referrer`, a CSP whose `script-src` hash matches the inline script; the body holds no `leak`
- [ ] `pnpm verify all`: green, gates recorded

## Unit — App (TodzKit)

- [ ] `SignInLink(url:)`: accepts `todz://sign-in?token=<43>`; refuses `todz://today`, `todz://sign-in`, a 42-character token, `todz://sign-in/x?token=…`, `https://…`
- [ ] `FilePendingLinkVault`: round-trip; the file is 0600; erase removes it
- [ ] Asking sends the hex SHA-256 of the kept verifier; the pending link holds the address and an expiry 15 minutes ahead
- [ ] Redeeming posts the kept verifier, opens the session through the same path as the identity sign-in (cache check, vault, outbox, workspaces) and erases the pending link
- [ ] No pending link → no request, the "open on the Mac that asked" notice
- [ ] Pending link expired → no request, the expired notice, the pending link erased
- [ ] Signed in → the link is ignored, no request
- [ ] 401 on redeem → the expired notice, the pending link erased
- [ ] 429 on ask → the too-many error; 503 → the unavailable error; offline → the offline error

## Prove it for real — the app against a development Worker (ADR 0026)

- [ ] Worker with `SIGN_IN_PROVIDER=email`, `EMAIL_SENDER=console`, `PUBLIC_ORIGIN=http://localhost:8787`: the app shows the address form, not the identity field
- [ ] Type an address, Return: the inbox state shows the address; the Worker console prints the link
- [ ] Open the link in a browser: the page shows the todz icon and "Open todz"; the app comes forward and is signed in on the first-workspace screen; screenshot light and dark of the address form, the inbox state and the page
- [ ] Open the same link again: the app, now signed in, ignores it
- [ ] Sign out, ask again, quit the app, open the link: the app launches and signs in (the pending link survived the quit)
- [ ] An expired link (Worker `now` past 15 minutes, or wait): the expired line
- [ ] Ask four times in a row: the fourth shows the too-many line
- [ ] "Use a different email" returns to an empty, focused field
- [ ] Worker with `fake`: the identity field as before, the development notice shown; the v1 walk's sign-in still works
- [ ] Console and logs: the Worker log shows no token outside the console sender's line; the app log shows none

## Edge cases found during execution

Empty on purpose. The tester adds one checkbox per new case (input, exact expected outcome) and a regression test for each.

## Adversarial review

- [ ] Claim 1: a link cannot be redeemed twice — attack: <how>; result: <refuted | held>
- [ ] Claim 2: the link request never reveals whether an owner exists — attack: <how>; result: <refuted | held>
- [ ] Claim 3: a token caught through `todz://` cannot sign in without the verifier — attack: <how>; result: <refuted | held>

## Coverage honesty

- The real mail path (Cloudflare Email Service, HTML) is `transactional-email`; here the link travels through the console sender only.
- The rate limit is per address; a flood across many addresses is left to the zone's rules in `deploy-ready`.
- Mail scanners are not simulated beyond a GET of the page, which spends nothing.
