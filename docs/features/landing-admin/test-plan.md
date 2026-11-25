# Test plan: Landing admin

Every checkbox states the input and the exact expected outcome. A ticked box carries evidence after ` — evidence: ` (commit hash, log path, counts, screenshot path).

## The failing test first

- [ ] Each of `admin-store`, `admin-limiter`, `admin-session`, `admin-sign-in`, `admin-export`, `admin-pages` and the admin mail tests is red at its own commit — expected: the failure text the briefing records
- [ ] `git log` shows each red commit before its green one

## Unit

- [ ] `GET /admin` with no cookie, with the dummy keys — expected: 200, the sign-in card with the widget (`data-action="admin_sign_in"`), `Cache-Control: no-store`, `X-Robots-Tag: noindex`, a CSP whose every inline block has one hash
- [ ] `GET /admin` without a site key or secret — expected: the card without the widget
- [ ] `POST /admin/sign-in-links` as `ADMIN_EMAIL` (` Hello@Todz.app ` normalised) — expected: 200 "Check your inbox", a `__Host-todz_admin_challenge` cookie with `Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=900`, one `admin_sign_in_links` row holding only digests, one mail to `ADMIN_EMAIL` whose link is `https://<site>/admin/sign-in#token=<43 chars>`
- [ ] The same post as another address — expected: the same status and body byte for byte, a challenge cookie, no row, no mail
- [ ] A sixth admin request within fifteen minutes — expected: the same 200 card, no sixth row, no mail
- [ ] The sender throws — expected: the same 200 card, the row deleted, no address in any log line
- [ ] Each missing guard piece in turn: `ADMIN_EMAIL` unset, `ADMIN_EMAIL` `not-an-address`, no `SITE_ORIGIN`, no site key, no secret, no sender, each of the three limiters, no `CF-Connecting-IP` on a public host — expected: 503 "The admin is closed right now.", no siteverify call, no row, no mail
- [ ] A cross-origin post (`Sec-Fetch-Site: cross-site`, or no `Sec-Fetch-Site` and `Origin: https://evil.example`) — expected: 403 card, no siteverify call, no row
- [ ] Each limit over its count (client, global, address) — expected: 429 card, `Retry-After: 60`, no row, no mail
- [ ] siteverify refuses, answers another action or hostname — expected: 429 card; siteverify times out — expected: 503 card; neither stores or mails
- [ ] A JSON body, a 5 KB body, no `email`, a malformed token — expected: 429 card, no siteverify call for the malformed token
- [ ] `POST /admin/sessions` with the mailed token and the challenge cookie, same-origin — expected: 201 `{}`, `__Host-todz_admin` with `Max-Age=43200` and the same attributes, the challenge cookie cleared with `Max-Age=0`, one `admin_sessions` row holding a digest, the link row spent
- [ ] The same token again — expected: 401 `{}`, no second session
- [ ] The token without the challenge cookie, with another browser's challenge, after fifteen minutes, or after `ADMIN_EMAIL` changed — expected: 401 `{}`, no session
- [ ] `POST /admin/sessions` cross-origin, over the per-client limit, or with `ADMIN_EMAIL` unset — expected: 403, 429 with `Retry-After: 60`, 503
- [ ] `GET /admin` with a live session — expected: the panel with the three tiles, the newest rows first, each address HTML-escaped (an address with `<` and `&`)
- [ ] 0 rows, 1 row, 201 rows — expected: the empty state; one row; 200 rows and "Showing the newest 200 of 201. The CSV has all."
- [ ] A session after twelve hours, or a cookie with an unknown secret — expected: the sign-in card
- [ ] `POST /admin/sign-out` same-origin — expected: 303 to `/admin`, the row deleted, the cookie cleared; cross-origin — expected: 403, the session kept
- [ ] `GET /admin/export.csv` with a session — expected: `text/csv; charset=utf-8`, `attachment; filename="todz-waitlist.csv"`, `no-store`, the header line and every row newest first, `\r\n` endings; without a session — expected: 303 to `/admin`
- [ ] CSV cells starting with `=`, `+`, `-`, `@`, a tab and a carriage return, and one holding `"` — expected: each prefixed with `'`, the quote doubled, every field quoted
- [ ] `GET /admin/sign-in` — expected: the link page, its script hashed in the CSP, the no-script text, no token in any server-side answer
- [ ] `/admin`, `/admin/sessions` and `/admin/export.csv` on `api.todz.app` — expected: 404; on `www.todz.app` — expected: 301 to `todz.app`
- [ ] `PUT /admin`, `GET /admin/sessions`, `GET /admin/unknown` — expected: the site's 404
- [ ] The admin mail renders from the generated module with the lockup, the button and the footnote, and `emails:check` passes
- [ ] `api-source.test.ts` — expected: `ADMIN_EMAIL` `hello@todz.app`, `ADMIN_LIMITER` 8607 (10/60), `ADMIN_ADDRESS_LIMITER` 8608 (3/60), `ADMIN_GLOBAL_LIMITER` 8609 (30/60), and every dev script passes `ADMIN_EMAIL`

## E2E (Playwright specs)

- [ ] The admin asks for a link, opens the logged link in the same context — expected: the panel at `/admin`
- [ ] The same link in a fresh context — expected: "This link can't be used. Ask for a new one from this browser."
- [ ] Another address — expected: the same "Check your inbox" card and no mail line in the log
- [ ] Download CSV — expected: a file `todz-waitlist.csv` whose first line is `"address","joined_at","confirmation"`
- [ ] Sign out — expected: the sign-in card; `/admin` again shows the card

## Prove it for real — Playwright MCP or a scripted Chrome

- [ ] The whole walk on a local site host at 1280 and 375, light and dark: the sign-in card, the inbox card, the link page, the panel with rows, the empty panel, the CSV, sign out — expected: matches `design.md`, no console error, no failed request other than the widget's
- [ ] Keyboard only: the field, the widget, the button, then the panel's actions and table — expected: a visible focus ring each time, the link page's result announced
- [ ] Reduced motion — expected: no transition on the cards

## Edge cases found during execution

Empty on purpose.

## Adversarial review

- [ ] Reviewer and security reviewer: the link spent only with its own challenge; no address told apart; no address or token in a log, URL or referrer; the cookies' attributes; the same-origin rule; the CSV formula guard; the API host refuses `/admin`

## Coverage honesty

- WebKit and Firefox are not run; the spike and the E2E prove Chromium.
- Production stays at the 503 card until the owner's Turnstile widget exists, so a real mail to `hello@todz.app` waits for the production smoke walk.
