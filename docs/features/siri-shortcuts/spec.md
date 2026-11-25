# Siri shortcuts

**Status:** Approved
**Tier:** 🟡 (a new system surface: three App Intents, a task entity and its query, an App Shortcuts provider, writes through the outbox, a cold launch by the system; no server, schema or entitlement change)
**Owner approval:** approved 2026-11-25 by the owner's request to the loop (2026-11-24, ~20:30: "1,4,5,6,7,9,10 e também 11 … seja criativo, add no cron e só para quando tiver pronto"; every item "features opcionais", off by default, no push notifications), recorded in `todz-loop/STATE.md` "Owner requirements queued" → `proactive-day` item 7: "`siri-shortcuts` (idea 10): App Intents for 'what's left today in todz?', 'add a task to todz' and 'complete …', as Shortcuts and Siri phrases. The widgets already use App Intents." The behaviour, and the call that a pulled Shortcut needs no Settings switch, are the loop's in [ADR 0066](../../adr/0066-siri-and-shortcuts-run-three-app-intents-in-the-app-over-its-one-model.md).
**ADRs:** [0066](../../adr/0066-siri-and-shortcuts-run-three-app-intents-in-the-app-over-its-one-model.md), [0054](../../adr/0054-the-app-learns-focus-through-a-todz-focus-filter-not-the-focus-status-api.md), [0062](../../adr/0062-the-morning-glance-is-a-non-activating-glass-panel-that-shows-today-on-the-first-wake-or-unlock-of-the-day.md), [0036](../../adr/0036-the-menu-bar-icon-counts-today-s-open-tasks-behind-a-setting.md), [0035](../../adr/0035-with-the-personal-team-the-widgets-share-the-app-group.md), [0033](../../adr/0033-without-a-team-the-widgets-share-a-folder-in-application-support-that-an-app-group-replaces-later.md), [0031](../../adr/0031-the-menu-bar-extra-is-a-swiftui-window-over-the-app-s-one-model.md)
**Not changing:** the server, the MCP tools, the widgets and their intent, the Focus filter and the `ProactiveGate`, the menu bar and its count, the main window, Settings, the morning glance's behaviour (its rows move into a shared view), the entitlements and the signing (the Debug build's display name becomes `Todz Dev`: neither signing nor an entitlement, ADR 0066 §10)

## Problem

The owner has to open todz, its popover or a widget to know what is left today, to add a task or to check one off. He wants to ask from anywhere, by voice with Siri or from the Shortcuts app and Spotlight, without the app coming to the front.

## Goals

- Three App Shortcuts, listed under todz in the Shortcuts app and in Spotlight once the app has launched, and answered by Siri in English:
  - "What's left today in todz" speaks how many of Today's tasks are open in the active workspace and up to three titles, shows up to five in a snippet, and returns them for a shortcut to chain.
  - "Add a task to todz" asks "What's the task?" and adds it where the menu bar's Add field adds: the active workspace's Inbox, due today. In the Shortcuts editor a `Due Today` switch (on by default) can send it to the Inbox with no date.
  - "Complete a task in todz" asks "Which task?" with Today's open tasks, matches a spoken or typed title, and completes it.
- Every write goes through the app's one model and its outbox: an add or a completion while offline is kept and sent when the server answers.
- The app never comes to the front, and a Shortcut-launched app raises no window, no morning glance and no day-close popover (ADR 0066 §11); how a cold run launches is measured at Step 10a and recorded in ADR 0066.
- Signed out, no workspace yet, or Today unknown after 5 seconds: a clear refusal, nothing written, from every intent and from the `Task` parameter's own query.
- No Settings switch and no Focus gate: a Shortcut is pulled by the owner, never pushed (ADR 0066 §6, §7).

## Non-goals

- Phrases in another language than English; a task title inside the phrase; choosing a workspace or a project by voice; notes, due dates other than today, or reopening by voice; a Settings row; a Siri or Shortcuts surface for agents; anything on the server.

## Design

### Data flow

```
Siri phrase / Shortcuts run / Spotlight action
        │
        ▼  (the system launches todz in the menu bar when it is not running)
App target, Todz/Shortcuts/:  LeftTodayIntent · AddTaskIntent · CompleteTaskIntent · TodzTaskEntity + TodzTaskQuery · TodzShortcuts
        │  @Dependency AppModel  (registered by AppDelegate.init with AppDependencyManager, after super.init())
        ▼
AppModel.shortcutReadiness()   starts launch() unawaited (no-op once launched) → wait ≤ 5 s:
        │                         Today of the active workspace known → .ready
        │                         signed out → .signedOut   ·   naming → .noWorkspace   ·   still loading → .loading
        ├─ .ready ─┬─ shortcutToday            → ShortcutToday(workspaceName, content: morningGlanceContent, tasks, isOffline)
        │          ├─ addFromShortcut(title:isDueToday:) → TextCheck → addTaskDestination(.today | .inbox) → addTask(…, .keepSelection)
        │          │                                        → outbox (kept on disk) → sent when the server answers
        │          ├─ completeFromShortcut(key:)  → open in the active workspace → complete(task:) → outbox
        │          │                               done → .alreadyDone · not in the active workspace → .notFound
        │          └─ shortcutSuggestedTasks / shortcutTasks(matching:) / shortcutTasks(for:)   (the entity query; refuses as the intents do when not ready)
        └─ otherwise → the intent throws ShortcutRefusal with its copy; nothing written
        ▼
IntentDialog (spoken or shown) · snippet (TodayDigest rows) · returned value
```

