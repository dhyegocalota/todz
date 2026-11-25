# Tester briefing: Landing admin

Written by the developers when the build ends.

## G1: store, guard, session, routes (branch `feat/landing-admin-store`)

### What changed

- `apps/api/migrations/0006_admin.sql`: `admin_sign_in_links`, `admin_sessions` (with `email`, R8) and the `waitlist_joined_at` index (R19).
- `apps/api/src/site/admin-store.ts`: the capped link insert, the one-statement spend, sessions, the panel summary (newest 200, `ADMIN_WAITLIST_ROWS_MAX`) and the full export rows.
- `admin-limiter.ts`, `admin-session.ts` (cookies, the R11 same-origin rule, `adminEmailOf`, `hasAdminSession`), `admin-sign-in.ts` (`POST /admin/sign-in-links` and `POST /admin/sessions`), `admin-export.ts` (CSV and its route), `admin-routes.ts` (panel, link page, sign-out and the route list), `site-endpoint.ts` (merges the admin routes).
- New small files outside the plan's list, all mine by creation: `apps/api/src/request-body.ts` (bounded-body and media-type checks, the same logic `waitlist-join.ts` keeps privately), `apps/api/src/site/admin-answer.ts` (status per notice, the admin headers, cookies and `Retry-After` on what G2's pages return), `apps/api/test/admin-client.ts` (test helpers).
- `env.ts` (`ADMIN_EMAIL` and three limiters), `libs/types/src/constants.ts` (four admin constants, R16), `wrangler.jsonc` (`ADMIN_EMAIL`, namespaces 8607 to 8609), `package.json` (`--var ADMIN_EMAIL:admin@todz.test` on the four dev scripts).

### How to run

- `pnpm --filter @todz/api exec vitest run test/admin-store.test.ts test/admin-limiter.test.ts test/admin-session.test.ts test/admin-sign-in.test.ts test/admin-export.test.ts test/site-dispatch.test.ts`
- `pnpm --filter @todz/repository-shape exec vitest run src/api-source.test.ts`
- `pnpm --filter @todz/api typecheck`

### Red tests and their green commits

Each red commit is before its green one in `git log`. The failure text is what the red run printed.

| Test file | Red commit | Failure text printed | Count | Green commit |
|---|---|---|---|---|
| `admin-store.test.ts` | f9d1e11 | `Error: <name> is not implemented` from the stubs (`insertAdminLinkWithinLimit`, `openAdminSession`, `adminSessionEmail`, `waitlistSummaryOf`, `waitlistRowsOf`); migration 0006 lands in the red commit because the tests clear and seed its tables | 21 fail | 75820e4 |
| `admin-limiter.test.ts` | d74f09e | `Error: isAdminUnguarded is not implemented`, `adminClientRefusal`, `adminAddressRefusal`, `adminGlobalRefusal` | 27 fail | 41c7775 |
| `admin-session.test.ts` | 7063463 | `Error: adminCookieHeaderOf is not implemented` (and the other six stubs); one pin: the lifetimes test, because the stub file declares the two constants | 34 fail, 1 pin | 37558b9 |
| `admin-sign-in.test.ts` | da04c37 | `Error: serveAdminSignInLink is not implemented` (the 50 link tests and every session test that first asks for a link) and `Error: serveAdminSession is not implemented` (1) | 95 fail | 99dc1d9 |
| `admin-export.test.ts` | e86dc28 | `Error: waitlistCsvOf is not implemented`, `Error: serveAdminExport is not implemented` | 22 fail | cf32203 |
| `site-dispatch.test.ts` (admin routes) | 70407e5 | `AssertionError: expected 404 to be 200` (9), `to be 303` (5), `to be 403` (1), `to be 503` (4), `expected '' to be 'sign-in none widget'` (2), `expected null to be 'no-store'` (1), the other six on the same 404 through `toEqual` and `toContain` | 28 fail, 55 pins (the 404 of unmatched methods and paths, the API host, the www redirect) | 1de4ab5 |
| `api-source.test.ts` (admin pins) | 6a9d716 | `expected { SIGN_IN_PROVIDER: 'email', …(3) } to deeply equal { …(4) }`, `expected [ …(6) ] to deeply equal [ …(9) ]`, `expected 'wrangler d1 migrations apply todz-dir…' to contain '--var ADMIN_EMAIL:admin@todz.test'` | 6 fail | 1b84f94 |

The step 1, 2, 3 and 5 stubs sit in the red commits and the tests call handlers directly (R12); the step 6 tests go through `worker.fetch`.

### Hypotheses for the tester (each is a claim to try to break, not a fact)

