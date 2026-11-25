# Test plan: Credits

Every checkbox states the input and the exact expected outcome. A ticked box carries evidence after ` — evidence: ` (commit hash, log path, counts, screenshot path).

## The failing test first

- [ ] `libs/types/src/constants.test.ts` `COMPANY` — input: the constant; expected: exactly the keys `tradeName`, `legalName`, `website` with `Logic Bit`, `Logic Bit AI Software Boutique Ltda`, `https://logicbit.com.br`
- [ ] Confirmed it fails for the right reason: the red run prints the stub's `COMPANY is not implemented`, not a test error

## Unit

- [ ] `apps/api/test/site-pages.test.ts` — input: the landing and the self-host pages; expected: the footer holds `todz is a product of <a href="https://logicbit.com.br" rel="noopener">Logic Bit</a>, made in Brazil`
- [ ] Every word the footer shows still comes from the copy module — input: the existing copy test; expected: green
- [ ] `tools/repository-shape/src/company-credit.test.ts` — input: `README.md`; expected: contains the line `todz is a product of Logic Bit, made in Brazil: [logicbit.com.br](https://logicbit.com.br)`
- [ ] `pnpm verify` — expected: every gate green, the generated site files unchanged

## End-to-end (Playwright specs)

- [ ] `apps/api/e2e/landing.spec.ts` — steps: open `/` and `/self-host`; expected: the footer shows the credit and the link's `href` is `https://logicbit.com.br`
- [ ] `apps/api/e2e/landing.spec.ts` — steps: focus the guide link in the footer, press Shift+Tab; expected: the credit link is focused with a visible focus ring
- [ ] `apps/api/e2e/landing.spec.ts` — steps: `/`, `/join` and `/self-host`; expected: no console error and no foreign request

## Prove it for real — Playwright MCP

- [ ] Click the credit link on the landing; expected: `https://logicbit.com.br` opens in the same tab
- [ ] Desktop width 1280, light and dark; expected: the credit sits in the footer row without overlap, with the muted footer colour
- [ ] Narrow width 375, light and dark; expected: the credit stacks in the footer column, no horizontal scroll
- [ ] Screenshots of the footer, light and dark, for the PR

## Edge cases found during execution

Empty on purpose. The tester adds one checkbox per new case (input, exact expected outcome) and a regression test for each.

## Adversarial review

- [ ] Claim 1: the footer credit adds no new request — attack: network log on `/` — result: <refuted | held>
- [ ] Claim 2: the README line cannot drift from `COMPANY` — attack: change the constant, run the shape test — result: <refuted | held>
- [ ] Claim 3: the link is reachable and visible by keyboard at every width — attack: Tab through the footer at 375 and 1280 — result: <refuted | held>

## Coverage honesty

- The docs footer is not tested here: it comes with `docs-mintlify`, which reads the same constant.
- The shape test compares the README to literals, since `repository-shape` does not import `@todz/types`; the constants test pins the same literals, so a change to either fails one of them.
