# Design: mac-sync

**Sources:** [the approved product design](../../product/README.md) (macOS app → Sync; Anti-goals), [the shell's design](../mac-app-shell/design.md) (its § 7, O4: the shell waits for the server; `mac-sync` brings optimism "without changing the screens"), the build loop's brief for this feature (cache, outbox, pending adds, offline, refusals, last write wins, sign-out, 401, live updates). The mechanics are [`spec.md`](spec.md)'s and are not redesigned here.
**Design system:** unchanged from the shell: system materials, semantic colours, text styles and the one accent `#2F5BFF`. No token is added.
**Screenshots:** none taken. Playwright MCP drives a browser and this surface is a native window; the captures this document needs are listed in section 6 under `.pr-media/mac-sync/design/`, taken from the built app by the `recorder`. Until they exist, each option cites the shell element it changes.

## 1. Screens and states

No screen is added. The changes are one toolbar item, one row variant, one banner body, one confirmation and one sign-in line; and the shell's waiting states are removed.

### 1.1 What the shell's waiting states become

| Shell state (O4 = B) | Now |
|---|---|
| Row: checkbox replaced by a `ProgressView`, row disabled while a write is in flight | gone: the change shows at once, the row stays enabled |
| Inspector "Saving": the field read-only with a trailing `ProgressView` | gone: the field commits and stays editable |
| Add field: a `ProgressView` while the task is created | gone: Return adds a pending row at once (§ 1.4), clears the field, keeps focus |
| A checked task leaves the list once the server answers | the checkbox fills at once; the row leaves after a short linger (minor call), so a second click undoes a mis-click |
| Sheets (new or renamed workspace or project), sign-in, first workspace | unchanged: they still wait for the server and show their errors inline |

### 1.2 Launch

| Case | What shows |
|---|---|
| Session and a cache | the main window at once with the cached workspace, its rows and its badges; no loading screen, no spinner. The pull runs in the background and rows update in place |
| Session, no cache | the shell's loading screen, unchanged |
| Session, no cache, server unreachable | the shell's `FailureView` with `ErrorCopy.networkTitle` and Try Again, unchanged |
| Session and a cache, server unreachable | the cached window, then the offline item (§ 1.3) once the first pull fails; no banner |
| Switching to a workspace the cache does not hold | the shell's first-load state for that workspace |

The cached window opens on the workspace that was active when the app quit, Inbox selected (minor call). Pending rows and waiting changes saved in the outbox show as they were left.

### 1.3 Sync status: one toolbar item (option O1)

One quiet item in the toolbar's primary group, before Refresh, shown only when something is wrong. Online and idle there is nothing to see.

| State | Toolbar |
|---|---|
| Online, idle | Refresh as in the shell |
| Online, sending the outbox or pulling in the background | Refresh as in the shell; nothing spins (option O2) |
| A refresh the owner started (⌘R, the button) | the shell's small `ProgressView` in place of Refresh; it flushes the outbox, then pulls |
| Offline, no change waiting | the item: symbol `wifi.slash` and `SyncCopy.offline` |
| Offline, N changes waiting | the item: symbol and `SyncCopy.offlineWaiting(count:)`; the count follows the outbox as changes join it |
| Back online | the item disappears as the connection answers; the outbox flushes silently |

- Component: a `Button` with a `Label`, `.labelStyle(.titleAndIcon)` so the text shows (a toolbar `Label` is icon only by default), foreground `.secondary`. Clicking it does Refresh: try now. Help text `SyncCopy.offlineHelp`.
- "Offline" covers every case where the app cannot reach a working server (unreachable, a 5xx on pull or flush): the backoff retries both alike and the owner's answer is the same, wait.
- Narrow widths: the system moves it into the toolbar's overflow menu with Refresh and the inspector toggle; nothing custom.

### 1.4 Rows

**Pending add** (option O4): a task added but not yet confirmed, online for a blink or offline for as long as it takes.
- In the checkbox slot, SF Symbol `circle.dashed` in `.secondary`, not a button. Title in `.primary` as typed. The trailing id slot is empty: the number comes from the server. The sub-line shows what applies (the due label for a task added in Today, the project tag in cross-project views); no "via".
- It is not selectable: ↑ ↓ skip it, Return, Space and ⌘↩ do nothing on it, a double-click does nothing, there is no context menu and it cannot be dragged or moved. It sits at the end of its list, after the confirmed rows (shell O2 = A: a new task is appended last).
- Help text on the whole row: `TaskRowCopy.pendingHelp`.
- On confirmation it becomes a normal row in place: the checkbox and `T-{number}` appear, no animation beyond the system's. It is selected if the selection has not moved since it was added (the shell selects a new task); otherwise the selection stays.
- Refused (the project is gone): the row leaves and the refused notice shows (§ 1.5).

**A row whose change is waiting** (option O5): no marker. The row shows the owner's change as if saved; the offline item carries the count. Online, a change waits milliseconds and a marker would only flicker.

**Live updates** (option O8): a change an agent makes in an open project lands in the row within a second or two: title, due label, checkbox, order, and new or completed rows through the system `List` insert, move and remove animations. No highlight. The selection is kept. In the inspector, a field the owner is editing (focused title or notes) keeps the owner's text; every other field and History update. The owner's commit then wins, last write wins per field, with no conflict UI.

### 1.5 Refused change (option O6)

A queued change the server refuses is dropped, the project is pulled again, and the shell's banner strip shows once under the header: `ErrorCopy.changeNotSaved` (one change) or `ErrorCopy.changesNotSaved(count:)` (several refused in one flush), with `ErrorCopy.changeNotSavedBody` and Dismiss. It replaces any banner already shown, never stacks, and stays until dismissed or replaced; it is not raised again for the same flush. If the inspector showed a task that is now gone, the inspector shows the shell's `ErrorCopy.taskGone`.

### 1.6 Load failures with a cache (option O3)

| Failure | No cache for that project | Cache shown |
|---|---|---|
| `.network` on load or ⌘R | shell: `FailureView` or the banner with Try Again | no banner: the offline item says it |
| `.server` on pull | shell: the banner | no banner: the offline item says it |
| `.someProjectsFailed` | shell: the banner with Try Again | the failed projects keep their cached rows; no banner. The banner stays only for projects with nothing to show |
| `.projectGone`, `.workspaceGone`, `.taskGone` | shell | shell: the cache cannot keep what the server no longer has |

### 1.7 Sign out with changes waiting (option O7)

Sign Out (switcher menu, app menu) with an empty outbox signs out at once, as in the shell; the cache is erased silently. With N changes waiting it opens a `.confirmationDialog` on the main window: title `SyncCopy.signOutTitle(count:)`, message `SyncCopy.signOutMessage`, buttons `MainWindowCopy.signOut` (`role: .destructive`) and `SheetCopy.cancel` (`role: .cancel`, the default: Return and Escape both cancel). Confirming erases the cache and the outbox and shows Sign in.

### 1.8 Session ended (401) with changes waiting

Sign in shows `SignInCopy.sessionEndedWaiting(count:)` in place of `SignInCopy.sessionEnded`, the field prefilled with the last identity as in the shell. After a relaunch the same line shows whenever changes are still waiting on this Mac. Signing in as the same owner returns to the cached window and the outbox flushes; signing in as another owner erases them first, with no extra dialog (minor call).

### 1.9 The cache itself fails (added by the loop for the spec's failure handling)

| Case | What shows |
|---|---|
| The cache cannot be written | the shell's banner strip once per launch: `ErrorCopy.cacheNotSaved` with Dismiss; the window goes on from memory |
| The waiting changes on disk cannot be read at launch | the banner strip once: `ErrorCopy.waitingChangesLost` with Dismiss; the rest of the cache loads |

## 2. Components

| Component | Folder | Change |
|---|---|---|
| `SyncStatusItem` (new) | `MainWindow/TaskList` | the offline item; sits in `TaskListView`'s toolbar group beside `RefreshButton` and calls the same refresh |
| `RefreshButton` | `MainWindow/TaskList` | spins only for a refresh the owner started |
| `TaskRow`, `TaskCheckbox` (`Shared`) | `MainWindow/TaskList` | the pending variant; the in-flight `ProgressView` and `.disabled` go |
| `TitleField`, `NotesEditor`, `DueDatePicker` | `MainWindow/Inspector` | the saving `ProgressView` and read-only state go; a focused field keeps the owner's text on a live update |
| `AddTaskField` | `MainWindow/TaskList` | the `ProgressView` goes |
| `ErrorBanner`, `AppBanner+Copy` | `MainWindow/TaskList`, `Copy` | a new `AppBanner.changesRefused(count:)` shows `ErrorCopy.changeNotSaved` or `changesNotSaved(count:)` with `changeNotSavedBody`; `.cacheNotSaved` and `.waitingChangesLost` |
| `WorkspaceSwitcher`, the app menu's Sign Out, `FirstWorkspaceScreen`'s Sign Out | `MainWindow/Sidebar`, `Onboarding` | the confirmation |
| `SignInScreen` | `SignIn` | the waiting-changes line |

System components only: `ToolbarItemGroup`, `Button`, `Label`, `Image(systemName:)`, `.confirmationDialog`, `List` animations.

## 3. Tokens

All from the shell's § 3; nothing new.

| Use | Token |
|---|---|
| Offline item symbol and text | `.secondary`, the toolbar's own font |
| Pending ring | `.secondary` (`circle.dashed`) |
| Pending title | `.primary` (dimming would read as done: done rows are `.secondary`) |
| Refused banner | the shell's banner: `.fill.quaternary`, `exclamationmark.triangle.fill` in `.secondary` |
| Destructive Sign Out | the system destructive button style |

## 4. Copy

New strings are in section 8. Reused unchanged: `ErrorCopy.changeNotSaved` (now the one-change refused title), `ErrorCopy.taskGone`, `ErrorCopy.networkTitle`, `MainWindowCopy.signOut`, `MainWindowCopy.dismiss`, `MainWindowCopy.refresh`, `SheetCopy.cancel`, `SignInCopy.sessionEnded`. Counts use the system's inflection (`^[{count} change](inflect: true)`), never string concatenation, so one reads "1 change".

## 5. Interaction and accessibility

**Keyboard:** the offline item is a toolbar button, reached with Full Keyboard Access; ⌘R does the same. Pending rows are skipped by ↑ ↓ and ignore Return, Space, ⌘↩, ⌥⌘↑ and ⌥⌘↓ (the Task menu items are disabled with `TaskRowCopy.pendingHelp` as the reason). The sign-out dialog: Return and Escape cancel; Sign Out takes a click or Tab then Space. Nothing else changes from the shell's table.

**VoiceOver**
- Offline item: label `SyncCopy.offline` or `SyncCopy.offlineWaiting(count:)` as shown, hint `SyncCopy.offlineHelp`. Going offline posts one announcement, `SyncCopy.offline`; coming back posts none.
- Pending row: one element, label the title, value `TaskRowCopy.pending` then the sub-line; no actions.
- Refused banner: announced when it appears, as every banner in the shell.
- Live updates: no announcement per row (an agent can change many); the row reads its new value when focused.

**Motion:** the system `List` animations for live inserts, moves and removals, and for the linger before a checked row leaves. Reduce Motion: rows change at once, the pending row turns normal with no crossfade, the offline item appears with no transition.

**Contrast:** `.secondary` on the toolbar and on the window background is about 4:1, the system's own (Increase Contrast raises it); the offline state is never colour alone, it carries the word. The dashed ring is a shape difference from the solid checkbox ring, not a colour one.

## 6. Options

Captures to take from the built app at the default 1100 × 700 and at the 848 × 532 minimum, into `.pr-media/mac-sync/design/`: `offline-item.png`, `pending-row.png`, `refused-banner.png`, `sign-out-confirmation.png`, `session-ended-waiting.png`, and one annotated copy per option (`o1-…png` to `o8-…png`).

**O1. Where the sync status lives** (shell: the toolbar's Refresh and inspector toggle)
- A. One toolbar item beside Refresh, only when offline, with the count. Visible with the sidebar collapsed, sits by the control it shares (click = Refresh), silent when all is well.
- B. A line in the sidebar footer. Hidden whenever the sidebar collapses, which is the first thing to go at narrow widths, and takes the slot `connect-an-agent` will use.
- C. A banner under the list header while offline. Takes a row of the list on every offline launch and reads as an error for an expected state.
- **Recommendation: A.** One quiet indicator, where macOS puts window status.

**O2. What background sending and pulling show**
- A. Nothing; Refresh spins only for a refresh the owner started. Live updates arrive often and a flush takes milliseconds.
- B. Refresh spins whenever the outbox is sending or a pull runs. Honest, but it flickers on every agent change.
- **Recommendation: A.**

**O3. The `.network` banner once a cache exists** (shell § 1.5 Banner)
- A. No banner when cached rows are shown; the offline item says it. The shell's banner and `FailureView` stay for what the cache cannot show.
- B. The banner once per launch, then the item. Says it twice.
- **Recommendation: A.**

**O4. The pending add row** (shell: `TaskCheckbox`, the trailing `T-{number}`)
- A. `circle.dashed` in the checkbox slot, the id slot empty, not selectable. One static mark, works with Reduce Motion, says "not real yet" where the action would be.
- B. A small `ProgressView` in the checkbox slot. Reads as "working" for hours while offline.
- C. A disabled solid checkbox and `TaskRowCopy.pending` as text in the id slot. Explicit, but two marks, and a checkbox that does nothing.
- **Recommendation: A.**

**O5. A row whose change is waiting**
- A. No marker; the offline item holds the count. Clean rows; refusals are told anyway.
- B. A small `arrow.up.circle` in the sub-line until the change is sent. Precise, but one more symbol to learn and a flicker online.
- **Recommendation: A.**

**O6. The refused-change notice**
- A. The shell's banner, once per flush, one generic title with a count and a body, Dismiss. The row already shows the server's truth.
- B. The banner with the reason of the first refusal (`taskGone`, `projectGone`, the rule's copy). More exact for one, wrong for a mix.
- C. A system notification. Needs a permission prompt and is louder than a dropped edit deserves.
- **Recommendation: A.**

**O7. Sign out with changes waiting**
- A. A confirmation with the count, Sign Out destructive, Cancel the default. One extra step, only when something would be lost.
- B. The same plus "Send First". Online the outbox is already empty, so this only shows offline, where sending fails.
- C. Sign Out disabled until the outbox is empty. Traps the owner when the server is down.
- **Recommendation: A.**

**O8. Live updates**
- A. In place, no highlight, with the system `List` animations.
- B. A brief accent tint on the changed row. Shows where the agent worked, but adds motion and a colour use the accent rules keep for fills and selection.
- **Recommendation: A.** History already says who changed what.

**Minor calls made by the loop** (reversible; listed for the owner)

| Call | Choice |
|---|---|
| Offline symbol | `wifi.slash`; the alternative `antenna.radiowaves.left.and.right.slash` is less familiar |
| Checked row linger | about one second before it leaves Inbox, Today or a project, one named constant |
| Cached launch | the workspace active at quit, Inbox selected |
| Pending row after confirmation | selected only if the selection has not moved since the add |
| 401, then another owner signs in | the waiting changes are erased without a dialog; the sign-in line has already said how to keep them |
| Sign out with an empty outbox | no confirmation, as in the shell |

## 7. Owner decisions

The owner was not available. Each answer below is the build loop's call, reversible, listed in the loop's questions for the owner.

| Option | Answer | Date |
|---|---|---|
| O1 sync status place | A, the recommendation (loop's call) | 2026-11-24 |
| O2 background activity | A, the recommendation (loop's call) | 2026-11-24 |
| O3 `.network` banner with a cache | A, the recommendation (loop's call) | 2026-11-24 |
| O4 pending add row | A, the recommendation (loop's call) | 2026-11-24 |
| O5 waiting change marker | A, the recommendation (loop's call) | 2026-11-24 |
| O6 refused-change notice | A, the recommendation (loop's call) | 2026-11-24 |
| O7 sign out with changes waiting | A, the recommendation (loop's call) | 2026-11-24 |
| O8 live updates | A, the recommendation (loop's call) | 2026-11-24 |
| Minor calls | as § 1.1, § 1.2, § 1.8 and § 1.9 state (loop's calls) | 2026-11-24 |

## 8. Every new copy string

**SyncCopy** (new): offline "Offline" · offlineWaiting "Offline · {count} changes waiting" · offlineHelp "Can't reach todz. Your changes are kept on this Mac and sent when it's back." · signOutTitle "Sign out and lose {count} changes?" · signOutMessage "They haven't reached todz yet. Signing out erases them from this Mac."

**ErrorCopy:** changesNotSaved "{count} changes weren't saved." · changeNotSavedBody "todz now shows what it has saved." · cacheNotSaved "Changes can't be kept on this Mac. They're sent while todz is open." · waitingChangesLost "Changes waiting on this Mac couldn't be read and were lost."

**TaskRowCopy:** pending "Not saved yet" · pendingHelp "Not saved yet. It gets its number once todz has it."

**SignInCopy:** sessionEndedWaiting "Your session has ended. Sign in again to send {count} waiting changes."
