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
