# Docs on Mintlify

**Status:** Building
**Tier:** 🔴 (a new public host on an outside service with read access to the repository, a new gate, and the one source of the self-host guide moving)
**Owner approval:** approved 2026-11-25 by the owner's request to the loop, PROMPT.md "Self-host, docs and credits" item 2 ("atualiza a página selfhost substituindo por docs do mintlify de fato"): port zapbip's `apps/docs`, English only, short and exact (Introduction, Quickstart, Connect an agent, MCP tools reference, Self-host), on `docs.todz.app`, whose CNAME in the `todz.app` zone is authorized; the Mintlify account, its GitHub app on this private repository and the custom domain are owner steps, which the owner finished on 2026-11-25 (project `todz` on the Hobby plan, source `dhyegocalota/todz`, deploy branch `main`, content directory `apps/docs`, `docs.todz.app` connected with SSL and serving the starter kit), so the loop creates no DNS record; `/self-host` stays until the docs answer; `docs/self-host.md` becomes the Mintlify page, so there is still one source. The shape is the loop's call in [ADR 0059](../../adr/0059-the-docs-are-a-mintlify-site-on-docs-todz-app-built-from-apps-docs-and-the-self-host-guide-moves-into-it.md).
**ADRs:** [0059](../../adr/0059-the-docs-are-a-mintlify-site-on-docs-todz-app-built-from-apps-docs-and-the-self-host-guide-moves-into-it.md), [0048](../../adr/0048-the-self-host-guide-is-one-markdown-file-that-the-landing-serves.md), [0038](../../adr/0038-the-brand-sources-are-svgs-in-docs-brand-and-the-app-s-assets-are-generated-from-them.md), [0005](../../adr/0005-the-local-gate-runs-what-the-diff-can-break.md), [0008](../../adr/0008-runbooks-live-in-the-repository.md), [0049](../../adr/0049-todz-app-is-served-by-the-same-worker-dispatched-by-host-in-three-features.md)
**Not changing:** the landing's `/self-host` route and page (it renders the moved guide), the README's and the app's links to the guide's place (they move in `docs-cutover`), the Worker, the MCP tools, the app

## Problem

todz's only documentation is one self-host guide that the landing renders. Nothing tells a new owner how to get the app, sign in or connect Claude Code, Codex or Cursor, and nothing lists the MCP tools an agent gets.

## Goals

- A workspace package `apps/docs` (`@todz/docs`) that Mintlify builds into `docs.todz.app`: five pages in English, in this navigation:
  - Get started: Introduction (`index`), Quickstart (`quickstart`: get the app, sign in), Connect an agent (`connect-an-agent`: Claude Code, Codex, Cursor).
  - Reference: MCP tools (`mcp-tools`: each tool, its description and arguments, and the `next` prompt).
  - Self-host: Self-host todz (`self-host`: deploy, the ready line, the Server URL field, pointing an MCP client).
- `docs.json`: theme `mint`, appearance `system`, the landing's colours, the todz logo light and dark, the brand icon as favicon, a 404 page, a navbar link to `todz.app`, and a footer crediting Logic Bit from `COMPANY`.
- The guide moves from `docs/self-host.md` to `apps/docs/self-host.mdx`, still the one source: the landing's `/self-host` renders it from the new path until the cutover.
- Every fact a page states that the code also states is pinned by a shape test: commands, the MCP URL, the app's labels, tool names and descriptions, argument names, colours, the credit.
- A `docs` gate in `pnpm verify`: `mint broken-links`, `mint validate`, then Playwright walks against `mint dev` at 1280 and 375, light and dark, with a clean console. Every merge to `main` that touches `apps/docs` publishes, so the gate is green before any such merge.
- `docs/runbooks/mintlify-publish.md`: the owner's Mintlify setup, recorded as done on 2026-11-25, and the loop's check after a merge that `docs.todz.app` serves todz's pages, not the starter kit.

## Non-goals

