# Test plan: Add field commit

Every checkbox states the input and the exact expected outcome. A ticked box carries evidence after ` — evidence: ` (commit hash, log path, counts, screenshot path).

## The failing test first

- [ ] `AddFieldSubmissionTests::aTypedTitleIsAcceptedAsTyped` — input: `"Acme one"`; expected: `.accepted(title: "Acme one")`
- [ ] Confirmed it fails for the right reason against the stub that ignores every title

## Unit

- [ ] `AddFieldSubmissionTests::aBlankFieldIsIgnored` — input: `""`, `"   "`, `"\n\t"`; expected: `.ignored` each
- [ ] `AddFieldSubmissionTests::aTitleOverTheLimitIsRefusedWithItsIssue` — input: a title one scalar over `TaskLimits.titleMaxLength`; expected: `.refused(.titleTooLong)`
- [ ] The whole TodzKit suite stays green

## Prove it for real

A local Worker (`wrangler dev`, fake sign-in) and `TODZ_LIVE_API_URL` pointing at it. Each flow signs in a fresh owner through the fake provider and seeds Acme (Acme one, due today), Walk B (Walk B one, no date) and Walk C (Walk C one, due today; Walk C two, no date) through the owner API before the real client opens.

- [ ] Defect 1 and 2 decided from the server — input: the walk's `wrangler.log`; expected: no `/tasks` request
- [ ] `allShowsEveryInboxAndTodayOnTheServerTaggedByWorkspace` — expected: Inbox `Acme one, Walk B one, Walk C one, Walk C two` tagged `Acme, Walk B, Walk C, Walk C`; Today `Acme one, Walk C one` tagged `Acme, Walk C`; menu bar count 2
- [ ] `theWorkspaceShortcutsMapToTheServersOrder` — input: ⌃3 then ⌃2; expected: Walk C alone with its two rows untagged, then Walk B alone with count 0
- [ ] `anAddFromTheInboxOfAllReachesThePrimaryWorkspaceOnTheServer` — input: an add from the Inbox of All; expected: the server's Acme Inbox holds `Acme one, Acme two`
- [ ] `theWidgetSnapshotCarriesEachWorkspaceAndATickCompletesInItsOwnWorkspaceOnTheServer` — expected: snapshot rows carry Acme and Walk C; a tick on Walk C one completes it on the server and leaves Acme's task 1 open; count 1
- [ ] `aRelaunchKeepsAllAndShowsTheServersThreeWorkspaces` — expected: selection All, three workspaces, the four tagged Inbox rows, count 2
- [ ] Debug build against the local Worker, window captured with `screencapture -l` — expected: All Workspaces Inbox with the four tagged rows

## Edge cases found during execution

Empty on purpose.

## Adversarial review

- [ ] Claim: the live suite reads the server, not a cache — attack: the wrangler log of the run holds the workspace and task writes; result: pending
- [ ] Claim: Return still adds — attack: `onSubmit` still calls the same `submit`; result: pending

## Coverage honesty

- No synthetic keystroke, mouse event or accessibility automation was run, by rule. The "Add" action is proven by reading the code path it shares with Return, not by invoking it from VoiceOver.
- Whether an accessibility `set-value` updates the SwiftUI binding is not proven here. If it does not, an automation that sets the value and then presses Return or "Add" still adds nothing; typing remains the reliable path for automation.
