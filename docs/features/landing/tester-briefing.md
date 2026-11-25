# Tester briefing: landing

## G1: host dispatch

### What changed

- `apps/api/src/host-kind.ts`: `HostKind` and `hostKindOf({ request, env })` compare the request host with `PUBLIC_ORIGIN` (Api, wins a tie), `SITE_ORIGIN` (Site) and `www.` plus the site host (WwwRedirect); anything else is `null`.
- `apps/api/src/index.ts`: a `Record<HostKind, HostHandler>` in front of today's path dispatch; `null` answers `noRouteResponse()`. The Api handler is the previous behaviour.
- `apps/api/src/site/site-endpoint.ts`: `serveSite`, one route per method and path. `landing-page.ts` and `self-host-page.ts` are stubs; G2's versions replace them.
- `apps/api/src/http-status.ts` (not on the G1 list, needed for the two redirects): `MovedPermanently = 301`, `SeeOther = 303`.
- `wrangler.jsonc`: three custom domains and `SITE_ORIGIN`; `public/_headers`: nosniff; `package.json`: `SITE_ORIGIN` on every dev script and the new `dev:site`; `vitest.config.mts`: `SITE_ORIGIN` binding `http://localhost:8788`.
- R2 test moves: `mcp-client.ts`, `mcp-endpoint`, `mcp-tools`, `owner-isolation`, `owner-keys`, `sign-in-challenge-page`, `sign-in-page`, `worker` now use `http://localhost:8787`; `owner-sign-in` uses `PUBLIC_ORIGIN`; `sign-in-limiter` ("the configured binding refuses…") serves through `serveOwnerCall` with `{ ...env, PUBLIC_ORIGIN: PUBLIC_HTTPS_ORIGIN }`.
- `tools/repository-shape/src/api-source.test.ts`: pins the routes, `SITE_ORIGIN`, the dev scripts, `dev:site` and `_headers`.

### How to run

- `pnpm --filter @todz/api test:unit` (45 files, 1044 tests green), `pnpm --filter @todz/api typecheck`, `pnpm --filter @todz/repository-shape test:unit` (17 files, 224 tests green).
- `pnpm --filter @todz/api dev:site` runs the site instance on `http://localhost:8788`; `dev` stays on 8787.

### Red then green

| Test | Red commit | Printed | Green commit |
|---|---|---|---|
| `test/host-kind.test.ts` (18 tests) | `e2cc8ce` | 18 failed, each `Error: hostKindOf is not implemented: <request url> <number of env keys>` | `51cb1c7` |
| `test/site-dispatch.test.ts` (21 tests) | `5b5835a` | 11 failed: `expected 404 to be 200` (GET and HEAD `/` and `/self-host`, and `POST /join`), `expected 404 to be 303`, `expected 404 to be 301`, `expected 401 to be 404` (`/mcp`), `expected 503 to be 404` (`/owner/sign-in-method`), and `/sign-in` and `/sign-in/challenge` on the site host not answering 404; 10 already passed as pins (the API host, unknown hosts, `POST /`) | `5a21a36` |
| `api-source.test.ts` additions | none: edited with the configuration in `5a21a36`, so they are not red-first | | `5a21a36` |

Before the R2 moves, 186 api tests failed with 404 on `exports.default.fetch`; one more (`sign-in-limiter`) failed after the other moves because it needed a public `PUBLIC_ORIGIN`.

### Hypotheses

- Every API path on `api.todz.app` answers as before; on `todz.app` only `/`, `/self-host` (GET and HEAD) and `POST /join` answer.
- `www.todz.app/<path>?<query>` answers 301 to the same path and query on `todz.app`, keeping a port if present.
- `POST /join` never reads the request body, so a posted script never reaches the page.
- Static files (`/brand/*`, `/landing/*`) answer on every host with `X-Content-Type-Options: nosniff` once deployed (the headers file is pinned by text only; no run has seen the header).
- Under `dev` (8787) and `dev:site` (8788) the two hosts are told apart by port; not run here.

### Gaps

- `serveSite` takes only `{ request }`; `env` was left out because no route reads it yet.
- `landing-page.ts` and `self-host-page.ts` are stubs returning plain text bodies; the lead takes G2's versions at the merge.
- The `.test` host `api.todz.test` is gone from the Worker-reaching tests; `email-sender`, `sign-in-links`, `sign-in-guard` and `owner-routes` still use it because they never go through the default export.
- Deployment (the custom domains attaching, DNS) is not exercised.

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

