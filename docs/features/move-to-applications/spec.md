# Move to Applications

**Status:** Shipped 2026-11-26
**Tier:** 🟡
**Owner approval:** the owner asked for it on 2026-11-26 through todz-6f after the release local check, and listed its v1.1 requirements on 2026-11-26 after the first attempt replaced his installed app; the loop decided the rest under the owner's 2026-11-24 instruction to decide every call
**ADRs:** [0105](../../adr/0105-the-move-to-applications-offer-acts-only-on-a-click-compares-canonical-paths-and-runs-behind-a-protocol-tested-on-scratch-copies.md)
**Not changing:** the server, Sparkle's feed and keys, the release command, the DMG's layout, Debug builds

## Problem

The 0.2.0 release check opened the downloaded app from an App Translocation path and Sparkle then refused to update it. A visitor who opens todz from the disk image or from Downloads never gets an update. The first attempt at a mover (PR #72) replaced the owner's running, installed app during a tester's walk, because its "already running" check compared unresolved URLs, it checked no result and it did not verify the copy. See [the learning](../../learnings/2026-11-26-a-tester-s-release-build-of-the-mover-replaced-the-owner-s-installed-app.md).

## Change

- A Release build (one whose Info.plist carries the update feed, and compiled without `DEBUG`) that runs outside `/Applications` and `~/Applications`, translocated or not, shows one calm alert per version: "Move todz to Applications so it can update itself", with **Move todz to Applications** and **Not now**. Nothing moves without the click on the first button.
- **Not now** is remembered for this version; the next version asks again.
- The move refuses, and changes nothing, while any other todz runs (by bundle identifier, other than this process) or any process runs from the destination, compared by resolved canonical paths through symbolic links and firmlinks.
- The move also refuses when the bundle is already the one at the destination, and when a path cannot be resolved.
- A todz at the destination that is not running is trashed first; any later failure (copy, signature, quarantine) removes the copy and puts that one back from the Trash. The copy must satisfy the running bundle's designated requirement before its quarantine is stripped and before the original is trashed.
- Every file-system and process effect sits behind `ApplicationsMoveSystem`, with the destination folder passed in, so the sequence is unit tested against a temporary folder and a fake list of running apps, never against `/Applications`.
- An original that cannot be located or trashed stays where it is and the move still succeeds.
- A failure says so in one line and leaves this copy running.

## Test list

- `ApplicationsMoveTests`: the offer decisions, including a Debug build never offered, with or without a feed, translocated or not, and the declined version.
- `ApplicationsMoveRunTests`: success, replacing a stopped copy, another todz running, the destination running (directly and through a symbolic link), this process not blocking, copy failure, signature mismatch, quarantine failure, a previous copy that cannot be trashed or restored, an original that cannot be trashed or located, already in place (directly and through a translocated original), an unresolvable destination.
- `applications-mover.test.ts`: the mover's tests never name `/Applications`, and the offer carries the compile-time Debug gate.
