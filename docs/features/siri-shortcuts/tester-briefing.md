# Tester briefing: Siri shortcuts

Written by the developer sub-agents when their steps are done, each in its own section: G1 (TodzKit) and G2 (the app). The developers do not run `test-plan.md` and do not declare the feature works.

## G1

### What changed

Everything below is on `lane/siri-shortcuts-g1`, in `apps/macos/TodzKit`. Commits in order: red `a46edc4`, green `c54f9c5`, red `5668cc1`, red `f5b1c76`, `b56dc4b`, green `e72f1be`, then the merge of `origin/main` `960afb5`.

Sources (`Sources/TodzKit`):

- `ShortcutLimits.swift` — `readinessWait` 5 s (`// NB ADR 0066`), `taskLimit` 10, `spokenTitleLimit` 3.
- `TaskKey+Shortcut.swift` — `shortcutIdentifier` (`<project identifier>/<number>`) and `TaskKey(shortcutIdentifier:)`, split at the last `/` (`// NB ADR 0066` on the separator); the number must be positive and written exactly as `String(number)` writes it, so `+3`, `03` and ` 3` are no key.
- `ShortcutTask.swift` — `key`, `title`, `projectName`; built only from a board task (`ShortcutTask.of(_:)`), which always has its number. Not in the plan's file map: one type per file.
- `ShortcutTodaySentence.swift` — `nothingLeft`, `withTitles`, `withFirstTitles`. Not in the plan's file map: one type per file.
- `ShortcutToday.swift` — `workspaceName`, `content` (the morning glance's content), `tasks` (every open Today task, Today's order), `isOffline`; `sentence` and `spokenTitles` (the first three titles).
- `ShortcutReadiness.swift`, `ShortcutAddDestination.swift` (with the internal `sidebarItem`), `ShortcutAddition.swift`, `ShortcutCompletion.swift` — the enums of the spec's Interfaces.
- `AppModel+Shortcuts.swift` — `shortcutToday`, `shortcutSuggestedTasks`, `shortcutTasks(matching:)`, `shortcutTasks(for:)`, `shortcutReadiness()`, `addFromShortcut(title:isDueToday:)`, `completeFromShortcut(key:)`.
- `AppModel.swift` — one line: `isLaunchSettled` lost `@ObservationIgnored`, so the readiness wakes when a launch started elsewhere (the menu bar label's `.task`) settles. A file-map exception the lead approved (plan R21), committed alone as `b56dc4b` after its red test `f5b1c76`.

Tests (`Tests/TodzKitTests`): `TaskKeyShortcutTests.swift`, `AppModelTests+ShortcutReads.swift`, `AppModelTests+ShortcutReadiness.swift`, `AppModelTests+ShortcutWrites.swift`, and `ShortcutHarness.swift` (`shortcutHarness(inboxTasks:)`, `todayHarness(openCount:dueDaysFromToday:)`, `cachedHarness(cachedTitle:pulledTitle:)`). No existing harness file was edited.

### How to run

```
swift build --package-path apps/macos/TodzKit --build-tests
swift test --package-path apps/macos/TodzKit --skip-build --no-parallel --filter TaskKeyShortcutTests/<test>
swift test --package-path apps/macos/TodzKit --skip-build --no-parallel --filter AppModelTests/<test>
swift test --package-path apps/macos/TodzKit
```

The whole package after the merge `960afb5`: `Test run with 1099 tests in 82 suites passed`.

### Red runs, one process per test

Each test below was run alone at its red commit with `swift test --package-path apps/macos/TodzKit --skip-build --no-parallel --filter <Suite>/<test>` after `swift build --build-tests`; the line is the `Fatal error` it printed. A parameterized test stops on its first argument.

Step 1, red `a46edc4`:

| Test | Printed |
|---|---|
| `TaskKeyShortcutTests/aKeyIsItsProjectAndNumberAndBack` | `TodzKit/TaskKey+Shortcut.swift:3: Fatal error: TaskKey.shortcutIdentifier is not implemented` |
| `TaskKeyShortcutTests/aProjectIdentifierHoldingDashesRoundTrips` | `TodzKit/TaskKey+Shortcut.swift:3: Fatal error: TaskKey.shortcutIdentifier is not implemented` |
| `TaskKeyShortcutTests/aMalformedIdentifierIsNoKey` | `TodzKit/TaskKey+Shortcut.swift:7: Fatal error: TaskKey.init(shortcutIdentifier:) is not implemented` |
| `TaskKeyShortcutTests/theLastSeparatorSplitsTheNumberFromTheProject` | `TodzKit/TaskKey+Shortcut.swift:7: Fatal error: TaskKey.init(shortcutIdentifier:) is not implemented` |
| `TaskKeyShortcutTests/aNumberThatDoesNotRoundTripIsNoKey` | `TodzKit/TaskKey+Shortcut.swift:7: Fatal error: TaskKey.init(shortcutIdentifier:) is not implemented` |
| `AppModelTests/theShortcutTodayIsNoneWhileTodayLoads` | `TodzKit/AppModel+Shortcuts.swift:3: Fatal error: AppModel.shortcutToday is not implemented` |
| `AppModelTests/theShortcutTodayIsNoneWhileSignedOut` | same as above |
| `AppModelTests/anEmptyTodayAnswersNothingOpenWithNoRowsAndNoTasks` | same as above |
| `AppModelTests/oneOpenTaskIsOneRowAndOneTask` | same as above |
| `AppModelTests/fiveOpenTasksAreFiveRowsAndFiveTasks` | same as above |
| `AppModelTests/sevenOpenTasksAreFiveRowsTwoMoreAndSevenTasksInTodaysOrder` | same as above |
| `AppModelTests/anOverdueTaskStaysOnItsRowMarkedOverdue` | same as above |
| `AppModelTests/aPendingTaskIsNeitherCountedNorListedInTheShortcutToday` | same as above |
| `AppModelTests/theShortcutTodayNamesTheActiveWorkspace` | same as above |
| `AppModelTests/theShortcutTodayIsOnlineAfterAnAnsweredPull` | same as above |
| `AppModelTests/theShortcutTodayIsOfflineAfterAnUnreachablePullWithACache` | same as above |
| `AppModelTests/nothingOpenIsTheNothingLeftSentenceWithNoTitles` | `TodzKit/ShortcutToday.swift:8: Fatal error: ShortcutToday.sentence is not implemented` |
| `AppModelTests/oneOpenTaskIsSpokenWithItsTitle` | same as above |
| `AppModelTests/threeOpenTasksAreSpokenWithEveryTitle` | same as above |
| `AppModelTests/fourOpenTasksAreSpokenWithTheFirstThreeTitles` | same as above |
| `AppModelTests/sevenOpenTasksAreSpokenWithTheFirstThreeInTodaysOrder` | same as above |
| `AppModelTests/theSuggestionsAreTodaysOpenTasksInTodaysOrderAtMostTen` | `TodzKit/AppModel+Shortcuts.swift:7: Fatal error: AppModel.shortcutSuggestedTasks is not implemented` |
| `AppModelTests/aTaskDoneTodayIsNeverSuggested` | same as above |
| `AppModelTests/anUndatedInboxTaskIsNotSuggested` | same as above |
| `AppModelTests/matchingIgnoresCase` | `TodzKit/AppModel+Shortcuts.swift:11: Fatal error: AppModel.shortcutTasks(matching:) is not implemented` |
| `AppModelTests/matchingIgnoresDiacritics` | same as above |
| `AppModelTests/matchingFindsATitleThatStartsWithAnEmoji` | same as above |
| `AppModelTests/aTodayMatchComesBeforeAnUndatedOne` | same as above |
| `AppModelTests/anUpcomingMatchComesAfterTodaysOne` | same as above |
| `AppModelTests/twelveMatchesAreTen` | same as above |
| `AppModelTests/aBlankTextMatchesNothing` | same as above (argument `""`) |
| `AppModelTests/aDoneTaskNeverMatches` | same as above |
| `AppModelTests/aTaskOfAnotherWorkspaceNeverMatches` | same as above |
| `AppModelTests/aPendingAddNeverMatches` | same as above |
| `AppModelTests/keysResolveOpenAndDoneTasksOfTheActiveWorkspaceInTheOrderAsked` | `TodzKit/AppModel+Shortcuts.swift:15: Fatal error: AppModel.shortcutTasks(for:) is not implemented` |
| `AppModelTests/anUnknownKeyAndAKeyOfAnotherWorkspaceAreDropped` | same as above |
| `AppModelTests/keysResolveNothingWhileSignedOut` | same as above |

Step 3, red `5668cc1`:

| Test | Printed |
|---|---|
| `AppModelTests/aLaunchedLoadedModelIsReadyWithoutWaiting` | `TodzKit/AppModel+Shortcuts.swift:40: Fatal error: AppModel.shortcutReadiness() is not implemented` |
| `AppModelTests/anUnlaunchedModelWithACacheIsReadyWithThePulledTasksOnceThePullAnswers` | same as above |
| `AppModelTests/anUnlaunchedModelWithACacheAndThePullHeldAnswersTheCacheMarkedOfflineAfterTheWait` | same as above |
| `AppModelTests/aModelWithNoSessionIsSignedOut` | same as above |
| `AppModelTests/aSessionWithNoWorkspaceHasNoWorkspace` | same as above |
| `AppModelTests/aListingHeldPastTheWaitIsStillLoadingAndTheLaunchIsNotAwaited` | same as above |
| `AppModelTests/aListingAnsweredBeforeTheWaitEndsIsReady` | same as above |
| `AppModelTests/aSignOutWhileWaitingIsSignedOut` | same as above |
| `AppModelTests/anAddDueTodayGoesToTheInboxDueToday` | `TodzKit/AppModel+Shortcuts.swift:44: Fatal error: AppModel.addFromShortcut(title:isDueToday:) is not implemented` |
| `AppModelTests/anAddNotDueTodayGoesToTheInboxWithNoDate` | same as above |
| `AppModelTests/anAddKeepsTheSelectedTaskSelected` | same as above |
| `AppModelTests/aBlankTitleIsRefusedAndNothingIsQueued` | same as above (argument `""`) |
| `AppModelTests/aTitleOfTwoHundredCharactersIsAdded` | same as above |
| `AppModelTests/aTitleOfTwoHundredAndOneCharactersIsRefusedAndNothingIsQueued` | same as above |
| `AppModelTests/anEmojiTitleIsKeptAsTyped` | same as above |
| `AppModelTests/anAddWhileOfflineSaysSoAndKeepsTheChangeInTheStore` | same as above |
| `AppModelTests/anAddWhileSignedOutIsSignedOutAndQueuesNothing` | same as above |
| `AppModelTests/anAddWithNoWorkspaceHasNoWorkspaceAndQueuesNothing` | same as above |
| `AppModelTests/anAddAfterAWorkspaceSwitchGoesToTheNewInboxAndNamesIt` | same as above |
| `AppModelTests/anOpenTodayTaskIsCompleted` | `TodzKit/AppModel+Shortcuts.swift:48: Fatal error: AppModel.completeFromShortcut(key:) is not implemented` |
| `AppModelTests/anOpenUndatedInboxTaskIsCompleted` | same as above |
| `AppModelTests/aDoneTaskIsAlreadyDoneAndNothingIsQueued` | same as above |
| `AppModelTests/anUnknownNumberIsNotFound` | same as above |
| `AppModelTests/aTaskOfAnotherWorkspaceIsNotFoundAndNothingIsQueued` | same as above |
| `AppModelTests/aCompletionWhileOfflineSaysSoAndKeepsTheChangeInTheStore` | same as above |
| `AppModelTests/aCompletionWhileSignedOutIsSignedOut` | same as above |
| `AppModelTests/completingTheSameTaskTwiceAnswersAlreadyDoneTheSecondTime` | same as above |

The Step 4 green commit also changed the Step 3 tests in one way: the six write tests that suspend `.addTasks` or `.completeTasks` now `await harness.service.held(…)` before `resume(…)`. Without it the resume can run before the send loop reaches the request, which then stays held and `flushed()` never returns (seen as a hang, not a failure). The red text is unchanged: the stub stops before either line.

R21, red `f5b1c76`: `AppModelTests/theLaunchSettlingIsObserved` run alone printed `Expectation failed: change.isSeen` (an assertion, not a stub: `isLaunchSettled` still carried `@ObservationIgnored`); green at `b56dc4b`.

Without the `AppModel.swift` line, Step 4's code hangs exactly two tests, `anUnlaunchedModelWithACacheIsReadyWithThePulledTasksOnceThePullAnswers` and `aListingAnsweredBeforeTheWaitEndsIsReady` (killed after 20 s), and passes the other six readiness tests.

### Hypotheses for the tester

- A launched model with Today known answers `.ready` at once, without starting the 5 s pause.
- A model the system launched cold with a cache answers `.ready` once the first pull answers, with the pulled tasks and `isOffline` false; with the pull held, it answers after 5 s with the cached tasks and `ShortcutToday.isOffline` true (`isOffline || !isLaunchSettled`).
- Signed out answers `.signedOut`, a session with no workspace `.noWorkspace`, and with no cache and the listing still out after 5 s `.loading`, while the launch goes on.
- A sign-out during the wait answers `.signedOut` and cancels the pause.
- "What's left" counts and lists exactly what the menu bar count and the morning glance count (pending adds excluded), names the active workspace, and speaks at most three titles (`withTitles` up to three, `withFirstTitles` above).
- Suggestions are Today's open tasks, at most ten; matching ignores case and diacritics, finds text after an emoji, puts Today's matches first, then the other open tasks project by project in sidebar order, at most ten; blank text, done tasks, pending adds and other workspaces never match.
- `shortcutTasks(for:)` resolves keys of the active workspace in any state, in the order asked, with the outbox applied, and nothing while signed out.
- An add goes to the active workspace's Inbox, due today or undated, keeps the window's selection, refuses a blank or 201-character title without queuing anything, and says `isOffline` when the model is offline; the change is in the stored outbox.
- A completion of an open task in the active workspace queues one `.state(key, .done, …)`; a done task (or one already completed by a waiting change) answers `.alreadyDone`; an unknown key or one of another workspace answers `.notFound`.

### Known gaps

- `addFromShortcut` and `completeFromShortcut` test the session, not the phase: with a session, the phase `.loading` and no active workspace, an add answers `.noWorkspace`. The intents call `shortcutReadiness()` first, so they only reach this on a change between the two calls.
- A valid add goes through `addTask`, which clears a rule issue the window may be showing on the Inbox add field (`ruleIssues[.newTask(projectIdentifier:)]`), as any add there does.
- `shortcutTasks(matching:)` trims whitespace and newlines and matches with `localizedStandardContains`, so the match follows the current locale's rules.
- The readiness's wake tasks are fire-and-forget (no stored property: G1 adds no stored state to `AppModel`); a wait whose model is released ends at the bound.
- `ShortcutToday.isOffline` is true for a model that signed in without `launch()` ever running; the app always launches first.

## G2

### What changed

- `apps/macos/Todz/Shortcuts/`: `LeftTodayIntent`, `AddTaskIntent`, `CompleteTaskIntent`, `TodzTaskEntity`, `TodzTaskQuery` (an `EntityStringQuery` whose methods throw the refusal), `TodzShortcuts` (three App Shortcuts, six phrases), `ShortcutRefusal`, `LeftTodaySnippet`. Glue only: every rule is G1's `AppModel` extension.
- `Copy/ShortcutsCopy.swift`: the dialogs; `Todz/Shared/TodayDigest.swift`: the heading, rows and rest line the glance and the snippet both draw (the glance is unchanged, a pin, no red test: the app target has none).
- `AppDelegate`: `AppDependencyManager.shared.add(dependency: self.model)` after `super.init()`; on a launch whose `NSApplication.launchIsDefaultUserInfoKey` is false (an intent launch) the day-close scheduler and the morning glance trigger start the first time the owner activates the app (ADR 0066 §11, measured in its Evidence). The Debug config of `project.yml` sets `INFOPLIST_KEY_CFBundleDisplayName: Todz Dev`.

### How to build and register

`cd apps/macos && xcodegen generate && xcodebuild -project Todz.xcodeproj -scheme Todz -configuration Debug build` (and `Release`): both print `BUILD SUCCEEDED` with no `error:` and no `warning:`. The Shortcuts app found a scratch app's action only after it sat in `~/Applications`, was registered with `lsregister -f` and launched once there (ADR 0066 Evidence); the walk's Preflight must do the same for the Debug product. Library shortcuts for the walk are imported by signing a plist with `shortcuts sign -m anyone`, `open -g -a Shortcuts f.shortcut` and a background click on `Add Shortcut`; the action identifier is `<bundle identifier>.<Intent type name>` (`dev.todz.Todz.debug.LeftTodayIntent`) with an `AppIntentDescriptor` naming `AppIntentIdentifier`, `BundleIdentifier`, `Name` and `TeamIdentifier`. Helpers name the bundle identifier, so `Todz Dev` in the phrases does not matter to them.

### As printed from the products

- Debug `CFBundleDisplayName` `Todz Dev`; Release has no `CFBundleDisplayName` and `CFBundleName` `Todz` (the plan expected `CFBundleDisplayName` `Todz`; nothing reads it, so Release shows `Todz` through its name).
- `extract.actionsdata`, both products: actions `AddTaskIntent`, `CompleteTaskIntent`, `LeftTodayIntent`, `TodzFocusFilter`; entity `TodzTaskEntity`; 3 `autoShortcuts`, 6 phrases (`What's left today in ${applicationName}`, `What do I have today in ${applicationName}`, `Add a task to ${applicationName}`, `New task in ${applicationName}`, `Complete a task in ${applicationName}`, `Check off a task in ${applicationName}`).
- Entitlements, Debug and Release alike: `app-sandbox`, `application-groups`, `get-task-allow`, `network.client`. No Siri key. The Release product printed `get-task-allow` too, which the plan expected absent: this lane edits no entitlement and signs with the same Personal Team, so the key comes from the local signing of the Release configuration; the tester should compare with a Release build of `main`.
- `requestValueDialog` is not part of `extract.actionsdata`; the parameter dialogs come from `ShortcutsCopy` at run time, so the walk must hear `What's the task?` and `Which task?`.

### Tests

`swift test --package-path apps/macos/TodzKit`: 1099 tests in 82 suites passed after merging G1's e72f1be and b56dc4b. Before that merge it aborted on G1's Step 3 stub. G2 adds no unit test: the app target has none. The Debug and Release builds were re-run after the merge with the same output as above.

### Hypotheses for the tester

- A cold `shortcuts run` of a shortcut that calls `LeftTodayIntent` launches the Debug app without a window, a Dock icon, the morning glance or the day-close popover, and the intents answer once the model is ready.
- The result shows the dialog and, in the Shortcuts app, the snippet; whether macOS shows the snippet is design O1's open point.
- Add queues in the outbox and shows in `What's Left Today` once saved; Complete takes the entity chosen by the system's list or typed text.
- The refusals read as the copy says when signed out, with no workspace and still loading.
- After an intent launch, the first time the owner opens the app from the menu bar the glance and the day-close scheduler start.

### Known gaps

- Siri hearing "todz" is unproven (the Human checklist).
- A Shortcut named `ColdSpike` from the spike may remain in the owner's Shortcuts library.
- `requestValueDialog` from a non-literal `LocalizedStringResource` builds, but whether the system honours it at run time is for the walk.
- An activation that comes before the launch's Focus read has settled starts the two surfaces with the gate still at its default (not quiet); the read settles within its timeout, so only an owner who activates within that window could see it.
