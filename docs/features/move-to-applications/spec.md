# Move to Applications

**Status:** Shipped 2026-11-26
**Tier:** 🟡
**Owner approval:** the owner asked for it on 2026-11-26 through todz-6f after the release local check, and listed its v1.1 requirements on 2026-11-26 after the first attempt replaced his installed app; the loop decided the rest under the owner's 2026-11-24 instruction to decide every call
**ADRs:** [0105](../../adr/0105-the-move-to-applications-offer-acts-only-on-a-click-compares-file-identity-and-runs-behind-a-protocol-tested-on-scratch-copies.md)
**Not changing:** the server, Sparkle's feed and keys, the release command, the DMG's layout, Debug builds

## Problem

The 0.2.0 release check opened the downloaded app from an App Translocation path and Sparkle then refused to update it. A visitor who opens todz from the disk image or from Downloads never gets an update. The first attempt at a mover (PR #72) replaced the owner's running, installed app during a tester's walk, because its "already running" check compared unresolved URLs, it checked no result and it did not verify the copy. See [the learning](../../learnings/2026-11-26-a-tester-s-release-build-of-the-mover-replaced-the-owner-s-installed-app.md).

## Change

- A Release build (one whose Info.plist carries the update feed, and compiled without `DEBUG`) that runs outside `/Applications` and `~/Applications`, translocated or not, shows one calm alert per version: "Move todz to Applications so it can update itself". **Not now** is the default button (Return); **Move todz to Applications** has no key equivalent. The alert does not take the foreground at launch. Nothing moves without the click on the move button.
- **Not now** is remembered for this version; the next version asks again.
- The move never displaces anything. If anything exists at `/Applications/Todz.app`, of any version, running or not, in any user session, it refuses with "todz is already in Applications" and changes nothing.
- It also refuses while any other todz runs (by bundle identifier, other than this process), when a path cannot be resolved, and when the bundle is translocated and its original location is unknown.
- "In place" is decided by file identity (device and inode), not by path text, so firmlinked and symbolic-link paths to the same folder match.
- The copy is built under a staging name in the destination folder, must satisfy the running bundle's designated requirement, has its quarantine stripped (an unreadable folder is a failure), and is then renamed into place. Any failure removes the staging bundle. A kill leaves at most a staging bundle, which the next move removes first.
- The original is trashed afterwards, best effort: one that cannot be trashed stays and the move still succeeds.
- Every file-system and process effect sits behind `ApplicationsMoveSystem`, with the destination folder passed in, so the sequence is unit tested against a temporary folder and a fake list of running apps, never against `/Applications`.
- A failure says so in one line and leaves this copy running.

## Test list

- `ApplicationsMoveTests`: the offer decisions, including a Debug build never offered, with or without a feed, translocated or not, and the declined version.
- `ApplicationsMoveChoiceTests`: Not now is the first button and the default; moving is never the default.
- `ApplicationsMoveRunTests`: success, anything at the destination (a bundle, a broken symbolic link), already in place (directly, through a symbolic link, through the data volume, through a translocated original), an unknown original, another todz running, this process not blocking, a stale staging bundle removed or not removable, copy failure with and without a failing cleanup, signature mismatch, quarantine failure, rename failure, an original that cannot be trashed, an unresolvable destination or bundle.
- `QuarantineRemovalTests`: the root and nested items lose the attribute, never-quarantined items are no failure, an unreadable folder and a missing bundle are failures.
- `applications-mover.test.ts`, `macos-sandbox.test.ts`: the mover's tests never name `/Applications` or the destination constant, the offer carries the compile-time Debug gate, does not activate the app and sets no key equivalent, and the only sandbox file exceptions are the installed bundle and its staging bundle.
