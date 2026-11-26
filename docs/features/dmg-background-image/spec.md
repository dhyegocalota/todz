# The released DMG shows its background picture in Finder

**Status:** Shipped 2026-11-26
**Tier:** 🟢
**Owner approval:** inherited from docs/product/README.md, approved 2026-11-23 (the loop decides)
**ADRs:** [0095](../../adr/0095-the-committed-dmg-layout-carries-the-whole-icon-view-record-finder-writes-or-finder-drops-it.md), amends [0083](../../adr/0083-the-release-dmg-opens-on-a-committed-background-and-a-committed-ds-store-layout-copied-into-the-image-folder.md)
**Not changing:** the release command, the image format, signing, sum, signature and appcast.

## Problem

The released DMG opens with the intended window size and icon positions but without the background picture, and with icons at the default size.

## Goals

- A freshly built DMG, mounted and opened in Finder, shows the background picture and the 128-point icons.

## Non-goals

- A new background, a new layout, notarization.

## Design

### Data flow

Unchanged: `create_disk_image` copies the layout as `.DS_Store` and the picture into `.background/`. Only the layout file changes: its `icvp` record gains `backgroundColorRed`, `backgroundColorGreen`, `backgroundColorBlue` and `axTextSize`, which Finder requires before it honours the record.

### Failure handling

A layout without those keys fails a repository-shape test.

## Open questions → answers

| Question | Options | Owner's answer | Date |
|----------|---------|----------------|------|
| How is the layout repaired? | Add the missing keys, commit a Finder-written store, Finder AppleScript | Loop's call: add the keys (ADR 0095) | 2026-11-26 |

## Test strategy summary

A repository-shape test on the layout file, and a hand proof: a freshly built image attached with `hdiutil attach` and opened in Finder.
