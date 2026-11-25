# Security fixes

**Status:** In review
**Tier:** 🔴
**Owner approval:** approved 2026-11-25 by the owner's directive in `todz-loop/PROMPT.md` ("Security" → `security-fixes`: "aí no loop tem security fixes? add aí"): production is live with real sign-in, so the known open findings do not wait for the final sweep; fix every item, red first, each with a test
**ADRs:** [0058](../../adr/0058-the-app-tells-the-server-its-own-link-scheme-and-the-sign-in-link-carries-it-back.md), [0057](../../adr/0057-the-focus-filter-stays-discoverable-so-the-owner-can-add-it.md), [0040](../../adr/0040-the-owner-signs-in-with-an-email-link-bound-to-the-mac-that-asked-for-it.md), [0044](../../adr/0044-the-wrangler-configuration-is-production-on-api-todz-app-and-development-overrides-it.md), [0045](../../adr/0045-the-public-sign-in-routes-are-limited-three-ways-and-turnstile-guarded-failing-closed.md), [0050](../../adr/0050-the-waitlist-answers-alike-for-every-address-mails-once-and-is-guarded-like-sign-in.md), [0054](../../adr/0054-the-app-learns-focus-through-a-todz-focus-filter-not-the-focus-status-api.md), [0055](../../adr/0055-the-day-closes-once-a-day-in-the-menu-bar-popover-at-the-owner-s-time.md), and ADR 0056 from `server-url` (the server is a runtime setting), which merges first
**Not changing:** the sign-in token format and its one-use rule; the verifier that binds a link to the Mac that asked; the limiters' thresholds and their fail-closed rule; the Turnstile guard and its secret (never read, printed or written to a file); the mail layout and copy, except the colour of the button and the link; the Release app's `todz://` scheme; the Worker's variables (no new one); product behaviour of Today and the Focus filter. The waitlist's daily row cap is not in this feature (see Non-goals).

## Problem

A review sweep left known findings open while production already runs real sign-in, the waitlist and the admin:

1. The Debug app and the Release app both register `todz://`. A production sign-in link can open the Debug app, which cannot redeem it; a local link can open the Release app.
2. `scripts/todz-cloudflare.sh` passes paths to curl without `--globoff`, so curl expands `[ ]` and `{ }` globs; a zone path with nothing after `/zones/<id>/` is accepted.
3. `ADDRESS_CHARACTER` in `apps/api/src/email-address.ts` admits `:` and `/`, so `https://…?@a.bc` is a valid address and renders as a clickable link in the digest. The same helper guards owner sign-in and the admin.
4. `apps/api/src/sign-in-limiter.ts` carries a third copy of `limitRefusal`; the shared one lives in `site/site-limiter.ts`, which a non-site module should not import.
5. White text on the mail button `#4C6BFF` has a 4.3:1 contrast ratio, below AA's 4.5:1; the same colour is the link colour on white.
6. The admin link page's live region starts `hidden`, which some screen readers do not announce.
7. The waitlist widget has no error, expired or timeout callback: when Turnstile errors, the button stays on "Joining…".
8. The Focus filter's discoverability is undecided.
9. The `macos` gate failed once on PR #32 and passed on retry. The cause is not recorded.
10. `pnpm security:audit` must show no high or critical advisory.
11. The API host's JSON, MCP and sign-in answers, the www redirect, the unknown-host 404 and the static assets lack some production headers the site pages set; no test pins them per host kind.
12. From run 17's reviews: `popoverShown()` ends an unengaged stale mode after midnight without closing the panel the day close opened; the workspace-change observer sits in `MenuBarToday` instead of `MenuBarPopover`; the waitlist has no daily row cap.
13. The fixes reach production through `docs/runbooks/deploy-the-api.md` from `main`, recorded in a follow-up run-log PR.

## Goals

- Every item in the table below is fixed red-first, each with a test that fails before the fix and passes after it; a test that is green on arrival is labelled a pin.
- A sign-in link opens only the app that asked for it, whatever server that app points at (ADR 0058).
- Every answer the Worker gives, on every host kind, and every static asset carries the security headers in item 11; the runbook's step 13 checks them in production.
- The repository's gates stay green: `pnpm verify` for each lane's class.

