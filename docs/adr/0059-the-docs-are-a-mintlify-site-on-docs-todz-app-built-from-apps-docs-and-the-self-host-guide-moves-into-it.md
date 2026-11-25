# 0059. The docs are a Mintlify site on docs.todz.app, built from apps/docs, and the self-host guide moves into it

- Status: Accepted (the build loop's call, the owner may overturn it)
- Date: 2026-11-25
- Deciders: Claude (the build loop's call, pending the owner); Dhyego Calota (owner) asked on 2026-11-25: "atualiza a página selfhost substituindo por docs do mintlify de fato"
- Inspired by: [ADR 0048](0048-the-self-host-guide-is-one-markdown-file-that-the-landing-serves.md), [ADR 0049](0049-todz-app-is-served-by-the-same-worker-dispatched-by-host-in-three-features.md), [ADR 0038](0038-the-brand-sources-are-svgs-in-docs-brand-and-the-app-s-assets-are-generated-from-them.md), [ADR 0005](0005-the-local-gate-runs-what-the-diff-can-break.md), [ADR 0008](0008-runbooks-live-in-the-repository.md), zapbip's `apps/docs` (read-only), run 17's spike of `mint` 4.3.91

## Context

todz has one published document: the self-host guide, `docs/self-host.md`, which the landing renders at `todz.app/self-host` (ADR 0048). The owner wants real docs on Mintlify in its place, short and exact: an introduction, a quickstart, connecting an agent, the MCP tools and the self-host guide, on `docs.todz.app`, with one source for the guide. zapbip already runs a Mintlify site from a workspace package with a pinned CLI and a walk gate, and is the owner's reference. Mintlify builds from a GitHub repository through its GitHub app. The owner set that up on 2026-11-25: a Mintlify project `todz` on the Hobby plan, source `dhyegocalota/todz`, deploy branch `main`, content directory `apps/docs`, and `docs.todz.app` connected with its certificate, serving Mintlify's starter kit. From then on, every merge to `main` that touches `apps/docs` publishes.

## Decision

1. **A workspace package.** `apps/docs` (`@todz/docs`) is the Mintlify root: `docs.json` and one `.mdx` file per page, in English. The pages are `index` (Introduction), `quickstart` (get the app, sign in), `connect-an-agent` (Claude Code, Codex, Cursor), `mcp-tools` (the MCP tools reference) and `self-host`. The package holds no product code.
2. **The look comes from the brand and the landing.** Theme `mint`, appearance `system`. The colours are the landing's accent and page tokens in light and dark. The logo, light and dark, is the brand icon of `docs/brand/todz-icon.svg` beside the `todz` wordmark in the landing's text colour of each scheme; the favicon is a byte copy of that icon. The footer credits Logic Bit with the words and the link of `COMPANY` in `libs/types`.
3. **Pinned by shape tests.** `tools/repository-shape` keeps the site true to the code it describes: `docs.json`'s colours, logo, favicon and footer against their sources; the navigation against the pages on disk; the agent commands against `AgentCommand.swift` and the MCP URL against `PUBLIC_ORIGIN`; the app's labels the pages name against the app's copy files; the MCP reference against `McpToolName`, `MCP_COPY.tools`, `MCP_COPY.prompts` and the argument schemas.
4. **One source for the guide.** `docs/self-host.md` moves to `apps/docs/self-host.mdx`. Its title moves into the front matter, which the landing's generator turns back into the page's first heading, so `todz.app/self-host` keeps rendering the same guide from the new path. Its repository-relative links become absolute GitHub URLs on `main`, because the Mintlify root is `apps/docs` and the page is served away from the repository.
5. **A pinned CLI, never installed.** The package runs `pnpm dlx mint@4.3.91`, with `dev` pinned to the client `0.0.4077`, because `mint dev` otherwise downloads the newest client and one such release broke every page in zapbip. The scripts are `dev`, `broken-links` and `validate`; one version string serves all three.
6. **A `docs` gate.** `scripts/verify.sh` gains `docs` after `macos`: `broken-links`, then `validate`, then Playwright walks against `mint dev` at 1280 and 375 wide, a 404 page included, which fail on any console error or failed request outside a short allow-list of the preview server's own noise, each entry with its reason. `scripts/verify-gates.tsv` maps `apps/docs/*` to `typecheck docs` with class `product`, because the site is what readers see, and `apps/docs/self-host.mdx` also to the `@todz/api` unit suite, which pins the landing's copy of the guide.
7. **A merge publishes, so the gate runs before it.** Mintlify builds `main` on every merge, so `broken-links` and `validate` are part of the `docs` gate and must be green before a branch touching `apps/docs` merges. `docs/runbooks/mintlify-publish.md` records the owner's setup as done on 2026-11-25 (the project, the plan, the source, the branch, the content directory, the domain) and holds the loop's check after a merge: the five pages and the 404 answer on `docs.todz.app` with todz's content, not the starter kit, then a walk at 1280 and 375. The loop creates no DNS record: the domain was connected in Mintlify's dashboard.
8. **The cutover is a second feature.** Until `docs.todz.app` answers with todz's docs, the landing keeps serving `/self-host`. The follow-up feature `docs-cutover` then makes `/self-host` answer 301 to `https://docs.todz.app/self-host`, points the landing, the README and the app at the docs, and changes the deploy runbook's step 13 probes. This supersedes ADR 0048 § 1's file and, once the cutover ships, § 3's landing page.

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| Mintlify from `apps/docs`, pinned `pnpm dlx` (chosen) | the owner's ask; zapbip's proven shape; no install for anyone who never touches the docs | every merge publishes; the CLI comes from the registry at gate time | — |
| `mint` as a pinned dev dependency | the lockfile holds its integrity hashes | hundreds of packages in the lockfile and in every install; zapbip runs it through `dlx` | the version pin and the walk catch what matters, and `dlx` keeps installs small |
| Keep the guide in `docs/self-host.md` and copy it into `apps/docs` at build time | no file move | two copies, one generated into a package Mintlify reads from git | Mintlify builds from the repository, not from our build, so the copy would have to be committed |
| Keep serving everything from the Worker on `todz.app` | no outside service | no search, navigation or theme without building them | the owner asked for Mintlify "de fato" |
| A `docs` class for `apps/docs/*`, as zapbip has | a docs-only change skips the tester | the site is what readers see | HARNESS § 5: a lane that changes what the user sees gets a tester |
| Cut over in the same pull request | one change | `/self-host` would redirect to a host that serves the starter kit until Mintlify has built the merge | the owner said to keep the page until the docs answer |

## Consequences

- A new workspace package, `@todz/docs`, with Playwright as a dev dependency; `AGENTS.md`'s layout and `apps/README.md` name it.
- `pnpm verify all` and any change under `apps/docs` need the npm registry and Mintlify's client download; an outage turns the `docs` gate red.
- A change to the MCP tools, the agent commands, the app's labels, the landing's colours or `COMPANY` fails a shape test until the docs follow.
- The Mintlify GitHub app reads this private repository.
- A merge to `main` that touches `apps/docs` goes live without another step; a red `docs` gate blocks the merge, and a bad merge is undone by a revert, which Mintlify publishes in turn.
- The first merge of this feature replaces the starter kit on `docs.todz.app`.
- The guide's links to the repository answer 404 for readers without access while the repository is private.
- `docs.todz.app` is a host outside the Worker; ADR 0049's dispatch by host is unchanged.

## Evidence

Run 17's spike, in a throwaway folder: `mint@4.3.91` runs on Node v24.7.0; `mint dev --client-version 0.0.4077` is ready in about six seconds; `mint broken-links` prints `success no broken links found` and exits 0 on a good site, and `found 1 broken links` with exit 1 on a broken one; root-relative links such as `/self-host` and `/self-host#updating` resolve; a footer with an external link and `appearance` pass `mint validate`; `mint --version` prints `unknown`, so the version is read with `mint version`. The newest client was 0.0.4318; 0.0.4077 is carried from zapbip and must render a page without the `__dirname` console error, which the walk checks.

## Revisit when

The repository becomes public (the guide's links then answer for everyone), Mintlify's plan terms change, or the pinned client stops rendering.
