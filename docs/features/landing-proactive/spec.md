# todz.app says how proactive todz is

**Status:** Building
**Tier:** 🟢 (copy, markup and CSS of one benefit card on the landing; no route, no data, no script, no image)
**Owner approval:** inherited from [`docs/product/README.md`](../../product/README.md), approved 2026-11-23, and the owner's words of 2026-11-26: "deixa hiper claro na landing page o quão proactive ele é… óbvio, com frontend-designer, de forma sexy". The layout is the loop's call, recorded below from [design.md](design.md) (Option B); the owner may overturn it.
**ADRs:** none new. The Focus wording follows [ADR 0068](../../adr/0068-one-respect-focus-switch-decides-for-every-proactive-surface-and-untouched-settings-follow-the-defaults.md) §5, which keeps the agent nudge and the day mail ungated.
**Not changing:** the hero, the stage and its shots, "How it works", the final panel, the footer; `landing-shots.ts` and the image files; the strict CSP (no inline handler, no script, no inline style attribute); the `agents` and `offline` cards; `meta.*`.

## Problem

The landing says todz is shared with your agents and lives in your menu bar, but every sentence describes something the visitor opens or asks for. Nothing on the page says todz acts on its own: the morning glance, the day close at 18:00, the 07:00 "Your day" mail, the agent mention of today's tasks, the menu bar ribbon, the day temperature and Siri. The owner wants the proactive part to be obvious and sexy.

## Goals

- One sharp line the visitor cannot miss: "todz doesn't wait to be opened."
- A compact day timeline 07:00 → 09:00 → 10:30 → 18:00 with four small glass vignettes, one per proactive surface, and a chip row for the menu bar ribbon, the day temperature and Siri.
- A one-line note: each one but Siri is a switch in Settings, and Respect Focus keeps the ones on your Mac quiet. Siri has no switch in Settings (`apps/macos/Copy/SettingsCopy.swift`), so the note does not claim one.
- Motion that draws the day as the visitor scrolls, with a static, complete state for reduced motion, JS off and browsers without scroll-linked animation.
- Light and dark, 390 px and desktop, no sideways scroll.
- The same facts in `llms.txt`, the markdown alternate and the JSON-LD `featureList`.

## Non-goals

- No new section, route, script, image or data source. The card lives inside `section.benefits`, which keeps the page's four sections in order.
- No claim that Respect Focus quiets the agent mention or the day mail. Those are ungated (ADR 0068 §5). The owner's brief said "Respect Focus quiets them all"; that would be false on the page, so the note says "your Mac".
- No change to the glance's behaviour, the mail's schedule or the switches' defaults.

## Design

The design is [design.md](design.md). Summary of the changed surfaces:

- `landing-copy.ts`: `benefits.glance` leaves; `benefits.day` is added before `benefits.agents` with the eyebrow, title, the four stops, `extras` (ribbon, temperature, Siri) and `note`. The copy is English and lives in this file only.
- `landing-page.ts`: `benefitsHtml` renders the day card full width, then the agents and offline cards in a row.
- `site-style.ts`: the day card, its rail, the four vignettes, the chips, the scroll-drawn track and the reduced-motion and forced-colors rules. Tokens reused from `SITE_STYLE`: `--glass-*`, `--gradient-wallpaper`, `--color-accent`, `--color-terminal`, `--text-section`, `--text-small`.
- `landing-markdown.ts`: the markdown alternate lists the day card as a `###` section with the four stops and drops the glance card.
- `site-json-ld.ts` and `llms.txt`: the `featureList` and the llms lines mention the morning glance, the 18:00 close, the 07:00 mail, the agent mention, the menu bar ribbon, the day temperature and Siri.

### Failure handling

Server-rendered static HTML and CSS. No data, so no loading, empty or error state. Without CSS the card reads as a list in reading order.

## Accessibility

- The card is one `li`; the title is an `h3`; the rail is an `ol` with a label; each stop is an `li` with a `time` element.
- The mock UI inside each vignette is `aria-hidden`; the caption text carries the meaning.
- Forced colours: card, well and vignettes take `Canvas` with a `CanvasText` border; the track and dots draw in `CanvasText`.
- Motion is decorative. Reduced motion shows the complete state with no transform.

## Open questions → answers

| Question | Options | Answer | Date |
|----------|---------|--------|------|
| Which layout | A (glance card becomes "It comes to you", zero height), B (day rail card, full width, about +460 px), C (hero stage plays the day) | B, chosen by the loop from the designer's recommendation: the only option where the line cannot be missed and every surface is named, with no section, image or script | 2026-11-26 |
| The Focus line | "Respect Focus quiets them all" (brief) or the accurate one | Accurate: "Respect Focus keeps your Mac quiet during a Focus." ADR 0068 §5 leaves the mail and the agent mention ungated | 2026-11-26 |
| The switch line for Siri | "Each one is a switch" (design) or "Each one but Siri" | "Each one but Siri": Siri has no Settings switch. Found in review, 2026-11-26 | 2026-11-26 |
| Motion ranges | The designer's 20% start (the 18:00 stop still faded with the card centred at 1280 by 800) | Start at 10%, segment span 5%: every stop is lit by 50% of the scroll, so the centred card reads complete. Found in review | 2026-11-26 |
| Height | about +460 px desktop, +480 px at 390 px, against "keep the landing short" | Accepted: the card replaces the glance card and the owner asked for the line to be obvious. Flagged in the PR for the owner | 2026-11-26 |
| Glance card's own sentence | Kept as a third card, or leaves the page | Leaves the page; the hero stage and "How it works" step 3 still show the widget | 2026-11-26 |

## Test strategy summary

Red first: copy, markup, markdown alternate, JSON-LD `featureList` and `llms.txt` unit tests in `apps/api/test/landing-proactive.test.ts` are committed failing. Playwright e2e in `apps/api/e2e/landing-proactive.spec.ts` covers desktop and 390 px, light and dark, reduced motion, no sideways scroll and the strict CSP. Screenshots before the deploy. See [test-plan.md](test-plan.md).
