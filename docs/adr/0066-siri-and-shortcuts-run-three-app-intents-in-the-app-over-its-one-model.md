# 0066. Siri and Shortcuts run three App Intents in the app, over its one model

- Status: Accepted (the build loop's call, the owner may overturn it)
- Date: 2026-11-25
- Deciders: Claude (the build loop's call, pending the owner); Dhyego Calota (owner) chose idea 10 from the loop's `proactive-day` list: App Intents for "what's left today in todz?", "add a task to todz" and "complete …", as Shortcuts and Siri phrases; every item that acts on its own is opt-in, off by default
- Inspired by: [ADR 0054](0054-the-app-learns-focus-through-a-todz-focus-filter-not-the-focus-status-api.md) (an App Intent in the app with an `AppDependencyManager` dependency, built with the Personal Team; agents are not gated), [ADR 0033](0033-without-a-team-the-widgets-share-a-folder-in-application-support-that-an-app-group-replaces-later.md) (the widget's out-of-process intent and its request route), [ADR 0031](0031-the-menu-bar-extra-is-a-swiftui-window-over-the-app-s-one-model.md) (one model, launched by whichever surface asks first), [ADR 0036](0036-the-menu-bar-icon-counts-today-s-open-tasks-behind-a-setting.md) (what Today's count is), [ADR 0062](0062-the-morning-glance-is-a-non-activating-glass-panel-that-shows-today-on-the-first-wake-or-unlock-of-the-day.md) (the five-row Today content), the run-19 spike below, Apple's App Intents documentation (Evidence)

## Context

The owner wants to ask todz what is left today, add a task and complete one without opening the app, by voice with Siri or from the Shortcuts app. The widgets already complete tasks through an App Intent, and the Focus filter is an App Intent in the app.

The app has one model (`AppModel`) that owns the session, the cache, the outbox of changes waiting for the server and the views of Today. Every write the owner makes goes through it: a change is queued in the outbox, saved on disk, and sent when the server answers. The widget extension cannot reach the model, so its checkbox writes a request into the App Group and the app takes it (ADR 0033).

The proactive-day items are opt-in where they would act on their own. A Shortcut never acts on its own: it runs only when the owner says its phrase or runs it.

The signing is the free Personal Team `XFWR794VS8` (ADR 0035); there is no paid Apple Developer membership. SiriKit's older intents need the Siri capability; App Intents and App Shortcuts are a different mechanism that declares no entitlement (Evidence).

## Decision

1. **Three App Intents and one `AppShortcutsProvider` live in the app target**, under `Todz/Shortcuts/`, as the Focus filter does. Each intent reads the app's `AppModel` through `@Dependency`; the `AppDelegate` registers the model with `AppDependencyManager` in its initializer, beside the gate. The intents keep only glue; every rule they follow is a `TodzKit` type or `AppModel` extension with its own tests. `openAppWhenRun` stays false: the app answers without coming to the front. When todz is not running, the system launches it to run the intent, and it starts in the menu bar as at login.
2. **One write path.** "Add" calls `AppModel.addTask(title:projectIdentifier:dueDate:selection:)` and "Complete" calls `AppModel.complete(task:)`: both queue a change in the outbox, so an add or a completion while offline is kept on disk and sent when the server answers, exactly as a change made in the window. The widget's App Group request route is not used: it exists only because the widget runs outside the app.
3. **The three intents.**
   - **What's left today** (`LeftTodayIntent`): Today of the active workspace as the menu bar count reads it (`taskViews.today.open`; a task added but not yet saved is neither counted nor listed, as in the count and the glance). Its dialog speaks the count with the workspace's name and up to three titles; its snippet lists up to five rows and counts the rest, the morning glance's content (`AppModel.morningGlanceContent`); it returns Today's open tasks as entities, so a shortcut can chain them.
   - **Add a task** (`AddTaskIntent`): one `Title` parameter that Siri asks for, and a `Due Today` switch, on by default, that only the Shortcuts editor shows. It adds where the menu bar's Add field adds: the active workspace's Inbox, due today (`addTaskDestination(for: .today)`); with `Due Today` off, the Inbox with no date (`addTaskDestination(for: .inbox)`). The title follows `TextCheck`, the main window's selection is kept (`.keepSelection`), and it returns the title as saved.
   - **Complete a task** (`CompleteTaskIntent`): one `Task` parameter, a `TodzTaskEntity` whose identifier is the task's project identifier and number. Its `EntityStringQuery` suggests Today's open tasks of the active workspace, at most ten in Today's order; matches a spoken or typed text against the titles of every open task of the active workspace, ignoring case and diacritics, Today's first, at most ten; and resolves an identifier only inside the active workspace, in any state. Several matches are the system's disambiguation; a task already done answers that it is done and writes nothing; a task no longer in the active workspace answers that it is gone. There is no confirmation: a completion is undone with one click in the app, and the dialog names the task.
4. **The phrases are fixed English sentences with the app's name and no parameter.** "What's left today in todz", "Add a task to todz", "Complete a task in todz", each with one or two variants. A `String` parameter cannot sit in a phrase (the build fails, spike). A task entity could ("Complete Review the PR in todz"), but the app would then hand every open title to Siri's vocabulary with `updateAppShortcutParameters()` after every change; Siri asks "Which task?" instead and lists Today's.
5. **Each intent waits for the model, at most 5 seconds.** It calls `AppModel.launch()` (a no-op once launched, ADR 0031) and waits until Today of the active workspace is known, the owner is signed out, or no workspace exists, whichever comes first, at most `ShortcutLimits.readinessWait`. Signed out, no workspace yet, or Today still unknown after the wait: the intent throws a refusal whose message tells the owner what to do; nothing is written. Offline with a cache: it answers from the cache and says that todz is offline.
6. **No Settings switch.** An App Shortcut is pulled, never pushed: it does nothing until the owner says its phrase or runs it, which is the opt-in the proactive-day rule asks for. A switch could not hide the shortcuts either: the provider is static metadata read at install, so a switch would only turn three listed shortcuts into three refusals. The owner who does not want them hides them in the Shortcuts app or in Siri's settings, which the system already offers per app.
7. **Focus does not gate them.** The `ProactiveGate` quiets what todz shows on its own (ADR 0054); a Shortcut answers a request the owner just made, as the agent nudge answers an agent (ADR 0054 §5).
8. **Copy.** The dialogs, the refusals and the snippet's strings live in `Copy/ShortcutsCopy.swift` and the existing copy modules. The titles, descriptions, parameter titles, phrases and short titles stay literals at their declarations, as in `ToggleTaskIntent` and `TodzFocusFilter`: the App Intents metadata processor reads them from the source at build time.
9. **Privacy.** Titles reach only the dialog, the snippet and the returned value of a run the owner started; nothing is logged.

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| The intents in the app target over `AppModel` (chosen) | one write path, the outbox, the session and the cache for free; the Focus filter's proven shape | a cold run launches the app | the launch is the menu bar start the owner already knows |
| An App Intents extension | runs without the app | always in the background, cannot reach `AppModel`; needs a second write path through the App Group and a second reader of Today | two write paths is what the outbox exists to avoid |
| The intents in `TodzKit` | next to the logic | Apple ships intents from a package only as a binary framework; `TodzKit` is a source package linked statically; the provider must sit in the app anyway | not supported for this package |
| The widget's request route for add and complete | already exists | built for an out-of-process checkbox on Today's tasks only; cannot add | the app is in process |
| A task entity in the "complete" phrase | one sentence | every title handed to Siri's vocabulary after every change; stale titles between updates | privacy and churn for little gain |
| A `String` in the "add" phrase ("Add buy milk to todz") | one sentence | rejected by the metadata processor | does not build (spike) |
| "Add" to the Inbox with no date | plain capture | differs from the menu bar's Add field; "what's left" would not show it | the Shortcuts editor offers it through `Due Today` |
| Search every workspace in "complete" | finds anything | the app shows and loads only the active workspace; a title can repeat across companies | the active workspace, as every other surface |
| Ask for confirmation before completing | no wrong completion | one more turn for an action one click undoes | the dialog names the task |
| A Settings switch, off by default | the letter of the opt-in rule | cannot hide the shortcuts; turns them into refusals | a pulled action is already opt-in (§6) |
| The Siri capability or SiriKit intents | older Siri domains | a paid team; deprecated in favour of App Intents | not needed |

## Consequences

- No new entitlement, provisioning profile or paid membership: the spike's signed build carries the same four entitlement keys as today.
- The shortcuts appear in the Shortcuts app and in Spotlight once the app has launched; Siri answers the phrases in English only. A Siri set to another language does not hear them until the phrases are localized (Revisit).
- The Debug and the Release apps are both named Todz and both register the shortcuts; Siri runs one of them. The owner's Siri should run the Release app in `/Applications`; the walk runs the Debug app through Shortcuts actions that name its bundle.
- A completion from Siri lands in the task's history as the owner's change, as one made in the window.
- "What's left" and the menu bar count can never disagree: they read the same list.
- A pending task (added while offline, not yet saved) cannot be completed by voice until it is saved, since it has no number yet.

## Evidence

- Spike, 2026-11-25, run 19 (scratch worktree, not committed), Xcode 27.2 (27B52), macOS 26.6.2, the app target as on `main` plus one file with an `AppEntity` over an `EntityStringQuery`, three `AppIntent`s and an `AppShortcutsProvider`; signed with the Personal Team, Manual style, no profile:
  - `xcodebuild build -configuration Debug`: BUILD SUCCEEDED, zero `warning:` lines;
  - `Contents/Resources/Metadata.appintents/extract.actionsdata` lists the three intents beside `TodzFocusFilter`, the entity, and three `autoShortcuts` with the phrases `What's left today in ${applicationName}`, `Add a task to ${applicationName}`, `Complete a task in ${applicationName}`;
  - `codesign -dv --entitlements -`: `TeamIdentifier=XFWR794VS8`, keys `app-sandbox`, `application-groups`, `get-task-allow`, `network.client`, nothing for Siri;
  - a phrase `Add \(\.$title) to \(.applicationName)` with a `String` title: BUILD FAILED, `error: 'AppEntity' and 'AppEnum' are the only allowed types for 'title'`, and the processor exported no metadata;
  - a phrase `Complete \(\.$task) in \(.applicationName)` with the entity: BUILD SUCCEEDED.
- Apple, [Configuring the runtime behavior of your App Intents](https://developer.apple.com/documentation/appintents/configuring-the-runtime-behavior-of-your-app-intents): code in the app bundle runs in the foreground or the background; an App Intents extension only in the background; intents in a Swift package need a binary framework.
- Apple, [EntityStringQuery](https://developer.apple.com/documentation/appintents/entitystringquery), [suggestedEntities()](https://developer.apple.com/documentation/appintents/entityquery/suggestedentities()), [updateAppShortcutParameters()](https://developer.apple.com/documentation/appintents/appshortcutsprovider/updateappshortcutparameters()), [Creating your first app intent](https://developer.apple.com/documentation/appintents/creating-your-first-app-intent) (`ReturnsValue`, `ProvidesDialog`, `ShowsSnippetView`, and the note that Siri may not show the dialog or the snippet), [AppShortcutPhraseToken.applicationName](https://developer.apple.com/documentation/appintents/appshortcutphrasetoken/applicationname).
- Apple Developer Forums, [thread 764609](https://developer.apple.com/forums/thread/764609) and [thread 692764](https://developer.apple.com/forums/thread/692764): developers report that a macOS target offers no Siri capability to add. Not proven here: that Siri speaks the phrases with this signature; it is the owner's step in the test plan's Human checklist.
- This Mac: `/usr/bin/shortcuts` offers `run`, `list`, `view` and `sign`; `list` shows only the library, so the walk imports small library shortcuts that call the intents (test plan).

## Revisit when

- The owner wants the phrases in Portuguese: an `AppShortcuts.xcstrings` catalog, with the locale ADR the AGENTS.md copy rule names.
- The owner wants "complete" by title in one sentence: a task entity in the phrase and `updateAppShortcutParameters()` on every change of Today.
- Apple lets App Shortcuts be turned off at run time, or the owner asks for a switch anyway.