## G3: the browser E2E and the `e2e` gate (`feat/landing-e2e`)

### What changed

- New dependency: `@playwright/test` 1.61.0, a devDependency of `apps/api` (exact pin). Its Chromium revision is 1228, the one installed where the doctor passes. `pnpm-lock.yaml` updated.
- `apps/api/playwright.config.ts`: a `webServer` that migrates and runs `wrangler dev` on port 8791 (inspector 9291), `--local-upstream localhost:8791`, `SITE_ORIGIN` the same origin, `--persist-to` a fresh folder under the system temporary directory (R17). `reuseExistingServer` is off, so a busy port fails loudly. Two projects: `desktop` 1280x800 and `mobile` 375x812. Bundled Chromium when installed, else the system Chrome channel.
- `apps/api/e2e/landing.spec.ts` (17 specs per project, 34 runs) and `e2e/project-name.ts`. `test:e2e` script. `e2e` and `playwright.config.ts` join `tsconfig.scripts.json` only.
- `scripts/verify.sh`: `e2e` gate after `unit` and before `macos`, running `pnpm --filter @todz/api test:e2e`. `scripts/verify-gates.tsv`: rows for `apps/api/src/site/*`, `apps/api/public/*`, `apps/api/e2e/*` and `apps/api/playwright.config.ts` (`typecheck unit e2e`) above `apps/*`; a 4th optional column names the package folder of a unit row (`docs/self-host.md` and the environment template both name `apps/api`). `verify.yml` and `ci-workflow.test.ts` enumerate no gates, so neither changed. `.gitignore` already covered `test-results/` and `playwright-report/`.

### How to run

- `pnpm --filter @todz/api test:e2e` (starts its own server; ports 8791 and 9291 must be free) and `bash scripts/verify.test.sh`.
- Green at the end of the lane: E2E 32 passed and 2 skipped over 34 runs (the 1280-only fold spec on mobile, the 375-only spec on desktop); typecheck, api unit (45 files), repository-shape (229 tests) and `verify.test.sh` green.

### Red and pin

| Commit | What | Result |
|---|---|---|
| d2541f7 | `verify.test.sh`, 11 checks | red: `FAIL the self-host guide: packages: expected 'packages: @todz/api', got 'packages: -'`; `FAIL apps/api/src/site/landing-page.ts: gates: expected '... shape unit e2e', got '... shape unit'`; five lines expecting `... unit e2e macos` for the everything class |
| 502cd44 | `verify.sh`, `verify-gates.tsv` | green |
| 682135c | `landing.spec.ts` | pin: every spec but two is green against the page as merged |

The specs are pins, not red-first: the page was already built.

### Product defect found

- **The notice focus is lost after a join answer** (both forms, both projects). The specs "the join form's notice is focused after the answer" and "the final form's notice is focused after the answer" are marked `test.fail()`. Printed: `expect(locator).toBeFocused() failed`, `Expected: focused`, `Received: inactive`. Cause, from a focus log: the page script focuses `#join-notice` while the document is still loading, and Chromium blurs it (`focusout join-notice interactive`) when it scrolls to the `#join` fragment. Design 6 promises a focused notice. A likely fix is focusing after the fragment scroll (on `load`, or in a `requestAnimationFrame`); not applied, this lane never edits product code. When fixed, delete the two `test.fail` lines.

### Findings that are not defects

- Lazy images: with a real per-image scroll, every visible image on `/` reaches `naturalWidth > 0` at 1280 and 375 in the light scheme (the two blank images of the earlier headless render were that render, not the page). The dark 375 case is not loaded separately.
- Reduced motion: the page keeps 120 ms transitions on `color`, `background-color` and `opacity` (the design), so the spec asserts no animation and no transition on any other property, not `0s` everywhere.
- Focus ring: the email input draws its ring on `.join-capsule`, so the spec accepts the input's own outline or its capsule's.
- The hero window is hidden at 375, so "the hero shot fits" covers every visible `.desk-stage` image.

### Hypotheses for the tester

- The final form's answer lands on `/join#final` with no address anywhere in the DOM.
- The persisted folder is new each run; the system temporary directory accumulates `todz-e2e-*` folders.
- Without a bundled Chromium the config falls back to the system Chrome channel; not run here.
- `pnpm verify` selecting `e2e` for a site change is pinned by `verify.test.sh` only; the real gate was not run.

### Gaps

- `--inspector-port 9291` is fixed, so two concurrent runs collide.
- The `list` reporter writes no `playwright-report/`; the ignore entries stand for the day it does.
