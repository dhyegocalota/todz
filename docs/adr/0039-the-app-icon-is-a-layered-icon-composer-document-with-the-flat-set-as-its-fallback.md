# 0039. The app icon is a layered Icon Composer document, with the flat set as its fallback

- Status: Proposed
- Date: 2026-11-24
- Deciders: Claude (the build loop's call, pending the owner); Dhyego Calota (owner) asked for the Liquid Glass icon and may overturn this
- Inspired by: the owner's request of 2026-11-24 ("o app, menu bar, tem que carregar tudo certinho a logo, o icon mas seguindo o glass style quando necessário"), [ADR 0038](0038-the-brand-sources-are-svgs-in-docs-brand-and-the-app-s-assets-are-generated-from-them.md), the spike recorded in [brand-glass](../features/brand-glass/spec.md)

## Context

ADR 0038 made the app icon a set of flat PNGs rendered from `todz-icon.svg`. On macOS 26 a flat icon is shown inside a grey glass frame and never takes the system's dark, clear or tinted looks; only a layered icon does. Xcode 27.2 compiles Icon Composer's `.icon` document, a folder holding `icon.json` and its layer images, into the asset catalog's icon stack and an `AppIcon.icns`, and XcodeGen 2.48 adds it as a `wrapper.icon` resource. The owner also wants his logo on the widgets.

## Decision

1. `apps/macos/Todz/AppIcon.icon` holds the icon: the background is the document's own linear gradient from `#4C6BFF` to `#1B2A9E`, and two glass layer groups, the sparkle and the check, each an SVG on the full 1024 canvas with no margin, because the system draws the squircle and its margins.
2. The two layer SVGs are cut from `todz-icon.svg` and live beside it in `docs/brand` as `todz-icon-check.svg` and `todz-icon-sparkle.svg`; the copies in `AppIcon.icon/Assets` are byte-identical, which a repository-shape test checks. The check is a filled outline of the original stroke, because the icon compiler draws a stroked open path with its closing edge.
3. `AppIcon.appiconset` stays, under the same name, as the flat fallback: on macOS 26 the system draws the icon stack; earlier systems read the flat images from the same catalog. The `AppIcon.icns` the compiler flattens from the layers stops at 256 pixels and carries a specular streak, so it is not the fallback we rely on.
4. The widgets show the menu bar's template glyph before their title, tinted with the accent and accentable, so it follows the widget's full-colour, accented and vibrant looks.
5. Light, dark, clear and tinted renders come from `ictool`, Icon Composer's command line, on the committed document; the runbook renders them.

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| An `.icon` document plus the flat set (chosen) | glass, dark, clear and tinted on macOS 26; the owner's flat art on macOS 14 and 15 | two icon sources to keep in step | the shape test pins the layers to `docs/brand`, the runbook renders both |
| The `.icon` alone, with the compiler's flattened `.icns` as fallback | one source | the flattened fallback stops at 256 pixels and shows a glass streak across the check | worse on the systems the fallback serves |
| Keep the flat set | nothing to do | macOS 26 frames it in grey glass and never tints it | the owner asked for the glass style |
| Layer PNGs instead of SVGs | no outline step | they blur at sizes the system scales to | the vectors stay sharp |

## Consequences

- A logo change also re-cuts the two layer SVGs; the runbook says how, and the shape test fails while the copies differ.
- The widget extension already compiles the asset catalog, so it reaches the glyph with no new resource.

## Evidence

Spike on 2026-11-24, in the scratchpad: `actool` compiled the document for macOS 14 into an icon stack and an `AppIcon.icns` of 16 to 256 pixels; with the flat set under the same name the catalog held both. `NSWorkspace.icon(forFile:)` of the built app drew the glass icon on macOS 26.6.2. A stroked check drew a hairline closing edge across the check; the filled outline matched the stroke's render with 0 differing pixels (`magick compare -metric AE`) and drew no line.

## Revisit when

The deployment target reaches macOS 26, so the flat set can go, or Icon Composer's format changes.
