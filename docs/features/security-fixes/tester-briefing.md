# Tester briefing: Security fixes

Written by the developer sub-agents when their steps are done. The developers do not run `test-plan.md` and do not declare the feature works. Each lane keeps its own section.

## Lane W

### What changed

- Item 3: `apps/api/src/email-address.ts`: `:` and `/` leave `ADDRESS_CHARACTER`; owner sign-in, the admin and the waitlist refuse such an address (d2bffc0).
- Item 4: new `apps/api/src/limit-refusal.ts` (`limitRefusal`, `LimitRefusal`); `sign-in-limiter.ts` maps `LimitRefusal` to its own answers through a record and its copy is gone; `site/site-limiter.ts` keeps `isSiteUnguarded`; `AGENTS.md` helper line updated (c38bd08, pin).
- Items 6 and 7: `site/admin-link-page.ts`: the status element has no `hidden` and no `data-state` in the markup, its title renders empty, `status.hidden = false` left the script; `site/landing-page.ts`: the widget carries `data-error-callback`, `data-expired-callback` and `data-timeout-callback`, all naming `waitlistChallengeFailed`; `waitingForToken` is a `Map` from form to its `restore` function, which `pageshow` and the failure callback share (f025152).
- Item 5: `BRAND_COLOR` in `scripts/emails/email-style.ts` is `#4764F5`; `email-templates.ts` regenerated with `emails:generate` (2ec08d6).
- Item 11: new `src/security-headers.ts` (`withSecurityHeaders`); `index.ts` wraps the whole `fetch` through `serveHost`; four names join `HttpHeader`; `public/_headers` adds HSTS and `Referrer-Policy`; `AGENTS.md` helper line (06ba05d).
- Item 1b (ADR 0058): new `src/app-link-scheme.ts`; `sign-in-links.ts` requires `app_link_scheme` (string in the body schema, `enumValueOf`, `null` joins `isMalformedAsk`) and mails `#token=<token>&app=<scheme>`; `sign-in-page.ts` reads `app` from the fragment, accepts it only from a fixed list serialised once at module load, and builds `<scheme>://sign-in?token=…`; `scripts/deploy-bodies/junk-turnstile-link.json` carries `"app_link_scheme": "todz"` (9c031fd).
- Runbook step 13 gains two curls (`api.todz.app/owner`, `todz.app/brand/todz-lockup.png`), the header expectations and the count sixteen (bd529a0 red, 7e1367f).
- Tests that changed beside the new ones: the request helper and the limiter test body send `app_link_scheme`; the three navigation tests and the checking helper carry `&app=todz`; the cloudflare-sender test matches `&app=todz` in the text and `&amp;app=todz` in the html href; the admin link page test no longer expects the working copy in the served html.

### How to run

- `pnpm --filter @todz/api typecheck`
- `pnpm --filter @todz/api test:unit` (68 files, 1730 tests)
- `pnpm --filter @todz/api test:e2e` (57 passed, 2 skipped)
- `pnpm --filter @todz/api site:check`, `pnpm --filter @todz/api emails:check`
- `pnpm --filter @todz/repository-shape test:unit`
- A single file: `pnpm --filter @todz/api exec vitest run test/<file>.test.ts`

### Red today, green after

Red commit 7cfc915 (`git log` order: red 7cfc915, then d2bffc0, c38bd08, f025152, 2ec08d6, 06ba05d, 9c031fd). Printed failures from the red run:

