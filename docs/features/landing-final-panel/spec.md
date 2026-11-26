# The final panel of todz.app

**Status:** Building
**Tier:** 🟢 (copy, markup and CSS of one panel on the landing; no route, no data, no new script)
**Owner approval:** inherited from [`docs/product/README.md`](../../product/README.md), approved 2026-11-23, and the owner's words "the final panel isn't sexy". The design choice is the loop's call (Option A of [design.md](design.md), recorded in [ADR 0096](../../adr/0096-the-final-panel-glows-mint-through-a-glow-mint-token.md)); the owner may overturn it.
**ADRs:** [0096](../../adr/0096-the-final-panel-glows-mint-through-a-glow-mint-token.md)
**Not changing:** the hero, the benefits, "How it works", the footer; the star count and its script (`star-count-script.ts`, `repository-stars.ts`); the `/download` route and `DOCS_INSTALL_URL`; the strict CSP (no new script, no inline handler); the copy of `final.title`, `ways.note`, `signature.line` and `download.note`

## Problem

The final panel, `#ways` ("Get todz on your Mac."), reads flat. Two equal glass cards hold one sentence each, so each keeps an empty band of glass above its button. The panel opens with a 64 px icon before any choice. The generic chip-coloured "Server setup guide" button looks disabled next to the gradient download button. The "Not notarized by Apple yet" line, which a visitor needs before they click Download, is only in the hero. The signature is small grey text on a rule, not a note from a person. Its muted text sits on the light wallpaper below AA.

## Goals

- The cloud card is visibly the primary path: wider, more padding, a mint glow, the todz icon, three ✓ points and a full-width Download button with the not-notarized note and its Install link inside the card.
- The self-host card is a lighter glass card with its one-sentence body, a mini terminal that shows the real deploy command (`pnpm --filter @todz/api server:deploy`), a "Server setup guide →" text link and the live star pill, the open source proof.
- Two columns from 64rem (7fr / 5fr); stacked below.
- The signature is a small tilted glass note ending "— Dhyego Calota", linked to https://dhyegocalota.com.br, with a pen swash drawn on scroll.
- The panel's top icon goes and its padding shrinks.
- Muted text in the panel moves to `--color-text` so it passes AA in both schemes.

## Non-goals

- No new route, no new script, no new data source, no price or tier copy.
- No change to the hero or to the star pill's behaviour; the pill is rendered as it is today.
- No reproduction of anyone's handwriting: the swash is a plain pen stroke.

## Design

The design is [design.md](design.md), Option A. Summary of the changed surfaces:

- `landing-copy.ts`: `ways.cloud` gets `points` (three sentences) in place of `body`; `ways.selfHost` gets `terminal` (`label`, `command`, `ready`, `next`).
- `landing-page.ts`: `waysHtml` renders the cloud card (icon, badge, points, Download, note with link) and the self-host card (body, terminal figure, guide link, `starPillHtml(stars)`); `signatureHtml` renders the glass note with `AUTHOR` and the swash; `finalCallHtml` drops the top icon.
- `site-glyphs.ts`: `SIGNATURE_SWASH`, an SVG like `MENU_BAR_GLYPH` (presentation attributes, no `style`, so the CSP holds).
- `site-style.ts`: the panel's grid, cards, terminal, note, swash and motion rules; a `--glow-mint` token on `:root`, the same in both schemes.

### Failure handling

The panel is server-rendered. `stars` may be `null` (GitHub fetch failed), which the star pill already renders without a count. Download is a plain link that needs no script.

## Accessibility

- One labelled section; each card an `li` with an `h3`; the points a nested list.
- Focus order follows the DOM: Download for Mac, Install steps, Server setup guide, Star on GitHub, Dhyego Calota.
- The terminal is a labelled figure, not focusable; the command is `user-select: all`.
- The swash, the glow and the arrow nudge are decorative. The swash draws only without reduced motion; under `forced-colors` the glow is removed.

## Open questions → answers

| Question | Options | Owner's answer | Date |
|----------|---------|----------------|------|
| Which layout for the panel | A (primary card and terminal card), B (one strip), C (split slab) | Option A, chosen by the loop | 2026-11-26 |
| The mint glow | A `--glow-mint` token, or the shadow written inline on the card | `--glow-mint` token (ADR 0096), the owner may overturn | 2026-11-26 |

## Test strategy summary

Red first: `apps/api/test/free-hero.test.ts` is moved to the new panel and committed failing. Then the copy, markup and CSS make it green. The tester measures contrast with DevTools and screenshots before and after on todz.app and a local `wrangler dev`. See [test-plan.md](test-plan.md).
