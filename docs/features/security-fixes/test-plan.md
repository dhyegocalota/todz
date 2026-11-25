# Test plan: Security fixes

Every checkbox states the input and the exact expected outcome. A ticked box carries evidence after ` — evidence: ` (commit hash, log path, counts, screenshot path).

## The failing test first

- [ ] `apps/api/test/sign-in-page.test.ts::the page hands back the production scheme` — input: configuration `APP_LINK_SCHEME = "todz"`, GET `/sign-in`; expected: the page script's app link starts with `todz://sign-in?token=`
- [ ] `apps/api/test/sign-in-page.test.ts::the page hands back the development scheme` — input: configuration `APP_LINK_SCHEME = "todz-dev"`, GET `/sign-in`; expected: the page script's app link starts with `todz-dev://sign-in?token=`
- [ ] `apps/api/test/email-address.test.ts::a URL-shaped address is refused` — input: `https://a.bc/x?@a.bc`; expected: `normalizedAddress` returns `null`
- [ ] `apps/api/test/email-contrast.test.ts::white text on the button clears AA` — input: the button colour from `email-style.ts`; expected: contrast ratio of `#FFFFFF` on it ≥ 4.5
- [ ] `apps/api/test/email-contrast.test.ts::the link colour clears AA on white` — input: the link colour from `email-style.ts`; expected: contrast ratio of the link colour on `#FFFFFF` ≥ 4.5
- [ ] `apps/api/test/admin-pages.test.ts::the admin link status is announced` — input: GET the admin link page; expected: the element with `role="status"` has no `hidden` attribute and carries `aria-live="polite"`
- [ ] `apps/api/test/site-pages.test.ts::the waitlist widget reports errors` — input: GET the landing page with a Turnstile site key; expected: the `.cf-turnstile` element carries `data-error-callback` naming a function defined in the page script
- [ ] `apps/api/test/security-headers.test.ts::API JSON answers carry the CSP` — input: GET `https://api.todz.app/owner` without a session; expected: `Content-Security-Policy` is `default-src 'none'; frame-ancestors 'none'`
- [ ] `apps/api/test/security-headers.test.ts::API MCP answers carry nosniff` — input: POST `/mcp` with an empty body; expected: `X-Content-Type-Options` is `nosniff`
- [ ] `apps/api/test/security-headers.test.ts::the API sign-in page carries HSTS` — input: GET `/sign-in`; expected: `Strict-Transport-Security` is `max-age=31536000`
- [ ] `apps/api/test/security-headers.test.ts::the API answers no-referrer` — input: GET `/owner`; expected: `Referrer-Policy` is `no-referrer`
- [ ] `apps/api/test/security-headers.test.ts::the site admin page keeps no-referrer` — input: GET the admin page on the site host; expected: `Referrer-Policy` is `no-referrer` (unchanged)
- [ ] `apps/api/test/security-headers.test.ts::the www redirect carries HSTS` — input: GET `https://www.todz.app/`; expected: a 301 with `Strict-Transport-Security: max-age=31536000`
- [ ] `apps/macos` (Lane M) `TodzKit/Tests/TodzKitTests/SignInLinkTests.swift::the bundle's own scheme is accepted` — input: a link `todz-dev://sign-in?token=<43 chars>` with the bundle scheme `todz-dev`; expected: the link parses to the sign-in challenge
- [ ] `SignInLinkTests.swift::the other build's scheme is refused` — input: a link `todz://sign-in?token=<43 chars>` with the bundle scheme `todz-dev`; expected: the link is not accepted
- [ ] `WidgetLinkTests.swift::the widget link uses the bundle's scheme` — input: bundle scheme `todz-dev`, widget destination `Today`; expected: the URL's scheme is `todz-dev`
- [ ] `DayCloseCoordinatorTests.swift::a stale unengaged mode closes the panel on popover open` — input: a mode from the previous day, not engaged, the clock past midnight, `popoverShown()`; expected: the close signal fires once and the mode is ended
- [ ] `scripts/todz-cloudflare.test.sh::a zone path with nothing after the zone is refused` — input: `api GET "/zones/<zone-id>/"`; expected: exit non-zero, stderr `not on the allowlist`, the stub curl is not called
- [ ] `scripts/todz-cloudflare.test.sh::a bracket in a path is refused` — input: `api GET "/zones/<zone-id>/[a-b]"`; expected: exit non-zero, stderr `not on the allowlist`, the stub curl is not called
- [ ] `scripts/todz-cloudflare.test.sh::a brace in a path is refused` — input: `api GET "/zones/<zone-id>/{a,b}"`; expected: exit non-zero, stderr `not on the allowlist`, the stub curl is not called
- [ ] `scripts/todz-cloudflare.test.sh::curl gets globoff` — input: `api GET "/zones/<zone-id>/x"` with a stub curl that records its argv; expected: the recorded argv contains `--globoff` and the stub's `api.cloudflare.com` URL is the last argument
- [ ] `tools/repository-shape/src/focus-filter.test.ts::the Focus filter stays discoverable` — pin (green on arrival): input: the source of `apps/macos/Todz/FocusFilter/TodzFocusFilter.swift`; expected: the source does not contain `isDiscoverable = false`
- [ ] Confirmed it fails for the right reason: for each red test above the developer pastes the failing assertion text the run printed into `tester-briefing.md`, not the expected text; a failure that names a missing symbol (`is not implemented`) is not red for the right reason.

