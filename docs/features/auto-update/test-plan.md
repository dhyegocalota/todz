# Auto update: test plan

## Unit (Swift, TodzKit)

- [ ] `UpdateNote.pendingVersion(recorded: nil, current: "0.2.0")` → nil. Expected: a first launch shows nothing.
- [ ] `UpdateNote.pendingVersion(recorded: "0.2.0", current: "0.2.0")` → nil. Expected: a launch of the same version shows nothing.
- [ ] `UpdateNote.pendingVersion(recorded: "0.2.0", current: "0.2.1")` → `"0.2.1"`. Expected: an update shows the new version.
- [ ] `UpdateNote.pendingVersion(recorded: "0.2.1", current: "0.2.0")` → `"0.2.0"`. Expected: a downgrade is still a version change, shown as the version now running.

## Shape (repository-shape)

- [ ] `project.yml` `info.properties` holds `SUAutomaticallyUpdate: YES`. Expected: the test passes.
- [ ] `apps/macos/Todz/Info.plist` holds `<key>SUAutomaticallyUpdate</key>` followed by `<true/>`. Expected: the test passes.

## Docs (repository-shape)

- [ ] The runbook's step 5 names the quarantine command and the Open Anyway path, and no "other-notebook" gate. Expected: the test passes.
- [ ] The install page's updates section says updates install in the background and names the Settings switch. Expected: the test passes.

## User-visible walk (tester, Playwright MCP is not used for the app; the tester walks the Debug app against a local `wrangler dev`)

- [ ] Settings shows "Update todz automatically", on, for a Mac that never touched it. Expected: the switch is on after a fresh defaults domain.
- [ ] Turning it off persists across a relaunch. Expected: off after relaunch; Sparkle's `SUAutomaticallyUpdate` reads NO.
- [ ] The popover foot shows "Check for Updates…" in Release and no such entry in Debug. Expected: visible in Release, absent in Debug.
- [ ] After an install of x+1 over x, the popover shows "Updated to x+1" once; a tap clears it. Expected: the note shows in the popover foot after the update; a tap clears it; a relaunch does not bring it back.
- [ ] A first launch shows no note. Expected: no "Updated to" text on a fresh install.

## Release check (the lead, on this Mac, after the first release is live)

- [ ] Download `Todz-<x>.dmg` from `todz.app`, quarantine it, open it, Open Anyway. Expected: the app opens after Open Anyway.
- [ ] Sparkle updates a copy of x to x+1 with the switch on. Expected: an install on quit or relaunch, and "Updated to x+1".
