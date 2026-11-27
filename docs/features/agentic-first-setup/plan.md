# Plan: agentic-first setup

Steps are checked off by the developer as each commit lands. Red commits come first.

## Steps

- [x] 1. Red: the shape tests for the prompts, their addresses and the collapsed sections.
- [ ] 2. ADR 0124, this folder and the two runbooks, with the runbooks index.
- [ ] 3. The prompt and the collapsed section in the README, the contributing guide, `apps/docs/self-host.mdx` and its seven twins.
- [ ] 4. The existing self-host tests allow the accordion tags and the prompt line; the full set and the docs checks run green.
- [ ] 5. The walk: the development runbook in a scratch worktree, the self-host runbook up to its first login.
- [ ] 6. Flip the spec and the index to Shipped; open the PR.

## File ownership

One developer owns `docs/`, `README.md`, `.github/CONTRIBUTING.md`, `apps/docs/` and `tools/repository-shape/`.

## Failure modes

| Step | What breaks | Signal | Backout |
|------|-------------|--------|---------|
| 3 | `mint` rejects headings inside an accordion | `pnpm --filter @todz/docs validate` fails | Move the headings out of the accordion and keep the prompt |
| 3 | A twin drifts from English | The twins tests of `docs-languages.test.ts` name the file | Fix the twin |

**Steps with no backout:** none.
