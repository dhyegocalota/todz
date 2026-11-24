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
- [ ] `swift test --package-path apps/macos/TodzKit`: every suite green, count recorded

## Build and signature

- [ ] `xcodegen generate` and `xcodebuild build` of the `Todz` scheme with `-derivedDataPath` in the scratchpad; expected: `BUILD SUCCEEDED`, no warning added
- [ ] `codesign -d --entitlements - --xml` on `Todz.app`; expected: `com.apple.security.application-groups` = `XFWR794VS8.dev.todz`, no `temporary-exception` key
- [ ] The same on `Todz.app/Contents/PlugIns/TodzWidgets.appex`; expected: the same group, no exception
- [ ] `codesign -dv` on both; expected: `TeamIdentifier=XFWR794VS8`, `Authority=Apple Development: …`
- [ ] `plutil -p` on both Info.plists; expected: `TodzAppGroup => "XFWR794VS8.dev.todz"`, no `TodzSharedFolder`

## Prove it for real — the app (ADR 0026)

- [ ] Hidden launch (`open -g -j`) against `wrangler dev` with a seeded fictional workspace whose Today holds two tasks; expected: no consent alert (Orca `get-app-state --app com.apple.UserNotificationCenter` finds none), and `~/Library/Group Containers/XFWR794VS8.dev.todz/widget-snapshot.json` appears at mode 600 holding the two titles
- [ ] Rebuild the app, launch hidden again; expected: no consent alert, the snapshot's modification time moves
- [ ] Complete a task in the app; expected: the snapshot drops it from the open rows within the app's write
- [ ] A request file written by the extension's path is taken in: place a widget (owner's OK first) and tick its checkbox; expected: the task completes in the app. BLOCKED without the owner's OK
- [ ] Sign out; expected: the group's `widget-snapshot.json` and `requests/` are gone
- [ ] Old folder untouched: `~/Library/Application Support/dev.todz.widgets/` still holds the previous files; the app logs no error about it

## Edge cases found during execution

## Adversarial review

- [ ] Claim 1: no consent prompt with the team-signed group — attack: <how>; result: <refuted | held>
- [ ] Claim 2: the extension resolves the same container — attack: <how>; result: <refuted | held>
- [ ] Claim 3: no build path still carries the exception — attack: <how>; result: <refuted | held>

## Coverage honesty

- A placed widget reading the group needs the owner's desktop; it stays on the PR's Human checklist.
- A machine without the owner's Apple Development identity cannot build; accepted while the owner is the only builder.
