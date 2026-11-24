# Tester briefing: The menu bar shows the pending count

Written by the developer sub-agent when its steps are done. The developer does not run `test-plan.md` and does not declare the feature works.

## What changed

- `apps/macos/TodzKit/Sources/TodzKit/MenuBarBadge.swift`: the badge text from an open count and the toggle (nil when off, not loaded, zero or negative; the number up to 99; `99+` above), the toggle's `UserDefaults` key and default, and `registerDefault(in:)`.
- `apps/macos/TodzKit/Sources/TodzKit/AppModel+HeadingCount.swift`: `todayHeadingCount`, the one number the popover heading and the status item read. None on a first load, when no project loaded, and without a workspace; Today's open count otherwise, a failed project included. O4 of `design.md` is overturned for this reason.
- `apps/macos/Todz/MenuBar/MenuBarLabel.swift`: the icon, then the badge text with monospaced digits; accessibility label "todz, N left today" (the real number above 99).
- `apps/macos/Todz/MenuBar/MenuBarToday.swift`: the heading reads `todayHeadingCount`.
- `apps/macos/Todz/Settings/SettingsView.swift`, `apps/macos/Copy/SettingsCopy.swift`, `AccessibilityCopy.menuBarCount(count:)`, and `TodzApp` (the `Settings` scene, width 420, default registered in `init`).
- `apps/macos/README.md`, `design.md` (O4 struck), `plan.md` (ticks).

## How to run

```bash
swift test --package-path apps/macos/TodzKit
xcodegen generate --spec apps/macos/project.yml
xcodebuild build -project apps/macos/Todz.xcodeproj -scheme Todz -configuration Debug -derivedDataPath <a scratch folder>
```

Then launch the built Todz.app, signed in on a workspace with tasks due today.

## Red today, green after

| Test | Red before the change because | Green after because |
|------|--------------------------------|---------------------|
| `MenuBarBadgeTests` (6 tests), commit 756958f | `TodzKit/MenuBarBadge.swift:3: Fatal error: MenuBarBadge is not implemented` (the run aborts at the first test) | the text rule in 60de2c2 |
| `AppModelTests+HeadingCount` (4 tests), commit cbc8ba7 | `TodzKit/AppModel+HeadingCount.swift:3: Fatal error: AppModel.todayHeadingCount is not implemented` | cc3e6f7 |
| `MenuBarBadgeDefaultsTests.aRegisteredDefaultReadsOnForAFreshDefaultsStore`, cbc8ba7 | `TodzKit/MenuBarBadge.swift:16: Fatal error: MenuBarBadge.registerDefault is not implemented` | cc3e6f7 |
| `MenuBarBadgeDefaultsTests.anUnregisteredKeyReadsOffWhichIsWhyTheDefaultIsRegistered` | pin: green when it landed (documents why the default is registered) | pin |
| `MenuBarBadgeDefaultsTests.registeringNeverOverwritesTheOwnersChoice` | red with the stub, same text as above | cc3e6f7 |

A stub aborts the whole test process, so run each red test alone with `--filter`. Full suite: 488 tests pass.

## Hypotheses to attack

1. Hypothesis: with two open tasks due today the status item reads the icon and "2"; completing one makes it "1"; completing the last leaves the icon only. Break it by: completing from the popover, the main window and a pull (an agent's task) with the popover closed.
2. Hypothesis: the item always equals the popover heading's "N left". Break it by: one project unreachable (the number stays, as the heading), every project unreachable (icon only), offline with a cache, a workspace switch.
3. Hypothesis: the switch in Settings changes the item at once and the choice survives a relaunch; a fresh install starts on. Break it by: `defaults delete` the key then launch; flip it with the popover open.
4. Hypothesis: 99 shows "99", 100 and above show "99+", and the VoiceOver label carries the real number. Break it by: seeding 100 and 134 due-today tasks; Accessibility Inspector on the item.
5. Hypothesis: the menu bar renders the `HStack` of symbol and text (design.md § 2 limit 1) and keeps the symbol a template. Break it by: a light and a dark bar, the popover open (highlight), looking for a coloured or missing icon.
6. Hypothesis: `.monospacedDigit()` survives in the status item (limit 1, O3), so 11 to 18 keeps its width. Break it by: measuring the item at 11 and 18.
7. Hypothesis: the label redraws on a change while the popover is closed (limit 3) and `.accessibilityLabel` reaches the status item (limit 4). Break it by: an agent adding a task while only the item is visible; VoiceOver on the item.
8. Hypothesis: ⌘, opens and raises Settings from the popover and with no main window (limit 6); the window title is the system's. Break it by: closing the main window and opening only the popover first.

None of 5 to 8 was checked: no running app was allowed.

## Known gaps

- The label limits of `design.md` § 2 are unverified; the fallbacks there (title initialiser for the accessibility label, proportional digits) are not built.
- Midnight: the label, like the popover, is not re-evaluated when the day changes; the count can be stale until the next pull or write.
- The README gallery cell and `docs/screenshots/menu-bar-count/01-count.png` are the lead's.
- No Settings screenshot cell.
