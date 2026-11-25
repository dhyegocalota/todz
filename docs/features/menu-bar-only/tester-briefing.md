# Tester briefing: Menu bar only

Written by the developer sub-agent when its steps are done. The developer does not run `test-plan.md` and does not declare the feature works.

## What changed

- `apps/macos/TodzKit/Sources/TodzKit/ActivationPolicyRule.swift`, `AppActivation.swift` — the pure rule: `.accessory` only with the switch on and no ordinary window visible.
- `apps/macos/TodzKit/Sources/TodzKit/MenuBarOnlyPreference.swift` — the switch, key `keepsInMenuBarWhenClosed`, on when nothing is stored, read from the app's own defaults domain.
- `apps/macos/Todz/AppDelegate+ActivationPolicy.swift` — observes `NSWindow.didBecomeKeyNotification` and `NSWindow.willCloseNotification` for every window, counts the visible windows that can become main (the closing one excluded), applies the rule with `NSApp.setActivationPolicy`, and activates the app on a switch to regular. Applied once right after launch.
- `apps/macos/Todz/AppDelegate.swift`, `TodzApp.swift` — the preference, the observations, the registered default.
- `apps/macos/Todz/Settings/SettingsView.swift`, `apps/macos/Copy/SettingsCopy.swift` — the row "Keep todz in the menu bar when closed", second in Settings, under the pending count.
- `apps/macos/README.md`, ADR 0074, the feature folder and its index rows.

## How to run

```bash
swift test --package-path apps/macos/TodzKit
xcodegen generate --spec apps/macos/project.yml
xcodebuild build -project apps/macos/Todz.xcodeproj -scheme Todz -configuration Debug -derivedDataPath apps/macos/build
```

Walk a scratch copy of `apps/macos/build/Build/Products/Debug/Todz.app` (bundle `dev.todz.Todz.debug`, link scheme `todz-dev`), never `/Applications/Todz.app`. `lsappinfo info -only ApplicationType -app dev.todz.Todz.debug` reads `Foreground` for regular and `UIElement` for accessory. System Events lists no windows of the app on this Mac; Orca's `list-windows` does.

## Red today, green after

| Test | Red before the change because | Green after because |
|------|--------------------------------|---------------------|
| `ActivationPolicyRuleTests` (3 tests, 6 cases) | on 7f5bf454 the run stops on `TodzKit/ActivationPolicyRule.swift:3: Fatal error: ActivationPolicyRule.policy is not implemented` | c24252d7: the rule |
| `MenuBarOnlyPreferenceTests` (6 tests) | on 01cf3fbc the run stops on `TodzKit/MenuBarOnlyPreference.swift:18: Fatal error: MenuBarOnlyPreference.isOn is not implemented` (`theStorageKeyIsKeepsInMenuBarWhenClosed` passed before the stop: it reads only the key constant) | 7048cec6: the reading |

Full suite on 99879ede: 1063 tests in 83 suites passed.

## Developer's scratch check (not a test-plan run)

One short run of a scratch copy on 99879ede, launched with `open -g`: with its window shown it read `Foreground`; after ⌘W through Orca it read `UIElement`; `open -a <scratch> todz-dev://today` brought the window back, frontmost, and it read `Foreground`; quit through AppleScript. Orca's `list-windows` also listed a "Todz Settings" window id while Settings was never opened; its visibility was not checked.

## Hypotheses to attack

1. Hypothesis: closing the main window (⌘W or the red button) with the switch on removes the Dock icon and the ⌘Tab entry, and the menu bar item, its count, sync and widget reloads go on. Break it by: an agent change while hidden; a widget checkbox while hidden.
2. Hypothesis: every entry point (popover "Open todz", a popover row, ⌘0, a widget tap, a `todz-dev://` link, opening the app again from Finder) brings the window to the front with the Dock icon and the app's menu bar. Break it by: each one while another app is frontmost; look for a missing menu bar or a window behind other apps.
3. Hypothesis: Settings open with the main window closed keeps the Dock icon; closing Settings removes it. Break it by: flipping the switch with Settings open, then closing Settings, for both values.
4. Hypothesis: the switch off is exactly today's behaviour. Break it by: switch off, close every window; the Dock icon and ⌘Tab entry stay.
5. Hypothesis: a launch that shows no window ends as an accessory. Break it by: quit with the window closed and relaunch, or launch for an intent.
6. Hypothesis: the popover and the morning glance never make the app regular. Break it by: opening the popover while hidden; `lsappinfo` stays `UIElement`.
7. Hypothesis: ⌘Q quits with a window open, and with only the popover key.

## Known gaps

- No Quit item in the popover; while hidden, quitting is ⌘Q with the popover key or opening the window first. The ADR records it.
- The AppKit wiring has no unit test; only the rule and the preference do.
- A normal launch with a window may briefly apply accessory if SwiftUI shows its window after the launch hop; the window becoming key switches back. Not observed in the scratch check.
- Siri intents are on `feat/siri-shortcuts`, not on this branch; their intent-launch deferral (ADR 0066) does not touch the activation policy, so the merge should be clean in `AppDelegate.applicationDidFinishLaunching` (both add lines there).
- `applicationShouldHandleReopen` is not implemented; SwiftUI's default reopen is relied on and was not exercised.
