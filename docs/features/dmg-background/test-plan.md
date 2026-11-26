# Test plan: the release DMG opens on a branded window

Class tooling: the reviewer and the gate prove it.

- [x] `bash scripts/release-mac.test.sh`: the staged folder holds `.background/dmg-background.tiff`, `.DS_Store`, the app and the Applications link (the lead ran it green).
- [x] The image is packed as UDZO.
- [x] A missing background is refused with "the disk image background is missing" before xcodebuild and hdiutil.
- [x] A missing layout is refused with "the disk image layout is missing" before xcodebuild and hdiutil.
- [x] A throwaway DMG built with the real files mounts with `.background`, `.DS_Store`, `Applications`, `Todz.app`.
- [x] `tiffutil -info dmg-background.tiff`: 660x400 at 72 dpi and 1320x800 at 144 dpi.
