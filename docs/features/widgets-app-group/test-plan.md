# Test plan: The widgets share the App Group

Every checkbox states the input and the exact expected outcome. A ticked box carries evidence after ` — evidence: ` (commit hash, log path, counts, screenshot path).

## The failing test first

- [x] `SharedFolderTests` (`apps/macos/TodzKit/Tests/TodzKitTests/SharedFolderTests.swift`) — input: the red commit; expected: the new tests fail on the stub `of(info:container:) is not implemented` — evidence: throwaway worktree at 03bac5f, `swift test --filter SharedFolderTests`, scratchpad/tester3/red.log lines 43-47 print the fatal error
- [x] Confirmed it fails for the right reason: the failure text recorded from the red run — evidence: `TodzKit/SharedFolder.swift:8: Fatal error: of(info:container:) is not implemented` (the run crashes after printing it, as the briefing says); worktree removed

## Unit

- [x] `theFolderIsTheContainerOfTheKeysGroup` — input: `["TodzAppGroup": "TEAM123456.dev.todz"]`, a container answering `/Users/maria/Library/Group Containers/TEAM123456.dev.todz/` for that identifier; expected: that URL, and the container was asked for `TEAM123456.dev.todz` — evidence: green in `swift test` at dacb799, 476 tests in 33 suites passed (this pass)
- [x] Edge: missing key — input: `[:]`; expected: `nil`, the container never asked — evidence: `aBundleWithoutTheKeyHasNoFolderAndAsksNoContainer` green in the 476
- [x] Edge: a key that is not text — input: `["TodzAppGroup": 1]`; expected: `nil`, the container never asked — evidence: `aKeyThatIsNotTextHasNoFolderAndAsksNoContainer` green in the 476
- [x] Edge: an empty key — input: `["TodzAppGroup": ""]`; expected: `nil`, the container never asked — evidence: `anEmptyKeyHasNoFolderAndAsksNoContainer` green in the 476
- [x] Edge: no container — input: a container answering `nil`; expected: `nil` — evidence: `aGroupWithoutAContainerHasNoFolder` green in the 476
- [x] `created` and `owned` tests unchanged and green — evidence: green in the 476; SharedFolderTests suite passed
- [x] Edge: an existing directory the user owns (the group container exists before the app starts) — input: `created(existing)` and `owned(existing)`; expected: the same URL — evidence: green in the 476; also real: the system pre-created the group container before the app's `created` ran and the app wrote the snapshot into it
- [x] Edge: a container path that is a symlink — input: `created(link)` and `owned(link)`; expected: `nil` — evidence: `aSymlinkedFolderIsNotOwned` (pin) green in the 476; not exercised on the real container (replacing it could itself raise the consent alert)
- [x] `swift test --package-path apps/macos/TodzKit`: every suite green, count recorded — evidence: 476 tests in 33 suites passed

## Build and signature

- [x] `xcodegen generate` and `xcodebuild build` of the `Todz` scheme with `-derivedDataPath` in the scratchpad; expected: `BUILD SUCCEEDED`, no warning added — evidence: scratchpad/tester3/build.log, BUILD SUCCEEDED, 0 `warning:` lines; also `clean build` (build2.log) succeeded
- [x] `codesign -d --entitlements - --xml` on `Todz.app`; expected: `com.apple.security.application-groups` = `XFWR794VS8.dev.todz`, no `temporary-exception` key — evidence: group `XFWR794VS8.dev.todz`, plus app-sandbox, get-task-allow, network.client; `grep -c temporary-exception` = 0
- [x] The same on `Todz.app/Contents/PlugIns/TodzWidgets.appex`; expected: the same group, no exception — evidence: group `XFWR794VS8.dev.todz`, app-sandbox, get-task-allow; `grep -c temporary-exception` = 0
- [x] `codesign -dv` on both; expected: `TeamIdentifier=XFWR794VS8`, `Authority=Apple Development: …` — evidence: both `TeamIdentifier=XFWR794VS8`, `Authority=Apple Development: <owner account> (7N2H5833HE)` (`-dvv`)
- [x] `plutil -p` on both built Info.plists; expected: `TodzAppGroup => "XFWR794VS8.dev.todz"`, no `TodzSharedFolder`; a bare `dev.todz` means the prefix did not expand and fails the box — evidence: both `TodzAppGroup => "XFWR794VS8.dev.todz"`, no `TodzSharedFolder` line
- [x] The group string is byte-equal across the app's entitlement, the extension's entitlement and both `TodzAppGroup` values; expected: four times `XFWR794VS8.dev.todz` — evidence: the four outputs above are identical
- [x] `codesign --verify --strict --deep` on `Todz.app`; expected: exit 0 — evidence: exit 0
- [x] The extension registers: `pluginkit -a` on the built appex, then `pluginkit -m -i dev.todz.Todz.widgets`; expected: listed, and `log show --last 2m` filtered to `amfid` and `taskgated-helper` shows no rejection of the app or the extension — evidence: `pluginkit -m -A -D -vv` lists the dd-group appex path after `-a`; `log show` for amfid and taskgated-helper mentioning todz or XFWR: no lines (registration removed with `pluginkit -r` afterwards)
- [x] The checked-in `apps/macos/Todz/Info.plist` and `apps/macos/TodzWidgets/Info.plist` carry `TodzAppGroup` after `xcodegen generate`; expected: `git diff` shows it in both — evidence: `TodzAppGroup` at Todz/Info.plist:39 and TodzWidgets/Info.plist:26; `git status` clean after generate (the change is already committed, diff vs HEAD~6 shows both files)