- **The cutover** (`/self-host` answering 301 to `https://docs.todz.app/self-host`, the landing, README and app linking the docs, the deploy runbook's step 13 probes): the follow-up feature `docs-cutover`, taken once `https://docs.todz.app/self-host` answers 200 with the guide after this feature's merge.
- Any DNS change: `docs.todz.app` is already connected in Mintlify's dashboard.
- Languages other than English, versions, an API reference generated from a schema, Mintlify's AI assistant, analytics, custom CSS.
- Documenting the owner API, the widgets or the menu bar beyond what the quickstart needs.

## Design

### Data flow

```
apps/docs/{docs.json, *.mdx, logo/, favicon.svg}
   ── merge to main (after a green docs gate) ──▶ Mintlify project todz (source dhyegocalota/todz, branch main, content directory apps/docs)
   ── build ──▶ docs.todz.app   (connected in Mintlify's dashboard with SSL by the owner, 2026-11-25)
   ── the runbook's check after the merge: todz's pages answer, not the starter kit

apps/docs/self-host.mdx ── pnpm site:generate ──▶ front matter title → "# Self-host todz" ──▶ markdownHtml
   ──▶ apps/api/src/site/generated/self-host-html.ts ──▶ todz.app/self-host   (until docs-cutover)

pnpm --filter @todz/docs dev ──▶ pnpm dlx mint@4.3.91 dev --client-version 0.0.4077 ──▶ localhost:<free port>
pnpm verify (docs gate) ──▶ broken-links ──▶ validate ──▶ test:walk (Playwright against mint dev)
```

### Interfaces

- `apps/docs/package.json` (`@todz/docs`, private): `dev` (`pnpm dlx mint@4.3.91 dev --client-version 0.0.4077`), `broken-links` (`pnpm dlx mint@4.3.91 broken-links`), `validate` (`pnpm dlx mint@4.3.91 validate`), `test:walk` (Playwright), `typecheck`. Dev dependencies: `@playwright/test` 1.61.0 and `@types/node` 24.19.2, the versions the repository already installs.
- `apps/docs/docs.json`:
  - `name` `todz`; `theme` `mint`; `appearance.default` `system`; `favicon` `/favicon.svg`; `logo` `{ light: /logo/light.svg, dark: /logo/dark.svg, href: / }`.
  - `colors`: `primary` and `dark` are the landing's light `--color-accent` (`#2F5BFF`), `light` its dark `--color-accent` (`#7C95FF`); `background.color` is the landing's `--color-page` (`#F2F4FA` light, `#070812` dark).
  - `navbar.links`: one link, `todz.app` to `https://todz.app`.
  - `footer.links`: one column headed `Logic Bit` with one item, `todz is a product of Logic Bit, made in Brazil`, linking `https://logicbit.com.br`.
  - `errors.404`: `redirect` false, title `Page not found`, a description linking back to `/`.
  - `navigation.groups`: `Get started` (`index`, `quickstart`, `connect-an-agent`), `Reference` (`mcp-tools`), `Self-host` (`self-host`).
- Every page has front matter with a `title`; no page has a `# ` heading of its own.
- Logos: `logo/light.svg` and `logo/dark.svg` hold the brand icon's gradient and paths from `docs/brand/todz-icon.svg` and the wordmark `todz` filled with the landing's `--color-text` (`#161A33` light, `#F2F4FF` dark). `favicon.svg` is a byte copy of `docs/brand/todz-icon.svg`.
- The guide: front matter `title: Self-host todz`; the body starts at its intro paragraph; it holds no link into the repository (its four repository links become the plain text the landing already shows: `(ADR 0044)`, `(ADR 0045)`, ``(`docs/product`)``, `(the runbook)`); no line outside code holds `<` or `{`; the key screen is named by the app's title, **Connect an Agent**. `apps/api/scripts/site/guide-front-matter.ts` exports `guideMarkdown(source)`, which turns the front matter's title into `# <title>` and throws when the front matter or its title is missing.
- Gate: `scripts/verify.sh` `DOCS_PACKAGE=@todz/docs`, `gate_docs` runs `pnpm --filter @todz/docs --fail-if-no-match run` `broken-links`, `validate` and `test:walk` in order, and on a failure names the npm registry and Mintlify's client download in its `failure_reason`; `docs` ends `ALL_GATES`. `scripts/verify-gates.tsv`: `apps/docs/self-host.mdx	product	unit docs	apps/api` and `apps/docs/*	product	typecheck docs`, both before the generic `apps/*` row; `apps/docs/README.md` keeps the `apps/*/README.md` docs row. `.prettierignore` gains `*.mdx` beside `*.md`.
- Runbook: `docs/runbooks/mintlify-publish.md`: the owner's setup as done on 2026-11-25 (project `todz`, Hobby plan, source `dhyegocalota/todz`, branch `main`, content directory `apps/docs`, `docs.todz.app` with SSL); the loop's steps before a merge (`broken-links` and `validate` green) and after it (the five pages and the 404 on `docs.todz.app` with todz's titles, then a walk at 1280 and 375); a rollback by revert; a run log. It names no DNS record. `docs/runbooks/README.md` lists it and says agents run only its loop steps.

### Pages

- **Introduction**: what todz is (a to-do list that agents and their owner share, MCP-first, the macOS app with its menu bar and widgets), and cards to the four other pages.
- **Quickstart**: 1. Get the app: todz for Mac is coming soon; join the waitlist on `todz.app`; until then, build it from source as in the self-host guide's step 7, which keeps the todz cloud as its server. 2. Sign in: type your email, press **Send Link**, open the link from the mail on the same Mac. 3. Next: Connect an agent. A note says a self-hoster changes the server under **Server** in Settings, or from the sign-in screen's server line, and links the self-host page.
- **Connect an agent**: open **Connect an Agent** in the app's sidebar, pick a project, copy the command with its new key. The three commands in full, with the cloud's MCP URL `https://api.todz.app/mcp` and `<key>` in place of the key: Claude Code's `claude mcp add` line; Codex's `[mcp_servers.todz]` block with `bearer_token_env_var = "TODZ_API_KEY"` and the `export` line; Cursor's `mcpServers` JSON. One key reaches one project; a self-hoster's commands carry their own server, which the app shows.
- **MCP tools**: one section per tool in `McpToolName` order (`next`, `add`, `list`, `update`, `done`), each with its description exactly as `MCP_COPY.tools` has it and a table of its arguments named as the schemas name them; then the `next` prompt with `MCP_COPY.prompts`' description.
- **Self-host todz**: the guide as it stands after `server-url`, with the changes above.

### Failure handling

| Case | Effect |
|---|---|
| a page links a page or anchor that does not exist | `mint broken-links` prints `found N broken links` and exits 1; the `docs` gate stops |
| a page does not parse as MDX, or `docs.json` breaks the schema | `mint validate` exits non-zero; the `docs` gate stops |
| the pinned client throws in the browser | the walk's console check fails on the error |
| the npm registry or Mintlify's client download is down | `pnpm dlx` fails; the `docs` gate is red until it answers, and its reason names that need; never skipped |
| the `@todz/docs` package is missing (a branch without it) | `--fail-if-no-match` fails the gate instead of passing on no match |
| the MCP tools, agent commands, app labels, landing colours or `COMPANY` change | a shape test names the page and the fact that drifted |
| the guide changes without `pnpm site:generate` | `generated-site.test.ts` and `site:check` fail, as today |
| the guide loses its front matter title | `guideMarkdown` throws `the guide's front matter has no title`; the landing's page cannot be generated |
| a merge to `main` touches `apps/docs` | Mintlify publishes it with no further step; the `docs` gate, `broken-links` and `validate` included, must be green before the merge |
| a Mintlify build of `main` fails | `docs.todz.app` keeps the last good build (the starter kit before this feature's merge); the dashboard shows the error; the runbook's check after the merge sees the old titles |
| until this feature merges | `docs.todz.app` serves Mintlify's starter kit; `todz.app/self-host` keeps serving the guide |

### Rollback

Revert the pull request: the guide returns to `docs/self-host.md`, the landing's page is generated from it again, and the `docs` gate and package go. The revert is a merge to `main`, so Mintlify builds it; with no `apps/docs`, the build fails and `docs.todz.app` keeps the last good build, so taking the docs offline is the owner's step in the dashboard (disconnect the domain). No DNS record to remove. No data is lost.

## Open questions → answers

| Question | Options | Owner's answer | Date |
|----------|---------|----------------|------|
| Which Mintlify plan, and does it allow a custom domain on a private repository? | Hobby; a paid plan | the owner set it up: project `todz` on Hobby, source `dhyegocalota/todz`, branch `main`, content directory `apps/docs`, `docs.todz.app` connected with SSL (relayed by the coordinator) | 2026-11-25 |
| Does the loop create the `docs` DNS record? | a CNAME through `scripts/todz-cloudflare.sh`; none | none: the owner connected `docs.todz.app` in Mintlify's dashboard, and it already answers 200 | 2026-11-25 |
| When does `/self-host` redirect to the docs? | this PR; a follow-up | the loop's call: `docs-cutover`, once `https://docs.todz.app/self-host` answers 200 with the guide after this feature's merge (ADR 0059 § 8) | 2026-11-25 |
| The guide's links into a private repository | absolute GitHub URLs; plain text | the plan review's pick (R8): plain text, as the landing already renders them; no page links into the repository while it is private | 2026-11-25 |
| `pnpm dlx` or a dev dependency for `mint` | `dlx` pinned; dev dependency | the loop's call: `dlx` pinned, as zapbip (ADR 0059 § 5) | 2026-11-25 |
| Class of `apps/docs/*` in the gate map | `docs`; `product` | the loop's call: `product`, since readers see it (ADR 0059 § 6) | 2026-11-25 |

## Test strategy summary

Shape tests (Vitest, `tools/repository-shape`): `docs.json` against the landing's tokens, the brand icon and `COMPANY`; the navigation against the pages on disk and their front matter; the agent commands against `AgentCommand.swift` and `PUBLIC_ORIGIN`; the app labels against the Swift copy; the MCP reference against `mcp-copy.ts` and `mcp-tool-arguments.ts`; the moved guide's front matter, its lack of repository links, its MDX-safe text and label; the runbook's recorded setup, its checks and that it names no DNS record. Unit (`@todz/api`, node pool): `guideMarkdown`; the generated page and the landing's guide tests from the new path. `scripts/verify.test.sh`: the map and the `docs` gate's order. The `docs` gate itself: broken links, validation, and Playwright walks against `mint dev` at 1280 and 375, light and dark, the 404 page, a clean console. A tester's Playwright MCP walk of every page, both widths and schemes, with screenshots for the PR.
