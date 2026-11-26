# Test plan: the released DMG shows its background picture in Finder

Class tooling: the lead ticks it with the gate output and the reviewer refutes it.

- [x] `pnpm --filter ./tools/repository-shape exec vitest run src/macos-release.test.ts`: red at `34da1bb2` (`expected false to be true` on `backgroundColorRed`), green at the fix commit `9d24deaa` (14 passed).
- [x] The test decodes the `icvp` record (`binary-property-list.ts`) and asserts the key set, `iconSize` 128, `backgroundType` 2, the colour channels and an alias naming `/.background/dmg-background.tiff` on `Todz`: 16 passed; mutation check with the layout of `01872731` restored, 2 tests red ("every key Finder needs" and "128 point icons"), then restored.
- [x] A DMG built from the release script's staging steps with the committed files, attached with `hdiutil attach -nobrowse` and opened in Finder, shows the picture and 128-point icons; the window is captured with `screencapture -l` (`.pr-media/dmg-after.png`, attached to PR #87).
- [x] The same image before the change shows a plain window (`.pr-media/dmg-before.png`, attached to PR #87).
- [x] `bash scripts/release-mac.test.sh` stays green (exit 0).
- [x] `pnpm verify`: 7 gates green at `9d24deaa`.
