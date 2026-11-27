# MCP full toolset

**Status:** Shipped 2026-11-27
**Tier:** 🟡
**Owner approval:** approved 2026-11-27 by the owner's order in PROMPT.md, "Full toolset on one connection": his Claude connector over an owner-scope grant showed nine tools and no task tool
**ADRs:** [0115](../../adr/0115-one-oauth-connection-with-the-account-scope-exposes-everything-the-app-can-do-and-task-tools-take-an-explicit-project.md), amending [0109](../../adr/0109-mcp-clients-connect-with-oauth-2-1-pkce-and-dynamic-registration-and-a-grant-is-never-more-than-the-equivalent-key.md)
**Not changing:** the project-scope tool set, the OAuth flow, fair use and the cloud cap rules, the Mac app

## Problem

With API keys gone, an owner-scope OAuth connection is the only way to reach the whole account, yet it serves only the nine account tools. An agent cannot add, list or complete a task through it.

## Goals

- The owner-scope server also serves `next`, `add`, `list`, `show`, `history`, `update`, `done`, `reopen`, `delete` and `move` (search is `list` with `text`, reorder is `update` with `placement`).
- Each takes a required `project` id; there is no default project. The call is authorized against the grant's owner, and a project of another owner answers exactly like an unknown one.
- `move` takes the source in `project` and the destination in `destination`.
- A project-scope grant keeps exactly its set, with no `project` argument.
- Every tool of both servers carries `title`, `readOnlyHint`, `destructiveHint`, `idempotentHint` and `openWorldHint: false`.

## Non-goals

- A `projects` tool on the owner scope (`workspaces` lists the projects).
- Cross-workspace moves.

## Design

### Data flow

`serveOwnerScope` builds one server. Each task tool resolves its `project` argument through `openOwnedGrantProject`, which joins the project to its workspace and requires the workspace owner to equal the grant's owner, then runs the same handler the project server runs, with that project's store, time zone and nudge setting. The owner's write budget, suspension and cap are per owner and unchanged.

### Failure handling

A missing `project` fails the input schema. A foreign or unknown project answers `accountNotFound` before any store is opened.
