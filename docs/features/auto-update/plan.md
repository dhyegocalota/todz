# Auto update: plan

Lighter gates (PROMPT.md "Tonight's last three"): no plan-review round, one combined review. Steps are ticked by the developer as they land, each red commit before its green.

- [ ] **Step 1 (docs):** `docs/features/auto-update/` (spec, plan, test plan), ADR 0075, the index rows of `docs/adr/README.md` and `docs/features/README.md` (`Approved`).
- [ ] **Step 2 (red):** `apps/macos/TodzKit/Tests/TodzKitTests/UpdateNoteTests.swift` pins `UpdateNote.pendingVersion(recorded:current:)`; `UpdateNote` exists as a stub returning nil. Commit alone; record the real red text.
- [ ] **Step 3 (green):** `UpdateNote` in `apps/macos/TodzKit/Sources/TodzKit/UpdateNote.swift`.
- [ ] **Step 4 (red):** `tools/repository-shape/src/macos-release.test.ts` expects `SUAutomaticallyUpdate` `YES` in `apps/macos/project.yml` and `<key>SUAutomaticallyUpdate</key>` `<true/>` in `apps/macos/Todz/Info.plist`. Commit alone.
- [ ] **Step 5 (green):** the two keys in `project.yml` and `Info.plist`.
- [ ] **Step 6:** `AppUpdater` gains `automaticallyUpdates`, `setAutomaticallyUpdates(_:)`, `updatedToVersion` (read at init, recorded from the standard defaults) and `acknowledgeUpdate()`. `AppUpdaterKey` and the `\.appUpdater` environment value in `apps/macos/Todz/Updates/AppUpdaterKey.swift`.
- [ ] **Step 7:** `UpdateCopy` gains the switch's title and detail, "Updated to x.y" and the note's tap label, in `apps/macos/Copy/UpdateCopy.swift`.
- [ ] **Step 8:** `SettingsView` shows the switch when the environment holds an updater; `TodzApp` sets `\.appUpdater` on the menu bar content and the Settings scene.
- [ ] **Step 9:** `MenuBarFoot` shows "Check for Updates…" (Release only) and the pending note, which clears on tap.
- [ ] **Step 10 (docs):** the runbook's steps 5, 9 and 10 for the local check, the x to x+1 update check and the Evidence row; the deploy skill's step 4 without its conditional and its other-notebook line; `apps/docs/install-on-mac.mdx` section 4 (automatic updates, the switch); `apps/macos/README.md` only if its purpose changes (it does not).
- [ ] **Step 11:** `pnpm exec prettier --write` on each changed TS, JSON and Markdown file; `swift test --package-path apps/macos/TodzKit`; `xcodegen generate` and the `macos` gate's `xcodebuild build`; `pnpm verify`.
- [ ] **Step 12:** `docs/features/auto-update/tester-briefing.md`, status `Building` in the index, push with `gh-as-owner.sh`.

## Failure modes

| Step | What breaks | The concrete signal | How to back out |
|------|-------------|---------------------|-----------------|
| 3 | A recorded version equal to the current one shows a note | `UpdateNoteTests` "the same version records nothing" red | Revert the green commit; the stub stays |
| 5 | The Info.plist and project.yml disagree | the shape test names the missing key | Regenerate Info.plist with xcodegen; compare |
| 6 | `automaticallyDownloadsUpdates` writes a value Sparkle does not read | the owner's switch does not change installs | Set the key through `SPUUpdater` only, never a second defaults key |
| 6 | `AppUpdater` nil in Debug is dereferenced | Debug build crashes on the Settings open | Guard with `if let` in the views only |
| 8 | The environment key is missing on a scene | the Settings switch is hidden in Release | `.environment(\.appUpdater, …)` on the scene; check the Release build's Settings |
| 9 | The footer overflows the popover width | the walk shows clipped items | Shorten the switch's detail; the footer keeps the quit button |
| 10 | The runbook step numbers drift from the skill | `deploy` skill names a step that does not exist | Re-number the skill's reference to the runbook |
