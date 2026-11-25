# Design: focus-aware

**Sources:** [the spec](spec.md), [ADR 0054](../../adr/0054-the-app-learns-focus-through-a-todz-focus-filter-not-the-focus-status-api.md), [the agent nudge design](../agent-nudge/design.md) (§ 1.1, O1, O2), [the menu bar count design](../menu-bar-count/design.md) (§ 1.2, § 3), and the current code: `SettingsView` (one grouped `Form`, two `.switch` `Toggle`s with a title and a subtitle `Text`, `lineLimit(2, reservesSpace: true)`), `SettingsCopy`, `TodzApp` (`settingsWidth` 420, `.contentSize`), `ToggleTaskIntent` (the one App Intent, its `title` a literal).
**Design system:** unchanged. System materials, semantic colours, text styles, the one accent. No token is added.
**Screenshots:** none taken. Both surfaces are native (the Settings window, System Settings); Playwright MCP captures neither. The `recorder` takes the captures of § 6 with Orca into `.pr-media/focus-aware/design/`, in few short openings, never turning a Focus on without the owner.

## 1. Screens and states

Two surfaces change: the Settings window gains a third row; System Settings lists a todz Focus filter. The menu bar, the popover, the windows, the widgets and the agent nudge do not change.

### 1.1 Settings window

```
┌──────────────── todz Settings ────────────────┐
│ ┌───────────────────────────────────────────┐ │
│ │ Show pending count in the menu bar   [●━] │ │
│ │ …                                         │ │
│ │───────────────────────────────────────────│ │
│ │ Let agents mention today's tasks     [━○] │ │
│ │ …                                         │ │
│ │───────────────────────────────────────────│ │
│ │ Quiet during Focus  ┌───────────────────┐ │ │
│ │ todz stays quiet in │Open Focus Settings│ │ │
│ │ any Focus with the  └───────────────────┘ │ │
│ │ todz filter on.                           │ │
│ └───────────────────────────────────────────┘ │
└───────────────────────────────────────────────┘
```

- A `LabeledContent` in the same section, after the two switches (option O1): the label is the title and the subtitle `Text`, the content a trailing `Button` with the default bordered push style (option O2). The subtitle keeps `lineLimit(subtitleLines, reservesSpace: true)`, so a state swap never resizes the window (option O3).
- The button opens the Focus pane (`x-apple.systempreferences:com.apple.Focus-Settings.extension`, to confirm in a build on macOS 14 and 26). A refused open does nothing visible; the subtitle still says what to add.
- Nothing is stored: no switch, no `@AppStorage`. The state is read from `ProactiveGate.isQuiet`.

| State | When | Subtitle | VoiceOver |
|---|---|---|---|
| Not quiet | `isQuiet` false (no filter, a Focus without it, or `current` threw) | `focusQuietDetail` | "Quiet during Focus", the subtitle, then "Open Focus Settings, button" |
| Quiet now | `isQuiet` true | `focusQuietNow` | as above with `focusQuietNow`; the swap is not announced |

### 1.2 The todz Focus filter in System Settings

System Settings → Focus → a mode → Focus filters → Add Filter lists todz with its app icon. Choosing it opens the intent's sheet: the title, the description, one switch for the parameter. Back in the mode, the filter tile shows the app icon and the display representation.

```
┌──────────── Quiet todz ────────────┐      Focus filters
│ Keeps todz from showing anything   │      ┌──────────────┐
│ on its own while this Focus is on. │      │ [todz] todz  │
│                                    │      │ Stays quiet  │
│ Keep todz quiet              [●━]  │      └──────────────┘
│                    Cancel   Add    │
└────────────────────────────────────┘
```

| Parameter | Tile title | Tile subtitle |
|---|---|---|
| on | `todz` | `Stays quiet` |
| off (the default) | `todz` | `Shows as usual` |

