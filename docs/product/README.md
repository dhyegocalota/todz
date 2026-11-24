# todz v1: the approved product design

**Status:** Approved by the owner on 2026-11-23.

This is the design every v1 feature is cut from. A feature spec under [`docs/features/`](../features/) that stays inside these lines inherits this approval; anything outside them is a question for the owner, recorded in the loop's question list and never decided silently.

## Intent

todz is a to-do list for programmers and AI enthusiasts: simple, fast, polished, and as useful to an agent as to a person. An agent works the list through the MCP server and can do what the owner can do. The app never shows agents as live actors.

The bar is "simple, but super effective": few concepts, no setup, nothing that leaks.

## Goals

- One owner keeps tasks for several companies without any of them ever touching another.
- Any MCP client (Claude Code, Codex, Cursor) reads and changes the tasks of one project with a single key and no installation.
- A native macOS app with a main window, a menu bar extra and interactive widgets, synced through the cloud across the owner's Macs.

## Non-goals for v1

- iPhone or iPad app, and a web app.
- Teams: members, invitations, roles, per-seat billing. One owner per workspace.
- Agents as live actors: no presence, no progress bars, no agent steps, no "connected agents" list, and no agent asking the owner for input.
- Recurring tasks, reminders, notifications, attachments, comments.
- OAuth for MCP clients. v1 uses a bearer key per project.
- A public repository, a deploy, a domain or any spend without the owner's explicit OK.

## Anti-goals

- **Any read or write that crosses a project boundary.** A leak between projects is a failure even if every feature works.
- An MCP server that floods the agent's context with fat JSON.
- A UI that looks templated. It must feel like Apple made it.

## Model

```
owner ─┬─ workspace "Logic Bit"   (a company)
       │    ├─ project "Inbox"     (every workspace starts with one)
       │    ├─ project "api"
       │    └─ project "mac app"
       └─ workspace "Pessoal"
            └─ project "Inbox"
```

- **Workspace:** one company. A grouping for the owner, never a data boundary.
- **Project:** the isolation unit. Every task lives in exactly one project.
- **Task:** a short id per project (`T-12`), title, notes in Markdown, an optional due date, open or done, a manual order, created and completed times, and a history of changes. Each history line names its actor: the owner, or the MCP client name sent at connection ("via Claude Code").

## Views

- **Inbox:** the workspace's Inbox project.
- **Today:** open tasks due today or overdue across the active workspace's projects, then "Done today".
- **Upcoming:** open tasks with a future due date.
- **Done:** completed tasks, newest first.
- A project view lists that project's open tasks in manual order.

## Isolation

```
     MCP key or app session
              │
              ▼
  ┌──────────────────────────────┐   D1 directory: owners, workspaces, projects,
  │ Worker resolves the project  │   sessions, MCP key digests. No task data.
  │ from the credential, once    │
  └──────┬──────────────┬────────┘
         ▼              ▼
  ┌─────────────┐  ┌─────────────┐
  │ project A   │  │ project B   │   one Durable Object with its own SQLite
  │ DO + SQLite │  │ DO + SQLite │   per project; no query can reach both
  └─────────────┘  └─────────────┘
```

- Each project's tasks live in that project's own Durable Object SQLite database. There is no shared task table.
- An MCP key belongs to exactly one project. The project comes from the key, never from a tool argument; no MCP tool takes a project or workspace id.
- No MCP tool lists projects, searches across projects or reveals that other projects exist.
- The app reads across projects by fanning out per project, and the Worker checks the owner's right to each project in the directory before routing.
- Logs never carry task titles or notes.
- An isolation suite runs in the gate: a key for project A tries to read, change, complete, search and guess ids in project B, and always receives "not found", indistinguishable from an id that never existed.

## MCP server

Streamable HTTP on the Worker, authenticated with `Authorization: Bearer <key>`. The key is shown once when created and stored as a digest. Open-source under the repository's license when the owner makes the repository public.

| Tool | Does |
|---|---|
| `next` | Returns the one task to do now in this project, with its notes |
| `add` | Adds one or many tasks in one call, each with an optional `idempotency_key` so a retry never duplicates |
| `list` | Lists tasks by state, due window and text |
| `update` | Changes title, notes, due date or order |
| `done` | Completes one or many tasks, with an optional note of what was done that lands in the history |

