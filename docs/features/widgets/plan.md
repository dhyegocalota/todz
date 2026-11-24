# Plan: Widgets

**Spec:** spec.md
**Tier:** 🔴
**Seam:** `apps/macos/TodzKit` (the snapshot, the request, the store port and its file implementation, the toggle rule, and `AppModel`'s publishing and intake), `apps/macos/project.yml` (the `TodzWidgets` extension target, the App Group entitlements, the prefix setting, the URL scheme), `apps/macos/Copy` (moved from `Todz/Copy`, compiled into both targets, `design.md` O11), `apps/macos/TodzWidgets` (new), and `apps/macos/Todz` (injection, activation and Darwin-notification intake, deep links). Nothing outside `apps/macos` changes but this folder's docs, the root README gallery and `docs/screenshots/widgets/`.
**Assumptions (decided, owner can override):**
- ADR 0032 and `design.md` § 7 are the loop's calls, listed in the loop's questions. No third-party Swift dependency.
- Swift 6 strict concurrency, Swift Testing, `swift test` from `apps/macos/TodzKit` run directly (not from a zsh script, see the menu bar learning); the conventions of the earlier plans hold word for word.
- Files with the Write and Edit tools; commits with `git commit -F`.
- Red-first: each red commit holds the failing test alone plus `fatalError("<name> is not implemented")` stubs, and its body records the printed failure. A green-on-landing test is a `pin`.
- Every group leaves `swift test` and the app build (now with the extension) green at its last commit.
- The group's files live in a `Widgets` folder inside the group container, written through `PrivateFile` (draft then rename in the same folder). The spike's `String.write(atomically: true)` at the container root failed silently once; step 2's test proves `PrivateFile` in a folder, and step 7's check proves it in the real group.
- The prefix: build setting `TODZ_TEAM_PREFIX = TODZLOCAL0`; the group is `$(TODZ_TEAM_PREFIX).dev.todz` in both entitlements and in an Info.plist key `TodzAppGroup` that both targets read, so no identifier is repeated in Swift.

## File map

| Group | Paths owned | Developer sub-agent |
|-------|-------------|---------------------|
| G1 model | `apps/macos/TodzKit/Sources/TodzKit/`: `WidgetSnapshot.swift`, `WidgetSnapshotTask.swift`, `WidgetContent.swift`, `WidgetFamilyKind.swift`, `WidgetRequest.swift`, `StoredWidgetRequest.swift`, `WidgetStore.swift`, `FileWidgetStore.swift`, `WidgetToggle.swift`, `WidgetNotification.swift` (new), `AppModel+Widgets.swift` (new), `AppModel.swift`, `AppModel+Cache.swift` (erase hooks only); `apps/macos/TodzKit/Tests/TodzKitTests/`: `WidgetSnapshotTests.swift`, `WidgetContentTests.swift`, `FileWidgetStoreTests.swift`, `WidgetToggleTests.swift`, `AppModelTests+Widgets.swift`, `InMemoryWidgetStore.swift` (new), `AppModelHarness.swift` | `developer-model` (Opus), on `feat/widgets` |
| G2 targets | `apps/macos/project.yml`, `apps/macos/Copy/**` (moved from `apps/macos/Todz/Copy/` with `git mv`), `apps/macos/TodzWidgets/**` (new), `apps/macos/Todz/**`, `apps/macos/README.md`, `docs/features/widgets/tester-briefing.md`, and the `macos` gate's build line in `scripts/` only if the scheme name must change | `developer-app` (Opus), after G1 |

## Sequencing

G0 first, by the lead, with the owner's OK (a widget on his desktop): if the extension cannot read the group, nothing else starts. Then G1 (the extension and the app read its types), then G2 after the lead has merged G1 on the branch. One lane at a time.

## Steps

Author this list with every box empty. A sub-agent ticks its own line. A wrong step is struck through with the reason, not deleted.

The plan review of 2026-11-24 (17 findings, 2 CRITICAL) is folded into the steps below; its numbers are in brackets.

### G0 proof (before any code)

- [ ] **Step 0:** a throwaway spike in the scratchpad, never committed, with the owner's OK because it puts a widget on his desktop: the spike app (ad hoc, `TODZLOCAL0.wspike` group) writes a string in the group; a widget of its extension, placed on the desktop, shows the string it read from the group. Record in ADR 0032's Evidence: whether the widget read it, whether any consent prompt appeared (macOS group container protection), and whether a `Button(intent:)` tap ran the intent in the extension (a file it writes in the group). If the extension cannot read the group, stop the plan and amend ADR 0032 before G1. [2, 15]

### G1 model

- [ ] **Step 1:** red then green: `WidgetSnapshot` (`Codable`, `Equatable`, `Sendable`): `workspaceName`, `day: CalendarDate`, `timeZoneIdentifier`, `tasks: [WidgetSnapshotTask]` in Today's display order (open, then done today newest first), `pending: [WidgetSnapshotTask]` (no number); each task `{ projectIdentifier, projectName, number?, title, dueDate?, creatorLabel?, isOverdue, state }`. No owner identifier in the group [14]. `WidgetSnapshot.of(views: TaskViews, workspace:, day:, timeZone:)` from `today` and `pendingTasks(for: .today)`. Tests: open, overdue, done today, pending adds, an agent's creator label, empty Today, the `OwnerCoding` round trip, `isCurrent(on:)` false for another day.
- [ ] **Step 2:** red then green: `WidgetContent.of(snapshot: WidgetSnapshot?, family: WidgetFamilyKind, on day: CalendarDate) -> WidgetContent`, pure, the rules of `design.md` the views draw: rows per family (medium 3, large 7, done-today rows fill the slots left, O3/O4), the counts and the ring (done today of done today + open, O7), Next up (O6), the "Open todz" state for no snapshot or another day (O9), the empty and all-done states. `WidgetFamilyKind` is TodzKit's own enum so TodzKit stays free of WidgetKit. Tests for each case. [10]
- [ ] **Step 3:** red then green: `WidgetRequest { projectIdentifier, number, state: TaskState, at: Date }` (`Codable`); `WidgetStore` port: `readSnapshot() throws -> WidgetSnapshot?`, `writeSnapshot(_:) throws`, `addRequest(_:) throws`, `requests() throws -> [StoredWidgetRequest]` (each with its file name), `removeRequests(_ names:) throws`, `erase() throws`. `FileWidgetStore(folder:)`: `<folder>/widget-snapshot.json` and one file per request, `<folder>/requests/<UUID>.json`, all through `PrivateFile`; reads refuse anything that is not a regular file (`O_NOFOLLOW`, no symlinks); `requests()` takes at most 50 files per pass, oldest first; an unreadable request file removes only itself. Tests in a temporary folder: nothing written → nil and `[]`; write then read equal; two adds → two in order; remove exactly the names read, a third add made between the read and the remove survives; files `0600`; a symlinked snapshot → `unreadable`; an unreadable request → removed alone; 60 requests → 50 then 10; erase twice. [3, 16]
- [ ] **Step 4:** red then green: `WidgetToggle.setting(_ snapshot:, projectIdentifier:, number:, to state: TaskState, at:) -> (WidgetSnapshot, WidgetRequest)?`: the task's state set in place (the row stays where it is, O8), the counts follow from the states; a task already in that state → nil (no request); a task not in the snapshot or a pending add → nil. The intent carries the target state, so a tap on a row the app has since redrawn never inverts. [4]
- [ ] **Step 5:** red then green: `AppModel+Widgets`: `AppModel` takes a `WidgetStore` and a `reloadWidgets: @Sendable () -> Void` (production: `WidgetCenter.shared.reloadAllTimelines()`, injected by the app). `publishWidgets()`: `.ready` → the snapshot of the active workspace, written when it differs from the last written one, then a reload; `.signedOut` or `.naming` → erase once and reload; `.loading` → leave the files alone [7]. One observation loop, started once by `launch()` behind a guard (never by `signIn`), over `withObservationTracking { widgetSnapshot }`, whose `onChange` stores `widgetPublication: Task<Void, Never>?` that hops to the main actor, publishes and re-arms; tests `await model.widgetPublication?.value` (no timing) [7]. Tests over `InMemoryWidgetStore` and a counting reload: launch with a cache → one write and one reload; an add → a second write; an unchanged pull → no write; a workspace switch → the new name; sign-out → erase and reload; an injected `now` that crosses midnight and `dayChanged()` → one write with the new day [6].
- [ ] **Step 6:** red then green: `takeWidgetRequests()`: only in `.ready`, else the requests stay untouched. Each request whose task is in the model's current `taskViews.today` (open or done today) and not already in that state is enqueued through `complete(task:)` or `reopen(task:)`; others are dropped; the files read are removed. After any request was taken, the snapshot is written unconditionally, so a dropped request's optimistic row returns to the truth [1, 5]. The click time is not taken from the request (`complete` and `reopen` stamp `now()`), so a forged time changes nothing [12]. Tests: a cold launch with a cache and one request → one outbox change after `.ready` [1]; `.loading` → the request stays; a forged request (another workspace's project) → no change and a rewrite with the true state [5]; a request for a task already done → none.
- [ ] **Step 7:** red then green: the widget store is erased with the cache everywhere the cache is: sign-out, a sign-in as another owner, and an owner switch found at launch by `confirmOwner` → `forgetCache` [9]; a 401 (`endSession`) erases the snapshot and keeps the requests, which the same owner's next sign-in takes, as the outbox is kept (ADR 0027). Tests: sign-out → erased; another owner at sign-in → erased before the first new write; cached owner A, the server answers B at launch → erased before B's first write; a 401 → snapshot gone, requests kept.

### G2 targets

- [ ] **Step 8:** the project: `TodzWidgets` app-extension target (WidgetKit, macOS 14), embedded in `Todz`, with the TodzKit package dependency, ad hoc and sandboxed like the app, both with `com.apple.security.application-groups: [$(TODZ_TEAM_PREFIX).dev.todz]`; `TODZ_TEAM_PREFIX: TODZLOCAL0` in the base settings; `TodzAppGroup` in both Info.plists; the URL scheme `todz` in the app's Info.plist. `apps/macos/Todz/Copy` moves to `apps/macos/Copy`, listed in both targets' `sources` (O11) [17]. `TodzApp` injects `FileWidgetStore(folder: <group container>/Widgets)` when the container exists (else a store that keeps nothing, so the app runs) and `WidgetCenter.shared.reloadAllTimelines`. Prove with one hidden launch (`open -g -j`, so no window draws on the owner's screen [11]) that `~/Library/Group Containers/TODZLOCAL0.dev.todz/Widgets/widget-snapshot.json` appears with mode `0600` and that `pluginkit -m -i dev.todz.Todz.widgets` lists the extension. The briefing says the `macos` gate builds the extension only as the `Todz` scheme's embedded dependency and only locally [17].
- [ ] **Step 9:** the four widgets in `TodzWidgets/` drawing `WidgetContent` (step 2) per `design.md` §§ 1–5 and every string of § 8: one `TimelineProvider` over `FileWidgetStore` (entries now and at the next midnight of the snapshot's time zone), the small ring, small Next up, medium and large lists, the gallery sample (O12), `widgetURL` and `Link` per O2 (`todz://today`, `todz://task/<project>/<number>`).
- [ ] **Step 10:** `ToggleTaskIntent` (`AppIntent`; parameters project, number and target state) in the extension: `WidgetToggle.setting` on the stored snapshot, `addRequest`, `writeSnapshot`, then post the Darwin notification named `<TodzAppGroup>.widget-requests`, declared once in TodzKit (sandboxed IPC names are group-scoped) [13]; no extra `reloadAllTimelines` (the system reloads after an interactive intent) [15]; the checkboxes are `Button(intent:)`. The app: `takeWidgetRequests()` after the launch reaches `.ready`, on `NSApplication.didBecomeActiveNotification`, and on that Darwin notification (its C callback hops to the main actor; a forged post only triggers an intake) [13]; `publishWidgets()` on `NSCalendarDayChanged` [6]. Deep links are handled in `AppDelegate.application(_:open:)`, alive with the main window closed or the app just launched by the link [8]: `todz://today` selects Today and opens the main window; `todz://task/<p>/<n>` → `reveal(task:)` only for a task of the active workspace, else Today; no `todz://` path ever writes.
- [ ] **Step 11:** `apps/macos/README.md` names the widgets; `tester-briefing.md`: what changed, how to run, how to put the widgets on the desktop (the owner's OK first), how to read the snapshot and request files, red texts, hypotheses (the reload delay of a background app's widgets is a hypothesis, not a pass or fail [15]), known gaps (ADR 0032's local risk until a team).


## Failure modes

| Step | What breaks | How I notice (the concrete signal) | How I back out |
|------|-------------|------------------------------------|----------------|
| 0 | the extension cannot read the group, or a consent prompt blocks it | the spike widget shows no string, or a prompt appears | stop; amend ADR 0032 before any code |
| 3 | an atomic write fails in the group container | no `widget-snapshot.json` after step 8's launch | `PrivateFile` drafts in the same folder; else a plain write with `0600` |
| 3 | a tap is lost between the app's read and its clear | the add-between-read-and-remove test loses a request | one file per request; remove only the names read |
| 5 | the snapshot is written on every observation tick | the reload counter climbs on a pull that changed nothing | write only when it differs, except after an intake |
| 5 | the observation loop runs twice or stops after one change | two writes per change, or none on the second add | one loop, started by `launch()` behind a guard, re-armed in `onChange` |
| 6 | a tap made while the app is quit never reaches the server | the cold-launch test makes no outbox change | intake checks the model's current Today after `.ready`, not an in-memory snapshot |
| 6 | a forged request completes a task of another workspace | the forged-request test enqueues a change | only tasks in the current Today |
| 7 | another owner's Today stays in the group | the owner-switch tests read the old snapshot before the first new write | erase with the cache, at sign-in and at launch |
| 8 | the extension needs a provisioning profile | `xcodebuild` asks for one | the prefixed group, not `group.` (ADR 0032) |
| 8 | the extension is not registered | `pluginkit -m -i dev.todz.Todz.widgets` lists nothing | check the embed phase and the extension point key |
| 10 | the intent runs in the app, not the extension, or not at all | no request file after a tap | `Button(intent:)` with the intent in the extension target; step 0 recorded where it runs |
| 10 | a `todz://` link selects a task of another workspace, or does nothing with the window closed | the walk sees a foreign task selected, or no window | `reveal` only for the active workspace's tasks; the handler lives in the app delegate |
| 10 | widgets show yesterday at midnight with the app running | "Open todz" after midnight | `publishWidgets()` on `NSCalendarDayChanged` |

**Steps with no backout:** none; nothing is deployed. Reverting leaves the group folder on disk (spec → Rollback).

## Z. Prove and ship

- [ ] **Tester briefing:** a developer wrote `tester-briefing.md`.
- [ ] **Tester run:** a fresh `tester` sub-agent executed `test-plan.md` and ticked every box with evidence.
- [ ] **Reviewer:** a fresh `reviewer` sub-agent returned a verdict; refutation of the three riskiest claims is recorded in `test-plan.md`.
- [ ] **Security reviewer:** a fresh `security-reviewer` sub-agent returned its verdict.
- [ ] **/check-ui:** screenshots and video uploaded; the README gallery shots under `docs/screenshots/widgets/`.
- [ ] **/open-pr:** gates passed, learnings sweep stated, PR opened.
