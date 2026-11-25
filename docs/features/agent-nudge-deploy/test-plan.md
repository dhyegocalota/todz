# Test plan: Agent nudge deploy

Every checkbox states the input and the exact expected outcome. A ticked box carries evidence after ` — evidence: ` (commit hash, log path, counts, screenshot path).

## Unit

- [x] `pnpm --filter @todz/repository-shape exec vitest run src/runbooks.test.ts` — expected: all green with the new rows — evidence: 1 file, 21 tests passed at head 19a5a28

## Prove it for real (production, read-only)

- [x] `scripts/todz-cloudflare.sh pnpm --filter @todz/api exec wrangler d1 migrations list todz-directory --remote` — expected: nothing to apply — evidence: wrangler 4.167.0 printed `No migrations to apply!` against remote
- [x] `wrangler d1 execute todz-directory --remote --json --command "SELECT name, dflt_value FROM pragma_table_info('owners') WHERE name = 'agent_nudge'"` through the wrapper — expected: one row, default `0` — evidence: one row `agent_nudge`, `dflt_value` `0`, `changed_db` false
- [x] `scripts/todz-cloudflare.sh pnpm --filter @todz/api exec wrangler deployments list` — expected: the newest deployment names `25bc8121-a464-448e-9548-d4c10aa9c339` at 100 percent, and the one before it `f98645a5-c4ac-468d-b003-4bb60b248ada` — evidence: deployments list ends with `f98645a5` (Secret Change, 100%) then `25bc8121` (100%, 2026-11-25T07:29Z), the newest
- [x] `scripts/todz-cloudflare.sh pnpm --filter @todz/api exec wrangler versions view 25bc8121-a464-448e-9548-d4c10aa9c339 --json` — expected: `DIRECTORY` bound to `dc22b1c3-1869-44a0-b805-91bf92017f19`, nine `ratelimit` bindings with namespaces `8601` to `8609`, a `secret_text` binding `ADMIN_EMAIL` and no `ADMIN_EMAIL` variable — evidence: `DIRECTORY` d1 id `dc22b1c3-1869-44a0-b805-91bf92017f19`; nine `ratelimit` bindings, namespace_id 8601 to 8609 (limits 10, 3, 100, 10, 3, 60, 10, 3, 30); `ADMIN_EMAIL` once, `secret_text`, no `plain_text` twin; value not printed
- [x] `scripts/todz-cloudflare.sh pnpm --filter @todz/api exec wrangler secret list` — expected: `ADMIN_EMAIL` only, no value printed — evidence: one entry, `ADMIN_EMAIL` `secret_text`
- [x] `scripts/todz-cloudflare.sh api GET "/accounts/e2035d8e0b7173d520ccf643f6f4661c/workers/domains?hostname=<host>"` for `api.todz.app`, `todz.app` and `www.todz.app` — expected: one each, `service` `todz-api` — evidence: each of the three answered `success: true`, one entry with its own hostname, `service` `todz-api`
- [x] `curl -sS -D - -o /dev/null` on `https://api.todz.app/sign-in`, `/sign-in/challenge` and `/mcp` — expected: `HTTP/2 503`, `HTTP/2 503`, `HTTP/2 401` — evidence: `/sign-in` 503, `/sign-in/challenge` 503, `/mcp` 401
- [x] `curl -sS https://api.todz.app/owner/sign-in-method` — expected: `{"method":"link"}` — evidence: body `{"method":"link"}`
- [x] `https://todz.app/admin` — expected: `HTTP/2 200`, `cache-control: no-store`, `x-robots-tag: noindex`; `https://api.todz.app/admin` — expected: `HTTP/2 404` — evidence: todz.app/admin 200 with `cache-control: no-store` and `x-robots-tag: noindex`; api.todz.app/admin 404
- [x] `https://todz.app/` and the `www` redirect, and plain HTTP on the three hosts — expected: `HTTP/2 200` with HSTS; `HTTP/2 301` to the apex; `HTTP/1.1 301` to `https://` — evidence: todz.app/ 200 with `strict-transport-security: max-age=31536000`; `www.todz.app/self-host?from=runbook` 301 to `https://todz.app/self-host?from=runbook`; plain HTTP on api.todz.app/owner/sign-in-method, todz.app/ and www.todz.app/ each `HTTP/1.1 301` to https on the same host
- [x] Step 14's link post, waitlist probe and admin probe — expected: `503` each; the waitlist count `0` before and after; the unspent admin links count equal before and after — evidence: link post 503 `{"error":"sign_in_unavailable"}`, waitlist post 503, admin post 503; waitlist_rows 0 before and 0 after; admin_links 0 before and 0 after
- [x] The new rows carry no token, secret value, link or personal address — expected: only commits, version ids, the database id, the bookmark, file sizes and public record values — evidence: read rows 1 to 15 of 59d3966 at HEAD; only the commit, version ids, database id, bookmark, 4132 bytes, record values and statuses; grep for `@`, `secret value` and 40-character strings found 0 hits; `ADMIN_EMAIL` appears as a name only

## Edge cases found during execution

- [x] Row 9's claim that `25bc8121` sits "after `f98645a5`" and row 8's nine limiters (10, 3, 100, 10, 3, 60, 10, 3, 30) against the live version — evidence: both match the deployments list and the versions view
- [x] Rows 4 (12 tables), 5 (bookmark), 6 (4132 bytes) and 13's `workers.dev` timeout are historical or need a write or a private file; not re-checkable read-only — evidence: left unverified, not contradicted
- [x] Row 15 of this run omits the "single request later" sentence that earlier runs carried; step 15 was not re-run by instruction — evidence: noted, no production disagreement

## Coverage honesty

- Step 10's Turnstile part, a real sign-in and a real agent `next` against production wait for the owner's Turnstile widget (no owner exists in production yet: `owners` counts 0).
- The first digest arrives at the next 11:00 UTC; a later run records it.
