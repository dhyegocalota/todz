# Render the brand assets

Render the app icon, its glass layers and the menu bar glyph again from the SVGs in [docs/brand](../brand/), after the logo changes ([ADR 0038](../adr/0038-the-brand-sources-are-svgs-in-docs-brand-and-the-app-s-assets-are-generated-from-them.md), [ADR 0039](../adr/0039-the-app-icon-is-a-layered-icon-composer-document-with-the-flat-set-as-its-fallback.md)). Renders that are only looked at go to the git-ignored `.pr-media/`, never into the repository.

1. **Check the tools.** Run `rsvg-convert --version`, `magick --version` and `xcodebuild -version` from the repository root, then `/Applications/Xcode.app/Contents/Applications/Icon\ Composer.app/Contents/Executables/ictool --version`.
   Expected: all four print a version, and Xcode reads 27 or later.
   If it fails: install librsvg and ImageMagick with Homebrew (`brew install librsvg imagemagick`); the build never needs them, only this runbook does. An Xcode older than 27 has no `ictool` at that path and its `actool` cannot read `AppIcon.icon`; install Xcode 27 or later.

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

5. **Cut the layers.** The icon compiler wants one SVG per glass layer, at 1024 pixels with the view box of the squircle in `docs/brand/todz-icon.svg`, which is never edited:
   - `docs/brand/todz-icon-sparkle.svg` is the mint spark path of `todz-icon.svg` copied as is, under `<svg xmlns="http://www.w3.org/2000/svg" viewBox="80 80 864 864" width="1024" height="1024">`.
   - `docs/brand/todz-icon-check.svg` is the check as a filled outline of its stroke, because the compiler draws a stroked open path with a hairline closing edge. The stroke runs through `(300,532)`, `(448,680)` and `(724,404)` with a width of 96, so the half width is 48 and every offset is 48/√2, about 33.941. Start at the left side of the first segment at its start, `(266.059,565.941)`, and draw a line to the left side at the bend, `(414.059,713.941)`. Draw the outer join as an arc of radius 48 to `(481.941,713.941)`, a line to `(757.941,437.941)`, and the round cap as two arcs of radius 48 through `(757.941,370.059)` to `(690.059,370.059)`. Draw a line to the inner corner at the bend, `(448,612.118)`, then a line to `(333.941,498.059)`, and the first round cap as two arcs of radius 48 through `(266.059,498.059)` back to the start, then close the path. Fill it `#FFFFFF`.

   Expected: save the stroke alone as `.pr-media/stroke.svg`:

   ```xml
   <svg xmlns="http://www.w3.org/2000/svg" viewBox="80 80 864 864" width="1024" height="1024">
     <path d="M300 532 L448 680 L724 404" fill="none" stroke="#FFFFFF" stroke-width="96" stroke-linecap="round" stroke-linejoin="round"/>
   </svg>
   ```

   then `rsvg-convert -w 1024 -h 1024 .pr-media/stroke.svg -o .pr-media/stroke.png`, `rsvg-convert -w 1024 -h 1024 docs/brand/todz-icon-check.svg -o .pr-media/outline.png` and `magick compare -metric AE -fuzz 10% .pr-media/stroke.png .pr-media/outline.png null:` reads `0`. The stroke's path and width must match the check of `todz-icon.svg`; `brand-assets.test.ts` fails while they differ.
   If it fails: a non-zero count means an arc end or the inner corner is off; recompute the offsets from the half width. A hairline across the check in the icon means the check is still a stroked path.

6. **Copy the layers into the document.** Copy `docs/brand/todz-icon-sparkle.svg` to `apps/macos/Todz/AppIcon.icon/Assets/sparkle.svg` and `docs/brand/todz-icon-check.svg` to `apps/macos/Todz/AppIcon.icon/Assets/check.svg`, byte for byte. `icon.json` keeps the gradient from `#4C6BFF` to `#1B2A9E` and one glass layer per group.
   Expected: `cmp` of each pair prints nothing.
   If it fails: a copy that differs fails `brand-assets.test.ts`; copy it again.

7. **Render the six looks.** From the repository root, once per rendition `Default`, `Dark`, `ClearLight`, `ClearDark`, `TintedLight` and `TintedDark`:

   ```bash
   /Applications/Xcode.app/Contents/Applications/Icon\ Composer.app/Contents/Executables/ictool apps/macos/Todz/AppIcon.icon --export-image --output-file .pr-media/icon-default.png --platform macOS --rendition Default --width 512 --height 512 --scale 1
   ```

   Add `--tint-color 0.6 --tint-strength 0.8` to the two tinted renditions.
   Expected: six 512 pixel PNGs; Default and Dark show the blue gradient with the glass mint spark and white check, the clear looks show the glass alone, the tinted looks wear the tint.
   If it fails: `ictool` without the tint flags renders the tinted looks untinted; add them. A blank or missing layer means `icon.json` names an image that is not in `Assets`.

8. **Prove the catalog.** Run `pnpm verify`.
   Expected: the `shape` gate passes `brand-assets.test.ts` and the `macos` gate builds with no `actool` warning.
   If it fails: the test names the image whose file is missing or whose pixel size disagrees with its slot, or the layer whose copy differs from its source; render that size or copy that layer again.
