# Tester briefing: Landing SEO

Written by the developer sub-agents when their steps are done. A developer does not run `test-plan.md` and does not declare the feature works. Each lane writes only its own section.

## Lane H

### What changed

- <pending: Lane H>

### How to run

```bash
<pending: Lane H>
```

### Red today, green after

| Test | Red before the change because | Green after because |
|------|--------------------------------|---------------------|
| `apps/api/test/site-constants.test.ts` (pin) | not red first: the constants have no behaviour to fail; step 1 of G0 | pins every value of `site-urls.ts` and `site-icons.ts` |

### Hypotheses to attack

Every "it works" is a hypothesis the tester tries to break.

1. <pending: Lane H>

### Known gaps

- <pending: Lane H>

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
