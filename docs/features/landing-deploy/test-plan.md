# Test plan: Landing deploy

Every checkbox states the input and the exact expected outcome. A ticked box carries evidence after ` — evidence: ` (commit hash, log path, counts, screenshot path).

## Unit

- [x] `pnpm --filter @todz/repository-shape exec vitest run src/runbooks.test.ts` — expected: all green with the new rows — evidence: vitest run, Test Files 1 passed, Tests 19 passed (0 failed), on branch docs/landing-deploy at a7081ad

## Prove it for real (production, read-only)

- [x] `scripts/todz-cloudflare.sh api GET "/accounts/e2035d8e0b7173d520ccf643f6f4661c/workers/domains?hostname=<host>"` for `api.todz.app`, `todz.app` and `www.todz.app` — expected: one entry each, `service` `todz-api` — evidence: each host returned total_count 1, service `todz-api`, environment production, enabled true, zone todz.app
- [x] `scripts/todz-cloudflare.sh pnpm --filter @todz/api exec wrangler versions view bafcf42c-9857-4ada-9ff1-6d1d068711dc --json` — expected: a `d1` binding `DIRECTORY` with `id` `dc22b1c3-1869-44a0-b805-91bf92017f19`, and `SITE_ORIGIN` `https://todz.app` among the variables — evidence: DIRECTORY d1 id dc22b1c3-1869-44a0-b805-91bf92017f19; SITE_ORIGIN text https://todz.app; PUBLIC_ORIGIN https://api.todz.app
- [x] `curl -sS https://api.todz.app/owner/sign-in-method` — expected: `{"method":"link"}` — evidence: body `{"method":"link"}`
- [x] `curl -sS -D - -o /dev/null https://todz.app/` and `https://todz.app/self-host` — expected: `HTTP/2 200`, `strict-transport-security: max-age=31536000`, a CSP starting `default-src 'none'` — evidence: both HTTP/2 200, HSTS max-age=31536000, CSP `default-src 'none'; ...` (cf-ray a5fd882c194a646d-GIG and a5fd882ccc6f0da8-GIG)
- [x] `curl -sS -D - -o /dev/null "https://www.todz.app/self-host?from=test"` — expected: `HTTP/2 301`, `location: https://todz.app/self-host?from=test` — evidence: HTTP/2 301, location https://todz.app/self-host?from=test
- [x] `https://todz.app/owner/sign-in-method`, `https://todz.app/mcp` and `https://api.todz.app/` — expected: `HTTP/2 404` each — evidence: all three HTTP/2 404 (content-length 0)
- [x] `curl -sI http://todz.app/` and `http://www.todz.app/` — expected: `HTTP/1.1 301` to `https://` on the same host — evidence: todz.app 301 location https://todz.app/; www 301 location https://www.todz.app/
- [x] Step 14's post — expected: `HTTP/2 503` and `{"error":"sign_in_unavailable"}` — evidence: POST scripts/deploy-bodies/junk-turnstile-link.json to api.todz.app/owner/sign-in-links answered HTTP/2 503, body `{"error":"sign_in_unavailable"}`
- [x] The new rows carry no token, secret, link or address — expected: only the commit, version id, database id, bookmark, file size and public record values — evidence: grep of the 2026-11-25 rows for `@`, token values, secret and workers.dev addresses found none; the only `token` mention is the type name "an API Token" in step 2

## Edge cases found during execution

Empty on purpose.

## Coverage honesty

- Step 10 and the checks after the secret wait for the owner's Turnstile widget.
- The landing's look in a real browser on todz.app is the owner's Human checklist on PR #25.
