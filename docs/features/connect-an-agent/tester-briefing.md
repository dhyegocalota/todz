# Tester briefing: Connect an agent

Written by the developer sub-agents when their steps are done. The developers do not run `test-plan.md` and do not declare the feature works.

## G1 model

### What changed

- `apps/macos/TodzKit/Sources/TodzKit/ProjectKey.swift`, `IssuedKey.swift`: a key (`id` → `identifier`, `hint`, `created_at` in epoch milliseconds) and an issue answer (`key`, `secret`), decoded through `OwnerCoding`.
- `OwnerAPI.swift`, `OwnerEnvelopes.swift`: `OwnerService` gains `listKeys`, `issueKey` and `revokeKey` on `/owner/projects/:projectId/keys[/:keyId]`; listing unwraps `KeysAnswer`, issuing posts no body.
- `AgentTool.swift`, `AgentClient.swift`, `AgentCommand.swift`: the five tools in server order; `AgentCommand.of(client:serverURL:key:)` returns `.claudeCode(line:)`, `.codex(configuration:shellLine:)` or `.cursor(json:)`; `AgentCommand.cursorLink(serverURL:secret:)` builds the Cursor install link; `AgentCommand.serverURL(apiBase:)` is the API base plus `/mcp`.
- `SidebarItem.swift`: `case connectAgent`.
- `KeyList.swift` (`loading`, `loaded([ProjectKey])`, `failed(KeyFailure)`), `KeyFailure.swift` (`unreachable`, `unexpected`).
- `AppModel.swift`: the screen's state (`keyProjectIdentifier`, `keys`, `issuedKey`, `isIssuing`, `issueFailure`, `revokingKeyIdentifiers`, `failedRevokeIdentifiers`), `selectedItem.didSet` follows the screen, `forgetWindow()` forgets the keys.
- `AppModel+Keys.swift`: `showKeys(projectIdentifier:)`, `loadKeys()`, `issueKey()`, `revokeKey(_:)`, `hideKey()`, `forgetKeys()`.
- `AppModel+Workspaces.swift`: a workspace switch forgets the keys (`forgetActiveWorkspace`) and the screen follows the new Inbox (`keepSelection(in:)`).
- `.connectAgent` added to every switch over `SidebarItem` with no title, no task list and no add field: `AppModel+Destinations.swift`, `TaskViews.swift`, `CompletionLingers.swift`, and in the app `AppModel+Window.swift`, `Shared/SidebarItem+Presentation.swift` (symbol `powerplug`; `emptyTitle` and `emptyBody` stop with `preconditionFailure`), `MainWindowState.swift` (`hasNoAddField`), `MainWindow/TaskList/TaskSections.swift` (no sections).
- Tests: `ProjectKeyTests.swift`, `OwnerAPITests+Keys.swift`, `AgentCommandTests.swift`, `AppModelTests+Keys.swift`; `FakeOwnerService`, `FakeCall` and `OwnerFixtures` gain keys; `OwnerAPITests.swift`'s two request helpers lose `private`.

### How to run

```bash
cd apps/macos/TodzKit && swift test
swift test --filter "ProjectKeyTests|OwnerAPITests|AgentCommandTests|AppModelTests"
xcodegen generate --spec apps/macos/project.yml
xcodebuild build -project apps/macos/Todz.xcodeproj -scheme Todz -configuration Debug -derivedDataPath apps/macos/build
```

`swift test`: 475 tests before G1, 526 after, all green. The app builds with no new warning. Nothing in G1 is visible in the app: no sidebar row reaches `.connectAgent` yet.

### Red today, green after

Each red was run alone: a `fatalError` stub aborts the process at the first call.

