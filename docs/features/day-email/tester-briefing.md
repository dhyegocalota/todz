# Tester briefing: day-email

## App

**Changed (`apps/macos/`):** `Owner.dayEmail` and `Owner.dayEmailMinutes` (decoded when present, `nil` otherwise); `OwnerService.updateDayEmail(session:isEnabled:)` and `updateDayEmailMinutes(session:minutes:)` on `PATCH /owner` through `DayEmailBody`; `AppModel+DayEmail.swift` (both values, saving, not saved, notice, the two setters with revert); `AgentNudgeNotice` renamed `OwnerSettingNotice`; the Settings row `Email me my day` after Morning glance; `SettingsCopy` shares the offline and signed-out lines (`ownerSettingOffline`, `ownerSettingSignedOut`, `ownerSettingSubtitle(notice:detail:)`); `DayCloseSchedule.minutesPerHour` became public for the row's placeholder time while the value is unknown.

**Run:** `swift test --package-path apps/macos/TodzKit`; in `apps/macos`, `xcodegen generate` then `xcodebuild -project Todz.xcodeproj -scheme Todz -configuration Debug build`. The developer never launched the app.

**Red today and green after** (red commit `2a63e27`, green `b490496`; run serially, a stub's `fatalError` ends the run, so only the first one hit prints):

| Test | Red text as printed | Green |
|---|---|---|
| `OwnerAPITests/readOwnerDecodesTheDayEmail` (`2a63e27`) | `Expectation failed: owner.dayEmail == true` and `Expectation failed: owner.dayEmailMinutes == storedMinutes` | the two coding keys |
| `OwnerAPITests/updateDayEmailPatchesOnlyTheDayEmail` (`2a63e27`) | `OwnerAPI.swift:159: Fatal error: OwnerAPI.updateDayEmail is not implemented` | the PATCH with `{"day_email":true}` |
| `OwnerAPITests/updateDayEmailMinutesPatchesOnlyTheMinutes` (`2a63e27`) | `OwnerAPI.swift:163: Fatal error: OwnerAPI.updateDayEmailMinutes is not implemented` | the PATCH with `{"day_email_minutes":450}` |
| `AppModelTests` day email tests (`2a63e27`) | `AppModel+DayEmail.swift:3: Fatal error: AppModel.canChangeDayEmail is not implemented` | the model states of design 1.1 |

Pins (green when they landed): `OwnerAPITests/readOwnerOfAServerWithoutTheDayEmailLeavesItUnknown`; the agent nudge tests after the rename.

Result at `d9b1768`: `swift test` 996 tests in 75 suites passed; Debug `xcodebuild` BUILD SUCCEEDED.

**Hypotheses for the tester:**
- With the owner answer `day_email: false`, the row shows the switch off and the time dimmed; turning it on sends exactly `{"day_email":true}` and enables the time.
- Changing the time while on sends exactly `{"day_email_minutes":N}`, N the minute of the day in the model's time zone; the picker shows that minute back.
- While a save is in flight both controls are disabled; a failed save (network, 5xx, 400) puts both values back and the subtitle reads "Your change wasn't saved." until the next change or the window closes.
- Offline with known values: both controls disabled, last values shown, subtitle "Can't reach todz. You can change this when it's back."; signed out: off, 07:00, disabled, "Sign in to change this."
- A server that answers no `day_email` leaves the row unknown and disabled.
- The Settings window grows by one row; no test pins its height.

**Gaps:** no UI test drives the row (the recorder captures it, ADR 0026); the 07:00 placeholder of the unknown state lives in `SettingsView` and is not read from the server's default; the picker's VoiceOver label is not asserted.
