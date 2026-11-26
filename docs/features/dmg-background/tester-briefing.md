# Tester briefing: dmg-background

Changed: `scripts/release-mac.sh`, `scripts/release-mac.test.sh`, `apps/macos/release/dmg-*`, the release runbook, ADR 0083.

Run: `bash scripts/release-mac.test.sh`.

Red then green: the staged-folder and missing-file cases (`5f1df6a6` red, `fa386eab` green). Red text: "expected ./.background/dmg-background.tiff" and "expected the disk image background is missing".

Gap: Finder's honouring of the alias in the committed `.DS_Store` was not seen on a real window; check it on the first real release.
