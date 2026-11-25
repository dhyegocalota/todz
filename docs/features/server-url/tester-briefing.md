# Tester briefing: Server URL

Written by the developer sub-agents when their steps are done. The developers do not run `test-plan.md` and do not declare the feature works.

## Lane S (server and docs)

### What changed

- `apps/api/src/health.ts` (new): `serveHealth` answers `{"service":"todz","origin":<PUBLIC_ORIGIN>}` as JSON with `cache-control: no-store` for GET; any other method, or a Worker without `PUBLIC_ORIGIN`, gets the empty 404. The service name `todz` is a constant in this file (the plan said `libs/types`, which Lane S does not own; the lead may move it).
- `apps/api/src/index.ts`: `fetch` checks `/health` before `hostKindOf`, so the API host, the site host and an unknown host all answer the API origin.
- `apps/api/wrangler.jsonc`: `/health` joins `assets.run_worker_first`.
- `apps/api/src/http-header.ts`, `turnstile-page.ts`, `site/admin-paths.ts`: one `NO_STORE` constant replaces the literals.
- `apps/api/scripts/server/ready-line.ts` (pure) and `cli.ts` (the one file that reads the disk): print `todz server ready: <PUBLIC_ORIGIN>  →  paste it in todz › Settings › Server`. `apps/api/package.json`: `server:deploy` is `wrangler deploy && tsx scripts/server/cli.ts`.
- `apps/api/vitest.config.mts`, `tsconfig.json`, `tsconfig.scripts.json`: `test/server/**` runs in the node pool and is typechecked with the scripts.
- `docs/self-host.md`: step 4 and step 6 and Updating use `server:deploy`; step 4's checks gain the `/health` curl; step 7 drops the `TODZ_API_BASE_URL` bullet and ends with paste-in-Settings; Updating says server first, then app. `apps/api/src/site/generated/self-host-html.ts` regenerated.
- `docs/runbooks/deploy-the-api.md` step 13: a `/health` curl and expected body, "When all fourteen pass".
- `apps/api/README.md`: one purpose sentence.
- Tests: `apps/api/test/health.test.ts`, `apps/api/test/server/ready.test.ts`, and pins in `tools/repository-shape/src/{api-source,self-host,runbooks}.test.ts`.

### How to run

```bash
pnpm --filter @todz/api exec vitest run --project workers test/health.test.ts
pnpm --filter @todz/api exec vitest run --project node test/server
pnpm --filter @todz/api typecheck
pnpm --filter @todz/api site:check
pnpm --filter @todz/repository-shape exec vitest run src/api-source.test.ts src/self-host.test.ts src/runbooks.test.ts
pnpm --filter @todz/api dev
curl -sS -i http://localhost:8787/health
```

### Red today, green after

| Test | Red commit | Printed failure | Green commit |
|------|------------|-----------------|--------------|
| `apps/api/test/health.test.ts` (API host, site host, unknown host, query string) | 97324da | `AssertionError: expected 404 to be 200 // Object.is equality` (4 failed, 4 passed: the `/`, trailing slash and POST cases are pins that were green) | 6b0b1fe |
| `tools/repository-shape/src/api-source.test.ts` the static assets never answer before the Worker on an API path | 97324da | `expect(configuration).toMatch(ASSETS_PATTERN)` failed against the unchanged `run_worker_first` list | 6b0b1fe |
| `apps/api/test/server/ready.test.ts` (4 tests) | e6badb8 | `Error: readyLine is not implemented`, `Error: publicOriginOf is not implemented` and `expected [Function] to throw error including 'PUBLIC_ORIGIN is missing from the Wra…' but got 'publicOriginOf is not implemented'` | 56c5ca2 |
| `self-host.test.ts` deploy step and Updating deploy with the script | e6badb8 | `AssertionError: expected '\n\n```bash\npnpm --filter @todz/api …' to contain 'pnpm --filter @todz/api server:deploy'` | 56c5ca2 |
| `self-host.test.ts` never asks a fork to rebuild | e6badb8 | `AssertionError: expected '# Self-host todz\n\nRun your own todz…' not to contain 'TODZ_API_BASE_URL'` | 56c5ca2 |
| `self-host.test.ts` Updating updates the server before the app | e6badb8 | `AssertionError: expected '\n\nPull from upstream, then run:\n\n…' to contain 'Update the server first, then the app'` | 56c5ca2 |
| `runbooks.test.ts` smoke check counts the health route | e6badb8 | `AssertionError: expected '13. **Smoke check the live routes.** …' to contain 'curl -sS https://api.todz.app/health'` | 56c5ca2 |

The `PROJECT_KEYS` change in `self-host.test.ts` (drops `TODZ_API_BASE_URL`) is a pin: green when it landed.

### Hypotheses to attack

1. Hypothesis: `/health` answers from the Worker, never from the static assets, on the deployed host. Break it by: `curl -sS -i https://api.todz.app/health` after a deploy, and by deleting `"/health"` from `run_worker_first` to see the pin fail.
2. Hypothesis: every host answers the API origin, including the site host and an unknown host. Break it by: `curl -sS --resolve` style requests with another `Host`, or `wrangler dev` on 8788 with `PUBLIC_ORIGIN` of 8787.
3. Hypothesis: only GET answers. Break it by: POST, HEAD, OPTIONS, `/health/`, `/Health`, `/health.json`.
4. Hypothesis: a Worker with no `PUBLIC_ORIGIN` answers the empty 404, not a body with `undefined`. Break it by: running the Worker with the variable removed (no test pins this; the code path is `serveHealth`'s second guard).
5. Hypothesis: `server:deploy` prints the ready line only after a successful deploy. Break it by: running it with a bad `account_id` and checking that nothing prints.
6. Hypothesis: the ready line's two spaces on each side of `→` match the Swift copy and the guide. Break it by: diffing the printed line against the design's string.
7. Hypothesis: the self-host page on `todz.app/self-host` shows the new guide. Break it by: `pnpm --filter @todz/api site:check` and opening the page.

### Known gaps

- `pnpm verify` is red on the branch from before this lane: `tools/repository-shape/src/document-indexes.test.ts` "lists every record once, in number order, with the title, status and date the record states" fails because the `docs/adr/README.md` row of ADR 0044 reads `Proposed, partly superseded by [0056](…) § 3` while the test expects the status the record states without that suffix. It fails with this lane's changes stashed too. `docs/adr` belongs to the lead.
- No test covers a Worker without `PUBLIC_ORIGIN` (hypothesis 4).
- `serveHealth` is not exercised by a deployed Worker here; the walk does it.
- The service name constant lives in `health.ts`, not `libs/types`.
