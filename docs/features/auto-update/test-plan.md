# Auto update: test plan

## Unit (Swift, TodzKit)

- [x] `UpdateNote.pendingVersion(recorded: nil, current: "0.2.0")` → nil. Expected: a first launch shows nothing. — evidence: full `swift test --package-path apps/macos/TodzKit` at 26ae960a: "Test run with 1318 tests in 103 suites passed"; `--filter UpdateNoteTests`: "4 tests in 1 suite passed". Red-first: fb824be3 in a throwaway worktree fails 2 of 4 tests with the briefing's text; worktree removed.
- [x] `UpdateNote.pendingVersion(recorded: "0.2.0", current: "0.2.0")` → nil. Expected: a launch of the same version shows nothing. — evidence: same run (UpdateNoteTests 4/4 green).
- [x] `UpdateNote.pendingVersion(recorded: "0.2.0", current: "0.2.1")` → `"0.2.1"`. Expected: an update shows the new version. — evidence: same run; red at fb824be3 (`aNewerVersionThanTheRecordedOneIsTheNote` fails), green at head.
- [x] `UpdateNote.pendingVersion(recorded: "0.2.1", current: "0.2.0")` → `"0.2.0"`. Expected: a downgrade is still a version change, shown as the version now running. — evidence: same run; red at fb824be3 (`aChangeOfVersionBackIsStillTheNote` fails), green at head.

## Shape (repository-shape)

- [x] `project.yml` `info.properties` holds `SUAutomaticallyUpdate: YES`. Expected: the test passes. — evidence: `macos-release.test.ts` "the app updates itself by default, and the Settings switch changes that default" passes; whole repository-shape suite 29 files, 367 tests passed at 26ae960a. Red-first: 8fd1ba89 in a throwaway worktree fails with `expected ... to contain 'SUAutomaticallyUpdate: YES'` (1 failed, 11 passed); worktree removed.
- [x] `apps/macos/Todz/Info.plist` holds `<key>SUAutomaticallyUpdate</key>` followed by `<true/>`. Expected: the test passes. — evidence: same test passes. A Release compile (scratch derived data, `CODE_SIGNING_ALLOWED=NO`, never launched) yields a built Info.plist with `SUAutomaticallyUpdate => true` and `SUFeedURL => https://todz.app/download/appcast.xml`.

## Docs (repository-shape)

- [x] The runbook's step 5 names the quarantine command and the Open Anyway path, and no "other-notebook" gate. Expected: the test passes. — evidence: "step 5" is stale; the check now lives in runbook step 8 (`xattr -w com.apple.quarantine`, Open Anyway) and step 9. Pinned by `macos-release.test.ts` "the first public release is gated by a local check on this Mac" (passes). The only "other-notebook" mention says the step 8 check replaces that gate and the other-notebook check becomes a later one. See D1.
- [x] The install page's updates section says updates install in the background and names the Settings switch. Expected: the test passes. — evidence: `apps/docs/install-on-mac.mdx` line 71 reads "downloads a new version in the background and installs it when you quit or reopen todz. Turn this off with **Update todz automatically** in todz › Settings", verified by reading; no test pins this sentence. See D2.

## User-visible walk (tester, Playwright MCP is not used for the app; the tester walks the Debug app against a local `wrangler dev`)

- [ ] Settings shows "Update todz automatically", on, for a Mac that never touched it. Expected: the switch is on after a fresh defaults domain. DEFERRED to the release walk: needs a Release launch, which shares the `dev.todz` bundle identifier, defaults domain and App Group with the owner's installed app. Compile proof: the Release build succeeded with 0 warnings and its Info.plist carries `SUAutomaticallyUpdate => true`.
- [ ] Turning it off persists across a relaunch. Expected: off after relaunch; Sparkle's `SUAutomaticallyUpdate` reads NO. DEFERRED to the release walk: same reason.
- [ ] The popover foot shows "Check for Updates…" in Release and no such entry in Debug. Expected: visible in Release, absent in Debug. DEFERRED to the release walk: needs a Release launch. Partial proof by reading and compile: Debug sets `TODZ_UPDATE_FEED_URL` to empty, so `UpdateFeed(info:)` is nil and `AppUpdater.init?` returns nil, hence no entry, switch or note in Debug (the Debug app was not launched, to keep the owner's screen quiet); the Release build compiled `AppUpdaterKey`, `MenuBarFoot` and `SettingsView`.
- [ ] After an install of x+1 over x, the popover shows "Updated to x+1" once; a tap clears it. Expected: the note shows in the popover foot after the update; a tap clears it; a relaunch does not bring it back. DEFERRED to the release walk: needs two releases (runbook step 9).
- [ ] A first launch shows no note. Expected: no "Updated to" text on a fresh install. DEFERRED to the release walk: needs a Release launch; the unit rows prove `pendingVersion(recorded: nil, ...)` is nil.

## Release check (the lead, on this Mac, after the first release is live)

- [ ] Download `Todz-<x>.dmg` from `todz.app`, quarantine it, open it, Open Anyway. Expected: the app opens after Open Anyway. DEFERRED to the release walk: runbook step 8, after the first public release is live.
- [ ] Sparkle updates a copy of x to x+1 with the switch on. Expected: an install on quit or relaunch, and "Updated to x+1". DEFERRED to the release walk: runbook step 9, from the second release on.

## Edge cases found during execution

- Branch head is 26ae960a (origin/main merged onto a80bf532); every result above is at 26ae960a. Outcome: all green.
- Release-configuration compile (xcodegen, then `xcodebuild -configuration Release build` with scratch `-derivedDataPath` and `CODE_SIGNING_ALLOWED=NO`): `** BUILD SUCCEEDED **`, 0 warnings, nothing launched.
- D1 (test plan, minor): the Docs box names runbook "step 5" and "no other-notebook gate"; the check is at steps 8 and 9, and no test asserts that absence. Request: fix the box text, and pin the absence if it matters.
- D2 (test gap, minor): nothing pins the install page sentence naming the Settings switch and background installs. Request: a regression test in `docs-pages.test.ts`.
- Not run: the optional Debug launch, skipped so no window opens on the owner's screen during the production walk.
