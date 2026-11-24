# 0038. The brand sources are SVGs in docs/brand, and the app's assets are generated from them

- Status: Proposed
- Date: 2026-11-24
- Deciders: Claude (the build loop's call, pending the owner); Dhyego Calota (owner) supplied the logo and may overturn this
- Inspired by: the owner's request of 2026-11-24 to publish todz under its own logo (`todz-icon.svg`, `todz-menubar.svg`, `todz-lockup.svg`), [ADR 0030](0030-product-screenshots-live-in-docs-screenshots-and-the-readme-walks-them.md), [ADR 0036](0036-the-menu-bar-icon-counts-today-s-open-tasks-behind-a-setting.md)

## Context

The owner drew three SVGs: the app icon (1024, a cobalt squircle with a white check and a mint spark), the menu bar glyph (36, black on transparent) and the lockup (the icon beside the word). The app has no icon yet, its status item uses the SF Symbol `checkmark.square`, and the README has a plain title. An Xcode asset catalog needs PNGs at fixed sizes for the app icon; a template image can be a vector PDF.

## Decision

1. The three SVGs live in `docs/brand/`, the one source. They are never edited by hand in the asset catalog.
2. The app icon set `AppIcon.appiconset` holds PNGs at 16, 32, 64, 128, 256, 512 and 1024 pixels (the macOS sizes at 1× and 2×), rendered from `todz-icon.svg` with `rsvg-convert`, and committed.
3. The status item's glyph is `MenuBarGlyph.imageset`: one PDF rendered from `todz-menubar.svg` with `rsvg-convert -f pdf`, marked as a template image that preserves its vector data. Like the SF Symbol before it, it tints with the menu bar, and the count of ADR 0036 sits after it.
4. The README's header is `todz-lockup.svg`, and the app icon at 128 points sits above the product screenshot as its hero. Both are linked from `docs/brand/`.
5. How to render the assets again is a runbook, `docs/runbooks/render-the-brand-assets.md`, because a person changes the logo, not an agent's build. The build never renders them, so no tool joins the machine's required list.

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| SVG sources in `docs/brand`, rendered PNG/PDF committed (chosen) | builds need no tool; one source for the README and the app | rendered files can drift from the SVG | the runbook renders all of them at once |
| Render at build time with a script | never drifts | `rsvg-convert` becomes a required tool for every build | the doctor would need a new required tool for a rare change |
| Keep the SF Symbol in the menu bar | system look | not the owner's brand | the owner asked for his glyph |
| A PNG menu bar glyph at 1× and 2× | simple | blurs at other scales | a vector PDF template scales |

## Consequences

- A logo change is one runbook pass and one commit of the rendered files.
- `Assets.xcassets` gains `AppIcon` and `MenuBarGlyph`; `project.yml` sets `ASSETCATALOG_COMPILER_APPICON_NAME: AppIcon`.

## Evidence

`rsvg-convert` and `magick` are installed on this Mac (2026-11-24). The owner's folder also holds `todz-icon-1024.png`, `todz-menubar-72.png` and `todz-lockup.png`, his own renders, which the rendered files are compared against.

## Revisit when

The logo changes often enough that drift becomes a problem, or the README needs a dark-mode lockup.