| Test | Red commit and printed failure | Green commit |
|------|--------------------------------|--------------|
| `ProjectKeyTests` (all five) | 6e4d6d9: `TodzKit/ProjectKey.swift:15: Fatal error: ProjectKey is not implemented`; `TodzKit/IssuedKey.swift:8: Fatal error: IssuedKey is not implemented` | 49aca89 |
| `OwnerAPITests` key tests (serialized suite) | b88a31c: `TodzKit/OwnerAPI.swift:137: Fatal error: listKeys is not implemented` | 5c8e721 |
| `AgentCommandTests.claudeCodeIsOneLine…`, `codexIsAConfiguration…`, `cursorIsTheMCPJSON…`, `thePlaceholderTakes…` | 15be17e: `TodzKit/AgentCommand.swift:9: Fatal error: AgentCommand.of is not implemented` | 340f8aa |
| `AgentCommandTests.theCursorLinkCarries…`, `theCursorLinkEncodes…` | 15be17e: `TodzKit/AgentCommand.swift:13: Fatal error: AgentCommand.cursorLink is not implemented` | 340f8aa |
| `AgentCommandTests.theServerURLIsTheAPIBasePlusMCP` | 15be17e: `TodzKit/AgentCommand.swift:17: Fatal error: AgentCommand.serverURL is not implemented` | 340f8aa |
| `AgentCommandTests.theToolsAreTheFive…`, `theClientsAre…`, `aSecretHoldsNoCharacter…` | pin, green on landing | 15be17e |
| `AppModelTests.enteringFromAProjectShowsItsKeysAndClearsTheSelectedTask` | cae17a7: `Expectation failed: harness.model.keyProjectIdentifier == launchIdentifier` | 86a2bf0 |
| `AppModelTests.enteringFromAViewShowsTheInboxKeys(item:)` | cae17a7: `Expectation failed: harness.model.keyProjectIdentifier == inboxIdentifier` | 86a2bf0 |
| `AppModelTests.aListFailureIsShown(failure:expected:)` | cae17a7: `Expectation failed: harness.model.keys == .failed(expected)` | 86a2bf0 |
| `AppModelTests.aListForAGoneProjectFallsBackToTheInbox`, `aGoneInboxShowsTheListFailure` | cae17a7: `Expectation failed: harness.model.keyProjectIdentifier == inboxIdentifier` | 86a2bf0 |
| `AppModelTests.anUndecodableListIsAnUnexpectedFailure` | cae17a7: `Expectation failed: harness.model.keys == .failed(.unexpected)` | 86a2bf0 |
| `AppModelTests.issuingAppends…` and every test that issues first (hide, leaving by sidebar, revealed task, widget link, sign-out, ended session, workspace switch, quiet reload, revoke, failed, offline and late issues, issue for a gone project, choosing another project) | cae17a7: `TodzKit/AppModel+Keys.swift:11: Fatal error: issueKey is not implemented` | 86a2bf0 |
| `AppModelTests.aProjectOutsideTheActiveWorkspaceIsNotShown` | cae17a7: `TodzKit/AppModel+Keys.swift:3: Fatal error: showKeys is not implemented` | 86a2bf0 |
| `AppModelTests.aKeyAlreadyRevokedLeaves…`, `aFailedRevokeKeeps…` | cae17a7: `TodzKit/AppModel+Keys.swift:15: Fatal error: revokeKey is not implemented` | 86a2bf0 |
| `AppModelTests.aReloadKeepsTheListedKeysUntilItAnswers` | cae17a7: `TodzKit/AppModel+Keys.swift:7: Fatal error: loadKeys is not implemented` | 86a2bf0 |
| `AppModelTests.theKeysShowAsLoadingUntilTheListAnswers`, `aLateListForAProjectNoLongerShownIsDropped` | cae17a7: hang at `service.held(.listKeys)`, no list call is made; killed by hand | 86a2bf0 |
| `AppModelTests.theKeyScreenHasNoAddField` | pin, green on landing | cae17a7 |

Mutation check on 86a2bf0, restored after: removing the showing-identifier guard after a list answer and after an issue answer turned `aLateListForAProjectNoLongerShownIsDropped`, `anIssueAnswerAfterTheProjectChangedShowsNoSecretAndNoError` and `anIssueAnswerAfterLeavingTheScreenShowsNoSecret` red.

