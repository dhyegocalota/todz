# Test plan: The todz brand

Every checkbox states the input and the exact expected outcome. A ticked box carries evidence after ` — evidence: ` (commit hash, log path, counts, screenshot path).

## The failing test first

- [ ] `tools/repository-shape/src/brand-assets.test.ts` — input: the red commit (no `AppIcon.appiconset`, no `MenuBarGlyph.imageset`); expected: fails naming the missing `Contents.json` — evidence: throwaway worktree at 5b01022: `Tests  4 failed (4)`, `Error: ENOENT: no such file or directory, open '.../apps/macos/Todz/Assets.xcassets/AppIcon.appiconset/Contents.json'` (glyph test: `.../MenuBarGlyph.imageset/Contents.json`); worktree removed
- [x] Confirmed it fails for the right reason: the failure text recorded — evidence: the ENOENT text above; also f459bff (the 18 pt test before its fix): `AssertionError: expected null not to be null`, `Tests  1 failed | 4 passed (5)`, matching the briefing; worktree removed

## Unit

- [x] Every app icon image named in `Contents.json` exists at its pixel size; expected: green — evidence: `npx vitest run src/brand-assets.test.ts` at 2fafcef: `Tests  5 passed (5)`
- [x] The sizes 16, 32, 128, 256, 512 at 1× and 2× are all present; expected: green — evidence: same run, 5 passed
- [x] `MenuBarGlyph` is one PDF, template intent, vector preserved; expected: green — evidence: same run; `pdfinfo` reads `18 x 18 pts`
- [ ] `pnpm verify all`: green, gates recorded — FAILED: stops at the `format` gate (`prettier --check .`) at 2fafcef: `[warn] apps/macos/Todz/Assets.xcassets/AppIcon.appiconset/Contents.json`, `[warn] apps/macos/Todz/Assets.xcassets/MenuBarGlyph.imageset/Contents.json`; later gates not reached (see D1)

## Prove it for real — the app (ADR 0026)

- [x] The built `Todz.app` in Finder and the Dock shows the owner's icon (screenshot of the Finder icon via Quick Look or `qlmanage -t`) — evidence: built with xcodegen and xcodebuild into a scratch derived-data folder, `** BUILD SUCCEEDED **`; `qlmanage -t` hung past two minutes and produced no file, so the icon was read from the built bundle: `Todz.app/Contents/Resources/AppIcon.icns` converted with `sips` shows the owner's icon (blue tile, white check, mint sparkle); the Dock tile was NOT seen: the Dock is auto-hidden on this Mac and revealing it would disturb the owner (System Events lists a Dock item "Todz"), so the Dock half rests on the same icns
- [x] The About panel (app menu → About todz) shows the icon — evidence: launched hidden with `open -g -j`, "About Todz" clicked through System Events without activating (frontmost false); window screenshot `screencapture -l` shows the icon, "Todz", "Version 0.1.0 (1)"; saved in the scratchpad as about.png
- [x] The status item shows the glyph, not `checkmark.square`, on this Mac's bar, with the count after it when Today has open tasks; screenshot replaces `docs/screenshots/menu-bar-count/01-count.png` — evidence: fresh local API with the fake sign-in provider and two tasks due today (fictional): item title "todz, 2 left today", 50 x 24 pt at (956, 4), glyph then "2", both white like the bar; replaced `docs/screenshots/menu-bar-count/01-count.png` (180 x 60, 20 KB)
- [x] With the switch off, the glyph alone, tinted like the bar's other items — evidence: `defaults write dev.todz.Todz showsMenuBarCount -bool false`, relaunch: title "todz", item 36 x 24 pt, the glyph alone in white like the neighbouring item; key deleted afterwards (it was absent before); screenshot glyph-only.png in the scratchpad
- [x] The README on GitHub shows the lockup header and the icon above the screenshot (render the branch's README with `gh` or open the file view) — evidence: not a render: `gh api` on `feat/brand` returns `docs/brand/todz-lockup.png` (30986 bytes) and `docs/brand/todz-icon.svg` (1159 bytes); the README names both in the header and icon blocks (360 and 128 wide); the PNG viewed (1200 x 400, dark opaque background, so it shows as a dark banner on a light GitHub theme); the SVG viewed through `rsvg-convert`, which keeps the shadow, but GitHub's own SVG renderer was not run

## Edge cases found during execution

- D1 (defect): `pnpm verify all` fails at the `format` gate because Prettier flags `AppIcon.appiconset/Contents.json` and `MenuBarGlyph.imageset/Contents.json` as committed at 2fafcef (`git status` was clean for them; my `touch` changed no content). Expected: gate green. Needs a `pnpm exec prettier --write` on both files (or an ignore) and the gate re-run; the later gates were not reached.
- The owner's session file is removed by the app when a fresh local API rejects it (the app showed "Your session has ended"); the backup restored it, shasum 6d7f01fe1587e5a5d549fb7c6b8bd0750de9115c. Not a brand defect.
- `xcodebuild` output through the `rtk` wrapper hides the `actool` lines; they only show with `/usr/bin/xcodebuild`.
- The lockup PNG is opaque and dark: on a light GitHub theme it is a dark rectangle. By design of the owner's render, noted for the reviewer.

## Adversarial review

- [x] Claim 1: the rendered icon matches the owner's own render — attack: compare `AppIcon` 1024 with `todz-loop/brand/todz-icon-1024.png`; result: held — evidence: `cmp` of `AppIcon.appiconset/icon-1024.png` and the owner's `todz-icon-1024.png` reports the files byte-identical (so the shadow is kept); the built icns matches visually
- [x] Claim 2: the glyph is a template — attack: a dark and a light menu bar; result: held for the dark bar only — evidence: the glyph is white next to the white neighbour in both the count and the switch-off captures, and `Contents.json` says `template-rendering-intent: template`; a light bar is BLOCKED (see Coverage honesty), on the Human checklist
- [x] Claim 3: no build warning from the asset catalog — attack: read the `actool` lines of the build log; result: held — evidence: `/usr/bin/xcodebuild` log with the catalog touched: actool ran for `Todz` (twice, symbols and compile) and `TodzWidgets`, 0 `warning:` lines, `** BUILD SUCCEEDED **`

## Coverage honesty

- A light menu bar may not be reproducible on this Mac (the `menu-bar-count` tester could not); then the light half is on the Human checklist.
