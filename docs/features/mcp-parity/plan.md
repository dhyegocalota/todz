# Plan: MCP parity

**Spec:** spec.md
**Tier:** 🔴
**Seam:** `apps/api/src/mcp-endpoint.ts` dispatches by key prefix; `apps/api/src/owner-workspace-actions.ts` and `owner-settings-actions.ts` are shared by the owner routes and the owner tools.
**Assumptions (decided, owner can override):**
- An owner key manages the account and reads no task (ADR 0101).
- A task's delete confirmation is its title.
- Migration number 0015 is taken from the lead's allocation; the directory has no 0012 to 0014 on `main` yet.

## File map

| Group | Paths owned | Developer sub-agent |
|-------|-------------|---------------------|
| G1 | `libs/types`, `libs/core` delete rule | `developer` |
| G2 | `apps/api/src/project-*`, `sqlite-task-store.ts`, `owner-changes.ts` | `developer` |
| G3 | `apps/api/src/mcp-*`, `move-task.ts`, `directory*.ts` | `developer` |
| G4 | `apps/api/migrations/0015_owner_keys.sql`, owner key routes, account actions | `developer` |
| G5 | `apps/docs/mcp-tools.mdx`, `tools/repository-shape`, ADRs, this folder | `developer` |

## Sequencing

One developer, in this order: G1, G2, G3 (project tools), G4 (owner keys and account tools), G5.

## Steps

### G1

- [x] **Step 1:** Red: `delete-task.test.ts` and the key constants; green: `deleteTask` in core — evidence: red c10cf860, green in e4fb43a6

### G2

- [x] **Step 2:** Red: `project-task-removal.test.ts`, schema version 4, the change feed — evidence: red d3b3c7a4, green e4fb43a6

### G3

- [x] **Step 3:** Red: `mcp-project-tools.test.ts`; green: `reopen`, `delete`, `move`, `projects` — evidence: red b86aac38, green 1e6612f4
- [x] **Step 4:** `show` and `history` — evidence: cfc62a64

### G4

- [x] **Step 5:** Red: `owner-key-routes.test.ts`, `mcp-owner-tools.test.ts`; green: migration, owner key routes, dispatch, account tools — evidence: red e9717552, green e094a5a5
- [x] **Step 6:** Red then green: `settings` and `update_settings`, with the settings action shared by `PATCH /owner` — evidence: red 54ed31dd, green 90725a9e

### G5

- [x] **Step 7:** The MCP tools page with every tool and scope, the parity table and its test — evidence: d3f36628, 90725a9e
- [x] **Step 8:** ADRs 0101 and 0102, this folder, the indexes — evidence: the commit that adds this folder

## Failure modes

| Step | What breaks | How I notice (the concrete signal) | How I back out |
|------|-------------|------------------------------------|----------------|
| 2 | A project store at version 3 fails on `deleted_at` | `project-schema.test.ts` migrates a version 2 store and a new one | Revert; the column is nullable and unread by older code |
| 3 | A move loses a task | `mcp-project-tools.test.ts` moves, refuses and retries | Revert the tool; no data changed shape |
| 5 | A project key reaches an account tool, or the reverse | `mcp-owner-tools.test.ts` "the two scopes never mix" | Revert the dispatch line in `mcp-endpoint.ts` |
| 5 | The migration fails on deploy | `wrangler d1 migrations apply` error | Nothing reads `owner_keys` before the code ships; drop the table |

**Steps with no backout:** none. A deleted task or workspace is permanent by design, behind the confirmation.

## Z. Prove and ship

- [x] **Tester briefing:** a developer wrote `tester-briefing.md`.
- [ ] **Tester run:** a fresh `tester` sub-agent executes `test-plan.md` and ticks every box with evidence.
- [ ] **Reviewer:** a fresh `reviewer` sub-agent returns a verdict; refutation of the three riskiest claims is recorded in `test-plan.md`.
- [x] **/check-ui:** not applicable, no UI touched.
- [ ] **/open-pr:** gates passed, learnings sweep stated, PR opened.
