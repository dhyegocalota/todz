# Landing: tester briefing

## G2: the pages (`feat/landing-pages`)

### What changed

- `apps/api/src/site/`: `landing-page.ts` (`LandingNotice`, `serveLandingPage`), `self-host-page.ts` (`serveSelfHostPage`), `site-shell.ts` (head, header, footer), `site-style.ts` (the one stylesheet, built from the design tokens; crop boxes are classes generated from `landing-shots.ts`), `site-glyphs.ts` (the icon and offline glyph in one inline SVG sprite, the menu-bar glyph), `site-headers.ts` (hashed CSP builder, HSTS `max-age=31536000`, `nosniff`, `no-referrer`, `Cache-Control: no-cache`), `landing-copy.ts` (`LANDING_COPY`), `landing-shots.ts` (paths, intrinsic sizes, crop boxes), `escaped-html.ts`, `generated/self-host-html.ts`.
- `apps/api/src/turnstile-page.ts` exports `sourceHash`; the site reuses it.
- `apps/api/scripts/site/`: `markdown-html.ts` (renderer, no dependency), `generated-site.ts`, `cli.ts` (`generate`, `check`). `site:generate` and `site:check` in `apps/api/package.json`, with root aliases.
- `apps/api/public/landing/`: byte copies of the six design §5 shots, same relative paths as `docs/screenshots/`.
- `docs/self-host.md`: step 2 replaces the three routes and sets `vars.SITE_ORIGIN`; step 4 names the three hosts. The line about local providers no longer says "console" (see Gaps).
- Tests: `apps/api/test/site-pages.test.ts` (workers), `apps/api/test/site/markdown-html.test.ts` and `generated-site.test.ts` (node project, scripts tsconfig, excluded from the Worker tsconfig), `apps/api/test/raw-sources.d.ts` (types for `?raw` and `import.meta.glob`), `tools/repository-shape/src/site-assets.test.ts`, `self-host.test.ts` (routes, `SITE_ORIGIN`), `scripts/verify-gates.tsv` row `docs/self-host.md	product	unit` with its `verify.test.sh` case.

### How to run

- `pnpm --filter @todz/api test:unit`, `pnpm --filter @todz/repository-shape test:unit`, `bash scripts/verify.test.sh`, `pnpm typecheck`, `pnpm site:check`.
- The pages cannot be reached through `exports.default.fetch` on this branch alone; G1 wires them. The tests call `serveLandingPage` and `serveSelfHostPage` directly.

### Red first

| Commit | Test | Failure text the red run printed |
|---|---|---|
| b1bbc67 | `verify.test.sh` "the self-host guide" | `FAIL the self-host guide: class: expected 'class: product', got 'class: docs'` and the same line for `gates` |
| 5dae707 | `site-pages.test.ts`, 16 tests | `Error: serveLandingPage is not implemented` / `Error: serveSelfHostPage is not implemented`. Two **pins** were green on landing: no site file imports `local-origin`, and the tool result is composed from `MCP_COPY.added` |
| eff9dd8 | `markdown-html.test.ts`, 12 tests; `generated-site.test.ts`, 2 tests | `Error: markdownHtml is not implemented`; `ENOENT: no such file or directory, open '.../src/site/generated/self-host-html.ts'` |
| 388cabe | `site-assets.test.ts` | `expected 0 to be greater than 0`; `ENOENT ... apps/api/src/site/landing-shots.ts`. The byte-copy test passed vacuously on the empty folder |
| aa666e6 | `self-host.test.ts` | `expected [ 'SITE_ORIGIN' ] to deeply equal []`; `expected [ 'api.todz.app' ] to deeply equal []` |

Green: b69ba1e, 855ac8b, 63bca02, 0b5d063, b593899; polish 4731d9e (the terminal command's words never break inside, e.g. inside `--header`).

**Red until the lead merges G1:** on this branch alone, two `self-host.test.ts` tests stay red ("every variable and secret it names is one the Worker reads", "every Wrangler key it asks a fork to edit …", both `expected [ 'SITE_ORIGIN' ] to deeply equal []`), because `SITE_ORIGIN` and the site routes live in G1's `env.ts` and `wrangler.jsonc`. In a throwaway worktree that merged `feat/landing-host` (3b7be63) and kept G2's `landing-page.ts` and `self-host-page.ts`, I got: typecheck clean, api 1076/1076, shape 228/228.

### Hypotheses for the tester

- `/` shows, in order: hero, three benefit cards, how it works, final call, footer. The page is one screen plus a short scroll at 1280 (the stage's top third sits above an 800 px fold).
- Light and dark switch on `prefers-color-scheme`. In dark mode the hero window is the dark shot (`<picture>`, D-B), while the popover and widget stay light.
- At 375 the window is hidden, the form stacks (input, then button), the benefits stack, and the terminal wraps with no horizontal scroll.
- With reduced motion the page is fully visible and still. Without it, the copy rises in order, the shots settle, and benefit cards and the terminal fade in on scroll where `animation-timeline: view()` is supported.
- `POST /join` from either form re-renders with "The waitlist opens soon." under both forms and never echoes the address. The script focuses the notice of the form named by the fragment (`#join` or `#final`), and a second submit while "Joining…" is ignored.
- `/self-host` renders the whole guide: ids on headings, code blocks that scroll by keyboard (`tabindex="0"`, `role="region"`), and no repository-relative links.
- Every inline style and script matches the CSP hash, so the console shows no CSP violation.

### Gaps

- **verify.sh does not run the unit gate for the guide row.** `verify.sh` derives the package from the path (`docs/self-host.md/package.json`), prints a `jq` error and `packages: -`, and a real run would call `pnpm --filter test:unit`. The case pins only the class and the gates. Fixing it needs `verify.sh`, which I don't own; reported to the lead.
- `LANDING_COPY.alt.windowDark` is unused: a `<picture>` cannot swap its `alt`, so the dark shot carries `alt.window`. The GitHub keys are unused, as decided.
- I added `selfHost.codeLabel` ("Code") to the copy for the code regions. It is not in design §4.
- The guide now says "a sender that only logs the link" instead of "a console sender". `api-source.test.ts` (G1) allows the word `console` in `email-sender.ts` only, and the generated module is a source file.
- Both lanes add `landing-page.ts` and `self-host-page.ts` (G1's are stubs), and both add this briefing: add/add conflicts. Keep G2's pages.
- Not changed, outside my files: the `apps/api` README paragraph about the site, and AGENTS.md's shared-helper line for `escapedHtml` (`apps/api/src/site/escaped-html.ts`). `plan.md` is unticked: the lead's prompt kept me out of it.
- The prose stylesheet has no table rules, because the guide has no tables and the renderer does not parse them. There is no favicon: `public/` holds no icon file, and a `data:` URL would need `img-src data:`.
- Scratch renders: headless Chrome with reduced motion, and images made eager in the scratch copy only. The 375 shots are a 375 px iframe inside a 500 px window, because a headless window is at least 500 wide. They live under `/private/tmp/claude-501/-Users-dhyegocalota-Projects-todz-todz/e625c263-20cc-4bdf-bc50-d9d128298c0f/scratchpad/g2/shots/`: `index-1280-light.png`, `index-1280-dark.png`, `index-375-light.png`, `index-375-dark.png`, `self-host-1280-light.png`, `self-host-375-dark.png`, `join-1280-light.png`.
