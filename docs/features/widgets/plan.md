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
| G1 model | `apps/macos/TodzKit/Sources/TodzKit/`: `WidgetSnapshot.swift`, `WidgetSnapshotTask.swift`, `WidgetRequest.swift`, `WidgetStore.swift`, `FileWidgetStore.swift`, `WidgetToggle.swift` (new), `AppModel+Widgets.swift` (new), `AppModel.swift`, `AppModel+Cache.swift` (erase hooks only); `apps/macos/TodzKit/Tests/TodzKitTests/`: `WidgetSnapshotTests.swift`, `FileWidgetStoreTests.swift`, `WidgetToggleTests.swift`, `AppModelTests+Widgets.swift`, `InMemoryWidgetStore.swift` (new), `AppModelHarness.swift` | `developer-model` (Opus), on `feat/widgets` |
| G2 targets | `apps/macos/project.yml`, `apps/macos/Copy/**` (moved from `apps/macos/Todz/Copy/` with `git mv`), `apps/macos/TodzWidgets/**` (new), `apps/macos/Todz/**`, `apps/macos/README.md`, `docs/features/widgets/tester-briefing.md`, and the `macos` gate's build line in `scripts/` only if the scheme name must change | `developer-app` (Opus), after G1 |

## Sequencing

G1 first (the extension and the app read its types). G2 after the lead has merged G1 on the branch. One lane at a time.

## Steps

Author this list with every box empty. A sub-agent ticks its own line. A wrong step is struck through with the reason, not deleted.

### G1 model

- [ ] **Step 1:** red then green: `WidgetSnapshot` (`Codable`, `Equatable`, `Sendable`): `ownerIdentifier`, `workspaceName`, `day: CalendarDate`, `timeZoneIdentifier`, `open: [WidgetSnapshotTask]` in Today's order, `doneToday: [WidgetSnapshotTask]` newest first, `pending: [WidgetSnapshotTask]` (no number), each task `{ projectIdentifier, projectName, number?, title, dueDate?, creatorLabel?, isOverdue, state }`; `WidgetSnapshot.of(views: TaskViews, workspace:, owner:, day:, timeZone:) -> WidgetSnapshot` from `today` and `pendingTasks(for: .today)`. Tests: open, overdue, done today, pending adds, an agent's creator label, empty Today, round trip through `OwnerCoding`; `isCurrent(on day:)` false for another day.
- [ ] **Step 2:** red then green: `WidgetRequest { projectIdentifier, number, state: TaskState, at: Date }` (`Codable`); `WidgetStore` port: `readSnapshot() throws -> WidgetSnapshot?`, `writeSnapshot(_:) throws`, `appendRequest(_:) throws`, `takeRequests() throws -> [WidgetRequest]` (reads and clears in one call), `erase() throws`; `FileWidgetStore(folder:)` over `<folder>/widget-snapshot.json` and `<folder>/widget-requests.json` through `PrivateFile`. Tests in a temporary folder: nothing written → nil and `[]`; write then read equal; two appends then take → both in order, a second take → `[]`; files `0600`; a file holding `{` → `unreadable` for the snapshot, and for requests → erased and `[]`; erase twice without error.
- [ ] **Step 3:** red then green: `WidgetToggle.toggled(_ snapshot:, projectIdentifier:, number:, at:) -> (WidgetSnapshot, WidgetRequest)?`: an open task → moved to `doneToday` first with state done and the request `done`; a done-today task → back into `open` at its place in Today's order and the request `open`; a task not in the snapshot or a pending add → nil. Tests for each, and two toggles in a row return the original snapshot.
- [ ] **Step 4:** red then green: `AppModel+Widgets`: `AppModel` takes a `WidgetStore` and a `reloadWidgets: @Sendable () -> Void` (production: `WidgetCenter.shared.reloadAllTimelines()`, injected by the app so TodzKit stays free of WidgetKit). `publishWidgets()` builds the snapshot from the active workspace (nil when not ready) and writes it only when it differs from the last written one, then calls `reloadWidgets`; signed out or naming → `erase()` once and reload. It runs after every change that moves Today: the model calls it from one observation loop (`withObservationTracking` over `widgetSnapshot`, re-armed after each change) started by `launch()` and by `signIn`. Tests over `InMemoryWidgetStore` and a counting reload: launch with a cache → one write, one reload; an add → a second write; a pull that changes nothing → no write; a workspace switch → a write with the new name; sign-out → erase and reload.
- [ ] **Step 5:** red then green: `takeWidgetRequests()`: reads `takeRequests()`; each request whose task is in the last written snapshot is enqueued through `complete(task:)` or `reopen(task:)` with its `at` as the click time; others are dropped; then publishes. A request for a task of another workspace, or of no snapshot, is dropped. Tests: a done request for an open snapshot task → one outbox change; a forged request → none; no snapshot → none.
- [ ] **Step 6:** red then green: sign-out and a sign-in as another owner erase the widget store with the cache (`AppModel+Cache` hooks), before anything is written for the new owner; an erase failure is the cache's failure (same banner). Tests: sign-out → store erased; another owner → erased before the first new write; the same owner → kept.