### Hypotheses to attack

1. Hypothesis: the Claude Code line, run in a throwaway folder against `wrangler dev`, adds a server named `todz` that lists the five tools. Break it by: pasting the copied line in Terminal, then `claude mcp list`.
2. Hypothesis: the Cursor link opens Cursor's install prompt with the URL and the bearer header. Break it by: decoding the link's `config` by hand and opening it with Cursor installed; the remote shape is followed from `mcp.json`, not from a documented link example (ADR 0034).
3. Hypothesis: no path leaves `.connectAgent` with a secret still in the model. Break it by: issuing, then ⌘1 to ⌘9, a widget tap, a menu bar task, sign-out, a revoked session, a project created from the sidebar.
4. Hypothesis: an issue answer arriving after a project change, a screen change or a sign-out shows nothing. Break it by: throttling the network and changing the picker while "Creating a key…" is shown.
5. Hypothesis: a failed issue lists a key the server committed. Break it by: killing `wrangler dev` mid-issue.
6. Hypothesis: a revoked key is refused by `/mcp` with 401 at once. Break it by: revoking while an agent session is open, then calling a tool.
7. Hypothesis: a 404 for the shown project falls back to the Inbox without a loop. Break it by: deleting the project row on the server while the screen shows it.
8. Hypothesis: the server URL is the API base plus `/mcp` whether or not the configured base ends with a slash.

### Known gaps

- A failed reload replaces a loaded list with `.failed`; the design (§ 1.6) keeps the rows under the failure line. The model has no state for both.
- A list answer started before an issue and arriving after it can overwrite the appended key until the next reload.
- The keys keep the server's order, oldest first; the design shows newest first, so the view reverses them.
- Nothing logs a secret, but the model holds it in an `@Observable` property while the screen shows it; no test reads logs.
- The `AppModelTests+Races.swift:95` warning in the test build predates G1.

### What G2 must build and wire

- Route `.connectAgent` in `MainWindow.swift` to the key screen before any task list: `SidebarItem.emptyTitle` and `emptyBody` stop the app with `preconditionFailure` for it, and `TaskSections` gives it no sections.
- The sidebar row (`powerplug`, `ConnectAgentCopy.title`), outside `SidebarItem.views`; `title(in:)` is `nil` for it.
- The picker calls `model.showKeys(projectIdentifier:)`; Try Again and ⌘R call `model.loadKeys()`; Create calls `model.issueKey()`; Revoke… confirms, then `model.revokeKey(_:)`; Hide Key calls `model.hideKey()`.
- Read `keys`, `issuedKey`, `isIssuing`, `issueFailure` (`unreachable` → `ErrorCopy.networkBody`, `unexpected` → `ErrorCopy.serverBody`), `revokingKeyIdentifiers`, `failedRevokeIdentifiers`, `keyProjectIdentifier`.
- Blocks: `AgentCommand.of(client:serverURL:key:)` with `issuedKey.secret` or `ConnectAgentCopy.secretPlaceholder`; Add to Cursor only with a secret, through `AgentCommand.cursorLink(serverURL:secret:)`; the server URL from `AgentCommand.serverURL(apiBase:)` with the app's API base; the tools from `AgentTool.allCases`.
- The pasteboard helper with the concealed and transient markers, the copy file, the inspector hidden on this screen, and the `apps/macos/README.md` line.

## G2 screen

### What changed

