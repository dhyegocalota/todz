# Security fixes

**Status:** Approved
**Tier:** 🟡
**Owner approval:** approved 2026-11-25 by the owner's directive in `todz-loop/PROMPT.md` ("Security" → `security-fixes`: "aí no loop tem security fixes? add aí"): production is live with real sign-in, so the known open findings do not wait for the final sweep; fix every item, red first, each with a test
**ADRs:** [0057](../../adr/0057-the-focus-filter-stays-discoverable-so-the-owner-can-add-it.md), [0044](../../adr/0044-the-wrangler-configuration-is-production-on-api-todz-app-and-development-overrides-it.md), [0045](../../adr/0045-the-public-sign-in-routes-are-limited-three-ways-and-turnstile-guarded-failing-closed.md), [0050](../../adr/0050-the-waitlist-answers-alike-for-every-address-mails-once-and-is-guarded-like-sign-in.md), [0054](../../adr/0054-the-app-learns-focus-through-a-todz-focus-filter-not-the-focus-status-api.md), [0055](../../adr/0055-the-day-closes-once-a-day-in-the-menu-bar-popover-at-the-owner-s-time.md)
**Not changing:** the sign-in token format and its one-use rule; the limiters' thresholds and their fail-closed rule; the Turnstile guard and its secret (never read, printed or written to a file); the mail layout and copy, except the colour of the button and the link; the Release app's `todz://` scheme; product behaviour of Today, the day close and the Focus filter. The waitlist's daily row cap is not in this feature (see Non-goals).

## Problem

A review sweep left known findings open while production already runs real sign-in, the waitlist and the admin:

1. The Debug app and the Release app both register `todz://`. A production sign-in link can open the Debug app, which then holds the one-use token.
2. `scripts/todz-cloudflare.sh` passes paths to curl without `--globoff`, so curl expands `[ ]` and `{ }` globs; a zone path with nothing after `/zones/<id>/` is accepted.
3. `ADDRESS_CHARACTER` in `apps/api/src/email-address.ts` admits `:` and `/`, so `https://…?@a.bc` is a valid waitlist address and renders as a clickable link in the digest.
4. `apps/api/src/sign-in-limiter.ts` carries a third copy of `limitRefusal`, next to the one in `site/site-limiter.ts` that AGENTS.md names as the shared helper.
5. White text on the mail button `#4C6BFF` has a 4.3:1 contrast ratio, below AA's 4.5:1; the same colour is the link colour on white.
6. The admin link page's live region starts `hidden`, which some screen readers do not announce.
7. The waitlist widget has no `data-error-callback`: when Turnstile errors, the button stays on "Joining…".
8. The Focus filter's discoverability is undecided.
9. The `macos` gate failed once on PR #32 and passed on retry. The cause is not recorded.
10. `pnpm security:audit` must show no high or critical advisory.
11. The API host's JSON, MCP and sign-in answers lack some production headers the site sets; no test pins them per host kind.
12. From run 17's reviews: `popoverShown()` ends an unengaged stale mode after midnight without closing the panel; the workspace-change observer sits in `MenuBarToday` instead of `MenuBarPopover`; the waitlist has no daily row cap.
13. The fixes reach production through `docs/runbooks/deploy-the-api.md` from `main`, recorded in a follow-up run-log PR.

## Goals

- Every item in the table below is fixed red-first, each with a test that fails before the fix and passes after it.
- The Debug app and a local Worker never hand a sign-in token to the Release scheme, and a production link never reaches the Debug app.
- The production API and site answer every security header in the table on every host kind, and the runbook's step 13 checks them.
- The repository's gates stay green: `pnpm verify` for each lane's class.

## Non-goals

- **The waitlist daily row cap (item 12, third part).** It needs a D1 table or a migration and an owner-chosen number; the rate limiters already bound the request rate, and the cap is not small. Left for `security-sweep`.
- **Other findings of the final sweep.** This feature is the list above only.
- **Changing dependency versions** unless `pnpm audit` reports a high or critical advisory (none does on 2026-11-25; see item 10).
- **Hiding the Focus filter** (ADR 0057 keeps it discoverable).

## Items

