# Tester briefing: Credits

## What changed

- `libs/types/src/constants.ts`: `COMPANY` (`tradeName`, `legalName`, `website`), `as const`, exported through `index.ts`.
- `apps/api/src/site/landing-copy.ts`: `shell.creditLead`, `shell.creditName` (from `COMPANY.tradeName`), `shell.creditTail`.
- `apps/api/src/site/site-shell.ts`: `creditHtml()` renders `<p class="footer-credit">` between the copyright and the guide link, the link to `COMPANY.website` with `rel="noopener"`, same tab.
- `apps/api/src/site/site-style.ts`: `.footer-credit-link` (text colour) and `.footer-credit` (right margin in the desktop row).
- `README.md`: the line `todz is a product of Logic Bit, made in Brazil: [logicbit.com.br](https://logicbit.com.br)` under the hero rule.
- `libs/types/README.md` and `apps/api/README.md`: one phrase each, still purpose-only.

## How to run

- `pnpm --filter @todz/types exec vitest run`
- `pnpm --filter @todz/repository-shape exec vitest run company-credit`
- `pnpm --filter @todz/api exec vitest run test/site-pages.test.ts`
- `pnpm --filter @todz/api exec playwright test -g credit` (desktop and mobile projects)
- `pnpm verify`

## Red, then green

Red commit 694efeb (stub `COMPANY` with empty strings so typecheck stays green), green commit 49f0a2a.

| Test | Red text printed | Green |
|---|---|---|
| `libs/types/src/constants.test.ts` company constants | `expected { tradeName: '', legalName: '', …(1) } to deeply equal { tradeName: 'Logic Bit', …(2) }` | yes |
| `tools/repository-shape/src/company-credit.test.ts` | `expected [ '<p align="center">', …(63) ] to include 'todz is a product of Logic Bit, made …'` | yes |
| `apps/api/test/site-pages.test.ts` credits Logic Bit in the footer (5 pages: 4 landing notices, the guide) | `expected '<footer class="site-footer">\n<div cl…' to contain '<p class="footer-credit">todz is a pr…'` | yes |
| `apps/api/e2e/landing.spec.ts` credit (`/`, `/self-host`) | `expect(locator).toHaveText(expected) failed … Locator: locator('.site-footer .footer-credit') … element(s) not found` | yes |
| `apps/api/e2e/landing.spec.ts` keyboard in the footer | `expect(locator).toBeFocused() failed … Locator: locator('.site-footer .footer-credit-link') … element(s) not found` | yes |

## Hypotheses for the tester

- Every site page footer shows "todz is a product of Logic Bit, made in Brazil", the name linking `https://logicbit.com.br` in the same tab.
- No new network request and no console error on `/`, `/join` and `/self-host`; the CSP is unchanged since the link is a plain anchor.
- At 1280 the footer row reads brand, copyright, credit, guide link without overlap; at 375 it stacks in the column with no horizontal scroll.
- Light and dark: the credit text is muted and the name is the primary text colour; the focus ring shows on keyboard focus.
- The README line sits right under the hero rule and renders as a link on GitHub.

## Gaps

- The existing keyboard walk (skip link to join button) is unchanged; the credit link is covered by its own Shift+Tab test from the guide link, because the footer is many stops past the join button.
- The footer screenshots (light and dark) for the PR are not taken; that is the tester's and recorder's work.
- `pnpm verify` ran on the working tree while HEAD was the red commit; it must run again on the final commit to leave its record.
