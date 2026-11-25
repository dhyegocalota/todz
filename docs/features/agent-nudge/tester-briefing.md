# Tester briefing: Agent nudge

Written by the developer sub-agent when its steps are done. The developer does not run `test-plan.md` and does not declare the feature works.

## What changed

- <file or module> — <one line>

## How to run

```bash
<commands to start the stack and open the feature>
```

## Red today, green after

| Test | Red before the change because | Green after because |
|------|--------------------------------|---------------------|
| `<path>::<name>` |  |  |

## Hypotheses to attack

Every "it works" is a hypothesis the tester tries to break.

1. Hypothesis: <claim>. Break it by: <suggested attack>.

## Known gaps

- <what the developer knows is missing or untested>

## App

Written by lane G2 (Steps 8–11). Commits: 384cae5 (red), 8580e94 (green, TodzKit), 5835713 (Settings).

### What changed

- `TodzKit/Sources/TodzKit/OwnerModels.swift` — `Owner.agentNudge: Bool?`, decoded from `agent_nudge` when present; absent means unknown.
- `TodzKit/Sources/TodzKit/OwnerAPI.swift`, `AgentNudgeBody.swift` — `updateAgentNudge(session:isEnabled:)` sends `PATCH /owner` with only `{"agent_nudge": <bool>}`; the time-zone `updateOwner` is untouched.
- `TodzKit/Sources/TodzKit/AppModel.swift` — the flag is learned in `openSession` (the sign-in answer) and in `confirmOwner` (the time-zone answer, or `readOwner` on a refused zone); sign-out and an ended session forget it.
- `TodzKit/Sources/TodzKit/AppModel+AgentNudge.swift`, `AgentNudgeNotice.swift` — `canChangeAgentNudge` (known, owner confirmed, online, no save in flight), `agentNudgeNotice` (signed out, then a failed save, then offline, else the detail), `changeAgentNudge(isEnabled:)` (optimistic, one write in flight, reverts and marks the failure, drops an answer that arrives after the session changed), `forgetAgentNudgeFailure()`.
- `Copy/SettingsCopy.swift` — the four strings of `design.md` § 8 and the subtitle per notice; the failure reuses `ErrorCopy.changeNotSaved`.
- `Todz/Settings/SettingsView.swift`, `Todz/TodzApp.swift` — the second `.switch` toggle in the same grouped form, disabled when it cannot change, the subtitle swapped in place, an announcement on a failed save, the failure forgotten when the window disappears; the Settings scene receives the model.

### How to run

```bash
swift test --package-path apps/macos/TodzKit
swift test --package-path apps/macos/TodzKit --filter AgentNudge
```

675 tests green after (658 before, all green). The app builds with the `macos` gate's lines (`xcodegen generate --spec apps/macos/project.yml`, then `xcodebuild build … -configuration Debug -derivedDataPath apps/macos/build`): `** BUILD SUCCEEDED **`. The app was not launched.

The Debug app already points at `http://localhost:8787` (`TODZ_API_BASE_URL` in `project.yml`). Start lane G1's server there with migration 0007 applied (G1's Server section has the commands; the `connect-an-agent` briefing has the same `wrangler d1 migrations apply … --local --persist-to <state>` and `wrangler dev --var SIGN_IN_PROVIDER:fake --persist-to <state> --port 8787` pair), then `open -g -j apps/macos/build/Build/Products/Debug/Todz.app`, sign in with a fictional identity (`maria-1`) and open Settings with ⌘,. A fresh read of the stored flag: `curl -s http://localhost:8787/owner -H 'Authorization: Bearer <session>'`. A 503 for the failed-save state needs a proxy in front of 8787, or stop the server between the window's last answer and the flip (that gives the unreachable path instead).

### Red today, green after

Each run alone with `swift test --filter <Suite>/<test>` at 384cae5.

