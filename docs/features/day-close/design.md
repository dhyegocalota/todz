# Design: day-close

**Sources:** [the spec](spec.md), [ADR 0055](../../adr/0055-the-day-closes-once-a-day-in-the-menu-bar-popover-at-the-owner-s-time.md), [the focus-aware design](../focus-aware/design.md) (§ 1.1, O3), [the agent nudge design](../agent-nudge/design.md) (O1, O2), and the current code: `MenuBarToday` (header, banner, `AddTaskField`, `MenuBarTodayHeading`, `MenuBarTodayBody`, `MenuBarFoot`, `maximumPopoverHeight` 520), `MenuBarRow` (a `TaskRow` with hover fill, Return or Space reveals the task in the window), `MenuBarPopover` (`onBecomeKey` focuses the add field), `MainWindowState` (`completionLinger` 1 s, `CompletionLingers`), `TodzApp` (`popoverWidth` 360, `settingsWidth` 420), `SettingsView`, `MenuBarCopy`, `AccessibilityCopy`, `SettingsCopy`.
**Design system:** unchanged. System materials, semantic colours, text styles, the one accent. No token is added.
**Screenshots:** none taken. Both surfaces are native; Playwright MCP captures neither. The `recorder` takes the captures of § 6 with Orca into `.pr-media/day-close/design/`, in two popover openings at most: the popover lands on the owner's screen.

## 1. Screens and states

Two surfaces change: the popover gains a day-close mode; Settings gains a fourth row. The menu bar label, the main window, the widgets and the usual popover do not change.

### 1.1 The popover in day-close mode

```
┌──────────────────── 360 ─────────────────────┐
│ ▾ Personal                        Open todz  │
│ Close the day  3 left                        │
│ ○ Send the invoice to Ana              T-12  │
│   Done   Tomorrow   No date                  │
│ ○ Review the onboarding copy           T-15  │
│   Done   Tomorrow   No date                  │
│ ✓ Book the dentist                     T-9   │  ← lingering 1 s after Done
│ ○ Reply to the landlord                T-21  │
│   Due tomorrow                               │  ← lingering 1 s after Tomorrow
│ 2 done today                                 │
└──────────────────────────────────────────────┘
```

- `MenuBarTodayHeading` takes a title: `closeTheDay` in the mode, `MainWindowCopy.today` otherwise; the count stays `MenuBarCopy.left(count:)`, `.secondary`.
- Each open row gains an action line under the title, indented to the title's leading edge, always visible (O1), three text buttons (O2), the third worded `No date` (O3). The checkbox still completes; Done repeats it so the three choices sit side by side.
- The add field is hidden in the mode: the popover opens while the owner is typing elsewhere, and a stray keystroke must not become a task. Nothing has focus when it opens.
- After an action the row lingers `completionLinger` (1 s) showing its result, then leaves with the usual animation (O4): Done shows the checked box and the done title; Tomorrow and No date replace the action line with `dueTomorrow` or `noDueDate` in `.secondary`. The heading count drops at once.
- The workspace switcher stays; switching workspace ends the mode (the day close is about the active workspace).

| State | When | Shows |
|---|---|---|
| Rows | open tasks left | heading, rows with actions, foot |
| Many | more rows than 520 allows | the list scrolls as today; the heading counts all |
| Offline | `syncStatus != .online` | rows act as usual; the outbox queues the write; the foot shows the sync item |
| Failed | Today fails to load after opening | `FailureView` as today, no heading, no actions |
| Day closed | the last row leaves | `dayClosedTitle` and `dayClosedBody`, centred as the empty Today; the popover closes after `dayClosedLinger` (O5) |
| Ended | the popover closes, by itself or by the owner | the next opening is the usual Today |

Light and dark are the popover's material; nothing is tinted by hand. One width, 360.

### 1.2 Settings window

```
┌──────────────── todz Settings ────────────────┐
│ │ Show pending count in the menu bar   [●━] │ │
│ │ Let agents mention today's tasks     [━○] │ │
│ │ Quiet during Focus  [Open Focus Settings] │ │
│ │───────────────────────────────────────────│ │
│ │ Close the day         [18:00 ⇕]      [━○] │ │
│ │ At this time each day, todz opens on      │ │
│ │ what's left of Today.                     │ │
└───────────────────────────────────────────────┘
```

- A `LabeledContent` after the Focus row: the label is the title and the subtitle (`lineLimit(subtitleLines, reservesSpace: true)`), the content a `DatePicker` (`.hourAndMinute`, `.stepperField`, labels hidden) and the switch (O6). The picker shows the Mac's 12 or 24 hour format.
- Off: the picker is shown and disabled, so the window height never changes. Default 18:00. Both values live in the app's defaults (`DayClosePreference`, as `MenuBarBadge`).

## 2. Components

| Component | Folder | Change |
|---|---|---|
| `MenuBarToday` | `Todz/MenuBar` | reads the mode; hides the add field; passes the heading title |
| `MenuBarTodayHeading` | `Todz/MenuBar` | a `title` parameter |
| `MenuBarRow` | `Todz/MenuBar` | the action line under `TaskRow`, outside its `.ignore` element; the letter keys |
| `MenuBarDayCloseActions` (new) | `Todz/MenuBar` | the three buttons and the result line; one file, one purpose |
| `MenuBarTodayBody` | `Todz/MenuBar` | the Day closed state |
| `MenuBarPopover` | `Todz/MenuBar` | no add-field focus on become key in the mode |
| `MainWindowState` | app | lingers for Tomorrow and No date as for Done (`CompletionLingers` holds a toggled task only today; the developer extends it) |
| `SettingsView`, `SettingsCopy`, `MenuBarCopy`, `AccessibilityCopy` | | § 8 |

