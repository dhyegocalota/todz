# Credits

**Status:** Building
**Tier:** 🟢
**Owner approval:** approved 2026-11-25 by the owner's request to the loop, PROMPT.md "Self-host, docs and credits" item 3 ("também coloca os créditos de quem construiu a landing page, que foi a Logic Bit"): the landing's footer, the docs footer and the README credit Logic Bit as the studio that built todz, linking `https://logicbit.com.br`, as zapbip does; the company facts live once in `libs/types`.
**ADRs:** none (no alternative worth recording: zapbip's shape is the owner's reference)
**Not changing:** the landing's sections, the copyright line, the docs (the docs footer comes with `docs-mintlify`, which reads the same constant)

## Problem

Nothing in todz says who built it.

## Change

- `libs/types` gains `COMPANY` with the facts the credit needs, once: the trade name `Logic Bit`, the legal name `Logic Bit AI Software Boutique Ltda` and the website `https://logicbit.com.br`, as zapbip's constant has them.
- The landing footer, on every site page, gains one line: "todz is a product of Logic Bit, made in Brazil", the name linking the website (opening in the same tab, `rel="noopener noreferrer"`, underlined), the copy in `landing-copy.ts` and the facts from `COMPANY`.
- The root README gains the same line under the hero, as zapbip's README has it.
- The CSP and the landing's console and network checks stay green: the link is a plain anchor, no new request.

## Test list

- `libs/types`: `COMPANY` holds exactly the three facts.
- `apps/api` unit: the site shell's footer carries the credit line with the link to `COMPANY.website`, escaped.
- `apps/api` e2e (landing): the footer shows the credit on `/` and `/self-host` at desktop and mobile widths, and the link's `href` is the website; the keyboard walk reaches it.
- `tools/repository-shape`: the README carries the product line naming `COMPANY.tradeName` and linking `COMPANY.website`.
- A screenshot of the footer, light and dark, for the PR.
