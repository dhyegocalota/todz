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
