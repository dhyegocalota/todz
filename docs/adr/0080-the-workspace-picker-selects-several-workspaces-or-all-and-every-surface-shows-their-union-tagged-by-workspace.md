# 0080. The workspace picker selects several workspaces or All, and every surface shows their union tagged by workspace

- Status: Accepted
- Date: 2026-11-26
- Deciders: Dhyego Calota (owner); Claude (advisor, the loop's call under "Workspaces, more")
- Inspired by: the owner's 2026-11-26 request, "posso selecionar múltiplos workspaces pra aparecer?", and `todz-loop/PROMPT.md` "Workspaces, more"; follows [0076](0076-an-account-with-several-workspaces-and-no-remembered-choice-opens-a-picker-of-names-and-project-counts.md)

## Context

The app shows exactly one workspace at a time: `activeWorkspaceIdentifier` decides the projects, the board, the pulls, the watches, the widget snapshot and the menu bar count. The owner wants to see several workspaces at once, or all of them.

The owner API already lists every workspace with its projects, and each project store is addressed by project identifier, so nothing a union needs is missing on the server.

## Decision

1. **No server change.** The union is built in the app. Nothing deploys.
2. **Selection model.** `WorkspaceSelection` is `.all` or `.chosen(Set<workspace identifier>)`. `.all` is its own case, so a workspace created later joins it; a chosen set never grows by itself. The shown workspaces are the selection resolved against the listing, in listing order. A selection never resolves to nothing: toggling off the last chosen workspace keeps it.
3. **Primary workspace.** `activeWorkspaceIdentifier` stays and means the primary shown workspace: the previous one when still shown, else the first. It takes what names no project (an add from the menu bar, a shortcut or the day close; a new project; the Connect an Agent keys). Writes to a task go to the task's own project.
4. **Persistence per Mac.** `OwnerCache` gains an optional `selection`. It is written only when it is not the single primary workspace, so a single selection keeps today's cache bytes and an old cache reads as `.chosen([active])`.
5. **Union and liveness.** `TaskViews` takes the projects of every shown workspace, in listing order, so Today, Upcoming, Inbox and Done are one sorted list across them, and Inbox is the inboxes of every shown workspace. The model pulls and watches every project of every shown workspace; a pull or a change-feed signal arrives per project as today. A change of the shown set resets the board and reloads from the cache and the feed, exactly as a workspace switch does today. The single select-workspace API (`switchWorkspace`) selects exactly one workspace, so the keyboard shortcuts keep working.
6. **Row tag.** With two or more shown workspaces each `BoardTask` carries its workspace name; the main window and the popover show it before the project name ("Acme · Launch"). With one shown workspace nothing is tagged.
7. **Widget snapshot.** `WidgetSnapshotTask` gains the workspace identifier and name; both are optional on decode, so a snapshot written by an older app still decodes and the app rewrites it at launch. `WidgetSnapshot.workspaceName` joins the shown names. With two or more workspaces the project tag a widget draws is "Workspace · Project".
8. **Tick routing.** A `WidgetRequest` carries the workspace identifier of the row. The app takes it only when the task is in the current union Today and the task's own project belongs to the named workspace (a request without one, from an older widget, is routed by project alone). A task of an unknown, foreign or no longer shown workspace is dropped, as a forged request is today. The completion goes to the task's own project through the outbox.
9. **Picker.** The workspace menu becomes a list of toggles with "All Workspaces" first. The first-run picker (0076) keeps choosing one workspace; it gains no All row in this change.

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| A server-side union endpoint | One call | A new route, schema and deploy for data the app already holds | The app already lists every workspace and pulls per project |
| Store "All" as the full set of identifiers | One case | A workspace created later would not join it | The owner expects All to include it |
| Tag by colour instead of name | Compact | Workspaces have no colour; colours need a design choice | Names are available now; colour is a later design call |
| Keep the board across selection changes | Fewer reloads | Left projects need cache and outbox handling on every toggle | A reload from the cache reuses the proven switch path |

## Consequences

- A selection change reloads the board from the cache and re-pulls, as a switch does.
- Many projects mean many watched sockets; the bounded-per-owner budgets of the sync ADRs apply per project and are unchanged.
- The popover's workspace-number shortcuts select exactly one workspace.
- The morning glance and the ribbon read the union through the same model; the glance's workspace identity is the primary workspace.

## Evidence

- `apps/macos/TodzKit/Sources/TodzKit/WorkspaceSelection.swift`, `AppModel+Workspaces.swift` `show`, `AppModel+Widgets.swift` `take`.
- `apps/macos/TodzKit/Tests/TodzKitTests/AppModelTests+MultiWorkspace.swift`, `WorkspaceSelectionTests.swift`.

## Revisit when

The owner wants a colour per workspace, a per-workspace add destination in the union, or a first-run picker that offers All.
