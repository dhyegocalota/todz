# Tester briefing: MCP full toolset

## What changed

- `apps/api/src/mcp-server.ts` — task tools register once for a project access or an owner access.
- `apps/api/src/mcp-owner-server.ts` — registers the task tools with `openOwnedGrantProject`.
- `apps/api/src/mcp-annotations.ts` — the annotations of every tool.

## How to run

`pnpm exec vitest run test/mcp-full-toolset.test.ts` in `apps/api`.

## Red today, green after

| Test | Red before the change because | Green after because |
|------|--------------------------------|---------------------|
| `mcp-full-toolset.test.ts` | the owner server listed nine tools and no tool had a title | the owner server serves the task tools and every tool is annotated |

## Hypotheses

- A project of another owner is indistinguishable from an unknown project on every task tool.

## Gaps

- The OAuth walk in a real client is the lead's, after the 0.2.8 deploy.
