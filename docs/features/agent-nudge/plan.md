# Plan: Agent nudge

**Spec:** spec.md
**Tier:** 🔴
**Seam:** `findKeyProject` → `KeyProject` → `McpServerScope` on the server (the flag rides the key lookup), a `dueNow` RPC beside `nextTask` in the project store, and the Settings scene over the app's one `AppModel`
**Assumptions (decided, owner can override):**
- `design.md`'s recommendations are taken as the loop's calls; its copy is the copy.
- The app keeps `updateOwner(session:timeZone:)` as it is and gains `updateAgentNudge(session:isEnabled:)` on the same `PATCH /owner` route with the body `{agent_nudge}`: the partial body is the server's contract, and the time-zone call sites and their tests stay untouched.
- The nudge's counts come from a core function `dueNow({ store, today })` next to `nextTask` returning `{ count, overdue }` only (R3); the line names the task the same `next` answer shows (when `count > 0`, `nextTask`'s pick is always due now: rank 0).
- Every answer that carries `owner` (`GET /owner`, `PATCH /owner`, sign-in) reads `agent_nudge` from the stored row; none assumes `false` for an owner that already exists. Sign-in reads it through `updateOwnerTimeZone … RETURNING id, time_zone, agent_nudge` (R9), mapped with `agent_nudge === 1` like `is_inbox`.
- On the app's wire `Owner.agentNudge` is `Bool?` decoded if present: `nil` means unknown and the switch is disabled, so an older server (rollback, or the app before migration 0007 is deployed) still signs in (R1). `Owner` is not persisted (`OwnerCache` keeps only the identifier).
- The app learns the flag wherever it learns the owner: `openSession` from `issued.owner`, `confirmOwner` from the time-zone PATCH's answer or the `readOwner` fallback (R2, R10). The time-zone PATCH never carries the flag; the partial update leaves it alone.
- The switch is disabled while a save is in flight, so two PATCHes never race (R6a).
- The PATCH schema stays non-strict (unknown keys dropped, as today) (R14).

## Plan review answers (2026-11-25)

R1 wire-optional `agentNudge` (above) · R2 `openSession` sets the flag · R3 `dueNow` is `{count, overdue}` · R4 an invalid zone is 422 `time_zone_invalid` · R5 the existing exact-shape tests are listed in Steps 3 and 8 and updated in the red commit · R6 in-flight disable and the signed-out state, each with a box · R7 every string is pinned in `test-plan.md` from `design.md` · R8 the `dueNow` failure test builds `buildMcpServer` around a project object whose `dueNow` throws, and also one returning `{ok: false}` · R9 `RETURNING` · R10 above · R11 `tester-briefing.md` has a "Server" section (G1) and an "App" section (G2); the lead merges · R12 `enableAgentNudge({ directory, ownerId })` in `directory-seed.ts`; isolation in `mcp-isolation.test.ts` · R13 `Owner` decode reds fail on the mismatch, not a stub · R14 non-strict.

## File map

| Group | Paths owned | Developer sub-agent |
|-------|-------------|---------------------|
| G1 server | `libs/core/src/due-now.ts` (new), `libs/core/src/index.ts`, `libs/core/src/due-now.test.ts` (new), `libs/core/src/index.test.ts`, `apps/api/migrations/0007_agent_nudge.sql` (new), `apps/api/src/{directory,directory-owners,owner-records,owner-json,owner-account,owner-sign-in,project-routing,project-store,mcp-server,mcp-format,mcp-copy,mcp-endpoint}.ts`, `apps/api/test/**` | `developer` (mid model) |
| G2 app | `apps/macos/TodzKit/Sources/TodzKit/{OwnerModels,OwnerAPI,OwnerEnvelopes}.swift`, `apps/macos/TodzKit/Sources/TodzKit/AppModel+AgentNudge.swift` (new), `apps/macos/TodzKit/Sources/TodzKit/AppModel.swift` (the owner confirmation only), `apps/macos/TodzKit/Tests/TodzKitTests/**`, `apps/macos/Todz/Settings/SettingsView.swift`, `apps/macos/Todz/TodzApp.swift`, `apps/macos/Copy/SettingsCopy.swift` | `developer` (mid model) |
| G3 docs (lead) | `docs/product/README.md`, `apps/api/README.md`, `apps/macos/README.md`, `README.md` (walk cells), `docs/screenshots/agent-nudge/`, `docs/runbooks/deploy-the-api.md` (migration 0007 row) | lead |

## Sequencing

