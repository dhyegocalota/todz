# Sign-in guard

**Status:** In review
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

## Plan review answers (2026-11-24)

These bind the build and win over any line above that disagrees.

- **R1, order.** Sending: client limit → configuration (R2) → body → Turnstile → global cap → address limit → D1 count → mail, so a global refusal never spends an address's slot. Email session: client limit → configuration → body → Turnstile → global cap → spend. `GET /owner/sign-in-method`: client limit only. Fake session: none of it (local only).
- **R2, configuration before the body.** Every 503 check runs before the body is read: the route's bindings (R4), `CF-Connecting-IP` on a public host, `PUBLIC_ORIGIN` through `publicOriginOf`, `TURNSTILE_SECRET_KEY`, and today's provider and sender checks.
- **R3, more fail-closed branches.** `PUBLIC_ORIGIN` absent or invalid, `limiter.limit()` throwing, and siteverify `success:false` whose `error-codes` include `missing-input-secret`, `invalid-input-secret` or `internal-error` answer 503 `sign_in_unavailable`, one test each. `success:true` with a missing `hostname` or `action` is refused.
- **R4, what each route needs on a public host.**

  | Route | `SIGN_IN_LIMITER` | `SIGN_IN_ADDRESS_LIMITER` | `SIGN_IN_GLOBAL_LIMITER` | `TURNSTILE_SECRET_KEY` |
  |---|---|---|---|---|
  | `GET /owner/sign-in-method` | required | — | — | — |
  | `POST /owner/sign-in-links` | required | required | required | required |
  | `POST /owner/sessions` (email) | required | — | required | required |

  A test per required cell: absent answers 503. A dash is never consulted.
- **R5, one local predicate.** A shared `isLocalHost({ env, request })` (`PUBLIC_ORIGIN` and `request.url` both local, the conjunction inside `signInKindForRequest`, which then uses it) gates the limiter skip and the dummy token. A test: a public `PUBLIC_ORIGIN` with a localhost request URL gets no skip and no dummy token.
- **R6, no `remoteip`.** siteverify gets `secret` and `response` only (ADR 0045 §2).
- **R7, the `/sign-in` page.** The inline script is one block that binds nothing globally and puts nothing on `window`: it reads the fragment, calls `replaceState` and keeps the link token in its closure. Only for a valid link token it then inserts `api.js?render=explicit` itself (an inserted script loads async) and, once it loads, calls `turnstile.render` on an empty container carrying the site key, with the callbacks passed as options; without a valid link token no Turnstile script loads and no widget renders. The challenge page keeps implicit rendering (a `cf-turnstile` widget, its callbacks on `window`, `api.js` `async defer` after its inline script). The Turnstile token must match `^[A-Za-z0-9._-]{1,2048}$` before `todz://` is built. `error-callback` and `timeout-callback` show "Couldn't check this browser. Reload the page."; `expired-callback` resets the widget. Both pages without a site key answer 503 with the unavailable copy and no widget.
- **R8, two refusals in the app.** `SignInError.signInRefused` for a request; `redeem` maps it to `.linkRefused`, the way `identityRejected` becomes `linkRejected`; a refused redeem keeps `pendingLink` and does not hold the link. The shared token pattern is `^[A-Za-z0-9._-]{1,2048}$`, the same text in both lanes.
- **R9, the parser and the model.** `SignInLink`: exactly two query items named `token` and `turnstile`, in any order, no duplicates. `requestSignInLink` with no held token returns at once and leaves `signInError` as it was. The challenge page wires `callback` (posts the token), and `expired-callback`, `error-callback` and `timeout-callback` (post `""`).
- **R10, navigation and messages in TodzKit** (amended in fix round 1). Pure functions in `ChallengeNavigation`, tested:
  - `isAllowed(url:apiBaseURL:isMainFrame:)`: the main frame may load only the API origin's `/sign-in/challenge`; a sub-frame may load only `https://challenges.cloudflare.com/…` (no port), `about:blank` and `about:srcdoc`. Refused: `http://challenges.cloudflare.com`, another API path, another host, `todz://`, and a navigation with no target frame (a new window).
  - `isTrustedMessage(isMainFrame:scheme:host:port:apiBaseURL:)`: the `turnstile` handler takes a message only from the main frame whose scheme, host and port match the API base URL (WebKit reports a default port as `0`); any other message is ignored, not cleared.
  - `pageURL(apiBaseURL:)` is the one place the page's path lives.
- **R11, the runbook.** Step 12 adds `/sign-in/challenge` (503 until the site key is in `wrangler.jsonc`, then 200). Step 13 becomes a junk-token post expecting 503 `sign_in_unavailable` before the secret and 429 `sign_in_refused` after it; the real mail moves to the production smoke walk with the app. Step 14's body gains a `turnstile_token` and expects 429 from the eleventh post on. The owner's widget step names `todz.app`, which covers `api.todz.app`. G1 owns `scripts/deploy-bodies/**`.
- **R12, red-first in Swift.** G2 commits the new signatures and cases as stubs (`fatalError("<name> is not implemented")` or a throwing body) first, then the red tests, then the implementation. G1 does the same in TypeScript.
- **R13, more tests.** A `request_link` token on `/owner/sessions` is refused; siteverify down on the session route leaves the link unspent; a dummy token with a local request and a public `PUBLIC_ORIGIN` goes to siteverify; `SendOutcome` and `AppModel+Writes` drop `tooManyLinks` and `tooManyRequests`.
- **R14, the secret everywhere.** The dev scripts and the Miniflare bindings pass both test keys; `api-source.test.ts` pins the scripts' flags.
- **R15, stubbing.** `verifyTurnstileToken` takes a `fetcher: typeof fetch`; the routes pass the global `fetch`; route tests stub it with `vi.spyOn(globalThis, 'fetch')`.
- **R16, ownership.** The lead owns the root `README.md`, the ADR status lines and `tester-briefing.md`; each lane returns its briefing section in its final report.
- **R17.** `Retry-After: 60` everywhere (ADR 0045 §4).
- **R18.** The deploy adds the namespaces `8602` and `8603`; rolling this feature back reopens the unguarded routes, so a rollback in production also closes sign-in (unset the secret).

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
