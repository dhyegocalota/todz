# Design: menu-bar-count

**Sources:** [the spec](spec.md), [ADR 0036](../../adr/0036-the-menu-bar-icon-counts-today-s-open-tasks-behind-a-setting.md), [the menu bar design](../menu-bar/design.md) (§ 1.1 the status item, § 3 tokens), the Glass direction of [the product design](../../product/README.md) (system font, one accent `#2F5BFF`, "it must feel like Apple made it"), and the current code: `MenuBarLabel` (the icon `checkmark.square`, labelled `MainWindowCopy.windowTitle`), `TodzApp` (a `Window` and a `.window` `MenuBarExtra`, no `Settings` scene), `MenuBarTodayHeading` (`MenuBarCopy.left(count:)`), `AppModel.openCount(of: .today)` (the sidebar's Today badge).
**Design system:** unchanged. System materials, semantic colours, text styles, the one accent. No token is added.
**Screenshots:** none taken. Both surfaces are native (a status item and a Settings window); Playwright MCP drives a browser and cannot capture them. The `recorder` takes the captures of § 6 from the built app into `.pr-media/menu-bar-count/design/`.

## 1. Screens and states

Two surfaces change: the status item gains a number; the app gains a Settings window. The popover, the main window and the widgets do not change.

### 1.1 Status item

Layout: the template symbol `checkmark.square`, then the count as text, in one `HStack { Image; Text }` inside the `MenuBarExtra` label (option O1). The menu bar draws both: its own symbol size, its own menu bar font, its own spacing between image and title (option O3), its own tint. Nothing in the label sets a colour, font, frame or padding.

| State | Item | Accessibility label |
|---|---|---|
| Toggle off, any phase | icon only, the width of today's item | `MainWindowCopy.windowTitle` |
| `signedOut`, `loading` (no cache), `naming` | icon only | `MainWindowCopy.windowTitle` |
| `ready`, the first load not finished, or no project of the workspace loaded | icon only (option O4, B) | `MainWindowCopy.windowTitle` |
| `ready`, offline with a cache | the cached count, as the popover's heading | as below |
| `ready`, 0 open today | icon only (ADR 0036) | `MainWindowCopy.windowTitle` |
| `ready`, 1 | icon, `1` | `AccessibilityCopy.menuBarCount(count: 1)` "todz, 1 left today" |
| `ready`, 12 | icon, `12` | "todz, 12 left today" |
| `ready`, 99 | icon, `99` | "todz, 99 left today" |
| `ready`, 100 or more | icon, `99+` | the real number: "todz, 134 left today" (option O6) |
| Popover open | the same content on the menu bar's highlight; the template image and the text tint together | unchanged |

The count is `model.todayHeadingCount`, the number the popover's heading reads, passed through `MenuBarBadge`: the same open set as the popover's "N left", overdue included, pending adds counted once confirmed (menu-bar § 1.3). It moves with every optimistic write, every pull and the day change, with the popover closed.

**Light and dark menu bars.** The menu bar picks a light or dark appearance from the wallpaper and the system appearance; a template image and an untinted `Text` both take the bar's label colour, so the item reads black on a light bar and white on a dark one, like the clock beside it. The accent never appears in the status item (option O2).

**Width.** The item grows by one digit's width from 9 to 10 and by the `+` at 100, and shifts the items to its left. Digits are monospaced (option O3) so 11 → 18 never jitters; the step between digit counts is accepted (ADR 0036, Consequences).

### 1.2 Settings window

A SwiftUI `Settings` scene: the app menu gains "Settings…" with ⌘, (system title and key; no copy needed). One pane, no tab bar, no toolbar (option O5).

```
┌──────────────── todz Settings ────────────────┐
│ ┌───────────────────────────────────────────┐ │
│ │ Show pending count in the menu bar   [●━] │ │
│ │ Today's open tasks in the active          │ │
│ │ workspace. Hidden when none are left.     │ │
│ └───────────────────────────────────────────┘ │
└───────────────────────────────────────────────┘
```

- `Form` with `.formStyle(.grouped)`: one section, one `Toggle` whose label is the title `Text` and a second `Text` the grouped form renders as the subtitle (option O7), `.toggleStyle(.switch)` (option O8).
- Width 420 points, a named constant beside `popoverWidth` in `TodzApp`; the height fits the content; the window does not resize (`.windowResizability(.contentSize)`).
- No narrow layout: the window has one width. The title is the system's for a `Settings` scene (verify in the build; § 2).
- States: on (default, the switch in the accent), off. The toggle never disables: it works signed out too, and its effect shows once a count exists.
- Flipping it changes the status item at once, without a relaunch; the choice is a `UserDefaults` boolean read through `@AppStorage` in both views, key and default declared once (spec).

## 2. Components

| Component | Folder | Change |
|---|---|---|
| `MenuBarLabel` | `Todz/MenuBar` | `HStack` of the image and, when `MenuBarBadge` gives text, the `Text` with `.monospacedDigit()`; the accessibility label of § 1.1 on the whole label |
| `MenuBarBadge` (new, spec) | `TodzKit` | count and toggle to text or none; the cap 99 is a named constant and `99+` is formed from it |
| `SettingsView` (new) | `Todz/Settings` | the grouped `Form` and the toggle |
| `SettingsCopy` (new) | `Copy` | § 4 |
| `TodzApp` | app | adds `Settings { SettingsView() }` with the width constant |

**MenuBarExtra label limits the developer must verify in a build** (macOS 14, the minimum):
1. The status item is an `NSStatusBarButton` fed from the label, not a live SwiftUI view: it takes one image and one text. An `HStack { Image; Text }` shows both; a `Label` shows the icon only. Modifiers on the text (`.font`, `.foregroundStyle`, `.padding`, `.frame`) are ignored; check whether `.monospacedDigit()` survives (O3 fallback below).
2. The image must stay a template: `Image(systemName:)` is; a coloured or rendered image is not and stops following the bar's appearance and highlight.
3. The label must redraw on an `@Observable` change while the popover is closed (an agent's task arriving by pull): the walk checks it.
4. `.accessibilityLabel` on the label must reach the status item: check with VoiceOver and Accessibility Inspector. If it does not, the `MenuBarExtra` title initialiser is the fallback carrier for the same string.
5. The highlight while the `.window` popover is open, on a light and a dark bar.
6. ⌘, opens Settings while the popover is key and while only the popover is open (no main window), and the Settings window comes to the front.

## 3. Tokens

| Use | Token |
|---|---|
| Status item symbol and count | the menu bar's own label colour (template image, untinted `Text`) |
| Status item font, symbol size, image-to-text spacing | the system's menu bar values; none set |
| Settings window background, section | the grouped `Form`'s system materials |
| Toggle title | `.primary`, `Font.body` (system default in the form) |
| Toggle subtitle | `.secondary`, the form's subtitle style |
| Switch on | `Color.accentColor` = `#2F5BFF` |
| Settings width 420 | a named constant beside `popoverWidth`; spacing and insets stay system defaults |

## 4. Copy

New strings in § 8. Reused: `MainWindowCopy.windowTitle` (the accessibility label without a count). The count digits are numbers, not copy; `99+` is the cap and a sign. The accessibility count goes through `InflectedCopy.text` as `MenuBarCopy.left(count:)` does.

## 5. Interaction and accessibility

**Keyboard**

| Keys | Where | Does |
|---|---|---|
| ⌘, | anywhere in the app, the popover included | opens the Settings window, or raises it |
| ⌘W | Settings | closes it |
| Tab, Space | Settings, with Full Keyboard Access | focuses the switch; Space flips it |

Nothing has focus when the window opens (one control, no text field). Escape does not close a Mac Settings window; it is left as the system does.

**VoiceOver**
- Status item: the button trait; label per § 1.1. The label changes when the count changes; no announcement is posted (a menu bar item is read on demand, not interrupting).
- Settings: "Show pending count in the menu bar, switch, on", then the subtitle as its description (verify the grouped form reads the second `Text`; if not, it becomes the toggle's `.accessibilityHint`).

**Motion:** none. The status item has no animation; the count swaps in place. The switch uses the system animation; Reduce Motion is the system's.

**Contrast:** the count is the bar's label colour on the bar's own material, the system's guarantee (as the clock and the battery percentage); Increase Contrast and Reduce Transparency are honoured by the bar. The switch's on state carries its knob position, not the accent alone.

## 6. Options

Captures to take from the built app into `.pr-media/menu-bar-count/design/`, each on a light and a dark menu bar: `status-off.png`, `status-zero.png`, `status-1.png`, `status-12.png`, `status-99-plus.png`, `status-highlighted.png` (popover open, 12), `status-signed-out.png`, `settings-on.png`, `settings-off.png`, and one annotated copy per option (`o1-…png` to `o8-…png`).

**O1. How the count is drawn**
- A. Template symbol then plain text, the bar's font and colour. Reads like the clock and the battery percentage: what Apple ships.
- B. A rendered pill badge (number in a filled capsule) as one image. Looks like the Dock's badge, but a non-template image breaks the bar's appearance and highlight, and reads as an alarm to clear.
- C. The number alone in place of the icon. Narrowest, but the item loses its identity, and at zero needs the icon back.
- **Recommendation: A. Loop's call: A.**

**O2. Colour of the count**
- A. The bar's label colour, like the icon. Legible on every wallpaper, follows the highlight.
- B. The accent `#2F5BFF`. Brand presence, but blue on a dark translucent bar falls under 3:1 and no Apple item colours its text.
- **Recommendation: A. Loop's call: A.**

**O3. Digits and spacing**
- A. `.monospacedDigit()` and the system's image-to-title spacing. 11 → 18 keeps its width; nothing hand-tuned. If the build shows the modifier ignored, proportional digits are accepted rather than an image rendering.
- B. Proportional digits. The width wobbles on every completion.
- C. A fixed-width text frame. Steady width, but the label ignores frames and it pads "1" with blank space.
- **Recommendation: A. Loop's call: A.**

**O4. While the active workspace is partly loaded or a project failed**
- A. Icon only until every project is loaded: `openCount(of: .today)`, the sidebar's Today badge. The popover shows no heading count then either, so the two never disagree, and the number never climbs project by project.
- B. `taskViews.today.open.count` as soon as `taskViews` exists. Shows a number sooner, but a partial, growing one.
- **Recommendation: A. Loop's call: A.**
- ~~A~~ overturned in plan review: `openCount(of: .today)` is nil when one project failed while the popover heading still shows "N left" from `taskViews.today.open.count`, so the two disagreed. Decision: B, through the heading's own state: `AppModel.todayHeadingCount` (TodzKit) is the one number both the heading and the status item read; it is none on a first load, when no project loaded, and without a workspace.

**O5. Settings window shape**
- A. One pane, no tab bar. Honest for one control; a toolbar of tabs arrives with the second pane.
- B. A `TabView` with one "General" tab. Ready for later settings, but a tab bar of one is chrome with no use.
- **Recommendation: A. Loop's call: A.**

**O6. Accessibility label above 99**
- A. The real number ("todz, 134 left today"). Speech has no width limit.
- B. "todz, more than 99 left today", matching the pixels. One more string, less information.
- **Recommendation: A. Loop's call: A.**

**O7. A footnote under the toggle**
- A. A subtitle naming what is counted: "Today's open tasks in the active workspace. Hidden when none are left." Answers "pending of what?" where the choice is made, and explains the empty item at zero.
- B. The toggle alone. Shortest, but the owner meets an icon with no number at zero and no reason.
- **Recommendation: A. Loop's call: A.**

**O8. Switch or checkbox**
- A. A switch in the grouped form, as System Settings on macOS 14.
- B. A checkbox in a `.columns` form, the classic preferences look. Also Apple, but older; next to the Glass popover it reads dated.
- **Recommendation: A. Loop's call: A.**

**Minor calls made by the loop** (reversible)

| Call | Choice |
|---|---|
| Window title | the system's for a `Settings` scene; no string |
| Settings width | 420 |
| Window resizing | none; height fits the content |
| Count announcement on change | none |
| Toggle while signed out | enabled |

## 7. Owner decisions

Empty when written; the lead records each answer here before the plan.

| Option | Answer | Date |
|---|---|---|

## 8. Every new copy string

**SettingsCopy** (new, `apps/macos/Copy/SettingsCopy.swift`): showPendingCount "Show pending count in the menu bar" · showPendingCountDetail "Today's open tasks in the active workspace. Hidden when none are left."

**AccessibilityCopy** (`apps/macos/Copy/AccessibilityCopy.swift`): menuBarCount(count:) "todz, {count} left today", through `InflectedCopy.text`.
