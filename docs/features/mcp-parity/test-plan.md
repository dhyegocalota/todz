# Test plan: MCP parity

Every checkbox states the input and the exact expected outcome. A ticked box carries evidence after ` — evidence: ` (commit hash, log path, counts).

## The failing test first

- [ ] `libs/core/src/delete-task.test.ts` at `c10cf860` — input: `pnpm --filter @todz/core exec vitest run src/delete-task.test.ts`; expected: five tests fail with `Error: deleteTask is not implemented`
- [ ] `apps/api/test/project-task-removal.test.ts` at `d3b3c7a4` — input: the file; expected: ten tests fail with `deleteTask is not implemented` and `readTask is not implemented`
- [ ] `apps/api/test/mcp-project-tools.test.ts` at `b86aac38` — input: the file; expected: 11 tests fail with `ProtocolError: Tool reopen not found` (and delete, move, projects)
- [ ] `apps/api/test/owner-key-routes.test.ts` and `mcp-owner-tools.test.ts` at `e9717552` — expected: 28 tests fail with `no such table: owner_keys` or `issue owner key answered 404`

## Unit

- [ ] Delete a task with its exact title — expected: the task is gone from `list`, `show`, `next`; `delete` again answers task not found
- [ ] Delete with `remove` for `Remove me`, with an empty confirm, with no confirm — expected: the task stays; the refusal sentence for the first two, an input validation error for the third
- [ ] Delete a task, add the same idempotency key — expected: a new task number, `replayed: false`
- [ ] Read the change feed after a delete — expected: the number in `deletedNumbers` once and not in `tasks`; `deleted_numbers` on the owner route
- [ ] The tombstone row — expected: no title, notes, idempotency key or completion note in any column
- [ ] Move an open task with notes and a due date to a sibling project — expected: gone from the source; in the destination with the same title, notes and due date and a new number
- [ ] Move a done task — expected: done in the destination
- [ ] Move to another workspace's project, to a random id, to the same project — expected: the same sentence for all three; the task stays; nothing is added elsewhere
- [ ] Move retried after a first run stopped between the add and the delete (the destination already holds the key) — expected: success, one copy in the destination, none in the source (a pin, green when it landed)
- [ ] `projects` — expected: the workspace's projects with ids, the key's own marked, none of another workspace
- [ ] `reopen` a done task twice — expected: `Reopened …`, then `Already open …`
- [ ] Create an owner key, list, revoke — expected: `todz-owner_` secret once, the list shows id, hint and time only, revoke answers 204 then 404
- [ ] Create a sixth live owner key — expected: 409 `limit_reached`; revoke one and it is created
- [ ] An owner key on `/owner/*` — expected: 401
- [ ] Owner key over MCP, both protocol eras — expected: exactly the nine account tools and no task tool
- [ ] A project key over MCP — expected: exactly the eleven task tools; calling `delete_workspace` is refused as an unknown tool
- [ ] A revoked key, a never issued key, an owner key's random part without its prefix, an owner key under `todz_` — expected: 401 with an empty body
- [ ] `delete_workspace` and `delete_project` with a wrong, empty and case-different confirm — expected: nothing deleted, the refusal sentence
- [ ] A workspace or project of another owner in every account tool — expected: the same "Not found" sentence as an absent id; the foreign rows untouched
- [ ] The Inbox renamed or deleted — expected: the Inbox sentence
- [ ] Create a 21st workspace — expected: the limit sentence
- [ ] `update_settings` with a time zone, nudge and day email — expected: the new values listed; a bad zone, an empty call and minutes of 1440 change nothing
- [ ] `PATCH /owner` after the refactor — expected: the existing owner tests pass unchanged
- [ ] `tools/repository-shape/src/mcp-parity.test.ts` — expected: passes; removing a row or a tool fails it
- [ ] `tools/repository-shape/src/docs-mcp-reference.test.ts` — expected: one section per tool, each with its scope line

## Edge cases found during execution

Empty on purpose. The tester adds one checkbox per new case and a regression test for each.

## Adversarial review

- [ ] Claim 1: a project key cannot reach an account tool — attack: name each account tool from a project key; result: _
- [ ] Claim 2: an owner key reaches only its owner — attack: use another owner's workspace and project ids in every tool; result: _
- [ ] Claim 3: a failed move never loses a task — attack: fail the destination add and the source delete; result: _

## Coverage honesty

- The fair-use reservation on the new write tools — the lane is not on `main`; the seam is in the spec.
- The app's Settings section for owner keys and the app's handling of `deleted_numbers` — the follow-up lane.
- A real deploy with migration 0015 — the lead deploys; the human checklist of the pull request covers it.
- A failure between the add and the delete of a move is argued by the order of the steps, not injected.
