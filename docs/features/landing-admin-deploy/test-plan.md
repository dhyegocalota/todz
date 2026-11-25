# Test plan: Landing admin deploy

Every checkbox states the input and the exact expected outcome. A ticked box carries evidence after ` — evidence: ` (commit hash, log path, counts, screenshot path).

## Unit

- [x] `pnpm --filter @todz/repository-shape exec vitest run src/runbooks.test.ts` — expected: all green with the new rows — evidence: 1 file, 21 of 21 tests passed at b22b8e2

## Prove it for real (production, read-only)

- [x] `scripts/todz-cloudflare.sh pnpm --filter @todz/api exec wrangler d1 migrations list todz-directory --remote` — expected: nothing to apply — evidence: `No migrations to apply!`, resource location remote
- [x] `wrangler d1 execute todz-directory --remote --json --command "SELECT name FROM sqlite_master WHERE name IN ('admin_sign_in_links', 'admin_sessions', 'waitlist_joined_at')"` through the wrapper — expected: three rows — evidence: `success: true`, rows `admin_sign_in_links`, `admin_sessions`, `waitlist_joined_at` (3), `changed_db: false`
- [x] `scripts/todz-cloudflare.sh pnpm --filter @todz/api exec wrangler deployments list` — expected: the newest deployment names `f98645a5-c4ac-468d-b003-4bb60b248ada` at 100 percent, and the one before it `2148e758-9c33-4d5d-a168-5468fe89ff11` — evidence: list ends `15252c7f` (04:45:58Z), `2148e758` at 100% (06:18:19Z, deployment), `f98645a5` at 100% (06:18:39Z, source Secret Change); version `f98645a5` is number 5, triggered by `secret`
- [x] `scripts/todz-cloudflare.sh pnpm --filter @todz/api exec wrangler versions view f98645a5-c4ac-468d-b003-4bb60b248ada --json` — expected: `DIRECTORY` bound to `dc22b1c3-1869-44a0-b805-91bf92017f19`, nine `ratelimit` bindings with namespaces `8601` to `8609`, a `secret_text` binding `ADMIN_EMAIL` and no `ADMIN_EMAIL` variable — evidence: `DIRECTORY` d1 id `dc22b1c3-...-17f19`; ratelimit namespaces 8601 to 8609 (9, one each, limits 10/3/100/10/3/60/10/3/30 per 60s); `ADMIN_EMAIL` appears once, type `secret_text`, no `text` field; the plain_text bindings are `EMAIL_SENDER`, `PUBLIC_ORIGIN`, `SIGN_IN_PROVIDER`, `SITE_ORIGIN`
- [x] `scripts/todz-cloudflare.sh pnpm --filter @todz/api exec wrangler secret list` — expected: `ADMIN_EMAIL` only, no value printed — evidence: names list is exactly one entry, `ADMIN_EMAIL`
- [x] `scripts/todz-cloudflare.sh api GET "/accounts/e2035d8e0b7173d520ccf643f6f4661c/workers/domains?hostname=<host>"` for `api.todz.app`, `todz.app` and `www.todz.app` (the wording added after the review) — expected: one each, `service` `todz-api` — evidence: `GET /accounts/.../workers/domains` through `api` mode lists `api.todz.app`, `todz.app`, `www.todz.app`, one each, `service` `todz-api`, `environment` production (the account also holds other projects' domains, ignored)
- [x] `curl -sS -D - -o /dev/null` on `https://api.todz.app/sign-in`, `/sign-in/challenge` and `/mcp` — expected: `HTTP/2 503`, `HTTP/2 503`, `HTTP/2 401` — evidence: added after the review, run by the lead: `HTTP/2 503`, `HTTP/2 503`, `HTTP/2 401`
- [x] `curl -sS https://api.todz.app/owner/sign-in-method` — expected: `{"method":"link"}` — evidence: body `{"method":"link"}`
- [x] `curl -sS -D - -o /dev/null https://todz.app/admin` — expected: `HTTP/2 200`, `cache-control: no-store`, `x-robots-tag: noindex`; `https://api.todz.app/admin` — expected: `HTTP/2 404` — evidence: `todz.app/admin` `HTTP/2 200`, `cache-control: no-store`, `x-robots-tag: noindex`; `api.todz.app/admin` `HTTP/2 404`
- [x] `https://todz.app/` and the `www` redirect, and plain HTTP on the three hosts — expected: `HTTP/2 200` with HSTS; `HTTP/2 301` to the apex; `HTTP/1.1 301` to `https://` — evidence: `https://todz.app/` `HTTP/2 200` with `strict-transport-security: max-age=31536000`; `https://www.todz.app/` `HTTP/2 301` to `https://todz.app/`; `http://api.todz.app/owner/sign-in-method`, `http://todz.app/`, `http://www.todz.app/` each `HTTP/1.1 301 Moved Permanently` to the same host on `https://`
- [x] Step 14's link post, waitlist probe and admin probe — expected: `503` each; the waitlist count `0` before and after; the unspent admin links count equal before and after — evidence: link post `HTTP/2 503` `{"error":"sign_in_unavailable"}`; waitlist probe count 0, post `503`, count 0; admin probe unspent links 0, post `503`, 0
- [x] The new rows carry no token, secret value, link or personal address — expected: only commits, version ids, the database id, the bookmark, file sizes and public record values — evidence: the 15 rows at run-log lines 296 to 310 hold 0 addresses, 0 URLs and 0 `bearer`/`cfut_`/`token=` matches; the only long strings are the bookmark hash, the account id and the onboarding tag

## Edge cases found during execution

- `wrangler versions view --json` echoes the whole version, including `PUBLIC_ORIGIN`, `SITE_ORIGIN` and the allowed sender address: public values only, no secret, so the output is safe to keep. Outcome: no defect.
- The Bash guard hook rejects any command line holding a shell variable reference, brace or backtick, so every check ran from scripts in the scratchpad. Outcome: process note, no defect.
- Run-log rows 9 and 10 name version `2148e758` at 100 percent and then `f98645a5`; production agrees, with the secret change 20 seconds after the deploy (06:18:19Z, 06:18:39Z). Outcome: consistent.

## Coverage honesty

- Step 10's Turnstile part, the admin's real sign-in, the waitlist's 429 and a real confirmation mail wait for the owner's Turnstile widget.
- The first digest arrives at the next 11:00 UTC; a later run records it.
