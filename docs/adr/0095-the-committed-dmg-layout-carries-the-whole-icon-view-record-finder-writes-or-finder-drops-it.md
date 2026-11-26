# 0095. The committed DMG layout carries the whole icon view record Finder writes, or Finder drops it

- Status: Accepted
- Date: 2026-11-26
- Deciders: Claude (the build loop's call); Dhyego Calota (owner) may overturn it
- Inspired by: [ADR 0083](0083-the-release-dmg-opens-on-a-committed-background-and-a-committed-ds-store-layout-copied-into-the-image-folder.md), the released DMG opening without its background picture

## Context

ADR 0083 commits a `.DS_Store` made with the `ds_store` library and copies it into the image folder. The released DMG opened at the right window size and icon positions, but on a plain window: no background picture, and icons at Finder's default size instead of the 128 points the record asks for.

The cause, found by mounting images built from the same staging folder and opening each in Finder: the committed `icvp` (icon view) record had `backgroundType`, `backgroundImageAlias`, `iconSize` and `textSize` but none of `backgroundColorRed`, `backgroundColorGreen`, `backgroundColorBlue` or `axTextSize`, which Finder itself always writes. Finder discards an incomplete `icvp` record whole, so neither the picture nor the icon size applied, while `bwsp` (window bounds) and `Iloc` (positions) still did. The alias inside was never the problem: a record with the stale alias and the four missing keys shows the picture, and so does a store Finder wrote on another image with another volume identifier.

## Decision

1. The committed `dmg-layout.dsstore` keeps its method (ADR 0083) and gains the four keys, so its `icvp` record matches what Finder writes.
2. A repository-shape test fails when the layout lacks any key of that record.
3. A change to the layout is proven by mounting a freshly built image with `hdiutil attach` and looking at its Finder window, never by reading the store alone: Finder accepting a record is the only proof that counts.

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| Add the four keys to the committed store (chosen) | One binary changed; still no GUI, mount or Accessibility at build time; proven on a fresh image | The key list is a fact about Finder, kept honest by the test and the hand proof | — |
| Commit a store Finder wrote on a throwaway image | Exactly what Finder writes | Embeds the scratch path and volume identifier of the machine that made it, and `pBBk` bookmarks | The four keys are enough and leak nothing |
| Finder AppleScript at build time | Always current | Needs a GUI session and Automation permission; opens windows in front of the owner | Already rejected by ADR 0083 |

## Consequences

- The next release opens on the branded window.
- A proof by hand attaches the image with `-nobrowse`, opens its one volume window, captures that window with `screencapture -l` and detaches the image.

## Evidence

Images built from the release script's staging steps and opened in Finder: the committed store shows no picture; the committed store plus Finder's `icvp` shows it; the committed store plus only the four keys shows it. Screenshots are in the pull request.

## Revisit when

- Finder starts rejecting the record for another missing key.
