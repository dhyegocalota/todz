# Plan: Project store

**Spec:** spec.md
**Tier:** 🔴
**Seam:** a new workspace package `@todz/api` under `apps/api`, depending on `@todz/core` and `@todz/types`; nothing imports it yet
**Assumptions (decided, owner can override):**
- ADRs 0012 to 0015 are the loop's calls, listed in the loop's questions.
- Dev dependencies, exact versions: `wrangler` 4.167.0, `@cloudflare/vitest-plugin` 1.9.0, `@cloudflare/workers-types` 5.20261123.1, `vitest` 5.0.5 (the repository's). No `@types/node`: the code and the tests run in workerd (ADR 0012), and `tsconfig.json` covers `src` and `test`, not the Vitest configuration. No runtime dependency outside the workspace.
- The `dev` script (`wrangler dev`) exists only for manual inspection; no feature step depends on it.
- Tests seed the directory with SQL through a test helper under `apps/api/test/`; no production code writes the directory yet.

## File map

| Group | Paths owned | Developer sub-agent |
|-------|-------------|---------------------|
| G1 | `apps/api/{package.json,tsconfig.json,vitest.config.mts,wrangler.jsonc,README.md}`, `apps/api/migrations/0001_directory.sql`, `apps/api/src/{index,env}.ts`, `apps/api/test/{env.d.ts,apply-migrations.ts,worker.test.ts}` (the setup file applies the D1 migrations before each test file), `apps/README.md`, `pnpm-lock.yaml`, `AGENTS.md` (layout line), `tools/repository-shape/src/delivery-docs.test.ts` (`ROOT_ENTRIES`, `FEATURE_PACKAGES`, `TOP_LEVEL_FOLDERS`), `.gitignore` (`.wrangler`) | `developer-1` |
| G2 | `apps/api/src/{sqlite-task-store,project-schema,project-store,project-result}.ts`, `apps/api/test/{sqlite-task-store,project-store}.test.ts` | `developer-1` |
| G3 | `apps/api/src/{credential-digest,directory,project-routing}.ts`, `apps/api/test/{credential-digest,directory,project-routing,isolation}.test.ts`, `apps/api/test/{directory-seed,counting-namespace}.ts` | `developer-1` |
| G4 | `tools/repository-shape/src/api-source.test.ts` | `developer-1` |

## Sequencing

One developer runs G1 to G4 in order: G2 needs the package and the runtime of G1, G3 routes to the Durable Object of G2, and the isolation suite needs both. The package is too small for parallel lanes to pay for their merges.

## Steps

Author this list with every box empty. A sub-agent ticks its own line. A wrong step is struck through with the reason, not deleted.

### G1

- [x] **Step 1:** scaffold `@todz/api`: package with `typecheck`, `test:unit` and `dev` (`wrangler dev`) scripts and no deploy script, tsconfig, `wrangler.jsonc` as the spec states, `vitest.config.mts` on `@cloudflare/vitest-plugin` with the repository's loaded-machine timeouts and the D1 migrations passed as a binding, `migrations/0001_directory.sql`, `src/env.ts` (the `Env` type), `src/index.ts` (default `fetch` answering 404, `ProjectStore` export placeholder), `apps/README.md`, package README, `AGENTS.md` layout line, `delivery-docs.test.ts` entries, `.wrangler` ignored; `pnpm install`. Pin test `test/worker.test.ts`: `GET /` and `POST /mcp` answer 404 with an empty body; the directory migration applies and lists the five tables. — evidence: 5e87da0 (pin)

### G2

- [x] **Step 2:** red then green: `SqliteTaskStore` and the project schema (`sqlite-task-store.test.ts` inside the Durable Object through `runInDurableObject`). — evidence: red ab86c32, green f3b8316
- [x] **Step 3:** red then green: `ProjectStore` RPC methods and `ProjectResult` (`project-store.test.ts` through the stub). — evidence: red 1e2b585, green ff3004a

### G3

- [x] **Step 4:** red then green: `digestCredential`. — evidence: red e89818d, green 47ece3a
- [x] **Step 5:** red then green: the directory reads. — evidence: red da09333, green f30293b
- [x] **Step 6:** red then green: the routing functions. — evidence: red 56a3bf4, green dda28fd
- [x] **Step 7:** the isolation suite (`isolation.test.ts`); every case that is green when it lands is marked `pin` in its commit and the briefing. — evidence: f48e3ab (pin)

### G4

- [x] **Step 8:** pin: `api-source.test.ts` fails when a file under `apps/api/src` calls `console`, and when a file other than `src/project-routing.ts` contains `PROJECT_STORE.`; it lands green, so two mutation checks prove it (a `console.log` added to `src/index.ts`; `PROJECT_STORE.idFromName` added to `src/project-store.ts`; each red with the file named, each restored), recorded in the briefing; `tester-briefing.md` written. — evidence: 8c8fcde (pin), mutations recorded in tester-briefing.md

## Failure modes

| Step | What breaks | How I notice (the concrete signal) | How I back out |
|------|-------------|------------------------------------|----------------|
| 1 | the plugin cannot read `wrangler.jsonc` or boot workerd | `pnpm --filter @todz/api test:unit` fails before any test with a Miniflare or config error | compare with the spike's configuration in ADR 0012's evidence; revert the package folder and the lockfile |
| 1 | `pnpm install` changes unrelated packages in the lockfile | `git diff pnpm-lock.yaml` touches entries outside the new importer | reinstall from `main`'s lockfile with only the new importer added |
| 1 | the shape gate rejects the new root entry or README | `pnpm verify` shape gate red | add the `ROOT_ENTRIES`, `FEATURE_PACKAGES` or README link it names |
| 2 | a PRAGMA is used for the schema version | `SQLITE_AUTH: not authorized` on the first Durable Object call (seen in the spike) | keep the version in the `schema_version` table |
| 2 | order keys sort differently in SQL than in JavaScript | the BINARY order test fails on mixed-case keys | declare `COLLATE BINARY` and sort with the column, never with `lower()` |
| 2 | the counter follows `max(number)` instead of staying a counter | the counter test fails after a task row is removed by hand | keep `task_counter` and raise it in `insertTask` |
| 3 | a failure escapes as a thrown error across RPC | the RPC test sees a rejected promise instead of `{ ok: false }` | catch `RuleViolation` and `TaskNotFoundError` inside the method, after the transaction rolled back |
| 3 | a failed batch leaves rows | the rollback test counts tasks after a failure | run the use case inside `transactionSync` |
| 6 | routing opens a stub for a refused credential | the routing test gets a stub instead of `null`, or the counting namespace records an `idFromName` or `get` call | return before `PROJECT_STORE.get` when the directory answers `null` |
| 7 | a failure for another project's task differs from a never-existing id | the isolation suite's deep equality fails | build both failures from the same `TaskNotFoundError` mapping |

**Steps with no backout:** none; nothing is deployed or migrated outside a local runtime.

## Z. Prove and ship

- [x] **Tester briefing:** a developer wrote `tester-briefing.md`. — evidence: docs/features/project-store/tester-briefing.md
- [x] **Tester run:** a fresh `tester` sub-agent executed `test-plan.md` and ticked every box with evidence. — evidence: c389491, c92a6ff, 22ef48b, 063a4bb, 71d2e7d
- [x] **Reviewer:** a fresh `reviewer` sub-agent returned a verdict; refutation of the three riskiest claims is recorded in `test-plan.md`. — evidence: Ship-ready YES after 713d4b5; security verdict CLEAR; refutations in test-plan.md → Adversarial review
- [x] **/check-ui:** not applicable: no UI.
- [x] **/open-pr:** gates passed, learnings sweep stated, PR opened. — evidence: verify 6 gates green at 44d052f; [PR #4](https://github.com/dhyegocalota/todz/pull/4)
