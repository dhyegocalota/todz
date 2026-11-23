# Tester briefing: Project store

Written by the developer sub-agent when its steps are done. The developer does not run `test-plan.md` and does not declare the feature works.

## What changed

- `apps/api/package.json`, `tsconfig.json`, `wrangler.jsonc`, `vitest.config.mts`, `migrations/0001_directory.sql`: the `@todz/api` package, Worker `todz-api`, the D1 `DIRECTORY` binding, the `PROJECT_STORE` Durable Object binding, workerd tests through `@cloudflare/vitest-plugin`, migrations passed as the `MIGRATIONS` binding and applied by `test/apply-migrations.ts`
- `apps/api/src/index.ts`, `env.ts`: default `fetch` answering 404 with an empty body, the `Env` type
- `apps/api/src/project-schema.ts`, `sqlite-task-store.ts`: the project tables, versioned by `schema_version`, and the `TaskStore` over `SqlStorage` plus `listHistory`
- `apps/api/src/project-store.ts`, `project-result.ts`: the Durable Object RPC methods, one `transactionSync` per call, `ProjectResult` and `ProjectFailureKind`
- `apps/api/src/credential-digest.ts`, `directory.ts`, `project-routing.ts`: SHA-256 hex digest, the three directory reads, the routing functions and the branded `SessionOwner`
- `apps/api/test/*`: the unit and isolation suites and their helpers (`task-fixtures.ts`, `directory-seed.ts`, `counting-namespace.ts`)
- `tools/repository-shape/src/api-source.test.ts`, `delivery-docs.test.ts`: the two source rules and the new `apps` root entry
- `apps/README.md`, `apps/api/README.md`, `AGENTS.md` layout line, `.gitignore` (`.wrangler/`), `pnpm-lock.yaml` (only the new importer and its packages)

## How to run

```bash
pnpm install
pnpm --filter @todz/api test:unit
pnpm --filter @todz/api typecheck
pnpm --filter ./tools/repository-shape test:unit
pnpm typecheck
```

Last runs by the developer: `@todz/api` 76 tests in 7 files green; `repository-shape` 144 tests green; `pnpm typecheck` green.

## Red today, green after

Red text is what the red run printed, never the text expected. Every red commit precedes its green commit.

| Test | Red before the change because | Green after because |
|------|--------------------------------|---------------------|
| `test/sqlite-task-store.test.ts` (16 tests), red `ab86c32` | `Error: applyProjectSchema is not implemented`, thrown by the Durable Object constructor | green `f3b8316`: schema applied once, adapter implemented |
| `test/project-store.test.ts` (18 of 21 fail), red `1e2b585` | `Error: ProjectStore.addTasks is not implemented` (17), `ProjectStore.listTasks is not implemented`, `ProjectStore.nextTask is not implemented`; the 3 rejection tests passed against the stubs | green `ff3004a`; the rejection tests were then rewritten to assert inside the Durable Object |
| `test/credential-digest.test.ts` (2), red `e89818d` | `Error: digestCredential is not implemented` | green `47ece3a` |
| `test/directory.test.ts` (9), red `da09333` | `Error: findKeyProject is not implemented` (3), `findSessionOwner is not implemented` (3), `findOwnedProject is not implemented` (3) | green `f30293b` |
| `test/project-routing.test.ts` (10), red `56a3bf4` | `Error: openKeyProject is not implemented` (4), `resolveSessionOwner is not implemented` (5), `openOwnedProject is not implemented` (1) | green `dda28fd` |
| `test/worker.test.ts` (4) | pin, `5e87da0`: green when it landed | n/a |
| `test/isolation.test.ts` (14) | pin, `f48e3ab`: green when it landed | n/a |
| `tools/repository-shape/src/api-source.test.ts` (3) | pin, `8c8fcde`: green when it landed | n/a |

Mutation checks of `api-source.test.ts`, both restored and never committed:

| Mutation | Red output |
|----------|-----------|
| `console.log('x');` appended to `apps/api/src/index.ts` | `no file calls console, so no log carries a task, a secret or a digest` fails, received `["apps/api/src/index.ts"]` |
| `export const leaked = PROJECT_STORE.idFromName;` appended to `apps/api/src/project-store.ts` | `only the routing module reads a member of the project store namespace` fails, received `["apps/api/src/project-store.ts"]` |

Other mutation checks by the developer, restored: replacing `transactionSync(useCase)` with `useCase()` turns `a failure after the task row is written rolls the whole call back` red; removing the brand from `SessionOwner` makes `pnpm --filter @todz/api typecheck` fail with `TS2578: Unused '@ts-expect-error' directive`.

## Hypotheses to attack

1. Hypothesis: a key of project A never reaches project B's tasks. Break it by: calling every RPC method through A's key with B's task numbers, anchors, text and idempotency keys, comparing each failure with the `T-99` failure.
2. Hypothesis: no refusal addresses a Durable Object. Break it by: a key with trailing whitespace or different case, a very long secret, a secret equal to a digest, a project id with SQL characters.
3. Hypothesis: a thrown store failure rolls back every write of the call. Break it by: failing at the first, middle and last write (history trigger, unique violation on the idempotency key, a corrupted row) and comparing the three tables and the counter.
4. Hypothesis: the counter never reissues a number. Break it by: deleting the last task row by SQL then adding a task; adding with a lower number after a higher one.
5. Hypothesis: a failure never carries a task title or note. Break it by: violations with secret titles and notes in every method and at every index.
6. Hypothesis: the revoked key, expired session and `''` secret resolve to nothing. Break it by: a session expiring at `now`, `now - 1` and `now + 1`; a revoked key whose `revoked_at` is `0`.
7. Hypothesis: the schema applies once and survives eviction. Break it by: evicting repeatedly between writes, then reading `schema_version` and `task_counter`.

## Known gaps

- `test-plan.md` says the corrupted-state rollback test corrupts `state` to `'archived'` and calls `listTasks` (done state). That cannot throw: the done list selects `WHERE state = 'done'` and never reads the archived row. I corrupted `created_by_kind`/`created_by_client` instead (the open list and `addTasks` then throw) and added a second test that proves rollback with a `BEFORE INSERT` trigger on `task_history`, which fails after the task row and the counter were written.
- The rejection cases (`today` that does not parse, an actor of kind `robot`, unmapped rows, the trigger failure) assert inside the Durable Object through `runInDurableObject`, not through the RPC stub: an error thrown across RPC surfaces in Vitest as an unhandled error and fails the run even when the test catches the rejection. The caller-visible rejection over RPC is therefore not asserted.
- `directory-seed.ts` inserts the digest of `''` once per table per test file; the tests that seed `''` run once each per file.
- `replaceTask` on a missing row updates nothing silently, as the in-memory store would set it; the core never does this.
- The isolation suite compares A's failure for `T-2` with the failure for `T-99` by asserting each literal, not by building one from the other.
