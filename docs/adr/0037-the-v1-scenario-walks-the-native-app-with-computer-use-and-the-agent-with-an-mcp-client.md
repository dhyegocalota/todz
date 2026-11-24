# 0037. The v1 scenario walks the native app with computer use and the agent with an MCP client

- Status: Proposed
- Date: 2026-11-24
- Deciders: Claude (the build loop's call, pending the owner); Dhyego Calota (owner) may overturn it
- Inspired by: [ADR 0003](0003-agentic-scenario-runs-with-one-browser-per-user.md), [ADR 0026](0026-a-native-app-is-walked-with-computer-use-and-recorded-from-its-screenshots.md), the product design's Order of delivery item 10 (`v1-walk`)

## Context

ADR 0003 runs scenarios in browsers, one Playwright MCP server per user. todz v1 has no web app: the owner works in a native macOS app and an agent works through the MCP server. The v1 walk must go from an empty workspace to tasks an agent added and the owner completed, without a person at the keyboard and without spending on an LLM. The app reads its API from `http://localhost:8787` and keeps the owner's session in its container.

## Decision

1. A scenario whose `## Setup` says `Surface: macOS app` drives the owner with Orca computer use, as ADR 0026 walks the app, and each agent with a real MCP client from `@modelcontextprotocol/client` that connects with the key the owner copied from the app. The client sends `clientInfo.name` "Claude Code", so the app shows what a real agent's change shows. `authors` counts the owner and the agents.
2. The stack is `wrangler dev` on port 8787 with the fake sign-in provider and a fresh local state folder in the scratchpad. The owner's real session file is saved before the run and restored byte-identical after, as every tester does.
3. The agent's client is written for the run in the scratchpad and never committed; the scenario names every call it makes, so any run is the same walk.
4. A step that needs the owner's desktop, such as ticking a placed widget, is BLOCKED in an unattended run and becomes a line in the PR's Human checklist. The agent's `done` stands in for it in the walk, and the widget's own intake stays proven by the `widgets` test plan.

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| Computer use for the app, an MCP client for the agent (chosen) | real app, real server, real protocol; free and repeatable | the agent is a script, not a model | the scenario tests the product, not a model |
| A real Claude Code session as the agent (`claude -p`) | the true client | costs tokens per run; not deterministic | spend and flakiness for no extra proof of todz |
| Skip the app, walk only the API | fast | proves nothing the owner sees | v1 is the app |
| Wait for the owner to tick a widget | the full walk | the loop runs unattended | the widget step is on the Human checklist instead |

## Consequences

- `/scenario` reads `Surface:` in `## Setup` and, for the macOS app, uses Orca and an MCP client instead of Playwright servers.
- The scenario's screenshots and video follow ADR 0026.

## Evidence

The `connect-an-agent` tester connected a copied Claude Code command to `wrangler dev` and saw the MCP answer 200, then 401 after a revoke (PR #11). The `mac-sync` tester saw an MCP add appear live in the app (PR #8).

## Revisit when

todz gains a web app, or a model-driven agent run becomes free and deterministic enough to gate on.
