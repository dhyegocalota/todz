# Tester briefing: Health HEAD

Written by the developer. The developer does not run `test-plan.md` and does not declare the feature works.

## What changed

- `apps/api/src/health.ts`: `serveHealth` accepts `GET` and `HEAD`; `HEAD` answers the `GET` response's headers with a null body.
- `apps/api/test/health.test.ts`: HEAD tests on the API, site and unknown host, with a query string, header parity with `GET`, `HEAD /`, an unusable configured origin, and PUT and DELETE.
- `docs/runbooks/performance.md` and `docs/runbooks/deploy-the-api.md`: the sentence that `/health` carries no `Server-Timing`; step 13 probes `curl -sSI https://api.todz.app/health`.
- `docs/runbooks/deploy-the-api.md`: the performance deploy's run-log rows appended after the earlier rows.

## How to run

```bash
pnpm --filter @todz/api exec vitest run test/health.test.ts
pnpm --filter @todz/repository-shape exec vitest run
```

## Red today, green after

| Test | Red before the change because | Green after because |
|------|--------------------------------|---------------------|
| `health.test.ts > HEAD /health > answers 200 with the headers of GET and an empty body on the API host` (also site host, unknown host) | `AssertionError: expected 404 to be 200 // Object.is equality` | HEAD passes the method check |
| `health.test.ts > HEAD /health > answers 200 with a query string` | `AssertionError: expected 404 to be 200 // Object.is equality` | same |
| `health.test.ts > HEAD /health > carries every header GET carries, with the same value` | `AssertionError: expected { …(4) } to deeply equal { 'cache-control': 'no-store', …(5) }`; the 404 lacks `cache-control` and `content-type` | HEAD reuses the GET response's headers |

The `HEAD /`, unusable origin, PUT, DELETE and POST tests are pins: green when they landed (fb758f8).

## Hypotheses to attack

1. Hypothesis: HEAD and GET headers are identical on every host. Break it by: comparing all headers of both methods on the API, site and unknown hosts.
2. Hypothesis: no other method answers 200 on `/health`. Break it by: OPTIONS, PATCH, PUT, DELETE, TRACE.
3. Hypothesis: the added run-log rows leave earlier rows untouched. Break it by: `git diff origin/main -- docs/runbooks/deploy-the-api.md` shows only added rows plus the step 13 edits.

## Known gaps

- Production is not probed; step 13's new `curl -sSI` is the proof after the deploy.
- `content-length` of the HEAD answer is not asserted.