The intent's `title`, `description` and the parameter's `title` are read at build time by the App Intents metadata extractor and must be string literals in the intent, as `ToggleTaskIntent.title` is; only `displayRepresentation` is computed at run time and comes from `FocusCopy`. The developer confirms in a build whether a `static let` from `FocusCopy` survives extraction; if it does, all four live there.

## 2. Components

`SettingsView` (`Todz/Settings`): a `LabeledContent` row with the button, the gate read from the environment. `SettingsCopy`, `FocusCopy` (new, beside `WidgetCopy`) and `TodzFocusFilter` (new, app target): § 8.

## 3. Tokens

| Use | Token |
|---|---|
| Row title | `.primary`, `Font.body` |
| Subtitle, both states | `.secondary`, the form's subtitle style |
| Button | the system push button; no tint, no accent |
| Width | `settingsWidth` 420, unchanged |

## 4. Copy

All new strings in § 8. "Focus" is capitalised as Apple writes it; "todz" stays lower case, even first in a sentence.

## 5. Interaction and accessibility

- **Keyboard:** with Full Keyboard Access, Tab moves from the second switch to the button; Space presses it. Nothing has focus when the window opens.
- **VoiceOver:** the row reads its title and subtitle, then the button by its own label; the button needs no hint, its label says where it goes. The live swap is passive and not announced (O3).
- **Motion:** none; the subtitle swaps without animation.
- **Contrast:** `.primary` and `.secondary` on the form's material and the system button, the system's guarantee in light, dark and Increase Contrast. The quiet state is said in words, never colour.

## 6. Options

Captures into `.pr-media/focus-aware/design/`, light and dark: `settings-not-quiet.png`, `settings-quiet-now.png` (only if the owner turns a Focus on), `focus-filter-sheet.png`, `focus-filter-tile.png`; one annotated copy per option (`o1-…png` to `o4-…png`).

**O1. Where the row sits**
- A. The same section, third row. One compact group, as the agent nudge decided.
- B. Its own section with a "Focus" header. Marks it as a system setting, not a todz one, at the cost of a header and a taller window.
- **Recommendation: A.**

**O2. The control**
- A. A trailing push button "Open Focus Settings". The macOS Settings idiom for going elsewhere; a clear Tab stop.
- B. A link-style button inside the subtitle ("… Open Focus Settings"). Narrower, but a link in a grouped form reads as web, and its focus ring is hard to see.
- **Recommendation: A.**

**O3. Live state**
- A. Static text only. Simplest; the owner cannot tell whether his filter works.
- B. The subtitle swaps in place to "Quiet now, until this Focus ends." while `isQuiet`. Proves the setup at a glance; no height change thanks to the reserved two lines.
- C. B plus a moon symbol beside the title. Louder; an icon no other row has.
- **Recommendation: B.**

**O4. The filter's words**
- A. Title "Quiet todz", tiles "Stays quiet" / "Shows as usual". Verb first, as Apple's own filters; the tile already shows the todz icon and name.
- B. Title "todz Focus Filter", tiles "Quiet" / "Not quiet". Generic title repeats what the pane says; "Not quiet" reads as a double negative.
- **Recommendation: A.**

## 7. Owner decisions

| Option | Answer | Date |
|---|---|---|

## 8. Every new copy string

**SettingsCopy** (`apps/macos/Copy/SettingsCopy.swift`): focusQuiet "Quiet during Focus" · focusQuietDetail "todz stays quiet in any Focus with the todz filter on." · focusQuietNow "Quiet now, until this Focus ends." · openFocusSettings "Open Focus Settings"

**TodzFocusFilter** (literals, § 1.2): title "Quiet todz" · description "Keeps todz from showing anything on its own while this Focus is on." · `isQuiet` title "Keep todz quiet"

**FocusCopy** (`apps/macos/Copy/FocusCopy.swift`): filterTitle "todz" · filterQuiet "Stays quiet" · filterNotQuiet "Shows as usual"
