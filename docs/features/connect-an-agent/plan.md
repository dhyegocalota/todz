# Plan: Connect an agent

**Spec:** spec.md
**Tier:** 🟡
**Seam:** `apps/macos/TodzKit` (the key models, the three `OwnerAPI` calls, `AgentCommand`, the tool list, `SidebarItem.connectAgent` and the screen's state in `AppModel`), `apps/macos/Todz` (the sidebar row, the key screen, the pasteboard and the Cursor link), `apps/macos/Copy` (the screen's copy). Nothing outside `apps/macos` changes but this folder's docs, the root README gallery and `docs/screenshots/connect-an-agent/`.
**Assumptions (decided, owner can override):**
- ADR 0034 and `design.md` § 7 are the loop's calls, listed in the loop's questions. No third-party dependency.
- Swift 6 strict concurrency, Swift Testing, `swift test` run directly from `apps/macos/TodzKit`; the conventions of the earlier plans hold word for word.
- Red-first: each red commit holds the failing test alone plus `fatalError("<name> is not implemented")` stubs, and its body records the printed failure. A green-on-landing test is a `pin`.
- Every group leaves `swift test` and the app build green at its last commit.
- The routes exist (`owner-api`): `GET`/`POST /owner/projects/:projectId/keys`, `DELETE /owner/projects/:projectId/keys/:keyId`; a key is `{ id, hint, created_at }`, an issue answers 201 `{ key, secret }`, a revoke 204, an unknown key 404 `not_found`.

## File map

| Group | Paths owned | Developer sub-agent |
|-------|-------------|---------------------|
| G1 model | `apps/macos/TodzKit/Sources/TodzKit/`: `ProjectKey.swift`, `IssuedKey.swift`, `AgentCommand.swift`, `AgentClient.swift`, `AgentTool.swift`, `KeyList.swift` (names may be refined; new files only, plus) `OwnerAPI.swift`, `OwnerEnvelopes.swift`, `SidebarItem.swift`, `AppModel+Keys.swift` (new), `AppModel.swift` (`selectedItem.didSet` and `forgetWindow()` only), `AppModel+Workspaces.swift` (`forgetActiveWorkspace` only), `AppModel+Destinations.swift` (the new case only); `apps/macos/TodzKit/Tests/TodzKitTests/`: `ProjectKeyTests.swift`, `OwnerAPITests+Keys.swift`, `AgentCommandTests.swift`, `AppModelTests+Keys.swift`, `FakeOwnerService.swift`, `FakeCall.swift`, `OwnerFixtures.swift`; and in the app target, for the new case only (so the build stays green [1]): `apps/macos/Todz/AppModel+Window.swift`, `apps/macos/Todz/Shared/SidebarItem+Presentation.swift`, `apps/macos/Todz/MainWindowState.swift` (`hasNoAddField`) | `developer` (Opus), on `feat/connect-an-agent` |
| G2 screen | `apps/macos/Todz/MainWindow/KeyScreen/**` (new), `apps/macos/Todz/MainWindow/Sidebar/**`, `apps/macos/Todz/MainWindow/MainWindow.swift`, `apps/macos/Todz/Shared/` (the pasteboard helper, new), any other `apps/macos/Todz/**` file G1's placeholder case left without the screen, `apps/macos/Copy/KeyScreenCopy.swift` (new), `apps/macos/README.md`, `docs/features/connect-an-agent/tester-briefing.md` | `developer` (Opus), after G1 |

## Sequencing

G1, then G2 after the lead has merged nothing (one lane at a time, on the branch). The design (`design.md`) is read by both.

## Steps

The plan review of 2026-11-24 (14 findings, 2 CRITICAL) is folded into the steps; its numbers are in brackets.

Author this list with every box empty. A sub-agent ticks its own line. A wrong step is struck through with the reason, not deleted.

### G1 model

