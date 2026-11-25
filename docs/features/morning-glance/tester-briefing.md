# Tester briefing: Morning glance

Written by the developer sub-agents when their steps are done, each in its own section: G1 (TodzKit) and G2 (the app). The developers do not run `test-plan.md` and do not declare the feature works.

## G1

### What changed

All under `apps/macos/TodzKit`; commits `831f914` (red), `8a1befb` (green), `2ef05c6` (red), `5350267` (green).

- `Sources/TodzKit/MorningGlancePreference.swift` — keys `showsMorningGlance` and `lastMorningGlanceDay`, off by default, as `DayClosePreference`.
- `Sources/TodzKit/MorningGlanceContent.swift` — the workspace identifier, the count, up to five `WidgetSnapshotTask` rows and the rest.
- `Sources/TodzKit/AppModel+MorningGlance.swift` — `morningGlanceContent`, reading only `taskViews.today.open` and `isTodayKnown(in:)`; nil until Today is known.
- `Sources/TodzKit/MorningGlanceDwell.swift` — the pure fade timing: 5 s, hover pause, 30 s cap, 0.5 s fade (0 with Reduce Motion), 0.4 s pointer grace.
- `Sources/TodzKit/MorningGlanceFront.swift` — the pure "Today is already in front" rule.
- `Sources/TodzKit/MorningGlanceCoordinator.swift` — the chance, the gate, the 60 s Today wait by observation, the locked chance, held and released days, the in-flight show, the mark once seen, the close on popover, `closeNow()`, signed out or another workspace.
- `Sources/TodzKit/DayCloseCoordinator.swift` — `isDueAndIdle` is public; `check()` reads it, behaviour unchanged.

### How to run

```bash
swift test --package-path apps/macos/TodzKit
swift test --package-path apps/macos/TodzKit --no-parallel --filter MorningGlance
```

Final count on `5350267`: 908 tests in 62 suites passed (the whole package); the focused run of `MorningGlance` and `DayCloseCoordinatorTests` is 101 tests in 6 suites.

### Red today, green after

A stub's `fatalError` kills the test process, so each red run stops at the first stub it reaches. Serial runs (`--no-parallel --filter <suite>`) at the red commits printed:

| Test | Red before the change because (printed) | Green after because |
|------|------------------------------------------|----------------------|
| `MorningGlancePreferenceTests` (`831f914`) | `MorningGlancePreference.swift:9: Fatal error: MorningGlancePreference.registerDefaults is not implemented` | the four functions read and write the defaults |
| `MorningGlanceDwellTests` (`831f914`) | `MorningGlanceDwell.swift:13: Fatal error: MorningGlanceDwell.init is not implemented` | the dwell is a value of the show instant and the pointer state |
| `MorningGlanceFrontTests` (`831f914`) | `MorningGlanceFront.swift:9: Fatal error: MorningGlanceFront.isInFront is not implemented` | the rule is the three flags or the active app with a window |
| `AppModelTests/theMorningGlanceContentIsNoneWhileTodayLoads` (`831f914`, and the rest of `AppModelTests+MorningGlance`) | `AppModel+MorningGlance.swift:3: Fatal error: AppModel.morningGlanceContent is not implemented` | the content is built from `taskViews.today.open` |
| `MorningGlanceCoordinatorTests` (`2ef05c6`) | `MorningGlanceCoordinator.swift:21: Fatal error: MorningGlanceCoordinator.init is not implemented` | the coordinator is built |
| `DayCloseCoordinatorTests/aDayCloseIsDueAndIdleOnlyWhenOnDueAndNoClickIsInFlight` (`2ef05c6`) | `DayCloseCoordinator.swift:55: Fatal error: DayCloseCoordinator.isDueAndIdle is not implemented` | the property is `decision == .due && !isClickInFlight` |

