# MCP full toolset: plan

- [x] 1. Red tests: `apps/api/test/mcp-full-toolset.test.ts`. (bd5741ff)
- [x] 2. Annotations from one effect per tool: `mcp-annotations.ts`, titles in `MCP_COPY`.
- [x] 3. Task tools registered on both servers through one access type, with `openOwnedGrantProject` on the owner server.
- [x] 4. Docs: `apps/docs/mcp-tools.mdx`, `connect-an-agent.mdx`, the consent warning, ADR 0115 and the reference shape test.

| Step | What breaks | Signal | Back out |
|------|-------------|--------|----------|
| 3 | A project grant lists a different tool set | `mcp-full-toolset.test.ts` project list | Revert the PR; no data changes |
