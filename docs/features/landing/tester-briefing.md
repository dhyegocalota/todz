# Tester briefing: landing

## G1: host dispatch

### What changed

- `apps/api/src/host-kind.ts`: `HostKind` and `hostKindOf({ request, env })` compare the request host with `PUBLIC_ORIGIN` (Api, wins a tie), `SITE_ORIGIN` (Site) and `www.` plus the site host (WwwRedirect); anything else is `null`.
- `apps/api/src/index.ts`: a `Record<HostKind, HostHandler>` in front of today's path dispatch; `null` answers `noRouteResponse()`. The Api handler is the previous behaviour.
- `apps/api/src/site/site-endpoint.ts`: `serveSite`, one route per method and path. `landing-page.ts` and `self-host-page.ts` are stubs; G2's versions replace them.
- `apps/api/src/http-status.ts` (not on the G1 list, needed for the two redirects): `MovedPermanently = 301`, `SeeOther = 303`.
- `wrangler.jsonc`: three custom domains and `SITE_ORIGIN`; `public/_headers`: nosniff; `package.json`: `SITE_ORIGIN` on every dev script and the new `dev:site`; `vitest.config.mts`: `SITE_ORIGIN` binding `http://localhost:8788`.
- R2 test moves: `mcp-client.ts`, `mcp-endpoint`, `mcp-tools`, `owner-isolation`, `owner-keys`, `sign-in-challenge-page`, `sign-in-page`, `worker` now use `http://localhost:8787`; `owner-sign-in` uses `PUBLIC_ORIGIN`; `sign-in-limiter` ("the configured binding refuses…") serves through `serveOwnerCall` with `{ ...env, PUBLIC_ORIGIN: PUBLIC_HTTPS_ORIGIN }`.
- `tools/repository-shape/src/api-source.test.ts`: pins the routes, `SITE_ORIGIN`, the dev scripts, `dev:site` and `_headers`.

### How to run

- `pnpm --filter @todz/api test:unit` (45 files, 1044 tests green), `pnpm --filter @todz/api typecheck`, `pnpm --filter @todz/repository-shape test:unit` (17 files, 224 tests green).
- `pnpm --filter @todz/api dev:site` runs the site instance on `http://localhost:8788`; `dev` stays on 8787.

### Red then green

| Test | Red commit | Printed | Green commit |
|---|---|---|---|
| `test/host-kind.test.ts` (18 tests) | `e2cc8ce` | 18 failed, each `Error: hostKindOf is not implemented: <request url> <number of env keys>` | `51cb1c7` |
| `test/site-dispatch.test.ts` (21 tests) | `5b5835a` | 11 failed: `expected 404 to be 200` (GET and HEAD `/` and `/self-host`, and `POST /join`), `expected 404 to be 303`, `expected 404 to be 301`, `expected 401 to be 404` (`/mcp`), `expected 503 to be 404` (`/owner/sign-in-method`), and `/sign-in` and `/sign-in/challenge` on the site host not answering 404; 10 already passed as pins (the API host, unknown hosts, `POST /`) | `5a21a36` |
| `api-source.test.ts` additions | none: edited with the configuration in `5a21a36`, so they are not red-first | | `5a21a36` |

Before the R2 moves, 186 api tests failed with 404 on `exports.default.fetch`; one more (`sign-in-limiter`) failed after the other moves because it needed a public `PUBLIC_ORIGIN`.

### Hypotheses

- Every API path on `api.todz.app` answers as before; on `todz.app` only `/`, `/self-host` (GET and HEAD) and `POST /join` answer.
- `www.todz.app/<path>?<query>` answers 301 to the same path and query on `todz.app`, keeping a port if present.
- `POST /join` never reads the request body, so a posted script never reaches the page.
- Static files (`/brand/*`, `/landing/*`) answer on every host with `X-Content-Type-Options: nosniff` once deployed (the headers file is pinned by text only; no run has seen the header).
- Under `dev` (8787) and `dev:site` (8788) the two hosts are told apart by port; not run here.

### Gaps

- `serveSite` takes only `{ request }`; `env` was left out because no route reads it yet.
- `landing-page.ts` and `self-host-page.ts` are stubs returning plain text bodies; the lead takes G2's versions at the merge.
- The `.test` host `api.todz.test` is gone from the Worker-reaching tests; `email-sender`, `sign-in-links`, `sign-in-guard` and `owner-routes` still use it because they never go through the default export.
- Deployment (the custom domains attaching, DNS) is not exercised.