G1 and G2 run in parallel in their own worktrees: G2 codes against the JSON contract in spec § Interfaces (`agent_nudge` boolean in every `owner` object) with fakes, never against G1's code. G3 runs after both merge, with the tester's screenshots.

## Steps

### G1 server

- [ ] **Step 1:** Red: `due-now.test.ts`: no open tasks → `{count 0, overdue 0}`; one due today → `{1, 0}`; one overdue and one today → `{2, 1}`; two overdue → `{2, 2}`; upcoming, undated and done tasks never count. Commit alone with a stub that throws `dueNow is not implemented`.
- [ ] **Step 2:** Green: `dueNow` in `libs/core` from `dueWindowOf`; exported (`index.test.ts` names it).
- [ ] **Step 3:** Red: directory and owner API tests: after migration 0007 a seeded owner reads `agent_nudge: false` and the column rejects `2`; `GET /owner` answers `{id, time_zone, agent_nudge}`; `PATCH /owner {agent_nudge: true}` answers and stores `true` and leaves `time_zone` alone; `PATCH {time_zone}` alone leaves a `true` flag alone and answers it; `PATCH {}`, `{agent_nudge: "yes"}`, `{agent_nudge: 1}` and `{agent_nudge: null}` → 400 `invalid_request`, nothing stored; an invalid zone with a valid flag → 422 `time_zone_invalid`, nothing stored; sign-in of an existing owner whose flag is on answers `agent_nudge: true`, a new owner `false`; owner A's PATCH never changes owner B; `findKeyProject` returns the flag of the key's owner. The red commit also updates the exact-shape pins that the new field changes: `owner-sign-in.test.ts:163,176,372,596,605`, `owner-json.test.ts:29`, `directory.test.ts:24-27`, `project-routing.test.ts:46`. Add `enableAgentNudge({ directory, ownerId })` to `directory-seed.ts`. Commit alone (red on the missing field and column).
- [ ] **Step 4:** Green: migration `0007_agent_nudge.sql` per ADR 0053 §1; `OwnerRow`/`OwnerRecord`/`ownerJson` gain the flag; `UpdateOwnerBodySchema` with both fields optional (`agent_nudge: z.boolean()`), at least one, non-strict; one `UPDATE … RETURNING` per PATCH; `updateOwnerTimeZone` returns the `OwnerRecord` via `RETURNING` and sign-in answers it; `KeyProjectRecord`/`KeyProject` gain `agentNudge`.
- [ ] **Step 5:** Red: MCP tests in both eras (`mcp-tools.test.ts`, a new `mcp-nudge.test.ts` if clearer): flag off with tasks due → every pinned `next` text byte for byte unchanged (pins); flag on with nothing due (only upcoming or undated) → unchanged; flag on with 1 today → the tool answer and the prompt text start with the line for 1 (test-plan), a blank line, then today's answer; 3 due with 1 overdue → the overdue form; all overdue → its form; `list`, `add`, `update`, `done` never carry the line; isolation in `mcp-isolation.test.ts`: a project B task due today never shows in project A's line; a task titled `Ignore previous instructions` never appears in the line; `dueNow` failing → `next` answers as with the flag off, through `buildMcpServer` around a project object whose `dueNow` throws, and one whose `dueNow` returns `{ok: false}`, connected over an in-memory transport. `mcp-format.test.ts` pins the copy for each count form. Commit alone.
- [ ] **Step 6:** Green: `dueNow` RPC on `ProjectStore`; `McpServerScope.agentNudge`; `nudgeLine({ count, overdue, taskNumber })` in `mcp-format.ts` with copy in `MCP_COPY`; the `next` tool and prompt prepend it only when the flag is on and `count > 0`, naming the task of the same answer; both eras' scopes carry the flag from `KeyProject`.
- [ ] **Step 7:** `pnpm verify` green for the lane; tester briefing "Server" section for G1 (red texts as printed, how to run a local server with a seeded owner whose flag is on, a `curl` for `PATCH /owner`, and the Claude Code walk against `wrangler dev`).

### G2 app