## Unit

- [ ] `apps/api/test/email-address.test.ts` — input: `a@b.co`; expected: `a@b.co`
- [ ] `apps/api/test/email-address.test.ts` — input: `a+tag@b.co`; expected: `a+tag@b.co`
- [ ] Edge: empty / null / boundary — input: `""` and `"@"` and `"a@b"` and `"a@b/c.d"`; expected: `null` for each
- [ ] Edge: the error path, with the specific error — input: an address of 255 characters; expected: `null` (the 254-character limit is unchanged)
- [ ] `apps/api/test/sign-in-limiter.test.ts` — input: the existing try-again case; expected: status 429, `Retry-After` header `60` (unchanged)
- [ ] Edge: the limiter unavailable — input: the sign-in limiter binding missing; expected: status 503 with the `sign_in_unavailable` error, unchanged
- [ ] Edge: the error path, with the specific error — input: the limiter's `limit()` rejects; expected: status 503 `sign_in_unavailable`, unchanged
- [ ] `apps/api/test/sign-in-page.test.ts` — input: `APP_LINK_SCHEME` absent; expected: the page throws (no fallback to `todz`)
- [ ] Edge: empty scheme — input: `APP_LINK_SCHEME = ""`; expected: the page throws
- [ ] `apps/api/test/email-contrast.test.ts` — input: the rendered mail's button and link colours; expected: both ratios ≥ 4.5 and the generated template carries the same hex as `email-style.ts`
- [ ] `apps/api/test/security-headers.test.ts` — input: a response that already carries `Referrer-Policy: no-referrer`; expected: the helper keeps `no-referrer` and does not duplicate the header
- [ ] Edge: a response with no headers from a route — input: an empty 204 from a route; expected: all four headers present with the table's values
- [ ] Edge: the error path — input: a `Response` with a frozen header set (for example, from `Response.redirect`); expected: the helper returns a response carrying the four headers and does not throw
- [ ] `scripts/todz-cloudflare.test.sh` — input: `api GET "/zones/<zone-id>/x?per_page=5"`; expected: allowed, the stub curl is called with `--globoff`
- [ ] `scripts/todz-cloudflare.test.sh` — input: `api GET "/accounts/<account-id>/d1/database/<db>?x=[1]"`; expected: refused (a path the allowlist accepts but with a bracket)
- [ ] `tools/repository-shape/src/focus-filter.test.ts` — input: the source with `isDiscoverable = true` added; expected: the test still passes (only `false` is refused)

## E2E (Playwright specs)

- [ ] `apps/api/e2e/` waitlist widget error — steps: block the Turnstile script with a route abort, open the landing page, enter an address, press the join button; expected: the button is labelled ready (not "Joining…") and is enabled, and a second press after the widget's error callback is possible without a reload
- [ ] `apps/api/e2e/` admin link page — steps: open the admin link page with a link that is still working; expected: the status element is in the DOM with `role="status"` and no `hidden`; its text is the working copy

