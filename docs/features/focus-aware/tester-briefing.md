# Tester briefing: Focus aware

Written by the developer sub-agent (lane G1) when its steps are done. The developer does not run `test-plan.md` and does not declare the feature works.

## What changed

- `apps/macos/TodzKit/Sources/TodzKit/ProactiveGate.swift` — `@MainActor @Observable` gate: `isQuiet`, `admit(_:)` (`.show` or `.held`, one held entry per kind in the order first held), `setQuiet(_:)`, `released` (filled when quiet ends, never twice for the same kind), `claimRelease(_:)` (true once), `applyLaunchRead(isQuiet:)` (ignored once `setQuiet` has run).
- `ProactiveSurface.swift` (`dayClose`, `morningGlance`, `ribbon`), `GateDecision.swift` (`show`, `held`), `FocusQuietNotice.swift` (`notQuiet`, `quietNow`, `init(isQuiet:)`), same folder.
- `apps/macos/TodzKit/Tests/TodzKitTests/ProactiveGateTests.swift` (10 tests) and `FocusQuietNoticeTests.swift` (2 tests).
- `apps/macos/Todz/FocusFilter/TodzFocusFilter.swift` — the `SetFocusFilterIntent`: title `Quiet todz`, description and parameter `Keep todz quiet` (default off) as literals; tile from `apps/macos/Copy/FocusCopy.swift` (`todz`, `Stays quiet` / `Shows as usual`); `perform()` calls `setQuiet` on the gate reached through `@Dependency`.
- `apps/macos/Todz/AppDelegate.swift` — owns the gate, registers it with `AppDependencyManager` in `init`, reads `TodzFocusFilter.current` at launch (a throw returns early: not quiet).
- `apps/macos/Todz/Settings/SettingsView.swift`, `apps/macos/Copy/SettingsCopy.swift`, `apps/macos/Todz/TodzApp.swift` — the third Settings row `Quiet during Focus` with the `Open Focus Settings` button; the Settings scene gets the gate in its environment.
- `apps/macos/project.yml` unchanged: the `Todz` target already takes every file under `Todz` and `Copy`.

## How to run

```bash
swift test --package-path apps/macos/TodzKit
cd apps/macos && xcodegen generate
xcodebuild build -project Todz.xcodeproj -scheme Todz -configuration Debug -derivedDataPath build
grep -c TodzFocusFilter build/Build/Products/Debug/Todz.app/Contents/Resources/Metadata.appintents/extract.actionsdata
grep -c "Keep todz quiet" build/Build/Products/Debug/Todz.app/Contents/Resources/Metadata.appintents/extract.actionsdata
open -g -j build/Build/Products/Debug/Todz.app
```

`open -g -j` launches the Debug app (`dev.todz.Todz.debug`) hidden and in the background; open Settings from the menu bar popover or with ⌘, once the app is frontmost. Developer results at `2e18842`: `Test run with 688 tests in 48 suites passed`; `** BUILD SUCCEEDED **`; both greps print `1` (the metadata is one line; `TodzFocusFilter` occurs 3 times and the action lists `com.apple.link.systemProtocol.FocusConfiguration` among its `systemProtocols`). The developer did not launch the app.

## Red today, green after

Red commit `5c930c9`, each test run alone with `swift test --filter <Suite>/<test>` (a `fatalError` stub ends the whole process, so a combined run stops at the first one):

