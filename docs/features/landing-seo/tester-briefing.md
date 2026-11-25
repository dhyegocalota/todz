# Tester briefing: Landing SEO

Written by the developer sub-agents when their steps are done. A developer does not run `test-plan.md` and does not declare the feature works. Each lane writes only its own section.

## Lane H

### What changed

Partial: only steps 2, 4, 6 and 7 are done (the ones disjoint from `security-fixes`' Lane W). Steps 3 and 5 and everything after (8 to 18) are pending the `security-fixes` merge to `main` and the lead's merge of it into `lane/landing-seo-h` (plan → Sequencing 3).

- Step 2 (`43a383a`, red): `apps/api/test/site-head.test.ts`.
- Step 4 (`26fcec2`, red): `apps/api/test/site-json-ld.test.ts`, `libs/types/src/constants.test.ts` (`COMPANY.logo`), and a new `describe` at the end of `apps/api/test/site-pages.test.ts` (hashes, `manifest-src`, `Cache-Control`, no `'unsafe-inline'`, no inline handler).
- Step 6 (`0df5fbf`, red): `tools/repository-shape/src/agent-setup.test.ts` with a stub `apps/api/src/site/agent-setup.ts`.
- Step 7 (`92d1e34`, green): `apps/api/src/site/agent-setup.ts` (`AgentClient`, `agentSetupOf`), and `landing-copy.ts`'s `terminal.command` now comes from it.

### How to run

```bash
pnpm --filter @todz/api exec vitest run test/site-head.test.ts test/site-json-ld.test.ts test/site-pages.test.ts
pnpm --filter @todz/types exec vitest run src/constants.test.ts
pnpm --filter @todz/repository-shape exec vitest run src/agent-setup.test.ts
```

### Red today, green after

| Test | Red before the change because | Green after because |
|------|--------------------------------|---------------------|
| `apps/api/test/site-constants.test.ts` (pin) | not red first: the constants have no behaviour to fail; step 1 of G0 | pins every value of `site-urls.ts` and `site-icons.ts` |
| `site-head.test.ts` `canonical link` (both pages) | `AssertionError: expected [] to deeply equal [ { rel: 'canonical', … } ]` | step 3 |
| `site-head.test.ts` `Open Graph and Twitter tags` (both pages) | `AssertionError: expected { 'og:title': [], … } to deeply equal { … }`, every `og:*` array empty | step 3 |
| `site-head.test.ts` `icon links and the manifest link` (both pages) | `AssertionError: expected [] to deeply equal [ { rel: 'icon', href: '/favicon.ico', sizes: '48x48' }, … ]` | step 3 |
| `site-head.test.ts` private pages favicon rows (two) | `AssertionError: expected [] to deeply equal [ '/favicon.ico', '/icon.svg' ]` | step 3 |
| `site-json-ld.test.ts` (eleven rows: parseable block, types, shape table, references, exact values, both pages, plus the organization) | `Error: the page holds exactly one application/ld+json block` (the organization row: `expected …toMatchObject` with no block, the same error) | steps 4 and 5 |
| `site-pages.test.ts` JSON-LD hash (both pages) | `Error: the page has exactly one inline element of that kind` | step 5 |
| `site-pages.test.ts` manifest and cache rows (both pages) | `AssertionError: expected [ 'default-src \'none\'', … ] to include 'manifest-src \'self\''` | step 5 |
| `libs/types/src/constants.test.ts` company row | `AssertionError: expected { tradeName: 'Logic Bit', …(2) } to deeply equal { tradeName: 'Logic Bit', …(3) }` | step 5 (`COMPANY.logo`) |
| `agent-setup.test.ts` three client rows | `Error: agentSetup is not implemented` | `92d1e34` (step 7) |

Pins (green when they landed, never stand in for red-first): `site-head.test.ts` GET/HEAD header parity, title and description, `lang` and the two `theme-color` tags, one `h1` and the four landmarks, `HEAD / carries the headers, not the head`; `site-json-ld.test.ts` the two shape-table self-checks; `site-pages.test.ts` the landing page script hash and the no-`'unsafe-inline'` and no-inline-handler row (admin pages through `/admin` and `/admin/sign-in`); `agent-setup.test.ts` the templates-found row and `LANDING_COPY.terminal.command` equals the Claude Code line.

### Hypotheses to attack

Every "it works" is a hypothesis the tester tries to break.

1. `agentSetupOf` returns, for the three clients, exactly what `AgentCommand.swift` produces for `MCP_URL` and `<key>`; the Codex block is the config followed by a newline and the `export TODZ_API_KEY='<key>'` line; the Cursor JSON is `JSON.stringify` at two spaces.
2. Changing a Swift literal (the server name, the key variable, the Claude Code line) turns `agent-setup.test.ts` red.
3. The landing's terminal line did not change by one character after `landing-copy.ts` took it from `agentSetupOf`.

### Known gaps

- Steps 3, 5 and 8 to 18 are not done: the green for the head, the JSON-LD and the policy waits for `security-fixes` (Sequencing 3). After that merge the red tests above must be rerun and recorded again.
- The plan says eleven Open Graph and Twitter tags; the spec lists ten (nine `og:*` and `twitter:card`). `site-head.test.ts` pins those ten. If the lead wants `twitter:title`, `twitter:description` or `twitter:image`, they are an addition to the spec and to this test.
- The JSON-LD test fixes choices the spec leaves open: the block is `<script type="application/ld+json">` with no other attribute, the offer's `price` is the number `0`, and the `SoftwareApplication` `url` is `https://todz.app/`. The block must contain no `<` at all (every one escaped as `<`).
- The shape table's `required` lists are what the spec's graph carries (Google names no required property for `Organization` and `WebSite`); each row cites schema.org and, where one exists, Google's guide.
- The `no-cache, no-transform` and `manifest-src` rows assert the public pages only; the admin pages keep `no-store`.
- The `site-pages.test.ts` block declares its own constants at the file's end to stay disjoint from Lane W's edits to the imports; a later cleanup may hoist them.

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
