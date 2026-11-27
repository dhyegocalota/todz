# Design: workspace-lock

**Sources:** the lane brief's Decisions (the lock model, the re-lock triggers, the refusal line), [ADR 0092](../../adr/0092-settings-is-one-scrolling-form-of-sections-with-a-resizable-window-and-usage-sharing-asks-with-not-now-as-the-default.md) (Settings is one scrolling grouped form of sections), [ui-polish-forms](../ui-polish-forms/design.md) and [ADR 0104](../../adr/0104-forms-share-one-drawn-field-language-on-native-buttons-and-a-glass-panel.md) (`ValidationLine`, `FormButton`, the form language), and the views on `main`: `Settings/SettingsView.swift`, `Settings/SettingsRow.swift`, `Settings/SettingsWorkspaceRows.swift`, `Settings/SettingsWorkspaceShortcuts.swift`, `Shared/WorkspaceSwitcher.swift`, `WorkspaceMenuItems.swift`, `MenuBar/MenuBarHeader.swift`, `TodzWidgets/Views/WidgetPrompt.swift`.
**Design system:** unchanged. System text styles, semantic colours (`.primary`, `.secondary`), SF Symbols, `MotionToken`. No new colour, token, font or component view beyond the two named in § 2.
**Screenshots:** none taken. Every surface is native (Settings, menus, the popover, widgets, the system authentication sheet); Playwright MCP captures none of them. The developer renders the in-process captures (light and dark) from § 3 into `.pr-media/workspace-lock/`. No capture opens the popover in a loop.
**Rule of the whole feature:** a locked workspace says one thing, "Locked workspace", plus a lock glyph. It never carries a name, colour, count, project name, recency or task. The system does the authenticating; todz draws no password field of its own.

## 1. Settings: the switch, the timeout, the helper

**Where: the existing "Privacy & updates" section** (`SettingsCopy.privacyAndUpdates`), as its first two rows, above automatic updates and usage sharing. Why: it is the section ADR 0092 made for what the owner keeps to themselves; a new "Security" section for two rows would be the longest title on the shortest section.

```
Privacy & updates
 ┌───────────────────────────────────────────────────────────┐
 │ Lock other workspaces                              (  ○ ) │
 │ Ask for Touch ID or your Mac password before opening      │
 │ any workspace but this one.                               │
 └───────────────────────────────────────────────────────────┘
```

On:

```
 │ Lock other workspaces                              ( ●  ) │
 │ Other workspaces show as locked until you unlock them     │
 │ with Touch ID or your Mac password.                       │
 │───────────────────────────────────────────────────────────│
 │ Lock again after                                [ 5 min ⌄]│
 │ Locks sooner when the Mac sleeps or the screen locks.     │
```

Both are `SettingsRow` (title, one `.settingsDetail()` line, control on the trailing edge, the control carrying the detail as its hint), the same shape as the Menu Bar ribbon row (a `.menu` picker beside a switch). The timeout is its own row under the switch, **present only while the switch is on** (a plain `if`, like the Focus helper row in `generalSection`); it appears and disappears with `todzAnimation(.snap)`, a crossfade under Reduce Motion.

