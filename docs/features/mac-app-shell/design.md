# Design: mac-app-shell

**Sources:** [the approved product design](../../product/README.md) (Views, macOS app), [the Glass mockup](../../product/mockups/glass-screens.html) ("Main window"), [ADR 0020](../../adr/0020-sign-in-goes-through-a-provider-port-and-v1-ships-only-the-fake.md), [ADR 0022](../../adr/0022-the-owner-api-is-json-routes-and-the-app-builds-the-cross-project-views.md), the owner API error table in [owner-api/spec.md](../owner-api/spec.md).
**Design system:** the Glass direction is approved; there is no token file. Tokens are SwiftUI system materials, semantic colours, text styles and the one accent.
**Screenshots:** blocked. Playwright MCP could not start: its `chrome-for-testing` browser is not installed (the fix it prints is `npx @playwright/mcp install-browser chrome-for-testing`, which needs the owner's OK per HARNESS 11). The captures this document needs are listed in section 6 under `.pr-media/mac-app-shell/design/`; until they exist, each option cites the mockup element it changes. There is no current macOS app to walk: `apps/macos` does not exist yet.

## 1. Screens and states

The app has one window. Its root shows exactly one of three screens, chosen by the session: **Sign in** (no session, or a 401), **First workspace** (a session, no workspace), **Main window** (a session and at least one workspace).

### 1.1 Window and narrow state

- Default size 1100 × 700; minimum 760 × 480 with every column shown (built: 848 × 532, the loop's call, see § 7). Sign in and First workspace use the same window, with no sidebar or toolbar items, content centred.
- Layout: a two-column `NavigationSplitView` (sidebar, task list) plus a trailing inspector (option O1).
- Column widths, from the mockup: sidebar min 180, ideal 224, max 300; list min 320; inspector min 260, ideal 320, max 420.
- Collapse order when the window narrows: the sidebar collapses first (system toolbar button, ⌃⌘S), then the inspector hides (toolbar button, ⌥⌘I); the list never collapses. With both hidden the window can shrink to the list's 320 plus chrome. Selecting a task with the inspector hidden does not open it; Return or a double-click does.
- On launch the window shows the oldest workspace with its Inbox selected; nothing but the session is kept between launches until `mac-sync`.

### 1.2 Sign in

Centred column, 280 wide: the app icon, `SignInCopy.title`, `SignInCopy.subtitle`, then one **credential slot**: the identity field and the Sign In button stacked. The slot is the one region a `SignInWithAppleButton` replaces later; nothing else on the screen changes. Under the slot, `SignInCopy.developmentNotice` in `.secondary`.

| State | What shows |
|---|---|
| Empty | field focused, placeholder; Sign In disabled with `SignInCopy.identityRequired` as its help text |
| Invalid input | local check against `^[A-Za-z0-9._-]{1,64}$` on submit; `SignInCopy.identityFormat` inline under the field in `.red`; field keeps focus |
| Loading | button replaced by a small `ProgressView` with `SignInCopy.signingIn`; field read-only |
| Error | inline under the slot: identity rejected (`SignInCopy.identityRejected`), sign-in unavailable (503, `SignInCopy.signInUnavailable`), time zone refused (422 `time_zone_invalid`, `SignInCopy.timeZoneInvalid`), network unreachable (`ErrorCopy.networkTitle` with Try Again) |
| Session ended | arriving from a 401: `SignInCopy.sessionEnded` above the slot, field prefilled with the last identity of this launch |
| Session unreadable | the session file exists but cannot be read at launch: `SignInCopy.sessionUnreadable` above the slot; signing in replaces the file |
| Success | First workspace or Main window, no transition beyond the system crossfade |

### 1.3 First workspace

Centred column, 320 wide: `FirstWorkspaceCopy.title`, `FirstWorkspaceCopy.body`, a name field, `FirstWorkspaceCopy.create` (prominent, the default button), and `FirstWorkspaceCopy.signOut` as a plain link below for a wrong identity.

| State | What shows |
|---|---|
| Empty | field focused; Create disabled while the trimmed name is empty |
| Overloaded | over 80 characters: `ErrorCopy.nameTooLong` inline, Create disabled |
| Loading | Create shows a small `ProgressView`; field read-only |
| Error | 422 issue or network copy inline under the field |
| Success | Main window, the new workspace active, Inbox selected, add field focused |

### 1.4 Main window: sidebar

Top to bottom: the **workspace switcher**, the **views** (Inbox, Today, Upcoming, Done, each with an SF Symbol: `tray`, `star`, `calendar`, `checkmark.circle`), the **Projects** section (every project except the Inbox, oldest first, with a `+` button in the section header on hover), and nothing at the bottom (option O6).

- Switcher: a `Menu` showing the active workspace's name. Items: each workspace with a checkmark on the active one, a divider, `MainWindowCopy.newWorkspace`, a divider, `MainWindowCopy.signOut`.
- Badges: the open-task count on Inbox, Today, Upcoming and each project, via the system sidebar badge; Done has none. No badge until that count's projects have loaded.
- Project rows: no colour dot (the model has no project colour; see the summary of contradictions). Context menu: `MainWindowCopy.renameProject` on every project row; the Inbox row has no context menu.
- Switching workspace keeps the view kind (Today stays Today); a project view falls back to the new workspace's Inbox.
- Empty Projects section: the header and its `+` only. Overloaded: names truncate at the tail with the full name as help text; the section scrolls under a pinned switcher.

### 1.5 Main window: task list

Header, in the content (as the mockup): the view name in `Font.title` bold, and in Today the date in `.secondary` on the trailing side. Under it, the **add field** (option O2), then the rows.

**Row:** checkbox, then the title (`.body`, up to two lines, tail truncation), then a sub-line in `.subheadline` `.secondary` holding, in order and only when it applies: the project name as a tag (Today, Upcoming, Done only), the due label (not in Today for tasks due today, not in Upcoming where the group header says it), and the actor ("via Claude Code" when an agent created it; in Done, "completed via Cursor" when an agent completed it). The short id sits trailing in `.secondary` monospaced digits (option O7).

| View | Rows | Sections | Drag | Add field |
|---|---|---|---|---|
| Inbox | the Inbox project's open tasks, manual order | none | yes | adds to the Inbox |
| Today | open tasks due today or overdue, overdue first, then by due date, then manual order within the project | open; then `MainWindowCopy.doneToday` with its count | no | adds to the Inbox, due today |
| Upcoming | open tasks with a future due date | one per date: "Tomorrow", then the full date | no | none |
| Done | completed tasks, newest first | one per completion day: "Today", "Yesterday", then the full date | no | none |
| Project | that project's open tasks, manual order | none | yes | adds to that project |

| State | What shows |
|---|---|
| Loading (first) | `ProgressView` centred with `MainWindowCopy.loading`, until every project of the workspace has answered once |
| Refreshing | rows stay; the toolbar Refresh button becomes a small `ProgressView` and is disabled |
| Empty | `ContentUnavailableView` with the view's empty title, description and symbol (section 4) |
| Partial | some projects failed: rows from the rest, plus a banner `ErrorCopy.someProjectsFailed` with Try Again |
| Error | nothing loaded: `ContentUnavailableView` with the error's copy and Try Again |
| Overloaded | hundreds of rows in a lazy `List`; two-line titles; long client names truncate in the sub-line |
| Success | rows; the selection is single; a newly added task is selected and scrolled into view |

**Banner:** a single non-modal strip under the header for network, server and not-found errors, with the error's copy and one button (Try Again or Dismiss). It never covers rows. A change waits for the server (§ 7, O4 = B): while it is in flight the row's checkbox is replaced by a small `ProgressView` and the row's controls are disabled; a refused change leaves the row as it was and raises the banner `ErrorCopy.changeNotSaved`, or the issue's copy for a 422.

### 1.6 Main window: inspector

From the mockup, top to bottom: checkbox and the **editable title** (`Font.title2` semibold, wraps fully), the short id trailing in `.secondary`; a two-column property grid in `.callout` (labels `.secondary`): Project (read-only, tasks never change project), Due (option O5), Added, and Completed when done; Notes; History.

- Title: a borderless text field. Commits on Return or focus loss; Escape restores the saved title. An empty or over-limit title is checked before sending and shown inline (`ErrorCopy.titleEmpty`, `ErrorCopy.titleTooLong`); the field keeps focus.
- Notes: Markdown (option O3). Commits on focus loss, on a selection change and when the window closes; never per keystroke, because each save writes one history line.
- History: oldest first as the API answers, shown newest first; each line is a time in `.secondary` monospaced digits and a sentence (section 4, `HistoryCopy`); a completion note sits under its line in `.secondary`.

| State | What shows |
|---|---|
| No selection | `ContentUnavailableView` with `InspectorCopy.noSelection` |
| Loading history | the properties and notes at once (they come with the task); a small `ProgressView` under History |
| History error | `InspectorCopy.historyFailed` with Try Again, under History only |
| Saving | the field being saved is read-only and shows a small `ProgressView` at its trailing edge until the answer; the saved value then shows (§ 7, O4 = B) |
| Not found | the task vanished: the inspector shows `ErrorCopy.taskGone`, the list refreshes |
| Overloaded | 20 000 characters of notes and long histories scroll within the inspector; the title and properties stay at the top |

### 1.7 Sheets

One sheet shape for New Workspace, New Project and Rename Project: a title, a Name field, Cancel and the default button (Create or Rename), disabled while the trimmed name is empty or unchanged. Loading: the default button shows a small `ProgressView`. Errors: inline under the field. Success: the sheet closes; a new workspace becomes active with its Inbox selected; a new project is selected.

## 2. Components

No macOS code exists yet, so every component is new. Proposed placement under the app target, one folder per screen, shared pieces in `Shared`:

| Component | Folder | Why |
|---|---|---|
| `SignInView`, `CredentialSlot` | `SignIn` | the slot isolates the fake field from the future Apple button |
| `FirstWorkspaceView` | `Onboarding` | its own root screen (ADR 0022) |
| `MainWindowView` | `MainWindow` | split view, toolbar, commands |
| `WorkspaceSwitcher`, `SidebarView` | `MainWindow/Sidebar` | |
| `TaskListView`, `AddTaskField`, `TaskRow`, `DueLabel`, `ErrorBanner` | `MainWindow/TaskList` | `DueLabel` is shared by the row and the inspector |
| `InspectorView`, `DueDatePicker`, `NotesEditor`, `HistoryList` | `MainWindow/Inspector` | |
| `NameSheet` | `Shared` | one sheet for workspace and project names |
| `TaskCheckbox` | `Shared` | the row, the inspector, and later the menu bar extra and widgets |

System components carry the rest: `NavigationSplitView`, `.inspector`, `List` with sidebar style, `Menu`, `ContentUnavailableView`, `ProgressView`, `DatePicker`, `TextEditor`, `.sheet`, `.contextMenu`, `.badge`.

## 3. Tokens

| Use | Token |
|---|---|
| Sidebar background | `Material.sidebar` (the system sidebar of `NavigationSplitView`) |
| List and inspector background | the window background (`Color(nsColor: .windowBackgroundColor)`) |
| Add field, notes box, project tag fill | `.fill.quaternary` |
| Accent: checked checkbox, default buttons, selection, focus ring | `Color.accentColor` = `#2F5BFF` in the asset catalog |
| Titles, row titles, history sentences | `.primary` |
| Sub-lines, property labels, times, ids, date subtitle | `.secondary` |
| Unchecked checkbox ring | `.secondary` (SF Symbol `circle`); checked `checkmark.circle.fill` in the accent |
| Done row title | `.secondary` with strikethrough |
| Overdue label and inline errors | `Color.red` (option O8) |
| Separators | the system `List` separators and `Divider()` |
| View header | `Font.title` bold |
| Inspector title | `Font.title2` semibold |
| Row title, notes, fields | `Font.body` |
| Properties, history | `Font.callout` |
| Row sub-line, tags | `Font.subheadline` |
| Section headers | the system sidebar and `List` section header styles |
| Spacing, radius, row height | system defaults of each control and `List`; no custom value (option O8) |

Dark mode comes from these system colours and materials; nothing is set per component.

## 4. Copy

Placeholders in `{braces}` become function parameters. Dates and times use system formatters, never strings.

**SignInCopy:** title "Welcome to todz" · subtitle "Your tasks, shared with your agents." · identityPlaceholder "Identity" · signIn "Sign In" · signingIn "Signing in…" · developmentNotice "Development sign-in. Sign in with Apple comes later." · identityRequired "Enter an identity to sign in." · identityFormat "Use up to 64 letters, digits, dots, dashes or underscores." · identityRejected "That identity wasn't accepted." · signInUnavailable "Sign-in isn't available on this server." · sessionEnded "Your session has ended. Sign in again." · sessionUnreadable "Your saved session couldn't be read. Sign in again." · timeZoneInvalid "This Mac's time zone wasn't accepted."

**FirstWorkspaceCopy:** title "Name your first workspace" · body "A workspace holds one company's projects. It starts with an Inbox." · namePlaceholder "Workspace name" · create "Create Workspace" · signOut "Sign Out"

**MainWindowCopy:** inbox "Inbox" · today "Today" · upcoming "Upcoming" · done "Done" · projects "Projects" · doneToday "Done Today" · tomorrow "Tomorrow" · todayGroup "Today" · yesterday "Yesterday" · newWorkspace "New Workspace…" · newProject "New Project…" · renameProject "Rename…" · signOut "Sign Out" · newTask "New Task" · refresh "Refresh" · moveUp "Move Up" · moveDown "Move Down" · markDone "Mark as Done" · markNotDone "Mark as Not Done" · showInspector "Show Inspector" · hideInspector "Hide Inspector" · addPlaceholder "Add a task" · loading "Loading…" · tryAgain "Try Again" · dismiss "Dismiss"
Empty: inboxEmptyTitle "Inbox is empty" · inboxEmptyBody "Add a task with ⌘N." · todayEmptyTitle "Nothing due today" · todayEmptyBody "Tasks due today or earlier show up here." · upcomingEmptyTitle "Nothing upcoming" · upcomingEmptyBody "Tasks with a future due date show up here." · doneEmptyTitle "Nothing done yet" · doneEmptyBody "Completed tasks show up here." · projectEmptyTitle "No open tasks" · projectEmptyBody "Add a task with ⌘N."

**TaskRowCopy:** dueToday "Today" · dueTomorrow "Tomorrow" · overdue "Overdue · {date}" · via "via {client}" · completedVia "completed via {client}" · shortId "T-{number}"

**InspectorCopy:** project "Project" · due "Due" · added "Added" · completed "Completed" · notes "Notes" · history "History" · noDueDate "None" · clearDueDate "Clear" · byYou "{time} by you" · viaClient "{time} via {client}" · notesPlaceholder "Add notes" · noSelection "No task selected" · noSelectionBody "Select a task to see its details." · historyFailed "Couldn't load the history."

**HistoryCopy:** owner lines put "You" first; agent lines end with the client, so "via" stays the only trace an agent leaves. ownerAdded "You added it" · agentAdded "Added via {client}" · ownerChanged "You changed {fields}" · agentChanged "Changed {fields} via {client}" · ownerMoved "You moved it" · agentMoved "Moved via {client}" · ownerCompleted "You completed it" · agentCompleted "Completed via {client}" · ownerReopened "You reopened it" · agentReopened "Reopened via {client}" · fieldTitle "the title" · fieldNotes "the notes" · fieldDueDate "the due date" · fieldOrder "the order". `{fields}` joins with the system list formatter ("the title and the notes"); an update whose only field is the order uses the Moved lines.

**SheetCopy:** newWorkspaceTitle "New Workspace" · newProjectTitle "New Project" · renameProjectTitle "Rename Project" · nameLabel "Name" · cancel "Cancel" · create "Create" · rename "Rename"

**ErrorCopy:** networkTitle "Can't reach todz" · networkBody "Check your connection, then try again." · serverTitle "Something went wrong" · serverBody "todz couldn't finish that. Try again." · someProjectsFailed "Some projects didn't load." · changeNotSaved "Your change wasn't saved." · sessionNotSaved "You're signed in, but todz couldn't save your session for next time." · titleEmpty "A task needs a title." · titleTooLong "Titles can be up to 200 characters." · notesTooLong "Notes can be up to 20,000 characters." · nameEmpty "Add a name." · nameTooLong "Names can be up to 80 characters." · dueDateInvalid "That date isn't valid." · inboxIsFixed "The Inbox can't be renamed." · taskGone "This task is no longer available." · projectGone "This project is no longer available." · workspaceGone "This workspace is no longer available." · ruleUnexpected "todz couldn't save this change."
The limits in these strings come from the shared constants (`TASK_TITLE_MAX_LENGTH`, `TASK_NOTES_MAX_LENGTH`, `NAME_MAX_LENGTH`), interpolated, never typed. Each `RuleIssue` the app can send maps to one string; `ruleUnexpected` is the explicit case for the issues the app never triggers (batch, idempotency, cursor), not a default.

**AccessibilityCopy:** checkboxOpen "Mark {title} as done" · checkboxDone "Mark {title} as not done" · rowValueOpen "Open" · rowValueDone "Done" · refreshing "Refreshing" · switcher "Workspace, {name}" · addProject "New Project"

## 5. Interaction and accessibility

**Keyboard**

| Keys | Where | Does |
|---|---|---|
| ⌘N | anywhere in the main window | focuses the add field; in Upcoming and Done it selects Inbox first |
| Return | add field | adds the task, clears the field, keeps focus; a blank field does nothing |
| Escape | add field / inspector field | clears the add field / restores the saved value; focus returns to the list |
| ↑ ↓ | list | moves the selection |
| Space | list | toggles done on the selected task |
| ⌘↩ | anywhere, a task selected | toggles done, also while editing in the inspector |
| Return | list | focuses the inspector title, opening the inspector if hidden |
| ⌥⌘↑ ⌥⌘↓ | list, Inbox or project view | Move Up / Move Down: the keyboard path for drag reordering |
| ⌘R | anywhere | Refresh |
| ⇧⌘N | anywhere | New Project… |
| ⌥⌘I / ⌃⌘S | anywhere | show or hide the inspector / the sidebar |
| Delete, ⌫ | list | nothing: no menu item, no beep (no delete in v1) |

Menus mirror every command: File holds New Task, New Project…, New Workspace…; View holds Refresh and the two show/hide items; a Task menu holds Mark as Done, Move Up, Move Down; the app menu holds Sign Out. ⌘1–⌘9 stay free for the menu bar extra's workspace switching.

**Focus order:** switcher → views → projects (and the `+`) → add field → rows → inspector checkbox → title → Due → notes → history. Sign in: field → Sign In. First workspace: field → Create → Sign Out. Sheets: field → Cancel → default button; Return triggers the default, Escape cancels.

**VoiceOver**
- Row: one element. Label: the title. Value: "Open" or "Done", then the sub-line as read ("api, Overdue, 20 November, via Claude Code"). Actions: Mark as Done or Mark as Not Done, Move Up and Move Down where the view has manual order.
- Checkbox: a toggle labelled `checkboxOpen` / `checkboxDone`, so the action is spoken, not only "checkbox".
- Switcher: `switcher` with the menu trait; sidebar badges are read as "{count} open".
- The banner is announced when it appears; the refreshing `ProgressView` says `refreshing`.
- A disabled button carries its reason as help text and accessibility hint (Sign In: `identityRequired`; Create: `nameEmpty`).

**Motion:** system `List` insert, move and remove animations. A task checked in Inbox, a project or Today shows its waiting state, then leaves once the server answers (§ 7, O4 = B). Reduce Motion: no fade, rows move at once.

**Contrast**, light mode on the window background: `.primary` about 16:1; `.secondary` about 4:1 (below 4.5:1 for small text; this is the system's own and Increase Contrast raises it); accent `#2F5BFF` and white on it about 4.9:1, passing; `Color.red` (`#FF3B30`) about 3.5:1, so overdue is never colour alone: it carries the word "Overdue". No information is set in `.tertiary` (about 2:1). Dark mode: the accent as text on a dark background is about 3.4:1, so the accent is used for fills and symbols, never for body text (option O8).

## 6. Options

Captures to take once Playwright MCP has its browser, at 1280 wide, into `.pr-media/mac-app-shell/design/`: `mockup-main-window.png` (the "Main window" block), `mockup-sidebar.png`, `mockup-inspector.png`, and one annotated copy per option below (`o1-…png` to `o8-…png`).

**O1. Where the inspector lives** (mockup: the fixed third column `.insp`)
- A. Three-column `NavigationSplitView`, the inspector as the detail column. Matches the mockup literally; the detail column cannot hide, so the window minimum stays at 760.
- B. Two-column `NavigationSplitView` plus the macOS 14 `.inspector`. The system idiom for a property panel (Xcode, Keynote), hides with ⌥⌘I, lets the window shrink to the list alone; looks the same as the mockup when shown.
- **Recommendation: B.** The inspector edits the selection; it is not a navigation level.

**O2. Where a new task lands** (mockup: the add field `.add` at the top of the list)
- A. Field at the top; the task is appended last, like an agent's, then selected and scrolled to. One request; the MCP `next` tool keeps returning what the owner already ordered first.
- B. Field at the top; the task is placed first. Reads naturally under the field, but needs a second request (add, then place first) with a partial-failure case, and makes every new task the agent's `next`.
- C. Field at the bottom, task last (Reminders). Contradicts the mockup.
- **Recommendation: A**, with the field pinned above the scrolling rows.

**O3. Notes editing** (mockup: `.notes-box` renders inline code)
- A. A plain `TextEditor` showing the Markdown source at all times. Simplest, honest, never renders differently from what an agent wrote.
- B. Rendered inline Markdown (bold, italic, code, links) when not focused; the source while editing. Matches the mockup; block syntax (lists, headings) shows as typed.
- **Recommendation: B**, inline only; full block rendering waits for a reason.

**O4. Saving and completing**
- A. Optimistic: every change shows at once; a failure rolls it back and raises the banner `changeNotSaved`. A checked task lingers about a second before leaving the list.
- B. Wait for the server: the row or field shows a small spinner until the answer, then moves. Never shows a state the server refused, but every click waits a round trip on the local API and later on the network.
- **Recommendation: A** for checking, reordering and editing; B for the sheets and sign-in, which change what the window shows. `mac-sync` replaces the rollback with its offline queue without changing the screens.

**O5. The due date control**
- A. A button showing the date ("None" when absent) that opens a popover with a graphical `DatePicker` and a Clear button.
- B. A "Due" toggle that reveals a compact `DatePicker` field. All inline, but two controls for one value.
- **Recommendation: A.** Quick choices (Today, Tomorrow) can join the popover later.

**O6. "Connect an agent" in the shell's sidebar** (mockup: `.side-foot`)
- A. Omit the row; the sidebar's bottom stays empty until `connect-an-agent` adds it.
- B. Show it disabled with "Coming soon". A dead control in a polished app.
- **Recommendation: A.**

**O7. The short id in rows** (mockup: rows show no id; `.task .right` is styled but unused)
- A. Trailing in every row in `.secondary` monospaced digits, and in the inspector. Programmers tell an agent "do T-12"; the id must be findable without opening the task.
- B. Inspector only. Cleaner rows, closer to the mockup.
- **Recommendation: A.** In cross-project views the project tag disambiguates the per-project number.

**O8. Values the system tokens leave open** (design-system call, the owner's)
- Overdue colour: A. `Color.red`, the system's semantic red, adapting to dark mode (recommended); B. the mockup's `#e5484d`, a second brand colour the product design does not name; C. no colour, the word alone.
- Dark accent: A. one `#2F5BFF` for both appearances, used only for fills and symbols (recommended); B. a lighter dark-appearance variant in the asset catalog, a new token.
- Spacing and radius: A. system control and `List` defaults only (recommended); B. a small named scale taken from the mockup (8 radius, 8/12/20 spacing), a new token set.

**Minor calls made by the loop** (reversible; listed for the owner)

| Call | Choice |
|---|---|
| Upcoming grouping | one section per date |
| Done grouping | one section per completion day |
| Add in Today | adds to the Inbox, due today |
| Add in Upcoming and Done | no field; ⌘N goes to the Inbox |
| Today order | overdue first, then by due date, then manual order |
| Project create and rename | a sheet, not inline editing in the sidebar, so errors have room |
| Sign out | no confirmation: nothing local is lost before `mac-sync` |
| Sign-in screen | inside the main window, not a separate window |
| Workspace rename | not in the shell, though the route exists |
| Project colours | none: the model has no colour field |

## 7. Owner decisions

The owner was not available on 2026-11-24. Each answer below is the build loop's call, reversible, listed in the loop's questions for the owner.

| Option | Answer | Date |
|---|---|---|
| O1 inspector | B: two columns plus `.inspector`, ⌥⌘I | 2026-11-24 |
| O2 new task | A: field at the top, the task appended last, selected and scrolled to | 2026-11-24 |
| O3 notes | B: inline Markdown rendered when not focused | 2026-11-24 |
| O4 saving | **B for every write in the shell**, against the recommendation: the row or field waits for the server, so the shell never shows a state the server refused and needs no rollback; `mac-sync` brings optimism with its offline queue | 2026-11-24 |
| O5 due date | A: a button and a popover with a graphical `DatePicker` and Clear | 2026-11-24 |
| O6 Connect an agent | A: omitted until `connect-an-agent` | 2026-11-24 |
| O7 short id | A: trailing in every row and in the inspector | 2026-11-24 |
| O8 open values | A, A, A: `Color.red` for overdue, one `#2F5BFF` in both appearances, system spacing and radius | 2026-11-24 |
| Minor calls | as listed above, including no workspace rename in the shell | 2026-11-24 |
| § 1.1 window minimum | **848 × 532 with every column shown, not 760 × 480**: on macOS 26 the split view keeps the sidebar (224) and the inspector (320) at their ideal widths while the window narrows and counts the floating sidebar twice; with the sidebar shown the list measures about 304, not 320. The height is 480 of content plus the toolbar, because a minimum read from the toolbar's measured height is the path of the inspector crash. Measured floors: 320 with the list alone, 528 with the sidebar, 640 with the inspector, each 532 high. The owner can choose instead a sidebar ideal of 180 (about 760) or an inspector ideal of 260 (about 788) | 2026-11-24 |
