# Test plan: Sign-in guard

Every checkbox states the input and the exact expected outcome. A ticked box carries evidence after ` — evidence: ` (commit hash, log path, counts, screenshot path).

## The failing test first

- [ ] `apps/api/test/turnstile.test.ts` red before `turnstile.ts` exists — expected: fails on the stub's "verifyTurnstileToken is not implemented"
- [ ] `apps/api/test/sign-in-limiter.test.ts` red on the three limits — expected: a missing binding on a public host answers 202 or 429 `too_many_requests`, not 503 / `sign_in_refused`
- [ ] The route tests red on `turnstile_token` — expected: a link request without the token answers 202, not 400
- [ ] The page tests red — expected: `/sign-in/challenge` answers 404 and `/sign-in` has no widget
- [ ] TodzKit tests red — expected: `SignInLink` with `turnstile` is nil (more than one parameter), bodies lack `turnstile_token`
- [ ] Confirmed from `git log` that each red commit precedes its green one, and the recorded failure texts match a rerun at the red commit

## Unit (Worker)

- [ ] siteverify `{success:true, hostname:"api.todz.app", action:"request_link"}` for action `request_link` and host `api.todz.app` — expected: accepted
- [ ] the same with `success:false` — expected: refused
- [ ] `hostname:"evil.example"` — expected: refused
- [ ] `action:"sign_in"` presented to sending — expected: refused
- [ ] fetch throws — expected: unavailable
- [ ] fetch never answers — expected: unavailable after the 5-second timeout (fake timers or an aborted signal)
- [ ] status 500 — expected: unavailable
- [ ] body `not json` — expected: unavailable
- [ ] body `{}` (no boolean `success`) — expected: unavailable
- [ ] dummy token on a local host — expected: accepted, zero fetch calls
- [ ] dummy token on a public host — expected: goes to siteverify (and is refused by its answer)
- [ ] the posted form carries `secret`, `response` and `remoteip` equal to `CF-Connecting-IP`
- [ ] public host, client limiter says no, on each of the three routes — expected: 429 `{"error":"sign_in_refused"}`, `Retry-After: 60`
- [ ] public host, global limiter says no — expected: the same refusal; its key is the route alone
- [ ] public host, address limiter says no on sending — expected: the same refusal, no link row, no mail; its key is `request_sign_in_link:<64 hex>` and contains no `@`
- [ ] the same address in two cases (`A@x.io`, ` a@x.io `) — expected: the same address key
- [ ] D1's sixth link for an address in 15 minutes — expected: 429 `sign_in_refused` (no longer `too_many_links`)
- [ ] public host, each of the three bindings absent in turn — expected: 503 `sign_in_unavailable`
- [ ] public host, no `CF-Connecting-IP` — expected: 503 `sign_in_unavailable`
- [ ] local host, every limiter saying no — expected: not consulted, the request proceeds
- [ ] sending without `turnstile_token`, with `""`, with 2049 characters, with `a b` — expected: 400 `invalid_request`
- [ ] sending with a refused token — expected: 429 `sign_in_refused`, no link row, no mail
- [ ] sending with siteverify down — expected: 503 `sign_in_unavailable`, no link row, no mail
- [ ] sending on a public host with no `TURNSTILE_SECRET_KEY` — expected: 503 `sign_in_unavailable`, no fetch
- [ ] sending with an accepted token — expected: 202, one mail, one row
- [ ] email sign-in with a refused token and a valid link — expected: 429 `sign_in_refused`, the link still unspent (a second try with an accepted token signs in)
- [ ] email sign-in without `turnstile_token` — expected: 400 `invalid_request`
- [ ] fake sign-in without `turnstile_token` on a local host — expected: 201 as before
- [ ] across every test above, `console.log`, `console.warn` and `console.error` output never contains the address, the link token or the Turnstile token, except the console sender's own mail line in development
- [ ] `GET /sign-in/challenge` — expected: 200 HTML, one element with `data-sitekey` equal to the configured key and `data-action="request_link"`, `Cache-Control: no-store`, CSP with `https://challenges.cloudflare.com` in `script-src` and `frame-src`, `frame-ancestors 'none'`, no `unsafe-inline`
- [ ] `GET /sign-in/challenge` with no site key — expected: 503, no widget
- [ ] `POST /sign-in/challenge` — expected: 404
- [ ] `GET /sign-in` — expected: a widget with `data-action="sign_in"`, and the script builds `todz://sign-in?token=` + token + `&turnstile=` + Turnstile token
- [ ] the script's hash in each CSP matches the served script

