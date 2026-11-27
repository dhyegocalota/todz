# Remove API keys: plan

- [x] 1. ADR 0111 and the status lines of the ADRs it supersedes or amends, with the ADR index. (9c5498cf)
- [x] 2. Red tests: `apps/api/test/api-keys-removed.test.ts` and `tools/repository-shape/src/api-keys-removed.test.ts`. (ce7503fe)
- [x] 3. Migration `0018_drop_api_keys.sql`; delete the key modules, routes, limits, copy and prefixes; `/mcp` refuses a former key; tests move to seeded grants. (3a817e62)
- [x] 4. The site copy: landing, `llms.txt`, WebMCP and the server card describe OAuth only. (3a817e62)
- [x] 5. `tools/perf`: a local grant fixture, a loopback OAuth authorization for the production run, no Keychain item. (9673d2f9)
- [x] 6. The shape tests that read the key screen, the setups of the app or the key scopes. (7e362a39)
- [x] 7. The docs app, the README, the runbooks, the scenarios and the agent role files. (c100e130)

## Failure modes

| Step | What breaks | Signal | Back out |
|------|-------------|--------|----------|
| 3 | The migration drops the tables while a client still sends a key | the client gets 401 with the docs pointer | none needed: the client reconnects with OAuth |
| 3 | A Worker older than the migration reads the dropped tables | 500 on `/mcp` and the key routes | deploy the new Worker; the tables return only through the Time Travel bookmark |
| 5 | The local grant fixture drifts from the OAuth schema | `pnpm perf load` fails on a 401 right after the seed | align `tools/perf/src/local-grant.ts` with the OAuth tables |

Steps without a back out: 3 (the migration deletes the key rows for good).