| Test | Red at 384cae5 because (printed) | Green after because |
|------|----------------------------------|---------------------|
| `OwnerAPITests/readOwnerDecodesTheAgentNudge` | `Expectation failed: owner.agentNudge == true` (the key was not decoded) | `agentNudge` joins `CodingKeys` |
| `OwnerAPITests/readOwnerOfAServerWithoutTheAgentNudgeLeavesItUnknown` | pin: passed at red | an absent field still decodes as `nil` |
| `OwnerAPITests/updateAgentNudgePatchesOnlyTheAgentNudge` | `OwnerAPI.swift:102: Fatal error: updateAgentNudge is not implemented` | the PATCH with `AgentNudgeBody` |
| `AppModelTests/signedOutTheAgentNudgeIsUnknownAndCannotBeChanged` | `AppModel+AgentNudge.swift:3: Fatal error: canChangeAgentNudge is not implemented` | `canChangeAgentNudge`, `agentNudgeNotice` |
| `AppModelTests/beforeTheOwnerIsConfirmedTheAgentNudgeIsUnknownAndCannotBeChanged` | `AppModel+AgentNudge.swift:3: Fatal error: canChangeAgentNudge is not implemented` | as above, and `confirmOwner` stores the flag |
| `AppModelTests/aSignInReadsTheAgentNudgeOfTheIssuedOwner` | `Expectation failed: harness.model.agentNudge == true`, then `Fatal error: canChangeAgentNudge is not implemented` | `openSession` stores `issued.owner.agentNudge` |
| `AppModelTests/confirmingTheOwnerReadsTheAgentNudgeFromTheTimeZoneAnswer` | `Expectation failed: harness.model.agentNudge == true`, then `Fatal error: canChangeAgentNudge is not implemented` | `confirmOwner` stores the answer's flag |
| `AppModelTests/confirmingTheOwnerByReadingItReadsTheAgentNudge` | `Expectation failed: harness.model.agentNudge == true`, then `Fatal error: canChangeAgentNudge is not implemented` | the `readOwner` fallback goes through the same line |
| `AppModelTests/aLaunchThatCannotReachTodzLeavesTheAgentNudgeUnknownAndSaysSo` | `AppModel+AgentNudge.swift:3: Fatal error: canChangeAgentNudge is not implemented` | unknown, disabled, offline notice |
| `AppModelTests/turningTheAgentNudgeOnSavesItOnceAndHoldsTheAnswer` | `AppModel+AgentNudge.swift:11: Fatal error: changeAgentNudge is not implemented` | `changeAgentNudge` |
| `AppModelTests/whileASaveIsHeldTheAgentNudgeShowsTheNewValueAndASecondChangeMakesNoCall` | `AppModel+AgentNudge.swift:11: Fatal error: changeAgentNudge is not implemented` | the in-flight flag closes the guard |
| `AppModelTests/aFailedSaveRevertsTheAgentNudgeAndSaysSo` (invalid request, 503, unreachable) | `AppModel+AgentNudge.swift:11: Fatal error: changeAgentNudge is not implemented` | revert and `notSaved` |
| `AppModelTests/aRefusedSaveCanBeTriedAgainAndTheNextChangeForgetsTheFailure` | `AppModel+AgentNudge.swift:11: Fatal error: changeAgentNudge is not implemented` | a refusal keeps the app online; the next flip clears the failure |
| `AppModelTests/forgettingTheFailedSaveShowsTheDetailAgain` | `AppModel+AgentNudge.swift:11: Fatal error: changeAgentNudge is not implemented` | `forgetAgentNudgeFailure` |
| `AppModelTests/offlineTheAgentNudgeKeepsItsLastValueAndCannotBeChanged` | `Expectation failed: harness.model.agentNudge == true`, then `Fatal error: canChangeAgentNudge is not implemented` | last value kept, disabled, no call |
| `AppModelTests/aSignOutClearsTheAgentNudge` | `AppModel+AgentNudge.swift:3: Fatal error: canChangeAgentNudge is not implemented` | `clearSession` forgets the flag |
| `AppModelTests/aSaveAnsweredAfterASignOutIsDropped` | `AppModel+AgentNudge.swift:11: Fatal error: changeAgentNudge is not implemented` | the catch returns when the session changed |

`aLaunchThatCannotReachTodzLeavesTheAgentNudgeUnknownAndSaysSo` gained `failures[.listWorkspaces] = .unreachable` in the green commit: with only the owner update failing, the listing answered and the app was not offline, which was the fixture's fault, not the code's.

### States the tester should see (all hypotheses)

1. Hypothesis: signed out, Settings shows the second switch off and dimmed, subtitle `Sign in to change this.`. Break it by: signing out with Settings open.
2. Hypothesis: right after launch with a stored session and before the owner is confirmed, the switch is off and dimmed with the detail line. Break it by: launching with `wrangler dev` slow or paused, then opening Settings at once.
3. Hypothesis: confirmed and online, the switch shows the server's value and is enabled, subtitle `When an agent asks what's next, it hears what's due today in its project.`. Break it by: setting the flag with `curl -X PATCH /owner -d '{"agent_nudge":true}'`, relaunching, and comparing.
4. Hypothesis: flipping it moves the switch at once, dims it until the answer, then a fresh `GET /owner` agrees. Break it by: double-clicking fast; expect one PATCH in the server log.
5. Hypothesis: a refused save (an older server's 400) puts the switch back, keeps it enabled, and the subtitle reads `Your change wasn't saved.`; VoiceOver hears it. Break it by: running a server without migration 0007's code (main) and flipping.
6. Hypothesis: a 503 or an unreachable server during the save puts the switch back with `Your change wasn't saved.`, and the switch stays dimmed until the app hears the server again (the app is offline). Break it by: a 503 proxy, then restoring the server and pressing ⌘R.
7. Hypothesis: offline with a value seen, the switch keeps that value, dimmed, subtitle `Can't reach todz. You can change this when it's back.`; offline with no value since launch, off and dimmed with the same subtitle. Break it by: stopping the server before and after launch.
8. Hypothesis: closing and reopening Settings after a failure shows the detail line again. Break it by: ⌘W then ⌘,.
9. Hypothesis: the value is not kept across sign-out; signing back in reads the server's. Break it by: turning it on, signing out, signing in.
10. Hypothesis: an older server whose owner answers lack `agent_nudge` still signs in; the switch then stays dimmed with the detail line. Break it by: signing in against `main`'s server.
11. Hypothesis: the window keeps 420 wide and its height does not jump when the subtitle swaps. Break it by: watching the window through states 3, 5 and 7.

### Known gaps

- The view has no test target; `SettingsView`'s binding, `.disabled`, the announcement and `onDisappear` are proven only by the build and the walk.
- After a 503 or unreachable save the subtitle says the change was not saved, but the switch is dimmed because the app went offline, and the offline subtitle is hidden behind the failure until the next flip or the window closes. `design.md` lists the failed save as enabled; this is the app-wide offline rule winning. The lead may want the order changed.
- Against a server whose PATCH answer has no `agent_nudge`, a successful save leaves the value unknown (dimmed) until the next confirmation; G1's contract always answers the field.
- The switch's optimistic value is set when the `Task` the binding starts runs, one main-actor turn after the click; a frame of the old value may show.
- Whether the grouped form reads the subtitle to VoiceOver is unverified, as with the menu bar count switch.
