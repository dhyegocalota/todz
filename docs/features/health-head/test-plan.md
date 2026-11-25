# Test plan: Health HEAD

Every checkbox states the input and the exact expected outcome. A ticked box carries evidence after ` — evidence: `.

## The failing test first

- [x] `apps/api/test/health.test.ts::HEAD /health` — input: `HEAD /health` on the API host; expected: status 200 — evidence: throwaway worktree at fb758f8 (removed after), `vitest run test/health.test.ts`: 5 failed (API, site, unknown host, query string, header parity), 15 passed
- [x] Confirmed it fails for the right reason: the run prints `expected 404 to be 200`, not a broken test — evidence: fb758f8 printed `AssertionError: expected 404 to be 200 // Object.is equality` at `test/health.test.ts:66` and `:74`; header parity printed `expected { …(4) } to deeply equal { 'cache-control': 'no-store', … }` with `cache-control` and `content-type` missing, matching the briefing

## Unit

- [x] `HEAD /health` on the API host, the site host and an unknown host — expected: 200, `Cache-Control: no-store`, a JSON `Content-Type`, empty body — evidence: 881b759 `vitest run test/health.test.ts` 20 passed / 20; `pnpm typecheck` clean; real `wrangler dev` on 8797 (API) and 8798 (site): `curl -sSI localhost:8797/health` and `:8798/health` both `HTTP/1.1 200 OK`, `Cache-Control: no-store`, `Content-Type: application/json`; the unknown host is covered by the unit test only (development has no third host)
- [x] `HEAD /health?probe=1` — expected: 200, empty body — evidence: unit green; curl on 8797 and 8798 `HTTP/1.1 200 OK`, no body
- [x] `HEAD /health` carries the headers of `GET /health` — expected: every header `GET` sets is present on `HEAD` with the same value — evidence: unit green; curl `sort | diff` of both on 8797 and 8798: identical except `Content-Length: 51` present on GET and absent on HEAD (see edge cases)
- [x] Edge: `GET /health` — expected: 200 and `{"service":"todz","origin":"http://localhost:8787"}`, unchanged — evidence: curl GET on 8797 and 8798: `{"service":"todz","origin":"http://localhost:8797"}` (origin follows the configured `PUBLIC_ORIGIN`, which this run set to 8797), 200
- [x] Edge: `POST /health` on the API and site host — expected: 404, empty body — evidence: curl POST on 8797 and 8798: 404, `len=0`; unit tests green
- [x] Edge: `HEAD /` on the API host — expected: 404, empty body — evidence: curl `HEAD /` on 8797: 404 (on 8798 the site answers 200, the site home, as designed); unit green
- [x] Edge: `HEAD /health` with a configured origin that has a trailing slash — expected: 404, empty body — evidence: unit test green (not reachable through curl: needs a dev instance with a trailing-slash `PUBLIC_ORIGIN`)

## E2E (Playwright specs)

- None: no browser surface.

## Prove it for real

- [ ] After the deploy: `curl -sSI https://api.todz.app/health` — expected: `HTTP/2 200`, `cache-control: no-store`, no `server-timing` — BLOCKED: not deployed; before row only: `curl -sSI https://api.todz.app/health` on 2026-11-25 answered `HTTP/2 404`, no `cache-control`, as expected today
- [ ] `curl -sSI https://todz.app/health` — expected: `HTTP/2 200` — BLOCKED: not deployed; production was not probed beyond the single before row

## Edge cases found during execution

- [x] `HEAD /health/` (trailing slash) and `HEAD /HEALTH` — expected: 404, as `GET` — evidence: curl on 8797 and 8798: `HTTP/1.1 404 Not Found`, same as GET (only `Content-Length: 0` differs)
- [x] `HEAD /health?` (empty query) — expected: 200 like `?probe=1` — evidence: curl on 8797 and 8798: `HTTP/1.1 200 OK`, headers as `HEAD /health`
- [x] `OPTIONS`, `PATCH`, `TRACE /health` — expected: 404 — evidence: curl on 8797 and 8798: 404, `len=0`
- [x] `HEAD /owner` and `HEAD /nope` on the API host and the site host — expected: 404 — evidence: curl: 404 on both ports
- [x] `curl -X HEAD /health` (a client that waits for a body) — evidence: status 200 arrives, then curl waits for a body and times out at its own `-m 5`; that is curl's behaviour with a forced `-X HEAD`, not a server defect (`-I` returns at once)
- [x] `Content-Length` on HEAD (the briefing's known gap) — observation, not a defect: through `wrangler dev` `HEAD /health` carries no `Content-Length` while `GET` carries `51`; the 404 `HEAD` likewise lacks the `Content-Length: 0` the 404 `GET` has; HTTP/1.1 permits omitting it on HEAD; unit parity test compares the Worker's own headers, which agree; production (h2 through Cloudflare) not observable until deploy; the deploy step 13 expectation names only `HTTP/2 200` and `cache-control: no-store`, so it is unaffected

## Adversarial review

- [x] Claim 1: HEAD and GET cannot drift — attack: compare every header of both responses; result: held — curl `sort | diff` on `/health`, `/health?probe=1`, `/health?` on 8797 and 8798: all headers equal (`Cache-Control`, `Content-Security-Policy`, `Content-Type`, `Referrer-Policy`, `Strict-Transport-Security`, `X-Content-Type-Options`); the only difference is the server-added `Content-Length` on GET; `date` is not in the dev output
- [x] Claim 2: no other method or path changed — attack: PUT, PATCH, DELETE, OPTIONS on `/health`; result: held — POST, PUT, PATCH, DELETE, OPTIONS, TRACE `/health` all 404 with empty body on 8797 and 8798; `HEAD /`, `/owner`, `/nope` 404 on the API host
- [x] Claim 3: the earlier run-log rows are untouched — attack: `git diff` shows only added lines in the Run log; result: held — `git diff origin/main -- docs/runbooks/deploy-the-api.md`: 18 insertions, 1 deletion; the one deleted line is the step 13 `Expected:` line, replaced by its edited version; every run-log row is an added line

## Coverage honesty

- The production answer is not tested before the deploy; step 13's new probe is its proof.
