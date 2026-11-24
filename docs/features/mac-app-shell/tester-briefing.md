# Tester briefing: Mac app shell

Written by the developer sub-agents when their steps were done (G1 the gate, G2 `TodzKit`, G3 the app). The developers did not run `test-plan.md` and do not declare the feature works.

## What changed

- `scripts/verify.sh`, `scripts/verify-gates.tsv`, `.agents/hooks/doctor.sh`, `.gitignore` (G1): the `macos` gate (`swift test`, `xcodegen generate`, `xcodebuild build`) for `apps/macos/*`, `xcodegen` in the doctor, the generated project and build folders ignored.
- `apps/macos/TodzKit` (G2): the owner models and envelopes, `OwnerAPI` over `URLSession`, `FileSessionVault` (ADR 0025), `TaskBoard`, `ProjectFeed`, `TaskViews`, `TaskPlacementRequest` and `AppModel`.
- `apps/macos/TodzKit` (G3 additions): `TextCheck` (the title, name and notes limits checked before sending), `CalendarDate.start(in:)` and `adding(days:)`, `TaskViews.upcomingDays` and `doneDays` with `TaskDay`, and `createWorkspace`, `createProject`, `renameProject` answering the server's copy or `nil`. A fix: `FileSessionVault` handed percent-encoded paths to the file system, so it could never write or read its file under `Application Support` (a folder name with a space).
- `apps/macos/project.yml` and `apps/macos/Todz` (G3): the app target. `Info.plist` and `Todz.entitlements` are what XcodeGen writes from `project.yml`, committed so a generate leaves the tree clean.
  - `TodzApp`, `AppConfiguration` (reads `TodzAPIBaseURL`, a `fatalError` naming the key when it is missing or not a URL with a host), `RootView` (one screen per phase), `LoadingScreen` (session known, workspaces not answered yet, or the network failure with Try Again).
  - `SignIn/`: `SignInScreen`, `CredentialSlot`, `IdentityFormat`, `SignInErrorLine`. `Onboarding/FirstWorkspaceScreen`.
  - `MainWindow/`: `MainWindow` (split view, inspector, sheet, focus requests), `Sidebar/` (switcher, views with badges, projects with Rename, the `+`), `TaskList/` (header, banner, add field, states, rows, sections, drag, toolbar), `Inspector/` (title, properties, due popover, notes, history).
  - `Shared/`: `NameSheet`, `TaskCheckbox`, `DayFormat`, `ChangeSource`, the presentation of `SidebarItem`. `Copy/`: every string of `design.md` § 4.
  - `AppCommands` and `TaskMenuItems`: File, View, Task and Sign Out in the app menu.
- `apps/macos/README.md`, the `apps/README.md` row, the `AGENTS.md` layout line, `apps/macos` in `FEATURE_PACKAGES` of `delivery-docs.test.ts`.

## How to run

The server, in `apps/api`, with a new scratch folder `<state>` and port 8787 free (the commands of `test-plan.md` § E2E):

```
pnpm exec wrangler d1 migrations apply directory --local --persist-to <state>
pnpm exec wrangler dev --var SIGN_IN_PROVIDER:fake --persist-to <state> --port 8787
```

A restart reuses the same `<state>` and port.

The app, from the repository root:

```
xcodegen generate --spec apps/macos/project.yml
xcodebuild build -project apps/macos/Todz.xcodeproj -scheme Todz -configuration Debug -derivedDataPath apps/macos/build
open apps/macos/build/Build/Products/Debug/Todz.app
```

Quit it with ⌘Q or `pkill -f Todz.app/Contents/MacOS/Todz`.

The session file is `~/Library/Containers/dev.todz.Todz/Data/Library/Application Support/session` (mode `0600`). Delete it to start from the sign-in screen again; Sign Out deletes it too. Developers launched `dev.todz.Todz` once without signing in, so its container exists with no session file.

The unit suite: `swift test --package-path apps/macos/TodzKit` (141 tests in 12 suites at `10efeb5`).

### An agent's write

With the app signed in as `walker-1` and the server above:

```
curl -s -X POST http://localhost:8787/owner/sessions -H 'Content-Type: application/json' -d '{"identity_token":"walker-1","time_zone":"America/Sao_Paulo"}'
```

Answer: `{"session_token":"<session>","owner":{…}}`. This is a second session; the app's own is unaffected.

```
curl -s http://localhost:8787/owner/workspaces -H 'Authorization: Bearer <session>'
```

Take the `id` of the project whose `is_inbox` is `true` in the active workspace.