| Test | Red before the change because | Green after because |
|------|--------------------------------|---------------------|
| `sign-in-links.test.ts` mails a link that hands the token back to the todz and todz-dev schemes | `expected 'Sign in to todz\n\nTap the button to …' to contain 'sign-in#token=<token>&app=todz'` | the link ends `&app=<scheme>` |
| `sign-in-links.test.ts` the app link scheme `""`, `https`, `javascript`, `TODZ`, `5`, `null`, and a missing one | `AssertionError: expected 202 to be 400` | `enumValueOf` null or a failed body schema is `invalid_request` before Turnstile, limiters and storage |
| `sign-in-page.test.ts` a solved check opens the app on the todz-dev scheme | `expected 'navigate todz://sign-in?token=AAAAAAA…' to be 'navigate todz-dev://sign-in?token=AAA…'` | the script builds `app + '://sign-in?token='` |
| `sign-in-page.test.ts` the fragments with no `app`, `app=`, `app=https`, `app=javascript`, `app=TODZ`, `app=todz-dev-x` | `AssertionError: expected 'checking' to be undefined` | the script checks `app` against the fixed list and leaves the missing state |
| `email-address.test.ts` `https://a.bc/x?@a.bc`, `a@b/c.d`, `a:b@c.de` | `expected 'https://a.bc/x?@a.bc' to be null` (and the other two likewise) | `:` and `/` are not address characters |
| `waitlist-join.test.ts` the address `https://a.bc/x?@a.bc` | `AssertionError: expected 200 to be 429` | the join answers try again, nothing kept |
| `emails/email-contrast.test.ts` white on the button, on each gradient stop, the light link on white | `expected 4.325991982245137 to be greater than or equal to 4.5` | `#4764F5` is 4.76:1 |
| `emails/email-contrast.test.ts` the brand colour test | `expected '#4C6BFF' to be '#4764F5'` | the style constant changed |
| `admin-pages.test.ts` a live region never hidden and starting empty | `expected ' class="link-status" data-state="work…' not to match /\shidden/` | no `hidden`, no `data-state`, empty title |
| `site-pages.test.ts` the widget names one function | `expected [ undefined, undefined, undefined ] to deeply equal [ 'waitlistChallengeFailed', …(2) ]` | three attributes on the widget |
| `site-pages.test.ts` four widget placement cases | `expected '<form id="join" class="join-form rise…' to contain '</button>\n</div>\n<div class="cf-tur…'` | the widget markup carries the three attributes |
| `security-headers.test.ts` 13 of 16 (every row but the three pins below) | `AssertionError: expected null to be 'max-age=31536000'` (`expected null to be 'nosniff'` for the route-policy case) | `withSecurityHeaders` fills the four headers |
| `api-source.test.ts` the `_headers` pattern | `AssertionError: expected '/*\n  X-Content-Type-Options: nosniff…' to match /…/` | `_headers` has three lines |
| `runbooks.test.ts` the junk link body | `AssertionError: expected undefined to be 'todz'` | the body carries the field |
| `runbooks.test.ts` the smoke check (bd529a0) | `AssertionError: expected '13. **Smoke check the live routes.** …' to contain 'When all sixteen pass'` and `… to contain 'curl -sS -D - -o /dev/null https://ap…'` | runbook step 13 edited |
| E2E `landing.spec.ts` the widget errors after the visitor submits (both projects) | `Expected: "Join the waitlist" Received: "Joining…"` | the failure callback restores the button |
| E2E `landing.spec.ts` a static asset's headers (both projects) | `- "referrer-policy": "no-referrer"`, `- "strict-transport-security": "max-age=31536000"` missing | `_headers` |
| E2E `admin.spec.ts` the link page without JavaScript | `getByText('Signing you in…')` `Expected: 0 Received: 1` | the title is empty in the markup |

Pins (green on arrival, not red-first proof): `security-headers.test.ts` POST /join (the landing page already sets the four), the 101 with its live socket, and the same-object 101 helper case; `email-contrast.test.ts` dark link on dark card; the fragments `#app=todz` and the other existing no-token cases; `sign-in-limiter.test.ts`, `admin-limiter.test.ts`, `waitlist-limiter.test.ts` unchanged through the limiter move (c38bd08).

### Hypotheses to attack

