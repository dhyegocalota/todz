# Connect an agent

**Status:** Approved
**Tier:** 🟡
**Owner approval:** approved 2026-11-24, by inheritance from [the v1 product design](../../product/README.md) (Order of delivery, item 9; macOS app → "Connect an agent: copy a ready command for Claude Code, Codex or Cursor, the server URL, the tool list, and the keys of the selected project with Revoke"; MCP server → a bearer key per project, shown once, stored as a digest), approved by the owner on 2026-11-23. The calls below that the product design does not make are an ADR or design decisions marked as the loop's calls and listed in the loop's questions for the owner
**ADRs:** [0019](../../adr/0019-mcp-keys-are-prefixed-and-shown-once.md), [0022](../../adr/0022-the-owner-api-is-json-routes-and-the-app-builds-the-cross-project-views.md), [0024](../../adr/0024-the-macos-app-is-an-xcodegen-project-over-a-local-swift-package.md), [0034](../../adr/0034-the-key-screen-shows-a-new-key-once-inside-each-client-s-command.md)
**Not changing:** `apps/api` and its key routes (`ListKeys`, `IssueKey`, `RevokeKey` exist since `owner-api`), `libs/core`, `libs/types`, the MCP server and its tools, the cache and outbox, the widgets and the menu bar. A key's secret is never stored by the app, never logged, never written to the cache or the shared widget folder.

## Problem

An agent works a project's tasks only with that project's MCP key, and the owner API can issue, list and revoke keys, but the app has no way to do any of it. Today the owner cannot connect Claude Code, Codex or Cursor to todz without calling the API by hand.

## Goals

- "Connect an agent" at the bottom of the main window's sidebar opens the key screen for one project of the active workspace: the project the owner had selected, else the Inbox, with a picker to change it.
- The screen shows the MCP server URL (the app's API base URL plus `/mcp`) with Copy, the five tools an agent gets (`next`, `add`, `list`, `update`, `done`) with one line each, and the project's unrevoked keys (the last four characters and the creation date), each with "Revoke" behind a confirmation.
- "Create a key" issues a key for the project and shows its secret once, inside a ready command for Claude Code and for Codex, and an "Add to Cursor" link, each with Copy (ADR 0034). Leaving the project or the screen forgets the secret; the list then shows the key by its last four characters only.
- Revoking a key removes it from the list; an agent using it gets "not found" from then on (the server already does this).
- Every failure is shown on the screen in the app's own words, and nothing is retried silently.

## Non-goals

- Naming a key after its client, "last used", or keys per workspace (the mockup's columns): the API has neither, and the product design keys a project.
- OAuth, a claude.ai connector, or any client but the three.
- Editing a client's configuration files from the app.
- Issuing or revoking keys from the menu bar or the widgets, or offline: keys need the server.
- Showing a key's secret again after it was shown.

## Design

Screens, states and copy: [`design.md`](design.md).

### Data flow

```
sidebar "Connect an agent" ─▶ AppModel.selectedItem = .connectAgent
   ─▶ KeyScreen(project = the selected project, else the Inbox)
   ─▶ AppModel.loadKeys(project) ─▶ OwnerAPI.listKeys ─▶ [ProjectKey { identifier, hint, createdAt }]

"Create a key" ─▶ OwnerAPI.issueKey(project) ─▶ { key, secret }
   ─▶ list += key; IssuedKey(secret) held in memory by the screen only
   ─▶ AgentCommand.claudeCode / .codex / .cursorLink(url, secret) ─▶ Copy (NSPasteboard) or open the Cursor link

"Revoke" ─▶ confirm ─▶ OwnerAPI.revokeKey(project, key) ─▶ 204 ─▶ list −= key (and the shown secret, if it was that key's)
```

### Interfaces

`TodzKit` gains: `ProjectKey` (`Codable`: `id`, `hint`, `created_at`), `IssuedKey` (`key`, `secret`), three `OwnerService` calls on the existing routes, `AgentCommand` (pure: the server URL and a secret in, each client's command or link out), `SidebarItem.connectAgent`, and the `AppModel` state for the screen: the keys of the shown project with their load phase, the issued secret, and the actions. The app target gains the screen and its copy in `apps/macos/Copy`.

### Failure handling

- **Listing fails** (offline, 5xx) → the screen shows the error with "Try again"; the URL, tools and commands stay usable.
- **Issuing fails** → no secret is shown and the error says the key was not created; a retry creates a new key, never shows an old one.
- **Revoking answers 404** (already revoked, another device) → the key leaves the list without an error.
- **The session ends (401)** → the app's existing sign-out path; the secret is gone with the screen.
- **The project is removed or the workspace switched while the screen is open** → the screen follows the new active workspace's Inbox and forgets the secret.
- **Logs:** nothing about keys.

## Open questions → answers

| Question | Options | Owner's answer | Date |
|----------|---------|----------------|------|
| How does a client get the key, given it is shown once? | the secret inside each client's command at creation / a key field the owner pastes into a template / the app edits the client's config | Loop's call: [ADR 0034](../../adr/0034-the-key-screen-shows-a-new-key-once-inside-each-client-s-command.md); listed for the owner | 2026-11-24 |
| Which project does the screen show? | the selected project, else the Inbox, with a picker / always the Inbox / the whole workspace | Loop's call: the selected project, else the Inbox, with a picker (the product design says "the selected project") | 2026-11-24 |
| The design's open choices | see [`design.md`](design.md) | Loop's calls: the designer's recommendations, recorded in `design.md` § 7; listed for the owner | 2026-11-24 |

## Rollback

Nothing is deployed. Reverting the merge removes the screen; keys issued through it stay valid on the server until revoked.

## Test strategy summary

Swift Testing in `TodzKit`: `ProjectKey` decoding, the three `OwnerAPI` calls against `StubURLProtocol` (paths, methods, bodies, errors), `AgentCommand` for each client with a fixed URL and secret (exact strings, shell quoting, the Cursor link's encoded config), and `AppModel`'s screen state over the fake service: load, issue (the secret held once and forgotten on leaving), revoke (including 404), failures, a workspace switch. The tester walks the screen in the real app against `wrangler dev`, creates a key, runs the copied Claude Code command in a throwaway folder, connects, sees the tools, revokes, sees the agent refused, and removes the server from Claude Code again.
