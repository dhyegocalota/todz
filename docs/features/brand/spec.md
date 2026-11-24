# The todz brand

**Status:** Approved
**Tier:** 🟢
**Owner approval:** approved 2026-11-24: the owner asked for his logo in the app icon, the menu bar glyph, the README header and hero, and the email header (relayed by the session that runs his checks). Where the sources live and how the assets are made is [ADR 0038](../../adr/0038-the-brand-sources-are-svgs-in-docs-brand-and-the-app-s-assets-are-generated-from-them.md), the loop's call, listed in the loop's questions for the owner
**ADRs:** [0038](../../adr/0038-the-brand-sources-are-svgs-in-docs-brand-and-the-app-s-assets-are-generated-from-them.md), [0036](../../adr/0036-the-menu-bar-icon-counts-today-s-open-tasks-behind-a-setting.md)
**Not changing:** the email header (it arrives with `transactional-email`, which reads the same lockup), any screen's layout, the accent colour

## Problem

todz has no icon: the Dock, Finder and the app switcher show the generic one, the menu bar shows an SF Symbol, and the README opens with a plain title.

## Goals

- The app icon in the Dock, Finder, the app switcher and the About panel is the owner's icon.
- The status item shows the owner's glyph as a template image, tinted with the menu bar, with the count after it as before.
- The README opens with the lockup, then the icon above the product screenshot.
- A runbook says how to render the assets again from the SVGs.

## Non-goals

- The widgets' look, the email header, a website.

## Design

### Data flow

`docs/brand/*.svg` → (`rsvg-convert`, by hand, the runbook) → `Assets.xcassets/AppIcon.appiconset/*.png`, `Assets.xcassets/MenuBarGlyph.imageset/MenuBarGlyph.pdf` → the app; `README.md` links the SVGs.

### Interfaces

- `MenuBarLabel` draws `Image(MenuBarGlyph)` in place of `Image(systemName: "checkmark.square")`.
- `project.yml`: `ASSETCATALOG_COMPILER_APPICON_NAME: AppIcon` on the app target.

### Failure handling

A missing asset fails the build (`actool`), which the `macos` gate catches.

## Open questions → answers

| Question | Options | Owner's answer | Date |
|----------|---------|----------------|------|
| Where do the sources live, and who renders them? | SVGs in `docs/brand` with committed renders / render at build | Loop's call (ADR 0038): committed renders, a runbook | 2026-11-24 |
| README header and hero | Lockup as header, icon as hero / lockup only | Loop's call: lockup as header, icon at 128 above the screenshot | 2026-11-24 |

## Test strategy summary

A repository-shape test that the asset catalog holds every app icon size the `Contents.json` names, each PNG at its stated pixel size, and that `MenuBarGlyph` is a template PDF; red first. A build. A walk: the Dock and the About panel show the icon; the status item shows the glyph, light and dark bars, with the count after it. README screenshot of the status item replaced.
