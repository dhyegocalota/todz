# Design: menubar-redesign

**Sources:** the owner's ask (2026-11-27, "faz o menubar ficar muito mais sexy, conciso e útil.. chama o frontend-designer e me surpreenda"), the popover on this branch (`apps/macos/Todz/MenuBar/`, `apps/macos/Todz/Shared/WorkspaceSwitcher.swift`, `apps/macos/Copy/MenuBarCopy.swift`), the capture `docs/screenshots/menu-bar/01-today-popover.png` (read, not retaken), [menu-bar design](../menu-bar/design.md) (O1 to O10, still the contract this feature amends), [ui-polish-forms design](../ui-polish-forms/design.md) and ADR 0104 (the form language: `FieldChrome`, `GlassSurface`, `FormMetrics`), [ADR 0077](../../adr/0077-the-motion-system-is-one-token-set-in-todzkit-with-every-effect-under-350-ms-and-a-crossfade-under-reduce-motion.md) (motion tokens), ADR 0071 (the ribbon, the status item is an image), ADR 0110 (the workspace lock), [workspace-lock design](../workspace-lock/design.md), ADR 0061 (budgets), ADR 0106 (count roll, row spring-in, title flight).
**Three tracks.** This document holds three pieces of work for 0.2.8 that go to different developers: the popover (§ 1 to § 10, track P), "Lock reveals nothing" (§ 11, track L) and the "Motion system" (§ 12, track M). § 13 is the file-ownership matrix and the order; § 10 holds every open owner decision.
**Design system:** unchanged: system text styles, semantic colours, the one accent `#2F5BFF`, system materials, SF Symbols, `MotionToken`, `FormMetrics`, `GlassSurface`. No colour, font or token is added; the few metrics the existing set cannot express are open questions in § 8, never inline values.
**Screenshots:** none taken. The popover is a native status-item panel that pops in front of the owner's work, so nothing here opened it; the mockups below are drawn from the code and the existing capture. The renders this feature produces come from in-process hosting of the real views (§ 9, the way ADR 0104 and ADR 0106 produced theirs), never from the live popover.
**Mockup key:** one character is about 6.9 pt, so every frame is the real 360 pt width. `◯` is an open checkbox, `●` a done one, `◔` the day ring, `✦` the agent marker (`sparkle`), `↗` the open-window button (`arrow.up.forward.app`), `…` the More menu (`ellipsis`), `░` a redacted placeholder.

## 1. What the popover is today

Top to bottom, 360 pt wide, up to 520 pt high:

```
╭────────────────────────────────────────────────────╮
│  Northwind Studio                       Open todz  │
│  ┌──────────────────────────────────────────────┐  │
│  │ Add a task                                   │  │
│  └──────────────────────────────────────────────┘  │
│  Today  4 left                                     │
│  ○ Send the homepage copy to Sam              T-1  │
│    Website relaunch  Overdue · 23 November         │
│  ○ Renew the design tool licence              T-1  │
│    Inbox                                           │
│  ○ Book the launch photo shoot                T-2  │
│    Inbox                                           │
│  ○ Fix the broken blog links                  T-2  │
│    Website relaunch  via Claude Code               │
│  ● Reply to the client about fonts            T-3  │
│    Inbox                                           │
│  1 done today        Switch workspace ⌘1–3         │
│  Check for Updates…  Star todz on GitHub  Quit todz│
╰────────────────────────────────────────────────────╯
```

Hierarchy: header (workspace, a text button), a tall flat add field, a `Today · N left` heading, two-line rows, a foot. The first row starts about 150 pt down.

What is crowded or noisy:

| # | Problem | Where |
|---|---|---|
| P1 | The foot carries up to six things in one 360 pt line: the done count, the update note, the switch hint, Check for Updates…, Star on GitHub, Quit. With two or more workspaces and an updater it wraps or truncates (the second line above is the real worst case). | `MenuBarFoot` |
| P2 | Every row is two lines even when the second says nothing useful: `Inbox` repeats on three of five rows; the tag sits on a grey block that makes the list look like a form. | `TaskRowSubline` |
| P3 | `T-1` appears twice for different projects: the id is project-scoped, so on a cross-project list it is ambiguous, yet it is the loudest thing on the right edge. | `TaskRow` |
| P4 | Three stacked blocks (header, field, heading) before any task; the answer to "what is left?" is a small grey `4 left`. | `MenuBarToday` |
| P5 | The add field is a flat rectangle with a square corner, unlike every form field after ADR 0104. | `AddTaskField` |
| P6 | `Open todz` is body-sized text in the header; the agent marker is a sentence (`via Claude Code`), not a mark. | `MenuBarHeader`, `TaskRowDetails` |
| P7 | The list has no keyboard path: rows are `.focusable()` but Return and Space both open the window, nothing completes a task from the keyboard, and arrow keys do nothing. | `MenuBarRow` |
| P8 | Loading is a spinner in a blank panel; "all done" is the same empty copy as "nothing due". | `MenuBarTodayBody` |

## 2. What every option shares

These are decisions the three options do not differ on; each is reversible and listed in § 8.

- **The foot disappears.** Quit, Check for Updates…, Star on GitHub and the update note move into one `More` menu (`…`) in the header. The switch hint becomes the last, disabled item of the workspace switcher's menu (popover only), drawn from the lock-filtered workspace list so it never counts a hidden workspace (track L owns that file, § 11). The done count moves into the list (a `Done today` line) so nothing hangs under the list.
- **Offline is a slim strip under the header**, not a foot item: the existing `SyncStatusItem` (a refresh button) in a `.fill.quaternary` capsule. It shows only while offline.
- **Rows say less.** One line when there is nothing to say; a second line only for: overdue (`DueLabel`, red, with its word), the project when it is not the Inbox, the workspace when more than one workspace is shown, the agent that added it. The `T-n` id shows on hover and focus only.
- **The add field takes the ADR 0104 chrome** (`FieldChrome` rounded rectangle, focus ring from `FormMetrics`) and keeps its destination: the Inbox, due today (menu-bar O1 unchanged).
- **One pure model decides the screen.** A TodzKit `MenuBarDay` takes the already-ordered Today lists and answers: which screen, the rows in order, the counts and the progress. The views only draw it; the model is where the tests live (§ 7).
- **Rows reuse `TaskCheckbox`** (the draw, the mint sparkle under `MotionToken.draw`, the linger) and the model's `toggleDone`; nothing about completing a task is re-implemented.
- **No new server API, dependency or storage.** Expansion of `Done today` lives in view state and resets when the app restarts.

## 3. Options

### Option A: Tidy (conservative)

The same skeleton, cleaned. No new surface.

```
╭────────────────────────────────────────────────────╮
│  Northwind Studio ⌄                         ↗   …  │
│                                                    │
│  ╭──────────────────────────────────────────────╮  │
│  │ Add a task                                   │  │
│  ╰──────────────────────────────────────────────╯  │
│                                                    │
│  Today  4 left                                     │
│  ━━━━━━━━━━━━━━━━━━──────────────────────────────  │
│  ◯ Send the homepage copy to Sam                   │
│    Website relaunch · Overdue · 23 November        │
│  ◯ Renew the design tool licence                   │
│  ◯ Book the launch photo shoot                     │
│  ◯ Fix the broken blog links                       │
│    Website relaunch · ✦ Claude Code                │
│  ● Reply to the client about fonts                 │
╰────────────────────────────────────────────────────╯
```

| Area | A |
|---|---|
| Hierarchy | Header, field, heading with a 3 pt progress line under it, rows. Same order as today. |
| Density | Rows 1 or 2 lines; the first row starts about 110 pt down. Done rows stay listed after the open ones (menu-bar O3 A). |
| Quick-add | `FieldChrome` field, top, focused on open. |
| Today list | Overdue first (existing order), `DueLabel` in red with its word; agent marker `✦ Claude Code`; `Workspace · Project` tag in plain secondary text when several workspaces show. |
| Header | Workspace switcher left; `↗` and `…` right; no ring. Day progress is the thin line. |
| Foot / menu | Gone; `…` holds the update note (a dot on the icon), Check for Updates…, Star, Quit. |
| Keyboard | Adds ↑ ↓ through the rows and Space to complete; the rest as § 5. |
| Effort | About 2 hours. |

### Option B: Quiet glass (bold)

A plus the day ring, a glass composer and a collapsed done list. Nothing in the list is larger than anything else.

```
╭────────────────────────────────────────────────────╮
│  Northwind Studio ⌄            ◔ 4 left   ↗   …    │
│                                                    │
│  ╭──────────────────────────────────────────────╮  │
│  │ + Add a task                              ⌘N │  │
│  ╰──────────────────────────────────────────────╯  │
│                                                    │
│  ◯ Send the homepage copy to Sam                   │
│    Website relaunch · Overdue · 23 November        │
│  ◯ Renew the design tool licence                   │
│  ◯ Book the launch photo shoot                     │
│  ◯ Fix the broken blog links              ✦ Claude │
│                                                    │
│  ✓ 1 done today                                  ⌄ │
╰────────────────────────────────────────────────────╯
```

