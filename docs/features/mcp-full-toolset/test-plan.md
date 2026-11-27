# Test plan: MCP full toolset

## The failing test first

- [ ] `apps/api/test/mcp-full-toolset.test.ts` — input: an owner grant lists tools; expected: the nine account tools and nine task tools, each with annotations.

## Unit

- [ ] `mcp-full-toolset.test.ts::adds, lists and completes a task` — input: add, list, done with the owner's own project; expected: each succeeds.
- [ ] `mcp-full-toolset.test.ts::the %s tool on a project of another owner` — input: each task tool naming another owner's project; expected: the answer equals the one for an unknown project.
- [ ] `mcp-full-toolset.test.ts::the %s tool without a project is refused` — input: no `project`; expected: an error.
- [ ] `mcp-full-toolset.test.ts::the daily write budget applies` — input: an exhausted budget; expected: an error with the limit.

## Prove it for real

- [ ] OAuth walk in a real client with an owner-scope grant: expected: the full list and one task added.
