# Landing admin

**Status:** Approved
**Tier:** 🔴 (a new sign-in path and session, a schema migration, personal data in a panel and an export)
**Owner approval:** approved 2026-11-25 by inheritance from the owner's request in PROMPT.md "Landing" ("cria uma landing page hiper mega simples com fila de espera, painel admin, digest etc … pra ser um prod ready mesmo"; "the admin authenticates as the owner") and "Security" (a rate limit and Turnstile on every public endpoint, failing closed). The behaviour is the loop's call in [ADR 0051](../../adr/0051-the-admin-signs-in-by-a-mail-link-bound-to-the-browser-that-asked-into-a-cookie-session.md).
**ADRs:** [0051](../../adr/0051-the-admin-signs-in-by-a-mail-link-bound-to-the-browser-that-asked-into-a-cookie-session.md), [0049](../../adr/0049-todz-app-is-served-by-the-same-worker-dispatched-by-host-in-three-features.md), [0050](../../adr/0050-the-waitlist-answers-alike-for-every-address-mails-once-and-is-guarded-like-sign-in.md), [0045](../../adr/0045-the-public-sign-in-routes-are-limited-three-ways-and-turnstile-guarded-failing-closed.md), [0042](../../adr/0042-emails-are-react-email-templates-rendered-at-build-time-into-a-generated-module.md), [0043](../../adr/0043-mail-leaves-through-cloudflare-email-service-from-noreply-at-todz-app.md)
**Not changing:** the API host and the app's sign-in; the landing page, `/join` and `/self-host`; the digest (`landing-digest`, next)

## Problem

The waitlist keeps addresses in D1, and nobody can read them without a database console. The owner wants a small panel on `todz.app` that he signs in to as himself, with the list and an export.

## Goals

- `https://todz.app/admin` without a session shows a sign-in card: one address field, the Turnstile widget (action `admin_sign_in`) and "Email me a link".
- Posting it answers the same "Check your inbox" card for every address, and sets a challenge cookie. Only `ADMIN_EMAIL` (`hello@todz.app`) gets a mail, "Sign in to the todz admin", with a link to `https://todz.app/admin/sign-in#token=…`.
- Opening that link in the same browser within fifteen minutes signs in once and lands on `/admin`. In another browser, after fifteen minutes or a second time, the page says the link can't be used and offers a new one.
- Signed in, `/admin` shows: the total on the list, joins in the last 24 hours, failed confirmations, and a table of the newest 200 rows (address, joined, confirmation: Sent or Failed), with "Download CSV" and "Sign out".
- `/admin/export.csv` downloads every row as `address,joined_at,confirmation`, newest first, safe to open in a spreadsheet.
- Every admin answer is `no-store` and `noindex`; nothing about an address reaches a log, a URL or a page other than the signed-in panel.

## Non-goals

- More than one admin, roles, deleting or editing rows, search, pagination beyond the newest 200 (the CSV has all).
- The digest mail and its cron (`landing-digest`).
- A password, TOTP or passkeys (ADR 0049, 0051).

## Design

### Routes (site host only)

| Method and path | Session needed | Answer |
|---|---|---|
| `GET /admin` | no | the panel with a session; the sign-in card without one |
| `POST /admin/sign-in-links` | no | the "Check your inbox" card, 200, with the challenge cookie; 429 or 503 cards on refusal |
| `GET /admin/sign-in` | no | the link page (a script spends the fragment) |
| `POST /admin/sessions` | no | 201 `{}` with the session cookie; 401 `{}` for a link that can't be used; 403 cross-origin; 429 over the limit; 503 unconfigured |
| `POST /admin/sign-out` | yes | 303 to `/admin`, session row deleted, cookie cleared |
| `GET /admin/export.csv` | yes | `text/csv; charset=utf-8`, `Content-Disposition: attachment; filename="todz-waitlist.csv"`; 303 to `/admin` without a session |

`HEAD` of the two pages answers like `GET`. Any other method or `/admin/*` path is the site's 404. The API host never serves these paths.

### Data flow

