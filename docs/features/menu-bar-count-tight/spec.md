# The menu bar count sits tight against the glyph

**Status:** Shipped 2026-11-26
**Tier:** 🟢
**Owner approval:** approved 2026-11-26 by the owner's words, "o menubar com count tá muito espaçado entre a logo e o número, deixa mais conciso e sexy"; product scope inherited from [docs/product/README.md](../../product/README.md), approved 2026-11-23
**ADRs:** none new; the drawing of [0065](../../adr/0065-the-day-temperature-steps-the-menu-bar-count-s-opacity-after-noon-and-washes-overdue-widget-rows-by-age-behind-a-setting.md) and [0071](../../adr/0071-the-menu-bar-ribbon-unfolds-what-is-next-beside-the-glyph-for-a-few-seconds-as-template-frames-behind-a-setting-off-by-default.md) keeps its shape
**Not changing:** the glyph artwork, the count's text and cap ([ADR 0036](../../adr/0036-the-menu-bar-icon-counts-today-s-open-tasks-behind-a-setting.md)), the day temperature's opacities, the ribbon's timing and widths, the template rendering

## Problem

The status item reads `✓   12`: 12 points of empty bar between the checkmark's ink and the first digit, 8 of them the label's spacing and the rest the glyph's own right margin and the digit's side bearing. The count also sits half a point below the checkmark.

## Goals

- The count's ink starts 2 to 3 points after the glyph's ink for 1, 2 and 3 characters (`1`, `12`, `99+`), with monospaced digits.
- The digits' baseline meets the checkmark's bottom.
- No padding beyond the system's on either side: the image ends where the count ends.
- The image stays a template, readable on light and dark bars.
- The hidden count (0 or off) still shows the glyph alone; the day temperature's tones and the ribbon's expanded state use the same gap.

## Non-goals

- A new glyph, a new font size, a different status item width with no count.

## Design

`MenuBarLayout` in TodzKit holds the numbers: the glyph artwork's right margin inside its 18-point box (2.5), the gap from the glyph's ink to the count's frame (1.5), the spacing they give (−1, the count tucks into the glyph's margin) and the count's rise (0.5). `MenuBarCountImage` draws every count, with the day temperature on or off, because the status item drops the spacing of a live stack; it and `MenuBarRibbonImage` take the spacing and the rise from it, so the count, the toned count and the ribbon share one origin and the glyph never moves.

## Open questions → answers

| Question | Options | Owner's answer | Date |
|----------|---------|----------------|------|
| How tight? | 1, 2–3 or 4 points of visible gap | "about 2–3 pt", the lane brief | 2026-11-26 |
| Trim the glyph's margin or tuck the count into it? | Edit the PDF, negative spacing | Loop's call: negative spacing; the 18-point glyph box is pinned by `brand-assets.test.ts` and the glyph alone keeps its look | 2026-11-26 |

## Test strategy summary

`MenuBarLayoutTests` pins the numbers red-first. In-process renders of the status item's image, before and after, at 2x on a light and a dark bar, measure the visible gap and the ink rows for 1, 2 and 3 characters, the glyph alone, the three tones and the expanded ribbon.
