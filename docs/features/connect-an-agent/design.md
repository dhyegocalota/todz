# Design: connect-an-agent

**Sources:** [the spec](spec.md) (one project's keys, the selected project else the Inbox with a picker, the secret shown once, failures on screen, nothing offline), [ADR 0034](../../adr/0034-the-key-screen-shows-a-new-key-once-inside-each-client-s-command.md) (the three client blocks, the visible placeholder and disabled Copy without a secret, the server name `todz`, the secret in memory only), [ADR 0019](../../adr/0019-mcp-keys-are-prefixed-and-shown-once.md) (`todz_` and 43 base64url characters), [the approved product design](../../product/README.md) (macOS app → Main window: "Connect an agent" at the bottom of the sidebar; → Connect an agent; MCP server → the five tools), [the Glass mockup](../../product/mockups/glass-screens.html) ("Connect an agent": `.side-foot`, `.conn`, `.clients`, `.client`, `.field`, `.tools`, `.keys`, `.revoke`), [the shell's design](../mac-app-shell/design.md) (tokens, inline errors, the waiting `ProgressView`, contrast), [the sync design](../mac-sync/design.md) (the offline item) and the existing views under `apps/macos/Todz/MainWindow`, `apps/macos/Todz/Shared` and `apps/macos/Copy`.
**Design system:** unchanged from the shell: system materials, semantic colours, text styles and the one accent `#2F5BFF`. No token is added; monospaced text reuses the notes' `Font.body.monospaced()`.
**Screenshots:** none taken. Playwright MCP's `chrome-for-testing` browser is not installed (the navigate call to the mockup on 2026-11-24 printed `npx @playwright/mcp install-browser chrome-for-testing`, which needs the owner's OK per HARNESS 11), and the screen is native SwiftUI, outside any page it can open. The captures this document needs are listed in section 6 under `.pr-media/connect-an-agent/design/`, taken from the built app by the `recorder`. Until they exist, each option cites the mockup element or the shell element it keeps or changes.

**Where the mockup and the spec differ, the spec wins:**

| Mockup | This design | Why |
|---|---|---|
| "Keys for this workspace"; "Every client gets its own key, scoped to this workspace" | the keys of one project, chosen with a picker; one key works in any of the three clients | the API keys a project (spec, Non-goals) |
| Columns Client, Created, Last used | the key's last four characters and its creation time | the API has no name and no last use (spec, Non-goals) |
| Server URL `https://mcp.todz.app/w/todz` | the app's API base URL plus `/mcp` (`http://localhost:8787/mcp` in development) | the server's one endpoint; the key, not the URL, selects the project |
| Tools `add_task`, `list_tasks`, `search_tasks`, … as accent chips | `next`, `add`, `list`, `update`, `done`, one line each | the server's tools (product design → MCP server); option O8 |
| Three client cards whose "Copy command" copies text the owner never sees | each client's full block on screen, with Copy | ADR 0034: the owner sees what carries the secret; option O3 |
| "Revoke" in red text | a "Revoke…" button and a confirmation | spec ("behind a confirmation"); option O7 |
| A "Create a key" step is absent | "Create a Key" above the client blocks | ADR 0034: the blocks carry a new secret only after creation |

## 1. Screens and states

One sidebar destination and one screen in the main window's content column. No sheet, no new window. The menu bar and the widgets do not change.

### 1.1 Sidebar entry (option O1)

