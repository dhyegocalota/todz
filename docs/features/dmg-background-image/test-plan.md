# Test plan: the released DMG shows its background picture in Finder

Class tooling: the lead ticks it with the gate output and the reviewer refutes it.

- [x] `pnpm --filter ./tools/repository-shape exec vitest run src/macos-release.test.ts`: red before the layout change, green after.
- [x] A DMG built from the release script's staging steps with the committed files, attached with `hdiutil attach` and opened in Finder, shows the picture and 128-point icons; the window is captured with `screencapture -l`.
- [x] The same image before the change shows a plain window.
- [x] `bash scripts/release-mac.test.sh` stays green.
