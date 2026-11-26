# MCP parity: every app action has a tool, and account management has its own key

**Status:** In review
**Tier:** 🔴 (API keys, workspace isolation, MCP tool authorization, data deletion, schema, sync)
**Owner approval:** the owner's request of 2026-11-26, "make sure que temos todas as MCP tools pra nem precisar relar a mão na UI", and the standing instruction to decide every call; the design is recorded in [ADR 0101](../../adr/0101-an-owner-key-is-a-separate-off-by-default-scope-for-the-account-and-project-keys-never-gain-account-powers.md) and [ADR 0102](../../adr/0102-deleting-a-task-leaves-a-scrubbed-tombstone-for-sync-and-a-move-adds-to-the-destination-before-it-deletes-the-source.md).
**ADRs:** [0101](../../adr/0101-an-owner-key-is-a-separate-off-by-default-scope-for-the-account-and-project-keys-never-gain-account-powers.md), [0102](../../adr/0102-deleting-a-task-leaves-a-scrubbed-tombstone-for-sync-and-a-move-adds-to-the-destination-before-it-deletes-the-source.md)
**Not changing:** the task rules for add, update and complete, the project key's issuing and revoking, the sign-in, the Mac app (its Settings section for owner keys is the follow-up lane below), the fair-use limits themselves.

## Problem

An agent can add, list, update and complete tasks, and nothing else. Reopening, deleting and moving a task, seeing a task's notes and history, listing the projects of a workspace, creating, renaming and deleting workspaces and projects, and changing the account settings all need the app. The owner wants none of it to need the UI.

## Goals

- Every action the app takes has an MCP tool, or a stated reason it does not (credentials, sign-in, sync transport). A repository-shape test fails when an owner route of the app has no row.
- A project key gains task tools only: `show`, `history`, `reopen`, `delete`, `move`, `projects`. `move` stays inside the workspace of the key.
- Account management (workspaces, projects, settings) is a separate scope: an owner key the owner creates in Settings, off by default, revocable, listed apart from the project keys.
- A delete names its target: `confirm` equals the current name.
- The docs MCP tools page lists every tool with its scope.

## Non-goals

- Issuing or revoking keys over MCP (ADR 0101).
- Reading or writing tasks with an owner key.
- Soft delete and restore.
- The app's Settings section for owner keys and the app's own delete and move of a task (follow-up lane for 0.2.4).

## Design

### Data flow

1. The owner signs in to the app, creates an owner key (`POST /owner/keys`) and pastes it into an agent's configuration, the same way as a project key.
2. At `/mcp` the Worker reads the bearer secret. `todz-owner_…` is hashed and looked up in `owner_keys`; anything else is looked up in `project_keys`. The first reaches the owner tool server, the second the project tool server. Unknown secrets answer 401 with an empty body.
3. An owner tool calls an account action (`owner-workspace-actions`, `owner-settings-actions`) with the owner of the key. The owner routes of the app call the same actions.
4. A project tool calls the project's Durable Object. `move` opens the destination through the workspace id of the key's own row; it adds there first, then deletes the source (ADR 0102).

### Interfaces

#### MCP tools

| Tool | Scope | Arguments |
|------|-------|-----------|
| `next`, `add`, `list`, `update`, `done` | project key | unchanged |
| `show` | project key | `id` |
| `history` | project key | `id` |
| `reopen` | project key | `ids` |
| `delete` | project key | `id`, `confirm` (the current title) |
| `move` | project key | `id`, `project` (an id from `projects`) |
| `projects` | project key | none |
| `workspaces` | owner key | none |
| `create_workspace` | owner key | `name` |
| `rename_workspace` | owner key | `workspace`, `name` |
| `delete_workspace` | owner key | `workspace`, `confirm` (the current name) |
| `create_project` | owner key | `workspace`, `name` |
| `rename_project` | owner key | `project`, `name` |
| `delete_project` | owner key | `project`, `confirm` (the current name) |
| `settings` | owner key | none |
| `update_settings` | owner key | `time_zone`, `agent_nudge`, `day_email`, `day_email_minutes` (any of them) |

The parity table (`tools/repository-shape/src/mcp-parity-actions.ts`) pairs every owner route of the app with its tool.

