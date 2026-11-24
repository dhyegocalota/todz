# Tester briefing: Brand glass

Written by the developer sub-agent when its steps are done. The developer does not run `test-plan.md` and does not declare the feature works.

## What changed

- `apps/macos/Todz/AppIcon.icon/` — the Icon Composer document: `icon.json` (gradient `#4C6BFF` to `#1B2A9E`, a `sparkle` group and a `check` group, one glass layer each, neutral shadow, `macOS` among its squares) and `Assets/sparkle.svg`, `Assets/check.svg`. `AppIcon.appiconset` is untouched and stays the flat fallback.
- `docs/brand/todz-icon-check.svg`, `docs/brand/todz-icon-sparkle.svg` — the layer sources; the copies in `Assets/` are byte-identical. The check is the filled outline of the stroke in `todz-icon.svg`, which is not edited.
- `apps/macos/TodzWidgets/Views/WidgetBrandGlyph.swift` — the `MenuBarGlyph` image set as a template, 16 point square, accent colour, `widgetAccentable`, `unredacted`, layout priority above the title's, hidden from accessibility.
- `WidgetHeader.swift`, `WidgetPrompt.swift`, `NextUpView.swift`, `TodayRing.swift` — each draws `WidgetBrandGlyph()` before its title in an `HStack`. The spoken labels are the titles alone.
- `tools/repository-shape/src/brand-assets.test.ts` — seven new tests.
- `docs/runbooks/render-the-brand-assets.md` — Xcode 27 and `ictool` in the tools step; steps for the layer cut, the copy into the document and the six `ictool` renders; the proof step renumbered to 8.
- `apps/macos/README.md` — names the glass icon and the widgets' glyph.

## How to run

```bash
pnpm install
cd tools/repository-shape && npx vitest run src/brand-assets.test.ts
cd ../../apps/macos && xcodegen generate --quiet
xcodebuild -project Todz.xcodeproj -scheme Todz -configuration Debug -derivedDataPath <scratchpad>/dev-dd build 2>&1 | grep -E 'warning:|error:|BUILD'
```

`Todz.xcodeproj` is git-ignored: `xcodegen generate` makes it. The build ran on Xcode 27.2 with no warning and `** BUILD SUCCEEDED **`; check `actool` printed nothing about `AppIcon.icon`.

## Red today, green after

Red commit: `87ed6fd`. Five older tests passed in it; the seven new ones failed.

| Test | Red before the change because | Green after because |
|------|--------------------------------|---------------------|
| `brand-assets.test.ts::the layered app icon is made for macOS` | `ENOENT: no such file or directory, open '.../apps/macos/Todz/AppIcon.icon/icon.json'` | `icon.json` exists and lists `macOS` (`8d88995`) |
| `::the layered app icon fills with a linear gradient from the brand blue to the deep blue` | same `ENOENT` | the two srgb stops read back as `#4C6BFF` and `#1B2A9E` (`8d88995`) |
| `::the layered app icon holds a sparkle group and a check group, each one glass layer` | same `ENOENT` | the groups are `sparkle` then `check`, each `glass: true` (`8d88995`) |
| `::every layer of the layered app icon names an image that exists in its assets` | same `ENOENT` | both `image-name`s exist in `Assets/` (`8d88995`) |
| `::every layer image is a byte copy of its brand source at the squircle view box` | same `ENOENT` | the copies equal `docs/brand/todz-icon-<layer>.svg`, view box `80 80 864 864`, 1024 by 1024 (`8d88995`) |
| `::the widget titles draw the todz glyph before their text` | `AssertionError: expected [ 'WidgetHeader.swift', …(3) ] to deeply equal []` | all four files contain `WidgetBrandGlyph(` (`6375b96`) |
| `::the widget glyph names an image set that exists in the catalog` | `ENOENT: ... TodzWidgets/Views/WidgetBrandGlyph.swift` | the file declares `brandGlyphName = "MenuBarGlyph"`, an image set in the catalog (`6375b96`) |

The glyph test matches `GlyphName = "..."` in the file (the red commit matched `Image("...")`; `6375b96` changed the pattern to follow the `menuBarGlyphName` constant style of `MenuBarLabel.swift`).

## Hypotheses to attack

