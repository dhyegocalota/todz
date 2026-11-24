# Test plan: The widgets share the App Group

Every checkbox states the input and the exact expected outcome. A ticked box carries evidence after ` — evidence: ` (commit hash, log path, counts, screenshot path).

## The failing test first

- [ ] `SharedFolderTests` (`apps/macos/TodzKit/Tests/TodzKitTests/SharedFolderTests.swift`) — input: the red commit; expected: the new tests fail on the stub `of(info:container:) is not implemented`
- [ ] Confirmed it fails for the right reason: the failure text recorded from the red run

## Unit

- [ ] `theFolderIsTheGroupsContainer` — input: `["TodzAppGroup": "ABCDE12345.dev.todz"]`, a container answering `/tmp/group/` for that identifier; expected: `/tmp/group/`, and the container was asked for `ABCDE12345.dev.todz`
- [ ] Edge: missing key — input: `[:]`; expected: `nil`, the container never asked
- [ ] Edge: a key that is not text — input: `["TodzAppGroup": 1]`; expected: `nil`, the container never asked
- [ ] Edge: an empty key — input: `["TodzAppGroup": ""]`; expected: `nil`, the container never asked
- [ ] Edge: no container — input: a container answering `nil`; expected: `nil`
- [ ] `created` and `owned` tests unchanged and green
- [ ] Edge: an existing directory the user owns (the group container exists before the app starts) — input: `created(existing)` and `owned(existing)`; expected: the same URL
- [ ] Edge: a container path that is a symlink — input: `created(link)` and `owned(link)`; expected: `nil`
- [ ] `swift test --package-path apps/macos/TodzKit`: every suite green, count recorded

## Build and signature

- [ ] `xcodegen generate` and `xcodebuild build` of the `Todz` scheme with `-derivedDataPath` in the scratchpad; expected: `BUILD SUCCEEDED`, no warning added
- [ ] `codesign -d --entitlements - --xml` on `Todz.app`; expected: `com.apple.security.application-groups` = `XFWR794VS8.dev.todz`, no `temporary-exception` key
- [ ] The same on `Todz.app/Contents/PlugIns/TodzWidgets.appex`; expected: the same group, no exception
- [ ] `codesign -dv` on both; expected: `TeamIdentifier=XFWR794VS8`, `Authority=Apple Development: …`
- [ ] `plutil -p` on both built Info.plists; expected: `TodzAppGroup => "XFWR794VS8.dev.todz"`, no `TodzSharedFolder`; a bare `dev.todz` means the prefix did not expand and fails the box
- [ ] The group string is byte-equal across the app's entitlement, the extension's entitlement and both `TodzAppGroup` values; expected: four times `XFWR794VS8.dev.todz`
- [ ] `codesign --verify --strict --deep` on `Todz.app`; expected: exit 0
- [ ] The extension registers: `pluginkit -a` on the built appex, then `pluginkit -m -i dev.todz.Todz.widgets`; expected: listed, and `log show --last 2m` filtered to `amfid` and `taskgated-helper` shows no rejection of the app or the extension
- [ ] The checked-in `apps/macos/Todz/Info.plist` and `apps/macos/TodzWidgets/Info.plist` carry `TodzAppGroup` after `xcodegen generate`; expected: `git diff` shows it in both

## Prove it for real — the app (ADR 0026)

- [ ] Hidden launch (`open -g -j`) against `wrangler dev` with a seeded fictional workspace whose Today holds two tasks; expected: no consent alert (Orca `get-app-state --app com.apple.UserNotificationCenter` finds none), and `~/Library/Group Containers/XFWR794VS8.dev.todz/widget-snapshot.json` appears at mode 600 holding the two titles
- [ ] Rebuild the app, launch hidden again; expected: no consent alert, the snapshot's modification time moves
- [ ] Complete a task in the app; expected: the snapshot drops it from the open rows within the app's write
- [ ] A request file written by the extension's path is taken in: place a widget (owner's OK first) and tick its checkbox; expected: the task completes in the app. BLOCKED without the owner's OK
- [ ] Sign out; expected: the group's `widget-snapshot.json` and `requests/` are both gone
- [ ] Old folder untouched: `~/Library/Application Support/dev.todz.widgets/` still holds the previous files and the app logs no error about it; the owner deletes it by hand (PR Human checklist)
- [ ] The extension reads the app's snapshot in the group without a placed widget: the extension's own process, started by `pluginkit` or by WidgetKit's timeline reload after the app writes, opens the group with no consent alert (`log show` for the extension's process shows no sandbox denial on the group path); expected: no denial. If no process of the extension runs without a placed widget, BLOCKED and stated under Coverage honesty

## Edge cases found during execution

## Adversarial review

- [ ] Claim 1: no consent prompt with the team-signed group — attack: <how>; result: <refuted | held>
- [ ] Claim 2: the extension resolves the same container — attack: <how>; result: <refuted | held>
- [ ] Claim 3: no build path still carries the exception — attack: <how>; result: <refuted | held>

## Coverage honesty

- A placed widget reading the group needs the owner's desktop; it stays on the PR's Human checklist. Until then, Claim 2 (the extension resolves the same container) rests on the byte-equal entitlements and the extension's log, not on a drawn widget.
- The old folder in Application Support keeps the last snapshot after sign-out, because the sandboxed app can no longer reach it; the Human checklist asks the owner to delete it.
- A machine without the owner's Apple Development identity cannot build; accepted while the owner is the only builder.
