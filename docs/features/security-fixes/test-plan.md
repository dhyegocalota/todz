# Test plan: Security fixes

Every checkbox states the input and the exact expected outcome. A ticked box carries evidence after ` — evidence: ` (commit hash, log path, counts, screenshot path). Worker URLs are built from the test configuration's `PUBLIC_ORIGIN` (`http://localhost:8787`) and `SITE_ORIGIN` (`http://localhost:8788`); `<site host>` is the latter's host.

## The failing test first

Lane W (`apps/api`, `tools/repository-shape`):

- [ ] `apps/api/test/sign-in-links.test.ts::the link hands back the Debug scheme` — input: `POST /owner/sign-in-links` with a solved token, a well-formed address and challenge, `app_link_scheme: "todz-dev"`; expected: 202, one mail whose link ends `/sign-in#token=<43 characters>&app=todz-dev`
- [ ] `sign-in-links.test.ts::the link hands back the Release scheme` — input: the same with `app_link_scheme: "todz"`; expected: 202, the link ends `&app=todz`
- [ ] `sign-in-links.test.ts::an unknown scheme is refused before anything is kept` — input: `app_link_scheme` absent, then each of `""`, `"https"`, `"javascript"`, `"TODZ"`; expected: each 400 `{"error":"invalid_request"}`, no `sign_in_links` row, no mail, siteverify not called
- [ ] `apps/api/test/sign-in-page.test.ts::the page opens the Debug app` — input: hash `#token=<T>&app=todz-dev`, the Turnstile callback with `<U>`; expected: the steps end `navigate todz-dev://sign-in?token=<T>&turnstile=<U>`
- [ ] `sign-in-page.test.ts::the page opens the Release app` — input: hash `#token=<T>&app=todz`; expected: the steps end `navigate todz://sign-in?token=<T>&turnstile=<U>`
- [ ] `sign-in-page.test.ts::a link without its scheme opens nothing` — input: hash `#token=<T>`; expected: no `navigate` step, `body[data-state]` unset, so the missing-link copy shows
- [ ] `sign-in-page.test.ts::a foreign scheme opens nothing` — input: hash `#token=<T>&app=https`, then `&app=javascript`, then `&app=`; expected: for each, no `navigate` step and the missing-link copy
- [ ] `apps/api/test/email-address.test.ts::a URL-shaped address is refused` — input: `https://a.bc/x?@a.bc`; expected: `normalizedAddress` returns `null`
- [ ] `apps/api/test/waitlist-join.test.ts::a URL-shaped address is answered try-again and kept nowhere` — input: a join of `https://a.bc/x?@a.bc` with a solved token; expected: the try-again answer (429 with the try-again notice), siteverify not called, no `waitlist` row
- [ ] `apps/api/test/emails/email-contrast.test.ts::white on the button clears AA everywhere on it` — input: the sign-in mail's generated HTML; expected: the contrast of `#FFFFFF` against the button's `background-color` and against each `linear-gradient` stop ≥ 4.5
- [ ] `email-contrast.test.ts::the link colour clears AA on white` — input: the `.email-link` inline colour; expected: its contrast on `#FFFFFF` ≥ 4.5
- [ ] `email-contrast.test.ts::the colour is the pinned one` — input: the generated HTML; expected: the button's `background-color`, its first gradient stop and the link colour are each `#4764F5`
- [ ] `apps/api/test/admin-pages.test.ts::the admin link status is announced` — input: GET the admin link page; expected: the `role="status"` element has no `hidden` attribute, carries `aria-live="polite"`, and its title and body hold no text
- [ ] `apps/api/test/site-pages.test.ts::the waitlist widget reports every lost token` — input: GET the landing page with a Turnstile site key; expected: the `.cf-turnstile` element carries `data-error-callback`, `data-expired-callback` and `data-timeout-callback`, all the same name, and the page script assigns `window.<that name>`
- [ ] `apps/api/test/security-headers.test.ts` — for each row: the input, then expected: the status shown and `Content-Security-Policy` present (the route's own value where it sets one, else `default-src 'none'; frame-ancestors 'none'`), `Strict-Transport-Security: max-age=31536000`, `X-Content-Type-Options: nosniff`, `Referrer-Policy` present (`no-referrer` where the route sets nothing):
  - [ ] API unknown path — GET `<PUBLIC_ORIGIN>/nowhere`; expected: 404
  - [ ] MCP without a bearer — POST `<PUBLIC_ORIGIN>/mcp` with an empty JSON body; expected: 401
  - [ ] the challenge page — GET `<PUBLIC_ORIGIN>/sign-in/challenge`; expected: 200 (with a site key) and its own policy kept
  - [ ] the change feed without an upgrade — GET `<PUBLIC_ORIGIN>/owner/projects/<owned project>/socket` with a session, no `Upgrade`; expected: 426 with `Upgrade: websocket` and the four headers
  - [ ] the change feed upgrade — the same with `Upgrade: websocket`; expected: 101 and `response.webSocket` not `null` (the headers are not asserted on a 101)
  - [ ] `/health` — GET `<PUBLIC_ORIGIN>/health`; expected: 200 and the four headers
  - [ ] site unknown path — GET `<SITE_ORIGIN>/nowhere`; expected: 404
  - [ ] `GET /join` — GET `<SITE_ORIGIN>/join`; expected: 303 with `Location: /`
  - [ ] the waitlist answer — POST `<SITE_ORIGIN>/join` with a solved token and a fresh address; expected: 200 with the site page's own policy kept
  - [ ] the admin export — GET `<SITE_ORIGIN>/admin/export.csv` with an admin session; expected: 200, its own `Cache-Control: no-store` kept, and the four headers with the default values
  - [ ] the www redirect — GET `http://www.<site host>/`; expected: 301 and `Strict-Transport-Security: max-age=31536000`
  - [ ] an unknown host — GET `http://elsewhere.test/`; expected: 404 and the four headers
- [ ] `tools/repository-shape/src/api-source.test.ts::every static file answers with the security headers` — input: `apps/api/public/_headers`; expected: `/*` followed by exactly `X-Content-Type-Options: nosniff`, `Strict-Transport-Security: max-age=31536000`, `Referrer-Policy: no-referrer`
- [ ] `tools/repository-shape/src/runbooks.test.ts::the junk link body is well formed but for its unsolved token` — input: `scripts/deploy-bodies/junk-turnstile-link.json`; expected: `app_link_scheme` is `todz`, the rest as today

Lane M (`apps/macos`, `tools/repository-shape`):

- [ ] `apps/macos/TodzKit/Tests/TodzKitTests/AppLinkSchemeTests.swift::the plist names the scheme` — input: `["TodzLinkScheme": "todz-dev"]`, then `["TodzLinkScheme": "todz"]`; expected: `.debug`, then `.release`
- [ ] `AppLinkSchemeTests.swift::a missing or foreign value is no scheme` — input: `[:]`, `["TodzLinkScheme": ""]`, `["TodzLinkScheme": "https"]`; expected: `nil` for each
- [ ] `SignInLinkTests.swift::the bundle's own scheme is accepted` — input: `todz-dev://sign-in?token=<43 chars>&turnstile=<token>` with `.debug`; expected: a `SignInLink` with that token and turnstile token
- [ ] `SignInLinkTests.swift::the other build's scheme is refused` — input: `todz://sign-in?token=<43 chars>&turnstile=<token>` with `.debug`, then `todz-dev://…` with `.release`; expected: `nil` for each
- [ ] `WidgetLinkTests.swift::the widget link uses the bundle's scheme` — input: `WidgetLink.today.url(scheme: .debug)`; expected: the URL's scheme is `todz-dev`
- [ ] `WidgetLinkTests.swift::a widget link in the other scheme is refused` — input: `todz-dev://today` with `.release`; expected: `nil`; with `.debug`: `.today`
- [ ] `OwnerAPITests+SignInLink.swift::the link request names the app's scheme` — input: `requestSignInLink(… linkScheme: .debug)` against the stub protocol; expected: the posted JSON holds `"app_link_scheme":"todz-dev"`
- [ ] `OwnerCodingTests.swift::the link request body encodes the scheme` — input: a `SignInLinkRequestBody` with `.release`; expected: the encoded keys are `email`, `link_challenge`, `turnstile_token`, `app_link_scheme`, the last `todz`
- [ ] `AppModelTests+SignInChallenge.swift::the model asks with its own scheme` — input: a model built with `linkScheme: .debug`, `requestSignInLink(email:)`; expected: the recorded call is `.requestSignInLink(email:challenge:turnstileToken:linkScheme: .debug)`
- [ ] `DayCloseCoordinatorTests.swift::a stale unengaged mode closes the popover it opened, on show` — input: a mode opened yesterday at the close time, not engaged, the clock past midnight and within `popoverShowWait` of the click, `popoverShown()`; expected: `closePopover` called once, `isClosingDay` false
- [ ] `DayCloseCoordinatorTests.swift::a stale unengaged mode closes the popover it opened, through open` — input: `check()` when due, an `openPopover` that moves the clock past midnight and answers `true`, `isPopoverVisible` `true`; expected: `closePopover` called once, `isClosingDay` false
- [ ] `tools/repository-shape/src/macos-identities.test.ts::each build has its own link scheme` — input: `apps/macos/project.yml` and both generated `Info.plist`s; expected: `TODZ_URL_SCHEME` is `todz-dev` in Debug and `todz` in Release; both plists carry `TodzLinkScheme` as `$(TODZ_URL_SCHEME)`; the app's `CFBundleURLSchemes` holds `$(TODZ_URL_SCHEME)`; `project.yml` has no `CFBundleURLSchemes: [todz]`

Lane T (`scripts`):

- [ ] `scripts/todz-cloudflare.test.sh::a zone path with nothing after the zone is refused` — input: `api GET "/zones/<zone-id>/"`; expected: exit non-zero, stderr `not on the allowlist`, the stub curl is not called
- [ ] `todz-cloudflare.test.sh::a bracket in a path is refused` — input: `api GET "/zones/<zone-id>/[a-b]"`; expected: exit non-zero, stderr `not on the allowlist`, the stub curl is not called
- [ ] `todz-cloudflare.test.sh::a brace in a path is refused` — input: `api GET "/zones/<zone-id>/{a,b}"`; expected: exit non-zero, stderr `not on the allowlist`, the stub curl is not called
- [ ] `todz-cloudflare.test.sh::curl gets globoff` — input: `api GET "/zones/<zone-id>/x"` with a stub curl that records its argv; expected: the recorded argv contains `--globoff` and the stub's `api.cloudflare.com` URL is the last argument

Every red test:

- [ ] Confirmed it fails for the right reason: for each red test above the developer pastes the failure text the run printed into its lane's section of `tester-briefing.md`; a failure that names a missing symbol or module is not red for the right reason.

## Pins (green on arrival, labelled `pin`)

- [ ] `security-headers.test.ts::a route's own headers are kept` — input: a response with `Referrer-Policy: no-referrer` and a `Content-Security-Policy` of its own; expected: both values unchanged, each header once
- [ ] `security-headers.test.ts::an upgrade is returned untouched` — input: a 101 response with a `webSocket` from a `WebSocketPair`; expected: the same object back, `webSocket` not `null`
- [ ] `sign-in-limiter.test.ts`, `admin-limiter.test.ts`, `waitlist-limiter.test.ts` after step 5 — input: the unchanged suites; expected: green, with the same counts as before the step
- [ ] `ChallengeNavigationTests.swift` — input: `todz-dev://sign-in?token=a&turnstile=b` in the main-frame and the sub-frame refused lists; expected: refused in both
- [ ] `DayCloseCoordinatorTests.swift::an engaged stale mode ends and closes nothing` — input: the stale mode of the first day-close row, engaged, `popoverShown()`; expected: `isClosingDay` false, `closePopover` not called
- [ ] `DayCloseCoordinatorTests.swift::a show the owner made does not close` — input: the stale mode, not engaged, the click older than `popoverShowWait`, `popoverShown()`; expected: `isClosingDay` false, `closePopover` not called
- [ ] `tools/repository-shape/src/focus-filter.test.ts::the Focus filter stays discoverable` — input: the source of `apps/macos/Todz/FocusFilter/TodzFocusFilter.swift`; expected: no match for `/isDiscoverable\s*(:\s*Bool\s*)?=\s*false/`
- [ ] `scripts/verify.test.sh` (only if plan step 20 runs and the cause is not a command shape) — input: the fixed gate command against stubs; expected: the case passes; labelled a pin, the fix proven by five clean runs

## Unit

- [ ] `apps/api/test/email-address.test.ts` — input: `a@b.co`; expected: `a@b.co`
- [ ] `email-address.test.ts` — input: `a+tag@b.co`; expected: `a+tag@b.co`
- [ ] Edge: empty and boundary — input: `""`, `"@"`, `"a@b"`, `"a@b/c.d"`, `"a:b@c.de"`; expected: `null` for each
- [ ] Edge: the length limit — input: an address of 255 characters; expected: `null` (the 254-character limit is unchanged)
- [ ] `apps/api/test/sign-in-limiter.test.ts` — input: the existing try-again case; expected: status 429, `Retry-After: 60` (unchanged)
- [ ] Edge: the limiter missing — input: the sign-in limiter binding absent; expected: 503 `sign_in_unavailable`, unchanged
- [ ] Edge: the limiter rejects — input: `limit()` rejects; expected: 503 `sign_in_unavailable`, unchanged
- [ ] `sign-in-page.test.ts` — input: the existing policy test; expected: green, the policy's script hash equals the hash of the served script
- [ ] Edge: a fragment with the scheme first — input: hash `#app=todz-dev&token=<T>`; expected: navigates `todz-dev://sign-in?token=<T>&turnstile=<U>`
- [ ] Edge: a fragment with two schemes — input: hash `#token=<T>&app=todz&app=todz-dev`; expected: the first value is read: navigates `todz://…`
- [ ] `security-headers.test.ts` — input: an empty 204 from a route; expected: all four headers with the default values
- [ ] Edge: immutable headers — input: `Response.redirect('https://todz.app/', 301)`; expected: no throw, 301, the `Location` kept, all four headers
- [ ] `email-contrast.test.ts` — input: the dark media query's `.email-link` colour and the dark card colour; expected: contrast ≥ 4.5
- [ ] `todz-cloudflare.test.sh` — input: `api GET "/zones/<zone-id>/x?per_page=5"`; expected: allowed, the stub curl called with `--globoff`
- [ ] `todz-cloudflare.test.sh` — input: `api GET "/accounts/<account-id>/d1/database/<db>?x=[1]"`; expected: refused, `not on the allowlist`
- [ ] `focus-filter.test.ts` — input: the regex against `static var isDiscoverable: Bool = true`, `static let isDiscoverable = false` and `isDiscoverable=false`; expected: no match, match, match (a table in the test)

## E2E (Playwright specs)

- [ ] `apps/api/e2e/landing.spec.ts` waitlist widget error — steps: route the Turnstile script to `ERRORING_TURNSTILE_STUB`, open the landing page, fill `ana@example.com`, press Join; expected: after the stub's delay the button shows its ready label (not "Joining…"), has no `aria-disabled`, the field still holds `ana@example.com`, and no request to `/join` was sent; a second press sets "Joining…" again
- [ ] `apps/api/e2e/admin.spec.ts` admin link page without JavaScript — steps: a context with `javaScriptEnabled: false`, open the admin link page; expected: the `<noscript>` title and body are visible, the working copy is not on the page
- [ ] `apps/api/e2e/admin.spec.ts` admin link page with JavaScript — steps: open the admin link page with a link that is still valid; expected: the status element is in the DOM with `role="status"` and no `hidden`, its title shows the working copy, then the admin panel loads
- [ ] `apps/api/e2e/landing.spec.ts` static asset headers — steps: `request.get('/brand/todz-lockup.png')`; expected: 200, `strict-transport-security: max-age=31536000`, `x-content-type-options: nosniff`, `referrer-policy: no-referrer`

## Build checks (Lane M, step 16)

- [ ] Debug build — input: `xcodebuild build … -configuration Debug -derivedDataPath apps/macos/build`, then `plutil -extract CFBundleURLTypes.0.CFBundleURLSchemes.0 raw` on the built `Todz.app/Contents/Info.plist`; expected: `todz-dev`
- [ ] Debug widgets — input: `plutil -extract TodzLinkScheme raw` on the built `Todz.app/Contents/PlugIns/TodzWidgets.appex/Contents/Info.plist`; expected: `todz-dev`
- [ ] Release build — input: the same two reads after `-configuration Release`; expected: `todz` and `todz`
- [ ] `swift test --package-path apps/macos/TodzKit` — expected: green; the count recorded

## Prove it for real — Playwright MCP

- [ ] Happy path, admin link page, entry to exit: open the admin link page with a valid link; expected: the status shows the working copy, then the admin panel; console and network clean.
- [ ] Admin link page without JavaScript: expected: only the `<noscript>` copy shows.
- [ ] Waitlist error path: route the Turnstile script to the erroring stub; expected: the Join button returns to its ready label and is enabled, the address field keeps its value, no notice changes and nothing is posted.
- [ ] Empty: the waitlist with an empty address; expected: the form refuses with the browser's required-field message, nothing sent.
- [ ] Rejected input: `https://a.bc/x?@a.bc` typed in the waitlist; expected: the browser's `type=email` check refuses it, no request sent (the server side is proven by `waitlist-join.test.ts`).
- [ ] Desktop width: the landing page at 1280 wide; expected: layout unchanged from `main`.
- [ ] Narrow width: the admin link page at 375 wide; expected: no horizontal scroll, the status copy wraps.
- [ ] Console and network clean: zero console errors, zero failed requests, other than the stubbed Turnstile error in the error walk.
- [ ] Mail: render the sign-in mail with `pnpm --filter @todz/api emails:preview`; expected: the white button label is readable at 16px on `#4764F5`; screenshot at `<path>`.
- [ ] Screenshots at `<path>`; video at `<path>`.

## Human checklist (the owner, before the deploy merge)

- [ ] System Settings → Focus → Add Filter: "Quiet todz" is listed on the build with this change; expected: listed (ADR 0057).
- [ ] LaunchServices: `/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister -dump | awk '/^path:/ { path = $0 } /claimed schemes:/ && / todz:/ { print path }' | sort -u`, then `lsregister -u <path>` for each path that is not the installed Release `Todz.app`; expected: the list then prints only the Release app.
- [ ] Debug and Release side by side, each asks for a sign-in link: expected: the Release mail's link ends `&app=todz` and opens only the Release app; the Debug mail's ends `&app=todz-dev` and opens only the Debug app.
- [ ] Read-only production counts (plan step 28): expected: `0` URL-shaped waitlist addresses and `0` URL-shaped email identities.
- [ ] After the deploy, the Release app rebuilt from `main` signs in with a production link; expected: signed in.

## The gates

- [ ] `pnpm verify` in each lane (classes: Lane W `product`, Lane M `product`, Lane T `product` with gates `all`) — evidence: each lane's gate summary in its briefing section.
- [ ] `pnpm verify all` on `feat/security-fixes` after the lanes merge — evidence: the gate output summary in the PR body (tooling rows ticked by the lead, product rows by the tester).
- [ ] `pnpm test:verify` — expected: `verify.test.sh`, `pr-media.test.sh` and `todz-cloudflare.test.sh` green.
- [ ] `pnpm security:audit` — expected: "No known vulnerabilities found" — evidence: 2026-11-25 run from the repository root; re-run before the merge.
- [ ] `pnpm audit` (full, dev dependencies too) — expected: no high or critical advisory; evidence: the run's output in the `## Lane T` briefing section.

## Edge cases found during execution

Empty on purpose. The tester adds one checkbox per new case (input, exact expected outcome) and a regression test for each.

## Adversarial review

The reviewer picks the three claims most likely to be wrong and tries to refute each.

- [ ] Claim 1: a sign-in link opens only the app that asked, whatever server it points at — attack: point the Release app at a local `wrangler dev` (`server-url`'s Settings → Server) and the Debug app at production, ask for a link from each, open each with `open '<link>'`, and read which app answers; also edit a link's `app=` to the other scheme and to `https`; result: refuted | held
- [ ] Claim 2: no answer leaves the Worker without the four headers, and live sync still upgrades — attack: list every `return` in `index.ts`, `owner-endpoint.ts`, `site-endpoint.ts` and `mcp-endpoint.ts`, hit one of each through `SELF.fetch`, and open a change socket from the app against `wrangler dev`; result: refuted | held
- [ ] Claim 3: no path that reaches curl can carry `[`, `]`, `{` or `}` and still be allowed — attack: fuzz `refuse_unlisted_path` with each allowlist prefix plus each bracket character in each position; result: refuted | held

## Coverage honesty

What is not tested and why.

- Apple's App Intent discoverability in System Settings — not testable in CI; covered by the owner's checklist line and ADR 0057's pin on the source.
- LaunchServices choosing between apps — not testable in CI; covered by the human checklist (unregister, then open each scheme). An app registered after the cleanup can claim `todz` again; the risk is accepted and the verifier still blocks a redeem.
- An app built before ADR 0058 is refused with 400 until rebuilt — no automated test against an old binary; the human checklist rebuilds the Release app right after the deploy.
- The workspace observer's move to `MenuBarPopover` (item 12b) — a SwiftUI path with no test harness; only `workspaceChanged()` is tested. The risk accepted is a close in a phase the coordinator does not expect; `workspaceChanged()` returns `false` outside a day close, which bounds it.
- A Turnstile script that never loads on the landing — not handled (plan Assumptions, item 7): the button stays on "Joining…" until a reload, as on the sign-in pages.
- Real mail clients (Gmail, Outlook, Apple Mail) rendering the new colour — only the computed contrast and the generated template are tested; the risk accepted is that a client overrides the colour.
- Screen reader announcement — the test checks the attributes (`role`, `aria-live`, no `hidden`, empty at load); no real screen reader runs. The risk accepted is a reader that ignores `aria-live="polite"`.
- Static asset headers in production — `wrangler dev`'s handling of `_headers` may differ from Cloudflare's; the runbook's asset curl after the deploy is the proof.
- Production headers — proven by the runbook's step 13 curls after the deploy and by the per-kind tests; a header dropped by Cloudflare in front of the Worker would show only in the curls.
- The `macos` gate flake (item 9) — if step 19 does not reproduce it in five runs, the fix is not pinned and the learning says so; the risk accepted is that the flake returns unseen.
- The waitlist daily row cap (item 12c) — not built (spec Non-goals); the rate limiters bound requests, and `security-sweep` picks it up.
- Dependency advisories after 2026-11-25 — `pnpm security:audit` runs on the merge day only; the risk accepted is a later advisory until the next sweep.