```
curl -s -X POST http://localhost:8787/owner/projects/<inbox id>/keys -H 'Authorization: Bearer <session>'
```

Answer: `{"key":{…},"secret":"<key>"}`, shown once. Then, from `apps/api` so Node resolves `@modelcontextprotocol/client`, run without writing a file:

```
KEY=<key> node --input-type=module -e "
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
const client = new Client({ name: 'Claude Code', version: '1.0.0' });
const transport = new StreamableHTTPClientTransport(new URL('http://localhost:8787/mcp'), { requestInit: { headers: { Authorization: 'Bearer ' + process.env.KEY } } });
await client.connect(transport);
console.log(JSON.stringify(await client.callTool({ name: 'add', arguments: { tasks: [{ title: 'From the agent' }] } })));
await client.close();
"
```

Then ⌘R in the app.

For the session-ended walk, read `<secret>` from the session file and send `curl -X DELETE http://localhost:8787/owner/sessions/current -H 'Authorization: Bearer <secret>'`.

## Red today, green after

Each red row was committed alone; the text is what the red run printed, copied from the commit body.

| Test | Red before the change because | Green after because |
|------|--------------------------------|---------------------|
| `scripts/verify.test.sh` macos rows (`e312d09`) | 14 checks failed, e.g. `FAIL a macOS application file: gates: expected 'gates: doctor format secrets audit shape macos', got 'gates: doctor format secrets typecheck audit shape unit'`; `FAIL a missing xcodegen exits 1: expected '1', got '0'` | `c8a935c` maps `apps/macos/*` to `macos` and adds `gate_macos` |
| `.agents/hooks/hooks.test.sh` xcodegen rows (`e312d09`) | 4 failures, e.g. `FAIL doctor: xcodegen is optional and counted: output did not match /doctor: 0 missing required, 1 missing optional/` | `8d969f5` reports `xcodegen` and requires `xcodebuild -version` |
| `OwnerEnumsTests` (`8fb0f20`) | pin: green when it landed | — |
| `OwnerModelsTests` (`f2ca35c`) | `TodzKit/OwnerCoding.swift:5: Fatal error: OwnerCoding.decoder is not implemented` | `f37cbaf` decodes the models and envelopes |
| `CalendarDateTests` (`cc8f5c2`) | `TodzKit/CalendarDate.swift:15: Fatal error: CalendarDate.text is not implemented`; `refusesWhatIsNotACalendarDate` failed for `2026-1-5`, `2026-02-30`, `2026-13-01` | `a7aa149` parses, formats, orders and reads today |
| `OwnerAPITests` (`8e342dc`) | `TodzKit/OwnerAPI.swift:29: Fatal error: OwnerAPI is not implemented` | `79ad360` sends the routes and maps the error table |
| `FileSessionVaultTests` (`cc4a206`) | `TodzKit/FileSessionVault.swift:15: Fatal error: FileSessionVault is not implemented` | `4c52247` keeps the session in a private file |
| `TaskBoardTests`, `ProjectFeedTests` (`a6c150d`) | `TodzKit/TaskBoard.swift:5: Fatal error: TaskBoard is not implemented`; `TodzKit/ProjectFeed.swift:9: Fatal error: ProjectFeed is not implemented` | `2408594` |
| `TaskViewsTests` (`76b680a`) | `TodzKit/TaskViews.swift:17: Fatal error: TaskViews is not implemented` | `8f53a43` |
| `TaskPlacementRequestTests` (`ddfb86d`) | `TodzKit/TaskPlacementRequest.swift:3: Fatal error: TaskPlacementRequest is not implemented` | `18b6302` |
| `AppModelTests` (`db1e2dc`) | `TodzKit/AppModel.swift:62: Fatal error: AppModel is not implemented` | `b785c39` |
| `LiveOwnerAPITests` (`5355b4c`) | pin, run against `wrangler dev` on 8799: 2 tests passed; skipped without `TODZ_LIVE_API_URL` | — |
| `TextCheckTests` (`775a551`) | `TodzKit/TextCheck.swift:3: Fatal error: TextCheck.issue(ofTitle:) is not implemented` | `11e79ee` mirrors the server's limits, counting code points after collapsing whitespace |
| `CalendarDateTests/startsAtMidnightInTheGivenZone`, `addsDaysAcrossMonthsAndYears` (`775a551`) | `TodzKit/CalendarDate.swift:66: Fatal error: CalendarDate.adding(days:) is not implemented` | `11e79ee` |
| `TaskViewsTests/emptyViewsHaveNoDays`, `upcomingDaysGroup…`, `doneDaysGroup…` (`775a551`) | `TodzKit/TaskViews.swift:55: Fatal error: TaskViews.upcomingDays is not implemented`; `TodzKit/TaskViews.swift:59: Fatal error: TaskViews.doneDays is not implemented` | `11e79ee` groups by due date and by completion day in the zone |
| `AppModelTests/createWorkspaceAnswers…`, `createProjectAnswers…`, `renameProjectAnswers…` (`775a551`) | `Expectation failed: created == harness.service.workspaces.first`; `Expectation failed: created == harness.model.activeWorkspace?.projects.last`; `Expectation failed: renamed?.identifier == "acme-launch"` | `11e79ee` answers the server's copy |
| `AppModelTests/aRefusedWorkspaceOrProjectWriteAnswersNothing` (`775a551`) | pin: green on the stub, which answered `nil` | — |
| `FileSessionVaultTests/keepsTheSecretInAFolderWhoseNameHasASpace` (`9c70527`) | `Test keepsTheSecretInAFolderWhoseNameHasASpace() recorded an issue at FileSessionVaultTests.swift:44:6: Caught error: .unwritable` | `10efeb5` uses `path(percentEncoded: false)` |
| `delivery-docs.test.ts` › the `apps/macos` package has a README (`2c0e551`) | pin: the README landed in the same commit | — |

