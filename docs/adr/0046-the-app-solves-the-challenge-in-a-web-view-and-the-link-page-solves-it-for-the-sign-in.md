# 0046. The app solves the challenge in a web view, and the link page solves it for the sign-in

- Status: Proposed
- Date: 2026-11-24
- Deciders: Claude (the build loop's call, pending the owner; the queue asked for this ADR: "How the macOS app shows the challenge … is an ADR, the loop's call"); Dhyego Calota (owner) may overturn it
- Inspired by: [ADR 0045](0045-the-public-sign-in-routes-are-limited-three-ways-and-turnstile-guarded-failing-closed.md), [Turnstile mobile implementation](https://developers.cloudflare.com/turnstile/get-started/mobile-implementation/), [ADR 0040](0040-the-owner-signs-in-with-an-email-link-bound-to-the-mac-that-asked-for-it.md)

## Context

ADR 0045 asks for a Turnstile token on every link request and every email sign-in. Turnstile runs only in a web page whose host the widget lists; Cloudflare's answer for native apps is a web view that loads such a page. todz has two moments: the owner types an address in the app, and later opens the mail's link, which lands on the Worker's `/sign-in` page in the browser and hands the token to the app through `todz://`.

## Decision

1. **Requesting a link.** The Worker serves `GET /sign-in/challenge`: a page with the widget for the action `request_link`, nothing else. The app's sign-in screen embeds it in a `WKWebView` under the address field, wherever a link can be requested. The page posts each token, and an empty string when a token expires or the widget errors, to the message handler `turnstile`. The app holds at most one token, sends it with the request and drops it, then reloads the page, because Cloudflare spends a token once. "Send link" stays disabled while no token is held.
2. **Signing in.** The `/sign-in` page the mail opens shows the widget for the action `sign_in`. When it yields a token, the page hands `todz://sign-in?token=<link token>&turnstile=<turnstile token>` to the app, as it handed the link token alone before. The app sends both. A link without `turnstile` is not a sign-in link. *Amended on 2026-11-25 with [ADR 0056](0056-the-app-keeps-its-server-url-as-a-setting-and-switching-it-starts-clean.md):* the page also adds `&origin=<its own origin>`, which its script reads from `location.origin`, so the script stays one fixed source with one hash. A link without `origin` is not a sign-in link, and the app refuses a link whose origin is not the server in use as not requested, before any request: a server that relays the owner's link request to another server cannot replay the token that server's page hands back.
3. **The web view's reach.** It loads only the API origin's `/sign-in/challenge`; it may navigate its frames to `https://challenges.cloudflare.com`, `about:blank` and `about:srcdoc`, and nowhere else; it keeps no website data between rounds (a non-persistent data store).
4. **Both pages** keep ADR 0040's strict policy and add `https://challenges.cloudflare.com` to `script-src` and `frame-src` only. The site key sits in a `data-` attribute, so the script stays one fixed source with one hash.
5. **A refused sign-in** (`sign_in_refused`, or a spent or late Turnstile token) leaves the link unspent: the app says to wait a minute and open the link from the mail again, which yields a fresh token.

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| A web view for the request, the link page for the sign-in (chosen) | the address stays in the app; the sign-in needs no extra step | one web view in a native screen | the least change for the owner |
| Ask for the address on a todz.app page in the browser | no web view in the app | the owner leaves the app to sign in; the app must still bind the request to its verifier through the URL | worse flow |
| A web view for both moments | one mechanism | the sign-in would need the app to show a challenge after the link opens it, one more step | the link page already runs in a browser |
| No challenge on the sign-in, only limits | simpler | the owner asked for every public endpoint | ADR 0045 |

## Consequences

- The app links WebKit. The sandbox already allows outgoing connections.
- A held link that failed while offline (ADR 0040) carries a Turnstile token that may be spent or late when retried; the retry then answers `sign_in_refused` and the owner opens the link again.
- Local development renders Cloudflare's always-passing test widget, which needs the network to load its script.

## Evidence

Cloudflare's mobile guide (read 2026-11-24) names WKWebView, a page on a host the widget lists, and the frame origins `challenges.cloudflare.com`, `about:blank` and `about:srcdoc`.

## Revisit when

Sign in with Apple replaces the link (it brings its own attestation), or Cloudflare ships a native attestation for macOS.