```
POST todz.app/admin/sign-in-links   (urlencoded, ≤ 4 KB: email, cf-turnstile-response)
  → guard: ADMIN_EMAIL valid, SITE_ORIGIN, both Turnstile keys, a sender, ADMIN_LIMITER / ADMIN_ADDRESS_LIMITER / ADMIN_GLOBAL_LIMITER, CF-Connecting-IP   missing → 503 card
  → same-origin check (Sec-Fetch-Site same-origin, or Origin = SITE_ORIGIN)                     else 403 card
  → per-client limit (key /admin/sign-in-links + clientRateKey)                                   refusal → 429 card, Retry-After 60
  → body parsed, address normalised (normalizedAddress), token pattern                           bad → 429 card ("try again")
  → siteverify (action admin_sign_in, host of SITE_ORIGIN)                                        refused → 429 card; unavailable → 503 card
  → global limit, then per-address limit (digest of the address)                                 refusal → 429 card
  → challenge = generateCredentialSecret(); cookie __Host-todz_admin_challenge = challenge (15 min)
  → address = ADMIN_EMAIL ? insert (digest(token), ADMIN_EMAIL, digest(challenge), now, now + 15 min) within five per 15 min,
                            then send the admin mail (failure: delete the row, still the same card)
                          : nothing stored, nothing sent
  → 200 "Check your inbox" card, the same for every address

POST todz.app/admin/sessions   (JSON ≤ 4 KB: {"token": "<43 base64url>"})
  → guard (ADMIN_EMAIL, ADMIN_LIMITER, client address) → 503;  same-origin → 403;  per-client limit → 429
  → token pattern and challenge cookie present                                                    else 401
  → UPDATE admin_sign_in_links SET consumed_at = now WHERE digest = ? AND challenge = ? AND email = ADMIN_EMAIL
        AND consumed_at IS NULL AND expires_at > now RETURNING digest                             none → 401
  → session secret; INSERT admin_sessions (digest(secret), now, now + 12 h) after deleting expired rows
  → 201 {}, Set-Cookie __Host-todz_admin = secret (12 h), Set-Cookie challenge cleared (Max-Age=0)

GET todz.app/admin, /admin/export.csv, POST /admin/sign-out
  → session = cookie __Host-todz_admin → SELECT … WHERE digest = ? AND expires_at > now
  → sign-out additionally needs the same-origin check (403 card otherwise)
```

### Interfaces

- **Migration `0006_admin.sql`:** `admin_sign_in_links (digest TEXT PRIMARY KEY, email TEXT NOT NULL, challenge TEXT NOT NULL, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, consumed_at INTEGER) STRICT` and `admin_sessions (digest TEXT PRIMARY KEY, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL) STRICT`. Expired link rows are deleted on each insert, as `sign_in_links` does.
- **`wrangler.jsonc`:** `vars.ADMIN_EMAIL = "hello@todz.app"`; `ratelimits` `ADMIN_LIMITER` 8607 (10/60), `ADMIN_ADDRESS_LIMITER` 8608 (3/60), `ADMIN_GLOBAL_LIMITER` 8609 (30/60). `dev:site` passes `--var ADMIN_EMAIL:admin@todz.test`; `dev` and the `dev:email` scripts pass it too so the configurations agree. `Env` gains the four.
- **`TurnstileAction.AdminSignIn = 'admin_sign_in'`.**
- **Cookies:** `__Host-todz_admin_challenge` (Max-Age 900) and `__Host-todz_admin` (Max-Age 43200), both `Path=/; Secure; HttpOnly; SameSite=Strict`. Only the admin routes read them.
- **Mail:** `EmailTemplateName.AdminSignIn`, a React Email template on the shared layout (lockup header, one button "Sign in", "This link works once, for 15 minutes, in the browser where you asked for it."), generated by `pnpm emails:generate`.
- **Pages:** template strings on `site-shell.ts` and `site-style.ts`, copy in `site/admin-copy.ts`, hashed CSP from `siteContentSecurityPolicy`, plus `Cache-Control: no-store` and `X-Robots-Tag: noindex` (both admin-only, replacing `no-cache`). The sign-in card's widget uses the waitlist's `usableSiteKeyOf` rule: no site key or secret, no widget, and the post answers 503.
- **CSV:** header `address,joined_at,confirmation`; `joined_at` as ISO 8601 UTC; `confirmation` `sent` or `failed`; every field quoted, `"` doubled, and a field that starts with `=`, `+`, `-`, `@`, a tab or a carriage return prefixed with `'`. Lines end with `\r\n`.
- **Constants:** lifetimes and caps at the top of their files, durations in milliseconds (`MILLISECONDS_PER_MINUTE` and friends from `@todz/types`); the panel's row cap `ADMIN_WAITLIST_ROWS_MAX = 200`.

### Failure handling