Plus one prompt, `next`, that starts a coding session from the next task. Responses are compact text with short ids, not JSON dumps. A repository's `.mcp.json` points at its project's key, so one repository maps to one project.

## macOS app

- SwiftUI, macOS 14 or later (interactive widgets need it), the Glass direction of the approved mockups in [`mockups/glass-screens.html`](mockups/glass-screens.html): translucent materials, the system font, one cobalt accent (`#2F5BFF`).
- **Main window:** sidebar with the workspace switcher, Inbox, Today, Upcoming, Done, the projects and "Connect an agent" at the bottom; the task list; an inspector with project, due date, how it was added, notes and history.
- **Connect an agent:** copy a ready command for Claude Code, Codex or Cursor, the server URL, the tool list, and the keys of the selected project with "Revoke".
- **Menu bar extra:** Today of the active workspace and an "Add a task" field; ⌘1 to ⌘9 switch workspaces. The icon shows how many of Today's tasks are still open, behind a setting the owner can turn off, on by default (owner, 2026-11-24; [ADR 0036](../adr/0036-the-menu-bar-icon-counts-today-s-open-tasks-behind-a-setting.md)).
- **Widgets:** small "Today" progress ring, small "Next up", medium and large lists. Their checkboxes complete tasks through an App Intent without opening the app.
- **Sync:** the server is the source of truth. The app keeps a local cache in the App Group container that the widgets read, queues writes while offline, and pulls each project's changes from a cursor. While the app is open, a WebSocket from the project's Durable Object only says "changed", and the app pulls. Conflicts resolve last write wins, per field, by server time. Every local change reloads the widget timelines.

## Stack

- TypeScript monorepo as the harness already sets it up: `libs/core` holds the task and project rules behind ports, `libs/types` the shared enums and constants, `apps/api` the Cloudflare Worker with D1, the per-project Durable Objects and the MCP server.
- `apps/macos`: the Xcode project generated from a checked-in XcodeGen spec, with the app, the widget extension and the shared App Group code.
- Local development runs entirely on Wrangler and the local Durable Object runtime. A fake sign-in provider stands in for Sign in with Apple in development and tests.

## Order of delivery

Each line is one feature folder under `docs/features/`, built and shipped through the harness before the next starts.

1. `task-core`: the task and project rules in `libs/core`, with the enums in `libs/types`.
2. `project-store`: the Worker, the D1 directory, one Durable Object with SQLite per project, routing from a credential, and the isolation suite.
3. `mcp-server`: keys, the five tools, the prompt, compact output, end-to-end tests with a real MCP client.
4. `owner-api`: sign-in (Sign in with Apple, faked in development), workspaces, projects, tasks, the change feed and the "changed" WebSocket.
5. `mac-app-shell`: the XcodeGen project and the main window against the local API.
6. `mac-sync`: the local cache, the offline queue and the pull loop.
7. `menu-bar`: the menu bar extra.
8. `widgets`: the four widgets and the completing App Intent.
9. `connect-an-agent`: the key screen in the app.
10. `v1-walk`: a scenario that walks the whole v1 from an empty workspace to tasks added by an agent and completed in a widget.

## Calls made without the owner

The owner may overturn any of these; until then they stand.

- Each workspace starts with an Inbox project, and that is what the Inbox view shows.
- A bearer key per project instead of OAuth, so v1 works in Claude Code, Codex and Cursor but not as a claude.ai connector.
- Sign in with Apple for the app, since v1 is macOS only. Until the paid Apple Developer membership exists, it sits behind the sign-in port and development builds use the fake provider.
- Last write wins per field for sync conflicts.
- macOS 14 as the floor.

## Owner prerequisites

- **Xcode** installed from the App Store, for the macOS features (5 onward), with the owner's Apple ID added in Xcode so builds sign with the free Personal Team. The App Group identifier carries the Team ID prefix, which a Personal Team can use on macOS.
- **XcodeGen** installed with Homebrew.
- **The paid Apple Developer membership waits until the owner decides to publish**, probably under Logic Bit. v1 is done without it: the real Sign in with Apple, a Developer ID signature and notarization belong to publishing, not to v1.
- Cloudflare is needed only for a deploy, which v1 does not include.