- A last section of the sidebar's `List`, without a header, after Projects: one row, `Label(ConnectAgentCopy.title, systemImage: "powerplug")` (the mockup's `#plug`), tagged `SidebarItem.connectAgent`. No open-count badge.
- Selecting it shows the key screen for the project the sidebar had selected (`.project`), else the Inbox (Inbox, Today, Upcoming, Done). The model keeps that project while `.connectAgent` is selected; the picker (§ 1.3) changes it.
- The inspector column is not shown on this screen (the mockup's two-column window); its toggle leaves the toolbar and ⌥⌘I is disabled there. Leaving the screen restores the inspector as it was.

### 1.2 Layout, top to bottom

The content column is the window background (`Color(nsColor: .windowBackgroundColor)`, as `TaskListView`) with one vertical `ScrollView`; every region below scrolls together, system padding throughout.

| Region | Content | Mockup |
|---|---|---|
| Header | leading `ConnectAgentCopy.title` in `Font.title` bold (as `TaskListHeader`); trailing the project picker (§ 1.3, option O2) | `.conn h1` |
| Intro | `ConnectAgentCopy.intro` in `.secondary` | `.conn > p` |
| Key | "Create a Key", or its progress, or its failure, or the secret notice (§ 1.4, option O6) | none |
| Clients | a segmented `Picker` (Claude Code, Codex, Cursor), then the chosen client's blocks (§ 1.5, option O3) | `.clients`, `.field` |
| Server URL | section title `ConnectAgentCopy.serverURL`, then a command block with the URL and Copy, always enabled | `.conn h4`, `.field` |
| Tools | section title `ConnectAgentCopy.tools`, then a two-column `Grid`: the tool's name in `Font.body.monospaced()` `.primary`, its line in `.secondary` (option O8) | `.tools` |
| Keys | section title `ConnectAgentCopy.keys`, the key rows or their state (§ 1.6), then `ConnectAgentCopy.keysFooter` in `Font.subheadline` `.secondary` | `.keys` |

Toolbar: `SyncStatusItem` and `RefreshButton`, as the task list; ⌘R refreshes the board and reloads the keys.

### 1.3 Project picker (option O2)

- A `Picker` with the `.menu` style, label `ConnectAgentCopy.project` (hidden visually, read by VoiceOver), items: the Inbox, then the workspace's projects in the sidebar's order, by name. A workspace with the Inbox only still shows the picker with one item.
- Changing the project forgets a shown secret at once (spec), clears every inline failure, and loads the new project's keys. No confirmation: the notice already says the key will not show again, and an unused key can be revoked in the list.
- A long name truncates at the tail in the picker's label, with the full name as help text; menu items are drawn by the system. The name appears nowhere else on the screen except the revoke confirmation, which wraps.
- At a narrow width the header stacks the picker under the title (`ViewThatFits`, § 1.8).
- The workspace switching (⌘1 to ⌘9 or the switcher) or the shown project leaving the workspace: the screen stays selected and follows the new active workspace's Inbox, forgetting the secret (spec).

### 1.4 The key region (option O6)

| State | What shows |
|---|---|
| No secret on screen | a prominent button `ConnectAgentCopy.createKey` (`.borderedProminent`, the accent); under it `ConnectAgentCopy.createKeyNote` in `Font.subheadline` `.secondary` |
| Offline (`syncStatus` is `.offline`) | the same button disabled because `ConnectAgentCopy.offlineReason` (`disabled(because:)`, help and hint) |
| Issuing | the button replaced by a small `ProgressView` with `ConnectAgentCopy.creating`, as the shell's sign-in; the picker stays enabled and changing project discards the answer |
| Issue failure | the button again, and under it `ConnectAgentCopy.issueFailed` in `Color.red`, then `ErrorCopy.networkBody` or `ErrorCopy.serverBody` in `.secondary`. The button is the retry and creates a new key (spec); no Try Again |
| Secret shown (a key just created) | the notice, in place of the button: a box filled with `.fill.quaternary` (as `ErrorBanner`), the symbol `key.fill` in `.secondary`, `ConnectAgentCopy.secretTitle` in `Font.headline`, `ConnectAgentCopy.secretBody(hint:)` in `.secondary`, and trailing `ConnectAgentCopy.hideKey` (bordered). The client blocks below now carry the secret and their Copy is enabled |
| Secret hidden (Hide Key, a project change, leaving the screen, revoking that key, a workspace switch, a sign-out) | back to "No secret on screen"; the key stays in the list by its hint |

### 1.5 Client blocks (ADR 0034, option O3)

A segmented `Picker` with `ConnectAgentCopy.claudeCode`, `codex`, `cursor`; Claude Code first and chosen when the screen opens, the choice kept while the app runs (minor call). Under it, the chosen client's blocks.

Every block is one `CommandBlock`: a caption row (leading the caption in `Font.subheadline` `.secondary`, trailing the `CopyButton`), then the text in `Font.body.monospaced()` `.primary`, full width, wrapping, on `.fill.quaternary`, selectable (`.textSelection(.enabled)`) only while it carries a secret. Copy sits on the caption row, never beside the text, so the block needs no narrow variant.

| Client | Block | Caption | Text, `<url>` the server URL, `<secret>` the new secret or the placeholder (option O4) |
|---|---|---|---|
| Claude Code | one | `ConnectAgentCopy.claudeCodeCaption` | `claude mcp add --transport http todz <url> --header "Authorization: Bearer <secret>"` |
| Codex | first | `ConnectAgentCopy.codexConfigCaption` | `[mcp_servers.todz]`, `url = "<url>"`, `bearer_token_env_var = "TODZ_API_KEY"`, three lines; it carries no secret, but its Copy follows the other blocks (ADR 0034, 2) |
| Codex | second | `ConnectAgentCopy.codexShellCaption` | `export TODZ_API_KEY=<secret>` |
| Cursor | button | none | `ConnectAgentCopy.addToCursor`, bordered, with the symbol `arrow.up.forward.app`; opens the install link of ADR 0034 |
| Cursor | one | `ConnectAgentCopy.cursorCaption` | the `mcp.json` JSON: `{"mcpServers": {"todz": {"url": "<url>", "headers": {"Authorization": "Bearer <secret>"}}}}`, pretty-printed with two-space indents |

| State | Blocks |
|---|---|
| No secret | the text with the placeholder in place of the secret (option O4); Copy and Add to Cursor disabled because `ConnectAgentCopy.createKeyFirst`, the Codex table included; the server URL stays copyable |
| Secret shown | the real text; every Copy enabled; Add to Cursor enabled |
| Copied | the button's label turns to `ConnectAgentCopy.copied` with a check for a named duration, then back (option O5); the layout does not move |
| Add to Cursor, Cursor not installed (the system refuses the link) | `ConnectAgentCopy.cursorDidNotOpen` in `Color.red` under the button until the next action on the screen |
| List failure, offline | unchanged: the blocks never depend on the key list (spec) |

### 1.6 Keys

| State | What shows under `ConnectAgentCopy.keys` |
|---|---|
| Loading | a small `ProgressView` with `MainWindowCopy.loading`; the rest of the screen is usable |
| No keys | `ConnectAgentCopy.noKeys` in `.secondary` |
| Some keys | the rows, newest first, separated by `Divider()` (option O9) |
| Many keys | the rows grow the screen's scroll; no inner scroll, no cap |
| A key just created | its row at the top; the notice names its hint, so the two read as one |
| List failure (network, 5xx) | `ConnectAgentCopy.listFailed` in `Color.red`, then `MainWindowCopy.tryAgain`, as `HistoryList`'s failure; a loaded list is never replaced by the failure on a failed reload: the rows stay and the line shows above them |
| Offline, list loaded | the rows; every "Revoke…" disabled because `ConnectAgentCopy.offlineReason` |
| Offline, list not loaded | the list failure; Try Again stays enabled, as the toolbar's offline item does |

**Row:** leading, two lines: `ConnectAgentCopy.maskedKey(hint:)` in `Font.body.monospaced()` `.primary`, then `ConnectAgentCopy.created(time:)` with `DayFormat.moment(instant:timeZone:)` in `Font.subheadline` `.secondary`; trailing `ConnectAgentCopy.revoke` (bordered, `.small` control size, option O7).

**Revoke confirmation** (option O7): the system `confirmationDialog`, as the sign-out one in `RootView`: title `ConnectAgentCopy.revokeTitle(hint:)`, message `ConnectAgentCopy.revokeMessage(project:)`, buttons `ConnectAgentCopy.revokeKey` (destructive) and `SheetCopy.cancel` (the default action, so Return cancels).

| Row state | What shows |
|---|---|
| Revoking | "Revoke…" replaced by a small `ProgressView` labelled `AccessibilityCopy.revoking`; the row stays until the server answers (shell O4 = B); other rows and Create stay enabled |
| Revoked (204) or already gone (404) | the row leaves with the system remove animation; no message (spec); if it was the shown key, the notice goes and the blocks return to the placeholder |
| Revoke failure | the row stays; `ConnectAgentCopy.revokeFailed` in `Color.red` under its two lines; "Revoke…" is the retry |
| Session ended (401) | the app's sign-out path; the secret goes with the screen |

### 1.7 States of the whole screen

| Case | What the screen shows |
|---|---|
| First open, keys loading | header, intro, Create, the blocks with the placeholder, URL, tools, the keys' progress |
| No keys yet | the same with `noKeys` |
| Some keys | the same with the rows |
| A key just created | the notice in place of Create; the blocks carry the secret; the row at the top of the list |
| Revoke confirmation | the dialog over the window; the screen unchanged behind it |
| Revoking | the row's progress |
| List failure | the keys' failure line with Try Again; everything above usable |
| Issue failure | Create, the red line and its reason; no secret anywhere |
| Offline | the toolbar's offline item; Create and Revoke disabled with the reason; URL and tools usable; a secret already shown stays copyable |
| A project with a long name | the picker truncates at the tail with help; the dialog wraps it |
| Narrow window | § 1.8 |

### 1.8 Narrow window

The narrowest content column is the shell's `listMinimumWidth` (the inspector is absent on this screen, so the window's minimum is the sidebar's plus the list's). At that width:

