# Test plan: Health HEAD

Every checkbox states the input and the exact expected outcome. A ticked box carries evidence after ` — evidence: `.

## The failing test first

- [ ] `apps/api/test/health.test.ts::HEAD /health` — input: `HEAD /health` on the API host; expected: status 200
- [ ] Confirmed it fails for the right reason: the run prints `expected 404 to be 200`, not a broken test

## Unit

- [ ] `HEAD /health` on the API host, the site host and an unknown host — expected: 200, `Cache-Control: no-store`, a JSON `Content-Type`, empty body
- [ ] `HEAD /health?probe=1` — expected: 200, empty body
- [ ] `HEAD /health` carries the headers of `GET /health` — expected: every header `GET` sets is present on `HEAD` with the same value
- [ ] Edge: `GET /health` — expected: 200 and `{"service":"todz","origin":"http://localhost:8787"}`, unchanged
- [ ] Edge: `POST /health` on the API and site host — expected: 404, empty body
- [ ] Edge: `HEAD /` on the API host — expected: 404, empty body
- [ ] Edge: `HEAD /health` with a configured origin that has a trailing slash — expected: 404, empty body

## E2E (Playwright specs)

- None: no browser surface.

## Prove it for real

- [ ] After the deploy: `curl -sSI https://api.todz.app/health` — expected: `HTTP/2 200`, `cache-control: no-store`, no `server-timing`
- [ ] `curl -sSI https://todz.app/health` — expected: `HTTP/2 200`

## Edge cases found during execution

Empty on purpose.

## Adversarial review

- [ ] Claim 1: HEAD and GET cannot drift — attack: compare every header of both responses; result: pending
- [ ] Claim 2: no other method or path changed — attack: PUT, PATCH, DELETE, OPTIONS on `/health`; result: pending
- [ ] Claim 3: the earlier run-log rows are untouched — attack: `git diff` shows only added lines in the Run log; result: pending

## Coverage honesty

- The production answer is not tested before the deploy; step 13's new probe is its proof.
