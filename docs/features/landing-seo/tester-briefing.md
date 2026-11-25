# Tester briefing: Landing SEO

Written by the developer sub-agents when their steps are done. A developer does not run `test-plan.md` and does not declare the feature works. Each lane writes only its own section.

## Lane H

### What changed

Lane H is done: plan steps 2 to 18 (step 1 is G0's). `origin/main` was merged twice: with `security-fixes` (before steps 3 and 5) and with `docs-cutover` (`93003fe`, before the gate), which made `/self-host` a 301, deleted `self-host-page.ts` and the generator, and dropped `test/site` from three API configs; the merge restores `test/site` there (`dfbbf73`) because Lane I's asset tests live in it.

- Head (steps 2 and 3): `site-shell.ts` writes `SiteDocument` as a union on `kind` (`SitePageKind.Public` with `path` and `structuredData`, `Private` without) and a `scripts: string[]` list; public pages get the canonical, the Open Graph and Twitter tags, the touch icon and the manifest link, every page the two favicon links; `site-headers.ts` hashes the list. The admin pages moved to the list shape and the private kind and changed nothing else. `landing-copy.ts` gains `meta.siteName`.
- JSON-LD and policy (steps 4 and 5): `site-json-ld.ts` (`LANDING_STRUCTURED_DATA`, one `@graph` with `Organization`, `WebSite`, `SoftwareApplication`, every `<` escaped as `<`), `COMPANY.logo`, `manifest-src 'self'`, `Cache-Control: no-cache, no-transform` with the ADR pointer. The landing's policy hashes `[structured data, page script, WebMCP script]`.
- Agent setup (steps 6 and 7): `agent-setup.ts`, pinned to `AgentCommand.swift` by `tools/repository-shape/src/agent-setup.test.ts`; `landing-copy.ts` takes the terminal line from it.
- Discovery (steps 8 to 11): `discovery-copy.ts` (facts, the docs page list, the tool parameters, the card text, the catalog's queries), `discovery-response.ts` (`discoveryResponse`, the open-read headers), `site-discovery.ts` (the bodies, built at module load), `mcp-server-card.ts` (the card and `serveServerCard`, GET and HEAD only), one line in `index.ts`'s path table for `/mcp/server-card`, `export` on `MCP_SERVER_VERSION`, and the routes in `site-endpoint.ts`.
- WebMCP (steps 12 and 13): `webmcp-copy.ts`, `webmcp-script.ts` (`WEBMCP_TOOLS`, one fixed `WEBMCP_SCRIPT`), `join-form-markup.ts` (the form class names `landing-page.ts` and the script share).
- Browser checks and the ratio fix (steps 14 and 15): `apps/api/e2e/landing-seo.spec.ts`, `e2e/model-context-stub.ts`; `site-style.ts` hides the mobile window shot with `visibility:hidden` instead of `display:none`, so it keeps a box.
- Performance (step 16): the landing's shots carry `srcset` and `sizes` from Lane I's WebP copies, the PNG staying the `src`.
- Not in the plan, decided here (step 16a): the public pages allow `connect-src 'self'`. Lighthouse fetches `robots.txt`, `llms.txt` and the catalog from inside the page, and with `default-src 'none'` the three audits (`robots-txt`, `llms-txt`, `ard-schema`) fail with "Protocol error (Network.loadNetworkResource): CSP violation". Measured on `wrangler dev`: Agentic browsing 60 and SEO 92 without it, 100 and 100 with it. The landing still makes no `fetch` call (`join_waitlist` calls `requestSubmit()`), so the directive permits what no script uses; ADR 0060 § 7 says "everything else stays 'none' or 'self'", which it does, but the spec's goal 9 ("nothing else widens") and the ADR's note that `connect-src` stays absent read otherwise. The two commits (`1a239e5`, `2d3fca5`) revert together if the lead disagrees, and then the three audits go red again.
- Outside the lane's file map, each small: `apps/api/e2e/landing.spec.ts` (the two window-shot assertions accept the WebP copy the browser picks, because `currentSrc` is no longer the PNG), `apps/api/test/site-pages.test.ts` beyond the policy rows (the remote-asset pattern skips the canonical link; the landing now has two plain scripts; the self-host rows left with the page), `apps/api/tsconfig.json`, `tsconfig.scripts.json` and `vitest.config.mts` (restored `test/site`).
- Docs: `docs/runbooks/deploy-the-api.md` step 16 (the landing's discovery files, icons and scores), "Record the run" is 17; `apps/api/README.md`; `AGENTS.md` names `discoveryResponse`. `runbooks.test.ts` needed no change: its generic rows (numbering, `If it fails`, scripts that exist, no command the secrets guard refuses) cover the new step.

### How to run

```bash
pnpm --filter @todz/api exec vitest run
pnpm --filter @todz/api exec playwright test
pnpm --filter @todz/api exec tsc --noEmit
pnpm --filter @todz/api exec tsc --noEmit -p tsconfig.scripts.json
pnpm --filter @todz/api run site:assets:check
pnpm --filter @todz/repository-shape exec vitest run
pnpm --filter @todz/types exec vitest run
```

Lighthouse, as the plan describes (a dev server on 8788, the Chromium of `@playwright/test`, three runs):

```bash
pnpm --filter @todz/api exec wrangler dev --port 8788 --local-upstream localhost:8788 --var SIGN_IN_PROVIDER:fake --var EMAIL_SENDER:console --var PUBLIC_ORIGIN:http://localhost:8787 --var SITE_ORIGIN:http://localhost:8788 --var ADMIN_EMAIL:admin@todz.test --var TURNSTILE_SITE_KEY:1x00000000000000000000AA --var TURNSTILE_SECRET_KEY:1x0000000000000000000000000000000AA
CHROME_PATH=~/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/"Google Chrome for Testing.app"/Contents/MacOS/"Google Chrome for Testing" pnpm dlx lighthouse@13.6.0 http://localhost:8788/ --chrome-flags="--headless=new" --quiet --output=json --output-path=stdout > landing-1.json
```

### Red today, green after

Failure texts are what the red runs printed, never the ones expected. After the merge of `security-fixes` the red tests of steps 2 and 4 were rerun on the merged tree (`1dbb3d1`): 23 failed, 77 passed across `site-head`, `site-json-ld` and `site-pages`, with the texts below.

| Test | Red before the change because | Green after because |
|------|--------------------------------|---------------------|
| `apps/api/test/site-constants.test.ts` (pin) | not red first: G0's constants have no behaviour to fail | pins every value of `site-urls.ts` and `site-icons.ts` |
| `site-head.test.ts` canonical, Open Graph and Twitter, icon and manifest links (landing) | `AssertionError: expected [] to deeply equal [ { rel: 'canonical', … } ]`; every `og:*` array empty; `expected [] to deeply equal [ { rel: 'icon', href: '/favicon.ico', sizes: '48x48' }, … ]` | step 3, `5602a31` |
| `site-head.test.ts` private pages favicon rows (two) | `AssertionError: expected [] to deeply equal [ '/favicon.ico', '/icon.svg' ]` | step 3 |
| `site-json-ld.test.ts` (landing rows and the organization row) | `Error: the page holds exactly one application/ld+json block` | steps 4 and 5, `f39ecd2` |
| `site-pages.test.ts` JSON-LD hash, manifest and cache rows | `Error: the page has exactly one inline element of that kind`; `AssertionError: expected [ 'default-src \'none\'', … ] to include 'manifest-src \'self\''` | step 5 |
| `libs/types/src/constants.test.ts` company row | `AssertionError: expected { tradeName: 'Logic Bit', …(2) } to deeply equal { tradeName: 'Logic Bit', …(3) }` | step 5 (`COMPANY.logo`) |
| `agent-setup.test.ts` three client rows | `Error: agentSetup is not implemented` | `92d1e34` (step 7) |
| `site-discovery.test.ts` (20 of 26 red, `1b608fe`) | `AssertionError: expected 404 to be 200 // Object.is equality` for every GET, HEAD and body row | step 9, `6efbb35` |
| `mcp-server-card.test.ts` (8 of 15 red, `dfcc669`) | `SyntaxError: Unexpected end of JSON input` (card and catalog bodies empty), `AssertionError: expected 404 to be 200`, `expected 0 to be greater than 0` | step 11, `ffab11e` |
| `webmcp-tools.test.ts` (5 of 6 red, `0cdfcaf`) | `AssertionError: expected [] to deeply equal [ 'get_todz_overview', …(3) ]`; `expected 0 to be greater than 0`; `Error: the tool get_mcp_setup is defined` | step 13, `86a5f9f` |
| `landing-seo.spec.ts` WebMCP rows (18 of 20 red, desktop and mobile) | `expect(received).toEqual(expected) - Expected - 18 + Received + 1` (no tool registered); `page.evaluate: TypeError: Cannot read properties of undefined (reading 'tool')`; `TimeoutError: page.waitForURL: Timeout 15000ms exceeded`; `expect(locator).toHaveText(expected) failed … element(s) not found` | step 13 |
| `landing-seo.spec.ts` ratio row, mobile and dark (`eb4ece3`) | `Error: images off by more than 1 %`, the dark window shot: `displayed: 1.5794…` against its file's 1.88 | step 15, `0e30fe5` |
| `site-pages.test.ts` policy rows (11 red, `1a239e5`) | `AssertionError: expected 'default-src \'none\'; script-src \'sh…' to be 'default-src \'none\'; script-src \'sh…'`; `expected [ 'default-src \'none\'', …(7) ] to include 'connect-src \'self\''` | step 16a, `2d3fca5` |
| `site-pages.test.ts` WebP row (`11a8d67`) | `AssertionError: expected '<!doctype html>\n<html lang="en">\n<h…' to contain 'srcset="/landing/mac-app-shell/04-ins…'` | step 16, `370285c` |

Pins (green when they landed, never stand in for red-first): the site-head GET and HEAD parity, title, description, `lang`, the two theme colours, one `h1` and the landmarks, `HEAD / carries the headers, not the head`; the shape-table self-checks; the landing page-script hash and the no-`'unsafe-inline'` and no-inline-handler rows; `agent-setup.test.ts` (templates found, the terminal line); in `site-discovery.test.ts` the 404 rows on the API host, to POST and with a trailing slash, and the `www` 301; in `mcp-server-card.test.ts` the `POST /mcp` 401 row, and the catalog's `POST` and `OPTIONS` 404 rows; in `webmcp-tools.test.ts` the self-host row; in `landing-seo.spec.ts` the "no model context" row, every icon, manifest and share-image row, the console and policy-violation rows and the light-scheme ratio row.

### Hypotheses to attack

Every "it works" is a hypothesis the tester tries to break.

1. `agentSetupOf` returns for the three clients exactly what `AgentCommand.swift` produces; changing a Swift literal turns `agent-setup.test.ts` red; the landing's terminal line did not change by one character.
2. Every public page has exactly one title, description and canonical; the admin pages have only the title and favicon links. Look at the HTML of `/`, `/admin` signed out, and the link page.
3. The landing's CSP lists three hashes (JSON-LD, page script, WebMCP) and `connect-src 'self'`; no `'unsafe-inline'` anywhere; every inline `<script>` in the HTML is in the list (a console with no `securitypolicyviolation`).
4. `robots.txt`, `sitemap.xml`, `llms.txt`, `llms-full.txt`, `site.webmanifest`, `ard.json` and both cards answer GET and HEAD with the types of the spec and nothing else (POST, OPTIONS, trailing slash, the API host: 404). The sitemap holds `https://todz.app/` only, and nothing in `llms.txt` links `todz.app/self-host`.
5. The card carries no key and no tools; `GET <api>/mcp/server-card` and `GET <site>/.well-known/mcp/server-card.json` return the same bytes; `POST /mcp` without a bearer still answers 401.
6. With a `document.modelContext` the four tools register once; with only `navigator.modelContext` they register there; with both, only on `document`; with neither, nothing and no console error. `join_waitlist` posts `POST /join` once with `cf-turnstile-response`, answers "invalid" for a bad address with no request, and "already submitting" on a second call while the token is pending. Try a thrown `registerTool`, a rejected one, and a `join_waitlist` call before the widget loads.
7. Nothing visible changed on the landing at 1280 and 375, light and dark; compare screenshots with `main`. `.shot-window` is `visibility:hidden` below the desktop breakpoint: check no horizontal scroll, no focus trap and nothing read aloud from it.
8. Lighthouse (phone profile, local, three runs each, `wrangler dev`): see the numbers below. Run it in a light and a dark OS appearance: the headless Chromium followed the OS scheme on this machine, and the dark window shot is what the ratio audit flagged.

### Local Lighthouse, Lighthouse 13.6.0, phone profile, Chromium 149

After the lane's last commit, on `wrangler dev` (`http://localhost:8788`), Performance, Accessibility, Best Practices, SEO, Agentic browsing:

| Page | Run 1 | Run 2 | Run 3 | Median |
|------|-------|-------|-------|--------|
| `/` | 100, 100, 100, 100, 100 (FCP 0.6 s, LCP 0.6 s, TBT 0 ms, CLS 0) | 100, 100, 100, 100, 100 (TBT 0 ms) | 100, 100, 100, 100, 100 (TBT 0 ms) | 100, 100, 100, 100, 100 |
| `/self-host` (before `docs-cutover` made it a redirect) | 100, 100, 100, 100, 100 | 100, 100, 100, 100, 100 (TBT 10 ms) | 100, 100, 100, 100, 100 | 100, 100, 100, 100, 100 |

Before the two fixes (one run each, noisy: the machine was loaded, TBT 940 ms): without step 15 and 16a, `/` scored 79, 100, 96, 92, 60, failing `image-aspect-ratio` (the dark window shot, 1600 x 1013 attributes against a 1600 x 851 file, box 0 x 0), `robots-txt`, `llms-txt` and `ard-schema` ("CSP violation"). With only `connect-src 'self'` added: 100, 100, 96, 100, 100, `image-aspect-ratio` still failing. The reports are in the lane's scratchpad, not in the repository. The acceptance is on production (step 25); no performance fix was needed, so step 26 should not open.

### Known gaps

- The test plan says to record every run's five scores in `test-plan.md`; that file is the lead's, so the numbers are here.
- `sizes` is the smallest WebP width (`min` of the copies), which is each shot's 1x width. Measured at 1280 and 375, the popover (299 and 269 px shown against 311), the medium widget (391 and 291 against 408) and the ring (182 and 182) are covered; the window shot (760 against 760 at 1280, hidden at 375) too; the agent-tasks shot is displayed at 904 px at 1280 and 877 px at 375 against a 1x width of 828, so a device at pixel ratio 1 gets the 828 copy slightly enlarged (about 9 %). Lane I's widths for it assume a smaller box. Fix in Lane I's `landing-shots.ts` data (a 1x width of about 910), not in the page.
- The `join_waitlist` answer "sent" is the tool's answer; the result of the join is the page the form lands on. An agent that needs the notice reads the page after the navigation.
- `/self-host` is not covered anywhere in this lane any more (it is a 301 on `main`): no head, JSON-LD or Lighthouse rows. `webmcp-tools.test.ts` keeps one self-host row that holds on an empty body.
- The deploy runbook's step 16 runs Lighthouse on the landing only, not on `/self-host`, for the same reason.
- Runbook step 16 has no test of its own: `runbooks.test.ts` is in the file map only when it counts steps, and it does not. A row that pins the discovery paths in that step would be an addition for the lead.
- `docs-pages.test.ts` (step 24) is the lead's; `DOCS_PAGES` in `discovery-copy.ts` lists the five slugs `introduction`, `quickstart`, `connect-an-agent`, `mcp-tools`, `self-host`, the last one titled "Self-host todz" as on the docs site.
- The JSON-LD test fixes choices the spec leaves open: `<script type="application/ld+json">` with no other attribute, the offer's `price` the number `0`, and the `SoftwareApplication` `url` `https://todz.app/`. The plan said eleven Open Graph and Twitter tags; the spec lists ten (nine `og:*` and `twitter:card`), and `site-head.test.ts` pins ten.
- The shape table's `required` lists are what the spec's graph carries (Google names no required property for `Organization` and `WebSite`).
- The e2e drives a `modelContext` stub; no real Chrome with the WebMCP flag or origin trial ran it. The Chrome origin trial token is an owner step.

## Lane I

### What changed

- `apps/api/scripts/site-assets/` (new): `cli.ts` (`generate`, `check [root]`), `site-assets.ts` (the renderer, the input lock and `staleInputsOf`), `ico-file.ts` (`icoBytes`), `png-size.ts` (`pngSizeOf`), and `site-assets.lock.json` (SHA-256 of 18 inputs: every `docs/brand/*` file, the six landing shots, `site-icons.ts`, `landing-shots.ts`, the four generator sources).
- `apps/api/package.json`: `site:assets` and `site:assets:check`.
- `apps/api/public` (generated, committed): `favicon.ico` (16, 32, 48 PNG entries cropped to the squircle), `icon.svg` (the brand icon cropped to the squircle, with a dark-scheme gradient rule), `apple-touch-icon.png` 180 and `icon-maskable-192.png` / `icon-maskable-512.png` (full-bleed gradient, mark spanning 77 % of the side), `icon-192.png` / `icon-512.png` (squircle, transparent corners), `og/todz.png` (1200×630: lockup above the dark window shot, bleeding off the bottom), and 12 WebP copies of the landing shots (lossy 0.82, alpha kept).
- `apps/api/src/site/landing-shots.ts`: each `ShotFile` gains `webp: { path, width }[]` (data only; the widths are 1x and 2x of the box each shot fills at 1280 and 375, estimated from the CSS measures, not measured in a browser). Lane H's step 16 reads these for `srcset`.
- `docs/runbooks/render-the-brand-assets.md`: new step 8 (render the site assets); the proof step is now 9.
- Tests: `apps/api/test/site/ico-file.test.ts`, `apps/api/test/site/site-assets.test.ts` (node project; the test carries its own small PNG decoder, no new dependency).

### How to run

```bash
pnpm --filter @todz/api exec vitest run --project node test/site/site-assets.test.ts test/site/ico-file.test.ts
pnpm --filter @todz/api site:assets:check
pnpm --filter @todz/api site:assets
```

### Red today, green after

Red commit `7ff890d`, green `cadb57f` (ICO) and `da36fc3` (generator and outputs). The printed failures at the red commit (45 + the ICO suite):

| Test | Red before the change because | Green after because |
|------|--------------------------------|---------------------|
| `ico-file.test.ts` (4 rows) | suite error `Error: icoBytes is not implemented for 3 images` | `icoBytes` writes header, entries and PNGs |
| `site-assets.test.ts` icon rows (`<icon> exists under public`, IHDR size, favicon, `icon.svg`, full-bleed, Open Graph, WebP rows) | `AssertionError: …/apps/api/public/favicon.ico exists: expected false to be true` (the same message per output path) | `pnpm site:assets` wrote the files |
| `site-assets.test.ts` `exits 0 on the committed tree` | stderr held `throw new Error(\`staleInputsOf is not implemented for ${root}\`)` instead of `''` | the lock matches the inputs |
| `site-assets.test.ts` mutation rows and `exits 1 naming the stale input…` | `AssertionError: apps/api/scripts/site-assets/site-assets.lock.json exists: expected false to be true` | the lock exists and `staleInputsOf` names the one changed input |

No pins in this lane: every test was red at `7ff890d`.

### Hypotheses to attack

Every "it works" is a hypothesis the tester tries to break.

1. The favicon at 16 and 32 pixels is legible in a browser tab (light and dark tab strips), and `icon.svg` takes the lifted gradient only under a dark scheme.
2. The touch icon and maskable icons survive a circular and a squircle mask: the white check stays inside a circle of radius 0.4 of the side; the mint spark can reach 0.45 and is not covered by the test.
3. `og/todz.png` reads well as a share card (the lockup background matches the page background without a seam, nothing important is cut).
4. Each WebP is visually the same as its PNG at its width, with no black corners (alpha kept), and its width equals the entry in `landing-shots.ts`.
5. `site:assets:check` goes red when any one input changes, with no browser: change one byte in a `docs/brand` file, a shot, either constant module or a generator file, and the named input is the one changed. Adding a new file under `docs/brand` or `scripts/site-assets/` also fails it.
6. Re-running `pnpm --filter @todz/api site:assets` on an unchanged tree rewrites the PNGs and WebPs, possibly with different bytes on another machine; the lock still holds (it hashes inputs only).

### Known gaps

- The WebP widths are estimates from the CSS (page measure 1152 at 1280, 343 at 375), not measured from rendered boxes; Lane H's step 16 or the walk may ask for another width.
- The renderer needs the pinned Chromium (`@playwright/test` 1.61.0) installed; it does not install it.
- `site-assets.ts` holds the lock, the SVG builders and the renderers in one file, because the file map names no other module.
- The 192 and 512 `any` icons have transparent corners (the squircle); only the touch icon and the maskable pair are full-bleed.
- `pnpm verify` stops red at `tools/repository-shape/src/site-assets.test.ts` (no lane owns it): it expects every file under `apps/api/public/landing` to be a byte copy of a README screenshot, so the 12 WebP files fail its first and third rows. Left unedited per the ownership list; the fix is to filter `SERVED` to the `.png` files. `apps/api` typecheck, the full `apps/api` unit run (1740 tests) and `site:assets:check` are green.
- The runbook index row (`docs/runbooks/README.md`) still describes only the app icon and menu bar glyph; the file belongs to no lane.


## Fix round 1

The lead's decisions after review, security review and the first test run. Red commit `574837f`, green `160a829`, pin `2e7344e`, shared module `83cf057` (with `6064cae`, which keeps `site-style.ts`'s page colour literal because `tools/repository-shape/src/docs-site.test.ts` reads it from the source), runbook log `9a3afc0`, documents `ca4b19d`.

### What changed

- S3: `siteContentSecurityPolicy` takes `declaresManifest`; the landing passes `true`, the three admin policies and the link page `false`, so they are as on `main` (no `manifest-src`).
- R4 and T2: `join_waitlist` answers `WEBMCP_COPY.answers.sent` ("The form was submitted. The page may ask the person for a quick human check before it finishes, and then shows the result."), puts the typed value back on the invalid path, and its `email` property has `format: "email"` (`WebMcpProperty` gains `format?`).
- T5: `.shot-window` is `display:none` below the desktop breakpoint (`display:block` from it), and the window `<img>` is `loading="lazy"` (the `isEager` parameter and `fetchpriority="high"` left `landing-page.ts`). `landing.spec.ts`: the two window-shot `complete` rows run on desktop only (a phone does not load the image now); the dark tokens row runs on both.
- R5: `inputPathsOf` takes `docs/brand` files by `svg` and `png` extension; `site-assets.lock.json` regenerated (`pnpm site:assets` rewrote no image: the outputs are byte-stable on this machine).
- S2: `apps/api/public/_headers` gains the `/icon.svg` rule; `api-source.test.ts`'s pattern pins it.
- R3: `apps/api/src/site/site-constants.ts` (`DARK_THEME_COLOR`, `KEY_PLACEHOLDER`, `scriptJson`), imported by `site-discovery.ts`, `site-shell.ts`, `landing-copy.ts`, `webmcp-script.ts`, `site-json-ld.ts`. The tests keep their own literals as an independent oracle.
- R1, R2, S4: ADR 0060's dated addendum (and its Consequences and Revisit bullets), spec goals 1, 3, 6, 7, 9 and 11, the data-flow line, the non-goals, the failure-handling line; plan wording in the test plan (rows 10, 17, 22, 97, 102, 118, 120, the window-shot edge case, a new "Fix round 1" block of rows, all unticked).
- Runbooks: the 15 docs-cutover deploy rows at `26842db` appended to `deploy-the-api.md`'s run log; the Mintlify step 5 line is a row (`| 2026-11-25 | 26842db | 5 |`) in `mintlify-publish.md`'s run log.

### Red today, green after

| Test | Red text (printed at `574837f`) | Green after |
|------|---------------------------------|-------------|
| `admin-pages.test.ts` "allows no manifest, which only the public pages declare" (9 rows) | `AssertionError: expected 'default-src \'none\'; script-src \'sh…' not to contain 'manifest-src'` (the panel rows: `expected 'default-src \'none\'; style-src \'sha…' not to contain 'manifest-src'`) | `160a829` |
| `webmcp-tools.test.ts` "ask for the waitlist address by its email format" | `AssertionError: expected undefined to be 'email' // Object.is equality` | `160a829` |
| `webmcp-tools.test.ts` "says the form was submitted…" | `AssertionError: expected 'The form was sent. The page shows the…' to contain 'submitted'` | `160a829` |
| `site-pages.test.ts` "keeps the window shot, which a phone never shows, from loading there" | `AssertionError: expected '<picture><source media="(prefers-colo…' to contain 'loading="lazy"'` | `160a829` |
| `site-assets.test.ts` "ignores a stray file beside the brand sources" | `AssertionError: expected [ 'docs/brand/.DS_Store' ] to deeply equal []` | `160a829` |
| `api-source.test.ts` "every static file answers with nosniff … and the icon with a policy that allows no script" | `AssertionError: expected '/*\n  X-Content-Type-Options: nosniff…' to match /…/` | `160a829` |
| `landing-seo.spec.ts` "join_waitlist puts the previous value of the field back…" (desktop and mobile) | `Error: expect(locator).toHaveValue(expected) failed` … `Expected: "maria.desktop.…@example.com"` `Received: "not-an-address"` | `160a829` |
| `landing-seo.spec.ts` "downloads no window shot on a phone…" (mobile, light and dark) | `Error: expect(received).toEqual(expected)` … `+ "/landing/v1-walk/01-agent-tasks-in-a-project-760.webp"` (dark; the light run printed the light shot's 760 copy) | `160a829` |

Pins: `site-assets.test.ts` "icon.svg holds nothing active" (four rows, in `574837f`), `webmcp-tools.test.ts` "the scripts the landing ships" (two rows, `2e7344e`), `site-constants.test.ts` "the shared site values" (two rows, `83cf057`).

### Results

- `pnpm --filter @todz/api exec vitest run`: 74 files, 1867 tests green (after `83cf057`); `tsc --noEmit` for both configs clean; `site:assets:check` exit 0; `tools/repository-shape` 323 tests green; e2e `playwright test`: 109 passed, 6 skipped (desktop and mobile).
- Local Lighthouse 13.6.0, phone profile, `wrangler dev` on 8788, Chromium 149, three runs, Performance, Accessibility, Best Practices, SEO, Agentic browsing: run 1 100, 100, 100, 100, 100; run 2 100, 100, 100, 100, 100; run 3 100, 100, 100, 100, 100 (FCP 0.6 s, LCP 0.6 s, TBT 0 ms each); `image-aspect-ratio` passes with the window shot `display:none` and lazy. The only audits under 1 are informative insights (`image-delivery-insight` 0.5, `network-dependency-tree-insight` 0). Light appearance only.

### Hypotheses to attack

1. A phone (375, device ratio 1 and 2, light and dark) requests neither window shot copy; a desktop (1280) still loads the right one for its scheme; resizing a desktop window below 40rem and back keeps the shot (it loads when the box appears).
2. Resizing across the breakpoint with the dark scheme on loads the dark copy once, no console error, no layout shift.
3. The landing's policy still carries `manifest-src 'self'` and `connect-src 'self'` exactly once each; `/admin`, `/admin/sign-in` and the panel carry no `manifest-src`, and no `connect-src` except the link page, as on `main`.
4. `join_waitlist` with an invalid address leaves what the person typed in the field; with a valid address it still posts once with the token, and its answer no longer claims the join worked.
5. `curl -sS -D - http://localhost:8788/icon.svg` shows the `/*` headers and the `Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'` rule beside them (`wrangler dev` serves `_headers` for assets; if it merges differently the live check after the deploy decides).
6. A `.DS_Store` dropped into `docs/brand` leaves `site:assets:check` green; a changed `docs/brand/*.svg` or `.png` still fails it.

### Known gaps

- Lighthouse ran in a light appearance only. The dark phone case is covered by the e2e request check, not by Lighthouse.
- The window shot is now lazy and not `fetchpriority="high"` on a desktop: Lighthouse is mobile-only here, so a desktop LCP change is not measured.
- `site-style.ts` keeps its own `#070812` (R3 left it out because `docs-site.test.ts` reads that file's source).
- The `/icon.svg` header is proven by the shape test on the file and by a live curl after the deploy (test-plan "Fix round 1"), not by a unit test of Cloudflare's asset layer.
- The new test-plan rows are unticked; they are the tester's.
