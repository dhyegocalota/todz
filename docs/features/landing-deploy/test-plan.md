# Test plan: Landing deploy

Every checkbox states the input and the exact expected outcome. A ticked box carries evidence after ` — evidence: ` (commit hash, log path, counts, screenshot path).

## Unit

- [ ] `pnpm --filter @todz/repository-shape exec vitest run src/runbooks.test.ts` — expected: all green with the new rows

## Prove it for real (production, read-only)

- [ ] `scripts/todz-cloudflare.sh api GET "/accounts/e2035d8e0b7173d520ccf643f6f4661c/workers/domains?hostname=<host>"` for `api.todz.app`, `todz.app` and `www.todz.app` — expected: one entry each, `service` `todz-api`
- [ ] `scripts/todz-cloudflare.sh pnpm --filter @todz/api exec wrangler versions view bafcf42c-9857-4ada-9ff1-6d1d068711dc --json` — expected: a `d1` binding `DIRECTORY` with `id` `dc22b1c3-1869-44a0-b805-91bf92017f19`, and `SITE_ORIGIN` `https://todz.app` among the variables
- [ ] `curl -sS https://api.todz.app/owner/sign-in-method` — expected: `{"method":"link"}`
- [ ] `curl -sS -D - -o /dev/null https://todz.app/` and `https://todz.app/self-host` — expected: `HTTP/2 200`, `strict-transport-security: max-age=31536000`, a CSP starting `default-src 'none'`
- [ ] `curl -sS -D - -o /dev/null "https://www.todz.app/self-host?from=test"` — expected: `HTTP/2 301`, `location: https://todz.app/self-host?from=test`
- [ ] `https://todz.app/owner/sign-in-method`, `https://todz.app/mcp` and `https://api.todz.app/` — expected: `HTTP/2 404` each
- [ ] `curl -sI http://todz.app/` and `http://www.todz.app/` — expected: `HTTP/1.1 301` to `https://` on the same host
- [ ] Step 14's post — expected: `HTTP/2 503` and `{"error":"sign_in_unavailable"}`
- [ ] The new rows carry no token, secret, link or address — expected: only the commit, version id, database id, bookmark, file size and public record values

## Edge cases found during execution

Empty on purpose.

## Coverage honesty

- Step 10 and the checks after the secret wait for the owner's Turnstile widget.
- The landing's look in a real browser on todz.app is the owner's Human checklist on PR #25.