- `apps/macos/TodzKit/Sources/TodzKit/AppModel.swift`, `AppModel+Keys.swift`: `keyReloadFailure`. A reload that fails while a list is loaded keeps the rows and sets it; the next answer clears it; `forgetKeys()` forgets it. A failure with no list loaded is still `keys == .failed`. This closes G1's first known gap (design § 1.6).
- `AppModel+Pull.swift`: `refresh()` reloads the shown project's keys after the pull, so ⌘R and the toolbar's Refresh reload them (design § 5); away from the key screen it lists no keys.
- `apps/macos/Todz/MainWindow/KeyScreen/` (new): `KeyScreen` (the scroll, the regions of design § 1.2, the toolbar with the offline item and Refresh, no inspector toggle), `KeyScreenHeader` (title and project picker, `ViewThatFits`), `KeyCreation` and `SecretNotice` (§ 1.4), `ClientCommands`, `AddToCursorButton`, `CommandBlock`, `CopyButton` (§ 1.5), `ToolList`, `KeyRows`, `KeyRow` (§ 1.6 and the revoke confirmation), `KeyScreenFailureLine` (a red line announced to VoiceOver), `Text+Fragment` (styles the placeholder in `.secondary` and spells the hint out for VoiceOver), `AppModel+KeyScreen` (the offline reason and the shown project).
- `apps/macos/Todz/Shared/Pasteboard.swift` (new): writes the text and, when it holds a secret, empty `org.nspasteboard.ConcealedType` and `org.nspasteboard.TransientType` entries.
- `apps/macos/Copy/KeyScreenCopy.swift` (new): every string of design § 8, the design's `AccessibilityCopy` lines included.
- `MainWindow.swift`: the detail shows `KeyScreen` for `.connectAgent`, else the task list with its inspector; the minimum width drops the inspector there. `SidebarView.swift`: a last section without a header, one row. `AppCommands.swift`: the inspector item disabled on the screen. `MainWindowState.swift`: `agentClient`, the client chosen while the app runs.
- `apps/macos/README.md`: the key screen in the app's purpose.
- Tests: `AppModelTests+Keys.swift` gains four tests, and `expectNoKeyScreen` checks `keyReloadFailure`.

### How to run

```bash
cd apps/macos/TodzKit && swift test
swift test --filter "AppModelTests"
```

`swift test`: 526 tests before G2, 530 after, all green. The app builds with the `macos` gate's two lines and no warning.

The server, in `apps/api`, with a new scratch folder `<state>` and port 8787 free:

```bash
pnpm exec wrangler d1 migrations apply directory --local --persist-to <state>
pnpm exec wrangler dev --var SIGN_IN_PROVIDER:fake --persist-to <state> --port 8787
```

The app, from the repository root, launched without drawing on the owner's screen and quit after:

```bash
xcodegen generate --spec apps/macos/project.yml
xcodebuild build -project apps/macos/Todz.xcodeproj -scheme Todz -configuration Debug -derivedDataPath apps/macos/build
open -g -j apps/macos/build/Build/Products/Debug/Todz.app
pkill -x Todz
```

**Seed, fictional data.** Sign in with the identity `maria-1`, name the first workspace `Acme`, then add a project `Launch` (⇧⌘N) and a second workspace `Side` (File → New Workspace…). Keys can also be issued from outside the app, to see a list with several rows:

```bash
curl -s -X POST http://localhost:8787/owner/sessions -H 'Content-Type: application/json' -d '{"identity_token":"maria-1","time_zone":"America/Sao_Paulo"}'
curl -s http://localhost:8787/owner/workspaces -H 'Authorization: Bearer <session>'
curl -s -X POST http://localhost:8787/owner/projects/<launch id>/keys -H 'Authorization: Bearer <session>'
```

**The copied Claude Code command, in a throwaway folder.** Create a key, Copy the Claude Code block, read it with `pbpaste`, then:

```bash
mkdir /private/tmp/todz-agent-walk && cd /private/tmp/todz-agent-walk
pbpaste | zsh
claude mcp list
claude mcp get todz
```

`claude mcp add` writes to the private `local` scope, keyed by this folder in `~/.claude.json`. Start `claude` in the folder and ask for the next task to see the tools work. Revoke the key in the app, call a tool again and expect a refusal. Remove it after, from the same folder:

```bash
claude mcp remove todz -s local
cd / && rm -r /private/tmp/todz-agent-walk
```

