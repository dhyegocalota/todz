# The Liquid Glass brand

**Status:** Shipped 2026-11-24
**Tier:** 🟢
**Owner approval:** approved 2026-11-24 by inheritance from [the product design](../../product/README.md) and the owner's request of 2026-11-24 ("o app, menu bar, tem que carregar tudo certinho a logo, o icon mas seguindo o glass style quando necessário"); the icon's form and the widget glyph are [ADR 0039](../../adr/0039-the-app-icon-is-a-layered-icon-composer-document-with-the-flat-set-as-its-fallback.md), the loop's call, listed in the loop's questions for the owner
**ADRs:** [0039](../../adr/0039-the-app-icon-is-a-layered-icon-composer-document-with-the-flat-set-as-its-fallback.md), [0038](../../adr/0038-the-brand-sources-are-svgs-in-docs-brand-and-the-app-s-assets-are-generated-from-them.md)
**Not changing:** the menu bar glyph and its count (already the owner's template glyph, ADR 0038), the sign-in screen's layout (it already draws the app's icon, which becomes the glass one), the email header (it arrives with `transactional-email`), the accent colour

## Problem

The `brand` feature gave the app a flat icon. On macOS 26 a flat icon sits in a grey glass frame and never takes the dark, clear or tinted looks the owner picks in System Settings. The widgets carry no logo at all.

## Goals

- On macOS 26 the Dock, Finder, the app switcher, the About panel and the sign-in screen show a layered glass icon that the system lights, darkens, clears and tints.
- On macOS 14 and 15 the same places show the owner's flat icon.
- Every widget's header shows the todz glyph before its title, tinted with the accent.
- The README shows each brand surface in light and dark: the icon's looks, the sign-in screen, the menu bar and the widgets.

## Non-goals

- A new logo, the email header, a website.

## Design

### Data flow

`docs/brand/todz-icon-check.svg` and `todz-icon-sparkle.svg` (cut from `todz-icon.svg`) → copied by hand (the runbook) into `apps/macos/Todz/AppIcon.icon/Assets/`, beside `icon.json` → `actool` at build time → the icon stack for macOS 26; `AppIcon.appiconset` → the flat images for older systems. `MenuBarGlyph` → the widgets' headers.

### Interfaces

- `AppIcon.icon/icon.json`: the background gradient, a sparkle group and a check group, each a glass layer, for the macOS square.
- `WidgetBrandGlyph` (a view in the widget extension): the `MenuBarGlyph` image set as a template, resizable, a square of a named side constant beside the headline, accent-tinted, `widgetAccentable`, `unredacted`, a higher layout priority than the title so a long title truncates first, hidden from VoiceOver. `WidgetHeader`, `WidgetPrompt`, the Next up label and the Today ring's title draw it before their text, in an `HStack` centred on the title line, because an image has no baseline of its own.

### Failure handling

A broken `icon.json` or a missing layer fails `actool`, which the `macos` gate catches; the shape test fails first when a layer is missing or differs from `docs/brand`.

## Open questions → answers

| Question | Options | Owner's answer | Date |
|----------|---------|----------------|------|
| Layered icon form | `.icon` plus the flat set / `.icon` alone / layer PNGs | Loop's call (ADR 0039): `.icon` with SVG layers, the flat set as fallback | 2026-11-24 |
| Which widget headers carry the logo | every widget / the medium and large list only | Loop's call (ADR 0039): every widget, the template glyph before the title | 2026-11-24 |
| The sign-in screen's logo | the app icon it already draws / the lockup | Loop's call: the app icon, now glass; no layout change | 2026-11-24 |

## Test strategy summary

Red first in `brand-assets.test.ts`: the `.icon` document exists, names the macOS square, has at least two groups whose layers each name an image that exists, and each layer is byte-identical to its `docs/brand` source; the widget headers draw the shared glyph. A build with no `actool` warning. A walk: the built app's icon as the system draws it, `ictool` renders of the six looks, the sign-in screen light and dark, the status item, and the widgets rendered light and dark. README shots replaced and added.
