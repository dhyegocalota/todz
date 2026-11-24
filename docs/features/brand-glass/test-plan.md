# Test plan: The Liquid Glass brand

Every checkbox states the input and the exact expected outcome. A ticked box carries evidence after ` — evidence: ` (commit hash, log path, counts, screenshot path).

## The failing test first

- [ ] `tools/repository-shape/src/brand-assets.test.ts` — input: the red commit (no `AppIcon.icon`, no `WidgetBrandGlyph`); expected: the new tests fail naming the missing `icon.json` and the missing glyph view, the five tests of `brand` still pass
- [ ] Confirmed it fails for the right reason: the failure text recorded from a throwaway worktree at the red commit

## Unit

- [ ] `icon.json` names `macOS` among its squares and holds at least two groups; expected: green
- [ ] Every layer's image exists in `AppIcon.icon/Assets`; expected: green
- [ ] The fill is the `#4C6BFF`→`#1B2A9E` linear gradient and the groups `sparkle` and `check` are each one glass layer; expected: green
- [ ] Each layer image is byte-identical to `docs/brand/todz-icon-<layer>.svg` with the view box `80 80 864 864` at 1024; mutation: change one byte of the copy, expected red naming the file, restored
- [ ] The four titles (`WidgetHeader`, `WidgetPrompt`, Next up, the ring) draw `WidgetBrandGlyph`, and its image set exists; mutation: rename the image in `WidgetBrandGlyph.swift`, expected red, restored
- [ ] `pnpm verify all`: green, gates recorded

## Prove it for real — the app (ADR 0026)

- [ ] Build: `xcodegen generate` lists `AppIcon.icon` as `wrapper.icon` with no loose `check.svg` resource; `xcodebuild` succeeds with no `actool` warning; the built app holds `Assets.car` and `AppIcon.icns`, and its Info.plist names `CFBundleIconName` `AppIcon`
- [ ] The system's icon for the built app, drawn by `NSWorkspace.icon(forFile:)` from a fresh copy of the bundle, is the glass icon (glass rim, no grey frame, no hairline across the check)
- [ ] `ictool` renders the committed document in the six looks (Default, Dark, ClearLight, ClearDark, TintedLight, TintedDark); expected: each shows the check and the sparkle, the dark look on a dark tile, clear and tinted without the cobalt; saved as `docs/screenshots/brand-glass/01-app-icon-looks.png`
- [ ] The flat fallback: `assetutil --info` on the built `Assets.car` lists both the icon stack and the flat `AppIcon` images from 16 to 1024; the built Info.plist names `CFBundleIconName` `AppIcon`, which macOS 11 and later read before `CFBundleIconFile`; the `AppIcon.icns` sizes are listed with `iconutil -c iconset`
- [ ] The sign-in screen in light shows the glass icon above "todz"; screenshot replaces `docs/screenshots/mac-app-shell/01-sign-in.png`
- [ ] The sign-in screen in dark (the app launched with `-AppleInterfaceStyle Dark`) shows the same icon on the dark window; `docs/screenshots/brand-glass/02-sign-in-dark.png`
- [ ] The About panel shows the glass icon
- [ ] The status item shows the template glyph with the count after it, on this Mac's bar; light and dark where reachable, otherwise the unreachable half marked BLOCKED with the reason
- [ ] The four widgets rendered from their views in light: the glyph before "Today", "Next up" and the workspace or "Today" title, accent-tinted, no title truncated in the small sizes; the shots replace `docs/screenshots/widgets/01`–`04`
- [ ] The same four in dark; `docs/screenshots/brand-glass/03-widgets-dark.png`
- [ ] The same four with `widgetRenderingMode` `.accented`: the glyph takes the accent group like the ring; saved for the PR in `.pr-media/brand-glass/`
- [ ] The prompt state of each widget (no snapshot) shows the glyph before its title
- [ ] Small widgets with a long workspace name or title: the title truncates, the glyph stays whole
- [ ] The tester leaves every shot in its scratchpad folder and names it in the test plan; the lead moves them into `docs/screenshots/`
- [ ] VoiceOver: the widget header's accessibility label is the title alone, the glyph is hidden
- [ ] README: every new or replaced shot is shown, captions say which are rendered; `product-screenshots.test.ts` green

## Edge cases found during execution

Empty on purpose. The tester adds one checkbox per new case (input, exact expected outcome) and a regression test for each.

## Adversarial review

The reviewer picks the three claims most likely to be wrong and tries to refute each.

- [ ] Claim 1: <claim> — attack: <how>; result: <refuted | held>
- [ ] Claim 2: <claim> — attack: <how>; result: <refuted | held>
- [ ] Claim 3: <claim> — attack: <how>; result: <refuted | held>

## Coverage honesty

What is not tested and why.

- macOS 14 and 15 are not available on this Mac: the fallback is proven by the catalog's contents and the Info.plist keys, not by an older system drawing it. A Finder that reads `AppIcon.icns` instead would show the compiler's flattened render, with its streak, at 256 pixels at most.
- The vibrant look of a widget on a tinted desktop is not rendered: `ImageRenderer` has no vibrancy.
- A widget placed on the desktop is not walked (it needs the owner); the widgets are rendered from their views.