The app target has no unit tests (ADR 0024 point 3): it is proven by building it with no warning from its sources and by the walk.

## Hypotheses to attack

Every "it works" is a hypothesis the tester tries to break.

1. Hypothesis: with no session file, launch shows the sign-in screen with the identity field focused and Sign In disabled, its help text `SignInCopy.identityRequired`. Break it by: hovering Sign In, typing only spaces, pressing Return on an empty field.
2. Hypothesis: an identity outside `^[A-Za-z0-9._-]{1,64}$` shows `SignInCopy.identityFormat` in red and sends nothing. Break it by: `walker 1`, 65 letters, `wälker`; watch the `wrangler dev` log for a `POST /owner/sessions`.
3. Hypothesis: after a sign-in the session file exists with mode `0600` and a relaunch opens the main window without signing in (this was broken until `10efeb5`). Break it by: `stat -f %Lp` on the file, quitting and relaunching twice, signing out and checking the file is gone.
4. Hypothesis: the first workspace screen disables Create while the trimmed name is empty, shows `ErrorCopy.nameTooLong` at 81 characters and enables it at 80. Break it by: 80 letters plus spaces on both sides, 81 emoji with a skin tone.
5. Hypothesis: a 201-character title in the add field shows `ErrorCopy.titleTooLong`, keeps the text and sends nothing; a blank Return does nothing; a valid Return clears the field, keeps its focus and selects the new row. Break it by: pasting 200 letters with runs of spaces inside, which the server collapses and accepts.
6. Hypothesis: checking a task replaces its checkbox with a small progress indicator and disables the row until the answer; the row then leaves Inbox, and never shows done before the server says so. Break it by: stopping the server, checking a task (expect `ErrorCopy.networkTitle` with Try Again and the row unchanged), restarting, pressing Try Again.
7. Hypothesis: ⌥⌘↑ and ⌥⌘↓ move the selected task one place in Inbox and project views and are disabled in Today, Upcoming and Done and at the ends of the list; the order survives ⌘R. Break it by: ⌥⌘↑ on the first task, ⌥⌘↓ on the last, pressing them twice quickly while the first move is in flight.
8. Hypothesis: a drag in Inbox or a project sends one move (first or after the task above) and the row lands where the server put it; the row may snap back until the answer. Break it by: dragging to the top, to the bottom, onto itself, in Today (no drag).
9. Hypothesis: adding in Today creates an Inbox task due today, shown in Today without a due label and in Inbox with "Today". Break it by: adding in Today at 23:59 local time, then waiting past midnight and pressing ⌘R.
10. Hypothesis: Upcoming groups by due date with "Tomorrow" first and then the full date; Done groups by completion day with "Today", "Yesterday", then the full date; Today shows `MainWindowCopy.doneToday` with its count. Break it by: tasks due next year (the due label carries the year), completions on both sides of local midnight.
11. Hypothesis: an agent's add (the sequence above) shows "via Claude Code" on the row, "Added {time} via Claude Code" in the inspector and "Added via Claude Code" in the history. Break it by: a client name with emoji or 100 characters, a second agent changing the title ("Changed the title via …").
12. Hypothesis: a 401 anywhere (the session-ended walk) erases the session file once and shows the sign-in screen with `SignInCopy.sessionEnded` and the identity prefilled. Break it by: revoking the session while a sheet is open, while a write is in flight, during a ⌘R of several projects.
13. Hypothesis: New Project (⇧⌘N or the `+`) and Rename… open one sheet whose default button is disabled while the trimmed name is empty or unchanged, closes only when the server answered, and shows a refusal or the network failure inline. Break it by: the server stopped (expect `ErrorCopy.networkTitle` inside the sheet and no banner left behind), 81 characters, Escape while saving.
14. Hypothesis: notes render bold, italic, code and links inline when not edited, show the source while edited, save on focus loss, on a selection change and when the window closes, and never per keystroke (one history line per save). Break it by: 20 001 characters (expect `ErrorCopy.notesTooLong` and no request), Escape (restores), selecting another task mid-edit, closing the window mid-edit.
15. Hypothesis: the inspector title saves on Return or focus loss, Escape restores the saved title, an empty title shows `ErrorCopy.titleEmpty` and sends nothing. Break it by: Option-Return inside the title, a title of only spaces, editing while the server is down.
16. Hypothesis: the due date button opens a graphical date picker; picking a day saves it at once and Clear removes it; the button shows "None" when absent and red "Overdue · {date}" when past. Break it by: picking the day already set (no request), clearing a task with no due date (Clear disabled).
17. Hypothesis: ⌘N focuses the add field, switching to Inbox first from Upcoming and Done; Space toggles the selected task; Return or a double-click on a row opens the inspector and focuses its title; Delete does nothing and does not beep. Break it by: ⌘N with the inspector title focused, Space with nothing selected, Return with the inspector hidden.
18. Hypothesis: switching workspace keeps Today, Upcoming or Done, falls back to Inbox from a project view, clears the selection and shows only that workspace's projects and tasks. Break it by: switching while a pull or a write is in flight.
19. Hypothesis: a second owner (`walker-2`) sees the first workspace screen and nothing of `walker-1`, in the tree, the switcher or the badges. Break it by: signing out with the inspector open on a task, then signing in fast.
20. Hypothesis: the window opens at 1100 × 700, cannot shrink below 760 × 480 with every column shown, and shrinks to the list when the sidebar (⌃⌘S) and the inspector (⌥⌘I) are hidden. Break it by: resizing at the minimum with a two-line title and a long project name.
21. Hypothesis: no Keychain prompt ever appears; the app imports neither `Security` nor any keychain API. Break it by: `pgrep -f SecurityAgent.bundle` before and after, and `grep -rn "import Security" apps/macos/Todz apps/macos/TodzKit/Sources`.

