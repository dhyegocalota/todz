# README walk

**Status:** Approved
**Tier:** 🟢 (not the docs lane: `scripts/verify-gates.tsv` maps no `docs/screenshots/*` rule, so deleting a PNG classes the change `product`)
**Owner approval:** approved 2026-11-24 by the owner's request ("deixa só os screenshots que fazem sentido no readme"); the cut is the loop's call in [ADR 0047](../../adr/0047-the-readme-walk-shows-only-the-shots-that-tell-the-product-s-story.md)
**ADRs:** [0047](../../adr/0047-the-readme-walk-shows-only-the-shots-that-tell-the-product-s-story.md), [0030](../../adr/0030-product-screenshots-live-in-docs-screenshots-and-the-readme-walks-them.md)

The README walk grew to 25 cells, with setup and error states and light/dark pairs that add nothing. It now keeps 12 cells:
- Today across projects;
- an agent's task appearing live;
- the menu bar popover and its count;
- the four widgets;
- Connect an agent;
- an agent's tasks in a project;
- the two mails.

The hero stays. The dropped PNGs are deleted, because `product-screenshots.test.ts` requires every committed PNG to be shown. A feature's other shots live in its pull request.

Test: `pnpm verify` (class `docs`), `product-screenshots.test.ts` green.