**The pasteboard markers.** After a Copy, list the pasteboard's types (expect the two `org.nspasteboard` types after a block that holds the secret, neither after the server URL or the Codex table):

```bash
osascript -l JavaScript -e "ObjC.import('AppKit'); ObjC.deepUnwrap($.NSPasteboard.generalPasteboard.types)"
```

### Red today, green after

| Test | Red commit and printed failure | Green commit |
|------|--------------------------------|--------------|
| `AppModelTests.aFailedReloadKeepsTheListedKeysUnderTheFailure(failure:expected:)` | 9170a8b: `Expectation failed: harness.model.keys == .loaded([launchKey])`; `Expectation failed: harness.model.keyReloadFailure == expected` | 428fc1d |
| `AppModelTests.refreshingReloadsTheShownKeys` | 9170a8b: `Expectation failed: harness.model.keys == .loaded([launchKey, otherKey])` | 428fc1d |
| `AppModelTests.choosingAnotherProjectForgetsTheReloadFailure` | pin, green on landing | 9170a8b |
| `AppModelTests.refreshingAwayFromTheKeyScreenListsNoKeys` | pin, green on landing | 9170a8b |

The views have no test target; their proof is the build (e943194, b6c92e8) and the tester's walk. No hidden launch was made: the screen needs a signed-in session against `wrangler dev`, which is the walk itself.

### Hypotheses to attack

1. Hypothesis: "Connect an Agent" is the last sidebar row, reached with ↓ after the last project, with no badge; selecting it from a project shows that project in the picker, and from Inbox, Today, Upcoming or Done shows the Inbox. Break it by: walking the sidebar with the keyboard and VoiceOver.
2. Hypothesis: the screen never shows the inspector or its toggle, ⌥⌘I is disabled there, and leaving restores the inspector as it was. Break it by: hiding the inspector, opening the screen, leaving; then the same with it shown.
3. Hypothesis: with no key shown, every client block shows `<new key>` in grey, its Copy and Add to Cursor are disabled with "Create a key first." as help, and its text cannot be selected; the server URL's Copy always works. Break it by: hovering each disabled button and dragging over the text.
4. Hypothesis: after Create a Key, the notice names the hint of the row now at the top of the list, every block carries the same secret, and each block's Copy puts exactly the shown text on the pasteboard. Break it by: comparing `pbpaste` with the block for each client.
5. Hypothesis: "Copied" replaces "Copy" for two seconds without moving the caption, the text or the next block. Break it by: copying at the narrowest window width and comparing screenshots before and during.
6. Hypothesis: a copy of a block that holds the secret carries the concealed and transient markers; the server URL and the Codex table do not. Break it by: the `osascript` line above after each, and a clipboard manager if one is installed.
7. Hypothesis: Hide Key, a picker change, leaving the screen, revoking the shown key and a workspace switch each take the secret off the screen at once, and the blocks return to the placeholder.
8. Hypothesis: Revoke… opens the system confirmation naming the hint and the project, Return or Escape cancels, Revoke Key shows a small progress in place of the button, then the row leaves. Break it by: revoking with `wrangler dev` stopped (expect the red line under the row and the button back).
9. Hypothesis: offline, Create a Key and every Revoke… are disabled with "Keys need a connection to todz.", Try Again stays enabled, and a key already shown stays copyable.
10. Hypothesis: a reload that fails after a list loaded (stop `wrangler dev`, press ⌘R) shows "Couldn't load the keys." and Try Again above the rows, which stay; a successful Try Again removes the line.
11. Hypothesis: a first load that fails shows only the failure line with Try Again; the commands, the server URL and the tools stay usable.
12. Hypothesis: at the narrowest width the picker sits under the title, the commands wrap, the tool grid keeps two columns and the key rows do not reflow.
13. Hypothesis: VoiceOver reads the picker as "Project" with the project's name, a key row as "Key ending in" then the hint spelled out with the created line as its value, each Copy as "Copy" and the block's name, and announces "Copied", the notice title and every red line when they appear.
14. Hypothesis: Add to Cursor with Cursor not installed shows "Cursor didn't open. Copy the JSON below instead." under the button. `NSWorkspace.open` is assumed to answer `false` for a scheme with no handler; it may show a system alert instead.

