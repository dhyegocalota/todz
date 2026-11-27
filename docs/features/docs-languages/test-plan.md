# Test plan: docs in eight languages

Shape tests run with Vitest in `tools/repository-shape`; the walk runs with Playwright in `apps/docs` against `mint dev`.

## Twins

- [ ] Every English page has a twin in each of the seven folders, and no folder holds a page English lacks.
- [ ] A twin has the same front matter keys and the same heading count as its English page.
- [ ] Every fenced code block and inline code span of a twin equals the English one, in order.
- [ ] Every internal link of a twin points inside its folder, or is absolute or an asset.
- [ ] No page of any language names the owner by first name alone, and the owner-name rule still passes over the new folders.

## Navigation

- [ ] `docs.json` has `navigation.languages` with exactly the eight codes, English first.
- [ ] Each language lists the same pages as English under its folder and has five translated groups.
- [ ] The existing docs tests read the English entry and still pass.

## The walk

- [ ] The switcher lists the eight native names.
- [ ] A `pt-BR` page and a `ja` page open with their translated title.
- [ ] A non-English browser locale on the English root stays on the English root.
- [ ] `mint broken-links` reports nothing.
