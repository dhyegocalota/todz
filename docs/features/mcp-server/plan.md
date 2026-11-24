# Plan: MCP server

**Spec:** spec.md
**Tier:** 🔴
**Seam:** `apps/api` only, plus one constant in `libs/types`; the Worker's `fetch` gains the `/mcp` route
**Assumptions (decided, owner can override):**
- ADRs 0016 to 0019 are the loop's calls, listed in the loop's questions. The loop's brief authorizes reversible internal calls recorded this way, and the dependencies the product's stack implies (an MCP server on the Worker), named in the PR body; the plan review's finding 1 is answered by that brief.
- Dependencies, exact versions, named in the PR: `@modelcontextprotocol/server` 2.4.0 and `zod` 4.6.7 (runtime), `@modelcontextprotocol/client` 2.4.0 (dev).
- Tests drive the Worker through `exports.default.fetch` from `cloudflare:workers`; the client gets that function as its `fetch`.
- Secrets in tests are generated at run time (`issueProjectKey` or `crypto.randomUUID()`), never written as literals, so gitleaks has nothing to match.
- Fixtures use fresh random ids in every test, because storage persists across the tests of a file (STATE carry-over c).

## File map

| Group | Paths owned | Developer sub-agent |
|-------|-------------|---------------------|
| G1 | `apps/api/package.json`, `pnpm-lock.yaml`, `apps/api/migrations/{0001_directory,0002_mcp_sessions}.sql`, `apps/api/test/{directory-seed.ts,worker.test.ts,directory.test.ts}` (step 1 adds the schema pins; step 3 extends the same file), `libs/types/src/{constants,constants.test}.ts` | `developer-1` |
| G2 | `apps/api/src/{credential-secret,project-keys,directory,project-routing,owner-today}.ts`, `apps/api/test/{credential-secret,project-keys,directory,project-routing,isolation,edge-cases,owner-today}.test.ts` | `developer-1` |
| G3 | `apps/api/src/{mcp-format,mcp-copy}.ts`, `apps/api/test/mcp-format.test.ts` | `developer-1` |
| G4 | `apps/api/src/{index,mcp-endpoint,mcp-sessions,mcp-server}.ts`, `apps/api/test/{mcp-client.ts,mcp-endpoint.test.ts,mcp-tools.test.ts,mcp-isolation.test.ts,worker.test.ts}`, `apps/api/README.md`, `docs/features/mcp-server/tester-briefing.md` | `developer-1` |

The developer may split a G4 source file when it passes about 150 lines (one tool per file under `src/mcp-tools/` is fine); the split is named in the briefing.

## Sequencing

One developer runs G1 to G4 in order: G2 reads the new columns of G1, G4 calls everything before it. Parallel lanes would collide on `directory.ts` and the seeds.

## Steps

Author this list with every box empty. A sub-agent ticks its own line. A wrong step is struck through with the reason, not deleted.

### G1

- [x] **Step 1:** pin: add the three dependencies at exact versions; `owners.time_zone` in `0001_directory.sql`; `0002_mcp_sessions.sql`; `seedOwner` takes an optional `timeZone` (default `'UTC'` is a test fixture, not product code) and every seed caller keeps working; `worker.test.ts` lists the six tables; `PROJECT_KEY_PREFIX` and `LIST_LIMIT_DEFAULT` in `libs/types` with their pin tests; the schema pins of the test plan (time zone and session constraints) in `directory.test.ts`; `pnpm install`. All existing tests stay green. — evidence: pin `9038c84`; `@todz/api` 113 and `@todz/types` 15 tests green

### G2

- [x] **Step 2:** red then green: `generateCredentialSecret` and `issueProjectKey` (`credential-secret.test.ts`, `project-keys.test.ts`). — evidence: red `503c626`, green `926591b`; `insertProjectKey` landed here because `issueProjectKey` calls it
- [x] **Step 3:** red then green: `findKeyProject` returns `{ projectId, timeZone }`, ~~`insertProjectKey`,~~ `insertMcpSession`, `findMcpSessionClient` (`directory.test.ts`); `openKeyProject` returns a `KeyProject` (`project-routing.test.ts`, and the callers in `isolation.test.ts` and `edge-cases.test.ts` follow). — evidence: red `64b19c3`, green `239638a`; `insertProjectKey` moved to step 2 (`926591b`) and is tested through `project-keys.test.ts`
- [x] **Step 4:** red then green: `calendarDateInTimeZone` (`owner-today.test.ts`). — evidence: red `3d58860`, green `ee6a81b`

