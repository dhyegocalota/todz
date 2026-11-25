# Design: morning-glance

**Sources:** [the spec](spec.md), [ADR 0062](../../adr/0062-the-morning-glance-is-a-non-activating-glass-panel-that-shows-today-on-the-first-wake-or-unlock-of-the-day.md), [the day-close design](../day-close/design.md) (§ 1.2, § 5), the run-17 spike (a 260 × 70 glass panel, 18 pt corners, 12 pt from the visible frame's top right), and the current code: `MenuBarTodayHeading` (title `.primary`, count `.secondary`), `DueLabel` (overdue in red, with words), `SettingsView` (`Form` `.grouped`, a switch with title and detail, `subtitleLines`), `MenuBarCopy.left(count:)`, `MainWindowCopy.today`, `AccessibilityCopy.menuBarCount(count:)`, `MainWindowState` (`accessibilityDisplayShouldReduceMotion` for the linger), `TodzApp` (`popoverWidth` 360, `settingsWidth` 420).
**Design system:** unchanged in colour, type and accent. The panel is the app's first glass surface: `glassEffect(.regular)` on macOS 26 and later, `.regularMaterial` before, both the system's. Semantic colours and text styles only.
**Screenshots:** none taken. The panel is native; Playwright MCP cannot capture it. The `recorder` takes the captures of § 6 with Orca into `.pr-media/morning-glance/design/` from the tester's two showings; the panel lands on the owner's screen, so no extra showing is spent on design captures.

## 1. Screens and states

Two surfaces change: a new panel, and Settings gains a fifth row. The menu bar, the popover, the main window and the widgets do not change.

### 1.1 The glance panel

```
                                   ┌─────────────── 280 ───────────────┐
 (menu bar)                         │                                   │ ← 12 pt under the menu bar,
                                   │ Today  7 left                     │   12 pt from the right edge
                                   │ ○ Send the invoice to Ana  Overdue│
                                   │ ○ Review the onboarding copy      │
                                   │ ○ Reply to the landlord           │
                                   │ ○ Book the dentist                │
                                   │ ○ Draft the release notes…        │
                                   │ +2 more                           │
                                   └───────────────────────────────────┘
```

- Heading: `MainWindowCopy.today` in `Font.headline`, `.primary`; then `MenuBarCopy.left(count:)` in `.secondary`, as the popover's heading.
- Rows: an open circle (`circle`, `.secondary`, decorative, not a control), the title on one line truncated at the tail, `Font.body`. An overdue task ends with `MorningGlanceCopy.overdue` in red, as `DueLabel` marks it: the word carries the meaning, the colour repeats it.
- Up to five rows in Today's order (O2). More than five: a last line `MorningGlanceCopy.more(count:)` in `.secondary`.
- No buttons, no close control, no keys (O9). The whole panel is one click target with the tooltip `MorningGlanceCopy.openToday`.
- The content is captured when the panel shows; a task completed elsewhere during the five seconds stays until the panel goes.

| State | When | Shows |
|---|---|---|
| Few | 1 to 5 open | heading, the rows |
| Many | more than 5 open | heading counting all, five rows, `+N more` |
| Long title | a title wider than the row | one line, tail truncated; the tooltip of the panel is unchanged |
| Hovered | the pointer is over it | stays; the five seconds restart when the pointer leaves (O3) |
| Fading | five seconds passed | alpha to 0 over 0.5 s, then gone; with Reduce Motion, gone at once (O5) |
| Clicked | a click anywhere | gone at once; todz active; the main window on Today (O4) |
| Offline | `syncStatus != .online` | the cached Today, the same look; no sync item |
| Not shown | off, nothing open, locked, held, Today in front, Today unknown | nothing on screen |

Light and dark come from the glass or the material; nothing is tinted by hand. Reduce Transparency and Increase Contrast are the system's: the glass and the material turn opaque and gain the system border. One width, 280; the height fits the content.

### 1.2 Settings window

```
┌──────────────── todz Settings ────────────────┐
│ │ Close the day         [18:00 ⇕]      [━○] │ │
│ │ At this time each day, todz opens on      │ │
│ │ what's left of Today.                     │ │
│ │───────────────────────────────────────────│ │
│ │ Morning glance                       [━○] │ │
│ │ On the first wake or unlock of each day,  │ │
│ │ todz shows Today for a few seconds.       │ │
└───────────────────────────────────────────────┘
```

- A `Toggle` after the Close the day row, `.switch`, title and detail with `lineLimit(subtitleLines, reservesSpace: true)` (O7). Off by default; `@AppStorage(MorningGlancePreference.isOnStorageKey)`.
- Turning it on shows nothing until the next chance: the panel never appears over the Settings window as a preview.

## 2. Components

| Component | Folder | Change |
|---|---|---|
| `MorningGlancePanel` (new) | `Todz/MorningGlance` | the `NSPanel` subclass: never key or main, borderless, non-activating, status bar level, every Space, over full screen, clear background, shadow |
| `MorningGlanceView` (new) | `Todz/MorningGlance` | the glass or material shape, the heading, the rows, the rest line, the tap and the hover |
| `MorningGlancePresenter` (new) | `Todz/MorningGlance` | placement, unhide without activation, order front, the visibility answer, the dwell and fade, the click, the close when the popover shows |
| `MorningGlanceTrigger` (new) | `Todz/MorningGlance` | the chance observers |
| `SettingsView` | `Todz/Settings` | the switch |
| `MenuBarPopover` | `Todz/MenuBar` | closes the panel when the popover shows |
| `MorningGlanceCopy` (new), `SettingsCopy`, `AccessibilityCopy` | `Copy` | § 8 |

## 3. Tokens

All file-local constants in `MorningGlanceView` or `MorningGlancePresenter`, as `popoverWidth` is in `TodzApp`.

| Use | Token |
|---|---|
| Width | 280 |
| Corner radius | 18 (the spike's) |
| Inset from the visible frame's top right | 12 |
| Rows shown | 5 |
| Shown for | 5 s |
| Fade | 0.5 s |
| Padding, row spacing | the system's default `padding()` and `VStack` spacing |
| Heading / count | `Font.headline` `.primary` / `.secondary` |
| Rows | `Font.body` `.primary`; the circle `.secondary` |
| Overdue | `Color.red`, as `DueLabel` |
| Rest line | `Font.subheadline` `.secondary` |

## 4. Copy

New strings in § 8. Reused: `MainWindowCopy.today`, `MenuBarCopy.left(count:)`, `AccessibilityCopy.menuBarCount(count:)`. "todz" stays lower case.

## 5. Interaction and accessibility

- **Keyboard:** none. The panel never becomes key, so every keystroke typed while it shows reaches the frontmost app; it has no Escape and no shortcut. The owner reaches Today from the keyboard through the popover or the main window as always.
- **Pointer:** a click anywhere opens Today in the main window and activates todz; the hover pauses the countdown. No drag, no right click.
- **VoiceOver:** when the panel shows, the announcement `AccessibilityCopy.menuBarCount(count:)` ("todz, 7 left today") (O6). The panel is one element: label `AccessibilityCopy.morningGlance(count:)` with the shown titles as its value, the button trait, the hint `AccessibilityCopy.glanceOpensToday`; its default action is the click.
- **Motion:** it appears at once, without a slide (O5); it fades over 0.5 s, and with Reduce Motion (`NSWorkspace.shared.accessibilityDisplayShouldReduceMotion`, read at the fade) it disappears at once.
- **Contrast:** `.primary` and `.secondary` on the system glass or material; overdue is said in words. Reduce Transparency and Increase Contrast are honoured by the system surfaces.

## 6. Options

Captures into `.pr-media/morning-glance/design/` from the tester's showings, light and dark: `glance-many.png`, `settings-off.png`, `settings-on.png`.

**O1. Where it shows**
- A. The top right of the screen with the menu bar, 12 pt under it. Where the eye looks for a passing message; proven by the spike.
- B. Under the todz status item. Ties the glance to its icon; the item's place moves, can sit in the overflow, and the popover opens there.
- C. Top centre. Seen at once; covers the title bar of the frontmost window.
- **Recommendation: A.** A notification banner can sit in the same corner for the same five seconds; the panel stays above it at the status bar level.

**O2. What it holds**
- A. The heading with what is left and up to five titles, then `+N more`. Enough to plan the morning; the height stays small.
- B. The heading and the count only. Quietest; says nothing about which tasks.
- C. The first task only. Focused; hides the rest of the day.
- **Recommendation: A.**

**O3. Hover**
- A. Stays while hovered; the five seconds restart on leave. The owner can read a long list.
- B. Fixed five seconds. Predictable; a list is lost mid-read.
- **Recommendation: A.**

**O4. Click**
- A. A click anywhere opens the main window on Today. One target, no aiming.
- B. A click on a row reveals that task. Precise; the panel becomes a list of buttons that never take the keyboard.
- **Recommendation: A.**

**O5. Motion**
- A. Appears at once, fades out over 0.5 s; none with Reduce Motion. Calm; the spike's.
- B. Slides down from the menu bar. Draws the eye; motion the owner did not ask for.
- **Recommendation: A.**

**O6. VoiceOver**
- A. An announcement with the count; the panel keeps its five seconds. The owner hears it without moving focus.
- B. As A, and the panel stays ten seconds while VoiceOver runs. More time to reach it; it still cannot take focus.
- **Recommendation: A.**

**O7. The Settings row**
- A. A switch with a title and a detail line, after Close the day. The same shape as the rows above.
- **Recommendation: A.**

**O8. The surface**
- A. Liquid Glass on macOS 26 and later, the regular material before. The system's look on each version.
- B. The regular material everywhere. One look; flat on macOS 26.
- **Recommendation: A.**

**O9. A close button**
- A. None; it leaves by itself and a click opens Today. Nothing to aim at.
- B. An × on hover. Faster away; a second target beside the click that opens Today.
- **Recommendation: A.**

## 7. Owner decisions

| Option | Answer | Date |
|---|---|---|
| O1–O9 | each one's recommendation in § 6, the build loop's call (the owner may overturn it) | 2026-11-25 |

## 8. Every new copy string

**MorningGlanceCopy** (`apps/macos/Copy/MorningGlanceCopy.swift`, new): overdue "Overdue" · openToday "Open Today in todz" (the tooltip) · more(count:) "+\(count) more"

**AccessibilityCopy** (`apps/macos/Copy/AccessibilityCopy.swift`): morningGlance(count:) `InflectedCopy.text("Today, \(count) left")` · glanceOpensToday "Opens Today in the todz window."

**SettingsCopy** (`apps/macos/Copy/SettingsCopy.swift`): morningGlance "Morning glance" · morningGlanceDetail "On the first wake or unlock of each day, todz shows Today for a few seconds."
