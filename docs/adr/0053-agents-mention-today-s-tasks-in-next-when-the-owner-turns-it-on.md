# 0053. Agents mention today's tasks in `next` when the owner turns it on

- Status: Accepted (the build loop's call, the owner may overturn it); amended by [0068](0068-one-respect-focus-switch-decides-for-every-proactive-surface-and-untouched-settings-follow-the-defaults.md) (§1 on by default, and a choice time tells the owner's choice from the default); amends the product design's v1 non-goal "reminders, notifications" for this one opt-in nudge, and [0036](0036-the-menu-bar-icon-counts-today-s-open-tasks-behind-a-setting.md)'s Settings window gains its second control
- Date: 2026-11-25
- Deciders: Claude (the build loop's call, pending the owner); Dhyego Calota (owner) chose this idea from the loop's list ("1,4,5,6,7,9,10 e também 11 … seja criativo") and required every item to be "features opcionais", off by default, with no push notifications
- Inspired by: the run-15 research in `todz-loop/notes/agent-nudge-research.md`, [ADR 0011](0011-due-dates-are-calendar-dates-and-the-caller-names-today.md), [ADR 0013](0013-a-project-is-reached-only-through-the-directory.md), [ADR 0016](0016-the-mcp-server-runs-on-the-sdk-v2-and-serves-both-protocol-eras.md), [ADR 0018](0018-the-mcp-server-reads-today-in-the-owner-s-time-zone.md)

## Context

The owner wants the agent, not the app, to remind him: when an agent starts on a project, it should say "2 tasks here for today; start with T-12?". The agent speaks through the MCP server, so the setting must live where the server reads it. The server keeps no per-session state: the 2025 era has an `initialize` row with no mutable fields, the 2026 era has no session at all, and every request builds a fresh server (ADR 0016). "The first answer of a session" therefore cannot be detected without new state.

## Decision

1. **One owner setting, off by default.** `owners.agent_nudge INTEGER NOT NULL DEFAULT 0 CHECK (agent_nudge IN (0, 1))` in migration 0007. It applies to every project and key of that owner. Later proactive items that the server must read get their own columns; app-only items stay in the app. *Amended on 2026-11-25 by [ADR 0068](0068-one-respect-focus-switch-decides-for-every-proactive-surface-and-untouched-settings-follow-the-defaults.md):* the flag is on by default. A new owner's row names it from `AGENT_NUDGE_BY_DEFAULT`; `owners.agent_nudge_chosen_at` is stamped by every `PATCH` that names the flag, migration 0009 stamped every row already on, and migration 0010 turned the flag on for every row without a stamp.
2. **It reaches the server through the key lookup.** `findKeyProject` already joins `owners` for the time zone; it also returns the flag, so no request makes a second query.
3. **It speaks in `next`, every time.** When the flag is on and the project has open tasks due today or overdue, the `next` prompt and the `next` tool's answer start with one server line: "Today here: N due (M overdue). Start with T-12?", naming the task `next` would pick. Nothing is added at zero, nothing is added to `list`, `add`, `update` or `done`, and no task title is quoted, so no text of a task's author reaches the line.
4. **Overdue counts.** "Due today" includes overdue, as `nextTask` ranks them together and the menu bar count does (ADR 0036).
5. **Two reads.** `next` reads the task, then the project store answers `{count, overdue}` for the day; the line names the task of the same answer. A write between the two reads can leave the count off by that write or name a task the count no longer holds: accepted, because the window is one round trip, the line stays inside the key's project and nothing is written. If the count fails, the nudge is left out and `next` answers as before.
6. **The app owns the toggle.** The Settings window gains "Let agents mention today's tasks", read from `GET /owner` and written by a partial `PATCH /owner` (every field optional, at least one). The server is the source of truth; offline, the toggle shows its last known value and is disabled.

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| `next` prompt and tool, every call (chosen) | no new state; both eras | repeats on every `next` | one line, only when something is due |
| Once per session | quieter | needs state the 2026 era cannot key | not buildable without a session id |
| In the server `instructions` | read at connect | 2025 era only, unproven for 2026; static text clients may drop | unreliable |
| On every tool's answer | always seen | tokens on every call; noise on writes | too loud |
| Per project or per key | finer | a setting per project in the app | the owner asked for one switch |
| Literal "today" only | matches the words | an overdue task is more urgent and would be silent | weaker nudge |

## Consequences

- A schema migration and a change to the owner API's PATCH body, which the app's `OwnerService` and its fakes follow.
- With the flag off, every pinned MCP text stays byte for byte the same.
- The nudge never crosses a project: it reads only the key's own project store.

## Revisit when

The owner wants a once-per-session nudge (then a per-key "last nudged" instant), or a nudge on more tools.