- **Switch.** `Toggle(...).toggleStyle(.switch).labelsHidden()`, default off.
- **Timeout picker.** `.pickerStyle(.menu)`, `.labelsHidden()`, four items in this order: `1 minute`, `5 minutes`, `15 minutes`, `1 hour`. Default 5 minutes. The closed menu shows the current choice.
- **Helper line.** The timeout row's detail is the helper: `Locks sooner when the Mac sleeps or the screen locks.` Why: it is the one fact the owner needs to trust the lock, and it fits the row's single detail line without a third row.
- **Turning on** needs no authentication and takes effect at once: the current workspace stays, the rest present as locked, and the session starts locked (the lock does not ask for a first unlock).
- **Turning off** asks for authentication (§ 3). Until it succeeds the switch stays on: SwiftUI shows it snapping back to on if the prompt is cancelled. No dialog of our own.
- **Changing the timeout** asks for authentication. Until it succeeds the picker keeps the old value (the binding's setter authenticates, then writes; a cancel never writes).
- **While the prompt is open** the control is disabled (`FormButton` busy rule: nothing around it moves), so a second click cannot stack a second prompt.

### 1.1 States

| State | Switch row | Timeout row |
|---|---|---|
| Off (default) | off, detail as above | not shown |
| On, session locked | on | shown, enabled |
| On, session unlocked | on, detail unchanged | shown, enabled |
| Prompt open | disabled, no spinner (the system sheet is the progress) | disabled |
| Cancelled | back to its previous value, nothing said | back to its previous value, nothing said |
| Authentication failed (three wrong attempts, Touch ID lockout the Mac then resolves with its own password prompt) | previous value, `ValidationLine(.issue)` under the row: `Couldn't confirm it's you. Nothing changed.` | same |
| Mac cannot authenticate at all (no password set: `canEvaluatePolicy` false) | disabled with `disabled(because:)` reason `Set a password for this Mac to use this lock.`; if it was already on, enabled so the owner can turn it off without a prompt | not shown while off |
| Overloaded (VoiceOver, Larger Text) | the detail wraps; no row reserves space (`reservesSpace` stays off, nothing swaps its subtitle) | same |
| Loading | none: a local setting reads synchronously | none |

Cancel is silent on purpose: the owner pressed Cancel, nothing needs saying.

## 2. A locked workspace everywhere it is listed

**One presentation.** The row is the workspace's position in the list with its content replaced:

- Glyph: `lock.fill`, `.secondary`, the leading or trailing slot the active workspace's `checkmark` uses.
- Text: `Locked workspace`, `.secondary`, one line.
- Nothing else: no name, no colour, no project count, no recency line, no `.help` tooltip with the name, no rename or delete.
- Several locked workspaces read the same, in their usual order. Why: telling them apart would need a name, a count or a colour, which is what the lock withholds; the position is what the shortcuts use.

**What a click does.** The system authentication sheet opens with the reason of § 3 (`switch`); on success the session unlocks **and** the workspace opens (the person asked for it, so no second click), and every row shows its name again; on cancel, nothing happens and the row stays locked; on failure, § 1.1's failure line in Settings, and an `AccessibilityNotification.Announcement` of the same sentence in the menus (a menu has no room for a line).

### 2.1 Surface by surface

| Surface | While locked | Notes |
|---|---|---|
| Switcher menu (`WorkspaceSwitcher`, main window and popover) | The current workspace as a checked `Toggle` with its name. Each other workspace as a `Button` with `Label("Locked workspace", systemImage: "lock.fill")`. **`All workspaces` is hidden** (the selection is collapsed to the current one; an "all" row would imply a combined view). `New Workspace`, `Rename`, `Delete` and `Sign Out` stay, acting on the current workspace only. | After unlocking, the menu is the existing one. |
| Switcher label | The current workspace's name only. | Plus the indicator of § 4. |
| Popover when only one workspace exists | Unchanged (a plain name, no menu, nothing to lock). | The lock changes nothing with one workspace. |
| Workspace menu (`WorkspaceMenuItems`) | Numbered items keep their positions and shortcuts (⌃1…9): the current one by name, the others `Locked workspace` with the lock glyph. `Previous` and `Next` stay enabled; stepping onto a locked workspace authenticates first. Rename and Delete act on the current workspace only. | A shortcut pressed for a locked workspace shows the same system sheet. |
| Settings, Workspaces list (`SettingsWorkspaceRows`) | The current workspace as today. Locked rows as above, **without the `ellipsis.circle` actions menu**. | Clicking a locked row authenticates, then switches. |
| Settings, Workspace Shortcuts (`SettingsWorkspaceShortcuts`) | Each chord row's title (`workspace.name` today) is `Locked workspace` for a locked workspace. The chord itself stays editable: it is the owner's key binding, not workspace data. | Recording a chord for a locked row needs no authentication. |
| Global hot keys, in-app shortcuts | Pressing the chord for a locked workspace shows the system sheet, then switches. The chord for the current workspace does what it does today. | No todz window needs to be frontmost for the sheet to appear. |
| Menu bar count and popover | The count is the current workspace's pending tasks only. The popover header shows the current workspace's name (`MenuBarHeader`'s `.help` keeps the current name only). | A locked workspace never adds to the count. |
| Morning glance, day close, ribbon | The current workspace's data only; their text carries no locked workspace's name. | Nothing locked is mentioned, not even "and 3 more". |
| Notifications | Title `todz`, body `A task changed.` with no task, project or workspace content. | Only while the switch is on and the session is locked, for any workspace; the current workspace's notifications keep their content. |

### 2.2 Copy

| Key | Text |
|---|---|
| `WorkspaceLockCopy.lockedWorkspace` | `Locked workspace` |
| `WorkspaceLockCopy.lockedNotificationBody` | `A task changed.` |
| `WorkspaceLockCopy.unlockRefusal` | `Unlock todz to use that workspace.` (the intent and link refusal, § 5) |

## 3. LocalAuthentication reason strings

`LAContext.localizedReason`. macOS shows it after the app name ("todz is trying to …"), so each is a lowercase verb phrase, no app name, no period, no "please". Policy `.deviceOwnerAuthentication` (Touch ID, then the Mac password). The developer confirms the rendering in a Debug build before merge.

| Action | `localizedReason` |
|---|---|
| Switch to a locked workspace (picker, menu, shortcut, hot key, link, widget, intent) | `open another workspace` |
| Turn the lock off | `turn off the workspace lock` |
| Change the timeout | `change when workspaces lock again` |

Turning the lock **on** shows no sheet. `localizedFallbackTitle` stays the system's ("Use Password…"); `localizedCancelTitle` stays "Cancel". Both are system-localised; none is set.

Reasons live in `WorkspaceLockCopy` (`apps/macos/Copy/WorkspaceLockCopy.swift`), one static per action; the authentication port takes the action, not a string, so the fake in tests can assert which action asked.

## 4. The "Locked" indicator

**Decision: one small glyph beside the switcher's current name, and nothing else.**

- Shown only while the switch is on. Session locked: `lock.fill`. Session unlocked: `lock.open.fill`. Both `.secondary`, `.caption`, trailing the workspace name inside the switcher label (main window and popover).
- It is not a button: the switcher's menu is the control. It carries a `.help` tooltip: locked `Other workspaces are locked.`; unlocked `Other workspaces are unlocked. They lock again after {timeout} without use.`
- While the session is unlocked, the switcher menu and the Workspace menu gain one item at the end of the workspace list, `Lock Now` (no authentication, no shortcut). Why: the owner can end the window of risk at once without waiting for the timeout, and it needs nothing a person could abuse.
- No banner, no badge, no colour, no title-bar chip. Why: the lock is a background guarantee; a loud indicator would turn it into a nag and tell a passer-by which workspaces matter.
- Menu bar icon, Dock icon and widgets show no indicator. Why: the menu bar item is the quietest surface and its count already follows the current workspace.

`Lock Now` joins `WorkspaceLockCopy.lockNow = "Lock Now"`; the glyph tooltips join as `lockedHelp` and `unlockedHelp(timeout:)`.

## 5. Widgets, intents, links, menu bar

**Widgets.** The shared snapshot holds the current workspace only (the model's rule), so a widget needs no new look: it shows the current workspace's today list, ring or next-up exactly as today. No lock glyph, no "locked" text, no hint that other workspaces exist. Why: anything the widget could say about locked workspaces would be data the lock withholds, and an empty widget is not an error. On lock, the timelines reload so a widget that showed another workspace's tasks switches to the current one within a refresh; until then the widget's own rendering is the previous snapshot, which is the same data the screen already showed.

A widget whose configuration names a workspace that is now locked shows `WidgetPrompt`'s existing layout with the title `todz` and the line `Unlock todz to use that workspace.` (`WidgetCopy.locked`, same style as `noSnapshot`: `.subheadline`, `.secondary`). Tapping it opens todz, which asks for authentication before showing that workspace.

**Intents and `todz://` links.** Targeting a locked workspace returns the refusal `Unlock todz to use that workspace.` as the result dialog (the same string as § 2.2), never the workspace's data. The link additionally brings todz to the front, so the owner can unlock if it was them. No name of the workspace appears in the refusal.

**Menu bar.** § 2.1.

## 6. Accessibility

**VoiceOver labels.**

| Element | Label | Hint or value |
|---|---|---|
| Settings switch | `Lock other workspaces` (the `Toggle` title) | hint: the row detail (as every `SettingsRow` control) |
| Timeout picker | `Lock again after` | value: `5 minutes`; hint: the helper line |
| Locked row | `Locked workspace` | hint: `Opens after you confirm it's you.`; trait: button. No name, no count, ever. |
| Current row | its name, `selected` trait | unchanged |
| Indicator glyph | `Other workspaces locked` or `Other workspaces unlocked` | decorative inside the switcher: the switcher's label is `AccessibilityCopy.switcher(name:)` plus this state, spoken once |
| `Lock Now` | `Lock Now` | |
| Failure line | the `ValidationLine` announces on appear (ADR 0104) | |

New copy: `WorkspaceLockCopy.lockedRowHint = "Opens after you confirm it's you."`, `lockedState = "Other workspaces locked"`, `unlockedState = "Other workspaces unlocked"`, `timeoutLabel = "Lock again after"`.

**Focus order.** Settings: Privacy & updates rows top to bottom: `Lock other workspaces` → (when on) `Lock again after` → automatic updates → usage sharing. When the timeout row appears it takes no focus; VoiceOver hears it in order. When the owner turns the switch off and succeeds, focus stays on the switch. After a cancelled prompt, focus returns to the control that opened it. In menus: the system menu order, current workspace first, locked rows in their positions, `Lock Now` last of the workspace items.

**Keyboard.** Every path is the existing one: Space toggles the switch; the picker opens with Space and moves with the arrows; a locked row activates with Space or Return; ⌃1…9 and the Previous and Next chords work on locked rows and open the system sheet. The system sheet is fully keyboard-operable (Return to confirm, Esc to cancel); Esc on it is a cancel.

**Reduce Motion.** The only animated change is the timeout row appearing and the glyph swapping: `.snap` normally, the `crossfade` token under Reduce Motion, resolved by `MotionRule`; no view reads the setting itself. Locking and unlocking swap rows with no slide or shake.

**Contrast and size.** All text is `.primary` or `.secondary` on the system grouped background, and the glyphs are `.secondary` SF Symbols that scale with the text; both adapt to dark mode and Increase Contrast. `.secondary` `.caption` glyph and the tooltip are supplementary: the state is also spoken and listed as a menu item, never carried by the glyph alone. Under Larger Text the rows wrap and the locked label never truncates (no `lineLimit` below two on the Settings rows).

## 7. Components

No new view. Reused: `SettingsRow` and `.settingsDetail()` (`Settings/SettingsRow.swift`, `View+SettingsDetail.swift`), `ValidationLine` (`Shared/ValidationLine.swift`), `disabled(because:)` (`Shared/DisabledReason.swift`), `WidgetPrompt` (`TodzWidgets/Views/WidgetPrompt.swift`), `WorkspaceSummary` stays for unlocked rows only.

Two small additions, both under the feature:
- `LockedWorkspaceRow` in `apps/macos/Todz/Shared/LockedWorkspaceRow.swift`: the one presentation of § 2 (glyph plus `Locked workspace`), used by `SettingsWorkspaceRows`, `SettingsWorkspaceShortcuts` titles and the two menus' labels. Why: five surfaces, one look, one place that can never show a name.
- `WorkspaceLockCopy` in `apps/macos/Copy/WorkspaceLockCopy.swift`: every string above plus the Settings strings of § 8.

Pure rules (what a row presents, which actions authenticate) live in TodzKit with the model, per the brief.

## 8. Copy, ready for the copy files

| Key | File | Text |
|---|---|---|
| `SettingsCopy.lockWorkspaces` | `apps/macos/Copy/SettingsCopy.swift` | `Lock other workspaces` |
| `SettingsCopy.lockWorkspacesDetailOff` | same | `Ask for Touch ID or your Mac password before opening any workspace but this one.` |
| `SettingsCopy.lockWorkspacesDetailOn` | same | `Other workspaces show as locked until you unlock them with Touch ID or your Mac password.` |
| `SettingsCopy.lockTimeout` | same | `Lock again after` |
| `SettingsCopy.lockTimeoutDetail` | same | `Locks sooner when the Mac sleeps or the screen locks.` |
| `SettingsCopy.lockTimeoutName(minutes:)` | same | `1 minute`, `5 minutes`, `15 minutes`, `1 hour` |
| `SettingsCopy.lockUnavailable` | same | `Set a password for this Mac to use this lock.` |
| `WorkspaceLockCopy.lockedWorkspace` | `apps/macos/Copy/WorkspaceLockCopy.swift` | `Locked workspace` |
| `WorkspaceLockCopy.confirmationFailed` | same | `Couldn't confirm it's you. Nothing changed.` |
| `WorkspaceLockCopy.reasonSwitch` | same | `open another workspace` |
| `WorkspaceLockCopy.reasonTurnOff` | same | `turn off the workspace lock` |
| `WorkspaceLockCopy.reasonTimeout` | same | `change when workspaces lock again` |
| `WorkspaceLockCopy.lockNow` | same | `Lock Now` |
| `WorkspaceLockCopy.lockedHelp` | same | `Other workspaces are locked.` |
| `WorkspaceLockCopy.unlockedHelp(timeout:)` | same | `Other workspaces are unlocked. They lock again after {timeout} without use.` |
| `WorkspaceLockCopy.unlockRefusal` | same | `Unlock todz to use that workspace.` |
| `WorkspaceLockCopy.lockedNotificationBody` | same | `A task changed.` |
| `WorkspaceLockCopy.lockedRowHint`, `lockedState`, `unlockedState`, `timeoutLabel` | same | § 6 |
| `WidgetCopy.locked` | `apps/macos/Copy/WidgetCopy.swift` | `Unlock todz to use that workspace.` |

The timeout values are 1, 5, 15 and 60 minutes, held in one TodzKit enum the Settings picker iterates (no literal in the view).

## 9. Options decided (one line each)

- **O1 Section.** "Privacy & updates", not a new section: the section exists for this kind of choice, and two rows do not earn a header.
- **O2 Locked row identity.** All locked rows read the same: any distinguishing mark is the data being hidden.
- **O3 Click behaviour.** Authenticate then open that workspace in one step: the owner already asked for it.
- **O4 Indicator.** A single quiet `lock.fill` / `lock.open.fill` glyph beside the switcher name, plus `Lock Now`: it says the state without a banner.
- **O5 Widgets.** No lock UI on widgets: they only ever hold the current workspace, so any text about locked ones would be a leak.
- **O6 Cancel.** Silent on cancel, one line on failure: cancelling is a choice, failing is news.
- **O7 `All workspaces` while locked.** Hidden: the selection is collapsed to the current workspace and an "all" row would promise a combined view.

## 10. Owner decisions

Answered 2026-11-26 by the loop, under the owner's instruction to decide every call: § 9 O1 to O7 as written. No question reaches the owner.
