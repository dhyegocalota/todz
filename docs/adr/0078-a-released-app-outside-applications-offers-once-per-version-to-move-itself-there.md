# 0078. A released app outside Applications offers once per version to move itself there

- Status: Accepted
- Date: 2026-11-26
- Deciders: Claude (the build loop's call under the owner's "decide every call" instruction); Dhyego Calota (owner) asked for the feature after the release check, through todz-6f: "show one friendly sheet: Move todz to Applications so it can update itself → Move / Not now … remember Not now per version"
- Inspired by: [ADR 0072](0072-the-mac-app-downloads-from-todz-app-as-a-development-signed-dmg-with-an-ssh-signature-and-updates-through-sparkle.md) (the DMG and Sparkle), [ADR 0075](0075-the-mac-app-updates-itself-by-default-through-sparkle-and-the-first-release-s-gate-is-a-local-check-on-this-mac.md) (automatic updates)

## Context

The 0.2.0 local check ran the downloaded app from an App Translocation path: macOS runs a quarantined app that Finder never moved from a random read-only mirror, and Sparkle refuses to update a translocated app. The DMG already shows an Applications shortcut and the docs say to drag, but a visitor who opens todz from the disk image or from Downloads stays on that version forever.

## Decision

1. **Who is asked.** Only a build that starts Sparkle (its Info.plist carries the feed, ADR 0072), so Debug never asks. It is asked when its bundle is not directly inside `/Applications` or `~/Applications`. A translocated bundle never is.
2. **How it asks.** One `NSAlert` shortly after launch, before any other window is needed: "Move todz to Applications so it can update itself", with **Move to Applications** (default) and **Not now**. An alert works in the menu-bar-only accessory mode, where no window may be open.
3. **Not now.** The declined version is stored in the app's standard defaults; the alert never shows again for that version, and the next version asks again.
4. **The move.**
   - The destination is always `/Applications/Todz.app`.
   - A running todz at the destination stops the move with a line asking to quit it first. A stopped one goes to the Trash.
   - The copy is made with `FileManager`. Then the `com.apple.quarantine` attribute is removed from the copy, recursively. The user already approved this exact signed bundle through Gatekeeper's Open Anyway to get this far, and a programmatic copy keeps the flag that makes macOS translocate it again.
   - The original goes to the Trash. For a translocated bundle, that is the path `SecTranslocateCreateOriginalPathForURL` reports, not the mirror. A failed trash is not an error.
   - The new copy opens as a new instance, and this one terminates.
5. **In-house, no dependency.** The mover is about forty lines over `FileManager`, `NSWorkspace` and one Security call. The decision logic is a pure TodzKit type with unit tests. The app-side mover is checked by hand in the tester's walk.
6. **The DMG background with an arrow waits for v1.1.** The release command builds the DMG with `hdiutil` only. A background needs a Finder-written layout that cannot be checked headless, and the alert already fixes the failure that matters.

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| LetsMove (PFMoveApplication) | Proven mover | An archived Objective-C dependency; its UI copy and look are not ours | Forty lines of our own carry the same steps, in our copy |
| A sheet on the main window | Fits the window's look | No window in menu-bar-only mode, and the main window may never open at launch | An alert works in every launch |
| Keep the quarantine on the copy | Gatekeeper reassesses | macOS translocates the copy again, so Sparkle still refuses | The bundle is the one the user just approved, unchanged and signed |
| Ask on every launch | Harder to miss | Nags | The owner asked to remember Not now per version |
| Ask only when translocated | Fewer prompts | A copy run from Downloads (not quarantined) also never updates cleanly | Any folder outside Applications is asked |

## Consequences

- A visitor who opens todz anywhere but Applications is asked once per version to move it. After the move, Sparkle updates it.
- The app removes the quarantine attribute from its own copy in `/Applications`, only after Gatekeeper let this copy run. The security review checks that this never runs for a bundle Gatekeeper did not approve, because the alert is only reachable from inside the running app.
- One new defaults key; the decisions are unit-tested in TodzKit; the mover is walked by hand.
