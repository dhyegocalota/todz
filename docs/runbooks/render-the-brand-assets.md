# Render the brand assets

Render the app icon and the menu bar glyph again from the SVGs in [docs/brand](../brand/), after the logo changes ([ADR 0038](../adr/0038-the-brand-sources-are-svgs-in-docs-brand-and-the-app-s-assets-are-generated-from-them.md)).

1. **Check the tools.** Run `rsvg-convert --version` and `magick --version` from the repository root.
   Expected: both print a version.
   If it fails: install librsvg and ImageMagick with Homebrew (`brew install librsvg imagemagick`); the build never needs them, only this runbook does.

2. **Render the app icon.** From the repository root, render `docs/brand/todz-icon.svg` once per size into `apps/macos/Todz/Assets.xcassets/AppIcon.appiconset/`, naming each file `icon-<pixels>.png`:

   ```bash
   rsvg-convert -w 1024 -h 1024 docs/brand/todz-icon.svg -o apps/macos/Todz/Assets.xcassets/AppIcon.appiconset/icon-1024.png
   ```

   Repeat with 512, 256, 128, 64, 32 and 16. `Contents.json` in that folder maps them to the ten macOS slots and does not change.
   Expected: seven PNGs, each at the pixel size in its name.
   If it fails: a PNG at the wrong size means the `-w` and `-h` pair disagrees; render it again. If the drop shadow under the check is missing, render with `magick` instead and note it here. `rsvg-convert` kept the shadow on 2026-11-24, so this was not needed.

3. **Compare with the owner's render.** Open the 1024 PNG and the owner's `todz-loop/brand/todz-icon-1024.png` side by side.
   Expected: the squircle, the gradient, the white check with its soft shadow and the mint spark match.
   If it fails: a difference in the shadow or the gradient means the renderer dropped a filter; use the `magick` render of step 2.

4. **Render the menu bar glyph.** Render `docs/brand/todz-menubar.svg` as an 18 by 18 point PDF, the height of the menu bar's image:

   ```bash
   rsvg-convert -f pdf1.4 --dpi-x 72 --dpi-y 72 -w 18 -h 18 docs/brand/todz-menubar.svg -o apps/macos/Todz/Assets.xcassets/MenuBarGlyph.imageset/MenuBarGlyph.pdf
   ```

   Expected: one PDF of about a kilobyte whose `pdfinfo` page size reads `18 x 18 pts`; the imageset's `Contents.json` keeps `template-rendering-intent` as `template` and `preserves-vector-representation` as `true`.
   If it fails: a page of 13.5 points means the dpi flags are missing, because `rsvg-convert` reads pixels at 90 dpi; render it again with them. PDF 1.4 keeps the page box readable as plain text for `brand-assets.test.ts`. A glyph that is black on a dark menu bar means the template intent is missing from `Contents.json`; restore it.

   The README header uses `docs/brand/todz-lockup.png`, the owner's own render, because the lettering of `todz-lockup.svg` depends on installed fonts and GitHub has none of them; replace the PNG with the owner's new render when the lockup changes, never with a render from this machine.

5. **Prove the catalog.** Run `pnpm verify`.
   Expected: the `shape` gate passes `brand-assets.test.ts` and the `macos` gate builds with no `actool` warning.
   If it fails: the test names the image whose file is missing or whose pixel size disagrees with its slot; render that size again.