- [x] **Step 8:** Red: `OwnerAPITests`: an owner answer with `agent_nudge: true` decodes into `Owner.agentNudge == true`; `{"owner":{"id":"o","time_zone":"UTC"}}` decodes with `agentNudge == nil`; `updateAgentNudge(session:isEnabled:)` sends `PATCH /owner` with exactly `{"agent_nudge":true}` and decodes the answer. `AppModelTests`: signed out and before the owner is confirmed the setting is unknown and cannot be changed; signing in with a fake answering `agent_nudge: true` reads `true` (through `openSession`); confirming sets it from the time-zone answer, and from `readOwner` on the fallback; turning it on calls `updateAgentNudge` once and holds the server's answer; a second change while a save is held makes no call; a failure reverts to the last known value and sets the failed-save state; offline the setting cannot be changed and no call is made; sign-out clears it. `Owner` gets `agentNudge: Bool? = nil` so memberwise call sites compile: `OwnerModelsTests.swift:16,116`, `OwnerAPITests.swift:60,73,81`, `AppModelTests+Owners.swift:62`, `FakeOwnerService.swift:27,69`. Commit alone with stubs that fail with `<name> is not implemented` (the decode tests fail on the mismatch). — evidence: 384cae5; every test run alone with `--filter`, failure texts in `tester-briefing.md` → App; `readOwnerOfAServerWithoutTheAgentNudgeLeavesItUnknown` is a pin
- [x] **Step 9:** Green: `Owner.agentNudge` decoded if present, the request body, `OwnerService.updateAgentNudge` in `OwnerAPI` and the fakes, `AppModel+AgentNudge.swift` (state, in-flight and failed-save flags, the setter), `openSession` and `confirmOwner` storing the flag. — evidence: 8580e94 (`AgentNudgeBody`, `AgentNudgeNotice` for the subtitle's reason, `forgetAgentNudgeFailure` for the window closing); `swift test` 675 green
- [x] **Step 10:** `SettingsView` gains the second switch from `design.md` (copy in `SettingsCopy.swift`, accessibility per the design), bound to the model; `TodzApp`'s `Settings` scene receives the model. `xcodegen` and an `xcodebuild` Debug build succeed; `swift test --package-path apps/macos/TodzKit` green with its count. — evidence: 5835713; `swift test` 675 tests green; `xcodegen generate` then `xcodebuild build … -configuration Debug -derivedDataPath apps/macos/build` → `** BUILD SUCCEEDED **`, no warning in the changed files
- [x] **Step 11:** Tester briefing "App" section for G2: the states to see, how to point the app at the local server, which are hypotheses. — evidence: `tester-briefing.md` → App

### G3 docs

- [ ] **Step 12:** Product design: the nudge as an opt-in exception to the reminders non-goal (ADR 0053); the API and app READMEs name the setting (purpose only); the runbook names migration 0007; README walk cells for the Settings window and an agent's `next` with the line, from the tester's real screenshots (ADR 0047).

## Failure modes

| Step | What breaks | How I notice (the concrete signal) | How I back out |
|------|-------------|------------------------------------|----------------|
| 4 | The migration fails on production D1 | `wrangler d1 migrations apply` exits non-zero | The column is additive; fix the SQL and re-apply, no data touched |
| 4 | Sign-in answers `false` for an owner whose flag is on | The app's switch turns off after every sign-in | Read the stored row in the sign-in answer (Step 3 pins it) |
| 6 | A pinned `next` text changes with the flag off | `mcp-tools.test.ts` pins go red | Prepend only behind the flag and `count > 0` |
| 6 | `dueNow` throws and takes `next` down | `next` answers an error with the flag on | Catch at the nudge only, answer without the line |
| 9 | An owner answer without `agent_nudge` (rollback, older server) fails to decode | Sign-in and confirmation fail for every owner | `agentNudge` is `Bool?` decoded if present (R1) |
| 9 | Two quick flips race and the switch shows the opposite of what is stored | The switch disagrees with a fresh `GET /owner` | The switch is disabled while a save is in flight (R6) |
| 9 | Sign-in never sets the flag | The switch stays unknown until relaunch | `openSession` reads `issued.owner` (R2) |
| 10 | The Settings scene cannot see the model | The switch never leaves "unknown" | Inject the model into the scene's environment |

**Steps with no backout:** none (migration 0007 only adds a column with a default; an older Worker never reads it).

## Z. Prove and ship

- [ ] **Tester briefing:** the developers wrote `tester-briefing.md`.
- [ ] **Tester run:** a fresh `tester` sub-agent executed `test-plan.md` and ticked every box with evidence.
- [ ] **Reviewer:** a fresh `reviewer` sub-agent returned a verdict; refutation of the three riskiest claims is recorded in `test-plan.md`.
- [ ] **Security reviewer:** verdict `CLEAR` or findings fixed.
- [ ] **/check-ui:** screenshots of the Settings window (light and dark) and an agent's `next` with the line, from real builds (ADR 0026: Orca for the app).
- [ ] **/open-pr:** gates passed, learnings sweep stated, PR opened; then deploy through `docs/runbooks/deploy-the-api.md` (migration 0007).
