# Test plan: Credits

Every checkbox states the input and the exact expected outcome. A ticked box carries evidence after ` — evidence: ` (commit hash, log path, counts, screenshot path).

## The failing test first

- [x] `libs/types/src/constants.test.ts` `COMPANY` — input: the constant; expected: exactly the keys `tradeName`, `legalName`, `website` with `Logic Bit`, `Logic Bit AI Software Boutique Ltda`, `https://logicbit.com.br` — evidence: red 694efeb in a throwaway worktree: 1 failed, 16 passed; green 150c270 (code in 49f0a2a): types suite 17/17
- [x] Confirmed it fails for the right reason: the red run prints the empty-string stub's assertion, not a test error — evidence: 694efeb printed `expected { tradeName: '', legalName: '', …(1) } to deeply equal { tradeName: 'Logic Bit', …(2) }` (a named assertion, no test error, typecheck green)

## Unit

- [x] `apps/api/test/site-pages.test.ts` — input: the landing and the self-host pages; expected: the footer holds `todz is a product of <a href="https://logicbit.com.br" rel="noopener noreferrer">Logic Bit</a>, made in Brazil` — evidence: red 694efeb: 5 failed (4 landing notices, the guide) with `expected '<footer class="site-footer">…' to contain '<p class="footer-credit">todz is a pr…'`; green: apps/api unit 64 files, 1670 tests passed
- [x] Every word the footer shows still comes from the copy module — input: the existing copy test; expected: green — evidence: `pnpm test:unit` at 150c270: all 64 api files green, copy test included
- [x] `tools/repository-shape/src/company-credit.test.ts` — input: `README.md`; expected: contains the line `todz is a product of Logic Bit, made in Brazil: [logicbit.com.br](https://logicbit.com.br)` — evidence: red 694efeb: 1 failed, `expected [ '<p align="center">', …(63) ] to include 'todz is a product of Logic Bit, made …'`; green in `pnpm test:unit`
- [x] `pnpm verify` — expected: every gate green, the generated site files unchanged — evidence: `pnpm verify`: 8 gates green at 150c270 (product), e2e 52 passed 2 skipped; no generated site file changed (see the uncommitted `site-style.ts` edge case)

## End-to-end (Playwright specs)

- [x] `apps/api/e2e/landing.spec.ts` — steps: open `/` and `/self-host`; expected: the footer shows the credit and the link's `href` is `https://logicbit.com.br` — evidence: red 694efeb: 4 credit tests failed on `.site-footer .footer-credit` element(s) not found; green: 2 pages x 2 projects pass (52 passed, 2 skipped)
- [x] `apps/api/e2e/landing.spec.ts` — steps: focus the guide link in the footer, press Shift+Tab; expected: the credit link is focused with a visible focus ring — evidence: red 694efeb: desktop and mobile failed on `.footer-credit-link` not found; green: both pass; walk ring `solid 3px rgb(47, 91, 255)` light, `rgb(140, 247, 208)` dark, offset 2px, at 1280 and 375
- [x] `apps/api/e2e/landing.spec.ts` — steps: `/`, `/join` and `/self-host`; expected: no console error and no foreign request — evidence: the 3 console-and-network tests pass on both projects; walk: no console error, only Turnstile as foreign request on `/` (the existing allowance), none on `/self-host`

## Prove it for real — Playwright MCP

- [x] Click the credit link on the landing; expected: `https://logicbit.com.br` opens in the same tab — evidence: scripted walk (Playwright MCP down: chrome-for-testing not installed): click on `/` at 1280 landed on `https://www.logicbit.com.br/en-us` in the same page, 0 popups, 1 page in the context, `rel="noopener"`, no `target`; re-run at 44352bc: rel `noopener noreferrer`, same tab, 0 popups, 1 page, landed on `https://www.logicbit.com.br/en-us`, the first request to logicbit.com.br carried no Referer header
- [x] Desktop width 1280, light and dark; expected: the credit sits in the footer row without overlap, with the muted footer colour — evidence: scripted walk, `/` and `/self-host`: row brand x64, copyright x164, credit x809 w284, guide x1117, no overlap, scrollWidth 1280; credit rgb(91, 98, 133) light and rgb(169, 176, 214) dark (muted), name rgb(22, 26, 51) light and rgb(242, 244, 255) dark; .pr-media/credits/footer-desktop-light.png, .pr-media/credits/footer-desktop-dark.png, .pr-media/credits/footer-self-host-desktop-light.png, .pr-media/credits/footer-self-host-desktop-dark.png
- [x] Narrow width 375, light and dark; expected: the credit stacks in the footer column, no horizontal scroll — evidence: scripted walk: column brand y621, copyright y673, credit y703 (x45 w284, one line), guide y732, scrollWidth 375, no overlap; .pr-media/credits/footer-mobile-light.png, .pr-media/credits/footer-mobile-dark.png, .pr-media/credits/footer-self-host-mobile-light.png, .pr-media/credits/footer-self-host-mobile-dark.png
- [x] Screenshots of the footer, light and dark, for the PR — evidence: paths in the two boxes above, plus .pr-media/credits/focus-desktop-light.png, focus-desktop-dark.png, focus-mobile-light.png, focus-mobile-dark.png (git-ignored)