| Case | Answer | Stored | Mailed |
|---|---|---|---|
| any guard piece missing (incl. `ADMIN_EMAIL` unset or invalid) | 503 card "The admin is closed right now." | nothing | nothing |
| cross-origin post | 403 card / 403 `{}` | nothing | nothing |
| over a limit, bad body, refused challenge | 429 card "Couldn't send a link right now. Try again in a minute.", `Retry-After: 60` | nothing | nothing |
| siteverify unavailable | 503 card | nothing | nothing |
| another address | 200 "Check your inbox" | nothing | nothing |
| `ADMIN_EMAIL`, sixth link in 15 min | 200 "Check your inbox" | nothing | nothing |
| mail send throws | 200 "Check your inbox" | row deleted | nothing |
| link in another browser, expired, spent, or `ADMIN_EMAIL` changed | link page: "This link can't be used. Ask for a new one from this browser." | nothing | — |
| session expired or row deleted | `/admin` shows the sign-in card; CSV 303 to `/admin` | — | — |
| D1 throws | 503 card / 503 `{}` | nothing | nothing |

### Rollback

`wrangler rollback` to the previous version; `/admin` becomes the site's 404. Migration 0006's two tables stay and an older version never reads them. Sessions die with the rollback because no route reads them. To close the admin on the current version, remove `ADMIN_EMAIL` from `vars` and deploy, or delete the Turnstile secret (which closes sign-in and the waitlist too).

## Plan review answers

The plan review (2026-11-25, NO: six CRITICAL, eight IMPORTANT, seven MINOR) is answered here; these lines win over the sections above, the plan and the test plan.

