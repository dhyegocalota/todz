# Test plan: Owner settings refresh

Every checkbox states the input and the exact expected outcome. A ticked box carries evidence after ` — evidence: `.

## The failing test first

- [ ] `AppModelTests+OwnerSettingsRefresh.swift` at the red commit — input: `swift test --filter OwnerSettingsRefresh` with the stub; expected: the read-value tests fail on their `#expect`, the no-call tests pass
- [ ] Confirmed it fails for the right reason: the run prints a value mismatch (for example `agentNudge → true == false`), not a build error

## Unit

- [ ] A confirmed owner whose server now says nudge off, day email off at 480 — input: `refreshOwnerSettings()`; expected: `agentNudge == false`, `dayEmail == false`, `dayEmailMinutes == 480`, one `readOwner` call, no `updateOwner`
- [ ] Signed out — expected: no call, values stay `nil`
- [ ] Owner not yet confirmed (launch held at `updateOwner`) — expected: no `readOwner`
- [ ] Two refreshes while the first read is held — expected: one `readOwner`
- [ ] A nudge save in flight when the read starts — expected: the nudge keeps the saved value; the day email takes the read
- [ ] A day-email save that starts while the read is held — expected: the day email keeps the saved values; the nudge takes the read
- [ ] The read fails unreachable — expected: every value unchanged, `agentNudgeNotice` and `dayEmailNotice` are not `.notSaved`
- [ ] The read answers unauthorized — expected: signed out with `.sessionEnded`
- [ ] Sign-out while the read is held — expected: values stay `nil` after the answer arrives

## The app (Mac walk, local Worker)

- [ ] Signed in on a local Worker with Settings open, the owner's nudge flipped through the owner API from a terminal, then todz activated (click its window) — expected: the "Let agents mention today's tasks" switch shows the new value without a restart
- [ ] Settings closed, day email flipped through the API, Settings reopened from the menu bar — expected: the "Email me my day" switch and time show the new values
- [ ] Toggle the nudge in Settings and immediately switch apps and back — expected: the switch keeps the value just chosen, and the server holds it
- [ ] Repeated activation (⌘Tab ten times) — expected: the Worker log shows at most one `GET /owner` per activation, none overlapping

## Edge cases found during execution

## Adversarial review

- [ ] Claim 1: a read never overwrites a save — attack: hold the read, save, release; result:
- [ ] Claim 2: no request while signed out — attack: sign out, activate the app, watch the Worker log; result:
- [ ] Claim 3: the refresh never changes the time zone — attack: change the Mac's time zone, activate; result:

## Coverage honesty

- The activation and Settings hooks are proven by the walk only; the app target has no unit tests.
