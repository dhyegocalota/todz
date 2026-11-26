# 0076. An account with several workspaces and no remembered choice opens a picker of names and project counts

- Status: Accepted
- Date: 2026-11-26
- Deciders: Dhyego Calota (owner); Claude (advisor, the loop's call under "Tonight's last three")
- Inspired by: `todz-loop/PROMPT.md` "Tonight's last three", item 2 (`workspace-select`)

## Context

Signing in lists the account's workspaces. Today the app enters the first one without asking, and the choice made on this Mac (`OwnerCache.activeWorkspaceIdentifier`) is already kept per owner. A new Mac or a fresh sign-in has no remembered choice, so the owner cannot pick which workspace opens. The owner wants a picker with the name, the project count and the last activity.

The list endpoint returns workspaces and their projects from D1. Tasks live in per-project Durable Objects, so the last activity of a workspace is not in D1 today.

## Decision

1. A new app phase `choosing` is entered after a listing when the account has two or more workspaces and none is remembered for this Mac. One workspace still opens directly, and an account with none still gets the naming screen.
2. The picker lists each workspace with its name and project count, and a "New Workspace…" button that reuses the existing name sheet. Choosing a row activates it with the same flow as a switch.
3. The remembered choice is unchanged: the owner cache keeps the active workspace per owner on this Mac.
4. The Settings window lists every workspace in its own view file and switches on tap. The Workspace menu keeps its ⌘1–9 list.
5. The list does not change on the server, so this ships without a deploy.
6. Last activity is not shown in v1.1 of this feature. It is a named follow-up.

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| Show last activity now, as a `workspaces.last_activity_at` column written from the project store's change path, throttled per project through `waitUntil` | Complete picker as specified | A D1 migration, a write on the task hot path, and production already misses its p95 budget | Rejected tonight: the migration and the extra write on the hot path are a risk while the performance lane is open |
| Fan out to every project store on listing to read each last change | No migration | Unbounded reads per list call, one per project | Violates the bounded-per-owner rule |
| Auto-enter the first workspace (today) | No UI | The owner cannot choose on a new Mac | Does not meet the request |
| Picker on every launch | Always explicit | Slow daily path | Breaks the remembered choice |

## Consequences

- No server or schema change, so no deploy is needed for this feature.
- The picker shows name and project count only. Last activity is a v1.1 follow-up that needs the server change in the rejected row, with its own migration and deploy.
- A new phase needs exhaustive handling in the widget snapshot, the shortcut readiness, the menu bar popover and the sign-in link check.

## Evidence

- `apps/macos/TodzKit/Sources/TodzKit/AppModel+Workspaces.swift` `openListedWorkspaces`: the first workspace was entered without a picker.
- `apps/macos/TodzKit/Sources/TodzKit/AppModel+Cache.swift` `openCache`: the remembered workspace is restored from the cache.
- `apps/api/src/owner-workspaces.ts` `listWorkspaces`: the listing carries no activity field.

## Revisit when

The owner asks for last activity in the picker, or the performance lane gives the task write path a budget that allows a throttled workspace activity write.