- **R1** Every Workers test lives at `apps/api/test/admin-*.test.ts`; `test/site/` runs in plain Node. Only the pages' rendering tests may sit in `test/site/`.
- **R2** `siteContentSecurityPolicy` takes a named `connectsToSelf: boolean`, which adds `connect-src 'self'`; only the link page passes `true`. A test checks that the link page's policy has it and the other admin pages' do not.
- **R3** `POST /admin/sign-in-links` answers before it touches D1 or the sender for any address: the 200 card and the challenge cookie are built first, and the expired-row clean-up, the capped insert and the send (deleting the row when the send throws) run in `executionContext.waitUntil`, as `waitlist-join.ts` does. A D1 failure there is never seen by the visitor: the "D1 throws → 503" row applies to `POST /admin/sessions` and the panel only. A test with a `DIRECTORY` that throws and a sender that never resolves gets the same status, headers and body for the admin and another address.
- **R4** The E2E server is `playwright.config.ts`'s command: `SITE_VARIABLES` gains `ADMIN_EMAIL: admin@todz.test`, and the server's output goes to `<persist folder>/site-server.log`. `admin.spec.ts` is `serial`, runs in the desktop project only, makes at most two admin link requests per run, and reads the link with `expect.poll` on the log for a new JSON line whose `to` is `ADMIN_EMAIL`.
- **R5** Step 0's stubs return real minimal values: a 200 `Response` with the admin headers whose body names the notice or the summary's total, and an `EmailMessage` whose text is the link. G1's tests compare against what those functions return, never literal markup. On merge the lead keeps G2's bodies.
- **R6** `design.md` is written (the loop's picks S-A, P-A, F-A, T-B, B-A, C-A, J-A, M-A, X-A) and is the source of every string and state, including the three strings it adds.
- **R7** Step 0 (the lead) also adds: `site/admin-paths.ts` with an `AdminPath` enum of the six paths, the form field `email`, the JSON field `token`, `ADMIN_SIGN_IN_LINK_LIFETIME_MINUTES = 15` and `ADMIN_RESPONSE_HEADERS` (`Cache-Control: no-store`, `X-Robots-Tag: noindex`) that every admin answer of both lanes carries; `TurnstileAction.AdminSignIn`; `HttpStatus.Forbidden`; `HttpHeader` members `Cookie`, `SetCookie`, `SecFetchSite`, `Origin`, `XRobotsTag`, `ContentDisposition` and `CacheControl`.
- **R8** A session belongs to an address: `admin_sessions` gains `email TEXT NOT NULL`, and a session counts only while it equals a valid `ADMIN_EMAIL`. Without one, `GET /admin` answers the 503 Closed card and the CSV redirects to `/admin`; sign-out still deletes the row and clears the cookie.
- **R9** `hello@todz.app` is public, so five solved challenges in fifteen minutes can fill the admin's link cap. ADR 0051's Consequences say so, and the runbook gains a recovery step, run only on the owner's word: `DELETE FROM admin_sign_in_links WHERE consumed_at IS NULL`.
- **R10** The test plan gains one row each for: a limiter that throws (503), `HEAD` of both pages, sign-out without a session, a session after `ADMIN_EMAIL` is unset, `POST /admin/sessions` with a non-JSON, 5 KB or token-less body (401), `Sec-Fetch-Site: same-site` (403), two `__Host-todz_admin` cookies (fail closed: no session), the CSV with an expired session (303), and the link page clearing the fragment with `history.replaceState` before it posts.
- **R11** The same-origin rule, once: when `Sec-Fetch-Site` is present it must be `same-origin`; when it is absent, `Origin` must equal `SITE_ORIGIN`; when both are absent, refuse.
- **R12** Route tests call `worker.fetch(request, workerEnvWith({...}), executionContext)` as `site-dispatch.test.ts` does, or the handlers directly as `waitlist-join.test.ts` does, with `Sec-Fetch-Site`, `Origin` and `Cookie` set on a `new Request`. Cookies are added with `headers.append` and read with `getSetCookie()`. Expiry tests seed rows whose `expires_at` has passed.
- **R13** The lead's runbook change: step 7 names `0006`; step 8 has five variables and limiters 8601–8609; step 13 adds `GET https://todz.app/admin` (200, `no-store`, `noindex`) and `https://api.todz.app/admin` (404), and its count of checks; step 14 posts `scripts/deploy-bodies/junk-turnstile-admin.txt` with `Origin: https://todz.app`, expecting 503 until both keys exist and 429 after, and an `admin_sign_in_links` count of 0 before and after; the Rollback section gets the two tables and how to close the admin. `docs/self-host.md` says nine bindings and to set your own `ADMIN_EMAIL`, followed by `pnpm site:generate`.
- **R14** The E2E clicks the link from a fake mail page served with `page.route('http://mail.test/')`, in the same context (the panel) and in a fresh one (the refusal).
- **R15** The Turnstile stub moves from `landing.spec.ts` to `e2e/turnstile-stub.ts`; G2 owns both specs.
- **R16** `libs/types` gains `ADMIN_RATE_LIMIT_MAX` 10, `ADMIN_RATE_LIMIT_PERIOD_SECONDS`, `ADMIN_ADDRESS_RATE_LIMIT_MAX` 3 and `ADMIN_GLOBAL_RATE_LIMIT_MAX` 30, pinned by `api-source.test.ts` against `wrangler.jsonc`.
- **R17** The challenge cookie rides only the 200 card, for every address; the 403, 429 and 503 answers carry none, and a test says so.
- **R18** The equality test compares the status, the sorted header names, the body and the `Set-Cookie` attribute shape of the admin's answer and another address's.
- **R19** Migration 0006 adds `CREATE INDEX waitlist_joined_at ON waitlist (joined_at)`. The CSV reads every row; ADR 0051 names fifty thousand rows as its revisit.
- **R20** The E2E downloads the CSV by clicking (`waitForEvent('download')`).
- **R21** "Sent" means the confirmation was claimed and no failure was recorded; "Failed" means a failure was recorded.

## Open questions → answers

| Question | Options | Owner's answer | Date |
|----------|---------|----------------|------|
| Who is the admin? | the owner's personal address in a secret; `hello@todz.app` in `vars` | the loop's call: `hello@todz.app` (ADR 0051 §1) | 2026-11-25 |
| How is the link bound to a browser? | a Strict challenge cookie spent by a same-origin post; a Lax cookie read on the navigation; unbound | the loop's call: Strict cookie, by the run-15 spike (ADR 0051 §2–3) | 2026-11-25 |
| Admin on its own host or a path? | `admin.todz.app`; `todz.app/admin` | the loop's call: the path, no new DNS record (ADR 0049 §3.3) | 2026-11-25 |
| Digest in this feature? | yes; its own feature | the loop's call: `landing-digest` (ADR 0051 §8) | 2026-11-25 |

## Test strategy summary

Unit (Vitest with the Workers pool and a local D1): the guard's every missing piece, each limit, the challenge, the same answer for any address, the five-link cap, the one statement that spends a link (other browser, expired, spent, changed admin), the session cookie's attributes, expiry, sign-out, the same-origin checks, the CSV's escaping, `no-store` and `noindex`, and that the API host never serves `/admin`. A shape test pins `wrangler.jsonc`'s new vars and namespaces. E2E (Playwright, `dev:site` with the console sender): the whole walk in one browser, the link opened in a second browser refused, and the export. The tester walks it at 1280 and 375 in light and dark.
