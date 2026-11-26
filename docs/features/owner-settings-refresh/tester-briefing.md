# Tester briefing: Owner settings refresh

Written by the developer sub-agent when its steps are done. The developer does not run `test-plan.md` and does not declare the feature works.

## What changed

- `apps/macos/TodzKit/Sources/TodzKit/AppModel+OwnerSettingsRefresh.swift` (new) — `refreshOwnerSettings()`: skipped while signed out, before the owner is confirmed, or while a read is in flight; reads with `readOwner` (`GET /owner`, never the time-zone `PATCH`) through `request`; takes `agentNudge`, `dayEmail` and `dayEmailMinutes` from the answer, except for a setting whose save was in flight when the read began or started during it; a failed read changes nothing and sets no notice of its own.
- `AppModel.swift` — `agentNudgeSavesStarted`, `dayEmailSavesStarted` and `isReadingOwnerSettings`.
- `AppModel+AgentNudge.swift`, `AppModel+DayEmail.swift` — each save increments its count when it starts.
- `apps/macos/Todz/AppDelegate.swift` — `applicationDidBecomeActive` starts the refresh in a `Task`.
- `apps/macos/Todz/Settings/SettingsView.swift` — `.task` runs the refresh when Settings appears.

## How to run

```bash
swift test --package-path apps/macos/TodzKit --filter OwnerSettingsRefresh
swift test --package-path apps/macos/TodzKit
xcodegen generate --spec apps/macos/project.yml
xcodebuild build -project apps/macos/Todz.xcodeproj -scheme Todz -configuration Debug -derivedDataPath apps/macos/build
```

Walk a scratch copy of `apps/macos/build/Build/Products/Debug/Todz.app` (it points at `http://localhost:8787`), never `/Applications/Todz.app`. Local Worker, as in the `connect-an-agent` briefing:

```bash
cd apps/api
pnpm exec wrangler d1 migrations apply directory --local --persist-to <state>
pnpm exec wrangler dev --var SIGN_IN_PROVIDER:fake --persist-to <state> --port 8787
```

Sign in to the app with a fictional identity, and read the owner's session token for the API calls by signing in once more from a terminal:

```bash
curl -s -X POST http://localhost:8787/owner/sessions -H 'Content-Type: application/json' -d '{"identity_token":"<same identity>","time_zone":"UTC"}'
curl -s -X PATCH http://localhost:8787/owner -H 'Content-Type: application/json' -H 'Authorization: Bearer <session_token>' -d '{"agent_nudge":false}'
curl -s -X PATCH http://localhost:8787/owner -H 'Content-Type: application/json' -H 'Authorization: Bearer <session_token>' -d '{"day_email":false,"day_email_minutes":480}'
curl -s http://localhost:8787/owner -H 'Authorization: Bearer <session_token>'
```

The Worker log shows each `GET /owner` the refresh makes.

## Red today, green after

Red text as the run printed it on cb201781 (`swift test --filter OwnerSettingsRefresh`, stub reads and discards the answer): 6 of 9 tests red, 3 pins.

| Test | Red before the change because | Green after because |
|------|--------------------------------|---------------------|
| `refreshingTheOwnerSettingsTakesAllThreeValuesFromTheRead` | `Expectation failed: harness.model.agentNudge == false`, `↳ harness.model.agentNudge → true`; the same for `dayEmail` and `dayEmailMinutes` | 22d3a4ff: the three values come from the read |
| `refreshingTheOwnerSettingsBeforeTheOwnerIsConfirmedReadsNothing` | `Expectation failed: harness.service.routes().contains(.readOwner) == false` | 22d3a4ff: the guard on `isOwnerConfirmed` |
| `aSecondRefreshWhileTheFirstReadIsHeldMakesNoSecondRead` | `Expectation failed: readOwnerCount(harness) == 1` | 22d3a4ff: `isReadingOwnerSettings` |
| `aNudgeSaveInFlightWhenTheReadStartsKeepsTheSavedValue` | `Expectation failed: harness.model.dayEmail == false` and `dayEmailMinutes == readMinutes` (the nudge line passed with the stub) | 22d3a4ff |
| `aDayEmailSaveThatStartsWhileTheReadIsHeldKeepsTheSavedValues` | `Expectation failed: harness.model.agentNudge == false` (the day email lines passed with the stub) | 22d3a4ff |
| `refreshingTheOwnerSettingsSignedOutMakesNoCall`, `aReadThatCannotReachTodzKeepsEveryValueAndShowsNoNotSavedNotice`, `anUnauthorizedReadEndsTheSession`, `aReadAnsweredAfterASignOutIsDropped` | pin: green on landing, because the stub's own `request` call already ends the session, drops a stale answer, and applies nothing | still green |

The first red attempt, with a stub that did nothing, hung forever in `service.held(.readOwner)`; the stub therefore performs the read and discards it.

Full suite on 22d3a4ff: 1310 tests in 102 suites passed. App build on 76cb966d: `** BUILD SUCCEEDED **`.

## Hypotheses to attack

1. Hypothesis: with Settings open, flipping the nudge through the API and clicking back into todz shows the new value on the switch. Break it by: flipping it twice quickly; flipping while another app is frontmost.
2. Hypothesis: Settings opened after the day email was flipped through the API shows the new switch and time at once. Break it by: opening Settings from the menu bar, from ⌘, and from the popover.
3. Hypothesis: a toggle followed at once by switching apps and back keeps the chosen value. Break it by: a slow server (stop the Worker for a second after the click), then activate.
4. Hypothesis: activation never sends the time-zone `PATCH` and never sends a request while signed out. Break it by: the Worker log across activations, a sign-out, and a change of the Mac's time zone.
5. Hypothesis: activation and Settings appearing together make one `GET /owner`. Break it by: activating through a click on the Settings window.
6. Hypothesis: with the Worker stopped, activating shows no "not saved" notice and the switches keep their values. Break it by: stopping the Worker with Settings open, then activating; the offline subtitle is the existing offline state, not a new one.
7. Hypothesis: an expired session found by the refresh signs the app out like any other request. Break it by: revoking the session on the server, then activating.

## Known gaps

- The activation and Settings hooks have no unit test (the app target has none); only the build proves they compile.
- A failed read still marks the app offline through `request`, as every request does; the spec's "no new notice" is read as no `notSaved` notice.
- A read that began in an old session keeps `isReadingOwnerSettings` set until its answer arrives, so a refresh in a new session started in that window is skipped.
- Not run in the app by the developer.