## 3. Tokens

| Use | Token |
|---|---|
| Heading title / count | `.primary` / `.secondary`, as today |
| Action buttons | `.borderless`, `Font.subheadline`, `.secondary`, as the header's Open todz |
| Result line | `.secondary`, `Font.subheadline` |
| Day closed | `.secondary`, title `Font.body`, body `.subheadline`, as the empty Today |
| Hover | `.fill.quaternary`, as today |
| Widths | `popoverWidth` 360, `settingsWidth` 420, unchanged |

## 4. Copy

New strings in § 8. Reused: `MenuBarCopy.left(count:)`, `MainWindowCopy.tomorrow`, `AccessibilityCopy.checkboxOpen(title:)`. "todz" stays lower case.

## 5. Interaction and accessibility

- **Keyboard:** Tab reaches each row, then (Full Keyboard Access) each of its buttons; Space presses a button. On a focused row, `D` Done, `T` Tomorrow, `N` No date (O7); Return and Space still reveal the task. Escape closes the popover and ends the mode.
- **VoiceOver:** on opening by itself, an announcement `dayCloseOpened(count:)`. The row reads its title and value as today, plus three actions (rotor) with the labels below. Each button is its own element: `Done, button` with the label `checkboxOpen(title:)`, `tomorrowLabel(title:)`, `noDateLabel(title:)`; `.help` gives the tooltips. After an action, the result is announced (`markedDone`, `dueTomorrow`, `noDueDate`); at the end, `dayClosedTitle`.
- **Motion:** the row leaves with the default animation after the linger; none with Reduce Motion, as `endLinger` does. The popover's own close is the system's.
- **Contrast:** `.primary` and `.secondary` on the popover's material, the system's guarantee in light, dark and Increase Contrast. Results are said in words and the checkbox shape, never colour.

## 6. Options

Captures into `.pr-media/day-close/design/`, light and dark: `popover-day-close.png`, `popover-lingering.png`, `popover-day-closed.png`, `settings-off.png`, `settings-on.png`; one annotated copy per option (`o1-…png` to `o7-…png`).

**O1. When the actions show**
- A. Always, on every open row. The mode exists for them; visible to a glance and to the keyboard.
- B. On hover or focus. A calmer list, but the popover opens by itself and the owner sees no way to act until he moves the pointer.
- **Recommendation: A.**

**O2. Icons or words, and where**
- A. Three SF Symbols trailing the row, with tooltips. Compact; a symbol for "no date" has no common meaning.
- B. Three words trailing the row. The title truncates near 140 pt at 360.
- C. Three words on a line under the title. The title keeps its width; the row grows by one short line.
- **Recommendation: C.**

**O3. The word for Drop**
- A. `Drop`. The spec's word; read as delete next to Done.
- B. `No date`. Says what the task becomes, as `Tomorrow` does: Done, Tomorrow, No date read as three destinations.
- C. `Someday`. Familiar from other apps; todz has no Someday list, so it promises a place that does not exist.
- **Recommendation: B**, with the tooltip "Removes the due date. The task stays open." The spec and the code keep "Drop" as the action's name.

**O4. After an action**
- A. The row shows its result for 1 s, then leaves. The owner sees what happened; matches completion everywhere else.
- B. The row leaves at once. Fastest; a mis-click is invisible.
- C. The row stays with its result and an Undo. Safest, but the list never shrinks and Undo is new to the product.
- **Recommendation: A.** A mistake is fixed from the main window.

**O5. The end**
- A. "Day closed", then the popover closes after 2 s. It came by itself and leaves by itself.
- B. "Day closed" stays until the owner closes it. One more click every day.
- C. Closes at once. Abrupt; the last action's result is never seen.
- **Recommendation: A.**

**O6. The time in Settings**
- A. The picker on the same row as the switch, disabled when off. One row; the height never moves.
- B. A second row "Time" shown when on. The macOS idiom, but the window jumps with `.contentSize`.
- C. A second row always shown, disabled when off. Steady, but a row of nothing when off.
- **Recommendation: A.**

**O7. Shortcuts**
- A. None; Tab and the rotor only. Nothing to learn, slow over ten rows.
- B. `D`, `T`, `N` on the focused row, named in the tooltips. Fast triage; no modifier, so only while a row has focus, and the add field is hidden.
- **Recommendation: B.**

## 7. Owner decisions

Empty when written; the lead records each answer here before the plan.

| Option | Answer | Date |
|---|---|---|
| O1–O7 | each one's recommendation in § 6, the build loop's call (the owner may overturn it) | 2026-11-25 |

## 8. Every new copy string

**MenuBarCopy** (`apps/macos/Copy/MenuBarCopy.swift`): closeTheDay "Close the day" · done "Done" · noDate "No date" · dueTomorrow "Due tomorrow" · noDueDate "No due date" · dayClosedTitle "Day closed" · dayClosedBody "Nothing left for today." · doneHelp "Mark as done (D)" · tomorrowHelp "Move to tomorrow (T)" · noDateHelp "Removes the due date. The task stays open. (N)"

**AccessibilityCopy** (`apps/macos/Copy/AccessibilityCopy.swift`): tomorrowLabel(title:) "Move \(title) to tomorrow" · noDateLabel(title:) "Remove the due date from \(title)" · markedDone "Done" · dayCloseOpened(count:) `InflectedCopy.text("Close the day, \(count) left")`

**SettingsCopy** (`apps/macos/Copy/SettingsCopy.swift`): closeTheDay "Close the day" · closeTheDayDetail "At this time each day, todz opens on what's left of Today." · closeTheDayTime "Time to close the day" (the picker's accessibility label)