## Prove it for real — the app (ADR 0026)

- [x] Hidden launch (`open -g -j`) against `wrangler dev` with a seeded fictional workspace whose Today holds two tasks; expected: no consent alert (Orca `get-app-state --app com.apple.UserNotificationCenter` finds none), and `~/Library/Group Containers/XFWR794VS8.dev.todz/widget-snapshot.json` appears at mode 600 holding the two titles — evidence: workspace Acme, 2 Today tasks seeded; Orca returned `window_not_found` for UserNotificationCenter before the launch, right after it and after the write (0 windows); the group container did not exist before (`ls` of Group Containers matched only TODZLOCAL0.dev.todz.wspike), the app created it at 15:58:17; `stat`: `-rw------- 502 bytes 15:58:42` holding "Draft the release notes" and "Review the Acme roadmap", workspace_name Acme, folder `drwx------`. The app's model started on its own with no visible window (the hidden window exists, Orca saw it)
- [x] Rebuild the app, launch hidden again; expected: no consent alert, the snapshot's modification time moves — evidence: `xcodebuild clean build` (build2.log), same signature; relaunch hidden; Orca `window_not_found` for UserNotificationCenter; mtime 15:59:06 -> 15:59:24
- [x] Complete a task in the app; expected: the snapshot drops it from the open rows within the app's write — evidence: Orca `perform-secondary-action "Mark as Done"` on "Draft the release notes" in the hidden window; snapshot mtime 15:58:42 -> 15:59:06 immediately; `open` holds only "Review the Acme roadmap", `done_today` holds "Draft the release notes"
- [ ] A request file written by the extension's path is taken in: place a widget (owner's OK first) and tick its checkbox; expected: the task completes in the app. BLOCKED: placing a widget needs the owner's desktop and OK; no widget was placed
- [x] Sign out; expected: the group's `widget-snapshot.json` and `requests/` are both gone — evidence: app menu Sign Out through System Events (a menu cannot be clicked in the background by Orca: `background_unavailable`), app showed the sign-in screen; `ls -l` of the group: only `Library` remains (`widget-snapshot.json` gone, `requests/` absent; it was never created because no widget request ran, so its removal is vacuous); the session file was erased too
- [x] Old folder untouched: `~/Library/Application Support/dev.todz.widgets/` still holds the previous files and the app logs no error about it; the owner deletes it by hand (PR Human checklist) — evidence: `widget-snapshot.json` (127 bytes) mtime 15:51:55, before my first launch at 15:58; unified log for process Todz shows only the AppSandbox line, no error
- [ ] The extension reads the app's snapshot in the group without a placed widget: the extension's own process, started by `pluginkit` or by WidgetKit's timeline reload after the app writes, opens the group with no consent alert (`log show` for the extension's process shows no sandbox denial on the group path); expected: no denial. If no process of the extension runs without a placed widget, BLOCKED and stated under Coverage honesty — BLOCKED: no process of this build's extension ran (the only TodzWidgets process is the owner's build in `~/Projects/todz/todz/apps/macos/build`, a different path); `log show` of the group path shows two sandbox denials from the app, see Edge cases

## Edge cases found during execution

- Sandbox denial noise: each launch logs `Sandbox: Todz deny(1) file-write-mode /Users/dhyegocalota/Library/Group Containers/XFWR794VS8.dev.todz` (15:58:41 and 15:59:24). `SharedFolder.created` calls `createDirectory(... attributes: 0o700)` on a container that already exists, and the sandbox refuses the chmod of the group root. Outcome: harmless today (the call succeeds, the folder is already `drwx------`, the snapshot is written at 600), no alert. Not a defect; the developer may want to know the denial is expected, or skip the attributes when the directory exists.
- First launch with no window: the model launched from the hidden launch with no window opened by the walk, and wrote the snapshot about 25 s after the container appeared. Outcome: fine.
- A hidden app menu cannot be clicked by Orca (`background_unavailable`); sign-out was driven by System Events. Outcome: tooling note, not a product finding.
- `pnpm verify all` at dacb799: macos gate built into the worktree's gitignored `apps/macos/build`, 7 gates green. Outcome: green.
- A group container with a symlink in its place was not tried on the real machine (replacing the container could itself raise the consent alert); the unit pin covers it.

## Adversarial review

- [x] Claim 1: no consent prompt with the team-signed group — attack: first launch with the container absent, then a clean rebuild and relaunch, shell `ls -ld`/`ls -l`/`stat` on the group after the app wrote, Orca watching UserNotificationCenter at each step; result: held (no alert at any step)
- [ ] Claim 2: the extension resolves the same container — attack: byte-compare four group strings, `pluginkit -a`, amfid/taskgated log; the extension never ran; result: held on signature evidence only, the run is BLOCKED (no placed widget)
- [x] Claim 3: no build path still carries the exception — attack: `codesign -d --entitlements` of both fresh and clean-rebuilt products, and the `verify all` macos build, `grep -c temporary-exception`; result: held (0 in both)

## Coverage honesty

- A placed widget reading the group needs the owner's desktop; it stays on the PR's Human checklist. Until then, Claim 2 (the extension resolves the same container) rests on the byte-equal entitlements and the extension's log, not on a drawn widget.
- The old folder in Application Support keeps the last snapshot after sign-out, because the sandboxed app can no longer reach it; the Human checklist asks the owner to delete it.
- A machine without the owner's Apple Development identity cannot build; accepted while the owner is the only builder.