| # | Item | File(s) | Fix | Test |
|---|------|---------|-----|------|
| 1a | Debug app's own scheme | `apps/macos/project.yml` (URL types, per configuration), `apps/macos/TodzKit/Sources/TodzKit/WidgetLink.swift` (`linkScheme`), the sign-in link parser in `apps/macos/TodzKit/Sources/TodzKit/IncomingLink.swift` and `AppModel+SignInLink.swift` | Debug registers `todz-dev`, Release `todz`, through a build setting used in `CFBundleURLSchemes`; the app and its widget read the scheme of the running bundle instead of the literal `todz` | `SignInLinkTests` and `WidgetLinkTests`: a link with the bundle's own scheme is accepted; the other build's scheme is refused |
| 1b | The Worker hands back the scheme | `apps/api/src/sign-in-page.ts` (`APP_LINK_PREFIX`), `apps/api/wrangler.jsonc` (`APP_LINK_SCHEME`: `todz` in production, `todz-dev` in the development override of ADR 0044), `apps/api/src/env.ts` | The page reads `APP_LINK_SCHEME` from the Worker's configuration and throws when it is missing; no fallback | `sign-in-page.test.ts`: the production configuration answers `todz://sign-in?token=`; the development configuration answers `todz-dev://sign-in?token=`; a missing value throws |
| 2 | Cloudflare wrapper | `scripts/todz-cloudflare.sh`, `scripts/todz-cloudflare.test.sh` | curl gets `--globoff`; a path with `[`, `]`, `{` or `}` is refused; the zone prefix needs at least one character after `/zones/<id>/` | `todz-cloudflare.test.sh`: each refused path fails with `not on the allowlist`; `/zones/<id>/` alone is refused; `/zones/<id>/x` is allowed; the recorded curl argv contains `--globoff` |
| 3 | URL-shaped address | `apps/api/src/email-address.ts` | `:` and `/` leave `ADDRESS_CHARACTER` | `email-address.test.ts`: `https://a.bc/x?@a.bc` → `null`; `a@b.co` and `a+tag@b.co` → themselves |
| 4 | Third `limitRefusal` | `apps/api/src/sign-in-limiter.ts`, `apps/api/src/site/site-limiter.ts` | The sign-in limiter imports the shared `limitRefusal` and maps its `SiteLimitRefusal` to the sign-in answers; the local copy is deleted | `sign-in-limiter.test.ts`: every existing answer unchanged (try-again 429 with `Retry-After`, unavailable 503) |
| 5 | Mail button contrast | `apps/api/scripts/emails/email-style.ts`, `apps/api/scripts/emails/*.ts` that use the colour, `apps/api/src/emails/generated/email-templates.ts` (regenerated) | The button and the link take the nearest step of the brand's own line from `#4C6BFF` to `#1B2A9E` that gives white text ≥ 4.5:1 on the button and the same colour ≥ 4.5:1 on `#FFFFFF`; the templates are regenerated | A contrast test in `apps/api/test/email-contrast.test.ts`: the computed ratio of white on the button colour ≥ 4.5 and the link colour on white ≥ 4.5, and the generated template carries the same hex |
| 6 | Live region | `apps/api/src/site/admin-link-page.ts` | The status element renders without `hidden` and keeps `role="status"` and `aria-live="polite"`; it is emptied and filled by the script, the retry link keeps its own `hidden` | `admin-pages.test.ts`: the status element has no `hidden` attribute and carries `aria-live="polite"` |
| 7 | Widget error callback | `apps/api/src/site/landing-page.ts` | The waitlist widget gets `data-error-callback` pointing at a function that returns the button to its ready state, the same pattern as `sign-in-challenge-page.ts` | `site-pages.test.ts`: the widget carries `data-error-callback`; a browser test (in `apps/api/e2e`) blocks Turnstile, then sees the button labelled ready, not "Joining…" |
| 8 | Focus filter | `tools/repository-shape/src/focus-filter.test.ts` (new), ADR 0057 | Decision: stays discoverable; the source keeps no `isDiscoverable = false` | `focus-filter.test.ts`: the filter's source has no `isDiscoverable = false` |
| 9 | Flaky `macos` gate | `scripts/verify.sh`, `scripts/verify.test.sh`, `scripts/verify-gates.tsv` if the path changes, `docs/learnings/` (new entry) | Reproduce first (see plan step T-2), name the cause, fix it, pin it | `verify.test.sh` pins the fixed command shape; the learning records the signal and cause |
| 10 | Audit | `package.json`, `pnpm-lock.yaml` only if the audit reports | `pnpm security:audit` on 2026-11-25: "No known vulnerabilities found"; the full `pnpm audit` (dev dependencies too) is re-run and recorded | Evidence line in `test-plan.md`; no test if nothing changes |
| 11 | Production headers, every host | `apps/api/src/security-headers.ts` (new), `apps/api/src/index.ts`, `apps/api/src/site/site-headers.ts` (reuses `STRICT_TRANSPORT_SECURITY`), `docs/runbooks/deploy-the-api.md` step 13 | A helper fills `Content-Security-Policy` (`default-src 'none'; frame-ancestors 'none'`), `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer` on every API-host answer; a header the route already sets keeps its value | `security-headers.test.ts` and `site-pages.test.ts`: one test per header per host kind (API JSON, API MCP, API sign-in page, site page, site admin page with `Referrer-Policy: no-referrer`, www redirect) |
| 12a | Stale mode closes the panel | `apps/macos/TodzKit/Sources/TodzKit/DayCloseCoordinator.swift`, `apps/macos/Todz/MenuBar/MenuBarPopover.swift`, `apps/macos/Todz/MenuBar/MenuBarToday.swift` | `popoverShown()` ending an unengaged stale mode also asks the panel to close, through the same signal the coordinator already uses | `DayCloseCoordinatorTests`: an unengaged mode from a previous day, then `popoverShown()` → the close signal fires once and the mode ends |
| 12b | Workspace observer | `apps/macos/Todz/MenuBar/MenuBarToday.swift`, `apps/macos/Todz/MenuBar/MenuBarPopover.swift` | The `onChange(of: model.activeWorkspaceIdentifier)` observer moves from `MenuBarToday` to `MenuBarPopover` | A pin: the existing `DayCloseCoordinatorTests` stay green; the reviewer checks the observer's new home |
| 12c | Waitlist daily cap | none | Not done (Non-goals) | Recorded in `test-plan.md` coverage honesty |
| 13 | Production deploy | `docs/runbooks/deploy-the-api.md` (run log, written by a follow-up `docs` PR) | After merge, the runbook runs from `main`; step 13's curls check the headers and the sign-in pages | `docs/runbooks/deploy-the-api.md` step 13 answers as its text says, production: each header present on `https://api.todz.app/owner` and `https://todz.app/`; the run log names the commit |