1. Hypothesis: the system draws a clean glass icon from `AppIcon.icon` with no hairline across the check. Break it by: build, then look at the built app's icon in Finder at 16, 32, 128 and 512 points, and render the six looks with `ictool` as in the runbook.
2. Hypothesis: the check's outline draws what the stroke drew. Break it by: render a stroke-only SVG of the path in `todz-icon.svg` and `todz-icon-check.svg` at 1024 with `rsvg-convert`, and run `magick compare -metric AE -fuzz 10%`; it should read `0`.
3. Hypothesis: `AppIcon.appiconset` still serves older systems. Break it by: confirm `git diff main -- apps/macos/Todz/Assets.xcassets` is empty and the built `Assets.car` holds both the icon stack and the flat set.
4. Hypothesis: the glyph shows before the title in all four widgets and the title is still spoken alone. Break it by: render the widgets as below in light and dark; read `WidgetHeader`'s combined label and `TodayRing`'s `accessibilityElement(children: .ignore)` for a glyph in the spoken text.
5. Hypothesis: a long title truncates before the glyph does. Break it by: render with a sample task whose title is far longer than the family's width; `WidgetHeader`'s title is the only text at `lineLimit(1)`.
6. Hypothesis: the glyph survives redaction and accents. Break it by: add the widget in the gallery on this Mac, then use Edit Widget and the accented and tinted looks; the glyph should take the tint and never disappear in the placeholder.

## How to render the widgets from their views

A scratch Swift package in the scratchpad, never in the repository. The developer built one on 2026-11-24 and it drew all eight images (four views, light and dark) in about ten seconds.

1. `Package.swift`: tools version 6.0, macOS 14, one executable target `WidgetRender` with `swiftLanguageMode(.v5)`, depending on the local package `apps/macos/TodzKit` (`.package(path: ...)`, product `TodzKit`).
2. `Sources/WidgetRender/`:
   - a copy (`cp -R`, not a link) of `apps/macos/TodzWidgets/Views`;
   - links to `apps/macos/Copy`, and to `TodayEntry.swift`, `TodayEntry+Sample.swift`, `WidgetDay.swift`, `WidgetSnapshotTask+Key.swift`, `ToggleTaskIntent.swift` and `FileWidgetStore+Shared.swift` from `apps/macos/TodzWidgets`;
   - `main.swift`.
3. Three edits to the copied views, because the widget machinery does not run in a plain process:
   - `WidgetTaskRow.swift`: `Link(destination: WidgetLink.task(key).url) {` becomes `Group {`, since `ImageRenderer` draws a `Link` as a yellow placeholder.
   - `TodayListView.swift`: `@Environment(\.widgetFamily) private var widgetFamily` becomes `var widgetFamily: WidgetFamily = .systemMedium`, since `widgetFamily` is a read-only environment key; `main.swift` passes `widgetFamily: .systemLarge` for the large shot.
   - `WidgetBrandGlyph.swift`: `Image(brandGlyphName)` becomes `Image(nsImage: NSImage(contentsOfFile: ".../Todz/Assets.xcassets/MenuBarGlyph.imageset/MenuBarGlyph.pdf")!)` with `import AppKit`, since a package has no asset catalog; without it the glyph is blank.
4. `main.swift`: for each shot, build the view from `TodayEntry.sample(at: .now)` (`TodayRing(content: entry.content(of: .small))`, `NextUpView(entry:)`, `TodayListView(entry:widgetFamily:)`), pad it 16 points inside a frame of the family's size, put a `windowBackgroundColor` behind it, apply `.environment(\.colorScheme, .light)` or `.dark`, render with `ImageRenderer` at scale 2 and write the PNG from `renderer.nsImage`. Sizes are the system's: small 170 by 170, medium 364 by 170, large 364 by 382 points. The PNGs in `docs/screenshots/widgets` are larger (532 by 532, 920 by 532, 920 by 956) because they include the widget's margin on the desktop, so compare the glyph and title, not the pixel size.
5. `swift run WidgetRender <output folder>`.

`widgetRenderingMode` is read-only like `widgetFamily`, so the accented look cannot be forced from the package; the glyph's `widgetAccentable()` is checked by reading the file and by the gallery in hypothesis 6.

The developer saw the glyph beside "Today" and "Next up" in the renders, centred on the title line with the title in the headline font. Alignment is centre, not first text baseline: an image has no baseline of its own, so `firstTextBaseline` would sit its bottom edge on the text baseline and lift it. The tester decides whether centre reads right.

## Known gaps

- The `ictool` renders of the six looks and the system's own drawing of the icon were not looked at by the developer beyond the build; the tester does that.
- The accented and tinted widget looks were not rendered (see above).
- The glyph is 16 points square, set by the developer to sit near the headline's height; the spec names the side only as a constant.
- `docs/README.md` carries an uncommitted line about the glass layers that this lane did not write; it belongs to the lead.
