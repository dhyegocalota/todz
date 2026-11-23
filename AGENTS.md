# todz — agent guide

Read by Claude Code (`CLAUDE.md`), Codex (`AGENTS.md`) and Gemini (`GEMINI.md`): the three names are the same file.

**Process lives in `.claude/HARNESS.md`. Read it before any feature, fix or review.**
Decisions live in `docs/adr/`. Traps live in `docs/learnings/`.

## What this is

todz is a to-do list that AI agents and their owner share. MCP-first and agentic-first: every action a person takes in the app, an agent can take through the MCP server (Claude Code, Codex, Cursor, any MCP client). Multi-tenant: each workspace is isolated; projects live inside a workspace. Cloud sync across devices. A native macOS app with a menu bar extra and WidgetKit widgets (interactive), simple, polished interface. Audience: AI enthusiasts and programmers.

The product stack and every product decision have not been made yet: they arrive as features under `docs/features/`, starting with the `brainstorming` skill, and as ADRs.

## Layout

```
libs/core               the task and project rules behind ports, no I/O
libs/types              shared enums and constants, no logic
tools/repository-shape  tests about the repository itself: README links, root entries, workflows, feature statuses, indexes, runbooks, scenarios, agent surfaces
docs/adr                architecture decision records
docs/learnings          dated traps, with what inspired them and when they were revisited
docs/features           one folder per feature: spec.md + plan.md + test-plan.md
docs/runbooks           step-by-step procedures followed by hand, each step with an expected result and an `If it fails` line
docs/scenarios          agentic walks of the product core, one file per flow, run with /scenario
.agents/skills          skills (single source; `.claude/skills` links here)
.agents/roles           agent role bodies shared by `.claude/agents` and `.codex/agents`
.agents/hooks           hook scripts shared by `.claude/settings.json` and `.codex/hooks.json`
scripts                 the local gate and its tests
```

Applications go under `apps/`, shared libraries under `libs/`; a feature that adds one adds its line here and, for a new root entry, its entry to `delivery-docs.test.ts`.

Every workspace package has a `README.md` that states purpose only: no commands, configuration, file paths or symbols, because prose is not compiled. Update a README in the same change as the code it describes ([HARNESS → Build](.claude/HARNESS.md#4-build)).

## Language

Everything in the repo is in English: code, identifiers, comments-free code, docs, ADRs, learnings, commits, PR titles and bodies. Conversation with the owner may be in Portuguese; files never are. The one exception is owner-facing product copy: it lives in `*-copy.ts` modules, in the locales a future ADR decides; repo prose and identifiers stay English.

## Code conventions

- No comments; names carry the meaning. The one exception is a pointer to a decision: one line, `// NB ADR NNNN: <the rule in one sentence>`, placed on the constant or function that embodies it. It never explains mechanics, and a rule that deserves one deserves the ADR first. No acronyms in identifiers.
- Flat `if`s, early returns, no `else`.
- A compound condition gets a name (`isArchivedTask`, `isOnEditingSurface`) before the `if` that uses it.
- A name says what the variable holds: a promise is a `…Connection` or `…Promise`, never a `client`.
- One handler per request kind, dispatched from a record keyed by the kind, instead of one function with interleaved `if`s.
- Recurring mechanics have one shared helper. Search before adding a local copy; a new one goes under `libs/` or the owning feature, and its name joins this line: none yet.
- Durations cross boundaries in milliseconds and convert at the edge (a `Retry-After` header, a label).
- Copy strings never sit inline in JSX; they live in a `*-copy.ts` file or `libs/types`.
- Never `?? defaultValue` to mask a missing value. Model absence explicitly: throw, return early or make the field required upstream.
- Enums over string literals. Constants over magic literals, declared at the top of the file or in `libs/types`.
- Function declarations for functions, components and hooks. Named parameters whenever a function takes more than one.
- Array methods over loops. Short files with one purpose.
- No `.js` extensions in imports. Type everything.
- Read neighbouring code first and match it; the repo must read as if one engineer wrote it.

## Commits and branches

- Branches: `feat/<slug>`, `fix/<slug>`, `docs/<slug>`, `chore/<slug>`.
- Commits: Conventional Commits, `type(scope): summary`, en-US. Never `git add -A`, `git add .` or `--no-verify`.
- Commit and push only when the owner asks. Never commit from `main`; branch first.
- Attribution lines required by the agent harness go at the end of the commit body.

## Tests are mandatory

A change without tests is not done. Unit with Vitest, E2E with Playwright where there is a browser surface, and the user-facing walk with Playwright MCP recorded for the PR. Details in `.claude/HARNESS.md` → Prove.

## Tooling

- `.mcp.json` (Claude, Cursor) and `.codex/config.toml` (Codex) declare the same MCP servers: `playwright`, `context7`.
- One source per agent surface, thin adapters per tool ([ADR 0001](docs/adr/0001-one-source-per-agent-surface.md)): skills in `.agents/skills` (`.claude/skills` links there), roles in `.agents/roles` (wrapped by `.claude/agents/*.md` and `.codex/agents/*.toml`), hook scripts in `.agents/hooks` (wired by `.claude/settings.json` and `.codex/hooks.json`).
- TypeScript intelligence: Claude Code uses the `typescript-lsp` plugin; everyone else runs `pnpm typecheck`.
- Secrets live in `.env` files that agents never edit; `.env.example` documents them.
