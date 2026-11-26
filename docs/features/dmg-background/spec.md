# The release DMG opens on a branded window

**Status:** Shipped 2026-11-26
**Tier:** 🟢
**Owner approval:** approved 2026-11-26 (the loop decides, per the owner's standing instruction)
**ADRs:** [0083](../../adr/0083-the-release-dmg-opens-on-a-committed-background-and-a-committed-ds-store-layout-copied-into-the-image-folder.md)
**Not changing:** the DMG's name, format (UDZO), signing, sum, SSH signature, appcast and the release gate.

## Problem

The DMG opened on a bare folder of the app and an `Applications` link.

## Goals

- The window opens with a background in the todz brand and an arrow from Todz.app to Applications, readable in light and dark mode, with a 2x variant.
- The layout is deterministic: no GUI session and no Accessibility permission at build time.

## Non-goals

- Notarization, a custom volume icon, a license agreement.

## Design

### Data flow

`create_disk_image` copies `dmg-background.tiff` into `.background/` and `dmg-layout.dsstore` as `.DS_Store` into the staging folder that `hdiutil create -srcfolder` packs.

### Interfaces

`apps/macos/release/dmg-background.svg` (source), `dmg-background.tiff` (1x at 72 dpi and 2x at 144 dpi), `dmg-layout.dsstore`.

### Failure handling

A missing background or layout refuses the release before the build, naming the file.

## Open questions → answers

| Question | Options | Owner's answer | Date |
|----------|---------|----------------|------|
| How is the layout set? | Committed `.DS_Store`, Finder AppleScript | Loop's call: committed `.DS_Store` (ADR 0083) | 2026-11-26 |

## Test strategy summary

`scripts/release-mac.test.sh` with the fake `hdiutil` recording the staged folder.
