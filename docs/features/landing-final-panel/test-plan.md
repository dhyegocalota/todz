# Test plan: The final panel of todz.app

Every checkbox states the input and the exact expected outcome. A ticked box carries evidence after ` — evidence: ` (commit hash, log path, counts, screenshot path).

## The failing test first

- [ ] `apps/api/test/free-hero.test.ts` is red at its own commit — input: the landing served by `serveLandingPage({ stars: 1234 })`; expected: the new panel pins fail (`way-card-cloud`, `way-points`, `way-terminal`, `signature-swash`, `--glow-mint`, `7fr 5fr`) and the unchanged pins pass — evidence:
- [ ] Confirmed it fails for the right reason: the missing markup and rules, not a broken test — evidence:

## Unit

- [ ] `free-hero.test.ts` cloud card — input: the `#ways` slice; expected: `way-card way-card-cloud glass` once, three `way-point` items in the order of `LANDING_COPY.ways.cloud.points`, `href="/download" download`, `download.note` and `DOCS_INSTALL_URL` inside the cloud card, a `way-badge-free` badge — evidence:
- [ ] `free-hero.test.ts` self-host card — input: the slice from the self-host heading; expected: `way-card glass` once, the body, a `figure.terminal.way-terminal` whose command is `pnpm --filter @todz/api ${script}` for a `server:deploy` key read from `apps/api/package.json`, the guide link to `DOCS_SELF_HOST_URL`, and `star-pill` for `null`, `0`, `42` and `1234` — evidence:
- [ ] `free-hero.test.ts` star pill edge — input: `serveLandingPage({ stars: null })`; expected: the self-host card has the pill `[GH] Star on GitHub` with no `star-count` element — evidence:
- [ ] `free-hero.test.ts` panel — expected: the `#ways` slice has no `final-icon` and no `way-cta-secondary` — evidence:
- [ ] `free-hero.test.ts` signature — expected: `<p class="signature glass">`, the line, `— ` and `<a class="signature-link" href="https://dhyegocalota.com.br" rel="noopener">Dhyego Calota</a>`, then `signature-swash` — evidence:
- [ ] `free-hero.test.ts` styles — input: `SITE_STYLE`; expected: `.way-list{grid-template-columns:7fr 5fr;` inside the `64rem` media, no `repeat(2, 1fr)` on `.way-list`, `--glow-mint:` on `:root` and `var(--glow-mint)` used by `.way-card-cloud`, `.signature-swash` with `pathLength` drawn only inside `prefers-reduced-motion: no-preference` — evidence:
- [ ] `free-hero.test.ts` motion — expected: no `@keyframes` or `animation` of the swash outside the `no-preference` block — evidence:
- [ ] `tools/repository-shape/src/owner-name.test.ts` — expected: no tracked file names the owner by first name alone, passes — evidence:
- [ ] `apps/api/test/site-pages.test.ts` (CSP and inline sources) — expected: passes, no new script hash and no `style` attribute or `on*` handler in the panel — evidence:

## E2E (Playwright specs)

- [ ] The existing landing specs under `apps/api/test/site` still pass — evidence:

## Prove it for real — Playwright MCP

- [ ] BEFORE at 1280 and 390, light and dark, of `#ways` plus the footer on https://todz.app — expected: four PNGs in `.pr-media/landing-final-panel/` — evidence:
- [ ] AFTER on a local `wrangler dev` of the branch, same four shots — expected: the cloud card is wider, has the mint glow and the three points; the terminal shows the deploy command; the note is tilted with the swash — evidence:
- [ ] Contrast of the moved texts (`.way-body`, `.way-point`, `.download-note`, `.ways-note`, `.signature`, the cloud title) measured in both schemes at 1280 and 390, against the rendered backdrop — expected: at least 4.5:1 for body text — evidence:
- [ ] Reduced motion (`reducedMotion: 'reduce'`) — expected: the swash is fully drawn, the panel is visible without the reveal — evidence:
- [ ] Keyboard focus order: Download for Mac, Install steps, Server setup guide, Star on GitHub, Dhyego Calota — expected: each focus ring visible — evidence:
