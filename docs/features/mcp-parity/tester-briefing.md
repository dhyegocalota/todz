# Tester briefing: MCP parity

## What changed

- `libs/core/src/delete-task.ts`: the delete rule (find, compare the trimmed confirmation with the title, remove). `TaskStore.removeTask` is new on the port.
- `apps/api/src/project-schema.ts`, `sqlite-task-store.ts`, `project-store.ts`: project store schema version 5 (`tasks.deleted_at`); a delete scrubs the row and bumps its change number; every read skips it; `readChanges` returns `deletedNumbers`; `ProjectStore.deleteTask` and `readTask`.
- `apps/api/src/owner-changes.ts`: the change feed answers `deleted_numbers`.
- `apps/api/src/mcp-server.ts`, `mcp-format.ts`, `mcp-tool-arguments.ts`, `move-task.ts`, `project-routing.ts`, `directory.ts`, `directory-workspaces.ts`: the project tools `show`, `history`, `reopen`, `delete`, `move`, `projects`. The key row now carries the workspace id; `KeyProject.workspace` opens sibling projects only.
- `apps/api/migrations/0015_owner_keys.sql`, `directory-owner-keys.ts`, `owner-keys-issuance.ts`, `owner-key-routes.ts`, `owner-routes.ts`: owner keys and `GET|POST /owner/keys`, `DELETE /owner/keys/:keyId`.
- `apps/api/src/mcp-endpoint.ts`, `mcp-owner-server.ts`, `mcp-owner-arguments.ts`: `todz-owner_` secrets reach the nine account tools; `project-routing.ts` `openOwnerKey` resolves the owner.
- `apps/api/src/owner-workspace-actions.ts`, `owner-settings-actions.ts`, `owner-action-result.ts`, `owner-action-response.ts`: the account actions moved out of the owner route handlers so routes and tools share them. `owner-workspaces.ts` and `owner-account.ts` are thin wrappers now.
- `apps/docs/mcp-tools.mdx`, `tools/repository-shape/src/mcp-parity*.ts`, `docs-mcp-reference.test.ts`: the docs page with scopes and the parity test.
- ADRs 0101 and 0102, this folder.

## How to run

`pnpm --filter @todz/core exec vitest run`, `pnpm --filter @todz/api test:unit` (workers pool), `pnpm --filter @todz/repository-shape test:unit`, then `pnpm verify`.

## Red first

| Test file | Red commit | Failure the red run printed |
|-----------|-----------|------------------------------|
| `libs/core/src/delete-task.test.ts` | c10cf860 | `Error: deleteTask is not implemented` (5 tests) |
| `apps/api/test/project-task-removal.test.ts`, `project-schema.test.ts` | d3b3c7a4 | `deleteTask is not implemented`, `readTask is not implemented`, `expected 3 to be 4` |
| `apps/api/test/mcp-project-tools.test.ts` | b86aac38 | `ProtocolError: Tool reopen not found` (and delete, move, projects), 11 tests |
| `apps/api/test/owner-key-routes.test.ts`, `mcp-owner-tools.test.ts`, `owner-routes.test.ts` | e9717552 | `no such table: owner_keys`, `issue owner key answered 404`, 28 tests |
| `show` and `history` tests | none separate | `ProtocolError: Tool show not found` printed by a run that overlapped the edit; they ride in cfc62a64 |
| settings tool tests | 54ed31dd | `ProtocolError: Tool settings not found`, `expected 7 tools to equal 9` |
| move retry after a stopped first run | pin | green when it landed |
| the key constants and `RuleIssue.ConfirmationMismatch` | pin | in c10cf860 |

The existing owner workspace and delete tests ran green after the account actions moved, unchanged.

## Hypotheses for the tester

- A project key never lists or reaches an account tool, and an owner key never lists or reaches a task tool.
- An owner key reaches only its owner's workspaces and projects; a foreign id answers exactly what an absent id answers.
- A wrong `confirm` deletes nothing in any delete tool.
- A deleted task is gone from every read and its number is not issued again; the change feed names it once under `deleted_numbers`.
- A move leaves one task in the destination and none in the source, or a copy in both after a stopped run that a retry resolves.
- `PATCH /owner` behaves as before.
- An owner key, a project key and a session are never accepted in each other's place.

## Gaps I know about

- The fair-use reservation is not called on the new write tools (the lane is not on `main`): the seam is in the spec.
- `GET /owner/keys` and the others are not rate limited apart from the owner limiter every owner route has.
- The move's two steps are not fault-injected.
- Hard to see from the tests: the Mac app ignores `deleted_numbers`, so a task deleted over MCP stays on a Mac until its next full pull from cursor 0; the app lane fixes that.
