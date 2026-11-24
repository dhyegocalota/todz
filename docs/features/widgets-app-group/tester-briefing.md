# Tester briefing: The widgets share the App Group

Written by the developer sub-agent when its steps are done. The developer does not run `test-plan.md` and does not declare the feature works.

## What changed

- `apps/macos/TodzKit/Sources/TodzKit/SharedFolder.swift`: `of(info:container:)` returns the container of the group named by `TodzAppGroup`; `of(bundle:)` asks `FileManager.containerURL(forSecurityApplicationGroupIdentifier:)`; `of(info:home:)` and `accountHome` are gone.
- `apps/macos/TodzKit/Tests/TodzKitTests/SharedFolderTests.swift`: tests for the new seam; the home-relative tests are gone.
- `apps/macos/project.yml` and the generated `Todz/Info.plist`, `TodzWidgets/Info.plist`, `Todz/Todz.entitlements`, `TodzWidgets/TodzWidgets.entitlements`: both targets get `DEVELOPMENT_TEAM: XFWR794VS8`, `CODE_SIGN_IDENTITY: Apple Development`, the `com.apple.security.application-groups` entitlement and `TodzAppGroup`; the temporary exception and `TodzSharedFolder` are gone.
- `apps/macos/README.md`, `apps/macos/Copy/WidgetSampleCopy.swift`: docs and a new sample title.
- Commits: red `03bac5f`, pin `8da29cf`, green `ed4b774`.

## How to run

```bash
swift test --package-path apps/macos/TodzKit
xcodegen generate --spec apps/macos/project.yml
xcodebuild build -project apps/macos/Todz.xcodeproj -scheme Todz -configuration Debug -derivedDataPath <scratch>/dd-group
codesign -d --entitlements - --xml <scratch>/dd-group/Build/Products/Debug/Todz.app
codesign -d --entitlements - --xml <scratch>/dd-group/Build/Products/Debug/Todz.app/Contents/PlugIns/TodzWidgets.appex
```

Built values on this Mac (both the app and the appex):

```
"TodzAppGroup" => "XFWR794VS8.dev.todz"        (plutil -p Contents/Info.plist)
"com.apple.security.application-groups" => [ 0 => "XFWR794VS8.dev.todz" ]
TeamIdentifier=XFWR794VS8                       (codesign -dv)
codesign --verify --strict --deep Todz.app      exit 0
```

No `temporary-exception` key appears in either entitlements output. The app was built, never launched.

## Red today, green after

| Test | Red before the change because | Green after because |
|------|--------------------------------|---------------------|
| `SharedFolderTests::theFolderIsTheContainerOfTheKeysGroup` | stub stopped: `TodzKit/SharedFolder.swift:8: Fatal error: of(info:container:) is not implemented` (the run crashed after printing it, so every test of the suite reported failed) | the key's group reaches `container` once and its answer is returned |
| `SharedFolderTests::aBundleWithoutTheKeyHasNoFolderAndAsksNoContainer`, `aKeyThatIsNotTextHasNoFolderAndAsksNoContainer`, `anEmptyKeyHasNoFolderAndAsksNoContainer` | same fatal error | `nil`, `container` never called |
| `SharedFolderTests::aGroupWithoutAContainerHasNoFolder` | same fatal error | `container` answering `nil` gives `nil` |
| `SharedFolderTests::aSymlinkedFolderIsNotOwned` | pin, green when it landed (`8da29cf`) | `owned(_:)` refuses a symlink |

`swift test --package-path apps/macos/TodzKit`: 476 tests in 33 suites passed (475 before the pin was added).

## Hypotheses to attack

1. Hypothesis: the app and the extension both resolve `XFWR794VS8.dev.todz` at run time. Break it by: reading `plutil -p` of both built Info.plists after a clean rebuild; a bare `dev.todz` means the prefix did not expand.
2. Hypothesis: no consent prompt appears on the first launch or after a rebuild. Break it by: launching hidden twice with a rebuild between, looking for an alert from `com.apple.UserNotificationCenter`.
3. Hypothesis: the app writes `widget-snapshot.json` into `~/Library/Group Containers/XFWR794VS8.dev.todz/` and the extension reads it. Break it by: launching with the container missing, then with a symlink in its place.
4. Hypothesis: neither target keeps the temporary exception. Break it by: `codesign -d --entitlements - --xml` and grep for `temporary-exception` on both.
5. Hypothesis: the old folder in Application Support is untouched. Break it by: listing it before and after the launch.

## Known gaps

- Never launched; the container, the prompt and the widget reading are for the tester.
- `AppConfiguration.swift`, `FileWidgetStore+Shared.swift` and the Darwin notification are unchanged by design.
- `scripts/` and `tools/repository-shape/src/` pin neither `CODE_SIGN_IDENTITY: "-"` nor `TodzSharedFolder` (grep found no match).
- `docs/features/widgets-app-group/plan.md` and `test-plan.md` carried uncommitted edits from the lead when I began; plan.md is committed with them, test-plan.md is left alone.