1. A request with `app_link_scheme` of `todz` or `todz-dev` mails a link whose fragment ends `&app=<scheme>`, and any other value, a number, null or a missing field answers 400 `invalid_request` before Turnstile, the limiters, the database and the mail.
2. The sign-in page opens `<scheme>://sign-in?token=…&turnstile=…&origin=…` for exactly the two schemes and shows the missing-link state, with no navigation, for no `app`, an empty one, `https`, `javascript`, any other case or a longer string; the page's content-security policy hash still matches its one inline script.
3. Every answer of `fetch` carries `Content-Security-Policy`, `Strict-Transport-Security`, `X-Content-Type-Options` and `Referrer-Policy` on the API host, the site host, the `www` redirect and an unknown host, and a route's own value is never overwritten; the change feed's 101 keeps its socket, so the Mac app's live sync still connects (to be tried by hand against a running worker).
4. A `Response.redirect` (immutable headers) and an empty 204 pass through the wrap without a thrown error.
5. Static assets answer HSTS, `nosniff` and `no-referrer` under `wrangler dev` (E2E) and in production (runbook step 13, not run by me).
6. The admin link page, with JavaScript off, shows only the noscript copy; with JavaScript on, a screen reader announces the working copy when the script writes it (not testable by me).
7. When the waitlist widget errors, expires or times out after a submit, the button is back to its label and enabled, the address is kept, no join is posted, and a second press submits again.
8. White on the mail button and its gradient stops, and the light link on white, are at least 4.5:1; the dark link on the dark card was already above it.
9. `limitRefusal` is the one copy; the sign-in limiter's answers (429 with `Retry-After` for try-again, 503 `sign_in_unavailable` for unavailable) did not change.

### Known gaps

- The Release and Debug apps and every Swift change belong to Lane M; until Lane M lands, a built app sends no `app_link_scheme` and is refused (400), as ADR 0058 says.
- The mail's rendering in real clients and a screen reader's announcement of the admin page are not tested; the contrast is computed from the generated HTML.
- A Turnstile script that never loads is not handled on the waitlist (spec Assumptions, item 7).
- The 101 path is tested for its status and its socket only; a live-sync walk against `wrangler dev` with the Mac app is left to the tester.
- Step 13's new curls and the header expectations were not run against production (the deploy follows the merge).
- Lane W's `pnpm verify` result is in the report to the lead, not here, because the gate records only green commits.

## Lane M

### What changed

- Commits: red `2cd8679`, green `806a3ef` (TodzKit), `be11717` (project, plists, app, widgets), `bc1d487` (day close), `f799eed` (observer move, a behaviour change).
- `AppLinkScheme` (`release` = `todz`, `debug` = `todz-dev`) reads `TodzLinkScheme` from an `Info.plist` (`of(info:)`, `of(bundle:)`). `SignInLink`, `WidgetLink` and `IncomingLink` take the scheme and refuse the other build's; `WidgetLink.url(scheme:)` writes it. `OwnerService.requestSignInLink(…linkScheme:)` sends `app_link_scheme`; `AppModel` takes `linkScheme` at init and passes it inside the `askedServer` guard.
- `project.yml`: `TODZ_URL_SCHEME` (`todz-dev` Debug, `todz` Release); app `CFBundleURLSchemes` is `$(TODZ_URL_SCHEME)`; `TodzLinkScheme` in both plists (regenerated and committed). `AppConfiguration.linkScheme` and `WidgetLinkConfiguration.linkScheme` call `fatalError` when the key is missing or unknown. The plan named the file `WidgetConfiguration.swift`; `WidgetConfiguration` is SwiftUI's protocol, so the type and file are `WidgetLinkConfiguration`.
- `DayCloseCoordinator` takes `closePopover`; `popoverShown()` of an unengaged stale mode whose show answers the click (within `popoverShowWait`) ends the mode and closes the panel once. `AppDelegate` passes `panel.close()` (wired in `be11717` so the app target compiled).
- The `onChange(of: model.activeWorkspaceIdentifier)` observer moved from `MenuBarToday` to `MenuBarPopover`.

### How to run

