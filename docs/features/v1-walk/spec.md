# The v1 walk

**Status:** Shipped 2026-11-24
**Tier:** 🟡
**Owner approval:** approved 2026-11-24, by inheritance from [the v1 product design](../../product/README.md) (Order of delivery, item 10: "a scenario that walks the whole v1 from an empty workspace to tasks added by an agent and completed in a widget"), approved by the owner on 2026-11-23. How a native app's scenario runs is [ADR 0037](../../adr/0037-the-v1-scenario-walks-the-native-app-with-computer-use-and-the-agent-with-an-mcp-client.md), the loop's call, listed in the loop's questions for the owner
**ADRs:** [0037](../../adr/0037-the-v1-scenario-walks-the-native-app-with-computer-use-and-the-agent-with-an-mcp-client.md), [0003](../../adr/0003-agentic-scenario-runs-with-one-browser-per-user.md), [0026](../../adr/0026-a-native-app-is-walked-with-computer-use-and-recorded-from-its-screenshots.md)
**Not changing:** product code, unless the run finds a defect (then a fix with a regression test, in its own folder)

## Problem

Each feature proved itself in its own test plan. Nothing yet walks v1 end to end as one story: an empty Mac, a workspace, a project, a key, an agent adding and completing tasks, and the owner seeing it all in the app, the menu bar and the widgets.

## Goals

- `docs/scenarios/v1-walk.md`: the whole v1 walk, 14 tests with one `Expect` each, and the edge cases to hunt.
- The `/scenario` skill runs a scenario whose `## Setup` says `Surface: macOS app` with Orca and an MCP client (ADR 0037).
- One run of it, with its report table copied into this feature's test plan, screenshots and a video for the PR, and the README walk gaining the shots the run produces that it lacks.

## Non-goals

- A model-driven agent: the agent is an MCP client script.
- Placing a widget without the owner: T14 is BLOCKED in an unattended run.

## Design

### Data flow

```
Orca ──▶ todz.app ──▶ wrangler dev :8787 ◀── MCP client (Bearer key copied from the app)
             │                 │
             ▼                 ▼
   App Group snapshot    D1 directory + one Durable Object per project
```

### Interfaces

- `docs/scenarios/v1-walk.md` (front matter `name`, `title`, `authors: 2`, `paths`).
- `.agents/skills/scenario/SKILL.md`: one paragraph for `Surface: macOS app`.

### Failure handling

A FAIL in the run is a defect: it goes to Build as a fix with a regression test, never an inline change during the run.

## Open questions → answers

| Question | Options | Owner's answer | Date |
|----------|---------|----------------|------|
| How does a scenario drive a native app and an agent? | Orca plus an MCP client / a real Claude Code session / API only | Loop's call (ADR 0037): Orca plus an MCP client | 2026-11-24 |
| "Completed in a widget" without the owner | BLOCKED with the agent's `done` standing in / wait for the owner | Loop's call (ADR 0037): BLOCKED, on the Human checklist | 2026-11-24 |

## Test strategy summary

`scenarios.test.ts` checks the file's shape and the index. The run itself is the test: every `Expect` asserted on what the app shows (accessibility tree and screenshot) and what the MCP client receives, with a report under `.pr-media/scenario-v1-walk/`.