Parallel runs differ, as the day close's E3 warned: `swift test --filter MorningGlance` at `831f914` printed `MorningGlanceFront.isInFront is not implemented` seven times and `MorningGlanceDwell.fadeDuration is not implemented` once, whichever worker crashed first; `--filter "MorningGlanceCoordinatorTests|aDayCloseIsDueAndIdle"` at `2ef05c6` printed only `DayCloseCoordinator.isDueAndIdle is not implemented`. Run the red boxes serially.

Pins: none. The stubs make every new test red; the coordinator's red text is its `init` for all 35 tests, because its stub does not build the object.

### Hypotheses to attack

Every "it works" is a hypothesis the tester tries to break.

1. Hypothesis: the day is marked only after the panel answers true. Break it by: a `showPanel` that answers false, then true; a screen that locks inside `showPanel`; `lastMorningGlanceDay` must stay absent until the true answer on an unlocked screen.
2. Hypothesis: the Today wait continues its own chance and never starts a new one. Break it by: two `check()` calls while Today is nil, the second 70 s after the first, and Today arriving 10 s after the second (it shows: the latest chance carries on); and arriving 61 s after the only one (nothing).
3. Hypothesis: a held chance on day D shows on release only if today is D. Break it by: holding on D, a second held chance on D+1, release on D+1 (shows), release on D+2 (nothing, gate released list empty).
4. Hypothesis: the popover, `closeNow()` or Today in front during the in-flight show close the panel the moment `showPanel` answers, and the day stays marked. Break it by: each inside `whileShowing`; and `closeNow()` while the screen is also locked (unmarked).
5. Hypothesis: a content change while on screen closes only for nil or another workspace. Break it by: a task added, a task completed, the active workspace switched, a sign-out, repeatedly, then `dismissed()` followed by a change (nothing closes, no second close).
6. Hypothesis: `morningGlanceContent` is the heading count's twin. Break it by: pending adds and completions offline; the count and the rows must agree with `todayHeadingCount`.
7. Hypothesis: `DayCloseCoordinator.check()` is unchanged. Break it by: the whole `DayCloseCoordinatorTests` suite, which stays green.

### Known gaps

- `hovered(at:)` takes the instant for symmetry with `left(at:)`; a hover's start does not move the fade, so the instant is unused.
- No real signal, panel, lock or Focus is exercised here; the app lane and the walk prove those.
- The coordinator's `contentWaiting`, `releaseTaking` and `shownContentReviewing` tasks are internal handles for tests, as the day close's.
- The latest chance wins a Today wait, so a second chance while Today is still unknown extends the 60 s window to that chance's start; the plan reads "its chance" and R12's test pins only the single-chance case.

## G2

### What changed

Commits `c7a0a5d` (copy), `d614cdd` (panel, view, presenter, the `ScreenLock` move), `5f533fa` (trigger, wiring, shared names), `720c586` (Settings). All under `apps/macos`.

