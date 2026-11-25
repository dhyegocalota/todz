# Tester briefing: Sign-in guard

Written from the two developers' reports by the lead (spec R16). Neither developer ran `test-plan.md` or declared the feature works.

## API lane (G1, `feat/sign-in-guard-api`, last commit 7588bb2)

**What changed.**
- The three limits fail closed on a public host:
  - the per-client limit on all three public routes;
  - the global cap on both posts;
  - the per-address limit on the link request.
- siteverify runs before the shared limits.
- There is one refusal: 429 `sign_in_refused` with `Retry-After: 60`.
- `GET /sign-in/challenge` is new, and `/sign-in` now has a widget.
- New sources: `apps/api/src/turnstile.ts`, `sign-in-challenge.ts`, `turnstile-page.ts`, `sign-in-challenge-page.ts`; `isLocalHost` in `local-origin.ts`.
- The runbook gains a step 10 for the widget and the secret, so the old steps 10–15 are now 11–16. `scripts/deploy-bodies/junk-turnstile-link.json` is new.

**How to run.**
- Tests: `pnpm --filter @todz/api test:unit`.
- Stack: `pnpm --filter @todz/api dev:email` (Cloudflare's test keys), then open `http://localhost:8787/sign-in/challenge`.

**Red, then green** (red text as each developer recorded it):

| Red commit | Green commit | Recorded red |
|---|---|---|
| 7506884 | f6bf5b5 | 20 red, `Error: verifyTurnstileToken is not implemented` |
| 9776b4c | cf45cd3 | 30 of 43 red, e.g. `expected { error: 'too_many_requests' } to deeply equal { error: 'sign_in_refused' }`, `expected 202 to be 503` |
| 88877d7 | 819f3fe | 36 red, e.g. `expected 202 to be 429`, `expected 400 to be 503` |
| 398bdbf | feec406 | 26 of 42 red, e.g. `Error: the page wired no signInChecked callback`, `Error: serveSignInChallengePage is not implemented`; `api-source` red on `run_worker_first` |

The shape pins in 7fc0e27 are pins, not red tests.

**Calls the developer made.**
- No `remoteip`.
- The secret is required on local hosts too.
- A malformed token answers 400 once the handler reaches it. On the session post, that is after the time-zone and verifier checks.
- The fake provider ignores the token, but a non-string `turnstile_token` still answers 400.
- A site key outside `^[A-Za-z0-9_-]+$` counts as absent (503).
- `/sign-in` opens the app only on the first solved check; a later token updates only the button.
- The page's `max-width` went from 280 to 332 px so the widget fits.

**Hypotheses to attack.**
1. No public request reaches the mail or a link row without a solved token for its own action and host. Try a `sign_in` token on the link request, the dummy token from a public origin, and a spoofed hostname.
2. Every missing piece answers 503 before the body is read. Remove each in turn: a binding, `CF-Connecting-IP`, the secret, `PUBLIC_ORIGIN`.
3. Refused tokens never use up the address or global quota.
4. Neither page's CSP blocks the real widget; only a browser shows this.
5. No address or token reaches the console on a public host.

**Gaps.**
- The real widget, in a browser or in WKWebView, is untested.
- `fetch` from workerd against the real siteverify is untested.
- The runbook steps have not been run.

## App lane (G2, `feat/sign-in-guard-app`, last commit c90d5ae)

**What changed.**
- TodzKit holds a Turnstile challenge token: `AppModel.signInChallengeToken`, `challengeRound` and `acceptChallenge(token:)`.
- `requestSignInLink` clears the held token at its start, sends it, and advances the round in a `defer`.
- `redeem` sends the mail link's own `turnstile` token.
- `SignInLink` parses exactly `token` (43 characters) and `turnstile` (`ChallengeToken`, `^[A-Za-z0-9._-]{1,2048}$`).
- `signInRefused` and `linkRefused` replace `tooManyLinks` and `tooManyRequests`.
- `ChallengeNavigation.isAllowed` is a pure function.
- The app target gains `Todz/SignIn/ChallengeView.swift`, a `WKWebView` with:
  - a non-persistent store;
  - the `turnstile` message handler;
  - navigation limited by `isAllowed`;
  - a reload whenever the round changes;
  - a height of 65 pt.
- The view sits under the address field in `AddressSlot` and above "Send again" in `InboxSlot`. Send is disabled with "Complete the check first." while no token is held.

**How to run.**
- Tests: `swift test` in `apps/macos/TodzKit`.
- App: `xcodegen generate --spec apps/macos/project.yml`, then `xcodebuild build -project apps/macos/Todz.xcodeproj -scheme Todz -configuration Debug -derivedDataPath apps/macos/build`.
- Walk: the Debug app against `pnpm --filter @todz/api dev:email`.

**Red at ed82fea, green at eb5af45** (stubs at d0a3d66):
- `SignInLinkTests`: `Expectation failed: link?.token == token`, and `SignInLink(url:)` nil.
- `OwnerAPITests+SignInLink`: `expected error ".signInRefused" of type OwnerAPIError, but ".unexpected(status: 429)"`.
- `ChallengeNavigationTests`: `Fatal error: ChallengeNavigation.isAllowed is not implemented`.
- `AppModelTests+SignInChallenge`, and every test using `askForLink`: `Fatal error: AppModel.acceptChallenge(token:) is not implemented`.
- Pins: the body-encoding tests in `OwnerCodingTests` and `OwnerAPITests`.

**Hypotheses (none verified in a real walk).**
1. Turnstile renders and yields a token inside the sandboxed `WKWebView`.
2. Send link and Send again stay disabled, with the reason, until a token arrives, then enable.
3. After each send, success or failure, the widget reloads and Send is disabled again.
4. The page posting `""` on expiry, error or timeout disables Send.
5. The web view cannot reach:
   - other API paths;
   - `todz://`;
   - `http://challenges.cloudflare.com`;
   - other hosts.

   It also keeps no cookies between rounds.
6. A mail link without `turnstile`, or with extra, duplicate or malformed parameters, is ignored.
7. A refused redeem shows the `linkRefused` copy, keeps the pending link, stays on the inbox stage and offers no Try again.
8. A refused request shows "Too many tries. Wait a minute, then try again."

**Gaps.**
- The 65 pt height and the look are unchecked against the real widget.
- The app was not launched.