- the header stacks the picker under the title (`ViewThatFits`: one row first, then a `VStack`);
- the segmented picker keeps its three segments (each label is a short client name);
- command text wraps, breaking the secret and the URL by character when no space fits; Copy stays on the caption row;
- the tools grid keeps two columns, the description wrapping;
- key rows are two lines in every width, so nothing reflows.

## 2. Components

| Component | Folder | Change |
|---|---|---|
| `ConnectAgentView` (new) | `MainWindow/ConnectAgent` | the screen's root: the scroll, the regions of § 1.2, the toolbar, the load on appear and on project change |
| `ConnectAgentHeader` (new) | `MainWindow/ConnectAgent` | the title and the project picker, `ViewThatFits` |
| `KeyCreation` (new) | `MainWindow/ConnectAgent` | Create, its progress and failure, the secret notice with Hide Key |
| `ClientCommands` (new) | `MainWindow/ConnectAgent` | the segmented picker and the chosen client's blocks, the Cursor button and its failure line |
| `CommandBlock` (new) | `MainWindow/ConnectAgent` | caption, Copy, monospaced text; used by the clients and the server URL |
| `CopyButton` (new) | `MainWindow/ConnectAgent` | Copy with the in-place confirmation (option O5) and its disabled reason; writes to `NSPasteboard` |
| `ToolList` (new) | `MainWindow/ConnectAgent` | the five tools from the `TodzKit` constant (ADR 0034) |
| `KeyList`, `KeyRow` (new) | `MainWindow/ConnectAgent` | § 1.6 and the revoke confirmation |
| `ConnectAgentCopy` (new) | `Copy` | section 8 |
| `MainWindow` | `MainWindow` | the detail shows `ConnectAgentView` without the inspector when `.connectAgent` is selected, else `TaskListView` with it |
| `SidebarView` | `MainWindow/Sidebar` | the last section of § 1.1 |
| `SidebarItem+Presentation` | `Shared` | the symbol and title of `.connectAgent`; the plan gives it a place in the exhaustive switches the task list never reaches |
| `MainWindowState.requestNewTask` | app | ⌘N on this screen selects the Inbox first, as in Upcoming and Done |
| `AppCommands` | app | the inspector item disabled on this screen |
| `InspectorSectionTitle` | `MainWindow/Inspector` → `Shared` | reused for Server URL, Tools and Keys |
| `SyncStatusItem`, `RefreshButton`, `DisabledReason`, `DayFormat`, `SheetCopy.cancel` | `Shared`, `MainWindow/TaskList`, `Copy` | reused unchanged |