| Area | B |
|---|---|
| Hierarchy | Header with the ring, glass composer, one flat list, `Done today` disclosure. No `Today` heading: the ring and count answer it. |
| Density | About 70 pt less than today for the same five tasks; no foot. |
| Quick-add | A glass capsule (`GlassSurface`, ADR 0104's panel metric scaled to a capsule) with a `+` and a `⌘N` keycap that hides while the field is focused. |
| Today list | A and: the agent marker is a glyph and the client name, trailing, not a sentence. |
| Header | Ring (done / total, arc in the accent on `.fill.quaternary`) beside `N left` with the numeric transition; at 0 open the ring closes into a check. |
| Foot / menu | As A. |
| Keyboard | As A. |
| Effort | About 3 hours. |

### Option C: Up next (boldest, recommended)

B plus one idea: the list leads with the one task to do now. The first open row (overdue first, as the model already orders them) is a larger card with a big checkbox; everything else is the quiet list below it. The ring, the count and the card are the whole top of the popover.

```
╭────────────────────────────────────────────────────╮
│  Northwind Studio ⌄            ◔ 4 left   ↗   …    │
│                                                    │
│  ╭──────────────────────────────────────────────╮  │
│  │ + Add a task                              ⌘N │  │
│  ╰──────────────────────────────────────────────╯  │
│                                                    │
│  Up next                                           │
│  ╭──────────────────────────────────────────────╮  │
│  │ ◯  Send the homepage copy to Sam             │  │
│  │    Website relaunch · Overdue · 23 Nov       │  │
│  ╰──────────────────────────────────────────────╯  │
│                                                    │
│  ◯ Renew the design tool licence                   │
│  ◯ Book the launch photo shoot                     │
│  ◯ Fix the broken blog links        ✦ Claude Code  │
│                                                    │
│  ✓ 1 done today                                  ⌄ │
╰────────────────────────────────────────────────────╯
```

| Area | C |
|---|---|
| Hierarchy | Header (workspace, ring and count, open, more), composer, `Up next` card, queue, `Done today`. One thing is large; the rest is small. |
| Density | The card is about 64 pt; with three queue rows the popover is about 290 pt against about 520 today for the same tasks. Rows beyond the maximum scroll under the pinned header and composer. |
| Quick-add | As B. It stays at the top, not docked at the bottom: the popover hangs from the menu bar and grows downward, so a bottom composer would move every time the list length changes and the owner could not build muscle memory. |
| Today list | The card shows the overdue label, the project (non-Inbox) and the agent marker like any row; the queue rows are B's. A task just checked lingers on the card (the existing linger), the burst plays on its checkbox, then the next task slides in with `MotionToken.settle`. |
| Header | As B. Workspace stays top-left (identity first, the multi-tenant rule). |
| Foot / menu | As A. |
| Keyboard | B's plus ⌘↩ completes the Up next task from the composer without moving focus. |
| Closing moment | Completing the last task closes the ring, plays the existing mint burst once at the ring, and swaps the card for the All done card (§ 4). Under Reduce Motion it is a crossfade. |
| Effort | About 4 to 5 hours with the model and its tests. |

Cut line if time runs short: ship B and add the card in a follow-up; B contains every file C touches except `MenuBarUpNext` and the ⌘↩ command.

## 4. States (recommended option C; A and B differ only where noted)

All frames are the real 360 pt width.

**Loading** (`phase == .loading`, or the workspace's first load). Three redacted rows (`.redacted(reason: .placeholder)`, static: no shimmer, so nothing moves under Reduce Motion). The composer and ring are absent until the first load ends, as today.

```
╭────────────────────────────────────────────────────╮
│  ░░░░░░░░░░░░░░░                                   │
│                                                    │
│  ◯ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░                    │
│  ◯ ░░░░░░░░░░░░░░░░░░░░                            │
│  ◯ ░░░░░░░░░░░░░░░░░░░░░░░░                        │
╰────────────────────────────────────────────────────╯
```

A load failure keeps the existing `FailureView` with Try Again in place of the rows, and no composer (as today).

**Empty Today** (nothing open, nothing done, nothing pending). The ring and count are hidden; the composer stays; the existing empty copy is centred.

```
╭────────────────────────────────────────────────────╮
│  Northwind Studio ⌄                         ↗   …  │
│                                                    │
│  ╭──────────────────────────────────────────────╮  │
│  │ + Add a task                              ⌘N │  │
│  ╰──────────────────────────────────────────────╯  │
│                                                    │
│                  Nothing due today                 │
│        Tasks due today or earlier show up here.    │
│                                                    │
╰────────────────────────────────────────────────────╯
```

**All done** (nothing open or pending, at least one done today, not in day close). The ring is closed and holds a check; the card is replaced by All done; the done list is one tap away.

```
╭────────────────────────────────────────────────────╮
│  Northwind Studio ⌄            ◉ All done  ↗   …   │
│                                                    │
│  ╭──────────────────────────────────────────────╮  │
│  │ + Add a task                              ⌘N │  │
│  ╰──────────────────────────────────────────────╯  │
│                                                    │
│  ╭──────────────────────────────────────────────╮  │
│  │ ✓  All done                                  │  │
│  │    Nothing left for today.                   │  │
│  ╰──────────────────────────────────────────────╯  │
│                                                    │
│  ✓ 7 done today                                  ⌄ │
╰────────────────────────────────────────────────────╯
```

**Offline or waiting changes** (`SyncStatus.offline(waiting:)`; the model has no separate "paused" status, so a paused send shows as offline with its waiting count). Cached rows stay; the strip refreshes on click; pending adds appear after the confirmed rows as `PendingTaskRow` (dashed circle, unchanged).

```
╭────────────────────────────────────────────────────╮
│  Northwind Studio ⌄            ◔ 4 left   ↗   …    │
│  ╭──────────────────────────────────────────────╮  │
│  │ ≈ Offline · 2 waiting                        │  │
│  ╰──────────────────────────────────────────────╯  │
│  ╭──────────────────────────────────────────────╮  │
│  │ + Add a task                              ⌘N │  │
│  ╰──────────────────────────────────────────────╯  │
│                                                    │
│  Up next  . . .  (card and queue as usual)         │
╰────────────────────────────────────────────────────╯
```

(`≈` stands for `wifi.slash`.) Offline and no cache for the workspace: the `FailureView` as today.

**Locked workspace** (ADR 0110, as amended by § 11). There is no locked state to draw: while the lock is on, the popover is exactly the popover of an account with one workspace. The header is the plain name (no `⌄`, no glyph, no tooltip), there is no switch-hint item, and nothing says other workspaces exist. The one way out is `Switch Workspace…` in the `…` menu, which is there for every account, locked or not.

```
╭────────────────────────────────────────────────────╮
│  Northwind Studio                 ◔ 4 left  ↗   …  │
│                                                    │
╰────────────────────────────────────────────────────╯
```

(Identical, pixel for pixel, to the header of an account that has one workspace; the `…` menu items are in § 5.) If the current workspace vanished while locked the phase is `.choosing`; § 11.5 says what is drawn.

**Day close** (`dayClose.isClosingDay`). The composer collapses as today (`maximumHeight` 0, hidden from VoiceOver); the ring stays; the card is not drawn (every row needs its three actions, so every row is the same size); each open row shows the existing `MenuBarDayCloseActions` (Done, Tomorrow, No date; D, T, N). Rows keep the arrow navigation. When the last row is resolved, the Day closed state shows for two seconds and the popover closes, as today.

```
╭────────────────────────────────────────────────────╮
│  Northwind Studio ⌄          ◔ Close the day  ↗  … │
│                                                    │
│  ◯ Send the homepage copy to Sam                   │
│    Done  Tomorrow  No date                         │
│  ◯ Renew the design tool licence                   │
│    Done  Tomorrow  No date                         │
╰────────────────────────────────────────────────────╯
```

```
╭────────────────────────────────────────────────────╮
│                         ◉                          │
│                     Day closed                     │
│               Nothing left for today.              │
╰────────────────────────────────────────────────────╯
```

**Signed out, naming, choosing** (`MenuBarPrompt`, copy unchanged): a centred column, the line, `Open todz` as the default prominent button (Return and ⌘O), `Quit todz` as a quiet link under it. No header, ring or `…` here, because there is nothing to open a menu about and Quit must stay reachable.

```
╭────────────────────────────────────────────────────╮
│                                                    │
│          Sign in to see what's due today.          │
│                    [ Open todz ]                   │
│                      Quit todz                     │
│                                                    │
╰────────────────────────────────────────────────────╯
```

**Other cases** unchanged from menu-bar § 1.3: one workspace shows its name as plain text (no `⌄`, no hint item); more than nine workspaces reach the first nine by ⌘1 to ⌘9; the banner (`ErrorBanner`) sits under the header and above the composer; `rule issue` shows under the composer in red as today; the day changing while open recomputes from `model.today`.

## 5. Interaction

**Focus on open:** the composer (menu-bar O5 unchanged).

| Keys | Where | Does |
|---|---|---|
| Return | composer | adds the task, clears, keeps focus |
| Return | focused row or card | opens the task in the main window with the inspector (menu-bar O2) |
| Space | focused row or card | marks it done, or reopens it (new: today Space opens the window) |
| ↓ | composer | focuses the Up next card (or the first row; in day close, the first row) |
| ↑ ↓ | rows, card, `Done today` | move focus; ↑ from the first item returns to the composer; ↓ from the last open row reaches `Done today` |
| ⌘↩ | anywhere but day close | marks the Up next task done without moving focus (C only) |
| ⌘N | popover | focuses the composer |
| ⌘O | popover | opens todz; replaces ⌘0 (§ 8, D6) |
| ⌘1 to ⌘N | popover | switches workspace, unchanged (the panel's `performKeyEquivalent`) |
| Esc | composer with text | clears it |
| Esc | otherwise | closes the popover, as today |
| D, T, N | focused row in day close | unchanged |
| ⌘Q | anywhere | quits (the app menu's, not a second registration: ADR 0031's trap) |

Tab order: switcher, open, More, composer, then the rows (Full Keyboard Access). Rows draw a `FormMetrics.focusRingWidth` ring in the accent while focused so the keyboard position is visible; hover keeps the `.fill.quaternary` tint.

The `…` menu, in order: `Updated to {version}` (only while an update note is pending; choosing it acknowledges it), `Check for Updates…`, `Switch Workspace…` (always present, § 11.3), divider, `Star todz on GitHub`, divider, `Quit todz`. A dot on the icon marks a pending update note. The Open button's tooltip names its key (`Open todz (⌘O)`); it carries the shortcut, the menu does not repeat it.

## 6. Light, dark, motion, accessibility

**Light and dark.** Everything is a semantic colour on the system menu bar extra material; dark is the token switch, never a per-view colour. The ring track is `.fill.quaternary`, the arc is `Color.accentColor`; the card is `.fill.quaternary` on a continuous rounded rectangle of `FormMetrics.fieldCornerRadius`; the composer is `GlassSurface` (glass on macOS 26, `.regularMaterial` on 14 and 15). Glass is used once, on the docked composer, never on the scrolling list (ADR 0104: no glass on scrolling content, no glass on glass). Reduce Transparency makes the material and the glass opaque through the system.

**Reduce Motion.** Every effect goes through the existing modifiers, so the rule in ADR 0077 holds without a view reading the setting: the ring's fill and the card swap use `todzAnimation(.settle)`; the count uses `todzCountTransition()`; the popover keeps `todzBloom`; the entrance of the day-close actions keeps `todzEntrance()`. With Reduce Motion on, all of these become the 150 ms crossfade and the checkbox burst is skipped (as `TaskCheckbox` already does). The loading rows are static. No effect is longer than 350 ms (ADR 0077's test already pins the tokens; no token is added).

**VoiceOver.**
- Header: the switcher as today (`AccessibilityCopy.switcher(name:)`, no lock value: § 11); the ring and count are one element, "Today, 4 left, 3 of 7 done"; Open is a button labelled `Open todz`; More is a menu button labelled `More`, value `Update available` while the dot shows.
- Composer: label `Add a task` (the existing action name), hint `Return adds it`.
- Up next card: one element, label the task title, value `Up next, {project}, Overdue 23 November, via {client}` (the existing `spokenValue` pieces), actions Mark as Done and the existing Tomorrow and No date in day close, default action opens the window, hint `AccessibilityCopy.rowOpensWindow`.
- Queue rows: as today. The list is a container labelled "Today, 4 left" so the rotor lists them.
- `Done today`: a button, value `Collapsed` or `Expanded`, label "7 done today".
- Offline strip: as `SyncStatusItem` (hint `SyncCopy.offlineHelp`). All done and Day closed: announced once (`AccessibilityNotification.Announcement`, as Day closed is today).
- Decorative glyphs (`sparkle`, `lock.fill`, ring) are hidden from VoiceOver; what they mean is in the spoken value.

**Contrast (AA).** Arithmetic from the colours, to be re-measured from the renders of § 9 the way ADR 0104's D3 did:

| Pair | Ratio | Needs | Verdict |
|---|---|---|---|
| Accent `#2F5BFF` ring and checkbox on white (light popover) | about 5.2:1 | 3:1 (graphic) | pass |
| Accent on a dark popover material (about `#1E1E1E`) | about 3.2:1 | 3:1 (graphic) | pass, the narrowest margin: measured from the dark render before ship |
| `.primary` titles on the material | system | 4.5:1 | pass |
| `.secondary` meta text on the material | about 4:1, the system's own | 4.5:1 | known gap of the system colour, as everywhere in the app; nothing is set in `.tertiary` |
| `.red` `Overdue` on light | about 3.4:1 (ADR 0104 measured the same pair) | 4.5:1 | known gap; the word carries the meaning, colour does not; owner question Q4 |
| Text in the accent | not used | n/a | the accent only fills shapes |

Re-checked 2026-11-27 for the build: the accent ratios recomputed from `#2F5BFF` against white and `#1E1E1E` come to 5.2:1 and 3.2:1, as stated. The in-process renders have no `AccentColor` asset (they draw the system blue) and no menu bar material, so the table was not re-measured from pixels.

Meaning never rides on colour alone: overdue is the word, the agent is a glyph plus the client name, done is the filled check, offline is the word and the symbol. Increase Contrast and Reduce Transparency are the system's.

## 7. Components, tokens, copy and the build

### Components reused

| Component | Path | Use |
|---|---|---|
| `TaskCheckbox` | `apps/macos/Todz/Shared/TaskCheckbox.swift` | every row and the card, unchanged |
| `DueLabel` | `apps/macos/Todz/MainWindow/TaskList/DueLabel.swift` | the overdue word, unchanged |
| `PendingTaskRow`, `ErrorBanner`, `FailureView`, `SyncStatusItem` | `MainWindow/TaskList`, `Shared` | unchanged |
| `AddTaskField` | `apps/macos/Todz/Shared/AddTaskField.swift` | restyled with `FieldChrome` metrics (it is shared with the main window; the change is the chrome only) |
| `GlassSurface`, `FormMetrics`, `FieldChrome` | `apps/macos/Todz/Shared/` | composer, card, focus rings |
| `WorkspaceSwitcher` | `apps/macos/Todz/Shared/WorkspaceSwitcher.swift` | one added disabled item in the popover |
| `MenuBarDayCloseActions`, `MenuBarPrompt`, `MenuBarPanel`, `MenuBarPanelReader` | `apps/macos/Todz/MenuBar/` | unchanged (the prompt's layout only) |
| `AppUpdater`, `StarRepositoryButton` | `Todz/OpenSource`, updater | move into the `…` menu |

### New components (all under `apps/macos/Todz/MenuBar/`, flat like the rest)

`MenuBarDayRing` (the arc, 3 lines of drawing), `MenuBarUpNext` (the card), `MenuBarMoreMenu` (the `…` menu), `MenuBarDoneToday` (the disclosure and its rows). Each is justified by a thing the system has no component for; none leaves the MenuBar folder.

### Tokens

| Use | Token |
|---|---|
| Card, offline strip, ring track, row hover | `.fill.quaternary` |
| Ring arc, checkbox | `Color.accentColor` |
| Card and composer corner | `FormMetrics.fieldCornerRadius`; the composer capsule uses `FormMetrics.panelCornerRadius` (§ 8, Q1) |
| Focus ring | `FormMetrics.focusRingWidth`, `Color.accentColor` |
| Titles | `.body`, `.primary`; the card title `.headline` |
| Count | `.title3` semibold; `todzCountTransition()` |
| Meta, hints, ids | `.subheadline`, `.secondary` |
| Motion | `.settle`, `.snap`, `.draw`, `.bloom`, `.crossfade` as listed in § 6 |

Open question Q1 (§ 8): the ring diameter and line width are two values the set cannot express.

### Copy (all in `apps/macos/Copy/MenuBarCopy.swift` unless noted)

| Key | Text |
|---|---|
| `upNext` | `Up next` |
| `allDoneTitle` | `All done` |
| `more` | `More` |
| `openWindowHelp` | `Open todz (⌘O)` |
| `upNextHelp` | `Mark the next task done (⌘↩)` |
| `progress(done:total:)` | `{done} of {total} done` |
| `todayProgress(left:done:total:)` | `Today, {left} left, {done} of {total} done` (VoiceOver) |
| `updateAvailable` | `Update available` (VoiceOver value of More) |
| `doneTodayShown`, `doneTodayHidden` | `Expanded`, `Collapsed` (VoiceOver value) |

Reused unchanged: `openWindow`, `quit`, `left(count:)`, `doneToday(count:)`, `switchHint(last:)`, `closeTheDay`, `dayClosedTitle`, `dayClosedBody`, `signedOut`, `naming`, `choosing`, `MainWindowCopy.addPlaceholder`, `todayEmptyTitle`, `todayEmptyBody`, `loading`, `SyncCopy`, `UpdateCopy.checkForUpdates`, `UpdateCopy.updatedTo(version:)`, `OpenSourceCopy.starOnGitHub`, `TaskRowCopy.via(client:)`, `AccessibilityCopy.rowOpensWindow`.

### New pure TodzKit logic (unit-tested first)

All under `apps/macos/TodzKit/Sources/TodzKit/`, tests in `apps/macos/TodzKit/Tests/TodzKitTests/`. They take already-computed lists, so they need no `AppModel`.

| Type | Decides | Tests (red first) |
|---|---|---|
| `MenuBarDay` | from `open: [BoardTask]` (already ordered by `TaskSections`), `doneToday`, `pendingCount`, `isClosingDay`, `load` (loading, failed, loaded): the `screen` (`loading`, `failed`, `dayClosed`, `closingDay`, `empty`, `allDone`, `active`), `upNext` (the first open task that is not done and not lingering done), `queue` (the rest), `leftCount`, `doneCount`, `progress` (done over done plus open, 0 when both are 0) | empty vs all done vs active; a lingering just-checked first row keeps the card until the linger ends; pending adds alone are not `empty`; progress at 0, partial, 1; day close beats active; failed beats loading |
| `MenuBarRowMeta` | from a `BoardTask`, the day, the shown workspace count: `overdue` date, `projectName` (nil for the Inbox, via `isInbox`), `workspaceName` (nil with one workspace), `agentName` | Inbox hides its tag; one workspace hides the workspace; overdue only when the due date is before today; a human-created task has no agent |
| `MenuBarNavigation` | `next(from:direction:in:)` over the ordered focus targets (`composer`, rows by `TaskKey`, `doneToday`), wrapping nowhere: ↑ at the top returns the composer, ↓ at the bottom stays | order, ends, day close (no composer), a vanished focused row falls back to the composer |
| `MenuBarNotice` | the single strip under the header: banner outranks offline outranks nothing; and whether `…` shows its dot (a pending update note) | precedence, dot only with a pending note |

### Build steps, track P (disjoint, test-first; each is shippable alone)

1. **Model.** `MenuBarDay`, `MenuBarRowMeta`, `MenuBarNavigation`, `MenuBarNotice` with their tests (red commit first, per the harness). Files owned: the four sources and four test files. No app code.
2. **Copy.** The keys above in `MenuBarCopy.swift`. Files owned: `apps/macos/Copy/MenuBarCopy.swift`.
3. **Foot to More.** Delete `MenuBarFoot.swift`; add `MenuBarMoreMenu.swift`; header uses it and the `↗` button (⌘O replaces ⌘0 here); the `Switch Workspace…` item is added by track L (L4), not here. Files owned: `MenuBarHeader.swift`, `MenuBarFoot.swift` (deleted), `MenuBarMoreMenu.swift`, `MenuBarQuitButton.swift` (kept for the prompt). `WorkspaceSwitcher.swift` belongs to track L alone, including the switch-hint item.
4. **Rows and the composer.** Row body per `MenuBarRowMeta` (one line by default, id on hover and focus, agent glyph), `MenuBarDoneToday` disclosure, the `AddTaskField` chrome, focus ring. Files owned: `MenuBarRow.swift`, `MenuBarTodayRows.swift`, `MenuBarDoneToday.swift`, `Todz/Shared/AddTaskField.swift`, `MenuBarFocus.swift` (adds a row case).
5. **Ring and states.** `MenuBarDayRing`, the header count, `MenuBarTodayBody` driven by `MenuBarDay.screen` (skeleton, empty, all done, day closed), the offline strip, `MenuBarToday` composition. Files owned: `MenuBarDayRing.swift`, `MenuBarToday.swift`, `MenuBarTodayBody.swift`, `MenuBarTodayHeading.swift` (deleted), `MenuBarLoading.swift`.
6. **Keyboard.** Arrow navigation through `MenuBarNavigation`, Space completes, Return opens, ⌘↩. Files owned: `MenuBarRow.swift` key handlers (after step 4), `MenuBarToday.swift` key commands (after step 5), `MenuBarPopover.swift`.
7. **Up next (C).** `MenuBarUpNext`, the closing moment. Files owned: `MenuBarUpNext.swift`, the card slot in `MenuBarToday.swift`.
8. **Renders and docs.** The in-process renders (§ 9), the README and docs updates, `docs/features/menu-bar/design.md` O10 and O3 marked amended. Files owned: `docs/screenshots/menubar-redesign/`, README, docs.

Steps 3 and 4 do not share files; 5 waits for 1 and 4; 6 waits for 4 and 5; 7 waits for 5.

## 8. Options for the owner and open questions

**Recommendation: C.** It is the boldest option that still answers "what is left, and what do I do now" at a glance, is shorter than today by roughly 40 percent, adds no chrome beyond one card and one ring, and uses glass once. It is Apple-quiet: no new colour, no motion above 350 ms, nothing moves unless a task changed. B is the fallback and a strict subset (§ 3 cut line); A is the right choice only if the owner wants no new surface at all.

| Q | Question | Recommendation |
|---|---|---|
| Q1 | The ring (about 22 pt, 3 pt line) and the composer capsule radius are values `FormMetrics` cannot express. Add `MenuBarMetrics` with `dayRingDiameter`, `dayRingLineWidth`? | Yes, two constants in one enum, `// NB ADR` pointer to the new ADR; the capsule reuses `panelCornerRadius`. |
| Q2 | Is hiding the `T-n` id until hover or focus acceptable? It is what the owner tells an agent (menu-bar O10's reason), and it is ambiguous across projects in the list. | Yes; the main window and the inspector still show it. This amends menu-bar O10 (a compact row), so it needs an ADR. |
| Q3 | Done today collapsed by default (menu-bar O3 had it listed)? | Collapsed; one line, the count stays visible. Amends O3. |
| Q4 | Overdue red on light is about 3.4:1 (the system red). Leave it, or give the line a leading `exclamationmark.circle.fill` as the form issue lines have? | Add the glyph; no colour is hand-picked. |
| D6 | ⌘O replaces ⌘0 for Open todz, and Space completes where it used to open? | Yes to both: ⌘O is the Mac convention and ⌘0 is rarely learned; Space-to-complete is what the checkbox promises. A migration note goes in the ADR. |
| Q5 | Type-to-add (a printable key on a focused row jumps to the composer) is left out: `AddTaskField` owns its text privately and seeding it is an API change to a shared component. | Defer to a follow-up. |

## 9. Renders to produce for the README

In-process, from the real views hosted in a window (offscreen hosting does not advance SwiftUI animations, so no motion is shown; ADR 0106 says the same), light and dark, 360 pt wide at 2x, into `docs/screenshots/menubar-redesign/`; never from the live popover:

`01-today-light.png`, `01-today-dark.png` (the recommended layout with the Up next card, an overdue task, an agent-added task, two workspaces tagged), `02-all-done-light.png`, `02-all-done-dark.png`, `03-offline-light.png`, `03-offline-dark.png`, `04-day-close-light.png`, `04-day-close-dark.png`, `05-more-menu-light.png`, `05-more-menu-dark.png`, `06-locked-switcher-light.png`, `06-locked-switcher-dark.png`. The README keeps its showcase budget (ADR 0085): `01-today-light.png` replaces `docs/screenshots/menu-bar/01-today-popover.png` in the existing row; the rest go to the docs tour. The contrast table in § 6 is re-measured from these renders and corrected in this document.

## 10. Owner decisions

The loop's call, 2026-11-27, under the owner's standing order to decide every call (PROMPT.md "Menu bar redesign", "Lock reveals nothing", "Cinematic motion"):

- § 3: option C, Up next.
- § 8: Q1 yes (`MenuBarMetrics`), Q2 yes, Q3 collapsed, Q4 the glyph, D6 yes to both, Q5 deferred to v1.1.
- § 11.8: L1 to L5 yes, as recommended.
- § 12.10: M1 to M3 yes, as recommended.

ADR 0112 records the popover, ADR 0113 the lock that reveals nothing, ADR 0114 the motion system.

## 11. Lock reveals nothing (track L)

The owner's rule (2026-11-27): "quando estiver locked workspace... não pode mostrar de fato que tem outros 'X Locked workspace'.. tem que ser mais sucinto pra pessoa de fora que ver não pensar 'hm... ele tem outros projetos secretos'". This supersedes the workspace-lock design's § 2 (the `Locked workspace` row), § 4 (the lock glyph and its tooltips) and § 5's widget and refusal copy, and ADR 0110's sentence that every other workspace is drawn as "Locked workspace". The lock model itself (what is hidden, when it relocks, Touch ID or the Mac password) is unchanged.

### 11.1 The rule, in three parts

1. **Locked is indistinguishable from a one-workspace account.** Every surface renders from one lock-filtered list, `visibleWorkspaces` (the current workspace alone while locked, all of them otherwise). No view reads the full list. A locked session therefore draws exactly what an account with one workspace draws: a plain name, no menu where a one-workspace account has none, no "All workspaces", no count of workspaces, no ⌘1 to ⌘N hint.
2. **No lock chrome while locked.** No glyph, badge, tooltip, banner, accessibility value, helper line or menu item that mentions locking, other workspaces or unlocking, on any surface. (The only place the lock is named is Settings, where the switch lives, and its wording is neutral, § 11.4.)
3. **A locked workspace answers as one that does not exist.** A link, a Shortcuts intent, an outbox change or a widget naming a locked workspace gets the same answer as an unknown identifier (`ErrorCopy.workspaceGone`, "This workspace is no longer available."), never "Unlock todz to use that workspace."

### 11.2 Every surface that shows a locked placeholder or a count today

From `grep` of `LockedWorkspaceRow`, `PresentedWorkspace`, `.locked(identifier:)`, `WorkspaceLockCopy`, `workspaceLocked` and `model.workspaces` (views only) on this branch:

| # | Surface | File and lines | What leaks | Change |
|---|---|---|---|---|
| 1 | Workspace switcher, main window sidebar and popover | `apps/macos/Todz/Shared/WorkspaceSwitcher.swift:37-51` | a `Locked workspace` row per hidden workspace | iterate `visibleWorkspaces` only; no locked branch |
| 2 | same | `:21` `model.workspaces.count == 1` | a menu (with a chevron) where a one-workspace account shows a plain name, so the popover reveals a second workspace | decide from `visibleWorkspaces.count` |
| 3 | same | `:33` hides `All workspaces` only while locked | the toggle is missing only when locked | hide `All workspaces` whenever `visibleWorkspaces.count == 1`, locked or not (a real one-workspace account loses a pointless toggle) |
| 4 | same | `:52-56` `Lock Now`, `:86-102` glyph, tooltip, VoiceOver value (`lockedHelp`, `lockedState`, `unlockedHelp`, `unlockedState`) | the lock exists and is on | delete the glyph, tooltip and value; `Lock Now` stays only in an unlocked session (§ 11.5) |
| 5 | Workspace menu | `apps/macos/Todz/WorkspaceMenuItems.swift:10-21, 29-37` | numbered `Locked workspace` rows, shortcuts for them | `WorkspaceShortcuts.numbered(visibleWorkspaces)` |
| 6 | same | `:61` `canStep` uses `model.workspaces.count > 1` | Previous and Next enabled only when others exist | `visibleWorkspaces.count > 1` |
| 7 | same | `:22-26` `Lock Now` | see row 4 | as row 4 |
| 8 | Popover foot hint | `apps/macos/Todz/MenuBar/MenuBarFoot.swift:14,29` | `Switch workspace ⌘1–N` counts hidden workspaces | the foot is deleted by track P; the hint's replacement in the switcher uses `visibleWorkspaces` (L3) |
| 9 | Launch picker | `apps/macos/Todz/Onboarding/WorkspacePickerScreen.swift:19, 51-54` | locked rows | iterate `visibleWorkspaces`; § 11.5 for the empty case |
| 10 | Settings, Workspaces list | `apps/macos/Todz/Settings/SettingsWorkspaceRows.swift:15-19, 52-64` | locked rows, a section that lists more than one | `visibleWorkspaces` rows only; delete `lockedRow` |
| 11 | Settings, Workspace Shortcuts | `apps/macos/Todz/Settings/SettingsWorkspaceShortcuts.swift:11, 20, 31-34` | `Locked workspace` as a chord row title, one chord row per hidden workspace | `numbered(visibleWorkspaces)`; delete the `.locked` title branch |
| 12 | Global hot keys | `apps/macos/Todz/Shared/WorkspaceShortcutController.swift:31` (`workspaceCount: model.workspaces.count`) | hot keys register for hidden workspaces; a conflict with another app's chord would surface | `visibleWorkspaces.count` |
| 13 | Settings lock rows | `apps/macos/Todz/Settings/SettingsWorkspaceLock.swift`, `apps/macos/Copy/SettingsCopy.swift:39-48` | wording says "other workspaces" and "show as locked" | neutral wording, § 11.4 |
| 14 | Refusals | `AppBanner+Copy.swift:15`, `Todz/Shortcuts/ShortcutRefusal.swift:36`, `Todz/Shortcuts/CompleteTaskIntent.swift:26`, `TodzKit/AppModel+Links.swift:41`, `+Outbox.swift:4`, `+Shortcuts.swift:79`, `+Workspaces.swift:94,108,143`, `ShortcutCompletion.swift:5`, `AppBanner.swift:11` | `Unlock todz to use that workspace.` | `refuseAsLocked()` raises `.workspaceGone`; the `.workspaceLocked` cases and `WorkspaceLockCopy.unlockRefusal` are deleted |
| 15 | The row component and its model | `Todz/Shared/LockedWorkspaceRow.swift`, `TodzKit/PresentedWorkspace.swift`, `WorkspaceLock.presented(_:current:)`, `AppModel.presentedWorkspaces` | the type that exists to draw the placeholder | deleted |
| 16 | Copy | `WorkspaceLockCopy.lockedWorkspace`, `lockedRowHint`, `lockedHelp`, `lockedState`, `unlockedState`, `unlockedHelp(timeout:)`, `unlockRefusal` | the words themselves | deleted |
| 17 | Menu bar count, popover, morning glance, day close, ribbon, widget snapshot | all read `shownWorkspaces`, which is already the one current workspace while locked | nothing today; a workspace tag on rows (`BoardTask.workspaceName`) appears only when several are shown | no change; pinned by the equivalence test (§ 11.6) |
| 18 | Widgets | `apps/macos/TodzWidgets/` has no workspace picker or locked copy (`WidgetCopy.locked` of the old design was never added) | nothing | no change; keep it that way (rule, no code) |
| 19 | Search and notifications | the app has no search and no notification that names a workspace (`lockedNotificationBody` was never added) | nothing | rule for the future: neither may carry data from, or a hint of, a hidden workspace |

Not surfaces: `AppDelegate+UsageSharing.swift:27` records a `multiWorkspace` usage event from the full list (a counter, not a drawing), and `DeletionKind.swift:41-42` checks existence of the thing being deleted. Both stay.

### 11.3 The neutral way back in

**`Switch Workspace…`** exists for every account, locked or unlocked, with one workspace or many, so its presence says nothing. Two entry points, one behaviour:

- **E1.** The Workspace menu (`WorkspaceMenuItems.swift`), first item, key ⌘K (free in the app: no other binding on `k`).
- **E2.** The popover's `…` menu (§ 5), third item, no key.

Behaviour of `AppModel.beginWorkspaceSwitch() async -> Bool`:

1. Lock off, or session already unlocked: no prompt.
2. Locked: the system prompt (Touch ID, else the Mac password), **always, whether or not any other workspace exists**, so the prompt itself proves nothing. Its reason line becomes the neutral `switch workspaces` (was `open another workspace`).
3. Cancelled or failed: nothing happens, as today (silent cancel; failure line and announcement as today).
4. Confirmed: the session unlocks and a `WorkspaceChooserSheet` opens in the main window (E2 first opens the main window, as `Open todz` does): the visible workspaces with the current one checked, Return picks, Esc cancels. It is the launch picker's row list in a sheet, not a new design. With one workspace it lists one.

The chords ⌃1 to ⌃9, Previous and Next, and the global hot keys exist only for visible workspaces; a chord beyond the visible ones does nothing and says nothing (a prompt would prove a second workspace exists). Once unlocked, they all work as today until the session relocks.

### 11.4 Settings wording

The switch and its timeout stay in "Privacy & updates". The rows exist for every account, so their presence says nothing. The detail line is the same on and off.

| Key | Today | New |
|---|---|---|
| `SettingsCopy.lockWorkspaces` | `Lock other workspaces` | `Require Touch ID to switch workspaces` |
| `lockWorkspacesDetailOff` and `lockWorkspacesDetailOn` | two different sentences naming "any workspace but this one" and "show as locked" | one string, `lockWorkspacesDetail`: `Ask for Touch ID or your Mac password before switching workspaces.` |
| `lockTimeout` | `Lock again after` | `Ask again after` |
| `lockTimeoutDetail` | `Locks sooner when the Mac sleeps or the screen locks.` | `Also asks again when the Mac sleeps or the screen locks.` |
| `lockUnavailable` | `Set a password for this Mac to use this lock.` | `Set a password for this Mac to turn this on.` |
| `WorkspaceLockCopy.reasonSwitch` | `open another workspace` | `switch workspaces` |
| `WorkspaceLockCopy.reasonCreate`, `reasonRemove` | `create a workspace`, `delete a workspace` | unchanged |
| `WorkspaceLockCopy.reasonTurnOff`, `reasonTimeout` | `turn off the workspace lock`, `change when workspaces lock again` | both `change this setting`: neither names what is hidden |

A developer confirms the sheet's rendering in a Debug build, as the lock design required. Timeout option names are unchanged.

### 11.5 Edge cases and what an onlooker can still see

- **Unlocked session.** All workspaces show by name, as the owner asked for them; the timeout locks again. `Lock Now` appears in the switcher and the Workspace menu only now (an onlooker who sees it already sees every workspace name, so it adds nothing). It is the only lock word on any menu.
- **The current workspace vanished while locked** (deleted on another device; ADR 0110 says the picker asks). Nothing may be drawn that implies others exist, so the picker opens only after the system prompt: the window shows its loading state while the prompt is up; on confirm the picker lists all workspaces; on cancel the loading state stays and `Switch Workspace…` is available. Owner question L4.
- **Creating or deleting a workspace while locked** still authenticates (`createWorkspace`, `removeWorkspace`), regardless of count, as today.
- **Window title, Dock, menu bar icon and count, widgets:** the current workspace only, as today.
- **Residuals the rule cannot remove** (stated so nobody promises more): Settings shows that a switch is on (a one-workspace account may switch it on, so it proves nothing); the Touch ID prompt on `Switch Workspace…` appears whether or not a second workspace exists; the cache folder and the network are not covered (ADR 0110's Consequences).

### 11.6 TodzKit logic and tests a developer changes

All in `apps/macos/TodzKit/`; every test is written red first.

| Change | Source | Tests |
|---|---|---|
| `AppModel.visibleWorkspaces` (public), from the existing `WorkspaceLock.visible(_:current:)` | `AppModel+WorkspaceLock.swift`, `WorkspaceLock.swift` | locked returns the current alone; unlocked returns all; lock off returns all; current missing returns `[]` |
| Delete `PresentedWorkspace`, `WorkspaceLock.presented`, `AppModel.presentedWorkspaces`; `WorkspaceShortcuts.numbered(_:)` and `lastNumber(of:)` take `[Workspace]` | `PresentedWorkspace.swift`, `WorkspaceLock.swift`, `WorkspaceShortcuts.swift` | rewrite the affected cases in `WorkspaceLockTests.swift` (34 references), `AppModelTests+WorkspaceLock.swift` (32), `WorkspaceShortcutsTests.swift` (4), `AppModelHarness.swift` (5) |
| New `WorkspaceLockAction.switchWorkspaces`; `requiresAuthentication` is true whenever the session is locked, independent of how many workspaces exist; remove `.showWorkspaces(identifiers:)` and `isAuthorized(toShow:)` (nothing lists a locked workspace any more) | `WorkspaceLockAction.swift`, `WorkspaceLock.swift`, `AppModel+WorkspaceLock.swift` | locked with one workspace still requires authentication; unlocked and lock-off do not; the fake authenticator records the action |
| `AppModel.beginWorkspaceSwitch()` | `AppModel+WorkspaceLock.swift` | cancel changes nothing; confirm unlocks; two concurrent calls share one prompt (the existing `runningAuthentication` rule) |
| `refuseAsLocked()` raises `.workspaceGone`; delete `AppBanner.workspaceLocked`, `ShortcutCompletion.workspaceLocked` and their copy | `AppModel+WorkspaceLock.swift`, `AppBanner.swift`, `ShortcutCompletion.swift`, `AppModel+Shortcuts.swift`, `+Links.swift`, `+Outbox.swift`, `+Workspaces.swift` | an intent, a link and an outbox change naming a locked workspace return exactly what the same call returns for an unknown identifier (equal values, not just equal strings) |
| New pure `WorkspaceChrome` | `WorkspaceChrome.swift` | from `visible: [Workspace]`, `selection`, `isMainWindow` it answers `switcher` (`.plainName` or `.menu`), `showsAllWorkspaces`, `rows`, `showsSwitchHint`, `lastShortcutNumber`, `canStep`; **the equivalence test**: for N from 1 to 12 hidden workspaces, `WorkspaceChrome` built from the locked model equals the one built from a model holding only the current workspace, for the popover and the main window |
| `LockIndistinguishabilityTests` (model level) | `Tests/TodzKitTests/` | a locked model with three workspaces and a model with only the current one are equal in `visibleWorkspaces`, `shownWorkspaces`, `todayHeadingCount`, `taskViews`, the widget snapshot and the shortcut registration decision (`WorkspaceShortcuts.shouldRegister`) |
| Copy deletions in § 11.2 rows 14 to 16 | `apps/macos/Copy/` | a repository-shape test fails if `Locked workspace`, `lockedState` or `unlockRefusal` reappear in `apps/macos` |

### 11.7 Build steps, track L (disjoint from P and M)

- **L1. Model.** The table above except `WorkspaceChrome`: `visibleWorkspaces`, deletions, `.switchWorkspaces`, `beginWorkspaceSwitch`, refusals as gone; updated tests. Owns `apps/macos/TodzKit/Sources/TodzKit/{AppModel+WorkspaceLock,WorkspaceLock,WorkspaceLockAction,PresentedWorkspace,WorkspaceShortcuts,AppBanner,ShortcutCompletion,AppModel+Shortcuts,AppModel+Links,AppModel+Outbox,AppModel+Workspaces}.swift` and the tests named above.
- **L2. `WorkspaceChrome`** and the two equivalence tests. Owns `WorkspaceChrome.swift`, `LockIndistinguishabilityTests.swift`.
- **L3. Views.** `WorkspaceSwitcher.swift` (including the popover's disabled `Switch workspace ⌘1–N` item from § 2, N from the visible list, hidden when N is 1), `WorkspaceMenuItems.swift`, `WorkspacePickerScreen.swift`, `SettingsWorkspaceRows.swift`, `SettingsWorkspaceShortcuts.swift`, `WorkspaceShortcutController.swift`; delete `LockedWorkspaceRow.swift`. Needs L1 and L2.
- **L4. `Switch Workspace…`.** E1 in `WorkspaceMenuItems.swift` (after L3), the `WorkspaceChooserSheet` (new, `apps/macos/Todz/Shared/`), its presentation state in `MainWindowState.swift`, and E2 in `apps/macos/Todz/MenuBar/MenuBarMoreMenu.swift` (after track P step 3). Needs L1.
- **L5. Settings wording and copy.** `SettingsWorkspaceLock.swift`, `apps/macos/Copy/{SettingsCopy,WorkspaceLockCopy,AppBanner+Copy}.swift`, `Todz/Shortcuts/{ShortcutRefusal,CompleteTaskIntent}.swift`, and the repository-shape guard. Needs L1.
- **L6. Docs.** A new ADR superseding the "Locked workspace" sentence of ADR 0110, a note at the top of `docs/features/workspace-lock/design.md` §§ 2, 4, 5 pointing to § 11, README and docs-tour screenshots of the Settings rows. The lead assigns the ADR number.

### 11.8 Owner decisions for track L

| Q | Question | Recommendation |
|---|---|---|
| L1 | `Switch Workspace…` for everyone, with ⌘K in the Workspace menu and an item in the popover's `…` menu? | Yes; ⌘K is free and is the switcher convention. |
| L2 | The Touch ID reason line `switch workspaces` and, for the two settings, `change this setting`? | Yes; neither names what is hidden. |
| L3 | `Lock Now` shown only while the session is unlocked? | Yes. |
| L4 | When the current workspace vanished while locked, draw nothing but the loading state until the prompt is confirmed? | Yes; it is the only way the picker never reveals a second workspace. |
| L5 | Refusals for a locked workspace read as "This workspace is no longer available."? | Yes; it is what an unknown workspace answers. |

## 12. Motion system (track M)

The owner's order (2026-11-27): "faça as animações cinematográficas no app, no menubar, no widget etc.. mas smooth e quem quer redução de animação, respeite ok". The system already has the parts: seven tokens (ADR 0077), the Reduce Motion rule, `todzAnimation`, `todzBloom`, `todzEntrance`, `todzCountTransition`, the count roll and row spring-in and title flight (ADR 0106). What is missing is one place that says which token, transform and Reduce Motion behaviour each moment of the product has, so a developer chooses a moment, not numbers. Cinematic here means choreography (what moves first, what follows, what stays still), never longer or bigger: every effect stays at or under 350 ms.

### 12.1 What exists, and the gaps

| Where | Motion today | Gap |
|---|---|---|
| `TodzKit/TodzMotion.swift` | `todzAnimation`, `todzCountTransition`, `todzBloom`, `todzEntrance` | the only modifiers views may use |
| `TaskRows.swift:25,31,40` | spring-in by identity, `settle` on the list's signature | no stagger on a workspace switch; no removal transition |
| `TaskCheckbox.swift:38`, `SparkleBurst.swift:23` | `draw`, `sparkle`; burst skipped under Reduce Motion | no press feedback |
| `RootView.swift:11`, `SignInScreen.swift:51`, `FormField.swift:37`, `FieldChrome.swift:17`, `FormPanel.swift:21`, `ValidationLine.swift:18`, `SettingsWorkspaceLock.swift:33`, `WorkspaceChordRow.swift:25`, `NewProjectButton.swift:33` | tokens through `todzAnimation` and `todzEntrance` | fine; they migrate to moments (M5) |
| `CopyButton.swift:27`, `KeyRows.swift:35`, `ServerDisclosure.swift:41,45` | `.default` animation with a local `reducesMotion` check | bypass the tokens: no pinned duration, a second Reduce Motion rule |
| `TodzWidgets/Views/WidgetHeader.swift:21` | raw `.contentTransition(.numericText())` | ignores the Reduce Motion rule (the other widget views use `todzCountTransition`) |
| `TodzWidgets/Views/{NextUpView,TodayRing,WidgetCheckbox}.swift` | `invalidatableContent` on interactive content | kept |

### 12.2 Tokens

The seven tokens stay as they are (snap 200 ms, settle 320, bloom 300, reveal 340, draw 250, sparkle 300, crossfade 150; every one under the 350 ms ceiling, pinned by `MotionTokenTests`). One is proposed, an owner decision because tokens are design-system choices (M1):

| Token | Curve | Duration | For |
|---|---|---|---|
| `press` (new) | spring, response 0.075, damping 0.9 | 110 ms | the pressed state of a checkbox, a card or a row: a 0.97 scale that returns on release |

Every other moment reuses an existing token. The Reduce Motion rule of ADR 0077 (point 3: every token becomes `crossfade`) is refined per moment in § 12.4: a moment is either a crossfade of 150 ms or an instant change, and none moves, scales or offsets.

### 12.3 The moments

Each row is one moment the product has; "spring" means the token's spring, "cascade" means § 12.5.

| Moment | Normal | Reduce Motion | Files it touches |
|---|---|---|---|
| `listInsert` (a task added or arriving from sync) | the row enters with `todzEntrance` (scale 0.96 to 1 and fade, `bloom`); neighbours part with `settle` | the row crossfades in; neighbours jump | `MainWindow/TaskList/TaskRows.swift`, `MenuBar/MenuBarTodayRows.swift` |
| `listRemove` (deleted, moved to another day, finished a linger) | fade out `snap` (opacity only), neighbours close with `settle` | the row crossfades out; neighbours jump | same |
| `complete` | checkbox fills and the check draws (`draw`), six mint dots burst (`sparkle`) on that checkbox only, then after the existing linger the row moves to the done group or the Up next card hands over (`settle`) | fill crossfades, no burst, the row relocates instantly after the linger | `Shared/TaskCheckbox.swift`, `Shared/SparkleBurst.swift` (unchanged), `MenuBar/MenuBarUpNext.swift` |
| `uncomplete` | the check undraws (`draw`), the row returns with `settle` | crossfade, then instant relocation | `Shared/TaskCheckbox.swift` |
| `reorder` (move up, move down) | the two rows swap with `settle` | instant | `MainWindow/TaskList/TaskRows.swift` |
| `workspaceSwitch` | the header name crossfades (`snap`); the new list cascades in with `snap` and a 12 ms stagger over at most six rows; the ring refills (`settle`) | one crossfade of the whole list, no stagger | `MainWindow/TaskList/TaskRows.swift`, `MenuBar/MenuBarTodayRows.swift`, `MenuBar/MenuBarDayRing.swift` |
| `popoverOpen` | the existing bloom (`bloom`); nothing else moves | opacity only | `MenuBar/MenuBarPopover.swift` (unchanged call) |
| `sheetPresent` | the system's sheet animation, never replaced; inside it the field ring `snap`, the issue line opacity `snap` | the same, as crossfades | `Shared/FormField.swift`, `FieldChrome.swift`, `ValidationLine.swift` |
| `busySwap` (a button's spinner in place of its title) | crossfade `snap` with the width held | crossfade | `Shared/FormButton.swift` |
| `stageChange` (sign-in email to inbox, onboarding steps) | the panel grows with `settle`, content crossfades `snap` | crossfade only, no growth animation | `SignIn/SignInScreen.swift`, `Shared/FormPanel.swift` |
| `disclosure` (Done today, the Server field) | height and content with `settle` | height instant, content crossfades | `MenuBar/MenuBarDoneToday.swift`, `Server/ServerDisclosure.swift` |
| `countChange` | digits roll with the numeric transition, downward when the count falls (`snap`); the status item rolls as template frames (ADR 0106) | opacity transition and the crossfading frames (existing) | `TodzKit/TodzMotion.swift`, `MenuBar/MenuBarCountRollLabel.swift` (unchanged), `TodzWidgets/Views/WidgetHeader.swift`, `TodayRing.swift`, `NextUpView.swift` |
| `ringFill` | the arc grows with `settle`; closing it swaps to a check with one mint burst | crossfade, no burst | `MenuBar/MenuBarDayRing.swift`, `TodzWidgets/Views/TodayRing.swift` (static there, § 12.7) |
| `upNextSwap` | the outgoing card fades `snap`, the next slides up 8 pt with `settle` | crossfade | `MenuBar/MenuBarUpNext.swift` |
| `banner` (an error banner in or out) | opacity and a 6 pt drop with `snap` | crossfade | `MainWindow/TaskList/ErrorBanner.swift` is not touched; the container in `MenuBar/MenuBarToday.swift` |
| `skeletonToRows` | crossfade (`crossfade`), no shimmer ever | the same | `MenuBar/MenuBarTodayBody.swift` |
| `press` | scale to 0.97 with `press` | none: a brief opacity dim, instant | `Shared/TaskCheckbox.swift`, `MenuBar/MenuBarRow.swift`, `MenuBar/MenuBarUpNext.swift` |
| `hover` and `focus` | the row tint and the focus ring appear with `snap` | instant | `MenuBar/MenuBarRow.swift`, `Shared/FieldChrome.swift` |
| `titleFlight` (sidebar row to list header) | the existing flight (ADR 0106) | crossfade, no flight (existing) | `MainWindow/TitleFlightFrames.swift` (unchanged) |
| `widgetContent` | § 12.7 | § 12.7 | `TodzWidgets/Views/` |

### 12.4 Reduce Motion, exactly

`accessibilityReduceMotion` on resolves every moment above to one of two treatments, and no moment keeps a scale, an offset, a spring or a burst.

- **Crossfade (150 ms, opacity only):** `listInsert`, `complete` (the fill), `uncomplete`, `workspaceSwitch`, `popoverOpen`, `sheetPresent` contents, `busySwap`, `stageChange`, `countChange`, `ringFill`, `upNextSwap`, `banner`, `skeletonToRows`, `titleFlight`, and `disclosure` content.
- **Instant (no animation):** `reorder`, the reflow of neighbours on `listInsert` and `listRemove`, the relocation of a completed row, `disclosure` height, `press`, `hover`, `focus`, and the burst (it is not drawn).
- **Left to the system, which applies Reduce Motion itself:** sheet and menu presentation, the popover's window animation, widget timeline transitions (the widget's own modifiers also read the setting, § 12.7).

The split amends ADR 0077 point 3, which sent every token to `crossfade`: a crossfade of a position change draws two copies of a row, so pure geometry moments become instant (M2).

### 12.5 Choreography rules

- **One moment, one spring.** A moment resolves to one token; a cascade reuses the token and only delays it.
- **Stagger** is `index × 12 ms` for the first six rows and zero after, with `snap` (200 ms), so the last row starts at 60 ms and ends at 260 ms, under the 350 ms ceiling for the whole choreography, not just each effect. A token whose duration plus the maximum delay would pass the ceiling gets no stagger.
- **Cascade only on a change of identity set** (a workspace switch, a first load), decided by a pure rule beside `AddedRows`; scrolling and cell reuse never replay it, as ADR 0106 requires of the spring-in.
- **Interruptible.** Springs retarget with their velocity; no view disables input while moving; a linger row stays clickable and a second click undoes it, as today.
- **Transform and opacity only.** Nothing animates a blur, a shadow radius or a font size; glass is the system's and is never animated by todz.
- **Gated by value.** Every animation names the equatable value it follows (`todzAnimation(_:value:)`); no bare `.animation`, no `withAnimation` outside the TodzKit modifiers.

### 12.6 Smoothness and the budgets

"Smooth" means no dropped frames at 60 and 120 Hz and no extra work per frame.

- **ADR 0061's app budgets are work counts, not timings** (a wall-clock gate is flaky, and ADR 0061 says why). Motion adds none: the modifiers read the environment and a value, never the model. `ModelBenchmark`'s counts must not change; a motion PR that changes one is wrong.
- **Pure decisions are unit-tested** (§ 12.8); the frame rate is **measured by hand**, not gated: Instruments' Animation Hitches template on a 120 Hz display and on a 60 Hz one, in a Debug build from its own derived data (never `/Applications`), for four scenarios: complete one task in a 50-row Today, switch workspace with 200 tasks, open the popover with 30 tasks, add five tasks in a row. Target: hitch time ratio under 5 ms per second, Apple's "good" band. The numbers land in the test plan with the trace's name.
- **No popover loops:** the popover scenario is a handful of short openings, never a loop (it opens in front of the owner's work).

### 12.7 Widgets

WidgetKit animates only what the system chooses to animate: content transitions on text and symbols and the insertion and removal of views between timeline entries (and only when the system plays them, for example after an interactive button). Custom springs, offsets and bursts never run there, so the widgets get exactly what they can show.

- Every count uses `todzCountTransition(countsDown:)`: numeric roll, downward when the count falls; opacity under Reduce Motion. Fixes `WidgetHeader.swift:21`.
- The checkbox glyph swap uses a symbol replace transition (`todzSymbolTransition()`); under Reduce Motion, opacity.
- Rows entering or leaving a timeline entry use opacity only (already safe under Reduce Motion).
- Interactive controls keep `invalidatableContent()` so the pressed state dims until the reload.
- The widget ring stays static: WidgetKit does not interpolate a custom `trim`, so animating it would be a lie; the number beside it rolls. Owner question M3.
- The timeline reload count does not change (ADR 0077's revisit trigger); `WidgetContent` is untouched.

### 12.8 How a developer unit-tests the motion decisions

The decision is a pure function in TodzKit; the SwiftUI modifier is a thin reader of it.

```swift
public enum MotionMoment: CaseIterable, Sendable { case listInsert, listRemove, complete, uncomplete, reorder, workspaceSwitch, popoverOpen, sheetPresent, busySwap, stageChange, disclosure, countChange, ringFill, upNextSwap, banner, skeletonToRows, press, hover, focus }

public struct MotionSpec: Equatable, Sendable {
    public let treatment: MotionTreatment      // .spring, .crossfade, .instant
    public let token: MotionToken?             // nil only for .instant
    public let transform: MotionTransform      // .none, .scale(Double), .offset(vertical: Double)
    public let delayMilliseconds: Int
    public static func of(_ moment: MotionMoment, isReduceMotionOn: Bool, index: Int) -> MotionSpec
}
```

Tests, in `MotionSpecTests.swift` (Swift Testing, like `MotionTokenTests`), red first:

1. For every moment, with Reduce Motion on and off, `token.durationMilliseconds + delayMilliseconds` is at most `MotionTiming.ceilingMilliseconds`.
2. With Reduce Motion on, every spec has `transform == .none` and a treatment of `.crossfade` or `.instant`; the set of `.instant` moments equals exactly the list in § 12.4 and the crossfade set equals the other list (so changing a moment's Reduce Motion behaviour is a deliberate edit of this document and the test).
3. With Reduce Motion off, each moment returns the token of the table in § 12.3.
4. `MotionStagger`: delay is `index × 12` up to index 5 and constant after; and no token plus the maximum delay passes the ceiling.
5. `RowArrival` (beside `AddedRows`): a changed identity set marks the first six rows arriving, an unchanged set or a scroll marks none.
6. `CountDirection.of(from:to:)` is `.down` when the count falls (drives `countsDown`).
7. `MotionTokenTests` gains `press`: under the ceiling, its spring settles within its duration.

A shape test in `tools/repository-shape` (`motion-tokens.test.ts`, like the other file-scanning shape tests) fails when `withAnimation(`, `.animation(`, `.default` as an animation, or `.numericText()` appears in `apps/macos` outside `TodzKit/Sources/TodzKit/TodzMotion*.swift` and the three TodzKit files that already own timing. It is red today for the four bypasses of § 12.1.

### 12.9 Build steps, track M (disjoint from P and L)

- **M1. Pure model.** `MotionMoment`, `MotionSpec`, `MotionStagger`, `RowArrival`, `CountDirection`, the `press` token (if approved) and their tests. Owns `TodzKit/Sources/TodzKit/{MotionMoment,MotionSpec,MotionStagger,RowArrival,CountDirection,MotionToken}.swift` and `Tests/TodzKitTests/{MotionSpecTests,MotionTokenTests}.swift`.
- **M2. Modifiers and the guard.** `todzMotion(_:value:)`, `todzCascade(index:)`, `todzPress()`, `todzCountTransition(countsDown:)`, `todzSymbolTransition()` in `TodzMotion.swift`, and the shape test. Needs M1. Owns `TodzKit/Sources/TodzKit/TodzMotion.swift`, `tools/repository-shape/src/motion-tokens.test.ts`.
- **M3. Remove the four bypasses.** `CopyButton.swift`, `KeyRows.swift`, `ServerDisclosure.swift`, `WidgetHeader.swift`. Needs M2.
- **M4. The main window list.** `TaskRows.swift` (insert, remove, reorder, cascade), `TaskCheckbox.swift` (press, complete). Needs M2.
- **M5. Forms and sheets.** `FormField.swift`, `FieldChrome.swift`, `ValidationLine.swift`, `FormButton.swift`, `FormPanel.swift`, `SignInScreen.swift`, `SettingsWorkspaceLock.swift`, `WorkspaceChordRow.swift`, `NewProjectButton.swift`, `RootView.swift`: re-point their `todzAnimation` calls to moments with no visible change. Needs M2. (`SettingsWorkspaceLock.swift` is also edited by L5; M5 only touches line 33's modifier, so L5 goes first or the hunks merge.)
- **M6. Widgets.** `WidgetHeader.swift` (after M3), `TodayRing.swift`, `NextUpView.swift`, `WidgetCheckbox.swift`, `TodayListView.swift`. Needs M2.
- **M7. The popover.** `MenuBarDayRing.swift`, `MenuBarUpNext.swift`, `MenuBarDoneToday.swift`, `MenuBarTodayRows.swift`, `MenuBarRow.swift`, `MenuBarTodayBody.swift`: track P builds them with plain `todzAnimation` and the tokens of § 12.3; M7 re-points them to moments after P5 and P7 land. Track M edits no `MenuBar/` file before that.
- **M8. Measure and document.** The four Instruments scenarios, their numbers in the test plan, the ADR amending 0077 (§ 12.10), README note. Needs everything above.

### 12.10 Owner decisions for track M

| Q | Question | Recommendation |
|---|---|---|
| M1 | Add the `press` token (110 ms, spring)? | Yes: it is the only way a press has feedback without borrowing `snap`, and it passes the ceiling test. |
| M2 | Amend ADR 0077 point 3 so that geometry-only moments become instant under Reduce Motion and the rest crossfade (§ 12.4)? | Yes: it removes the double image of a crossfaded move and matches the HIG's advice to replace movement with fades. |
| M3 | The widget ring stays static; only its number rolls? | Yes: WidgetKit cannot interpolate it, so the only honest option. |

## 13. Tracks, file ownership and order

Three developers, one per track, each in its own worktree and lane branch (HARNESS section 4, parallel lanes).

| Track | Steps | Owns (exclusively) |
|---|---|---|
| P, popover | P1 to P8 (§ 7) | `apps/macos/Todz/MenuBar/*`, `apps/macos/Copy/MenuBarCopy.swift`, `Todz/Shared/AddTaskField.swift`, `TodzKit/Sources/TodzKit/MenuBar{Day,RowMeta,Navigation,Notice}.swift` and their tests, `docs/screenshots/menubar-redesign/` |
| L, lock | L1 to L6 (§ 11.7) | `TodzKit/Sources/TodzKit/{AppModel+WorkspaceLock,WorkspaceLock,WorkspaceLockAction,PresentedWorkspace,WorkspaceShortcuts,WorkspaceChrome,AppBanner,ShortcutCompletion}.swift`, the `AppModel+Shortcuts/Links/Outbox/Workspaces` files, `Todz/Shared/{WorkspaceSwitcher,LockedWorkspaceRow,WorkspaceShortcutController}.swift`, `Todz/{WorkspaceMenuItems}.swift`, `Todz/Onboarding/WorkspacePickerScreen.swift`, `Todz/Settings/{SettingsWorkspaceRows,SettingsWorkspaceShortcuts,SettingsWorkspaceLock}.swift`, `Todz/MainWindowState.swift`, `Todz/Shortcuts/*`, `apps/macos/Copy/{SettingsCopy,WorkspaceLockCopy,AppBanner+Copy}.swift` |
| M, motion | M1 to M8 (§ 12.9) | `TodzKit/Sources/TodzKit/{TodzMotion,MotionMoment,MotionSpec,MotionStagger,RowArrival,CountDirection,MotionToken}.swift`, `tools/repository-shape/src/motion-tokens.test.ts`, `Todz/MainWindow/TaskList/TaskRows.swift`, `Todz/Shared/{TaskCheckbox,FormField,FieldChrome,ValidationLine,FormButton,FormPanel}.swift`, `Todz/SignIn/SignInScreen.swift`, the four bypass files, `TodzWidgets/Views/*` |

Shared files and who yields: `MenuBarMoreMenu.swift` is created by P3 and gets one item from L4 (after P3); `SettingsWorkspaceLock.swift` gets L5's wording and then M5's one-line modifier change; the popover files get M7's re-pointing after P5 and P7. Nothing else is shared.

Order: start P1, P2, L1, M1 together (four disjoint sets of new or private files); then P3 and P4 with L2 and M2; L3 and L5 with M3 to M6; L4 after P3 and L3; P5 to P7 with nothing else running on `MenuBar/`; M7 and the three eights last. The tester runs the whole test plan once after the merge, never opening the popover in a loop; no track installs, launches or replaces anything under `/Applications`.