## Edge cases found during execution

Found by the tester.

- [x] 320 px wide, `/` and `/self-host`, light and dark: the credit stays on one line — evidence: credit x18 w284 h22 inside 320, scrollWidth 320, no overlap; .pr-media/credits/footer-edge-320-light.png, .pr-media/credits/footer-edge-320-dark.png
- [x] 640 px (a 200% zoom of a 1280 window), `/`: the footer stays one row, no horizontal scroll — evidence: scrollWidth 640 of 640, credit x209 w284 between the copyright and the guide link; .pr-media/credits/footer-edge-640-light.png, .pr-media/credits/footer-edge-640-dark.png
- [x] Reduced motion on `/`: the credit link animates nothing — evidence: `animation-name: none`, transition `0.12s color, background-color, opacity` (colour and opacity only; the existing reduced-motion test passes)
- [x] The link target redirects (`logicbit.com.br` answers `www.logicbit.com.br/en-us`): still the same tab, no popup — evidence: click walk, 0 popups, 1 page
- [x] Forward Tab leaves the credit link for the guide link — evidence: next focus is `footer-link` at 1280 and 375, light and dark
- [x] `/self-host` footer equals the landing footer (same text, `href`, `rel`) — evidence: walk facts identical at 1280, 640, 375, 320, both schemes
- [x] RESOLVED (process; evidence: red e82b094 fails 6 tests in site-pages.test.ts, green 44352bc commits the underline and adds noreferrer; at 44352bc apps/api unit 64 files 1671 tests passed, landing e2e 44 passed 2 skipped, the walk computed `text-decoration-line: underline`; the earlier screenshots ran with the same rule and stay valid). Original finding: the credits worktree carried an uncommitted edit to `apps/api/src/site/site-style.ts` that was in no commit: `.footer-credit-link{color:var(--color-text);text-decoration:underline;text-underline-offset:0.2em}` (HEAD 150c270 has `.footer-credit-link{color:var(--color-text)}`). Every walk, screenshot, e2e and verify run above ran with it, so the name is underlined in the screenshots and is not at HEAD. Repro: `git diff` in `todz-lanes/credits`. Expected: the change is committed with a test that pins the underline (none does) or dropped, then the walk and screenshots rerun. The briefing says the name is the primary text colour and mentions no underline.

## Adversarial review

- [x] Claim 1: the footer credit adds no new request — attack: network log on `/` — result: held — evidence: `/` makes 12 requests (document, assets, Turnstile), `/self-host` 1; the only foreign host is `challenges.cloudflare.com` (the existing Turnstile allowance); nothing requests logicbit.com.br before the click; no console error
- [x] Claim 2: the README line cannot drift from `COMPANY` — attack: change the constant, run the shape test — result: held with a nuance — evidence: changing `COMPANY.website` fails `constants.test.ts` and 5 `site-pages` tests; changing the README line fails `company-credit.test.ts`; changing only the constant leaves the README test green, so drift is caught by the constants test pinning the same literals, as the coverage note says; both mutations restored with `git checkout`
- [x] Claim 3: the link is reachable and visible by keyboard at every width — attack: Tab through the footer at 375 and 1280 — result: held — evidence: forward Tab on `/` at 1280 and 375, light and dark: join button, brand, `footer-credit-link` (ring visible), `footer-link`; no overflow at 320 or 640

## Coverage honesty

- The docs footer is not tested here: it comes with `docs-mintlify`, which reads the same constant.
- The shape test compares the README to literals, since `repository-shape` does not import `@todz/types`; the constants test pins the same literals, so a change to either fails one of them.