| Test | Red before the change because | Green after because |
|------|--------------------------------|---------------------|
| `ProactiveGateTests/aNewGateIsNotQuietAndShows` | `TodzKit/ProactiveGate.swift:5: Fatal error: isQuiet is not implemented` | `d7ae04d` |
| `ProactiveGateTests/aQuietGateHoldsAndReleasesNothing` | `TodzKit/ProactiveGate.swift:23: Fatal error: setQuiet is not implemented` | `d7ae04d` |
| `ProactiveGateTests/quietEndingReleasesEachHeldKindOnceInTheOrderFirstHeld` | `TodzKit/ProactiveGate.swift:23: Fatal error: setQuiet is not implemented` | `d7ae04d` |
| `ProactiveGateTests/aReleaseIsClaimedOnce` | `TodzKit/ProactiveGate.swift:23: Fatal error: setQuiet is not implemented` | `d7ae04d` |
| `ProactiveGateTests/quietEndingTwiceReleasesNothingTheSecondTime` | `TodzKit/ProactiveGate.swift:23: Fatal error: setQuiet is not implemented` | `d7ae04d` |
| `ProactiveGateTests/quietTwiceThenNotQuietReleasesEachHeldKindOnce` | `TodzKit/ProactiveGate.swift:23: Fatal error: setQuiet is not implemented` | `d7ae04d` |
| `ProactiveGateTests/afterAReleaseTheGateShowsAgainAndAQuietThatHeldNothingAddsNothing` | `TodzKit/ProactiveGate.swift:23: Fatal error: setQuiet is not implemented` | `d7ae04d` |
| `ProactiveGateTests/aKindHeldAgainBeforeItsReleaseIsClaimedIsReleasedOnce` | `TodzKit/ProactiveGate.swift:23: Fatal error: setQuiet is not implemented` | `d7ae04d` |
| `ProactiveGateTests/theLaunchReadQuietsAFreshGate` | `TodzKit/ProactiveGate.swift:27: Fatal error: applyLaunchRead is not implemented` | `d7ae04d` |
| `ProactiveGateTests/aLaunchReadAfterAFocusChangeIsIgnored` | `TodzKit/ProactiveGate.swift:23: Fatal error: setQuiet is not implemented` | `d7ae04d` |
| `FocusQuietNoticeTests/notQuietReadsAsNotQuiet` | `TodzKit/FocusQuietNotice.swift:6: Fatal error: FocusQuietNotice is not implemented` | `d7ae04d` |
| `FocusQuietNoticeTests/quietReadsAsQuietNow` | `TodzKit/FocusQuietNotice.swift:6: Fatal error: FocusQuietNotice is not implemented` | `d7ae04d` |

`aKindHeldAgainBeforeItsReleaseIsClaimedIsReleasedOnce` is one more case than the plan listed: a kind released but not yet claimed, held again in a second quiet period, stays once in `released`. No pins.

## Hypotheses to attack

Every "it works" is a hypothesis the tester tries to break.

1. Hypothesis: Settings shows `Quiet during Focus`, `todz stays quiet in any Focus with the todz filter on.` and an `Open Focus Settings` push button as a third row under the two switches, light and dark. Break it by: opening Settings in both appearances; compare with `design.md` § 1.1.
2. Hypothesis: the Settings window height is unchanged while it stays open, because the subtitle reserves two lines. Break it by: recording the frame with Orca `get-app-state` on `main`'s build and on this branch; expect this branch taller by the new row only, and constant while open.
3. Hypothesis: `Open Focus Settings` opens System Settings on the Focus pane on macOS 26. Break it by: pressing it; if System Settings opens elsewhere or nothing happens, the `x-apple.systempreferences:com.apple.Focus-Settings.extension` address is wrong (plan failure mode, step 4).
4. Hypothesis: System Settings → Focus → a mode → Add Filter lists the Debug todz, and its sheet reads `Quiet todz`, `Keeps todz from showing anything on its own while this Focus is on.` and a `Keep todz quiet` switch, off. Break it by: opening the sheet without saving; look for a missing entry, a second Debug entry or a switch on by default.
5. Hypothesis: a saved filter's tile reads `todz` / `Stays quiet` (switch on) or `Shows as usual` (off). Not walked without the owner (saving changes his Focus).
6. Hypothesis: with the filter saved, turning the Focus on makes the Settings subtitle read `Quiet now, until this Focus ends.`, and turning it off brings the detail back, both without the window resizing. Human checklist only.
7. Hypothesis: when a Focus holding the filter turns on or off while todz is quit, the system launches todz to run `perform()`; todz starts in the menu bar as at login, `perform()` does not crash because the gate is registered in `AppDelegate.init`, which runs when SwiftUI builds the app delegate before any intent. Unknown: whether the main window opens on that launch (it opens on an ordinary launch); note it in the Human checklist (plan failure mode, step 3, R2).
8. Hypothesis: a launch inside an active Focus with the filter starts quiet (`current` read), and a launch outside any Focus, or with `current` throwing, starts not quiet. Break it by: Human checklist only.
9. Hypothesis: the filter is not listed as a Shortcuts action the owner would stumble on. The metadata says `isDiscoverable: true` (the default); check the Shortcuts app's action list for todz and report what shows.
10. Hypothesis: VoiceOver reads the row's title and subtitle, then `Open Focus Settings, button`, and Tab reaches the button after the second switch with Full Keyboard Access.

## Known gaps

- No proactive surface exists yet, so `admit`, `released` and `claimRelease` have no caller in the app; only the unit tests exercise them.
- `perform()` and the launch read have no unit test: the intent lives in the app target, outside the package (plan review R5). The metadata greps prove only that the intent is declared.
- The Focus pane address was not opened by the developer (no app launch); it is the tester's walk.
- The design's open point, whether a `static let` from `FocusCopy` survives metadata extraction, was not tried: plan review R4 settled on literals in the intent.
