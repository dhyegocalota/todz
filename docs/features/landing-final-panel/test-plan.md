# Test plan: The final panel of todz.app

Every checkbox states the input and the exact expected outcome. A ticked box carries evidence after ` — evidence: ` (commit hash, log path, counts, screenshot path).

## The failing test first

- [x] `apps/api/test/free-hero.test.ts` is red at its own commit — input: the landing served by `serveLandingPage({ stars: 1234 })`; expected: the new panel pins fail (`way-card-cloud`, `way-points`, `way-terminal`, `signature-swash`, `--glow-mint`, `7fr 5fr`) and the unchanged pins pass — evidence: 8a77f2b4, 18 failed and 5 passed (23), `scratchpad/red.log`
- [x] Confirmed it fails for the right reason: the missing markup and rules, not a broken test — evidence: `scratchpad/red.log` shows `expected '' to contain` on the panel slices and the missing style rules; the only test-side failure was the manifest read in the workers pool, moved to `apps/api/test/site/final-panel-command.test.ts` in e5981202

## Unit

- [x] `free-hero.test.ts` cloud card — input: the `#ways` slice; expected: `way-card way-card-cloud glass` once, three `way-point` items in the order of `LANDING_COPY.ways.cloud.points`, `href="/download" download`, `download.note` and `DOCS_INSTALL_URL` inside the cloud card, a `way-badge-free` badge — evidence: e5981202, `free-hero.test.ts` green, `apps/api` unit 110 files and 2428 tests passed
- [x] `free-hero.test.ts` self-host card — input: the slice from the self-host heading; expected: `way-card glass` once, the body, a `figure.terminal.way-terminal` whose command is `pnpm --filter @todz/api server:deploy` for a `server:deploy` key in `apps/api/package.json`, the guide link to `DOCS_SELF_HOST_URL`, and `star-pill` for `null`, `0`, `42` and `1234` — evidence: e5981202, the four `star pill for %s stars` cases and the terminal case pass in the same run; the manifest key is checked in `apps/api/test/site/final-panel-command.test.ts`
- [x] `free-hero.test.ts` star pill edge — input: `serveLandingPage({ stars: null })`; expected: the self-host card has the pill `[GH] Star on GitHub` with no `star-count` element — evidence: e5981202, the `null stars` case passes; `open-source-landing.test.ts` "shows the label and no number when GitHub gave none" passes with three pills
- [x] `free-hero.test.ts` panel — expected: the `#ways` slice has no `final-icon` and no `way-cta-secondary` — evidence: e5981202, the panel test passes
- [x] `free-hero.test.ts` signature — expected: `<p class="signature glass">`, the line, `— ` and `<a class="signature-link" href="https://dhyegocalota.com.br" rel="noopener">Dhyego Calota</a>`, then `signature-swash` — evidence: e5981202, the signature test passes
- [x] `free-hero.test.ts` styles — input: `SITE_STYLE`; expected: `.way-list{grid-template-columns:7fr 5fr;` inside the `64rem` media, no `repeat(2, 1fr)` on `.way-list`, `--glow-mint:` on `:root` and `var(--glow-mint)` used by `.way-card-cloud`, `.signature-swash` with `pathLength` drawn only inside `prefers-reduced-motion: no-preference` — evidence: e5981202, the style tests pass; the swash range is `entry 0% entry 100%` after the final commit
- [x] `free-hero.test.ts` motion — expected: no `@keyframes` or `animation` of the swash outside the `no-preference` block — evidence: the swash rule sits inside the `no-preference` block in `apps/api/src/site/site-style.ts`, and the motion test passes
- [x] `tools/repository-shape/src/owner-name.test.ts` — expected: no tracked file names the owner by first name alone, passes — evidence: the `shape` run in `pnpm verify` (e5981202) passed 403 of 404 tests; the only failure was the runbooks timeout, and `owner-name.test.ts` is not among the failures
- [x] `apps/api/test/site-pages.test.ts` (CSP and inline sources) — expected: passes, no new script hash and no `style` attribute or `on*` handler in the panel — evidence: e5981202, `apps/api` unit suite passed, `site-pages.test.ts` green after the copy-glyph update

## E2E (Playwright specs)

- [x] The existing landing specs under `apps/api/test/site` still pass — evidence: e5981202, `apps/api` unit suite (includes the `test/site/**` node project) 110 files and 2428 tests passed

## Prove it for real — Playwright MCP

- [x] BEFORE at 1280 and 390, light and dark, of `#ways` plus the footer on https://todz.app — expected: four PNGs in `.pr-media/landing-final-panel/` — evidence: `before-1280-light.png`, `before-1280-dark.png`, `before-390-light.png`, `before-390-dark.png`, attached to PR #91
- [x] AFTER on a local `wrangler dev` of the branch, same four shots — expected: the cloud card is wider, has the mint glow and the three points; the terminal shows the deploy command; the note is tilted with the swash — evidence: `after-1280-light.png`, `after-1280-dark.png`, `after-390-light.png`, `after-390-dark.png`, attached to PR #91; reviewed in the 1280 light and 390 dark shots
- [x] Contrast of the moved texts (`.way-body`, `.way-point`, `.download-note`, `.ways-note`, `.signature`, the cloud title) measured in both schemes at 1280 and 390, against the rendered backdrop — expected: at least 4.5:1 for body text — evidence: worst-pixel ratios after: `.way-body` 15.61 (light) and 13.50 (dark) at 1280; `.ways-note` 9.76 and 15.98; `.way-title` 14.73 and 13.02; `.signature-line` 15.23 and 12.91; `.download-note` 13.89 and 14.16; the ✓ points read 15.8 and 13.6 median (the worst-pixel 1.0 is the mint disc against the text colour); before on todz.app `.way-body` 5.37 and 7.09, `.ways-note` 3.58 and 7.35; `scratchpad/contrast-after.json`, `scratchpad/contrast-before.json`
- [ ] Reduced motion (`reducedMotion: 'reduce'`) — expected: the swash is fully drawn, the panel is visible without the reveal — evidence: not run in this lane; the CSS draw sits inside `prefers-reduced-motion: no-preference`, so the static swash is the reduced-motion path by construction
- [ ] Keyboard focus order: Download for Mac, Install steps, Server setup guide, Star on GitHub, Dhyego Calota — expected: each focus ring visible — evidence: not run in this lane; DOM order is the visual order at both widths in the shots