## Known gaps

- ⌘R pulls every project from 0 and merges the answer into the board instead of clearing it first (G2): a task that left the feed would stay until a workspace switch or a relaunch.
- Try Again on New Workspace or New Project after an unreachable server may create a duplicate, because those routes take no idempotency key (G2). The sheet now shows the network failure inline and dismisses the window's banner, so the retry is the sheet's own Create, which has the same risk.
- An undecodable 2xx answer shows as `ErrorCopy.serverTitle` on a load or `ErrorCopy.changeNotSaved` on a write (G2).
- Done rows never show "completed via {client}" and the inspector's Completed shows only the time: the task the owner API sends carries who created it, not who completed it. `TaskRowCopy.completedVia` exists but is unused.
- A history line, an Added value or a "via" whose actor is an agent with no client name is left out; the owner API contract says an agent always has one.
- The Projects header's `+` is drawn only on hover (opacity), so VoiceOver may not reach it; ⇧⌘N and File › New Project… do the same.
- A sidebar badge whose count is 0 draws nothing but is still read as "0 open".
- Menu items enable and disable through Observation inside `Commands`; if one stays enabled or disabled after the state changes, that is the first place to look.
- Focus requests (⌘N, Return to the inspector title, Escape back to the list) are applied one main-actor turn later so the target exists; a focus that does not land is that hop.
- The selection survives a change of view, so the inspector can show a task that is not in the visible list.
- No app icon is set: the sign-in screen shows the system's generic application icon.
- Copy not listed in `design.md` § 4 was added: the window title "todz" (`MainWindowCopy.windowTitle`), the Task menu's title "Task" (§ 5 names the menu), and "{count} open" for the badges (§ 5 names the reading) in `AccessibilityCopy.openCount`.
- The project tag, the add field and the notes box use `.fill.quaternary` with no radius or padding of their own, as § 3 asks for system values only.