- A link can be spent only with its own token, the challenge cookie it was asked with, and the address that is `ADMIN_EMAIL` now, within fifteen minutes, once. Try: the token with another browser's challenge; two spends at once; a spend after `ADMIN_EMAIL` changes.
- `POST /admin/sign-in-links` answers the admin's address and any other address with the same status, header names, body and cookie attributes, and answers before D1 or the sender is touched (a directory that throws and a sender that never resolves change nothing). Try measuring the time of both with the dummy keys.
- The challenge cookie rides only the 200 card; the 403, 429 and 503 answers carry no `Set-Cookie`.
- The sixth admin link in fifteen minutes is not stored or mailed and still answers the same card.
- Every state change is refused unless `Sec-Fetch-Site` is `same-origin`, or, when it is absent, `Origin` equals `SITE_ORIGIN`; both absent is refused. Try `same-site` with the API origin.
- Two `__Host-todz_admin` cookies in one header give no session; the challenge cookie is never a session.
- A session counts only while its stored address equals the valid `ADMIN_EMAIL`: unset gives the 503 closed card on `GET /admin` and a 303 on the CSV; sign-out still deletes the row and clears the cookie.
- The CSV quotes every field, doubles `"`, prefixes `=`, `+`, `-`, `@`, tab and carriage return with `'`, uses ISO 8601 UTC dates and ends every line with `\r\n`, newest row first, with every row past the panel's 200.
- `/admin` and its paths answer the site's 404 on the API host and for every method or path outside the table; `www` redirects.
- Production still answers the closed card for sign-in until the Turnstile keys, the limiters and a sender are there.

### Gaps and things left to other owners