### G3

- [x] **Step 5:** red then green: the task line, task block, list header, answer lines and error texts, and the copy record (`mcp-format.test.ts`). — evidence: red `9767e59` (the copy record landed whole with it, so its 22 tests are pins), green `b5bb8ce`

### G4

- [x] **Step 6:** red then green: the HTTP surface table, row by row (`mcp-endpoint.test.ts`), with `src/index.ts` dispatching from a record keyed by the path and `worker.test.ts`'s `POST /mcp` case moving to 401. — evidence: red `4f9363c`, green `c9c7783` (also `mcp-sessions.ts` and a tool-less `mcp-server.ts`)
- [x] **Step 7:** red then green: the five tools and the prompt through the real client in both eras, the actor in history, today in the owner's zone (`mcp-tools.test.ts`, helper `mcp-client.ts`). — evidence: red `2356366`, green `e68a57f`; `mcp-server.ts` split into `mcp-tool-arguments.ts` past 150 lines
- [x] **Step 8:** the MCP isolation suite (`mcp-isolation.test.ts`); cases green on landing are marked `pin`. — evidence: pin `1a62a78`, 9 tests in both eras
- [x] **Step 9:** `apps/api/README.md` states the MCP purpose; `tester-briefing.md` written with the red texts each red run printed. — evidence: `53eec27`

## Failure modes

| Step | What breaks | How I notice (the concrete signal) | How I back out |
|------|-------------|------------------------------------|----------------|
| 1 | the SDK pulls Node-only modules into workerd | the first test file fails at import with a module resolution error | the spike ran the same versions in workerd; check the `workerd` export condition of `_shims` is picked |
| 1 | the lockfile changes unrelated importers | `git diff pnpm-lock.yaml` touches other importers | reinstall from `main`'s lockfile adding only these three |
| 1 | an existing test inserts an owner without the new column | `NOT NULL constraint failed: owners.time_zone` | route every insert through `seedOwner` |
| 3 | the join loses keys whose owner row is missing | a key test returns `null` for a seeded key | seeds always create owner, workspace and project together |
| 4 | workerd lacks ICU time zone data | `RangeError` for `America/Sao_Paulo` | stop and escalate: ADR 0018 depends on it |
| 6 | the SDK reads the body before the session layer | `TypeError: Body has already been used` | parse `request.clone()`, never the original |
| 6 | the legacy handler rejects a request that carries `Mcp-Session-Id` | the second legacy call answers 400 from the SDK | the spike proved it passes; compare the SDK version |
| 7 | the client cannot use `exports.default.fetch` | the client throws on connect | wrap it as `(input, init) => exports.default.fetch(new Request(input, init))`, as the spike did |
| 7 | a thrown RPC inside a tool fails the Vitest run (learning 2026-11-23) | an unhandled rejection reported after the test | tools only see results; assert throws inside the object |
| 8 | another project's id answers differently from a never-issued one | the suite's equality on the tool result fails | build both from the same `TaskNotFound` copy |

**Steps with no backout:** none; nothing is deployed or migrated outside a local runtime.

## Z. Prove and ship

- [x] **Tester briefing:** a developer wrote `tester-briefing.md`. — evidence: 53eec27, extended in 4ec37dc and 819f434
- [x] **Tester run:** a fresh `tester` sub-agent executed `test-plan.md` and ticked every box with evidence. — evidence: three passes: 2695abb (one defect, d53ee22), 569cfe0 (one defect, a4e2286), 21950bb (no defect)
- [x] **Reviewer:** a fresh `reviewer` sub-agent returned a verdict; refutation of the three riskiest claims is recorded in `test-plan.md`. — evidence: WITH RESERVATIONS at 4ec37dc (2 IMPORTANT, 4 MINOR), then Ship-ready YES at 819f434; security FINDINGS (1 IMPORTANT, 2 MINOR), the IMPORTANT and the fence fixed, time-zone validation deferred to `owner-api`
- [x] **/check-ui:** not applicable: no UI.
- [x] **/open-pr:** gates passed, learnings sweep stated, PR opened. — evidence: verify 6 gates green at 5786b63; [PR #5](https://github.com/dhyegocalota/todz/pull/5)
