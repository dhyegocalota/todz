# Tester briefing: Landing admin

Written by the developers when the build ends.

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
