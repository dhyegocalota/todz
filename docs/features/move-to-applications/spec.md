# Move to Applications

**Status:** Approved, moved to v1.1 on 2026-11-26 (the owner's deadline)
**Tier:** 🟡
**Owner approval:** the owner asked for it on 2026-11-26 through todz-6f, after the release local check: "when todz runs outside /Applications (translocated or any folder), show one friendly sheet … Move / Not now"; inside `docs/product/README.md` (approved 2026-11-23) by inheritance
**ADRs:** [0078](../../adr/0078-a-released-app-outside-applications-offers-once-per-version-to-move-itself-there.md)
**Not changing:** the server, Sparkle's feed and keys, the release command, the DMG's layout, Debug builds

## Problem

The 0.2.0 release check (2026-11-26, release runbook step 8) opened the downloaded app after Open Anyway. macOS ran it from an App Translocation path, because Finder never moved it, and Sparkle then refused to update: "Todz can't be updated if it's running from the location it was downloaded to." A visitor who opens todz straight from the disk image or from Downloads never gets an update.

## Change

- A released build (one whose Info.plist carries the update feed, as ADR 0072 starts Sparkle) that runs outside `/Applications` and `~/Applications`, translocated or not, asks once at launch: "Move todz to Applications so it can update itself", with **Move to Applications** and **Not now**.
- **Move to Applications** copies the app to `/Applications/Todz.app`, makes the copy launchable without translocation, moves the original (the downloaded copy, not its translocated mirror) to the Trash, opens the new copy and quits this one.
- A todz already in `/Applications` that is running stops the move with a short line asking to quit it first; one that is not running goes to the Trash before the copy.
- **Not now** is remembered for this version: the next version asks again.
- A failed copy says so in one line and leaves this copy running.
- Debug builds and copies inside an Applications folder never ask.

## Test list

- TodzKit `ApplicationsMove` decisions: a released build in `/Applications` or `~/Applications` is not offered; one in Downloads, on a disk image or translocated is offered; a version declined is not offered again; the next version is; a build without a feed is never offered.
- The destination is `/Applications/Todz.app`; the original of a translocated bundle is what goes to the Trash.