- `swift test --package-path apps/macos/TodzKit` (842 tests in 58 suites, green).
- `pnpm --filter @todz/repository-shape test:unit -- macos-identities`.
- `cd apps/macos && xcodegen generate`, then `xcodebuild build -project Todz.xcodeproj -scheme Todz -configuration Debug|Release -derivedDataPath build` (both succeed, no warnings). Built plists read with `plutil -extract`: Debug app `CFBundleURLSchemes.0` `todz-dev`, `TodzLinkScheme` `todz-dev`, widgets `TodzLinkScheme` `todz-dev`; Release prints `todz` in all three.
- `pnpm verify`: 7 gates green at `f799eed` (product).

### Red today, green after

Red run (`2cd8679`): `842 tests in 58 suites failed after 1.6 seconds with 18 issues`; the shape test `2 failed | 5 passed`.

| Test | Red before the change because | Green after because |
|------|--------------------------------|---------------------|
| `AppLinkSchemeTests.theKeyNamesTheScheme(text:expected:)` | `Expectation failed: AppLinkScheme.of(info: [linkSchemeKey: text]) == expected` (both cases) | `of(info:)` reads `TodzLinkScheme` |
| `SignInLinkTests.aDebugLinkIsASignInLinkOfTheDebugApp` | `Expectation failed: link?.token == token` | the parser compares `scheme.rawValue` |
| `SignInLinkTests.aReleaseLinkIsNotASignInLinkOfTheDebugApp` | `Expectation failed: try SignInLink(url: url("todz://sign-in?token=…"), scheme: .debug) == nil` | same |
| `SignInLinkTests.aDebugLinkIsNotASignInLinkOfTheReleaseApp` | pin: refused by the old `todz` check (green on arrival) | same |
| `WidgetLinkTests.aDebugLinkIsWrittenInTheDebugScheme` | `Expectation failed: WidgetLink.today.url(scheme: .debug).scheme == "todz-dev"` and `….absoluteString == "todz-dev://today"` | `url(scheme:)` builds from the scheme |
| `WidgetLinkTests.aDebugLinkIsReadByTheDebugAppAndNotByTheReleaseApp` | `Expectation failed: WidgetLink(url: url, scheme: .debug) == .today` | the parser compares `scheme.rawValue` |
| `WidgetLinkTests.aReleaseLinkIsNotReadByTheDebugApp` | `Expectation failed: WidgetLink(url: try #require(URL(string: "todz://today")), scheme: .debug) == nil` | same |
| `OwnerAPITests.requestSignInLinkPosts…TheAppsScheme…(linkScheme:)` | `Expectation failed: sent == body as NSDictionary` (both schemes) | the body carries `app_link_scheme` |
| `OwnerCodingTests.signInLinkRequestBodyPinsItsJson` | `Expectation failed: try encodedText(body) == #"{"app_link_scheme":"todz-dev","email":…}"#` | `appLinkScheme` is encoded |
| `AppModelTests+SignInLink` and `+SignInChallenge` (5 tests: `askingForALinkSendsTheChallengeOfAFreshVerifierAndKeepsThePendingLink`, `sendingAgainWithinTheLifetimeReusesTheVerifierAndMovesTheExpiry`, `askingSendsTheHeldChallengeTokenThenClearsItAndAdvancesTheRound`, `sendingAgainAfterTheLifetimeMakesANewVerifier`, `askingForAnotherAddressMakesANewVerifier`) | `Expectation failed: harness.service.calls == [.requestSignInLink(…, linkScheme: harnessLinkScheme)]`; the red model sent `.release`, the harness model is `.debug` | the model passes its own `linkScheme` |
| `DayCloseCoordinatorTests.aShowAfterMidnightThatAnswersTheClickEndsTheUnengagedModeAndClosesThePopoverOnce` | `Expectation failed: harness.popover.closings == 1` | `popoverShown()` calls `closePopover` |
| `DayCloseCoordinatorTests.anOpeningThatCrossesMidnightEndsTheUnengagedModeAndClosesThePopoverOnce` | `Expectation failed: harness.popover.closings == 1` | same, through `check()` → `open()` |
| `DayCloseCoordinatorTests.pinAShowAfterMidnightOfAnEngagedModeEndsItAndClosesNothing` | pin: green on arrival | stays green |
| `DayCloseCoordinatorTests.pinAShowAfterTheClickWaitEndsTheModeAndClosesNothing` | pin: green on arrival (guards the in-flight condition) | stays green |
| `ChallengeNavigationTests` (`todz-dev://sign-in?…` in both refused lists) | pin: green on arrival | stays green |
| `macos-identities.test.ts` `each configuration registers its own link scheme, and Release keeps todz` | `AssertionError: expected undefined to be 'todz-dev'` | `TODZ_URL_SCHEME` per configuration |
| `macos-identities.test.ts` `the app registers the configuration scheme and both plists name it for the code to read` | `AssertionError: expected 'name: Todz\noptions:…' not to contain 'CFBundleURLSchemes: [todz]'` | `project.yml` and both plists reference `$(TODZ_URL_SCHEME)` |