System components only: `ScrollView`, `ViewThatFits`, `Picker` (`.menu`, `.segmented`), `Button`, `Label`, `Grid`, `Divider`, `ProgressView`, `confirmationDialog`, `Image(systemName:)`, `openURL`, `NSPasteboard`.

## 3. Tokens

All from the shell's § 3; nothing new.

| Use | Token |
|---|---|
| Screen background | `Color(nsColor: .windowBackgroundColor)` |
| Command blocks, secret notice | `.fill.quaternary` |
| Create a Key | `.borderedProminent`: `Color.accentColor` = `#2F5BFF`, white label |
| Title | `Font.title` bold, `.primary` |
| Section titles | `InspectorSectionTitle`: `Font.callout`, `.secondary` |
| Command text, tool names, masked key | `Font.body.monospaced()` (the notes' inline code), `.primary` |
| Placeholder inside a command | `.secondary` (option O4) |
| Intro, tool lines, created time, notes, footer, captions | `.secondary`; captions, created time and footer in `Font.subheadline` |
| Notice title | `Font.headline` |
| Inline failures | `Color.red` (shell O8) |
| Copied confirmation | the button's own label colour; the check symbol is not tinted |
| Spacing, radius, control sizes | system defaults; the copied duration is a named constant beside `CopyButton` |

The mockup's tinted chips (`rgba(47,91,255,0.08)` and `#2546c9`), white cards with shadow (`.client`) and red revoke (`#e5484d`) are not drawn: each would be a new token or accent text (option O8, option O7).

## 4. Copy

New strings are in section 8. Reused unchanged: `MainWindowCopy.loading`, `MainWindowCopy.tryAgain`, `ErrorCopy.networkBody`, `ErrorCopy.serverBody`, `SheetCopy.cancel`, `SyncCopy.offline` and `offlineHelp` (the toolbar item). Client names are proper nouns and stay in `ConnectAgentCopy`. Command text is built in `TodzKit` (ADR 0034) and is not copy; only the placeholder is.

## 5. Interaction and accessibility

**Focus when the screen opens:** none moved; the sidebar keeps focus, so ↑ ↓ keep walking the sidebar.

**Keyboard**

| Keys | Where | Does |
|---|---|---|
| ↑ ↓ | sidebar | reach "Connect an Agent" after the last project (option O1) |
| Tab, ⇧Tab | screen | project picker → Create a Key or Hide Key → client picker → each Copy and Add to Cursor in the chosen client → the URL's Copy → Try Again → each Revoke…; with Full Keyboard Access |
| ← → | client picker | the previous or next client |
| Space | a focused button | activates it |
| Return, Escape | revoke confirmation | Cancel (the default), as the sign-out dialog |
| ⌘R | anywhere | Refresh; on this screen also reloads the keys |
| ⌘N | this screen | selects the Inbox and focuses its add field |
| ⌥⌘I | this screen | disabled |
| ⌘C | selected command text | copies the selection, as any text; selection exists only while a secret is shown |

No new shortcut: Return never creates a key (minor call).

**VoiceOver**
- Sidebar row: label `ConnectAgentCopy.title`, selected trait as the other rows.
- Title: header trait. Section titles: header trait (`InspectorSectionTitle`).
- Picker: label `ConnectAgentCopy.project`, value the project's full name.
- Create a Key: its title; disabled, its hint is the reason. Issuing: `ConnectAgentCopy.creating` announced.
- Notice: announced on appearance with `secretTitle`; read as one element with `secretBody(hint:)`; Hide Key carries the hint `AccessibilityCopy.hideKeyHint`.
- Client picker: the system segmented control.
- Command block: label the block's name (`AccessibilityCopy.copy(item:)` takes the same name), value the text; the placeholder reads as written. Copy: label `AccessibilityCopy.copy(item:)`; after a copy, `ConnectAgentCopy.copied` is announced; disabled, the hint is `createKeyFirst`.
- Tool row: one element, label the name, value its line.
- Key row: one element, label `AccessibilityCopy.keyEnding(hint:)` spoken character by character (`speechSpellsOutCharacters`), value the created line; Revoke… is its own button with label `AccessibilityCopy.revokeKey(hint:)`.
- Failures: each red line is announced when it appears, as `ErrorBanner` does.

**Motion:** the system insert and remove for the notice and the rows; the Copy label swaps with `.contentTransition(.opacity)`. Reduce Motion: everything changes at once.

**Contrast** (light background, the system's figures): `.primary` about 16:1; `.secondary` about 4:1 on the background and on `.fill.quaternary`; white on the accent button about 5.2:1; red about 3.5:1, so every failure says it in words and never relies on the colour. The accent is never text. Increase Contrast is the system's.

**The secret:** `CopyButton` writes a block that carries a secret with the pasteboard's concealed type (`org.nspasteboard.ConcealedType`) as well as plain text, so clipboard history tools that honour it skip it (minor call); the pasteboard is never cleared behind the owner's back (ADR 0034, 3).

## 6. Options

Captures to take from the built app, light and dark, at the default window size and at the narrowest content width, into `.pr-media/connect-an-agent/design/`: `sidebar-entry.png`, `loading.png`, `no-keys.png`, `some-keys.png`, `creating.png`, `secret-shown-claude-code.png`, `secret-shown-codex.png`, `secret-shown-cursor.png`, `copied.png`, `revoke-confirmation.png`, `revoking.png`, `revoke-failed.png`, `list-failed.png`, `issue-failed.png`, `offline.png`, `long-project-name.png`, `picker-open.png`, `narrow.png`, `cursor-not-installed.png`, and one annotated copy per option (`o1-…png` to `o10-…png`). Once the browser is installed, `mockup-connect-an-agent.png` from the mockup's block at 1280.

**O1. Where "Connect an Agent" sits in the sidebar** (mockup: `.side-foot`, pinned at the bottom)
- A. Pinned at the bottom through `.safeAreaInset(edge: .bottom)`, outside the `List`. The mockup and the product line exactly, always visible; but outside the list it has no system selection, so its selected look is drawn by hand, and ↑ ↓ never reach it.
- B. A last `List` section without a header, after Projects. System selection, ↑ ↓ and VoiceOver for free; it sits right after the projects, and with many projects it scrolls below the fold.
- **Recommendation: B.**

**O2. Where the project picker sits**
- A. The header's trailing edge, stacked under the title when narrow. Next to what it changes, the mockup's header kept.
- B. The toolbar. Always visible while scrolling, but the toolbar holds window actions, not content.
- C. A line under the title ("Keys for [project ⌄]"). Reads as a sentence, but the name appears twice in a narrow column.
- **Recommendation: A.**

**O3. How the three clients show** (mockup: three `.client` cards with Copy, the command text hidden)
- A. A segmented picker and the chosen client's blocks. The mockup's "Pick yours", one client's blocks at a time, a short screen.
- B. All three clients stacked. Nothing hidden, the longest screen (the Cursor JSON alone is about eight lines).
- C. The mockup's cards with Copy and no text. Shortest, but copies a secret the owner never sees, against ADR 0034's visible blocks.
- **Recommendation: A.**

**O4. The placeholder in place of the secret** (inside ADR 0034, 2: visible, Copy disabled)
- A. `<new key>` in `.secondary` inside the monospaced text. Says what will fill the gap and cannot be mistaken for a key.
- B. `todz_••••••••` in `.secondary`. Looks like the real shape, but reads as a hidden key that exists.
- C. `YOUR_TODZ_KEY`. The convention of documentation, but invites copying by hand and pasting as is.
- **Recommendation: A.**

**O5. The copy confirmation, without moving the layout**
- A. The button's label turns to "Copied" with a check for two seconds, both labels laid out on top of each other so the button keeps the wider one's width. Feedback at the pointer, no new surface.
- B. A toast overlaid at the bottom of the window. Visible from anywhere, but a new component and far from the click.
- C. An icon-only button whose symbol turns from `doc.on.doc` to `checkmark`. No width to reserve, but an icon without a word for the action that matters most.
- **Recommendation: A.**

**O6. Taking the secret off the screen**
- A. The notice carries "Hide Key"; leaving the screen or the project also hides it. The owner can clear the screen after copying, before a screen share.
- B. Only leaving the screen or the project (the spec's line). One string less, but the secret stays until the owner navigates away.
- **Recommendation: A.**

**O7. The revoke control** (mockup: `.revoke`, red text)
- A. A small bordered "Revoke…" (the ellipsis says a confirmation follows) and the system `confirmationDialog`, Cancel by default. The sign-out pattern already in the app.
- B. The mockup's red text button and the same dialog. Faithful, but red text is about 3.5:1 and a new colour use.
- C. Inline: the row turns into "Revoke? Cancel / Revoke". No dialog, but a second row look and an easy double-click to revoke.
- **Recommendation: A.**

**O8. The tool list** (mockup: `.tools`, accent chips with names only)
- A. A two-column grid: monospaced name, then its line in `.secondary`. The spec's "one line each", no new token.
- B. The mockup's chips, each line as help text. Compact and faithful, but the lines hide behind hover, and the chips need two new tokens and accent text.
- **Recommendation: A.**

**O9. The key rows** (mockup: a table with Client, Created, Last used)
- A. Two lines per row: `todz_…ab3x`, then "Created 24 Nov 2026 at 10:31"; trailing Revoke…; newest first; no column heads. Fits the narrowest column without reflow.
- B. The mockup's table with two columns, Key and Created, and heads. Scans like the mockup, but the columns collapse at the narrow width and need a second layout.
- **Recommendation: A.**

**O10. Offline**
- A. Create a Key and Revoke… disabled with "Keys need a connection to todz." as help and hint; the list, URL and tools stay. The spec's non-goal, said before the click.
- B. Both enabled; a click fails with the network line. No reason to keep in sync with the offline item, but an action offered that cannot work.
- **Recommendation: A.**

**Minor calls made by the loop** (reversible; listed for the owner)

| Call | Choice |
|---|---|
| Sidebar symbol | `powerplug`, the mockup's plug |
| Casing | "Connect an Agent" in the sidebar and the title (Title Case, as "Done Today"); notes and lines in sentence case |
| Client chosen on open | Claude Code, kept while the app runs |
| Changing project with a secret shown | no confirmation |
| Return on the screen | creates nothing; no new shortcut |
| Copied duration | two seconds, a named constant |
| Concealed pasteboard type | on every copy that carries a secret |
| Failed reload of a loaded list | rows kept, the failure line above them |
| Cursor link refused | a red line under the button until the next action |
| Inspector | hidden on this screen, restored on leaving |

## 7. Owner decisions

The loop took every recommendation as its call (owner, 2026-11-24: "take every decision and do not stop, I review later"); listed in the loop's questions for the owner.

| Option | Recommended | Answer | Date |
|---|---|---|---|
| O1 | B: a last `List` section after Projects | Loop's call: as recommended | 2026-11-24 |
| O2 | A: the picker at the header's trailing edge, stacked when narrow | Loop's call: as recommended | 2026-11-24 |
| O3 | A: a segmented picker and the chosen client's blocks | Loop's call: as recommended | 2026-11-24 |
| O4 | A: `<new key>` in `.secondary` | Loop's call: as recommended | 2026-11-24 |
| O5 | A: "Copied" in place in the button for two seconds, width reserved | Loop's call: as recommended | 2026-11-24 |
| O6 | A: "Hide Key" in the notice, as well as leaving | Loop's call: as recommended | 2026-11-24 |
| O7 | A: a bordered "Revoke…" and the system confirmation, Cancel by default | Loop's call: as recommended | 2026-11-24 |
| O8 | A: a grid of name and line | Loop's call: as recommended | 2026-11-24 |
| O9 | A: two-line rows, newest first, no column heads | Loop's call: as recommended | 2026-11-24 |
| O10 | A: Create and Revoke disabled offline, with the reason | Loop's call: as recommended | 2026-11-24 |
| Minor calls | as listed in § 6 | Loop's call: as recommended | 2026-11-24 |

## 8. Every new copy string

**ConnectAgentCopy** (new, `apps/macos/Copy/ConnectAgentCopy.swift`): title "Connect an Agent" · intro "Any MCP client can read and change this project's tasks. Create a key, then copy your client's command." · project "Project" · createKey "Create a Key" · createKeyNote "A key lets an agent work this project. You'll see it once." · creating "Creating a key…" · issueFailed "The key wasn't created." · offlineReason "Keys need a connection to todz." · secretTitle "Copy it now. You won't see this key again." · secretBody(hint:) "The commands below carry the key ending in {hint}. It's hidden for good when you leave this screen." · hideKey "Hide Key" · claudeCode "Claude Code" · codex "Codex" · cursor "Cursor" · claudeCodeCaption "Run in Terminal" · codexConfigCaption "Add to ~/.codex/config.toml" · codexShellCaption "Add to your shell profile" · cursorCaption "Or add to mcp.json" · addToCursor "Add to Cursor" · cursorDidNotOpen "Cursor didn't open. Copy the JSON below instead." · secretPlaceholder "<new key>" (option O4) · copy "Copy" · copied "Copied" · createKeyFirst "Create a key first." · serverURL "Server URL" · tools "Tools" · nextTool "Returns the one task to do now, with its notes." · addTool "Adds one or many tasks." · listTool "Lists tasks by state, due date and text." · updateTool "Changes a task's title, notes, due date or order." · doneTool "Completes tasks, with a note of what was done." · keys "Keys" · keysFooter "Revoke a key here at any time; agents using it lose access at once." · noKeys "No keys yet. Agents can't reach this project until you create one." · listFailed "Couldn't load the keys." · maskedKey(hint:) "todz_…{hint}" · created(time:) "Created {time}" · revoke "Revoke…" · revokeTitle(hint:) "Revoke the key ending in {hint}?" · revokeMessage(project:) "Agents using it can no longer reach {project}. This can't be undone." · revokeKey "Revoke Key" · revokeFailed "This key wasn't revoked. It still works." · claudeCodeCommand "Claude Code command" · codexConfiguration "Codex configuration" · codexShellLine "Codex shell line" · cursorJSON "Cursor JSON"

**AccessibilityCopy:** copy(item:) "Copy {item}" · keyEnding(hint:) "Key ending in {hint}" · revokeKey(hint:) "Revoke the key ending in {hint}" · revoking "Revoking" · hideKeyHint "The key keeps working; todz can't show it again."
