# Plan: docs in eight languages

Steps are checked off by the developer as each commit lands. Red commits come first.

## Steps

- [x] 1. ADR 0119 and this folder.
- [x] 2. Red: the shape tests for the twins, the front matter, the code, the links, the headings, the owner name and `navigation.languages`; the existing docs tests read the English entry.
- [x] 3. `docs.json` moves to `navigation.languages` with the five group names translated.
- [x] 4. Playwright language spec in `apps/docs/e2e`.
- [x] 5. The seven translator folders land; `mint broken-links` and the full set run green.
- [x] 6. Flip the spec and the index to Shipped; open the PR.

## File ownership

Infrastructure: `docs/`, `tools/repository-shape/`, `apps/docs/docs.json`, `apps/docs/e2e/`. Translators: `apps/docs/<folder>/*.mdx` only.

## Failure modes

| Step | What breaks | Signal | Backout |
|------|-------------|--------|---------|
| 3 | `mint dev` rejects a language code | `pnpm --filter @todz/docs validate` fails | Revert the `docs.json` commit |
| 5 | A twin drifts from the English page | A shape test names the file | Fix the twin |

**Steps with no backout:** none.
