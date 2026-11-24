---
name: v1-walk
title: From an empty workspace to tasks an agent added and the owner completed
authors: 2
paths:
  - "apps/macos/**"
  - "apps/api/src/**"
  - "libs/core/src/**"
  - "libs/types/src/**"
---

# v1 walk

The whole of todz v1 in one run: the owner signs in to an empty Mac, names a workspace, creates a project, connects an agent with a key from the app, the agent adds and completes tasks through MCP, and the owner sees every change in the main window, the menu bar and the widget snapshot. Author A is the owner in the macOS app; author B is the agent, an MCP client ([ADR 0037](../adr/0037-the-v1-scenario-walks-the-native-app-with-computer-use-and-the-agent-with-an-mcp-client.md)).

## Setup

- Surface: macOS app. A is driven with Orca computer use (ADR 0026); B is an MCP client from `@modelcontextprotocol/client`, written in the scratchpad, with `clientInfo.name` "Claude Code".
- Save the owner's session file, `~/Library/Containers/dev.todz.Todz/Data/Library/Application Support/session` (its `shasum`), then remove it so the app starts signed out. Restore it byte-identical at the end.
- Boot: from `apps/api`, `pnpm exec wrangler d1 migrations apply directory --local --persist-to <scratch>` then `pnpm exec wrangler dev --var SIGN_IN_PROVIDER:fake --port 8787 --persist-to <scratch>`. Port 8787 must be free.
- Build and launch the app (`pnpm verify all` builds it into `apps/macos/build`), hidden where a step allows.
- Fictional data only: workspace "Acme", project "Launch", tasks named like "Draft the release notes".

## Tests

### T1 Sign in to an empty Mac

A types `maria.example` in the identity field and signs in with the fake provider.

- Expect: the app asks for the first workspace's name.

### T2 Name the first workspace

A names it "Acme".

- Expect: the main window shows Acme with an empty Inbox, and the menu bar item shows the icon only.

### T3 Create a project

A adds the project "Launch" from the sidebar.

- Expect: "Launch" is listed under Projects, empty.

### T4 Create a key for the project

A opens Connect an Agent, picks "Launch", presses Create a Key and copies the Claude Code command.

- Expect: the command holds a `todz_` secret once, the key is listed by its last four characters, and leaving the screen hides the secret.

### T5 The agent connects

B connects to `http://localhost:8787/mcp` with the copied key as a bearer token and lists its tools and prompts.

- Expect: the tools are `next`, `add`, `list`, `update`, `done` and the prompt `next`; no tool takes a project or workspace argument.

### T6 The agent adds tasks

B calls `add` with three tasks: "Draft the release notes" due today, "Review the onboarding copy" due today, "Plan the beta invite" due tomorrow, each with an `idempotency_key`, then repeats the same call.

- Expect: the app shows the three tasks in Launch within seconds without a refresh, the repeat adds nothing, and the inspector's history says each was added "via Claude Code".

### T7 Today and the menu bar

A opens Today.

- Expect: Today lists the two tasks due today, Upcoming lists "Plan the beta invite", and the menu bar item shows "2" next to its icon.

### T8 The widget snapshot

After T7, read the widget snapshot the app wrote, with `stat -f %Lp` for its mode.

- Expect: `widget-snapshot.json` in the App Group container lists the two tasks due today for Acme, at mode 600.

### T9 The owner completes a task

A ticks "Review the onboarding copy" in Today.

- Expect: it moves to "Done today", the menu bar item shows "1", and B's `list` of open tasks no longer has it.

### T10 The agent asks what is next and completes it

B calls `next` (after T9 only "Draft the release notes" is open today), then `done` on that task with the note "Notes drafted in the release doc".

- Expect: `next` answers "Draft the release notes", and the app shows it done with the note in its history, via Claude Code; the menu bar item shows the icon only.

### T11 The key reaches one project only

A adds "Buy a domain" to the Inbox; it is the Inbox's `T-1`. B calls `list` once with `state` open and once with `state` done, each with `text` "domain", then `update` on `T-99`, a number above Launch's highest, then `update` on `T-1` with a new title.

- Expect: neither `list` shows the Inbox task; `T-99` answers "not found", the same as an id that never existed; and `T-1` changes Launch's own first task, never the Inbox's, because a short id only ever names a task of the key's project.

### T12 Revoke the key

A revokes the key in Connect an Agent.

- Expect: B's next call on its existing MCP session is refused with 401, and the app no longer lists the key.

### T13 Offline and back

Stop `wrangler dev`; A adds "Ship the changelog" to Launch in the app, then start the server again.

- Expect: the toolbar shows "Offline" with one change waiting and the add as a pending row, and once the server is back the task is sent and shown as a normal row.

### T14 A widget tick (owner's desktop)

A places the medium todz widget on the desktop and ticks "Ship the changelog".

- Expect: the task is done in the app within seconds; without the owner's OK to place a widget, this test is BLOCKED and stays on the Human checklist.

## Edge cases to hunt during the run

- B adds a task with a title of 500 characters and Markdown notes; the app wraps it and the menu bar count stays right.
- B calls `done` on an already done task; the answer says so and nothing changes twice.
- A signs out mid-walk and signs in again; Acme, Launch and the tasks come back from the server.
- A switches to a second workspace with ⌘2 from the popover; the count follows the active workspace.
- The app quits while B adds; on relaunch the tasks are there.
