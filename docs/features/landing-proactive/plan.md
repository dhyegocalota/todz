# Plan: todz.app says how proactive todz is

Base: `origin/main` at 8864b252 (PR #91 merged). Branch `feat/landing-proactive`. Spec: [spec.md](spec.md). Design: [design.md](design.md).

- [ ] **1. Red tests.** `apps/api/test/landing-proactive.test.ts` (copy strings and their Swift and email pins, markup of the day card, markdown alternate, JSON-LD `featureList`, `llms.txt` lines) and `apps/api/e2e/landing-proactive.spec.ts` (desktop and 390 px, light and dark, reduced motion, no sideways scroll, CSP). Commit the failing tests alone before any product code.
- [ ] **2. Copy.** `landing-copy.ts`: remove `benefits.glance`, add `benefits.day` per design.md §3 with the accurate Focus note.
- [ ] **3. Markup.** `landing-page.ts`: a day card renderer (rail, four stops, chips, note); `benefitsHtml` places it full width and the agents and offline cards in the row below. Existing helpers only (`escapedHtml`, `glyphHtml`, `cropClassOf`); no inline style attribute.
- [ ] **4. Style.** `site-style.ts`: day card, rail, vignettes, chips, the scroll-drawn track (`animation-timeline: view()` inside `@supports`), reduced-motion, forced-colors, 390 px and desktop rules, existing tokens only.
- [ ] **5. Markdown, JSON-LD, llms.txt.** `landing-markdown.ts` lists the day card; `site-json-ld.ts` and the llms text add the proactive lines.
- [ ] **6. Shots.** Playwright screenshots of `section.benefits` at 1280 and 390, light and dark, into `.pr-media/landing-proactive/` (git-ignored).
- [ ] **7. Verify.** `pnpm verify` green, then the PR.

## Failure modes

| Step | What breaks | Signal | Back out |
|---|---|---|---|
| 3 | The card overflows at 390 px | e2e no-sideways-scroll fails | Revert the step; the stops stack in the rail |
| 4 | Scroll-linked track on a browser that ignores `view()` shows an empty rail | Firefox e2e or the X3 edge case | Make the default the complete state and animate only inside `@supports` |
| 5 | The JSON-LD test pins a `featureList` that other site tests reject | `site-json-ld.test.ts` red | Keep the existing items and append |
| 2 | `alt.widgetRing` is still read by the hero or the markdown | alt test fails | Keep the key |
