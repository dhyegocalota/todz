# Test plan: Agent nudge deploy

Every checkbox states the input and the exact expected outcome. A ticked box carries evidence after ` — evidence: ` (commit hash, log path, counts, screenshot path).

## Unit

- [ ] `pnpm --filter @todz/repository-shape exec vitest run src/runbooks.test.ts` — expected: all green with the new rows

## Prove it for real (production, read-only)

- [ ] `scripts/todz-cloudflare.sh pnpm --filter @todz/api exec wrangler d1 migrations list todz-directory --remote` — expected: nothing to apply
- [ ] `wrangler d1 execute todz-directory --remote --json --command "SELECT name, dflt_value FROM pragma_table_info('owners') WHERE name = 'agent_nudge'"` through the wrapper — expected: one row, default `0`
- [ ] `scripts/todz-cloudflare.sh pnpm --filter @todz/api exec wrangler deployments list` — expected: the newest deployment names `25bc8121-a464-448e-9548-d4c10aa9c339` at 100 percent, and the one before it `f98645a5-c4ac-468d-b003-4bb60b248ada`
- [ ] `scripts/todz-cloudflare.sh pnpm --filter @todz/api exec wrangler versions view 25bc8121-a464-448e-9548-d4c10aa9c339 --json` — expected: `DIRECTORY` bound to `dc22b1c3-1869-44a0-b805-91bf92017f19`, nine `ratelimit` bindings with namespaces `8601` to `8609`, a `secret_text` binding `ADMIN_EMAIL` and no `ADMIN_EMAIL` variable
- [ ] `scripts/todz-cloudflare.sh pnpm --filter @todz/api exec wrangler secret list` — expected: `ADMIN_EMAIL` only, no value printed
- [ ] `scripts/todz-cloudflare.sh api GET "/accounts/e2035d8e0b7173d520ccf643f6f4661c/workers/domains?hostname=<host>"` for `api.todz.app`, `todz.app` and `www.todz.app` — expected: one each, `service` `todz-api`
- [ ] `curl -sS -D - -o /dev/null` on `https://api.todz.app/sign-in`, `/sign-in/challenge` and `/mcp` — expected: `HTTP/2 503`, `HTTP/2 503`, `HTTP/2 401`
- [ ] `curl -sS https://api.todz.app/owner/sign-in-method` — expected: `{"method":"link"}`
- [ ] `https://todz.app/admin` — expected: `HTTP/2 200`, `cache-control: no-store`, `x-robots-tag: noindex`; `https://api.todz.app/admin` — expected: `HTTP/2 404`
- [ ] `https://todz.app/` and the `www` redirect, and plain HTTP on the three hosts — expected: `HTTP/2 200` with HSTS; `HTTP/2 301` to the apex; `HTTP/1.1 301` to `https://`
- [ ] Step 14's link post, waitlist probe and admin probe — expected: `503` each; the waitlist count `0` before and after; the unspent admin links count equal before and after
- [ ] The new rows carry no token, secret value, link or personal address — expected: only commits, version ids, the database id, the bookmark, file sizes and public record values

## Edge cases found during execution

Empty on purpose. The tester adds one checkbox per new case.

## Coverage honesty

- Step 10's Turnstile part, a real sign-in and a real agent `next` against production wait for the owner's Turnstile widget (no owner exists in production yet: `owners` counts 0).
- The first digest arrives at the next 11:00 UTC; a later run records it.