### Hypotheses to attack

1. A Debug build registers only `todz-dev` and a Release build only `todz`: open `todz://sign-in?…` and `todz-dev://sign-in?…` with both installed (after the LaunchServices cleanup in the spec's human checklist); each opens only its own app.
2. A sign-in link requested from the Debug app (to a local or production Worker) is mailed with `&app=todz-dev` once Lane W lands; the Release app's with `&app=todz`.
3. Widget taps in a Debug build open the Debug app (`todz-dev://today`, `todz-dev://task/…`) and Release's open Release.
4. The widget extension does not crash at launch: its built `Info.plist` carries `TodzLinkScheme` in both configurations.
5. A day close opened at 23:59 whose show lands after midnight closes the popover once and leaves no mode on; a popover the owner opens himself after midnight is never closed by the stale mode.
6. Moving the workspace observer closes nothing outside a day close, including while signed out, loading or naming.

### Known gaps

- The SwiftUI path of the observer move (step 15) has no automated test; only `DayCloseCoordinator.workspaceChanged()` is covered.
- `AppConfiguration.linkScheme` and `WidgetLinkConfiguration.linkScheme` (`fatalError` on a missing key) are not unit tested; the built-plist `plutil` reads are their proof.
- `AppDelegate`'s `closePopover` wiring (`panel.close()`) is exercised only through a real show after midnight, not by a test.
- A Release app built before Lane W deploys works only until the Worker requires `app_link_scheme`; the Release rebuild follows the deploy (spec, human checklist).
- `swift test` ran once green (842 tests); the flaky `macos` gate of item 9 belongs to Lane T.

## Lane T

### What changed

- `scripts/todz-cloudflare.sh` (item 2): curl gets `--globoff`; the path allowlist refuses `[`, `]`, `{`, `}`; the zone case is `"/zones/$zone_id/"?*`, so a bare `/zones/<id>/` is refused. Red `c52189e`, green `5ce6fd1`.
- `tools/repository-shape/src/focus-filter.test.ts` (item 8): pin, `23b4a89`.
- `docs/self-host.md` (step 25): one sentence about the Release app's scheme and ADR 0058, `f81fee7`.
- `docs/learnings/2026-11-25-the-macos-gate-failed-once-on-a-busy-machine-and-did-not-reproduce.md` and its index row (item 9, step 22), `a27c492`.
- Item 9: the flake did not reproduce in five runs, so no gate change was made (steps 20 and 21 not taken).
- Item 10: `pnpm audit` (full) and `pnpm security:audit` both print "No known vulnerabilities found"; no dependency change.

### How to run

- `pnpm test:verify` (runs `verify.test.sh`, `pr-media.test.sh`, `todz-cloudflare.test.sh`).
- `pnpm --filter @todz/repository-shape test:unit` (includes `focus-filter.test.ts`, `self-host.test.ts`, `document-indexes.test.ts`).
- `pnpm audit` and `pnpm security:audit` from the repository root.
- Item 9 commands, from a worktree: `swift test --package-path apps/macos/TodzKit`; `xcodegen generate --spec apps/macos/project.yml`; `xcodebuild build -project apps/macos/Todz.xcodeproj -scheme Todz -configuration Debug -derivedDataPath apps/macos/build`.

### Red today, green after

| Test | Red before the change because | Green after because |
|------|--------------------------------|---------------------|
| `scripts/todz-cloudflare.test.sh`, 13 checks red at `c52189e` (red against the real script, not stubs of the script; the curl and Keychain binaries are stubs) | `FAIL curl never expands globs: expected '--globoff' in 'security find-generic-password -s todz-cloudflare -w` / `curl -q -sS -X GET -H @- -H Content-Type: application/json https://api.cloudflare.com/client/v4/user/tokens/verify'`; then for each of `/zones/06490974636c535e2cbfd7c5b09925a5/`, `.../[a-b]` and `.../{a,b}`: `FAIL api exits non-zero for '<path>': expected '1', got '0'`, `api never reaches curl ... expected '0', got '1'`, `api never reads the Keychain ... expected '0', got '1'`, `api says why ... expected 'not on the allowlist' in ''`; ended `todz-cloudflare: 13 check(s) failed` | `5ce6fd1`: `--globoff` in the flags, glob characters refused, `"/zones/$zone_id/"?*`; `todz-cloudflare: all checks passed` |
| `tools/repository-shape/src/focus-filter.test.ts` | pin: green on arrival (`23b4a89`), never red; the Focus filter source has no `isDiscoverable = false` today | stays green while the source stays discoverable |

Item 9 has no red test: the cause was not reproduced, so no case in `verify.test.sh` was written.

### Hypotheses to attack

1. `api GET "/zones/<id>/"`, `api GET "/zones/<id>/[a-b]"` and `api GET "/zones/<id>/{a,b}"` are refused with `not on the allowlist` before the Keychain is read and before curl runs; `api GET "/zones/<id>/x"` and every path the runbook uses still go out, with `--globoff` in curl's arguments.
2. A glob character in the query string of an allowed zone path (for example `?name=[a]`) is also refused; that is intended, and no runbook path uses one.
3. The Focus filter pin fails if `isDiscoverable = false` or `isDiscoverable: Bool = false` is added to `TodzFocusFilter.swift`.
4. `pnpm audit` reports no advisory at any severity today.

### Known gaps

- Item 9 not reproduced in five runs. The runs were incremental (runs two to five reused the first run's `.build` and derived data, finishing in seconds) and ran at load averages 6.3, 10.1, 9.7, 9.4 and 9.4 with the sibling macOS lane building in parallel (a `swift-test` process of the sibling was alive when run one began). 828 tests in 57 suites passed each time. Clean-build and parallel-process contention were not exercised. Logs: `/private/tmp/claude-501/-Users-dhyegocalota-Projects-todz-todz/f8e4245f-9e04-4237-be7a-8e7963144fa4/scratchpad/macos-runs/`.
- `pnpm verify --plan` prints class `product` with gates `doctor format secrets typecheck audit unit e2e macos` for this lane, not the word `all`; `verify-gates.tsv` was not changed.
- `pnpm verify` is red at the `unit` gate on a file this lane does not own: `apps/api/test/site/generated-site.test.ts` fails because step 25 changed `docs/self-host.md` and the generated self-host page (`apps/api/src/site/generated/self-host-html.ts`, from `pnpm --filter @todz/api site:generate`) was not regenerated. The lead or Lane W must regenerate it after merging; the `e2e` and `macos` gates were not reached by `pnpm verify`.
- Step 19 left `apps/macos/build` and `.build` in the lane worktree (git-ignored); `xcodegen` produced no diff in tracked files.
