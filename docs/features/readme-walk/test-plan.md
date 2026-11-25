# Test plan: README walk

Every checkbox states the input and the exact expected outcome. A ticked box carries evidence after ` — evidence: ` (commit hash, log path, counts, screenshot path).

## The failing test first

- [ ] No new test: the existing `tools/repository-shape/src/product-screenshots.test.ts` and `delivery-docs.test.ts` pin the walk. Mutation check: put back one deleted PNG without a README cell — expected: "the root README shows every screenshot" fails naming it; delete it again — expected: green

## Unit

- [ ] `pnpm --filter @todz/repository-shape exec vitest run` — expected: all green
- [ ] Every image path in the README's walk section exists on disk — expected: 12 of 12, plus the hero
- [ ] `docs/screenshots/` holds exactly the 13 PNGs the README shows (12 walk cells and the hero) — expected: no extra file

## Prove it for real

- [ ] The README rendered on GitHub at the branch (`gh api` or `gh browse` URL rendered in a browser, or the Markdown rendered locally) — expected: the hero, then six rows of two images, in ADR 0047's order, every image loading, captions under each
- [ ] Narrow width (375) — expected: the table scrolls or stacks without broken images

## Edge cases found during execution

Empty on purpose.

## Coverage honesty

- What the owner calls "makes sense" is a judgment; ADR 0047 records the cut for him to overturn.
