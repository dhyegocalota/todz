# Tester briefing: focus-switch-defaults

## G2 app

### What changed and where

- `ProactiveGate(respectsFocus:)` is quiet only while Respect Focus is on and the Focus filter is quiet; `setRespectsFocus(_:)` releases what was held once (`apps/macos/TodzKit/Sources/TodzKit/ProactiveGate.swift`).
- `RespectFocusPreference` (key `respectsFocus`, off by default) and `FocusSwitchCoordinator`, which reads the Focus filter only while the switch is on (no 3 s launch wait when off) and reacts only to a flip of the switch (`apps/macos/TodzKit/Sources/TodzKit/`).
- `DayClosePreference`, `MorningGlancePreference`, `DayTemperaturePreference` default on: an absent or non-Bool value reads on, a stored `false` stays off. The pending count was already on.
- `AppDelegate.swift` builds the gate from the preference and awaits `focusSwitch.start()`; `AppDelegate+FocusSwitch.swift` builds the coordinator; the existing defaults observation in `AppDelegate+DayTemperature.swift` tells it of changes; `TodzApp` registers the default.
- Settings: "Respect Focus" switch after the ribbon row, a helper row ("Add the todz filter to a Focus." with "Open Focus Settings") only while on, no other row mentions Focus; the Focus filter's description names the switch.
- The agent-nudge and day-email rows show the server's values; nothing app-side changed for them.

### How to run

- `cd apps/macos/TodzKit && swift test`
- `pnpm --filter ./tools/repository-shape exec vitest run src/settings-focus-copy.test.ts`
- `cd apps/macos && xcodegen generate` then a Debug build of the `Todz` scheme.

### Red then green

Each red commit ran alone, before its green commit.

| Red commit | Test run alone | Printed failure |
|---|---|---|
| `9c321271` | `ProactiveGateTests/turningRespectFocusOffWhileHeldReleasesEachHeldKindOnce` | `Fatal error: ProactiveGate.setRespectsFocus is not implemented` |
| `9c321271` | `ProactiveGateTests/withRespectFocusOffAQuietFilterShows` | `Expectation failed: !gate.isQuiet` and `Expectation failed: gate.admit(.dayClose) == .show` |
| `bd49745b` | `RespectFocusPreferenceTests/aFreshDomainReadsOff` | `Fatal error: RespectFocusPreference.isOn is not implemented` |
| `a9395ccb` | `DayClosePreferenceTests`, `MorningGlancePreferenceTests`, `DayTemperaturePreferenceTests` | `Expectation failed: dayClose.preference.isOn`, `glance.preference.isOn`, `DayTemperaturePreference(…).isOn`; `registeringTheDefaultsRegistersOn`: `… as? Bool == true` |
| `5ac0c2da` | `FocusSwitchCoordinatorTests/withTheSwitchOnAtStartTheFilterIsReadOnceAndItsAnswerReachesTheGate` | `Fatal error: FocusSwitchCoordinator.start is not implemented` |
| `212ee2f5` | `settings-focus-copy.test.ts` | `expected [ 'focusQuiet', …(2) ] to deeply equal []`; `respectFocusDetail is not a static let of this file`; `dayTemperatureDetail` received `… widget rows. Quiet in a Focus.` |

Pins (green when they landed): aStoredFalseStaysOff in the three preference suites.

### Hypotheses for the tester

- A fresh Debug domain shows pending count, morning glance, day temperature and close the day on at 18:00; Respect Focus off; the Settings window has no helper row.
- Turning Respect Focus on adds the helper row; with the todz filter on in a Focus, the switch's detail reads "Quiet now, until this Focus ends." and the day close, glance and ribbon are held; turning the switch off while held shows each held surface once.
- With the switch off the app never reads the Focus filter (the day close and glance are not late at launch), and a Focus with the filter on changes nothing.
- A stored `false` for any of the four defaults-on keys stays off after relaunch.

### Walk recipe (R10)

Never launch over the owner's work and never touch `/Applications/Todz.app`.

1. Remove the Debug domain: `defaults delete <Debug bundle identifier>`.
2. Before launch, write today into `lastClosedDay` and `lastMorningGlanceDay` (`defaults write <Debug bundle identifier> lastClosedDay -string <today>` and the same for `lastMorningGlanceDay`), so no popover or glance pops over the owner's work; leave the four `isOn` keys absent.
3. Launch the Debug build, open Settings through computer use, read the switches, turn Respect Focus on and read the helper row, turn it off.

### Gaps

- The Focus filter itself cannot be exercised without a Focus mode; the held/release flow is proven by unit tests and by `FocusSwitchCoordinatorTests`, not on a real Focus.
- No Settings height test exists to follow the extra row; the window height follows the form (`fixedSize`).
