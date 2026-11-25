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

- Lane M fills this in.

### How to run

Lane M fills this in.

### Red today, green after

| Test | Red before the change because | Green after because |
|------|--------------------------------|---------------------|
| Lane M fills this in. |  |  |

### Hypotheses to attack

1. Lane M fills this in.

### Known gaps

- Lane M fills this in.

## Lane T

### What changed

- Lane T fills this in.

### How to run

Lane T fills this in.

### Red today, green after

| Test | Red before the change because | Green after because |
|------|--------------------------------|---------------------|
| Lane T fills this in. |  |  |

### Hypotheses to attack

1. Lane T fills this in.

### Known gaps

- Lane T fills this in.
