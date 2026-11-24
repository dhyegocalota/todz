# Tester briefing: The todz brand

Written by the developer sub-agent when its steps are done. The developer does not run `test-plan.md` and does not declare the feature works.

## What changed

- `tools/repository-shape/src/brand-assets.test.ts` — new: the app icon set covers 16, 32, 128, 256, 512 at 1x and 2x, every file is a PNG at its slot's pixel size, and the glyph is one template PDF that preserves vectors.
- `apps/macos/Todz/Assets.xcassets/AppIcon.appiconset/` — seven PNGs (16, 32, 64, 128, 256, 512, 1024) rendered with `rsvg-convert`, and a `Contents.json` mapping them to ten mac slots (the 32, 256 and 512 files serve two slots each).
- `apps/macos/Todz/Assets.xcassets/MenuBarGlyph.imageset/` — an 18 by 18 point PDF and its template `Contents.json`.
- `apps/macos/project.yml` — `ASSETCATALOG_COMPILER_APPICON_NAME: AppIcon` on the Todz target.
- `apps/macos/Todz/MenuBar/MenuBarLabel.swift` — `Image(menuBarGlyphName)` replaces the SF Symbol; the count and the accessibility label are untouched.
- `README.md` — the lockup replaces the `<h1>`, the icon at 128 sits above the hero screenshot. `apps/macos/README.md` names the icon and the glyph.
- `docs/runbooks/render-the-brand-assets.md` and its index row.
- `docs/features/brand/spec.md`, `docs/features/README.md` — status `Building`; `plan.md` steps 1 to 4 ticked.

## How to run

```bash
cd tools/repository-shape && npx vitest run src/brand-assets.test.ts
xcodegen generate --spec apps/macos/project.yml
xcodebuild build -project apps/macos/Todz.xcodeproj -scheme Todz -configuration Debug -derivedDataPath <scratch folder>
```

## Red today, green after

| Test | Red before the change because | Green after because |
|------|--------------------------------|---------------------|
| `brand-assets.test.ts::the app icon set covers every macOS size at 1x and 2x` | ENOENT on `AppIcon.appiconset/Contents.json` (red commit 5b01022) | the set names all ten slots |
| `brand-assets.test.ts::every app icon image uses the macOS idiom and names a file that exists` | the same ENOENT | each slot names an existing file |
| `brand-assets.test.ts::every app icon file is a png at the pixel size its size and scale give` | the same ENOENT | headers read 16 to 1024 |
| `brand-assets.test.ts::the menu bar glyph is one pdf that tints with the menu bar and keeps its vectors` | ENOENT on `MenuBarGlyph.imageset/Contents.json` | template intent, preserved vectors, `%PDF-` header |

Red run printed, four times: `Error: ENOENT: no such file or directory, open '.../apps/macos/Todz/Assets.xcassets/AppIcon.appiconset/Contents.json'` (the glyph test names `MenuBarGlyph.imageset/Contents.json`); `Tests 4 failed (4)`.

## Hypotheses to attack

1. Hypothesis: `rsvg-convert` kept the drop shadow, so the 1024 render matches the owner's `todz-icon-1024.png`. Break it by: compare both at 400 percent around the check's lower edge.
2. Hypothesis: the glyph is a template and tints with the bar. Break it by: a dark and a light menu bar, and the count switched off.
3. Hypothesis: the glyph shows at menu bar height (18 points) next to the count. Break it by: a screenshot of the status item at 1x and 2x displays.
4. Hypothesis: the build has no asset warning. Break it by: build again and grep the log for `warning:` and `actool`.
5. Hypothesis: the widgets target, which compiles the same catalog, still builds and shows no icon problem. Break it by: build the `TodzWidgets` scheme and read the log.
6. Hypothesis: the README header renders on GitHub, the lockup at 360 pixels and the icon at 128 above the hero. Break it by: open the branch's README view.

## Known gaps

- The app was never launched by me, so the Dock, About panel and status item are unproven.
- The runbook's `magick` fallback was not exercised, because `rsvg-convert` kept the shadow.
- `docs/screenshots/menu-bar-count/01-count.png` still shows the SF Symbol; the tester replaces it.
- ADR 0038 is still `Proposed`.
