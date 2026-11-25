# Agent nudge

**Status:** Approved
**Tier:** 🔴 (a schema migration, the owner API's body, MCP output, a new app control)
**Owner approval:** approved 2026-11-25 by the owner's request to the loop (2026-11-24, ~20:30: "1,4,5,6,7,9,10 e também 11 … seja criativo, add no cron e só para quando tiver pronto"; every item "features opcionais", off by default, no push notifications), recorded in `todz-loop/STATE.md` "Owner requirements queued" → `proactive-day` item 1. The behaviour is the loop's call in [ADR 0053](../../adr/0053-agents-mention-today-s-tasks-in-next-when-the-owner-turns-it-on.md).
**ADRs:** [0053](../../adr/0053-agents-mention-today-s-tasks-in-next-when-the-owner-turns-it-on.md), [0011](../../adr/0011-due-dates-are-calendar-dates-and-the-caller-names-today.md), [0013](../../adr/0013-a-project-is-reached-only-through-the-directory.md), [0016](../../adr/0016-the-mcp-server-runs-on-the-sdk-v2-and-serves-both-protocol-eras.md), [0018](../../adr/0018-the-mcp-server-reads-today-in-the-owner-s-time-zone.md), [0036](../../adr/0036-the-menu-bar-icon-counts-today-s-open-tasks-behind-a-setting.md)
**Not changing:** `list`, `add`, `update`, `done`; the menu bar count and its local setting; widgets; the site

## Problem

An agent opening a project does not know the owner has tasks due there today. The owner wants the agent to say so, when he turns it on.

## Goals

- A Settings toggle "Let agents mention today's tasks", off by default, stored on the owner's account.
- With it on, `next` (prompt and tool) in a project with open tasks due today or overdue starts with one line: "Today here: 2 due (1 overdue). Start with T-12?" (the overdue part only when there are overdue tasks), naming the task `next` picks.
- With it off, or nothing due, `next` answers exactly as today.
- The line never names another project's task and quotes no task title.

## Non-goals

- Once-per-session nudges, nudges on other tools, push notifications, per-project switches.

## Design

### Data flow

```
app Settings toggle → PATCH /owner {agent_nudge: true}  (partial body; time_zone optional)
                    ← {owner: {id, time_zone, agent_nudge}}   (GET /owner and sign-in answer it too)

MCP request → findKeyProject (joins owners: time_zone, agent_nudge)
  next prompt / next tool, flag on → project.dueNow({today}) → {count, overdue}
      count > 0 → MCP_COPY.agentNudge({count, overdue, taskId}) + blank line + the usual answer
      count = 0, flag off, or dueNow fails → the usual answer
```

### Interfaces

- Migration `0007_agent_nudge.sql`: the column of ADR 0053 §1.
- Directory: `OwnerRow`/`OwnerRecord`/`ownerJson` gain `agentNudge` (`agent_nudge` in JSON); `findKeyProject`/`KeyProject` gain `agentNudge`; `updateOwner` takes a partial body validated by zod (`time_zone` optional, `agent_nudge` optional boolean, at least one).
- Project store: a `dueNow({ today })` RPC returning `{ count, overdue }` from the core's due windows; the line names the task the same `next` answer shows (plan review R3).
- MCP: the scope gains `agentNudge`; `nextPromptText` and `nextAnswer` take an optional nudge line; copy in `mcp-copy.ts`.
- macOS: `Owner.agentNudge`; `OwnerService.updateOwner` with a partial body; the Settings scene receives the model; a second `Toggle` with copy in `SettingsCopy.swift`, disabled offline.

### Failure handling

| Case | Effect |
|---|---|
| flag off | `next` unchanged |
| nothing due | `next` unchanged |
| `dueNow` fails | `next` unchanged |
| PATCH with `{}` or a non-boolean | 400 `invalid_request` |
| PATCH while offline in the app | the toggle is disabled; no write is queued |

### Rollback

`wrangler rollback`; the column stays and an older version never reads it. The app's toggle then writes a field the older server rejects (400), which the app shows as a failed save.

## Open questions → answers

| Question | Options | Owner's answer | Date |
|----------|---------|----------------|------|
| When does the agent hear it? | every `next`; once per session; `instructions` | the loop's call: every `next` (ADR 0053 §3) | 2026-11-25 |
| Overdue included? | yes; literal today | the loop's call: yes (§4) | 2026-11-25 |
| Scope of the switch | per owner; per project | the loop's call: per owner (§1) | 2026-11-25 |

## Test strategy summary

Unit and Workers tests for the migration default, the partial PATCH, `findKeyProject`, `dueNow`, the copy and both eras' `next` with the flag off (every pinned text unchanged) and on (the line), isolation (project A never mentions B), and the failure fallback. Swift tests for `OwnerAPI`, `AppModel` and the toggle's offline state. A walk with Claude Code against a local server, and screenshots of the Settings window and an agent's `next` for the PR and the README.