## Unit (TodzKit)

- [ ] `todz://sign-in?token=<43>&turnstile=<valid>` — expected: a link with both
- [ ] without `turnstile`, with an extra `x=1`, `turnstile=` empty, `turnstile=a b`, 2049 characters — expected: nil
- [ ] `SignInLinkRequestBody` JSON — expected: `{"email":…,"link_challenge":…,"turnstile_token":…}`
- [ ] `SignInBody` JSON for a link — expected: carries `turnstile_token`
- [ ] `{"error":"sign_in_refused"}` — expected: `OwnerAPIError.signInRefused` → `SignInError.signInRefused`
- [ ] `acceptChallenge(token: valid)` then `""` — expected: held, then nil
- [ ] `requestSignInLink` with no token — expected: no request sent
- [ ] `requestSignInLink` with a token, server accepts — expected: the request carries it; afterwards the token is nil and `challengeRound` advanced by one
- [ ] the same when the server refuses — expected: the same clearing and advance, `signInError == .signInRefused`
- [ ] `redeem(signInLink:)` — expected: the sign-in carries the link's Turnstile token

## Prove it for real — the app against `pnpm --filter @todz/api dev:email`

- [ ] Happy path: launch the Debug app signed out; the check under the address field shows Cloudflare's test widget and passes; type an address; Send link — expected: the console sender prints the mail; the screen moves to "check your inbox"; the check reloads
- [ ] Open the link from the console mail in a browser — expected: `/sign-in` shows the check, then hands `todz://sign-in?token=…&turnstile=XXXX.DUMMY.TOKEN.XXXX` and the app signs in
- [ ] Before the check yields a token — expected: Send link disabled, the reason "Complete the check first."
- [ ] Send again from the inbox stage — expected: the check is there, the request goes out, the check reloads
- [ ] `curl` the link route with a junk `turnstile_token` — expected: 429 `sign_in_refused` (or 503 if offline); no mail
- [ ] `curl` the link route with no `turnstile_token` — expected: 400
- [ ] Open an old-style link `todz://sign-in?token=<43>` — expected: the app ignores it (not a sign-in link)
- [ ] Web view network: only the API origin, `challenges.cloudflare.com`, `about:` frames
- [ ] Screenshots of the address stage with the check, light and dark, for the PR and the README sign-in cell if one exists

## Edge cases found during execution

Empty on purpose. The tester adds one checkbox per new case (input, exact expected outcome) and a regression test for each.

## Adversarial review

The reviewer picks the three claims most likely to be wrong and tries to refute each.

- [ ] Claim 1: every missing piece fails closed on a public host — attack: remove each binding, the header and the secret in turn; result:
- [ ] Claim 2: a refused request never sends mail nor spends a link — attack: read the order of checks against the handlers; result:
- [ ] Claim 3: the local-host exemptions cannot be reached in production — attack: a request to `api.todz.app` with a `Host` or `X-Forwarded-Host` of `localhost`; result:

## Coverage honesty

- Real Turnstile against the production widget — untestable until the owner creates the widget; the production smoke walk covers it.
- The global cap counts per Cloudflare location, not worldwide — accepted, documented in ADR 0045.
- The Workers rate limiter is eventually consistent — tests use a recording fake.
