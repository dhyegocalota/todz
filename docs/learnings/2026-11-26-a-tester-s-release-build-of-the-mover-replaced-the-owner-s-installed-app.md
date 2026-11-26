# A tester's Release build of the Applications mover replaced the owner's installed app

- Date: 2026-11-26
- Inspired by: PR #72 (`move-to-applications`), the tester walk at 11:34 UTC
- Revisited: 2026-11-26 — still true (written the same day)

## Signal

`/Applications/Todz.app` changed from the released 0.2.1 (build 2069) to version 0.2.0, build 1, signed a minute earlier and still quarantined. The owner's todz kept running from the bundle it had loaded. The walk had launched a local Release build of the branch from a scratch folder three times, and two of those copies quit on their own within seconds. Nobody saw an alert or clicked one.

## Cause

A Release build carries the update feed, so the mover ran. Its "a todz runs at /Applications" check compared `URL` values (`standardizedFileURL`). That comparison missed the owner's running copy, so the mover trashed the installed bundle, copied itself in, failed to strip the quarantine under the sandbox without saying so, and terminated. Why the move went ahead without a visible click was not settled. The computer-use tool resolved the shared bundle identifier to the owner's process, so the walk could not even target the copy.

## Do

- Never launch a build whose code can write, move or trash anything under `/Applications` on a Mac that has a real todz installed. Walk such code on a disposable account or a VM.
- Testers run only Debug builds from their own derived data, with installer and mover code disabled.
- An installer-like action compares paths, checks every system call's result, and verifies the copied bundle's designated requirement before it trusts it. A review finding about any of these in such code is IMPORTANT, not MINOR.
- `move-to-applications` left 0.2.2 and waits in v1.1. The owner's 0.2.1 was reinstalled from the verified public DMG.

## Anchor

`apps/macos/Todz/Updates/ApplicationsMover.swift` on `feat/move-to-applications`, `docs/adr/0078-a-released-app-outside-applications-offers-once-per-version-to-move-itself-there.md`, `docs/features/move-to-applications/test-plan.md`.