## Prove it for real — Playwright MCP

- [ ] Happy path, admin link page, entry to exit: open the admin link page with a valid link; expected: the status shows the working copy, then the admin panel; console and network clean.
- [ ] Waitlist error path: block the Turnstile script; expected: the form shows the try-again notice, the button is not stuck on "Joining…", the address field keeps its value.
- [ ] Empty: the waitlist with an empty address; expected: the form refuses with the existing validation copy, nothing sent.
- [ ] Rejected input: an address `https://a.bc/x?@a.bc` in the waitlist; expected: the form refuses it, no request sent, no link rendered.
- [ ] Desktop width: the landing page at 1280 wide; expected: layout unchanged from `main`.
- [ ] Narrow width: the admin link page at 375 wide; expected: no horizontal scroll, the status copy wraps.
- [ ] Console and network clean: zero console errors, zero failed requests, other than the blocked Turnstile script in the error walk.
- [ ] Mail: render the sign-in mail with the new colour; expected: the white button label is readable at 16px in the screenshot; screenshot at `<path>`.
- [ ] Debug/Release link: open a `todz-dev://sign-in?token=…` link in the Debug build and a `todz://` link in the Release build; expected: each opens only its own app; the other app stays closed.
- [ ] Screenshots at `<path>`; video at `<path>`.

## Human checklist (the owner, before the deploy merge)

- [ ] System Settings → Focus → Add Filter: "Quiet todz" is listed on the build with this change; expected: listed (ADR 0057).
- [ ] A production sign-in link, opened while the Debug app is installed: expected: the Release app opens, the Debug app does not.

## The gates

- [ ] `pnpm verify` on the whole branch after the lanes merge — evidence: the gate output summary in the PR body (`tooling` tick by the lead, `product` tick by the tester).
- [ ] `pnpm security:audit` — expected: "No known vulnerabilities found" — evidence: 2026-11-25 run from the repository root; re-run before the merge.
- [ ] `pnpm audit` (full, dev dependencies too) — expected: no high or critical advisory; evidence: the run's output recorded in the tester briefing.

## Edge cases found during execution

Empty on purpose. The tester adds one checkbox per new case (input, exact expected outcome) and a regression test for each.

## Adversarial review

The reviewer picks the three claims most likely to be wrong and tries to refute each.

- [ ] Claim 1: a link for the Release scheme never reaches the Debug app, and a Debug link never reaches the Release app — attack: install both builds, send a token link for each scheme through `open`, and read the answering app; result: refuted | held
- [ ] Claim 2: every mail button and link clears AA on the rendered page in both light and dark mail styles — attack: render the dark-mode media query and compute the contrast of the dark card's text and the link on it; result: refuted | held
- [ ] Claim 3: no path that reaches curl can carry `[`, `]`, `{` or `}` and still be allowed — attack: fuzz `refuse_unlisted_path` with each allowlist prefix plus each bracket character in each position; result: refuted | held

## Coverage honesty

What is not tested and why.

- Apple's App Intent discoverability in System Settings — not testable in CI; covered by the owner's checklist line and ADR 0057's pin on the source.
- Real mail clients (Gmail, Outlook, Apple Mail) rendering the new colour — only the computed contrast and the generated template are tested; the risk accepted is that a client overrides the colour.
- Screen reader announcement — the test checks the attributes (`role`, `aria-live`, no `hidden`); no real screen reader runs. The risk accepted is a reader that ignores `aria-live="polite"` on a status that starts empty.
- Production headers — proven by the runbook's step 13 curls after the deploy and by the per-host tests; a header dropped by Cloudflare in front of the Worker would show only in the curls.
- The `macos` gate flake (item 9) — if step 15 does not reproduce it in five runs, the fix is not pinned and the learning says so; the risk accepted is that the flake returns unseen.
- The waitlist daily row cap (item 12c) — not built (spec Non-goals); the rate limiters bound requests, and `security-sweep` picks it up.
- Dependency advisories after 2026-11-25 — `pnpm security:audit` runs on the merge day only; the risk accepted is a later advisory until the next sweep.
