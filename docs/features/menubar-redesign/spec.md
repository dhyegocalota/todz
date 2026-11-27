# Menu bar redesign

**Status:** Building
**Tier:** 🟡 (the popover, the lock's visible surface and the motion system; no server, no schema, no deploy)
**Owner approval:** approved by the owner's standing order to decide every call (2026-11-27); the choices are in [design.md § 10](design.md#10-owner-decisions)
**ADRs:** [0110](../../adr/0110-the-workspace-lock-hides-every-workspace-but-the-current-one-until-touch-id-or-the-mac-password-unlocks-a-session.md), [0113](../../adr/0113-a-locked-session-looks-like-a-one-workspace-account-with-no-placeholder-count-or-lock-chrome-and-one-neutral-way-back-in.md)
**Not changing:** the server, the owner API, the lock model (what is hidden, when it relocks, Touch ID or the Mac password)

## Problem

The menu bar popover, the workspace lock's visible surface and the app's motion each need a redesign, and the lock must reveal nothing: while it is on, an onlooker cannot tell that other workspaces exist.

## Design

[design.md](design.md) holds the popover (§§ 1 to 9), the lock that reveals nothing (§ 11, track L) and the motion system (§ 12, track M); § 13 splits the work into three tracks with disjoint files.
