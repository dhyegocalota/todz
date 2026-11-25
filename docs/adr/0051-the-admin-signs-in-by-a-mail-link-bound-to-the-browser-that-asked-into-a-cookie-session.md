# 0051. The admin signs in by a mail link bound to the browser that asked, into a cookie session

- Status: Accepted (the build loop's call, the owner may overturn it); amends [0049](0049-todz-app-is-served-by-the-same-worker-dispatched-by-host-in-three-features.md) §3.3: the cookie is a `__Host-` cookie on path `/`, and the digest ships as its own feature, `landing-digest`
- Date: 2026-11-25
- Deciders: Claude (the build loop's call, pending the owner); Dhyego Calota (owner) asked for "painel admin, digest etc igual zapbip … pra ser um prod ready mesmo", that "the admin authenticates as the owner", and for a rate limit and Turnstile on every public endpoint, failing closed (PROMPT.md "Landing" and "Security"), and may overturn the details
- Inspired by: the run-15 spike below, zapbip's `backoffice/` (read-only), [ADR 0040](0040-the-owner-signs-in-with-an-email-link-bound-to-the-mac-that-asked-for-it.md), [ADR 0045](0045-the-public-sign-in-routes-are-limited-three-ways-and-turnstile-guarded-failing-closed.md), [ADR 0050](0050-the-waitlist-answers-alike-for-every-address-mails-once-and-is-guarded-like-sign-in.md)

## Context

`landing-waitlist` keeps addresses in D1 and nobody can read them without a database console. The owner wants a panel he signs in to as himself. The app's magic link is bound to the Mac that asked for it through a verifier the app keeps (ADR 0040); a browser has no such place, and a link that any holder can spend is a password sent in clear mail. ADR 0049 left open whether a cookie can play the verifier's part, since a mail link opens as a cross-site navigation and a `SameSite=Strict` cookie is not sent on it.

## Decision

1. **The admin is one address.** `ADMIN_EMAIL` in `wrangler.jsonc`'s `vars` is `hello@todz.app`, the owner's alias that Email Routing forwards to him, so no personal address is committed. Every admin route fails closed when it is unset or not a valid address.
2. **The link is bound to the browser that asked.** `POST /admin/sign-in-links` on `todz.app` sets a fresh challenge cookie `__Host-todz_admin_challenge` (HttpOnly, Secure, SameSite=Strict, Path=/, fifteen minutes) on every answer. Only when the normalized address equals `ADMIN_EMAIL` does it store the digest of a new token beside the digest of that challenge in `admin_sign_in_links` and mail `https://todz.app/admin/sign-in#token=…`. The answer is the same page for every address.
3. **The link page spends it by a same-origin post.** `GET /admin/sign-in` is a page whose script reads the fragment and posts it to `POST /admin/sessions`. The navigation from the mail carries no Strict cookie, but the page's own post does, and the server spends the link only when the token's digest, the challenge cookie's digest, the address (still `ADMIN_EMAIL`), the fifteen minutes and single use all match, in one `UPDATE … RETURNING`. A link opened in another browser finds no cookie and is refused.
4. **The session is a cookie.** A spent link opens a row in `admin_sessions` keyed by the digest of a new secret, sent as `__Host-todz_admin` (HttpOnly, Secure, SameSite=Strict, Path=/), lasting twelve hours. The challenge cookie is cleared. Sign-out deletes the row.
5. **Every state change is same-origin.** The three posts require `Sec-Fetch-Site: same-origin` or an `Origin` equal to `SITE_ORIGIN`, on top of the Strict cookies.
6. **The request is guarded like sign-in.** Before reading the body, the link request needs `ADMIN_EMAIL`, both Turnstile keys, a mail sender, three limiters and the client address, and answers 503 otherwise. Then a per-client limit, Turnstile action `admin_sign_in` on host `todz.app`, a global limit, and a per-address limit on new namespaces `8607` to `8609` (10, 3 and 30 a minute), and at most five stored links per fifteen minutes. `POST /admin/sessions` takes the per-client limit. Refusals answer 429 with `Retry-After`.
7. **The panel reads the waitlist.** `GET /admin` shows the totals, the last day's joins, failed confirmations and the newest two hundred rows; `GET /admin/export.csv` downloads every row, with each cell that starts with `=`, `+`, `-`, `@`, a tab or a carriage return prefixed by `'`. Every admin answer carries `Cache-Control: no-store` and `X-Robots-Tag: noindex`.
8. **The digest is its own feature.** `landing-digest` follows: the daily mail from a cron, reading the same table.

**Changed by the review, before the merge (these win over §1 to §5):**

- `ADMIN_EMAIL` is a Worker secret, not a `vars` entry. The loop puts `hello@todz.app` with `wrangler secret put ADMIN_EMAIL`. A fork or a self-hosted copy that never sets it keeps its admin closed, instead of mailing its admin links to the todz owner's alias and letting that mailbox read its waitlist.
- Both cookies are `SameSite=Lax`, not `Strict`. The binding comes from the challenge cookie living only in the browser that asked, and every state change already needs the same-origin rule of §5, so Lax loses nothing. Strict made signing in depend on how each browser treats a Strict cookie on a same-origin request from a page reached by a cross-site click; Chromium sends it, but WebKit (Safari, where Mail opens links on the owner's Mac) could not be run here, and installing it is outside what the loop may do. A Lax cookie rides that request in every browser.

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| Link bound to a Strict challenge cookie (chosen) | the spike proves it; a stolen mail alone signs nobody in | needs JavaScript on the link page | — |
| A link anyone holding it can spend | simplest | the mail is the password; forwarded or scanned links sign in | not bound |
| A Lax challenge cookie read on the navigation | no script | a cross-site GET spends a link, and link scanners prefetch | weaker |
| zapbip's password and TOTP | proven | a second credential beside the mail; "the admin authenticates as the owner" | ADR 0049 |
| Cloudflare Access in front of `/admin` | no code | an account setting and a Zero Trust resource, outside PROMPT.md's list | forbidden |
| The owner's personal address in a secret | no alias | a second step on every deploy | `hello@` already reaches him |

## Consequences

- The admin can sign in only from the browser where he asked for the link, within fifteen minutes.
- `ADMIN_EMAIL` is no longer a configuration default: its value lives only in the deployment's secret. The value is an alias, and knowing it gives nothing without the mailbox.
- The link page needs a script, served under the hashed CSP like `/sign-in`.
- Three new rate limit bindings and migration `0006`; a rollback keeps both tables, which an older version never reads.
- Until the owner's Turnstile widget exists, the admin sign-in answers 503, as sign-in and the waitlist do.
- The admin address is easy to guess, so whoever solves five challenges in fifteen minutes fills the admin's link cap and his own request then mails nothing for a while; the runbook's recovery step clears the unspent links on his word.
- A session is bound to the address that opened it: changing `ADMIN_EMAIL` ends every session, removing it suspends them until it is put back, and `DELETE FROM admin_sessions` ends them for good.
- The link request answers before it touches D1 or the mail, so neither the time nor a failure tells the admin's address apart.

## Evidence

Run-15 spike, in a scratch folder: Chromium 1228 through `@playwright/test` 1.61.0, a site on `localhost` and a mail page on `127.0.0.1`. `/ask` set `__Host-challenge` (Secure, HttpOnly, SameSite=Strict). Clicking the mail page's link to `/admin/sign-in#token=…`: the navigation carried no cookie; the page's `fetch` POST carried `__Host-challenge`, with `Sec-Fetch-Site: same-origin`; the session cookie it set came back on the next navigation. In a second browser context the same link's post carried no cookie. WebKit was not run.

## Revisit when

The admin needs more than one person, a browser stops sending Strict cookies on a same-origin post from a page opened cross-site, or the waitlist passes fifty thousand rows, which the CSV reads at once.