- `apps/api/test/worker.test.ts` "lists exactly the nine directory tables" fails since migration 0006 (`admin_sessions` and `admin_sign_in_links` join `DIRECTORY_TABLES`, and the title says eleven). I do not own that file; asked the lead.
- `tools/repository-shape/src/self-host.test.ts` "the rate-limit namespaces it names are the configured ones" fails until `docs/self-host.md` names 8601 to 8609 (the lead's R13 item).
- `HEAD /admin` and `HEAD /admin/sign-in` answer the `GET` status and headers; a `HEAD` through `worker.fetch` in a test still carries the body, which the platform drops at the edge, as it does for `HEAD /`.
- `waitlist-join.ts` keeps its own copies of the body-size and media-type checks; it could adopt `src/request-body.ts` (not mine to edit).
- The pages, the mail and the E2E are G2's; G1 compares with what `serveAdminSignInPage`, `serveAdminPanel`, `serveAdminLinkPage` and `adminSignInMail` return, never literal markup (R5).
- The expired-row clean-up of `admin_sign_in_links` and `admin_sessions` runs on insert only; a spent link row stays until it expires and the next insert.
- Not run by G1: the E2E, any browser, the full `pnpm verify`.

## G2: pages, mail and E2E (branch `feat/landing-admin-page`)

### What changed and where

| Area | Paths |
|---|---|
| Sign-in cards, answer cards and the panel | `apps/api/src/site/admin-page.ts`, copy in `admin-copy.ts` |
| Link page and its script | `apps/api/src/site/admin-link-page.ts` |
| Admin response headers, `connectsToSelf` on the policy | `apps/api/src/site/site-headers.ts` (`adminPageResponse`, the named `connectsToSelf`); the three existing callers pass `false` (`landing-page.ts` twice, `self-host-page.ts`) |
| Admin styles, appended to the one hashed `SITE_STYLE` | `apps/api/src/site/site-style.ts` |
| Mail | `apps/api/scripts/emails/admin-sign-in-template.ts`, `admin-sign-in-email-copy.ts`, `generated-emails.ts`, `apps/api/src/emails/admin-sign-in-mail.ts`, regenerated `src/emails/generated/email-templates.ts` |
| E2E | `apps/api/e2e/admin.spec.ts`, `turnstile-stub.ts` (moved out of `landing.spec.ts`), `site-environment.ts` (the admin address and the log file name), `apps/api/playwright.config.ts` |

### How to run

- Rendering: `pnpm --filter @todz/api exec vitest run test/admin-pages.test.ts test/admin-sign-in-mail.test.ts test/emails/admin-sign-in-email.test.ts` (95 tests), or the whole suite `pnpm --filter @todz/api exec vitest run` (1325 tests, 55 files).
- Mail module: `pnpm --filter @todz/api emails:check`.
- E2E, one Playwright run at a time: `pnpm --filter @todz/api exec playwright test e2e/landing.spec.ts` (38 passed, 2 skipped after the stub move) and `pnpm --filter @todz/api exec playwright test e2e/admin.spec.ts`.

### Red today and green after

| Test | Red commit | Printed failure | Green commit |
|---|---|---|---|
| `test/admin-pages.test.ts` (81 tests; 70 failed, 11 passed at red) | `499ca3d` | `Error: the page has no main` (17), `the page has exactly one inline element of that kind` (6), `the page has no content security policy` (5), `AssertionError: expected 'text/plain;charset=UTF-8' to be 'text/html; charset=utf-8'`, `expected 'panel 1' to contain '&quot;&gt;&lt;img src=x onerror=alert…'` | `3289889` |
| `test/emails/admin-sign-in-email.test.ts` (10 tests) | `249ca88` | `AssertionError: expected '' to be 'Sign in to the todz admin'`, `expected '' to contain 'Sign in to the admin'`, `Error: the mail has no image` | `195d966` |
| `test/admin-sign-in-mail.test.ts` (4 tests) | `249ca88` | `expected 'Sign in to the todz admin at https://…' to be 'Sign in to the todz admin'`, `expected 'https://todz.app/admin/sign-in#token=…' to contain 'href="https://todz.app/admin/sign-in#…'` | `195d966` |
| `test/emails/generated-emails.test.ts` (existing) | `249ca88` | stale generated module after the new enum member | `195d966` |
| `e2e/admin.spec.ts` (7 tests, all `test.fail`) | `a4ede75` | each fails at its first assertion because `/admin` is the site's 404 on this branch | the lead removes `test.fail` after merging the routes |

Pins (green when they landed): `leaves no slot unfilled in either part` in `admin-sign-in-mail.test.ts` (`249ca88`); `ff45d4c`, which moves the Turnstile stub and adds `ADMIN_EMAIL` and the log file to the E2E server.

The preview line of the mail is html-only (react-email marks it `data-skip-in-text`); the red test wrongly expected it in the text and was corrected in `195d966`.

### Hypotheses for the tester

- Every admin page answers 200 HTML with `Cache-Control: no-store`, `X-Robots-Tag: noindex`, the site's HSTS, nosniff and no-referrer, a hashed style, one hashed script at most, no `style=` and no event handler.
- Only the link page's policy has `connect-src 'self'`; the sign-in cards and the panel have none.
- The sign-in card shows no widget and loads no Turnstile script without a usable site key; with one it holds one interaction-only widget with action `admin_sign_in`, callback `adminTokenReady`.
- The check-inbox, closed and forbidden cards carry no form and no widget; closed carries no link at all.
- The panel escapes every address, groups the counts (`1,284`), prints joined as `YYYY-MM-DD HH:mm UTC`, shows the cap note only when the total is above the rows shown, and shows the empty card with no table when there are no rows.
- The link page is one fixed document: its script clears the fragment with `history.replaceState` before it posts `{"token": …}` to `/admin/sessions` with `same-origin` credentials, replaces the location with `/admin` on 201, and shows "This link can't be used." with a "Get a new link" link on every other answer, on a thrown request and when the fragment has no token.
- Real-browser check I did by hand with a throwaway preview server (not committed): the five cards, the panel with 200 rows and a 100-character address, the empty panel and the link page rendered at 1280 and 375, light and dark, with no horizontal scroll and no console error. The tester still confirms contrast with computed styles, forced colours and reduced motion.
- The admin mail carries the lockup from the origin slot, the link slot in the button, in the fallback link and its text, the 15 minutes from `ADMIN_SIGN_IN_LINK_LIFETIME_MINUTES`, and no address slot.
- The landing E2E passes unchanged in behaviour after the Turnstile stub moved.

### Gaps and changes for another owner

- **Header slot (design section 1).** The design makes the shell's header nav a parameter (nothing on the sign-in screens, the Sign out form on the panel). `site-shell.ts` is not in G2's list, so the "Self-host guide" link still shows in the header of the admin pages and Sign out sits in the panel's action row, beside Download CSV, inside `nav aria-label="Admin"`. The lead can add the optional nav parameter to `siteDocumentHtml` and move the form; the markup and styles are ready.
- **Link page refusal states.** The design has one failed state. The 429 and 503 answers of `/admin/sessions` show the same "This link can't be used." card, because the design gives the link page no other string.
- **The Node typing of pages.** `test/site/` is typed by `tsconfig.scripts.json`, which has no Workers types, so any test importing the pages or `adminSignInMail` lives in the Workers pool (`test/admin-*.test.ts`), not in `test/site/` as the plan said.
- **Three call sites outside G2's list** (`landing-page.ts` twice, `self-host-page.ts`) each gained `connectsToSelf: false`, one line each, because the new parameter is required.
- **E2E cannot run green here.** The routes are G1's, so the admin walk is unproven end to end; it was only run to see each test fail for the right reason. The log reader assumes the console sender's line is `{"to":…,"text":…}` possibly after a prefix, and the link is found in `text` by the pattern `…/admin/sign-in#token=<43 base64url>`. If wrangler wraps the line, fix `loggedMessages` in the spec.
- The mail button's 4.3:1 fill is the shared style, left as the design says.