- `Copy/MorningGlanceCopy.swift` (new), `Copy/SettingsCopy.swift`, `Copy/AccessibilityCopy.swift` — the strings of `design.md` § 8.
- `Todz/MorningGlance/MorningGlancePanel.swift` — the `NSPanel`: never key or main, borderless, non-activating, status bar level, every Space, over full screen, no hide on deactivate, clear background, shadow.
- `Todz/MorningGlance/MorningGlanceView.swift` — heading, up to five rows, `+N more`, glass on macOS 26 and later, `.regularMaterial` before; one accessibility element (label, value, hint, button trait, default action).
- `Todz/MorningGlance/MorningGlanceHostingView.swift` (not in the plan's file list, same folder) — the hosting view with an `.activeAlways` tracking area for the hover and `mouseDown` for the click.
- `Todz/MorningGlance/MorningGlancePresenter.swift` — `show` (screen, lock re-read, unhide only when hidden, top right inset 12, order front, wait at most 1 s for the occlusion to turn visible, announcement, 0.4 s pointer grace, the dwell Task, the fade), `close`, the click (`windowState.waitingLink = .today`).
- `Todz/MorningGlance/MorningGlanceTrigger.swift` — the launch chance; wake, display wake, session return and unlock call `check()`; an app activation calls `retryLockedChance()`; lock and sleep call `closeNow()`. No `UserDefaults.didChangeNotification`.
- `Todz/MorningGlance/MorningGlanceCoordinator+App.swift` (not in the plan's file list, same folder) — the coordinator's app wiring (the plan placed it in `AppDelegate`; moved here so the `AppDelegate` hunks stay three small ones and merge easily with `feat/performance`): mirroring from `CGDisplayIsInMirrorSet` of the first screen (an unreadable screen counts as mirrored), `isTodayInFront` from `MorningGlanceFront.isInFront`.
- `Todz/AppDelegate.swift` — three lazy properties after `dayCloseScheduler`; `morningGlanceTrigger.start()` right after `dayCloseScheduler.start()` in the launch `Task`.
- `Todz/TodzApp.swift` — `MorningGlancePreference.registerDefaults(in:)` and the coordinator in the popover's environment.
- `Todz/MenuBar/MenuBarPopover.swift` — `onShow` calls `dayClose.popoverShown()` and `morningGlance.popoverShown()`.
- `Todz/Settings/SettingsView.swift` — the switch after Close the day, two reserved detail lines.
- `Todz/Shared/ScreenLock.swift` (moved from `Todz/DayClose/`), `Todz/Shared/Notification.Name+ScreenIsUnlocked.swift` (new, with `screenIsLocked`); `Todz/DayClose/DayCloseScheduler.swift` uses the shared name.

### How to run

```bash
swift test --package-path apps/macos/TodzKit
cd apps/macos && xcodegen generate
xcodebuild build -project Todz.xcodeproj -scheme Todz -configuration Debug -derivedDataPath build
open -g -j build/Build/Products/Debug/Todz.app
```

Forcing a glance. The Debug app is sandboxed, so its defaults live in its container; write them with the app quit:

```bash
PREFS=~/Library/Containers/dev.todz.Todz.debug/Data/Library/Preferences/dev.todz.Todz.debug
defaults delete "$PREFS" lastMorningGlanceDay
defaults write "$PREFS" showsMorningGlance -bool true
```

Then launch with `open -g -j`. The panel lands on the owner's screen: two showings at most in the whole walk (`test-plan.md`); every other launch must show nothing. Keep the day close off (`closesTheDay` false) or not due, or it wins the chance by design. Before seeding the session and cache, copy the app container's `Library/Application Support` folder aside and put it back afterwards, as the day-close testers did with their seeded workspace.

Final run on `720c586` plus the Release-only checks: `swift test --package-path apps/macos/TodzKit` 908 tests in 62 suites passed; `xcodegen generate`; Debug and Release `xcodebuild` print `BUILD SUCCEEDED` with no `warning:` or `error:` line.

### Red today, green after

None: the app lane has no red step (R9). Every decision it relies on is a `TodzKit` rule with its red tests in G1. The panel's traits are proven by the walk; the build is the only mechanical check here.

| Test | Red before the change because | Green after because |
|------|--------------------------------|---------------------|
| none (no seam in the app target) | n/a | `swift test --package-path apps/macos/TodzKit` and the two builds are green on `720c586` |

### Hypotheses to attack

Every "it works" is a hypothesis the tester tries to break.

1. Hypothesis: the panel never takes focus. Break it by: another app frontmost with a focused text field, a hidden launch, a sampler of the frontmost bundle identifier, then `x` typed with the pointer held on the panel; the window's `canBecomeKey` and `canBecomeMain` must read false and todz is never frontmost.
2. Hypothesis: the panel shows after a hidden launch and the day is marked only once seen. Break it by: `open -g -j` with the day close off; `lastMorningGlanceDay` absent until the panel is on screen, then today.
3. Hypothesis: the occlusion becomes visible within 1 s. Break it by: reading the window list (layer 25, `kCGWindowIsOnscreen`) from the launch; record the milliseconds for ADR 0062's Evidence.
4. Hypothesis: the pointer is ignored for 0.4 s and the hover works while todz is inactive. Break it by: a click within 0.4 s of the panel showing (it reaches the app beneath); a resting pointer on the panel for 8 s (it stays) and at most 30 s.
5. Hypothesis: a click opens the main window on Today and activates todz. Break it by: a click while todz is inactive and hidden; the window follows `waitingLink` through `MenuBarLabel`; if todz stays inactive, the failure-modes row says the presenter must activate it before setting the link.
6. Hypothesis: the fade lasts 0.5 s and is instant with Reduce Motion. Break it by: sampling the window's alpha; Reduce Motion is a Human checklist row.
7. Hypothesis: the lock, sleep, popover opening, sign-out and workspace switch close the panel at once. Break it by: opening the menu bar popover while the panel shows; the lock, sleep and sign-out ones go to the Human checklist.
8. Hypothesis: the glance and the day close never share a chance. Break it by: a due day close and the glance on at launch: only the popover opens; the day is marked for the glance.
9. Hypothesis: the Settings switch is off by default, grows the window by exactly one row and never previews the panel. Break it by: a fresh container, switching it on and off, reading the window height, and checking no panel appears.
10. Hypothesis: `AppDelegate` and `TodzApp` merge cleanly with `feat/performance`. Break it by: the merge itself; the launch order (`readFocusFilter`, then `dayCloseScheduler.start()`, then `morningGlanceTrigger.start()`) must survive it.

### Known gaps

- No real panel, signal, lock, wake, Focus, mirroring or VoiceOver was exercised: the app was never launched (the panel draws on the owner's screen).
- The hover's `.activeAlways` tracking area, the occlusion wait and the click's activation are untested assumptions until the walk.
- A pointer already on the panel when it first appears gets no `mouseEntered` until it moves, so the dwell is the plain five seconds in that case.
- `glassEffect` is built against the Xcode 27 SDK; macOS 14 and 15 take the `.regularMaterial` branch, which was not run.
- The panel's height comes from the hosting view's `fittingSize` at show time; very long localized strings were not tried.

## Fix round 1

Gate on the last code commit (`aef88d4`): `swift test --package-path apps/macos/TodzKit` 921 tests in 63 suites passed; `xcodegen generate`; Debug and Release `xcodebuild` print `BUILD SUCCEEDED` with no `warning:` or `error:` line. The app was never launched.

| Item | Change | Red commit and printed text | Green commit |
|------|--------|------------------------------|--------------|
| S2 | `MorningGlancePreference` and `DayClosePreference` are structs built with the defaults and the domain name; they read only `persistentDomain(forName:)` through `PersistentDomain` and write through `set`; both coordinators take `preference:` (the app passes `AppConfiguration.defaultsDomain`). A missing day-close time reads as 18:00, a stored non-number as off | `6cc7ea6`: `Expectation failed: !preference.isOn`, `preference.lastShownDay == nil` (glance) and `!preference.isOn`, `preference.minutesAfterMidnight == DayClosePreference.minutesAfterMidnightByDefault`, `preference.lastClosedDay == nil` (day close), all in `aValueOnlyInAnotherSearchedDomainIsIgnored`; `aStoredTimeThatIsNotANumberReadsAsOff`: `minutesAfterMidnight == nil`. The red tests ran against structs that still read `UserDefaults` normally | `bb7d014` |
| S1 | `LinkSource` (`widget`, `morningGlance`) maps to an `OpeningFocus`; `MainWindowState.open(_:from:)` sets it with the link; `MainWindow`'s `.task` focuses the list for the glance and the add field otherwise, and resets on disappear; the hosting view swallows `mouseDown`, acts on `mouseUp` inside its bounds, and only after a `mouseEntered` that came after the grace ended | `a1dfedb`: `Expectation failed: LinkSource.morningGlance.openingFocus == .list`. The `NSView` half is app target, walk only | `1af0f27` (seam and window wiring), `b9950ea` (hosting view and presenter) |
| S3 | `canHide = false` on the panel; `NSApp.unhideWithoutActivation()` removed | app target, walk only | `b9950ea` |
| S4/R5 | after the panel is seen, `show` calls `reviewShown` once: a different or missing workspace, or a quiet gate, ends the show | `02a7906`: `aWorkspaceSwitchDuringTheShowClosesThePanelRightAfterTheAnswerAndKeepsTheDayMarked` and `aSignOutDuringTheShowClosesThePanelRightAfterTheAnswerAndKeepsTheDayMarked`: `Expectation failed: harness.panel.closings == 1` and `!harness.coordinator.isShowing`. `closingNowDuringTheShowClosesThePanelRightAfterTheAnswerAndKeepsTheDayMarked` is a pin (green when it landed) | `142cc73` |
| S5 | the unlock notification is `retryLockedChance()`; wake, `screensDidWake` and `sessionDidBecomeActive` stay `check()` | `aRetryWithNoLockedChanceShowsNothing` is a pin; the observer mapping is app target, walk only | `b9950ea` |
| S6 | `reviewShown` also tracks `gate.isQuiet` and ends the show when it turns true | `02a7906`: `aFocusStartingWhileThePanelIsOnScreenClosesIt` and `aFocusStartingDuringTheShowClosesThePanelRightAfterTheAnswer`: `Expectation failed: harness.panel.closings == 1`, `!harness.coordinator.isShowing` | `142cc73` |
| S7 | `screensDidSleepNotification` and `sessionDidResignActiveNotification` join the closing notifications | app target, walk only | `b9950ea` |
| S8 | `sharingType = .none` on the panel. The skip on a captured screen is dropped: `CGDisplayIsCaptured` is unavailable on macOS ("No longer supported", the build refused it) and no public API reports a capture, so the spec's non-goals now say so. The coordinator's `isScreenCaptured` input and its test were added in `02a7906`/`142cc73` and removed in `aef88d4` | app target, walk only | `b9950ea`, `aef88d4` |
| R2 | `waitForContent` keeps the first waiting chance (`guard waitingChance == nil`); `isWaitingForContent` is gone | `02a7906`: `aSecondCheckDuringTheTodayWaitKeepsTheFirstChanceSoALateTodayShowsNothing`: `Expectation failed: harness.panel.attempts == 0`, `harness.lastShownDay == nil` | `142cc73` |
| R3 | `MorningGlanceDwell.hovered()` takes no instant | refactor, the dwell suite is the proof | `1af0f27` |
| R4 | at the grace end, a pointer already inside the panel's frame (`NSEvent.mouseLocation`) starts the hover pause, but never arms the click | app target, walk only | `b9950ea` |
| R1 | spec status and the index row are `Building` | docs | this commit |
| Tester: width | the code's constant and the design both say 280; the panel's content rect now takes its width from that constant and only its height from `fittingSize`, so the window cannot come out 276. The cause of the 276 was not found without launching the app | app target, walk only | `b9950ea` |
| Tester: no-show row | the "nothing open" row starts from a cache synced by a prior launch with 0 open | docs | this commit |

### Walk rows to re-check

- The click opens the window without focusing the add field, and typing goes nowhere: click the panel after its grace (with the pointer entering first), then type `x`; the add field stays empty and the list holds focus. A click that begins with `mouseDown` outside and ends inside, or a pointer already resting inside at the grace end, opens nothing.
- A todz hidden with Cmd+H stays hidden while the panel shows, and the panel still shows.
- The panel's CGWindow width reads 280.
- The panel is absent from a screen capture or a share of the screen.
- The screen sleeping or the session resigning while the panel shows closes it; the unlock alone never starts a new chance.

### Known gaps added

- `sharingType = .none`, `canHide = false`, the mouse-up gate and the 280 width are untested assumptions until the walk.
- The argument domain cannot be tested without leaking into other suites (a volatile argument domain is process wide), so the red tests prove the searched-domain case (the global domain's path) only.
- The trigger's notification mapping (S5, S7) has no unit seam.
