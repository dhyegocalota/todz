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
| G1 model | `apps/macos/TodzKit/Sources/TodzKit/`: `ProjectKey.swift`, `IssuedKey.swift`, `AgentCommand.swift`, `AgentClient.swift`, `AgentTool.swift`, `KeyScreenState.swift` (names may be refined; new files only, plus) `OwnerAPI.swift`, `OwnerEnvelopes.swift`, `SidebarItem.swift`, `AppModel+Keys.swift` (new), `AppModel.swift` (forgetting on workspace switch and sign-out only); `apps/macos/TodzKit/Tests/TodzKitTests/`: `ProjectKeyTests.swift`, `OwnerAPITests+Keys.swift`, `AgentCommandTests.swift`, `AppModelTests+Keys.swift`, `FakeOwnerService.swift`, `OwnerFixtures.swift` | `developer` (Opus), on `feat/connect-an-agent` |
| G2 screen | `apps/macos/Todz/MainWindow/KeyScreen/**` (new), `apps/macos/Todz/MainWindow/Sidebar/**`, `apps/macos/Todz/MainWindow/MainWindow.swift`, every `apps/macos/Todz/**` file whose `switch` over `SidebarItem` needs the new case, `apps/macos/Copy/KeyScreenCopy.swift` (new), `apps/macos/README.md`, `docs/features/connect-an-agent/tester-briefing.md` | `developer` (Opus), after G1 |

## Sequencing

G1, then G2 after the lead has merged nothing (one lane at a time, on the branch). The design (`design.md`) is read by both.

## Steps

Author this list with every box empty. A sub-agent ticks its own line. A wrong step is struck through with the reason, not deleted.

### G1 model

- [ ] **Step 1:** red then green: `ProjectKey` (`Codable`, `Equatable`, `Sendable`, `Identifiable`: `identifier` from `id`, `hint`, `createdAt` from `created_at` epoch milliseconds through `OwnerCoding`) and `IssuedKey { key: ProjectKey, secret: String }` from `{ key, secret }`. Tests: decode both, a missing field fails, the `OwnerCoding` round trip.
- [ ] **Step 2:** red then green: `OwnerService.listKeys(session:projectIdentifier:) -> [ProjectKey]`, `issueKey(session:projectIdentifier:) -> IssuedKey`, `revokeKey(session:projectIdentifier:keyIdentifier:)` on the routes above, through the existing request helpers and `projectPath`. Tests over `StubURLProtocol`: method, path, bearer header, an empty body on issue, the decoded answers, 404 → `OwnerAPIError` with `notFound`, 401 → the session error, 5xx and offline as the other calls map them. `FakeOwnerService` gains the three with recorded routes.
- [ ] **Step 3:** red then green: `AgentTool` (the five tools `next`, `add`, `list`, `update`, `done`, in that order, as an enum with `CaseIterable`) and `AgentCommand.of(client: AgentClient, serverURL: URL, secret: String?) -> AgentCommand` (pure). `AgentClient`: `claudeCode`, `codex`, `cursor`. The texts are exactly ADR 0034 § 1, with the secret or, when `nil`, the design's placeholder; Cursor also yields its install link (`cursor://anysphere.cursor-deeplink/mcp/install?name=todz&config=<base64 of {"url":…,"headers":{"Authorization":"Bearer …"}}>`, keys in that order, URL-encoded base64) only when a secret is given. Tests: each client with `http://localhost:8787/mcp` and a fixed `todz_…` secret as exact strings; the placeholder forms; the Cursor link decoded back to the JSON; a URL with a path is kept; `serverURL` is the API base plus `/mcp` built in one place (`AgentCommand.serverURL(apiBase:)`), tested with and without a trailing slash.
- [ ] **Step 4:** red then green: `SidebarItem.connectAgent` and `AppModel+Keys`: the screen's state for one project of the active workspace (`keyProjectIdentifier`: the selected project's, else the Inbox's), `keys` with a load phase (`loading`, `loaded([ProjectKey])`, `failed(OwnerAPIError)`), `issuedKey: IssuedKey?`, `isIssuing`, `revokingKeyIdentifiers`. Actions: `showKeys(project:)`, `loadKeys()`, `issueKey()`, `revokeKey(_:)`, `forgetIssuedKey()`. Rules: an issue appends the key and holds its secret; a revoke removes the key, and the secret when it was that key's; a 404 on revoke removes the key without an error; a failed issue shows no secret; changing the project, leaving `.connectAgent`, switching workspace and signing out forget the secret and the list; a 401 takes the existing session-ended path. Tests over `FakeOwnerService` for each rule, with held calls (`HeldCallWaiter`) for the in-flight states, and a late answer for a project no longer shown is dropped.

### G2 screen

- [ ] **Step 5:** the sidebar's "Connect an agent" row at the bottom (design § 1) selecting `.connectAgent`; every `switch` over `SidebarItem` in the app handles the new case (no task list, no inspector, no add field for it); the main window shows the key screen in the content area.
- [ ] **Step 6:** the key screen per `design.md` §§ 1–5 and every string of § 8: the project picker, the server URL with Copy, the tool list from `AgentTool`, the three client blocks from `AgentCommand` (Copy disabled while no secret is shown; "Add to Cursor" opens the link with `NSWorkspace`), "Create a key", the keys list with Revoke behind a confirmation, every state of § 1, keyboard and VoiceOver per § 5. Copies go through one helper on `NSPasteboard.general`; the copied confirmation never moves the layout.
- [ ] **Step 7:** `apps/macos/README.md` names the key screen; `tester-briefing.md`: what changed, how to run (the local API, a seeded workspace with fictional data), how to run the copied Claude Code command in a throwaway folder and remove it after, red texts, hypotheses, known gaps (Codex and Cursor are not installed on this machine).

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
