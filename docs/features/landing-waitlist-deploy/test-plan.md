# Test plan: Landing waitlist deploy

Every checkbox states the input and the exact expected outcome. A ticked box carries evidence after ` — evidence: ` (commit hash, log path, counts, screenshot path).

## Unit

- [x] `pnpm --filter @todz/repository-shape exec vitest run src/runbooks.test.ts` — expected: all green with the new rows — evidence: 1 file, 20 of 20 tests passed (run with the lead's uncommitted runbook edits in the working tree)

## Prove it for real (production, read-only)

- [x] `scripts/todz-cloudflare.sh pnpm --filter @todz/api exec wrangler d1 migrations list todz-directory --remote` — expected: nothing to apply — evidence: "No migrations to apply!" (matches row 7)
- [x] `wrangler d1 execute todz-directory --remote --command "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'waitlist'"` through the wrapper — expected: one row, `waitlist` — evidence: results `[{"name":"waitlist"}]`, one row
- [x] `scripts/todz-cloudflare.sh pnpm --filter @todz/api exec wrangler deployments list` — expected: the newest deployment names `15252c7f-ec20-42f9-9e53-17db3a4c7ba1` at 100 percent — evidence: newest deployment created 2026-11-25T04:45:59Z, `Version(s): (100%) 15252c7f-ec20-42f9-9e53-17db3a4c7ba1`; previous one was bafcf42c at 100 percent
- [x] `scripts/todz-cloudflare.sh pnpm --filter @todz/api exec wrangler versions view 15252c7f-ec20-42f9-9e53-17db3a4c7ba1 --json` — expected: a `d1` binding `DIRECTORY` with `id` `dc22b1c3-1869-44a0-b805-91bf92017f19`, and six `ratelimit` bindings with namespaces `8601` to `8606` — evidence: one `d1` binding `DIRECTORY` with `database_id` dc22b1c3-1869-44a0-b805-91bf92017f19; six `ratelimit` bindings: SIGN_IN_LIMITER 8601 (10/60s), SIGN_IN_ADDRESS_LIMITER 8602 (3/60s), SIGN_IN_GLOBAL_LIMITER 8603 (100/60s), WAITLIST_LIMITER 8604 (10/60s), WAITLIST_ADDRESS_LIMITER 8605 (3/60s), WAITLIST_GLOBAL_LIMITER 8606 (60/60s); matches row 8
- [x] `scripts/todz-cloudflare.sh api GET "/accounts/e2035d8e0b7173d520ccf643f6f4661c/workers/domains?hostname=<host>"` for `api.todz.app`, `todz.app` and `www.todz.app` — expected: one entry each, `service` `todz-api` — evidence: one entry per host, each `todz-api`
- [x] `curl -sS https://api.todz.app/owner/sign-in-method` — expected: `{"method":"link"}` — evidence: body `{"method":"link"}`
- [x] `curl -sS -D - -o /dev/null https://todz.app/` — expected: `HTTP/2 200`, `strict-transport-security: max-age=31536000`, a CSP starting `default-src 'none'` — evidence: `HTTP/2 200`, `strict-transport-security: max-age=31536000`, `content-security-policy: default-src 'none'; script-src 'sha256-...`
- [x] Step 14's link post — expected: `HTTP/2 503` and `{"error":"sign_in_unavailable"}` — evidence: post of `junk-turnstile-link.json` to `/owner/sign-in-links` (runbook step 14 command): `HTTP/2 503`, content-type application/json, body `{"error":"sign_in_unavailable"}`
- [x] Step 14's waitlist probe: count `nobody@example.com`, post `scripts/deploy-bodies/junk-turnstile-waitlist.txt` to `https://todz.app/join`, count again — expected: `0`, `503`, `0` — evidence: `waitlist_rows` 0, post `503`, `waitlist_rows` 0
- [x] The new rows carry no token, secret, link or address — expected: only the commit, version id, database id, bookmark, file size and public record values — evidence: rows 1 to 15 of 6a65b68 read in HEAD; pattern scan found no address, link, token value or secret (the only hits are the word "API Token" in row 2 and public ids)

## Edge cases found during execution

- The working tree held uncommitted edits to `docs/runbooks/deploy-the-api.md` (rows 11 and 15 of 6a65b68 reworded, extra detail) and `spec.md` while this ran; the evidence above was read from `HEAD` rows, and the new row 15 text ("single request later answered 503, as the first did") was not re-run. The briefing's commit e9fcf88 rows 11 and 15 differ from the working tree. Outcome: not a defect, flagged for the lead.
- The `--file` form of `wrangler d1 execute --json` prints import-style output, not rows; only `--command` returns results. Outcome: used `--command`.

## Coverage honesty

- Step 10, the waitlist's 429 and a real confirmation mail wait for the owner's Turnstile widget.
