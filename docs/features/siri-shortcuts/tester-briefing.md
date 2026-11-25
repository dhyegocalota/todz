# Tester briefing: Siri shortcuts

Written by the developer sub-agents when their steps are done, each in its own section: G1 (TodzKit) and G2 (the app). The developers do not run `test-plan.md` and do not declare the feature works.

## G1

Empty until G1's Step 5. It states what changed, how to run the suite, each red run's printed text at Steps 1 and 3 (serial, `--no-parallel --filter <suite>`), the final count, every "it works" as a hypothesis, and the known gaps.

## G2

### What changed

- `apps/macos/Todz/Shortcuts/`: `LeftTodayIntent`, `AddTaskIntent`, `CompleteTaskIntent`, `TodzTaskEntity`, `TodzTaskQuery` (an `EntityStringQuery` whose methods throw the refusal), `TodzShortcuts` (three App Shortcuts, six phrases), `ShortcutRefusal`, `LeftTodaySnippet`. Glue only: every rule is G1's `AppModel` extension.
- `Copy/ShortcutsCopy.swift`: the dialogs; `Todz/Shared/TodayDigest.swift`: the heading, rows and rest line the glance and the snippet both draw (the glance is unchanged, a pin, no red test: the app target has none).
- `AppDelegate`: `AppDependencyManager.shared.add(dependency: self.model)` after `super.init()`; on a launch whose `NSApplication.launchIsDefaultUserInfoKey` is false (an intent launch) the day-close scheduler and the morning glance trigger start the first time the owner activates the app (ADR 0066 §11, measured in its Evidence). The Debug config of `project.yml` sets `INFOPLIST_KEY_CFBundleDisplayName: Todz Dev`.

### How to build and register

`cd apps/macos && xcodegen generate && xcodebuild -project Todz.xcodeproj -scheme Todz -configuration Debug build` (and `Release`): both print `BUILD SUCCEEDED` with no `error:` and no `warning:`. The Shortcuts app found a scratch app's action only after it sat in `~/Applications`, was registered with `lsregister -f` and launched once there (ADR 0066 Evidence); the walk's Preflight must do the same for the Debug product. Library shortcuts for the walk are imported by signing a plist with `shortcuts sign -m anyone`, `open -g -a Shortcuts f.shortcut` and a background click on `Add Shortcut`; the action identifier is `<bundle identifier>.<Intent type name>` (`dev.todz.Todz.debug.LeftTodayIntent`) with an `AppIntentDescriptor` naming `AppIntentIdentifier`, `BundleIdentifier`, `Name` and `TeamIdentifier`. Helpers name the bundle identifier, so `Todz Dev` in the phrases does not matter to them.

### As printed from the products

- Debug `CFBundleDisplayName` `Todz Dev`; Release has no `CFBundleDisplayName` and `CFBundleName` `Todz` (the plan expected `CFBundleDisplayName` `Todz`; nothing reads it, so Release shows `Todz` through its name).
- `extract.actionsdata`, both products: actions `AddTaskIntent`, `CompleteTaskIntent`, `LeftTodayIntent`, `TodzFocusFilter`; entity `TodzTaskEntity`; 3 `autoShortcuts`, 6 phrases (`What's left today in ${applicationName}`, `What do I have today in ${applicationName}`, `Add a task to ${applicationName}`, `New task in ${applicationName}`, `Complete a task in ${applicationName}`, `Check off a task in ${applicationName}`).
- Entitlements, Debug and Release alike: `app-sandbox`, `application-groups`, `get-task-allow`, `network.client`. No Siri key. The Release product printed `get-task-allow` too, which the plan expected absent: this lane edits no entitlement and signs with the same Personal Team, so the key comes from the local signing of the Release configuration; the tester should compare with a Release build of `main`.
- `requestValueDialog` is not part of `extract.actionsdata`; the parameter dialogs come from `ShortcutsCopy` at run time, so the walk must hear `What's the task?` and `Which task?`.

### Tests

`swift test --package-path apps/macos/TodzKit`: 1099 tests in 82 suites passed after merging G1's e72f1be and b56dc4b. Before that merge it aborted on G1's Step 3 stub. G2 adds no unit test: the app target has none. The Debug and Release builds were re-run after the merge with the same output as above.

### Hypotheses for the tester

- A cold `shortcuts run` of a shortcut that calls `LeftTodayIntent` launches the Debug app without a window, a Dock icon, the morning glance or the day-close popover, and the intents answer once the model is ready.
- The result shows the dialog and, in the Shortcuts app, the snippet; whether macOS shows the snippet is design O1's open point.
- Add queues in the outbox and shows in `What's Left Today` once saved; Complete takes the entity chosen by the system's list or typed text.
- The refusals read as the copy says when signed out, with no workspace and still loading.
- After an intent launch, the first time the owner opens the app from the menu bar the glance and the day-close scheduler start.

### Known gaps

- Siri hearing "todz" is unproven (the Human checklist).
- A Shortcut named `ColdSpike` from the spike may remain in the owner's Shortcuts library.
- `requestValueDialog` from a non-literal `LocalizedStringResource` builds, but whether the system honours it at run time is for the walk.
- An activation that comes before the launch's Focus read has settled starts the two surfaces with the gate still at its default (not quiet); the read settles within its timeout, so only an owner who activates within that window could see it.