- [x] **Step 1:** (red 6e4d6d9, green 49aca89; `ProjectKeyTests`) red then green: `ProjectKey` (`Codable`, `Equatable`, `Sendable`, `Identifiable`: `identifier` from `id`, `hint`, `createdAt` from `created_at` epoch milliseconds through `OwnerCoding`) and `IssuedKey { key: ProjectKey, secret: String }` from `{ key, secret }`. Tests: decode both, a missing field fails, the `OwnerCoding` round trip.
- [x] **Step 2:** (red b88a31c, green 5c8e721; `OwnerAPITests+Keys`) red then green: `OwnerService.listKeys(session:projectIdentifier:) -> [ProjectKey]` (the route answers `{ "keys": [...] }`: a `KeysAnswer` envelope in `OwnerEnvelopes.swift` [4]), `issueKey(session:projectIdentifier:) -> IssuedKey`, `revokeKey(session:projectIdentifier:keyIdentifier:)` on the routes above, through the existing request helpers and `projectPath`. Tests over `StubURLProtocol`: method, path, bearer header, no body and no `Content-Type` on issue [4], the decoded answers, 404 → `OwnerAPIError` with `notFound`, 401 → the session error, 5xx and offline as the other calls map them. `FakeOwnerService`, `FakeRoute` and `FakeCall` gain the three with recorded routes and held calls.
- [x] **Step 3:** (red 15be17e, green 340f8aa, refactor 40f5731; `AgentCommandTests`, three pins; `AgentCommand` is an enum with one case per client, and `cursorLink(serverURL:secret:)` a separate function; ~~a secret whose base64 holds `+` and `/`~~ a crafted key `todz_???>>>~~~b`, because no `todz_` base64url secret can make ASCII JSON's base64 hold `+` or `/`) red then green: `AgentTool` (the five tools `next`, `add`, `list`, `update`, `done`, in that order, as an enum with `CaseIterable`) and `AgentCommand.of(client: AgentClient, serverURL: URL, key: String) -> AgentCommand` (pure), where `key` is the secret or, with no secret, the placeholder `<new key>` (design O4) passed by the caller from the copy. `AgentClient`: `claudeCode`, `codex`, `cursor`. With `U` the server URL and `K` the key, the texts are exactly [9, 11]:
  - Claude Code, one line: `claude mcp add --transport http todz 'U' --header 'Authorization: Bearer K'`
  - Codex, two blocks: the table `[mcp_servers.todz]` / `url = "U"` / `bearer_token_env_var = "TODZ_API_KEY"` (three lines), and the line `export TODZ_API_KEY='K'`
  - Cursor, the `mcp.json` text, two-space indented: `{` / `  "mcpServers": {` / `    "todz": {` / `      "url": "U",` / `      "headers": {` / `        "Authorization": "Bearer K"` / `      }` / `    }` / `  }` / `}`; and the install link, built only for a real secret: `cursor://anysphere.cursor-deeplink/mcp/install?name=todz&config=` followed by the standard padded base64 of the exact bytes `{"url":"U","headers":{"Authorization":"Bearer K"}}` (built as a literal, so no escaped slashes and a fixed key order), percent-encoded so that only RFC 3986 unreserved characters stay raw (`+`, `/` and `=` become `%2B`, `%2F`, `%3D`) [8].
  Tests: each client with `http://localhost:8787/mcp` and a fixed `todz_…` secret as exact strings; the placeholder forms; a secret whose base64 holds `+` and `/`, the link's `config` percent-decoded, base64-decoded and parsed as JSON equal to the expected object; `AgentCommand.serverURL(apiBase:)` is the API base plus `/mcp`, built in one place, tested with and without a trailing slash. A secret is `todz_` plus base64url (ADR 0019), so it never holds `'`, `"`, `$` or a backtick; the quoting relies on that and a test pins it.
- [x] **Step 4:** (red cae17a7, green 86a2bf0; `AppModelTests+Keys`; ~~`failed(OwnerAPIError)`~~ `failed(KeyFailure)` with `unreachable` and `unexpected`, because an undecodable answer has no `OwnerAPIError` and the screen needs only network or server, as `SignInError`; ~~`showKeys(project:)`~~ `showKeys(projectIdentifier:)`; added `issueFailure`, `failedRevokeIdentifiers` and `hideKey()`, which the design's issue failure, revoke failure and Hide Key need) red then green: `SidebarItem.connectAgent` and `AppModel+Keys`. The model, not the view, holds the screen's state (the spec says so) [6]: `keyProjectIdentifier` for one project of the active workspace, `keys` with a load phase (`loading`, `loaded([ProjectKey])`, `failed(OwnerAPIError)`), `issuedKey: IssuedKey?`, `isIssuing`, `revokingKeyIdentifiers`. Actions: `showKeys(project:)`, `loadKeys()`, `issueKey()`, `revokeKey(_:)`, `forgetKeys()`. Rules:
  - entering `.connectAgent` (in `selectedItem.didSet`) takes `keyProjectIdentifier` from `oldValue`: a `.project` gives its identifier, anything else the active workspace's Inbox; it clears `selectedTask` and loads [5, 12];
  - leaving `.connectAgent` by any path (the sidebar, `reveal(task:)`, a widget link, a workspace switch through `forgetActiveWorkspace`, sign-out and a 401 through `forgetWindow()`) calls `forgetKeys()`: no secret, no list [2, 5];
  - an issue appends the key and holds its secret; a failed issue shows no secret and reloads the list, so a key the server committed before the failure is listed [7]; an issue answer that arrives after the project changed, the screen was left or the session ended (`CancellationError`) shows no secret and no error [6];
  - a revoke removes the key, and the secret when it was that key's; a 404 on revoke removes the key without an error;
  - a 404 on listing or issuing for the shown project falls back to the Inbox [13];
  - a late list answer for a project no longer shown is dropped;
  - a 401 takes the existing session-ended path.
  The selection is not restored across launches, so a relaunch opens the Inbox (as today). Tests over `FakeOwnerService` for each rule, with held calls (`HeldCallWaiter`) for the in-flight and late-answer states, including leaving through `reveal(task:)` and the widget link.

### G2 screen

- [x] **Step 5:** (b6c92e8, build; the row is ~~at the bottom~~ the last section after Projects, design O1 B; G1 had already handled the other switches, and the inspector menu item is disabled on the screen in `AppCommands.swift`) the sidebar's "Connect an agent" row at the bottom (design § 1) selecting `.connectAgent`; every `switch` over `SidebarItem` in the app handles the new case (no task list, no inspector, no add field for it); the main window shows the key screen in the content area.
- [x] **Step 6:** (e943194, build; red 9170a8b, green 428fc1d, `AppModelTests+Keys`: `keyReloadFailure` keeps the rows under a failed reload and `refresh()` reloads the keys, in TodzKit as the lead allowed; ~~`MainWindow/ConnectAgent`, `ConnectAgentCopy`~~ `MainWindow/KeyScreen`, `KeyScreenCopy`, as this plan's file map names them, with the design's `AccessibilityCopy` lines inside it; `MainWindowState.swift` keeps the chosen client) the key screen per `design.md` §§ 1–5 and every string of § 8: the project picker, the server URL with Copy, the tool list from `AgentTool`, the three client blocks from `AgentCommand` (Copy disabled while no secret is shown; "Add to Cursor" opens the link with `NSWorkspace`), "Create a key", the keys list with Revoke behind a confirmation, every state of § 1, keyboard and VoiceOver per § 5. Copies go through one helper on `NSPasteboard.general`, which also writes the `org.nspasteboard.ConcealedType` and `org.nspasteboard.TransientType` markers when the text holds a secret, so clipboard managers skip it [10]; the copied confirmation never moves the layout. Nothing on the screen logs.
- [x] **Step 7:** (`apps/macos/README.md`; `tester-briefing.md` → G2 screen) `apps/macos/README.md` names the key screen; `tester-briefing.md`: what changed, how to run (the local API, a seeded workspace with fictional data), how to run the copied Claude Code command in a throwaway folder and remove it after, red texts, hypotheses, known gaps (Codex and Cursor are not installed on this machine).

## Failure modes

| Step | What breaks | How I notice (the concrete signal) | How I back out |
|------|-------------|------------------------------------|----------------|
| 2 | a key route is called on the wrong path or method | the stub test sees another path; `wrangler dev` logs 404 | fix the path helper; the routes are fixed by `owner-api` |
| 3 | a command is wrong for its client | the copied Claude Code command fails in the walk; exact-string tests disagree with ADR 0034 | one change in `AgentCommand` and its tests |
| 3 | the Cursor link's remote shape is not what Cursor reads | unproven on this machine (no Cursor) | listed as unproven; the copied `mcp.json` JSON is the fallback |
| 4 | the secret outlives the screen | a test reads `issuedKey` after a project change or a workspace switch | forget it in every exit path; one `forgetIssuedKey()` |
| 4 | a late list answer overwrites another project's keys | the held-call test shows project A's keys under B | drop answers for a project no longer shown |
| 5 | a switch over `SidebarItem` misses the new case | the build fails (exhaustive switches) | handle it in each |
| 6 | Copy of a placeholder command | the walk pastes `<placeholder>` text | Copy disabled until a secret exists |

**Steps with no backout:** none; nothing is deployed. Keys issued during the walk are revoked at its end.

## Z. Prove and ship

- [ ] **Tester briefing:** a developer wrote `tester-briefing.md`.
- [ ] **Tester run:** a fresh `tester` sub-agent executed `test-plan.md` and ticked every box with evidence.
- [ ] **Reviewer:** a fresh `reviewer` sub-agent returned a verdict; refutation of the three riskiest claims is recorded in `test-plan.md`.
- [ ] **Security reviewer:** a fresh `security-reviewer` sub-agent returned its verdict.
- [ ] **/check-ui:** screenshots uploaded; the README gallery shot under `docs/screenshots/connect-an-agent/`.
- [ ] **/open-pr:** gates passed, learnings sweep stated, PR opened.
