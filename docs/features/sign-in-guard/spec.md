# Sign-in guard

**Status:** Approved
**Tier:** 🔴
**Owner approval:** approved 2026-11-24 by the owner's request to the loop ("o send link: cuidado pra não abusarem do servidor, queremos captcha e rate limit") and PROMPT.md "Security" ("queremos rate limit e captcha nos endpoints públicos como send magic link"), inside [`docs/product/README.md`](../../product/README.md) (approved 2026-11-23); the details are the loop's calls in [ADR 0045](../../adr/0045-the-public-sign-in-routes-are-limited-three-ways-and-turnstile-guarded-failing-closed.md) and [ADR 0046](../../adr/0046-the-app-solves-the-challenge-in-a-web-view-and-the-link-page-solves-it-for-the-sign-in.md)
**ADRs:** [0045](../../adr/0045-the-public-sign-in-routes-are-limited-three-ways-and-turnstile-guarded-failing-closed.md), [0046](../../adr/0046-the-app-solves-the-challenge-in-a-web-view-and-the-link-page-solves-it-for-the-sign-in.md), [0044](../../adr/0044-the-wrangler-configuration-is-production-on-api-todz-app-and-development-overrides-it.md), [0040](../../adr/0040-the-owner-signs-in-with-an-email-link-bound-to-the-mac-that-asked-for-it.md), [0020](../../adr/0020-sign-in-goes-through-a-provider-port-and-v1-ships-only-the-fake.md)
**Not changing:** the link's lifetime, its binding to the Mac (ADR 0040), the mails, the fake provider, the MCP routes, sessions; the Debug app's own `todz://` scheme waits for `security-sweep`

## Problem

Sending a sign-in link mails a stranger from `noreply@todz.app`. Today the only guards are ADR 0040's five links per address per 15 minutes and ADR 0044's ten posts per client a minute, and the per-client one fails open without a binding or a client address. A botnet over many addresses can mail anyone and burn the domain's reputation, and spending a link has no challenge. The owner wants a captcha and rate limits on every public endpoint, failing closed, before sign-in goes to production.

## Goals

- Every public route (`GET /owner/sign-in-method`, `POST /owner/sign-in-links`, `POST /owner/sessions`) on a public host passes a per-client limit and a global cap; sending also passes a per-address limit keyed by the address's digest.
- Both posts with the email provider require a Turnstile token that siteverify accepts for todz's host and the route's action.
- Every missing piece (binding, client address, secret, siteverify) fails closed with `sign_in_unavailable`.
- Every limit and every refused token answer one refusal, `sign_in_refused`, the same for every address.
- No address, link token or Turnstile token in any log.
- The app gets the tokens without leaving the flow: a web view under the address field, and the mail's `/sign-in` page passing its token along with the link.

## Non-goals

- A landing or waitlist (`landing` builds the same guard). The Debug app's own link scheme (`security-sweep`). Creating the Turnstile widget: the token lacks Turnstile Edit, so it is an owner step. A WAF rule.

## Design

### Data flow

```
App sign-in screen                         Worker (api.todz.app)                     Cloudflare
 address field ─┐
 WKWebView ─────┼── GET /sign-in/challenge ─▶ page: widget(action request_link) ──▶ challenges.cloudflare.com
   token ◀──────┘   webkit.messageHandlers.turnstile.postMessage(token)
 Send link ── POST /owner/sign-in-links {email, link_challenge, turnstile_token}
                     ├─ client limit ─ global cap            (public host; else skipped, ADR 0044)
                     ├─ body parses ─ address limit (digest)
                     ├─ siteverify(secret, token, remoteip) ─ hostname, action ─────▶ siteverify
                     ├─ D1: 5 per address per 15 min (ADR 0040)
                     └─ mail ──▶ owner's inbox
Mail link ─▶ browser GET /sign-in#token=… ─▶ page: widget(action sign_in)
              └─ todz://sign-in?token=…&turnstile=… ─▶ app
 App ── POST /owner/sessions {identity_token, link_verifier, time_zone, turnstile_token}
                     ├─ client limit ─ global cap ─ siteverify(action sign_in) ─ spend link
```

### Interfaces