### Interfaces

- `TodzKit`:
  - `ShortcutReadiness` (enum: `ready`, `signedOut`, `noWorkspace`, `loading`) and `ShortcutLimits.readinessWait` (5 s, `// NB ADR 0066`).
  - `AppModel.shortcutReadiness() async -> ShortcutReadiness`: when the model has not launched, starts `launch()` in an unstructured task without awaiting it (the launch awaits the workspace listing over the network, which must not set the bound), then waits on observation for the first of the four, at most `readinessWait` measured with the model's injected `pause`. On a launch this process has not settled yet (`isLaunchSettled` false), `.ready` also waits, within the same bound, for the active workspace's first pull to answer or fail; when the bound ends with only the cache, the answer is `.ready` and `ShortcutToday.isOffline` is true (a cache is never reported as live).
  - `ShortcutTask` (`key: TaskKey`, `title`, `projectName`, built only from tasks that have a number, so no entity needs an unwrap), `ShortcutLimits.spokenTitleLimit` (3), `ShortcutTodaySentence` (enum: `nothingLeft`, `withTitles`, `withFirstTitles`), `ShortcutToday.sentence` and `ShortcutToday.spokenTitles` (the first three open titles in Today's order).
  - `ShortcutToday`: `workspaceName`, `content: MorningGlanceContent` (the count, five rows, the rest), `tasks: [ShortcutTask]` (every open Today task, in Today's order, for the returned value), `isOffline`; `AppModel.shortcutToday: ShortcutToday?`, nil unless ready.
  - `ShortcutAddition` (enum: `added(title:destination:workspaceName:isOffline:)`, `refused(RuleIssue)`, `noWorkspace`, `signedOut`) with `ShortcutAddDestination` (`today`, `inbox`); `AppModel.addFromShortcut(title:isDueToday:) async -> ShortcutAddition`.
  - `ShortcutCompletion` (enum: `completed(title:isOffline:)`, `alreadyDone(title:)`, `notFound`, `signedOut`); `AppModel.completeFromShortcut(key:) async -> ShortcutCompletion`.
  - `AppModel.shortcutSuggestedTasks`, `shortcutTasks(matching:)`, `shortcutTasks(for:)`: `[ShortcutTask]`, active workspace only, at most `ShortcutLimits.taskLimit` (10) for the first two.
  - `TaskKey.shortcutIdentifier` and `TaskKey(shortcutIdentifier:)`: `<project identifier>/<number>`; anything else is nil.
- App: `Todz/Shortcuts/` (`TodzTaskEntity`, `TodzTaskQuery` (its methods `throw`: anything but `.ready` throws the matching `ShortcutRefusal`, because Shortcuts and Siri resolve the `Task` parameter through the query before `perform()` runs), `LeftTodayIntent`, `AddTaskIntent`, `CompleteTaskIntent`, `TodzShortcuts`, `ShortcutRefusal`, `LeftTodaySnippet`), `Todz/Shared/TodayDigest.swift` (the heading, rows and rest that `MorningGlanceView` and the snippet share), the dependency registration in `AppDelegate`, copy in `Copy/ShortcutsCopy.swift` per `design.md` § 8.

### Failure handling

| Case | Effect |
|---|---|
| todz is not running | the system launches it; the intent starts the model's launch and waits for it, at most 5 s; no window, glance or popover is raised (ADR 0066 §11, measured at Step 10a) |
| a cold run on the first launch of the day, or after the day-close time | no morning glance and no day-close popover: a pulled request raises no pushed surface; they come at the next wake, unlock or scheduled check |
| signed out | every intent, and the `Task` parameter's query, refuses: "Sign in to todz first."; nothing written |
| signed in, no workspace yet | refuses: "Name your first workspace in todz first." |
| Today still loading after 5 s (no cache, slow server) | refuses: "todz is still loading Today. Try again in a moment." |
| offline with a cache | "what's left" answers from the cache and adds "todz is offline, so this is the last synced list.", on a cold run too (the first pull failing marks it offline); add and complete queue in the outbox and say they sync later |
| the app quits before the outbox is sent | the outbox is on disk; the next launch sends it, as for any change |
| Today is empty | "Nothing left today in <workspace>." and no snippet rows; "complete" offers nothing to pick |
| more than five open | the dialog speaks three titles and "and N more"; the snippet five rows and "+N more"; the value holds every open task |
| an add with a blank or 201-character title | refuses with the window's copy for that rule; nothing queued |
| an add while the main window has a task selected | the selection stays |
| several tasks match the spoken text | the system's disambiguation lists them; nothing completes until one is chosen |
| nothing matches | the system says it found nothing; nothing completes |
| the chosen task was completed elsewhere meanwhile | "“<title>” is already done."; nothing queued |
| the chosen task is gone or in another workspace (a saved shortcut after a switch) | "That task is no longer in this workspace."; nothing queued |
| the owner switched workspace between the question and the answer | the answer names and acts on the workspace active when the intent performs |
| a task added offline and not yet saved | not counted or listed by "what's left" (as the count), not offered by "complete" (it has no number yet) |
| a Focus with the todz filter is on | the shortcuts answer as usual (a pulled request) |
| two todz apps registered (Debug and Release) | the Debug build is named `Todz Dev`, so its phrases are "… in Todz Dev" and the "todz" phrases reach the Release app (ADR 0066 §10) |
| a Siri in another language | the phrases are not heard; the Shortcuts actions still work |

### Siblings

As of 2026-11-25:

- `feat/day-email` edits `AppModel.swift`, `FakeOwnerService.swift`, `FakeCall.swift`, `OwnerFixtures.swift`, `SettingsView.swift` and `SettingsCopy.swift`, none of which this feature edits (its model code is new `AppModel+Shortcuts.swift` and new types; its tests build on `AppModelHarness` as it is). It also edits `apps/macos/README.md`, `docs/product/README.md`, `docs/features/README.md` and `docs/adr/README.md`, which Step 12 and the index rows edit too.
- `lane/day-temperature-g1` edits `apps/macos/Todz/AppDelegate.swift`, `TodzApp.swift`, `MenuBar/MenuBarLabel.swift`, `AppModel.swift`, `AppModel+Widgets.swift`, `Copy/SettingsCopy.swift` and `Settings/SettingsView.swift`; `lane/day-temperature-g2` edits the widget snapshot files and views. This feature shares with them `AppDelegate.swift` (it edits the initializer, and `applicationDidFinishLaunching` for ADR 0066 §11; day-temperature edits the stored properties and `applicationDidFinishLaunching` too), `TodzApp.swift` (only through a backout) and the two index READMEs.
- Step 12's README edits are made after `origin/main` holds day-email, or its paragraph is merged by hand. Step 10a's edit of `AppDelegate.applicationDidFinishLaunching` or `TodzApp.swift` is named to day-temperature's lane before it is committed.
- Whichever branch merges second merges `origin/main` into itself, never rebases, and keeps both sides.

### Rollback

Revert the app change. The system forgets the shortcuts at the next build; a library shortcut the owner built on them reports its action as missing. No data to undo: every write was an ordinary outbox change.

## Open questions → answers

| Question | Options | Owner's answer | Date |
|----------|---------|----------------|------|
| Where do the intents live? | the app target; an App Intents extension; TodzKit | the loop's call: the app target over `AppModel` (ADR 0066 §1) | 2026-11-25 |
| Where does "add" put the task? | the Inbox due today; the Inbox with no date; ask | the loop's call: the menu bar's destination, Inbox due today, with a `Due Today` switch in the editor (§3) | 2026-11-25 |
| Which tasks can "complete" reach? | Today only; the active workspace's open tasks; every workspace | the loop's call: suggestions from Today, matching across the active workspace's open tasks (§3) | 2026-11-25 |
| A task in the phrase? | yes, with `updateAppShortcutParameters()`; no, Siri asks | the loop's call: no (§4) | 2026-11-25 |
| A Settings switch? | an off-by-default switch; none | the loop's call: none, a Shortcut is pulled (§6) | 2026-11-25 |
| Gated by Focus? | yes; no | the loop's call: no (§7) | 2026-11-25 |
| Confirm before completing? | yes; no | the loop's call: no, one click undoes it and the dialog names the task (§3) | 2026-11-25 |

## Test strategy summary

Swift tests in the TodzKit test target for the identifier, the readiness (each outcome, the 5 s bound, a launch it starts without awaiting, a cache with the pull held or answered), the sentence chosen from Today (none, one, three, four, seven), Today's answer (empty, one, five, seven, overdue, pending excluded, offline, workspace name), the three entity reads (suggestions capped and ordered, matching by case, diacritics and emoji, Today first, capped, other workspaces excluded, ids in any state), the add (each destination, the selection kept, blank and too long refused, offline queued, signed out, no workspace) and the complete (open, already done, gone, another workspace, offline queued, signed out). Debug and Release builds with the metadata and the entitlements read from the product. A walk that drives the Debug app through library shortcuts run with `shortcuts run`, with a single Shortcuts window session for the import and the screenshots. Siri's voice is the owner's Human checklist.
