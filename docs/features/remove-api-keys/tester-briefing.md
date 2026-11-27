# Tester briefing: Remove API keys

Written by the developer sub-agent when its steps are done. The developer does not run `test-plan.md` and does not declare the feature works.

## What changed

- `apps/api/src/mcp-endpoint.ts`: only OAuth access tokens are served; any other bearer gets the 401 with the docs pointer.
- `apps/api/migrations/0018_drop_api_keys.sql`: deletes and drops `mcp_sessions`, `owner_keys` and `project_keys`.
- `apps/api/src/owner-routes.ts`: the six key routes are gone.
- `apps/api/src/project-routing.ts`, `apps/api/src/directory.ts`: `GrantProject` replaces `KeyProject`; the key lookups are gone.
- `apps/api/src/site`, `apps/api/src/mcp-server-card.ts`: landing, `llms.txt`, WebMCP and the server card describe OAuth only; no Cursor setup.
- `tools/perf`: `local-grant.ts` (local D1 fixture), `oauth-authorize.ts` and `loopback-receiver.ts` (production authorization).
- `apps/docs`, `README.md`, `docs/runbooks`, `docs/scenarios`: OAuth only, with the breaking-change note of 2026-11-27.

## How to run

```bash
pnpm --filter @todz/api test:unit
pnpm --filter @todz/api exec playwright test e2e/oauth.spec.ts e2e/landing-seo.spec.ts
pnpm --filter @todz/repository-shape test
pnpm --filter @todz/perf test:unit
pnpm typecheck
```

## Red today, green after

| Test | Red before the change because | Green after because |
|------|--------------------------------|---------------------|
| `apps/api/test/api-keys-removed.test.ts::a former key starting with todz_ on /mcp` | `Received 401 with an empty body`: no JSON body | the refusal carries `error` and `error_description` |
| `apps/api/test/api-keys-removed.test.ts::the owner API once keys are gone` | `expected 200 to be 404` (`GET /owner/keys`), `expected 201 to be 404` (`POST`) | the routes are deleted |
| `apps/api/test/api-keys-removed.test.ts::the migration that drops the keys` | `no migration named 0018_drop_api_keys.sql` | the migration exists |
| `tools/repository-shape/src/api-keys-removed.test.ts` | the key modules, tables and copy still exist | they are gone |

## Hypotheses to attack

1. Hypothesis: a former key never opens `/mcp`, whatever its prefix. Break it by: sending `todz_`, `todz-owner_`, an unprefixed and a `todz-at_` value that was never issued.
2. Hypothesis: deleting a project or a workspace revokes its OAuth grants at once. Break it by: connecting a project grant, deleting the project, calling `/mcp`.
3. Hypothesis: the migration leaves the OAuth tables and the owners untouched. Break it by: applying it over a database with grants and keys.

## Known gaps

- The Mac app's key screens and `AgentCommand.swift` are removed by the Mac app lane; the shape tests that read them were deleted here.
- Cursor cannot connect, because its OAuth redirect is a `cursor://` address that todz refuses.
- The production perf authorization and the local grant fixture were proven by unit tests and one local `wrangler d1 execute`, never by a full `pnpm perf` run.
- The Mac release notes of the next release (`pnpm release:mac`) still need the breaking-change line.
