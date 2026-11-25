# 0048. The self-host guide is one Markdown file that the landing serves

- Status: Proposed
- Date: 2026-11-24
- Deciders: Claude (the build loop's call, pending the owner); Dhyego Calota (owner) asked on 2026-11-24 for short, exact self-host docs, "e pode publicar também", and may overturn this
- Inspired by: [ADR 0044](0044-the-wrangler-configuration-is-production-on-api-todz-app-and-development-overrides-it.md), [ADR 0045](0045-the-public-sign-in-routes-are-limited-three-ways-and-turnstile-guarded-failing-closed.md), the owner's PROMPT.md, which forbids publishing to claude.ai Artifacts or any outside service

## Context

The owner wants a short self-host guide, and published. The repository is private, so a guide only on GitHub reaches nobody else yet. The only public surface todz will have is `todz.app`, which `landing` builds next. PROMPT.md forbids any other outside service.

## Decision

1. The guide is one file, `docs/self-host.md`, linked from the root README, short and exact: what you need, the steps, the app's build setting, the MCP command.
2. A repository-shape test, `self-host.test.ts`, keeps it true: its links resolve, its `pnpm` commands are scripts the repository has, its database commands name the configured database, the variables it names are ones the Worker reads, its build commands are the gate's own with the configuration swapped, and its Claude Code command has the key screen's shape.
3. Publishing means `landing` serves the same file at `https://todz.app/self-host`, rendered from this Markdown at build time, so there is one source. Until `landing` ships, the guide lives in the repository only.

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| One Markdown file, served later by the landing (chosen) | one source; tested | not public until `landing` | the only allowed public surface |
| A claude.ai Artifact or a docs host | public now | an outside service | PROMPT.md forbids it |
| A long guide covering every Cloudflare screen | complete | drifts; the owner asked for short | "curta porém certeira" |

## Consequences

- `landing` adds a `/self-host` route that renders `docs/self-host.md`.
- A change to Wrangler bindings, the app's build setting or the key screen's command fails the shape test until the guide follows.

## Revisit when

The repository becomes public, and GitHub itself can be the published page.