- **API.** `POST /owner/sign-in-links` body adds `turnstile_token` (required). `POST /owner/sessions` body adds `turnstile_token` (required when the provider is `email`, ignored for `fake`). Both: 1 to 2048 characters of `[A-Za-z0-9._-]`, else 400 `invalid_request`.
- **Refusals.** 429 `{"error":"sign_in_refused"}` with `Retry-After: 60` for every limit and every refused token. 503 `sign_in_unavailable` for every missing piece. `too_many_links` and `too_many_requests` are removed from the Worker and the app.
- **Order** on a public host: client limit → global cap → (sending) body → address limit → Turnstile → D1 count → mail; (session) body → Turnstile → spend. `GET /owner/sign-in-method` gets the two limits only.
- **Limits** (constants in `libs/types`): per client 10 a minute (unchanged), per address 3 a minute, global 100 a minute; Wrangler `ratelimits` `SIGN_IN_LIMITER` `8601`, `SIGN_IN_ADDRESS_LIMITER` `8602`, `SIGN_IN_GLOBAL_LIMITER` `8603`. Keys: `<route>:<clientRateKey>`, `<route>` alone, `<route>:<sha256 hex of the normalized address>`.
- **Turnstile.** `TURNSTILE_SITE_KEY` var, `TURNSTILE_SECRET_KEY` secret. siteverify `https://challenges.cloudflare.com/turnstile/v0/siteverify`, form body `secret`, `response`, `remoteip`, 5-second timeout. Accepted iff `success === true`, `hostname === new URL(PUBLIC_ORIGIN).hostname`, `action` equals the route's (`request_link`, `sign_in`). On a local host (`PUBLIC_ORIGIN` and request both local) the dummy token `XXXX.DUMMY.TOKEN.XXXX` is accepted without a call. Actions are an enum.
- **`GET /sign-in/challenge`.** HTML, `Cache-Control: no-store`, the sign-in page's headers; one widget `data-sitekey` from `TURNSTILE_SITE_KEY`, `data-action="request_link"`, callbacks that post the token or `""` to `turnstile`; CSP as the sign-in page's plus `https://challenges.cloudflare.com` in `script-src` and `frame-src`. With no site key it answers 503 with the unavailable copy and no widget. Other methods: 404. The Worker serves it first (`assets.run_worker_first`).
- **`GET /sign-in`.** The page adds a widget with `data-action="sign_in"`; when it yields a token the page navigates to `todz://sign-in?token=<t>&turnstile=<tt>` and the button opens that link; until then it says it is checking. No site key: the page says sign-in is unavailable.
- **App.**
  - `SignInLink` parses exactly `token` and `turnstile`; a link without `turnstile` or with any other parameter is not a sign-in link.
  - `OwnerService.requestSignInLink(email:challenge:turnstileToken:)` and `signIn(identityToken:linkVerifier:turnstileToken:timeZone:)`; the bodies encode `turnstile_token`.
  - `AppModel` holds `signInChallengeToken: String?` and a `challengeRound: Int`. `acceptChallenge(token:)` keeps a well-formed token, an empty or malformed one clears it. `requestSignInLink(email:)` needs a held token: it sends it, clears it and advances the round whatever the answer.
  - `SignInError.signInRefused` replaces `tooManyLinks` and `tooManyRequests`, with one copy line for requests and one for a refused link.
  - `ChallengeView`, an `NSViewRepresentable` over `WKWebView` (non-persistent data store, the `turnstile` message handler, navigation limited per ADR 0046 §3), sits under the address field in `AddressSlot` and above "Send again" in `InboxSlot`, reloads when the round advances, and is about 65 points tall. "Send link" and "Send again" are disabled with the reason "Complete the check first." while no token is held.
- **Config and docs.** `wrangler.jsonc` adds the two bindings and `TURNSTILE_SITE_KEY` only once the owner has created the widget (absent until then, which fails closed); the dev scripts and the Miniflare test bindings pass the test site key; `docs/runbooks/deploy-the-api.md` gains the widget (an owner step while the token lacks Turnstile Edit) and `wrangler secret put TURNSTILE_SECRET_KEY` after the deploy, and its smoke check expects `sign_in_unavailable` on the posts until the secret exists.

### Failure handling

| Case | Outcome |
|------|---------|
| Over any limit, or a refused / spent / late / wrong-host / wrong-action token | 429 `sign_in_refused`, `Retry-After: 60`; nothing created or spent |
| No limiter binding, no client address on a public host, no secret, siteverify down, slow (> 5 s), non-2xx or malformed | 503 `sign_in_unavailable`; nothing created or spent |
| Missing or malformed `turnstile_token` | 400 `invalid_request` |
| The widget fails in the app | no token; Send stays disabled with its reason; the page posts `""` and the round can be retried by sending again after it reloads |
| The held link's Turnstile token is spent when retried | `sign_in_refused`; the app asks to open the link from the mail again; the link stays unspent |

## Open questions → answers

| Question | Options | Owner's answer | Date |
|----------|---------|----------------|------|
| How the app shows the challenge | web view in the app / a todz.app page in the browser | Loop's call (ADR 0046): a web view for the request, the link page for the sign-in | 2026-11-24 |
| Challenge on `GET /owner/sign-in-method` | yes / limits only | Loop's call (ADR 0045): limits only, it writes nothing | 2026-11-24 |
| One refusal or one per limit | one / several | Loop's call (ADR 0045): one, `sign_in_refused` | 2026-11-24 |
| The Turnstile widget | the loop creates it / the owner | The token lacks Turnstile Edit: the owner creates `todz` for `todz.app` (Blockers) | 2026-11-24 |
| Debug's own link scheme | here / `security-sweep` | Loop's call: `security-sweep`, to keep this feature to the guard | 2026-11-24 |

## Test strategy summary

Red first in the Worker: siteverify accepted, refused, wrong host, wrong action, timeout, non-2xx and malformed (a stubbed `fetch`); the dummy token only on a local host; each limit refusing with `sign_in_refused` and never reaching the mail or the D1 row; every fail-closed branch; the address key carrying no address; no address or token in `console` output; both pages' CSP and widget attributes. In TodzKit: the link parser, the bodies, the held-token rules and the error mapping. The tester walks the app against `pnpm dev:email` with the test widget, and checks each refusal with `curl`.