### G2 targets

- [ ] **Step 7:** the project: `TodzWidgets` app-extension target (WidgetKit, macOS 14), embedded in `Todz`, ad-hoc signed like the app, sandboxed, both with `com.apple.security.application-groups: [$(TODZ_TEAM_PREFIX).dev.todz]`; `TODZ_TEAM_PREFIX: TODZLOCAL0` in the project's base settings; `TodzAppGroup` in both Info.plists; the URL scheme `todz` in the app's Info.plist. `apps/macos/Todz/Copy` moves to `apps/macos/Copy`, compiled into both targets (O11). `TodzApp` injects `FileWidgetStore(folder: <group container>/Widgets)` when the container exists (else a store that keeps nothing, so the app runs) and `WidgetCenter.shared.reloadAllTimelines`. Prove with one launch, without opening a window on the owner's screen (`open -g`), that `~/Library/Group Containers/TODZLOCAL0.dev.todz/Widgets/widget-snapshot.json` appears with mode `0600`, and that `pluginkit -m -i dev.todz.Todz.widgets` lists the extension.
- [ ] **Step 8:** the four widgets in `TodzWidgets/` per `design.md` §§ 1–5, every string of § 8: one `TimelineProvider` over `FileWidgetStore` (entries now and at the next midnight of the snapshot's time zone), the small ring, small Next up, medium and large lists, the empty and "Open todz" states, the gallery sample (O12), `widgetURL` and `Link` per O2 (`todz://today`, `todz://task/<project>/<number>`).
- [ ] **Step 9:** `ToggleTaskIntent` (`AppIntent`, parameters project and number) in the extension: `WidgetToggle.toggled` on the stored snapshot, `appendRequest`, `writeSnapshot`, `WidgetCenter.reloadAllTimelines`, post the Darwin notification `dev.todz.widget-requests`; the checkboxes are `Button(intent:)`. The app: `takeWidgetRequests()` at launch, on `NSApplication.didBecomeActiveNotification`, and on that Darwin notification; `.onOpenURL` → `todz://today` selects Today and opens the main window; `todz://task/<p>/<n>` → `reveal(task:)` only for a task of the active workspace, else Today.
- [ ] **Step 10:** `apps/macos/README.md` names the widgets; `tester-briefing.md`: what changed, how to run, how to put the widgets on the desktop (needs the owner's OK: it draws on his screen), how to read the snapshot and request files, red texts, hypotheses, known gaps (the local risk of ADR 0032 until a team).

## Failure modes

| Step | What breaks | How I notice (the concrete signal) | How I back out |
|------|-------------|------------------------------------|----------------|
| 2 | an atomic write fails in the group container | no `widget-snapshot.json` after step 7's launch | `PrivateFile` drafts in the same `Widgets` folder; else a plain write with `0600` |
| 4 | the snapshot is written on every observation tick | the reload counter climbs on a pull that changed nothing | write only when the snapshot differs from the last written |
| 4 | the observation loop leaks or stops after one change | the second add writes nothing | re-arm after each change; the test adds twice |
| 5 | a forged request completes a task of another workspace | the forged-request test enqueues a change | only tasks in the last written snapshot |
| 6 | another owner's Today stays in the group | the owner-switch test reads the old snapshot before the first new write | erase before keeping the new session |
| 7 | the extension needs a provisioning profile | `xcodebuild` asks for one | the prefixed group, not `group.` (ADR 0032) |
| 7 | the extension is not registered | `pluginkit -m -i dev.todz.Todz.widgets` lists nothing | check the embed phase and the extension point key |
| 9 | the intent runs in the app, not the extension, or not at all | no request file after a tap | `Button(intent:)` with the intent in the extension target; record what the walk shows |
| 9 | a `todz://` link selects a task of another workspace | the walk opens a link to a foreign task and sees it selected | `reveal` only for the active workspace's tasks |

**Steps with no backout:** none; nothing is deployed. Reverting leaves the group folder on disk (spec → Rollback).

## Z. Prove and ship

- [ ] **Tester briefing:** a developer wrote `tester-briefing.md`.
- [ ] **Tester run:** a fresh `tester` sub-agent executed `test-plan.md` and ticked every box with evidence.
- [ ] **Reviewer:** a fresh `reviewer` sub-agent returned a verdict; refutation of the three riskiest claims is recorded in `test-plan.md`.
- [ ] **Security reviewer:** a fresh `security-reviewer` sub-agent returned its verdict.
- [ ] **/check-ui:** screenshots and video uploaded; the README gallery shots under `docs/screenshots/widgets/`.
- [ ] **/open-pr:** gates passed, learnings sweep stated, PR opened.