### Known gaps

- Codex and Cursor are not installed on this machine: their blocks and the Cursor link are proven by `AgentCommandTests` only, never by the client.
- The pasteboard markers have no automated test: the app has no test target, and the helper lives in the app as the plan asks.
- Try Again after a reload failure shows no progress while it runs; the line stays until the answer.
- The Cursor failure line clears when the secret changes or the button is pressed again, not on every other action on the screen.
- G1's other gaps stand: a list answer started before an issue can overwrite the appended key until the next reload; the secret sits in an `@Observable` property while shown.
- Names differ from the design: the plan's file map names the folder `MainWindow/KeyScreen` and the copy `KeyScreenCopy.swift`, so the design's `ConnectAgentView`, `ConnectAgentHeader` and `ConnectAgentCopy` are `KeyScreen`, `KeyScreenHeader` and `KeyScreenCopy`; the design's `KeyList` view is `KeyRows`, since `KeyList` is the model's load phase; the design's `AccessibilityCopy` lines live in `KeyScreenCopy` (`copyItem`, `keyEnding`, `revokeKeyLabel`, `revoking`, `hideKeyHint`), because `AccessibilityCopy.swift` is outside the lane; `InspectorSectionTitle` is reused where it is, not moved to `Shared`.

## Fix round 1

### What changed

| Finding | Change | Commits |
|---------|--------|---------|
| D1 crash on Connect an Agent | `TaskListView` takes the item `MainWindow` built it for, inside the branch that exists only away from the key screen, instead of reading `model.selectedItem`; `SidebarItem.emptyTitle` and `emptyBody` give `KeyScreenCopy.title` and `KeyScreenCopy.intro` for `.connectAgent` instead of `preconditionFailure` | c94fad2 |
| D2 secrets gate | `.gitleaks.toml` allowlists the exact `OwnerFixtures.keySecret`, anchored like the existing placeholder | c7809e6 |
| R1 ⌘W keeps the secret | `KeyScreen` calls `model.hideKey()` from `.onDisappear`; no new model hook, so the model proof is the existing `hidingTheKeyForgetsTheSecretAndKeepsTheList` | fc52e52 |
| R2 issue racing a reload | `list(_:)` skips a key already listed; a loaded answer lacking `issuedKey?.key` adds it back | 15324ed red, 63a9489 |
| R3 docs | ADR 0034 decision 1 and design § 1.5 show the single-quoted forms; § 1.5 also says a block with a secret is never selectable, and § 8 carries the new caption | 3ae5fee |
| R5 caption | `KeyScreenCopy.claudeCodeCaption` is "Run it in your project's folder. To replace a key there, run `claude mcp remove todz` first.", with the command in a monospaced run; the four captions are `AttributedString` | d249d98 |
| R6 revoke visit guard | pin test | 317b0f2 |
| S1 selectable secret | `CommandBlock` is selectable only when enabled and holding no secret | fbecb3c |
| S2 pasteboard window | a secret is one `NSPasteboardItem` with `.string` and both markers in one `writeObjects`, after `prepareForNewContents(with: .currentHostOnly)` | af2a507 |
| S3 Cursor handler | Add to Cursor resolves `urlForApplication(toOpen:)` and opens the link only when `AgentCommand.isCursor(bundleIdentifier:)` says Cursor (`com.todesktop.230313mzl4w4u92`); otherwise "Cursor didn't open" | 420b425 red, 600657f |
| S4 / R4 secret shape | `IssuedKey` decodes only a secret of `todz_` plus base64url characters; anything else is a `DecodingError`, so the screen shows the unexpected failure | 72d51b0 red, 3430125 |