#### Owner API for the app lane

All three need the signed-in session as `Authorization: Bearer <session>` and the `Todz-App-Version` header, like every owner route.

- `GET /owner/keys` → `200 { "keys": [ { "id": string, "hint": string, "created_at": number } ] }`, oldest first, no secret.
- `POST /owner/keys` (no body) → `201 { "key": { "id", "hint", "created_at" }, "secret": "todz-owner_…" }`; the secret is in this answer only. `409 { "error": "limit_reached" }` at five live keys.
- `DELETE /owner/keys/:keyId` → `204`; `404 { "error": "not_found" }` for an absent, already revoked or another owner's key.
- The project change feed `GET /owner/projects/:id/changes?cursor=` gains `"deleted_numbers": [number]`: the task numbers deleted since the cursor. The app removes those tasks from its cache. An older app ignores it.

#### Copy for the app lane's Settings section (en-US, for `SettingsCopy`)

- Section title: **Account keys**
- Description: "An account key lets an AI agent create, rename and delete your workspaces and projects and change these settings. It cannot read your tasks. It is off until you create one. Keep it out of any repository."
- Empty list: "No account keys. Agents can still use your project keys."
- Create button: "Create an account key"
- Created sheet title: "Your account key"; body: "Copy it now: it is shown once, and anyone who holds it can delete your workspaces. Revoke it here if it leaks."; button: "Copy key"
- Row: "Account key ending in {hint}" with "Created {date}" and a "Revoke" button
- Revoke confirmation: "Revoke this key? Agents that use it lose access at once." (buttons "Revoke" and "Cancel")
- At the cap: "You have five account keys. Revoke one to create another."

The section sits apart from Connect an Agent, which keeps listing project keys only.

### Failure handling

- A wrong `confirm` answers an error sentence and deletes nothing. A target of another tenant answers "Not found: this account has no such workspace or project." exactly as an absent id does.
- A move that fails after the add leaves a copy in the destination and the source in place; calling `move` again finishes it.
- An owner key whose owner has no row, a revoked key and an unknown key answer 401.
- Creating past 20 workspaces or 50 projects answers a limit sentence; the daily write reservation of the fair-use lane is the seam below.

### Seam for the fair-use lane (PR #94)

#94 is not on `main` yet. When it lands, the reservation `reserveWrites` goes at these call sites, with no other change to the tools:

- `apps/api/src/mcp-server.ts`, in `registerWriteTools`: `reopen` (writes: the ids), `delete` (1), `move` (1, plus the bytes of the task's title and notes). The scope already carries what #94 adds (`limits`, `refusalTextOf`) through `buildMcpServer`.
- `apps/api/src/mcp-owner-server.ts`: `create_workspace`, `create_project`, `rename_*`, `delete_*` and `update_settings` each take one write from the owner's day, by the owner of the key, before the action; `openOwnerKey` also refuses a suspended owner, as `openKeyProject` does.
- `apps/api/src/owner-workspaces.ts` and `mcp-owner-server.ts` pass the limits of `fairUseLimitsOf(env)` as `workspacesPerOwnerMax` and `projectsPerWorkspaceMax`, which today are `OWNER_WORKSPACES_MAX` and `WORKSPACE_PROJECTS_MAX`.

## Open questions → answers

| Question | Options | Owner's answer | Date |
|----------|---------|----------------|------|
| What does `confirm` equal for a task? | The title; the number; both | The title ("the target's current name") | 2026-11-26 |
| May an owner key issue project keys? | Yes, for bootstrap; no | No: a credential stays a human act (ADR 0101) | 2026-11-26 |
| Are account settings over MCP? | Yes under the owner key; no | Yes: "everything the app can do" | 2026-11-26 |
| Does an owner key read tasks? | Yes; no | No: it manages the account, a project key reads tasks | 2026-11-26 |

## Test strategy summary

Red-first unit tests: the core delete rule, the project store tombstone and its schema migration, the change feed, every project tool through a real MCP client in both protocol eras, the owner key routes, every account tool, the isolation between the two scopes and between owners, and a repository-shape test that maps every owner route to a tool. No UI changes: no Playwright walk.
