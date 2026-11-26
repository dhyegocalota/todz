# Test plan: Owner settings refresh

Every checkbox states the input and the exact expected outcome. A ticked box carries evidence after ` — evidence: `.

## The failing test first

- [x] `AppModelTests+OwnerSettingsRefresh.swift` at the red commit — input: `swift test --filter OwnerSettingsRefresh` with the stub; expected: the read-value tests fail on their `#expect`, the no-call tests pass — evidence: throwaway worktree at cb201781, 9 tests, 5 failed (8 issues), the 4 pins passed; worktree removed
- [x] Confirmed it fails for the right reason: the run prints a value mismatch (for example `agentNudge → true == false`), not a build error — evidence: cb201781 run printed `Expectation failed: harness.model.agentNudge == false`, `dayEmail == false`, `dayEmailMinutes == readMinutes`, `routes().contains(.readOwner) == false`, `readOwnerCount(harness) == 1`; no compile error. The 6e020082 red (held read of an ended session) was not re-run, no time at this lighter gate

## Unit

- [x] A confirmed owner whose server now says nudge off, day email off at 480 — input: `refreshOwnerSettings()`; expected: `agentNudge == false`, `dayEmail == false`, `dayEmailMinutes == 480`, one `readOwner` call, no `updateOwner` — evidence: `swift test --package-path apps/macos/TodzKit` on b90b4be3: 1314 tests in 102 suites passed (`refreshingTheOwnerSettingsTakesAllThreeValuesFromTheRead`)
- [x] Signed out — expected: no call, values stay `nil` — evidence: same full run (`refreshingTheOwnerSettingsSignedOutMakesNoCall`)
- [x] Owner not yet confirmed (launch held at `updateOwner`) — expected: no `readOwner` — evidence: same full run (`...BeforeTheOwnerIsConfirmedReadsNothing`); red on cb201781
- [x] Two refreshes while the first read is held — expected: one `readOwner` — evidence: same full run (`aSecondRefreshWhileTheFirstReadIsHeldMakesNoSecondRead`); red on cb201781
- [x] A nudge save in flight when the read starts — expected: the nudge keeps the saved value; the day email takes the read — evidence: same full run (`aNudgeSaveInFlightWhenTheReadStartsKeepsTheSavedValue`); red on cb201781
- [x] A day-email save that starts while the read is held — expected: the day email keeps the saved values; the nudge takes the read — evidence: same full run (`aDayEmailSaveThatStartsWhileTheReadIsHeldKeepsTheSavedValues`); red on cb201781
- [x] The read fails unreachable — expected: every value unchanged, `agentNudgeNotice` and `dayEmailNotice` are not `.notSaved` — evidence: same full run (`aReadThatCannotReachTodzKeepsEveryValueAndShowsNoNotSavedNotice`); walk: Worker killed, activation left the switches as they were with the existing "Can't reach todz" subtitle, no "not saved"
- [x] The read answers unauthorized — expected: signed out with `.sessionEnded` — evidence: same full run (`anUnauthorizedReadEndsTheSession`); walk: sessions deleted in the local directory, activation logged `GET /owner 401` and the app showed "Your session has ended. Sign in again."
- [x] Sign-out while the read is held — expected: values stay `nil` after the answer arrives — evidence: same full run (`aReadAnsweredAfterASignOutIsDropped`)

## The app (Mac walk, local Worker)

- [x] Signed in on a local Worker with Settings open, the owner's nudge flipped through the owner API from a terminal, then todz activated (click its window) — expected: the "Let agents mention today's tasks" switch shows the new value without a restart — evidence: Debug app, local Worker; switch read 1, `PATCH agent_nudge:false`, app hidden then reactivated (not a window click), switch read 0
- [x] Settings closed, day email flipped through the API, Settings reopened from the menu bar — expected: the "Email me my day" switch and time show the new values — evidence: day email off at 480 through the API, Settings reopened with ⌘, (not the menu bar item): switch off, time 08:00 in the screenshot
- [x] Toggle the nudge in Settings and immediately switch apps and back — expected: the switch keeps the value just chosen, and the server holds it — evidence: switch clicked on, app hidden and reactivated at once; switch read 1 and `GET /owner` returned `agent_nudge:true`
- [x] Repeated activation (⌘Tab ten times) — expected: the Worker log shows at most one `GET /owner` per activation, none overlapping — evidence: 10 hide-and-reopen cycles (not ⌘Tab), a second apart: 10 `GET /owner 200`, 3 to 5 ms each, no `PATCH`, no `/health`

## Edge cases found during execution

- Closing Settings while the `GET /owner` is pending (Worker process stopped with SIGSTOP, Settings opened and closed with ⌘W, Worker resumed, Settings reopened): every switch enabled, no offline subtitle, values kept. Outcome: passes
- Settings opened and an activation each make one read (Settings reopen 1 read, each activation 1 read; no duplicate observed in the Worker log). Outcome: passes
- Session revoked server-side, then activated: `GET /owner 401`, then the sign-in screen with "Your session has ended." Outcome: passes
- Not walked: flipping twice quickly, flipping while another app is frontmost, the menu bar item and popover entry points to Settings, the slow-server toggle race with the Worker stopped after the click, a Mac time-zone change

## Adversarial review

- [x] Claim 1: a read never overwrites a save — attack: hold the read, save, release; result: held by the unit tests (`aNudgeSaveInFlight...`, `aDayEmailSaveThatStarts...`, the two finishing-during-the-read pins), green on b90b4be3; the walk's toggle-then-switch-apps kept the chosen value; a held read against the live Worker was not driven
- [x] Claim 2: no request while signed out — attack: sign out, activate the app, watch the Worker log; result: signed out through a revoked session, 3 activations: no new line in the Worker log
- [ ] Claim 3: the refresh never changes the time zone — attack: change the Mac's time zone, activate; result: BLOCKED: the Mac's time zone is the owner's and was not changed; the 10 activations and the reopen logged no `PATCH /owner` and no `/health`

## Coverage honesty

- The activation and Settings hooks are proven by the walk only; the app target has no unit tests.
