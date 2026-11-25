# Test plan: Landing waitlist deploy

Every checkbox states the input and the exact expected outcome. A ticked box carries evidence after ` — evidence: ` (commit hash, log path, counts, screenshot path).

## Unit

- [ ] `pnpm --filter @todz/repository-shape exec vitest run src/runbooks.test.ts` — expected: all green with the new rows

## Prove it for real (production, read-only)

- [ ] `scripts/todz-cloudflare.sh pnpm --filter @todz/api exec wrangler d1 migrations list todz-directory --remote` — expected: nothing to apply
- [ ] `wrangler d1 execute todz-directory --remote --command "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'waitlist'"` through the wrapper — expected: one row, `waitlist`
- [ ] `scripts/todz-cloudflare.sh pnpm --filter @todz/api exec wrangler deployments list` — expected: the newest deployment names `15252c7f-ec20-42f9-9e53-17db3a4c7ba1` at 100 percent
- [ ] `scripts/todz-cloudflare.sh pnpm --filter @todz/api exec wrangler versions view 15252c7f-ec20-42f9-9e53-17db3a4c7ba1 --json` — expected: a `d1` binding `DIRECTORY` with `id` `dc22b1c3-1869-44a0-b805-91bf92017f19`, and six `ratelimit` bindings with namespaces `8601` to `8606`
- [ ] `scripts/todz-cloudflare.sh api GET "/accounts/e2035d8e0b7173d520ccf643f6f4661c/workers/domains?hostname=<host>"` for `api.todz.app`, `todz.app` and `www.todz.app` — expected: one entry each, `service` `todz-api`
- [ ] `curl -sS https://api.todz.app/owner/sign-in-method` — expected: `{"method":"link"}`
- [ ] `curl -sS -D - -o /dev/null https://todz.app/` — expected: `HTTP/2 200`, `strict-transport-security: max-age=31536000`, a CSP starting `default-src 'none'`
- [ ] Step 14's link post — expected: `HTTP/2 503` and `{"error":"sign_in_unavailable"}`
- [ ] Step 14's waitlist probe: count `nobody@example.com`, post `scripts/deploy-bodies/junk-turnstile-waitlist.txt` to `https://todz.app/join`, count again — expected: `0`, `503`, `0`
- [ ] The new rows carry no token, secret, link or address — expected: only the commit, version id, database id, bookmark, file size and public record values

## Edge cases found during execution

Empty on purpose.

## Coverage honesty

- Step 10, the waitlist's 429 and a real confirmation mail wait for the owner's Turnstile widget.