## Design

### Data flow

- **Sign-in link (items 1a, 1b).** The admin or the sign-in mail sends the browser to `https://api.todz.app/sign-in#token=…`. The Worker's `/sign-in` page reads `APP_LINK_SCHEME` and opens `<scheme>://sign-in?token=…`. The scheme is `todz` in production and `todz-dev` on a local origin, so a production link opens only the Release app.
- **Waitlist address (item 3).** `normalizedAddress` refuses any address with `:` or `/`; the digest never receives a URL-shaped address.
- **Headers (item 11).** Every response from the API host passes through `withSecurityHeaders` in `index.ts` before it leaves the Worker; a route's own header wins.

### Interfaces

- `APP_LINK_SCHEME` is a Worker variable, typed in `env.ts` as required. No default.
- `limitRefusal` (site-limiter) keeps its signature; the sign-in limiter maps its result.
- `withSecurityHeaders(response: Response): Response` in `apps/api/src/security-headers.ts`.
- The Swift side reads the scheme from the bundle's `CFBundleURLSchemes`; the literal `todz` stays only in the Release build setting.

### Failure handling

- A missing `APP_LINK_SCHEME` makes the sign-in page throw, which the Worker turns into a 500. A 500 is better than a link into the wrong app.
- A Debug build installed beside the Release build keeps both schemes; a link for the other scheme is refused by the app, not handled.
- The live-region change and the error callback only change what is announced or shown; no answer or state changes for the server.

## Open questions → answers

| Question | Options | Owner's answer | Date |
|----------|---------|----------------|------|
| Item 8: keep the Focus filter discoverable? | Keep the default (discoverable); hide it | Loop's call: keep discoverable (ADR 0057); the owner may overturn | 2026-11-25 |
| Item 5: which colour? | Darker step of the brand gradient; a new colour | Loop's call: the nearest step of `#4C6BFF`→`#1B2A9E` that gives ≥ 4.5:1, measured by the test | 2026-11-25 |
| Item 1: which Debug scheme? | `todz-dev`; `todz-debug` | Loop's call: `todz-dev` | 2026-11-25 |
| Item 12c: the waitlist daily cap | Build it now (migration, cap number); leave it | Leave it for `security-sweep`: a migration and an owner-chosen number make it not small | 2026-11-25 |
| Tier | 🟡 (the directive); the harness table names deploy and sign-in as 🔴 | 🟡 per the directive; the reviewer may raise it | 2026-11-25 |

## Human checklist before the deploy merge

- [ ] Open System Settings → Focus, add a Focus, choose Add Filter: "Quiet todz" is listed (ADR 0057). Expect: the row appears on the build with this change.
- [ ] Build Debug and Release side by side; a sign-in link for `todz://` opens the Release app only, and `todz-dev://` opens the Debug app only. Expect: the other app does not take the token.
- [ ] Run the runbook from `main`; step 13's curls answer with every header in item 11. Expect: each header present on `api.todz.app` and `todz.app`.

## Test strategy summary

Each item is red first, in its own commit, then green. Unit and Worker tests run in the lanes that own the code; the Cloudflare wrapper is tested with a stub curl and a stub Keychain binary (the script already takes `TODZ_CLOUDFLARE_*_BINARY` overrides); the mail contrast is a computed test; the widget fallback runs in Playwright with Turnstile blocked. The deploy is proven by the runbook's step 13 against production and a run-log PR. The Swift items run through `swift test` and the Debug `xcodebuild` build.