## Non-goals

- **The waitlist daily row cap (item 12, third part).** It needs a D1 table or a migration and an owner-chosen number; the rate limiters already bound the request rate, and the cap is not small. Left for `security-sweep`.
- **Other findings of the final sweep.** This feature is the list above only.
- **Changing dependency versions** unless `pnpm audit` reports a high or critical advisory (none does on 2026-11-25; see item 10).
- **Hiding the Focus filter** (ADR 0057 keeps it discoverable).

## Items

| # | Item | File(s) | Fix | Test |
|---|------|---------|-----|------|
| 1a | Each app's own scheme | `apps/macos/project.yml` (`TODZ_URL_SCHEME` per configuration in `settings.configs`; `TodzLinkScheme` in both `Info.plist`s; `CFBundleURLSchemes` in the app's only), `apps/macos/Todz/Info.plist` and `apps/macos/TodzWidgets/Info.plist` (regenerated), `apps/macos/TodzKit/Sources/TodzKit/AppLinkScheme.swift` (new), `SignInLink.swift`, `WidgetLink.swift`, `IncomingLink.swift`, `OwnerAPI.swift`, `SignInLinkRequestBody.swift`, `AppModel.swift`, `AppModel+SignInLink.swift`, `apps/macos/Todz/AppConfiguration.swift`, `apps/macos/Todz/AppDelegate.swift`, `apps/macos/TodzWidgets/WidgetConfiguration.swift` (new) and the four widget views that build links | Debug registers `todz-dev`, Release `todz`. The app and its widget extension read `TodzLinkScheme` through `AppLinkScheme.of(info:)`; a missing or unknown value stops the process with `fatalError`, never defaults to `todz`. The parsers take the scheme as a parameter and refuse the other build's; the app sends its scheme as `app_link_scheme` with every link request | `AppLinkSchemeTests`, `SignInLinkTests`, `WidgetLinkTests`, `OwnerAPITests+SignInLink`, `OwnerCodingTests`, `AppModelTests+SignInChallenge`; `macos-identities.test.ts` pins the build setting and both plists; the lane gate reads the built plists |
| 1b | The link carries the scheme back | `apps/api/src/app-link-scheme.ts` (new), `apps/api/src/sign-in-links.ts`, `apps/api/src/sign-in-page.ts`, `scripts/deploy-bodies/junk-turnstile-link.json`, `tools/repository-shape/src/runbooks.test.ts` | The Worker checks `app_link_scheme` against `AppLinkScheme` (unknown or missing → 400 `invalid_request`, nothing stored or mailed) and mails `…/sign-in#token=<token>&app=<scheme>`; the page script re-checks `app` against a fixed list and hands the token to `<scheme>://sign-in?…`, or shows the missing-link state | `sign-in-links.test.ts` (each scheme mailed back; each bad value refused), `sign-in-page.test.ts` (each scheme navigated; missing and unknown `app` navigate nowhere; the policy hash test unchanged and green) |
| 2 | Cloudflare wrapper | `scripts/todz-cloudflare.sh`, `scripts/todz-cloudflare.test.sh` | curl gets `--globoff`; a path with `[`, `]`, `{` or `}` is refused; the zone prefix needs at least one character after `/zones/<id>/` | `todz-cloudflare.test.sh`: each refused path fails with `not on the allowlist`; `/zones/<id>/` alone is refused; `/zones/<id>/x` is allowed; the recorded curl argv contains `--globoff` |
| 3 | URL-shaped address | `apps/api/src/email-address.ts` | `:` and `/` leave `ADDRESS_CHARACTER`; owner sign-in, the admin and the waitlist all refuse such an address | `email-address.test.ts`: `https://a.bc/x?@a.bc` → `null`; `waitlist-join.test.ts`: that address is answered try-again and nothing is kept; production rows are counted read-only before the deploy (human checklist) |
| 4 | Third `limitRefusal` | `apps/api/src/limit-refusal.ts` (new), `apps/api/src/sign-in-limiter.ts`, `apps/api/src/site/site-limiter.ts`, `apps/api/src/site/admin-limiter.ts`, `apps/api/src/site/waitlist-limiter.ts`, `AGENTS.md` | `limitRefusal` and its `LimitRefusal` enum move to a neutral module; the sign-in limiter maps `LimitRefusal` to its own answers; the local copy is deleted | A pin: `sign-in-limiter.test.ts`, `admin-limiter.test.ts`, `waitlist-limiter.test.ts` stay green unchanged |
| 5 | Mail button contrast | `apps/api/scripts/emails/email-style.ts`, `apps/api/src/emails/generated/email-templates.ts` (regenerated) | `BRAND_COLOR` in the mail style becomes `#4764F5`: white on it is 4.76:1, and it on `#FFFFFF` is 4.76:1. The button's gradient keeps `BRAND_DEEP_COLOR` `#1B2A9E`. `site-glyphs.ts` and `sign-in-page-icon.ts` keep `#4C6BFF` | `apps/api/test/emails/email-contrast.test.ts`: from the generated HTML, white against the button's background colour and each gradient stop ≥ 4.5, the light link colour on `#FFFFFF` ≥ 4.5, the dark link colour on the dark card ≥ 4.5, and the button and link hex is `#4764F5` |
| 6 | Live region | `apps/api/src/site/admin-link-page.ts` | The status element renders without `hidden`, keeps `role="status"` and `aria-live="polite"`, and its title and body render empty; the script fills the working copy, as it already does on its first run. The retry link keeps its own `hidden` | `admin-pages.test.ts`: no `hidden` on the status element, `aria-live="polite"`, empty title and body in the served HTML; E2E with JavaScript disabled: only the `<noscript>` copy shows |
| 7 | Widget callbacks | `apps/api/src/site/landing-page.ts`, `apps/api/e2e/turnstile-stub.ts`, `apps/api/e2e/landing.spec.ts` | The waitlist widget gets `data-error-callback`, `data-expired-callback` and `data-timeout-callback`, all naming one function (as `sign-in-challenge-page.ts` does) that takes each waiting form out of `waitingForToken` and puts its button back to its label and enabled | `site-pages.test.ts`: the three attributes name one function defined in the page script; E2E with an erroring Turnstile stub: the button is ready again, the address is kept and no join is posted |
| 8 | Focus filter | `tools/repository-shape/src/focus-filter.test.ts` (new), ADR 0057 | Decision: stays discoverable; the source keeps no `isDiscoverable` set to `false` | A pin: the filter's source does not match `isDiscoverable\s*(:\s*Bool\s*)?=\s*false` |
| 9 | Flaky `macos` gate | `scripts/verify.sh`, `scripts/verify.test.sh`, `scripts/verify-gates.tsv` if the path changes, `docs/self-host.md` if the `xcodebuild` line changes, `docs/learnings/` (new entry) | Reproduce first (plan step 19), name the cause, fix it, pin it | `verify.test.sh` pins the fixed command shape (a pin unless the cause is a command shape); the learning records the signal and the cause |
| 10 | Audit | `package.json`, `pnpm-lock.yaml` only if the audit reports | `pnpm security:audit` on 2026-11-25: "No known vulnerabilities found"; the full `pnpm audit` (dev dependencies too) is re-run and recorded | Evidence line in `test-plan.md`; no test if nothing changes |
| 11 | Production headers, every host | `apps/api/src/security-headers.ts` (new), `apps/api/src/index.ts`, `apps/api/src/http-header.ts`, `apps/api/src/site/site-headers.ts` (reuses `STRICT_TRANSPORT_SECURITY`), `apps/api/public/_headers`, `tools/repository-shape/src/api-source.test.ts`, `docs/runbooks/deploy-the-api.md` step 13 | `withSecurityHeaders` wraps every answer of `fetch`, on every host kind and for the unknown host: it fills `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'`, `Strict-Transport-Security: max-age=31536000`, `X-Content-Type-Options: nosniff` and `Referrer-Policy: no-referrer` where the answer left them out. An answer with a `webSocket` (the change feed's 101 on `/owner/projects/<id>/socket`) is returned untouched; any other is copied with `new Response(response.body, response)` before a header is set. `_headers` adds HSTS and `Referrer-Policy` to the static assets | `security-headers.test.ts`: a row per answer kind, built from the configured origins, asserting the status and the four headers; the 101 upgrade keeps its `webSocket`; `api-source.test.ts` pins `_headers`; an E2E reads an asset's headers |
| 12a | Stale mode closes the panel | `apps/macos/TodzKit/Sources/TodzKit/DayCloseCoordinator.swift`, `apps/macos/Todz/AppDelegate.swift` | A `closePopover` closure is injected beside `openPopover`. When `popoverShown()` ends an unengaged mode whose day has passed, and the show answers the day close's own click, it calls `closePopover()` once | `DayCloseCoordinatorTests`: through `popoverShown()` from the show, and through `check()` → `open()`: the panel closes once and the mode ends; engaged: the mode ends and nothing closes; a show the owner made after the click wait: the mode ends and nothing closes |
| 12b | Workspace observer | `apps/macos/Todz/MenuBar/MenuBarToday.swift`, `apps/macos/Todz/MenuBar/MenuBarPopover.swift` | The `onChange(of: model.activeWorkspaceIdentifier)` observer moves to `MenuBarPopover`. This is a behaviour change: it now fires while signed out, loading or naming, and survives `MenuBarToday` rebuilds | The existing `DayCloseCoordinatorTests` for `workspaceChanged()` stay green; the SwiftUI path is untested (coverage honesty); the reviewer reads the new home |
| 12c | Waitlist daily cap | none | Not done (Non-goals) | Recorded in `test-plan.md` coverage honesty |
| 13 | Production deploy | `docs/runbooks/deploy-the-api.md` (run log, written by a follow-up `docs` PR) | After the merge, the runbook runs from `main`; step 13's curls check the headers on the API, the site and a static asset; the Release app is rebuilt right after | Step 13 answers as its text says; the run log names the commit |

## Design

### Data flow

- **Sign-in link (items 1a, 1b; ADR 0058).** The app posts `POST /owner/sign-in-links` with `{email, link_challenge, turnstile_token, app_link_scheme}`, where the scheme is read from its own `Info.plist`. The Worker checks the scheme against `AppLinkScheme` and mails `https://<PUBLIC_ORIGIN>/sign-in#token=<token>&app=<scheme>`. The page's script reads both from the fragment, re-checks the scheme against its fixed list, solves Turnstile and opens `<scheme>://sign-in?token=…&turnstile=…`. LaunchServices hands it to the one app that registers that scheme, which parses it only if it is its own.
- **Addresses (item 3).** `normalizedAddress` refuses any address with `:` or `/` on every route that takes one: owner sign-in, the admin and the waitlist; the digest never receives a URL-shaped address from a new row.
- **Headers (item 11).** `fetch` in `index.ts` passes every answer through `withSecurityHeaders`, including `/health` (from `server-url`) and the unknown-host 404; a header the route set keeps its value. Static assets never reach the Worker, so `_headers` gives them HSTS, `nosniff` and `Referrer-Policy`.
- **Day close (item 12a).** The show of the popover reaches `popoverShown()` from `MenuBarPanelReader`'s `onShow` and from `open()`; on a stale, unengaged mode whose show answers the day close's own click, the coordinator ends the mode and calls the injected `closePopover`.

### Interfaces

- `AppLinkScheme` (TypeScript, `apps/api/src/app-link-scheme.ts`): `Release = 'todz'`, `Debug = 'todz-dev'`. Checked with `enumValueOf`.
- `POST /owner/sign-in-links` body: `app_link_scheme` is required.
- `AppLinkScheme` (Swift, TodzKit): `release = "todz"`, `debug = "todz-dev"`; `of(info:) -> AppLinkScheme?` and `of(bundle:)`, in the shape of `SharedFolder.of(info:)`. `SignInLink(url:scheme:)`, `WidgetLink(url:scheme:)`, `WidgetLink.url(scheme:)`, `IncomingLink(url:scheme:)`; `OwnerService.requestSignInLink(email:challenge:turnstileToken:linkScheme:)`; `AppModel` takes `linkScheme` at init.
- `limitRefusal({ limiter, key }) -> LimitRefusal | null` in `apps/api/src/limit-refusal.ts`.
- `withSecurityHeaders(response: Response): Response` in `apps/api/src/security-headers.ts`; new header names join the `HttpHeader` enum.
- `DayCloseCoordinator(…, openPopover:, closePopover:)`.

### Failure handling

- An unknown or missing `app_link_scheme` is a 400 `invalid_request`, the same as a malformed address; nothing is stored, limited or mailed.
- A missing or unknown `app` in the fragment shows the page's existing missing-link copy and navigates nowhere; no default scheme exists.
- A missing or unknown `TodzLinkScheme` in either `Info.plist` stops the app or the widget extension at the first read, which a build check catches before any owner does.
- An app built before this change is refused (400) by the new Worker until it is rebuilt; the deploy is followed by the Release rebuild.
- The live-region change and the widget callbacks only change what is announced or shown; no answer or state changes for the server.

## Open questions → answers

| Question | Options | Owner's answer | Date |
|----------|---------|----------------|------|
| Item 8: keep the Focus filter discoverable? | Keep the default (discoverable); hide it | Loop's call: keep discoverable (ADR 0057); the owner may overturn | 2026-11-25 |
| Item 5: which colour? | Darker step of the brand gradient; a new colour | Loop's call: `#4764F5` for the mail button and link (4.76:1 both ways), pinned by the test; the site and icon keep `#4C6BFF` | 2026-11-25 |
| Item 1: which Debug scheme, and who chooses the scheme a link opens? | A Worker variable; one shared scheme; a per-build host; the app names it | Loop's call (ADR 0058): Debug is `todz-dev`, and the app names its own scheme in the request, carried back in the link's fragment | 2026-11-25 |
| Item 12c: the waitlist daily cap | Build it now (migration, cap number); leave it | Leave it for `security-sweep`: a migration and an owner-chosen number make it not small | 2026-11-25 |
| Tier | 🟡 (the directive); 🔴 (the harness names sign-in and deploy files) | 🔴: the sign-in hand-off changes and ADR 0058 records it (plan review R1) | 2026-11-25 |

## Human checklist before the deploy merge

- [ ] Open System Settings → Focus, add a Focus, choose Add Filter: "Quiet todz" is listed (ADR 0057). Expect: the row appears on the build with this change.
- [ ] List every bundle LaunchServices holds for the scheme: `/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister -dump | awk '/^path:/ { path = $0 } /claimed schemes:/ && / todz:/ { print path }' | sort -u`. For every path that is not the installed Release `Todz.app` (a Debug build, an old build in another worktree's `apps/macos/build`), run `lsregister -u <path>`. Expect: running the list again prints only the Release app.
- [ ] Build Debug and Release side by side; ask for a sign-in link from each. Expect: the Release app's mail link ends `&app=todz` and opens only the Release app; the Debug app's ends `&app=todz-dev` and opens only the Debug app.
- [ ] Read-only, before the deploy: `scripts/todz-cloudflare.sh pnpm --filter @todz/api exec wrangler d1 execute todz-directory --remote --command "SELECT COUNT(*) AS url_shaped FROM waitlist WHERE address LIKE '%:%' OR address LIKE '%/%'"` and the same on `owner_identities` (`subject`, `provider = 'email'`). Expect: `0` for both; any other number means stop and tell the owner before the deploy.
- [ ] After the deploy, rebuild and reinstall the Release app, then sign in. Expect: the link opens the Release app and signs in.
- [ ] Run the runbook from `main`; step 13's curls answer with every header in item 11. Expect: each header present on `api.todz.app`, `todz.app` and one static asset.

## Test strategy summary

Each item is red first, in its own commit, then green; a test green on arrival is a pin and says so. Worker tests build their URLs from the configured origins and assert the status with every header. The Cloudflare wrapper is tested with a stub curl and a stub Keychain binary (the script already takes `TODZ_CLOUDFLARE_*_BINARY` overrides); the mail contrast is computed from the generated HTML; the widget callbacks run in Playwright with an erroring Turnstile stub; the admin page runs once with JavaScript off. The Swift items run through `swift test`, the Debug and Release `xcodebuild` builds and a read of the built `Info.plist`s. The deploy is proven by the runbook's step 13 against production and a run-log PR.
