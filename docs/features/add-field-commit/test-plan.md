# Test plan: Add field commit

Every checkbox states the input and the exact expected outcome. A ticked box carries evidence after ` — evidence: ` (commit hash, log path, counts, screenshot path).

## The failing test first

- [x] `AddFieldSubmissionTests::aTypedTitleIsAcceptedAsTyped` — input: `"Acme one"`; expected: `.accepted(title: "Acme one")` — evidence: red commit 7f9d9e2a, green a560f7f5
- [x] Confirmed it fails for the right reason against the stub that ignores every title — evidence: the red run printed `Expectation failed: AddFieldSubmission.of(title: "Acme one") == .accepted(title: "Acme one")` and `Expectation failed: AddFieldSubmission.of(title: title) == .refused(.titleTooLong)`; the blank cases passed

## Unit

- [x] `AddFieldSubmissionTests::aBlankFieldIsIgnored` — input: `""`, `"   "`, `"\n\t"`; expected: `.ignored` each — evidence: 3 cases green on a560f7f5
- [x] `AddFieldSubmissionTests::aTitleOverTheLimitIsRefusedWithItsIssue` — input: a title one scalar over `TaskLimits.titleMaxLength`; expected: `.refused(.titleTooLong)` — evidence: green on a560f7f5
- [x] The whole TodzKit suite stays green — evidence: `swift test` on a560f7f5, 1452 tests in 118 suites passed, the live suite skipped without `TODZ_LIVE_API_URL`; `xcodebuild` Debug `BUILD SUCCEEDED`

## Prove it for real

A local Worker (`wrangler dev --port 8917`, fake sign-in) and `TODZ_LIVE_API_URL=http://localhost:8917`. Each flow signs in a fresh owner through the fake provider and seeds Acme (Acme one, due today), Walk B (Walk B one, no date) and Walk C (Walk C one, due today; Walk C two, no date) through the owner API before the real client opens.

- [x] Defect 1 and 2 decided from the server — input: the walk's `wrangler.log`; expected: no `/tasks` request — evidence: the walk's log holds one `POST /owner/workspaces 201` and zero lines naming `/tasks`; in both of its screenshots the text has no checkbox and no `T-` number, which every committed row carries. Both defects: ARTIFACT
- [x] `allShowsEveryInboxAndTodayOnTheServerTaggedByWorkspace` — expected: Inbox `Acme one, Walk B one, Walk C one, Walk C two` tagged `Acme, Walk B, Walk C, Walk C`; Today `Acme one, Walk C one` tagged `Acme, Walk C`; menu bar count 2 — evidence: green on a800c864, 11 live tests in 2 suites passed; the Worker logged the `POST /owner/workspaces` and `POST /owner/projects/<id>/tasks` writes, 201 each
- [x] `theWorkspaceShortcutsMapToTheServersOrder` — input: ⌃3 then ⌃2; expected: Walk C alone with its two rows untagged, then Walk B alone with count 0 — evidence: green on a800c864
- [x] `anAddFromTheInboxOfAllReachesThePrimaryWorkspaceOnTheServer` — input: an add from the Inbox of All; expected: the server's Acme Inbox holds `Acme one, Acme two` — evidence: green on a800c864
- [x] `theWidgetSnapshotCarriesEachWorkspaceAndATickCompletesInItsOwnWorkspaceOnTheServer` — expected: snapshot rows carry Acme and Walk C; a tick on Walk C one completes it on the server and leaves Acme's task 1 open; count 1 — evidence: green on a800c864
- [x] `aRelaunchKeepsAllAndShowsTheServersThreeWorkspaces` — expected: selection All, three workspaces, the four tagged Inbox rows, count 2 — evidence: green on a800c864
- [x] Debug build against the local Worker, window captured with `screencapture -l` — expected: All Workspaces Inbox with the four tagged rows — evidence: a Debug build of a560f7f5 under its own bundle and app group, its session and cache written by the real client; the window shows All Workspaces, Inbox 4, Today 2, `Acme one` (Acme, Today, T-1), `Walk B one` (Walk B, T-1), `Walk C one` (Walk C, Today, T-1), `Walk C two` (Walk C, T-2), and the same after a quit and relaunch; its `widget-snapshot.json` carries Acme one in Acme and Walk C one in Walk C. Screenshots in the PR

## Edge cases found during execution

Empty on purpose.

## Adversarial review

- [x] Claim: the live suite reads the server, not a cache — attack: the wrangler log of the run holds the workspace and task writes; result: each flow starts with empty in-memory stores, and the Worker logged 42 workspace and task writes for the run
- [x] Claim: Return still adds — attack: `onSubmit` still calls the same `submit`; result: `submit` maps `.accepted` to the same `model.addTask` call with the same destination and selection as before, and `.refused` keeps the text as before

## Coverage honesty

- The live suite assumes a local Worker: every flow signs in a fresh owner and creates three workspaces, which a guarded production Worker may rate-limit.
- No synthetic keystroke, mouse event or accessibility automation was run, by rule. The "Add" action is proven by reading the code path it shares with Return, not by invoking it from VoiceOver.
- Whether an accessibility `set-value` updates the SwiftUI binding is not proven here. If it does not, an automation that sets the value and then presses Return or "Add" still adds nothing; typing remains the reliable path for automation.
