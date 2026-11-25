# `wrangler dev` hands the Worker its upstream host, whatever host the client sent

- Date: 2026-11-25
- Inspired by: the `landing` plan review (finding 1) and its spike, [ADR 0049](../adr/0049-todz-app-is-served-by-the-same-worker-dispatched-by-host-in-three-features.md) §1 as amended, [ADR 0044](../adr/0044-the-wrangler-configuration-is-production-on-api-todz-app-and-development-overrides-it.md)
- Revisited: 2026-11-25 — still true (written the same day)

## Signal

A Worker that dispatches by host answers every development request as the same host: `127.0.0.1`, `localhost` and `curl -H 'Host: todz.app'` all reach it as `localhost:8788` under `--local-upstream localhost:8788`, and all as `api.todz.app` without the flag when `wrangler.jsonc` has a custom-domain route. The site host is unreachable in development, and a `Host` header test proves nothing.

## Cause

Wrangler 4.167.0's dev proxy rewrites `request.url` and the `Host` header to the upstream: `--local-upstream` when given, otherwise the first route. The client's host never reaches the Worker. `--local-upstream` also drops `https`, so a redirect built from the request's URL points at `http://` in development.

## Do

Tell development hosts apart by port, one `wrangler dev` per host, each with `--local-upstream localhost:<its port>` and an origin variable naming that port (`dev` on 8787 for the API, `dev:site` on 8788 for the site, the E2E on 8791). Prove host dispatch with unit tests that call the default export with each host's URL, and prove `https` only after the deploy.

## Anchor

`apps/api/package.json` (`dev`, `dev:site`), `apps/api/playwright.config.ts`, `apps/api/src/host-kind.ts`, `apps/api/test/host-kind.test.ts`, `apps/api/test/site-dispatch.test.ts`, `tools/repository-shape/src/api-source.test.ts`.
