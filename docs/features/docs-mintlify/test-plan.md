# Test plan: Docs on Mintlify

Every checkbox states the input and the exact expected outcome. A ticked box carries evidence after ` — evidence: ` (commit hash, log path, counts, screenshot path).

Runs against: `mint dev` started inside `apps/docs` with `pnpm run dev --port <a free port the tester picks> --no-open` (the pinned client; the walk's own runs take their port from `TODZ_DOCS_PORT` through `docsPortOf`), and the local landing on `http://localhost:8788` (`pnpm --filter @todz/api dev:site`) for `/self-host`. Nothing before the merge reaches `docs.todz.app`, which serves Mintlify's starter kit until this feature merges; the merge publishes it (the owner's Mintlify setup was done on 2026-11-25), so the last section runs after the merge.

## The failing test first

- [ ] Lead red (L0): `swift-copy.test.ts` and `front-matter.test.ts` — input: the stubs; expected: every case fails printing `swiftCopyValue is not implemented`, `frontMatterOf is not implemented` or `bodyOf is not implemented`
- [ ] Lane G red (G1): `tools/repository-shape/src/self-host.test.ts` — input: the guide still at `docs/self-host.md`; expected: four failures by assertion: (a) the path test (`apps/docs/self-host.mdx` missing, `docs/self-host.md` present), (b) the front matter test (no front matter, a `# Self-host todz` line), (c) the link test (targets `adr/0044-…`, `adr/0045-…`, `product/README.md`, `runbooks/deploy-the-api.md` are neither `https://` nor `#`), (d) the label test (`**Connect an agent**` found, `**Connect an Agent**` missing); (e) the `<`/`{` test passes and is recorded as a pin
- [ ] Lane G (G1): `apps/api/test/site/generated-site.test.ts`'s new test (the `h1`, no `---`, no `title:`) — expected: passes when it lands; recorded as a pin
- [ ] Lane G red (G1): `apps/api/test/site/guide-front-matter.test.ts` — input: the stub; expected: three failures printing `guideMarkdown is not implemented`
- [ ] Lane G red (G4): `tools/repository-shape/src/runbooks.test.ts` — input: no `mintlify-publish.md`, the old index sentence; expected: the new tests fail naming the missing runbook and the sentence
- [ ] Lane G red (G6): `scripts/verify.test.sh` — input: `verify.sh` without a `docs` gate; expected: `FAIL` lines for the `ALL_GATES` cases, the three `apps/docs` classifications, the gate's call lines and its failure reason
- [ ] Lane D red (D1): `docs-site.test.ts`, `docs-pages.test.ts`, `docs-mcp-reference.test.ts` — input: the stub package; expected: failures by assertion on the missing `theme`, colours, logo, footer, navigation, port helper and pages, not a crash of the suite; the assertions that pass (the `mint@` pins, no orphan `.mdx`) are listed as pins
- [ ] Confirmed each red fails for the right reason: the tester checks out each red commit in a throwaway worktree, runs the named suite and records the failure text it printed

## Unit

- [ ] `swift-copy.test.ts` — input: a Swift enum text with `static let title = "Connect an Agent"`; expected: `swiftCopyValue({ text, name: 'title' })` is `Connect an Agent`; with `name: 'subtitle'` it throws `subtitle is not a static let of this file`
- [ ] `front-matter.test.ts` — input: `---\ntitle: Quickstart\n---\n\nBody\n`; expected: `{ title: 'Quickstart' }` and the body `Body\n`; a text without front matter throws `the page has no front matter`
- [ ] `guide-front-matter.test.ts` — input: `---\ntitle: Self-host todz\n---\n\nRun your own todz server.\n`; expected: `# Self-host todz\n\nRun your own todz server.\n`
- [ ] Edge: no front matter — input: `# Self-host todz\n\nRun…`; expected: throws `the guide has no front matter`
- [ ] Edge: front matter without a title — input: `---\nsidebarTitle: Self-host\n---\n\nRun…`; expected: throws `the guide's front matter has no title`
- [ ] `generated-site.test.ts` — input: the moved guide; expected: the committed `self-host-html.ts` equals what `site:generate` renders, its first line names ADR 0059 and `apps/docs/self-host.mdx`, it contains `<h1 id="self-host-todz">Self-host todz</h1>` and neither `---` nor `title:`, and every `href` is `https://` or `#` with none into the repository
- [ ] The generated page's diff from `main` — input: `git diff origin/main -- apps/api/src/site/generated/self-host-html.ts`; expected: only the header line and `Connect an Agent` twice
- [ ] `site-pages.test.ts` — input: the guide from `apps/docs/self-host.mdx?raw`; expected: the page's `h2` list equals the guide's `## ` lines, its code regions equal the guide's fences, the CSP test green
- [ ] `self-host.test.ts` — input: the moved guide; expected: every existing test green (pnpm scripts, database name, variables, Wrangler keys, routes, namespaces, production settings, build commands, `server:deploy`, Settings phrase, Claude Code shape, repository paths, app settings, sender) plus (a) to (e)
- [ ] Edge: a repository link — input: `[ADR 0044](https://github.com/dhyegocalota/todz/blob/main/docs/adr/0044-….md)` added to the guide, then removed; expected: (c) fails naming that target
- [ ] Edge: MDX — input: `the account's todz-api.<subdomain>.workers.dev` without backticks, then restored; expected: (e) fails naming the line
- [ ] `feature-status.test.ts` — input: `REPOSITORY_URL` from `repository-files.ts`; expected: green, unchanged results
- [ ] `runbooks.test.ts` — input: `mintlify-publish.md`; expected: purpose sentence, numbered steps 1 to 4 each with `If it fails:`, the index line once, the exception sentence ``agents never run them, except `deploy-the-api` and the loop's steps of `mintlify-publish` ``, a `## Setup` section recording `2026-11-25`, `todz`, `Hobby`, `dhyegocalota/todz`, `main`, `apps/docs` and `docs.todz.app`, the `broken-links` and `validate` step numbered before every step that asks `https://docs.todz.app`, the check asking `/`, `/self-host` and `/no-such-page`, no line naming `dns_records`, `CNAME` or `scripts/todz-cloudflare.sh`, a run log table
- [ ] `docs-site.test.ts` — input: `apps/docs`; expected: `theme` `mint`, `appearance.default` `system`, `colors` `{ primary: "#2F5BFF", light: "#7C95FF", dark: "#2F5BFF" }` read from `site-style.ts`, `background.color` `{ light: "#F2F4FA", dark: "#070812" }`, `favicon.svg` byte-equal to `docs/brand/todz-icon.svg`, each logo holding the stops `#4C6BFF` and `#1B2A9E`, the check path `M300 532 L448 680 L724 404`, the sparkle path, and `todz` filled `#161A33` (light) or `#F2F4FF` (dark); the footer column `Logic Bit` with the label `todz is a product of Logic Bit, made in Brazil` built from `creditLead`, `COMPANY.tradeName` and `creditTail` and the link `https://logicbit.com.br`; navbar `todz.app` → `https://todz.app`; 404 title `Page not found`, `redirect` false; navigation `index`, `quickstart`, `connect-an-agent` under `Get started`, `mcp-tools` under `Reference`, `self-host` under `Self-host`; no orphan `.mdx`; each page has a `title` and no `# ` line; one `mint@4.3.91` across the scripts and `--client-version 0.0.4077` in `dev`; the config's port comes only from `docsPortOf`, which reads `TODZ_DOCS_PORT` first and writes its choice back; `.mintignore` lists `README.md` if D2 found `/README` served
- [ ] `docs-pages.test.ts` — input: `connect-an-agent.mdx`, `quickstart.mdx`, `AgentCommand.swift` (its constants and three templates parsed as text), `wrangler.jsonc`, the Swift copy files; expected: the page holds `claude mcp add --transport http todz 'https://api.todz.app/mcp' --header 'Authorization: Bearer <key>'`, the block `[mcp_servers.todz]\nurl = "https://api.todz.app/mcp"\nbearer_token_env_var = "TODZ_API_KEY"`, the line `export TODZ_API_KEY='<key>'`, and the Cursor JSON exactly as `cursorJSON` lays it out with `"todz"`, `"url": "https://api.todz.app/mcp"` and `"Authorization": "Bearer <key>"`; `**Connect an Agent**`, `**Send Link**`, `**Server**`, `**Use todz cloud**` equal the Swift copy; the quickstart's `/self-host#…` anchor is a heading slug of the guide
- [ ] `docs-mcp-reference.test.ts` — input: `mcp-tools.mdx`, `mcp-copy.ts`, `mcp-tool-arguments.ts`; expected: headings `## next`, `## add`, `## list`, `## update`, `## done` in that order, each followed by its `MCP_COPY.tools` line verbatim; `tasks`, `title`, `notes`, `due_date`, `idempotency_key` under `add`; `state`, `due`, `text`, `limit` under `list`; `id`, `title`, `notes`, `due_date`, `placement`, `kind`, `anchor` under `update`; `ids`, `note` under `done`; none under `next`; `## Prompts` with `next` and `Start working on the next task of this project.`
- [ ] Edge: drift — input: rename `serverName` to `todz2` in `AgentCommand.swift`, then restore; expected: `docs-pages.test.ts` fails naming the Claude Code line (and `self-host.test.ts` its Claude Code test)
- [ ] Edge: drift — input: change `codexConfiguration`'s `bearer_token_env_var` line in `AgentCommand.swift`, then restore; expected: `docs-pages.test.ts` fails naming the Codex block
- [ ] Edge: drift — input: change `MCP_COPY.tools[McpToolName.Done]`'s text, then restore; expected: `docs-mcp-reference.test.ts` fails naming `done`
- [ ] Edge: drift — input: change `COMPANY.website` in `constants.ts`, then `creditTail` in `landing-copy.ts`, restoring each; expected: `docs-site.test.ts` fails on the footer each time (and `constants.test.ts` on the literal)
- [ ] Edge: drift — input: change the light `--color-accent` in `site-style.ts`, then restore; expected: `docs-site.test.ts` fails on `colors.primary`
- [ ] `scripts/verify.test.sh` — input: the gate map; expected: `apps/docs/index.mdx` → class `product`, gates `doctor format secrets typecheck audit shape docs`, packages `-`; `apps/docs/self-host.mdx` → class `product`, gates `doctor format secrets audit shape unit docs`, packages `@todz/api`; `apps/docs/README.md` → class `docs`, gates `doctor format secrets audit shape`; `apps/api/src/x.ts` lists no `docs`; the stub log shows `pnpm --filter @todz/docs --fail-if-no-match run broken-links`, `… run validate`, `… run test:walk` in order; with `STUB_FAIL` on the broken-links call, verify prints `verify: docs failed: ` and the reason naming the npm registry and Mintlify's client download, and makes no `test:walk` call
- [ ] Lane G alone — input: `pnpm verify --plan` and `pnpm verify` on Lane G's branch with a change to `apps/docs/self-host.mdx`; expected: the plan lists `docs`; the run fails at `docs` (no `@todz/docs` to match), as the plan says; recorded, not a defect
- [ ] `pnpm verify all` on the merged head — expected: every gate green, `docs` last, with its three commands' output; the counts recorded

## The docs gate (Playwright specs against `mint dev`)

- [ ] D2's pin check, inside `apps/docs` under pnpm 8.15.9 — input: `pnpm run dev --port <n> --no-open`; expected: `mint dev` serves on `<n>`, opens no browser, the `self-host` page renders with no `__dirname is not defined` in the console; `pnpm run broken-links` and `pnpm run validate` exit 0; the same facts appear in ADR 0059's Evidence
- [ ] `/README` — input: open `http://localhost:<n>/README`; expected: Mintlify's 404, or, if it serves the package README, `.mintignore` lists `README.md` and the 404 follows
- [ ] `pnpm --filter @todz/docs run broken-links` — expected: `success no broken links found`, exit 0
- [ ] Edge: a link to `/no-such-page` added to `index.mdx`, then restored — expected: `found 1 broken links`, exit 1
- [ ] `pnpm --filter @todz/docs run validate` — expected: exit 0
- [ ] Edge: an unclosed `<Card` in `index.mdx`, then restored — expected: a non-zero exit naming `index.mdx`
- [ ] Port — input: `TODZ_DOCS_PORT` unset, then set to a free port; expected: unset, one free port is chosen and every worker's `baseURL` uses it; set, the walk serves on that port
- [ ] `e2e/pages.spec.ts` (desktop and narrow, light and dark) — steps: open `/`, `/quickstart`, `/connect-an-agent`, `/mcp-tools`, `/self-host`; expected: each page's heading is `Introduction`, `Quickstart`, `Connect an agent`, `MCP tools`, `Self-host todz`; at 1280 the sidebar lists them in that order under `Get started`, `Reference`, `Self-host`; at 375 the menu opens and lists them; no horizontal scroll at 375
- [ ] `e2e/not-found.spec.ts` — steps: open `/no-such-page`; expected: `Page not found`; the link back reaches the Introduction; its own document's 404 is the one status of 400 or more the fixture accepts
- [ ] `e2e/brand.spec.ts` — steps: open `/` in light, then dark; expected: the navbar logo's `src` ends `/logo/light.svg`, then `/logo/dark.svg`; the page background's computed colour is `rgb(242, 244, 250)`, then `rgb(7, 8, 18)`; a content link's computed colour is `rgb(47, 91, 255)`, then `rgb(124, 149, 255)`; the footer link reads `todz is a product of Logic Bit, made in Brazil` with `href` `https://logicbit.com.br`; the navbar link `todz.app` has `href` `https://todz.app`
- [ ] Every walk — expected: zero console errors, zero `requestfailed`, zero responses of 400 or more (but the not-found document), other than the three allow-listed `mint dev` entries, each matched with its reason; in particular no `__dirname is not defined`
- [ ] The first walk without the allow-list — expected: its full log is in the briefing, and every entry the allow-list later accepts is in it with the same URL shape
- [ ] Each walk spec is a pin; its mutation turns it red — input: `quickstart` dropped from the navigation; `logo.dark` set to `/logo/light.svg`; `background.color.dark` changed; the 404 title deleted; expected: `pages.spec.ts`, `brand.spec.ts` (twice), `not-found.spec.ts` fail respectively, then pass when restored

## End-to-end, the landing (Playwright specs, `@todz/api`)

- [ ] `apps/api/e2e/landing.spec.ts` "self-host guide" — steps: from `/`, click the footer's guide link; expected: `/self-host`, `h1` `Self-host todz`, the `h2` list equals the `## ` lines of `apps/docs/self-host.mdx`, one `pre` per code block
- [ ] `apps/api/e2e/landing.spec.ts` credit and console tests on `/self-host` — expected: green as before (the credit, no console error, no foreign request)

## Prove it for real — Playwright MCP

- [ ] Happy path, entry to exit, at 1280 light: Introduction → its Quickstart card → the Quickstart's Connect an agent link → MCP tools from the sidebar → Self-host todz from the sidebar; expected: each page opens with its title, the Introduction shows four cards, the Connect an agent page shows the Claude Code, Codex and Cursor commands, each with `https://api.todz.app/mcp`, MCP tools shows five tool sections and one prompt, Self-host shows What you need, sections 1 to 8 and Updating, with no link into the repository
- [ ] Code blocks: press the copy button on the Claude Code command; expected: the clipboard holds exactly the page's line, `<key>` included
- [ ] Anchor: open `/self-host#updating`; expected: the page lands on the Updating heading
- [ ] Anchor: the Quickstart's link to the guide's build step; expected: lands on `7. Build the macOS app and point it at your server`
- [ ] Empty: N/A — a static site has no empty state; the 404 page stands for "nothing here": `/no-such-page` shows `Page not found` and a link to the Introduction
- [ ] Single and many: N/A — the pages hold fixed content; the MCP tools page is the "many" (five tools, one prompt) and is walked above
- [ ] Rejected input: N/A — no form; the search box is walked under coverage honesty
- [ ] Browser Back mid-flow: on MCP tools after the happy path, press Back; expected: Connect an agent, at the scroll position it had
- [ ] Reload mid-flow: on `/self-host#updating`, reload; expected: the same page, at the Updating heading
- [ ] Two authors in two browser contexts at once: N/A — the site has no shared state
- [ ] Latency / disconnect: N/A for `mint dev`; the published site's behaviour is the runbook's walk after the merge
- [ ] Dark: switch the theme toggle to dark on every page; expected: the dark logo, `#070812` page, links in the dark accent, the footer credit legible
- [ ] Console and network clean: zero console errors, zero failed requests, zero answers of 400 or more but the 404 page's own, other than the three allow-listed `mint dev` entries
- [ ] Desktop width 1280: expected: the sidebar, the page and the table of contents side by side, no overlap
- [ ] Narrow width 375: expected: the menu button opens the navigation, code blocks scroll inside themselves, no horizontal page scroll
- [ ] The landing's `/self-host` at 1280 and 375: expected: the same guide as before the move, `(ADR 0044)`, `(ADR 0045)`, `(docs/product)` and `(the runbook)` as plain text, `Connect an Agent` in steps 7 and 8
- [ ] Screenshots at `.pr-media/docs-mintlify/` (five pages and the 404, 1280 and 375, light and dark); video at `.pr-media/docs-mintlify/walk.mp4`

## Before and after the merge (`docs.todz.app`)

- [ ] Before the merge: `curl -sS -D - -o /dev/null https://docs.todz.app/self-host` — expected: not `HTTP/2 200` with `Self-host todz` (the starter kit has no such page); the answer is recorded so the check after the merge is known to tell the two apart
- [ ] Before the merge, on the head that merges: `pnpm --filter @todz/docs run broken-links` prints `success no broken links found` and `run validate` exits 0
- [ ] After the merge, the runbook's step 3 — expected: `https://docs.todz.app/self-host` `HTTP/2 200` holding `Self-host todz`; `https://docs.todz.app/` holding `todz is a product of Logic Bit, made in Brazil`; `https://docs.todz.app/no-such-page` 404 with `Page not found`
- [ ] After the merge, the runbook's step 4 — expected: the five pages and the 404 at 1280 and 375, light and dark, as in the walk above, with no console error; the run log row written
- [ ] After the merge, before the next Worker deploy — expected: `https://todz.app/self-host` still shows `Connect an agent` (the deployed Worker predates the move); after the next deploy, `Connect an Agent`

## Edge cases found during execution

Empty on purpose. The tester adds one checkbox per new case (input, exact expected outcome) and a regression test for each.

## Adversarial review

The reviewer picks the three claims most likely to be wrong and tries to refute each.

- [ ] Claim 1: the guide has one source — attack: `git grep` for a sentence of the guide outside `apps/docs/self-host.mdx` and the generated page; edit one heading in the `.mdx` without regenerating and run `pnpm --filter @todz/api site:check`; result: <refuted | held>
- [ ] Claim 2: nothing that breaks the docs can merge, and every merge publishes — attack: on a throwaway branch, add a link to `/no-such-page` in `index.mdx` and run `pnpm verify`; expected the `docs` gate red at `broken-links` before any walk; rename the package in a scratch copy and expect `--fail-if-no-match` to fail the gate; then read `verify-gates.tsv` for an `apps/docs` path the `docs` gate does not cover; result: <refuted | held>
- [ ] Claim 3: the pinned client renders every page with no console error — attack: run the walk with the pin, then once with the `--client-version` flag removed, and compare the console; result: <refuted | held>

## Coverage honesty

What is not tested and why.

- The published site on `docs.todz.app` before the merge — it serves the starter kit until this feature merges; the runbook's steps 2 to 4 check it after the merge, and its run log records them.
- Mintlify's hosted build may render differently from `mint dev` (search, fonts, analytics, the AI assistant); only the local preview is walked here.
- Search (Cmd K) is not asserted: `mint dev`'s search depends on Mintlify's hosted index; the tester notes what it shows.
- The hosted `verify.yml` workflow does not run the `docs` gate; the gate is local (ADR 0005).
- `pnpm dlx` resolves `mint` from the registry at gate time, without the lockfile's integrity hashes; the exact version pin is the only guard.
- The logos' wordmark is SVG text in the system font; a reader without SF Pro sees a fallback face.
- MCP argument descriptions are not pinned word for word, since they interpolate constants; argument names, tool descriptions and the prompt are.
- The guide names its ADRs, the product docs and the deploy runbook without linking them, so a reader without the repository cannot open them.
- The Cursor install link the app opens is not documented on the page, so not pinned.