`swift test`: 530 before, 534 after, all green. The app builds with the gate's lines into a scratch derived data folder, with no warning. The secrets gate's two commands (the probe, then `gitleaks git --log-opts=HEAD`) report no leaks over 517 commits; `pnpm verify` itself was not run, since its `macos` gate builds into `apps/macos/build`.

### Red today, green after

| Test | Red commit and printed failure | Green commit |
|------|--------------------------------|--------------|
| `AgentCommandTests.anIssuedKeyWhoseSecretTheQuotingWouldBreakOnIsRefused(refusedSecret:)`, six cases, replaces the pin `aSecretHoldsNoCharacterTheQuotingWouldBreakOn` | 72d51b0: `Expectation failed: an error was expected but none was thrown and "IssuedKey(key: …, secret: "todz_ab\'c;d\ne")" was returned`, one per case | 3430125 |
| `AppModelTests.aReloadThatMissedTheIssuedKeyKeepsItListed` | 15324ed: `Expectation failed: harness.model.keys == .loaded([launchKey, issued.key])` | 63a9489 |
| `AppModelTests.aReloadThatListedTheIssuedKeyFirstListsItOnce` | 15324ed: `Expectation failed: harness.model.keys == .loaded([launchKey, committed])` | 63a9489 |
| `AgentCommandTests.onlyCursorTakesTheCursorLink(bundleIdentifier:isCursor:)` | 420b425: `TodzKit/AgentCommand.swift:63: Fatal error: AgentCommand.isCursor is not implemented` | 600657f |
| `AppModelTests.aRevokeAnswerAfterTheProjectChangedLeavesTheNewListAlone` | pin, green on landing; removing the guard after the revoke answer turned it red with `Expectation failed: harness.model.failedRevokeIdentifiers == []`, restored | 317b0f2 |

D1, R1, S1, S2 and R5 live in the app, which has no test target; their proof is the build and the walk.

### Hypotheses to attack

1. Hypothesis: clicking Connect an Agent, from a project, a view or with the keyboard, opens the key screen with no crash, and leaving it shows the task list as before. Break it by: switching rapidly between Connect an Agent and each other row, with tasks loading.
2. Hypothesis: with a secret shown, ⌘W then reopening the window from the menu bar shows the placeholder, and the new key's row is still listed. Break it by: ⌘W, reopen with the menu bar's Open, and also by quitting the window with the red button.
3. Hypothesis: no block holding the secret can be selected by drag, double-click or ⌘A; the server URL stays selectable. Break it by: dragging across each client block, then ⌘C and `pbpaste`.
4. Hypothesis: a Copy of a block that holds the secret lists `public.utf8-plain-text`, `org.nspasteboard.ConcealedType` and `org.nspasteboard.TransientType` together, and the secret does not reach another device through Universal Clipboard. Break it by: the `osascript` line of G2, and pasting on a second Apple device signed in to the same account.
5. Hypothesis: Add to Cursor with Cursor not installed shows "Cursor didn't open. Copy the JSON below instead." and opens nothing, even when another app claims the `cursor` scheme.
6. Hypothesis: the Claude Code caption reads the new sentence with `claude mcp remove todz` in a monospaced run, and wraps at the narrowest width without moving Copy.
7. Hypothesis: a reload racing Create a Key ends with the new key listed exactly once.

### Known gaps

- D1 has no hidden launch yet: the screen belongs to the tester's walk. The cause is read from the view tree (the task list kept observing `selectedItem` and ran once more with `.connectAgent`); with both changes, nothing in the app stops on that case any longer.
- R1 relies on SwiftUI tearing the `Window` scene's content down when it closes, so `.onDisappear` fires; if a close only hides the window, the secret would survive a reopen.
- The R2 duplicate test gives the listed key the fake's next identifier, not the issued key itself (the fake stamps its creation time on issue); the model compares by identifier.
- The secret-shape check repeats the base64url alphabet in `IssuedKey.swift`, beside the different unreserved set `AgentCommand.swift` percent-encodes with.
