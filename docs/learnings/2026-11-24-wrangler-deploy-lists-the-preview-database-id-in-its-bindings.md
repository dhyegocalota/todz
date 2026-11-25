# `wrangler deploy` lists the D1 binding with the nil preview id, though the Worker is bound to production

- Date: 2026-11-24
- Inspired by: the first production run of [`deploy-the-api.md`](../runbooks/deploy-the-api.md) at 2bde053 (Version `8d389ed9-126b-475d-b936-ab951e1141c9`), [ADR 0044](../adr/0044-the-wrangler-configuration-is-production-on-api-todz-app-and-development-overrides-it.md)
- Revisited: 2026-11-24 — still true (written the same day)

## Signal

Wrangler 4.167.0's `wrangler deploy` prints `env.DIRECTORY (00000000-0000-0000-0000-000000000000)` in its bindings table, the `preview_database_id` from `wrangler.jsonc`, where the runbook expects `todz-directory`. `wrangler d1 migrations apply --remote` likewise says "Executing on preview database todz-directory", while naming the production id. It reads as if production were bound to a database that does not exist.

## Cause

The table shows the binding's preview id when one is set. The uploaded version is bound to `database_id`: `wrangler versions view <version> --json` lists `"name": "DIRECTORY"` with `"id": "dc22b1c3-1869-44a0-b805-91bf92017f19"`, and D1-backed routes answer 401 rather than 500.

## Do

Never judge the D1 binding from the deploy table. After a deploy, read `scripts/todz-cloudflare.sh pnpm --filter @todz/api exec wrangler versions view <Version ID> --json` and check that the `d1` binding's `id` is the `database_id`. Then ask a route that reads D1 (`/owner` with a wrong session) for a 401.

## Anchor

`apps/api/wrangler.jsonc` (`preview_database_id`), `docs/runbooks/deploy-the-api.md` steps 7 and 8.
