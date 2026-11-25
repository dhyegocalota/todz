# Tester briefing: Agent nudge

Written by the developer sub-agents when their steps are done. The developers do not run `test-plan.md` and do not declare the feature works.

## Server

Lane G1, branch `lane/agent-nudge-g1`. Everything below is a hypothesis for the tester to break.

### What changed

- `libs/core/src/due-now.ts` — `dueNow({ store, today })` returns `{ count, overdue }` from `dueWindowOf` over the open tasks; exported from `libs/core/src/index.ts`.
- `apps/api/migrations/0007_agent_nudge.sql` — `owners.agent_nudge INTEGER NOT NULL DEFAULT 0 CHECK (agent_nudge IN (0, 1))`.
- `apps/api/src/directory-owners.ts` — `storeOwnerChanges` (one `UPDATE … COALESCE … RETURNING`, replaces `updateOwnerTimeZone`), `findOwner` reads the flag; `owner-records.ts` and `owner-json.ts` carry `agentNudge` / `agent_nudge`.
- `apps/api/src/owner-account.ts` — `PATCH /owner` takes `{time_zone?, agent_nudge?}`, at least one, non-strict; an invalid zone is 422 `time_zone_invalid` even with a valid flag.
- `apps/api/src/owner-sign-in.ts` — sign-in answers the stored flag through `RETURNING`.
- `apps/api/src/directory.ts`, `project-routing.ts` — `findKeyProject` joins the flag; `KeyProject.agentNudge`.
- `apps/api/src/project-store.ts` — `dueNow({ today })` RPC beside `nextTask`.
- `apps/api/src/mcp-server.ts`, `mcp-format.ts`, `mcp-copy.ts`, `mcp-endpoint.ts` — both eras' scopes carry the flag; the `next` tool and prompt prepend `nudgeLine` plus a blank line only when the flag is on and `count > 0`; a `dueNow` that throws or answers `{ok: false}` leaves `next` as before. No acronyms or defaults added.

### How to run

```bash
pnpm --filter @todz/core test
cd apps/api && pnpm exec vitest run
pnpm typecheck
pnpm verify
```

Local server with an owner whose flag is on (the app is not needed):

```bash
cd apps/api
pnpm exec wrangler d1 migrations apply DIRECTORY --local
pnpm exec wrangler dev
```

Sign in as a fake-provider owner (the dev provider is `SIGN_IN_PROVIDER=fake`, set in `wrangler.jsonc`/`.dev.vars` as the existing sign-in tests do), then turn the flag on:

```bash
curl -s -X POST http://localhost:8787/owner/sessions -H 'Content-Type: application/json' -d '{"identity_token":"maria","time_zone":"UTC"}'
curl -s -X PATCH http://localhost:8787/owner -H 'Content-Type: application/json' -H 'Authorization: Bearer <session_token>' -d '{"agent_nudge":true}'
```

Expected: `{"owner":{"id":"…","time_zone":"UTC","agent_nudge":true}}`. Then create a workspace and a key (`POST /owner/workspaces`, `POST /owner/projects/<id>/keys`), add three tasks due today and yesterday, and reach the MCP endpoint from Claude Code:

```bash
claude mcp add --transport http todz-local http://localhost:8787/mcp --header "Authorization: Bearer <project key>"
```

Then ask the session to call `next` (or run the `next` prompt). When Claude Code cannot reach the local server, use the MCP SDK client the way `apps/api/test/mcp-client.ts` does.

### Red today, green after

| Test | Red before the change because | Green after because |
|------|--------------------------------|---------------------|
| `libs/core/src/due-now.test.ts` (5 tests, commit `edbacea`) | printed `Error: dueNow is not implemented` on all 5 | `dueNow` counts the open tasks whose window is Overdue or Today (`7f04fad`) |
| `apps/api/test/owner-sign-in.test.ts`, `directory.test.ts`, `owner-json.test.ts`, `project-routing.test.ts` (commit `2e5e0e8`, 26 red) | `D1_ERROR: no such column: agent_nudge`; `AssertionError: expected { …(2) } to deeply equal { …(3) }` (no `agent_nudge` in the answer); `expected 400 to be 200` for `PATCH {agent_nudge: true}`; `expected [Function] to throw error including 'CHECK constraint failed' but got 'D1_ERROR: no such column: agent_nudge…'` | migration 0007, the flag in every `owner` object, the partial PATCH, `findKeyProject` (`8473453`) |
| `apps/api/test/mcp-format.test.ts` nudge line (commit `c709d2f`, 7 red) | `Error: nudgeLine is not implemented`, `Error: nudgedText is not implemented` | `nudgeLine` and `nudgedText` (`d838961`) |
| `apps/api/test/mcp-nudge.test.ts`, `mcp-isolation.test.ts` flag-on tests (commit `c709d2f`, 12 red) | `AssertionError: expected 'T-1 Task 1 · due 2026-11-25' to be 'Today here: 1 due. Start with T-1?\n\n…'` (the line is missing); likewise for the overdue forms, the isolation probe and the title probe | the `next` tool and prompt prepend the line (`d838961`) |

Pins (green when they landed, never red-first): in `mcp-nudge.test.ts` the flag off with a task due today, the flag on with only upcoming and undated tasks, the flag on with no tasks, `list`/`add`/`update`/`done` carrying no line, and both `dueNow` failure cases (throws, `{ok: false}`); in `mcp-format.test.ts` nothing else. The failure cases pass at the red commit only because the line did not exist yet; they guard the green code.

Counts at `d838961`: `libs/core` 258 tests (Vitest); `apps/api` 1665 tests in 64 files; `pnpm verify`: 8 gates green at `d838961` (product), e2e 46 passed, 2 skipped.

### Hypotheses to attack

1. Hypothesis: with the flag off, every `next` text (tool and prompt, both eras) is byte for byte what it was. Break it by: running the old `mcp-tools.test.ts` pins against a flag-on owner with nothing due, and a flag-off owner with tasks due.
2. Hypothesis: the line never names a title and never crosses a project. Break it by: a task titled with an instruction or a `T-99` string in project B due today, and a key of project A; read the whole first line.
3. Hypothesis: `PATCH /owner` with `{time_zone}` alone never changes the flag and `{agent_nudge}` alone never changes the zone, and sign-in does not reset the flag. Break it by: alternating the two bodies and signing in again with a different zone, reading `GET /owner` each time.
4. Hypothesis: `PATCH {}`, `{agent_nudge: "yes"}`, `1` and `null` answer 400 and store nothing; `{time_zone: "Mars/Base", agent_nudge: true}` answers 422 and stores nothing. Break it by: reading the row after each.
5. Hypothesis: the line's task is the task `next` shows. Break it by: adding tasks between the two project calls, or many overdue tasks with equal due dates.
6. Hypothesis: the timezone of the owner decides what is due today for the count too. Break it by: an owner in `Pacific/Kiritimati` and a task due on the UTC date.

### Known gaps

- `dueNow` and `nextTask` are two RPCs, so a task completed between them can name a task that is no longer due; the answer still shows the same task the line names.
- The `ProjectStore.dueNow` RPC has no direct test beside `project-store.test.ts`; it is covered through the MCP tests in `mcp-nudge.test.ts`.
- A real Claude Code walk was not run (the tester does it).
- READMEs, the runbook row for migration 0007 and screenshots are lane G3's.

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
