# Design: day-temperature

**Sources:** [the spec](spec.md), [ADR 0065](../../adr/0065-the-day-temperature-steps-the-menu-bar-count-s-opacity-after-noon-and-washes-overdue-widget-rows-by-age-behind-a-setting.md), [the morning-glance design](../morning-glance/design.md) (the Settings row and the copy modules), and the current code: `MenuBarLabel` (the glyph `MenuBarGlyph`, a template image, and the count text beside it with `monospacedDigit()`), `MenuBarBadge` (the 99+ cap), `SettingsView` (a `Form` `.grouped`, a switch with a title and a detail, `subtitleLines` = 2), `SettingsCopy`, `WidgetTaskRow` and `NextUpTask` (the overdue colour `Color.red`), `WidgetDay` (the overdue words), `TodayListView`, `NextUpView`.
**Design system:** unchanged. Semantic colours and text styles only; the one colour is the system red the overdue label already uses. No new assets.
**Screenshots:** the menu bar and the widgets are native. The recorder takes them with Orca into `.pr-media/day-temperature/`; Playwright MCP cannot capture them. The step captures come from a scratch render of the label, not from the clock, so the walk does not wait for 15:00 or 18:00.

## 1. Screens and states

Two surfaces change: the menu bar count, and the widgets' overdue rows. Settings gains one row. The popover, the main window, the popover's Today rows and the widgets' layout stay as they are.

### 1.1 The menu bar count

The glyph never changes. Only the count's opacity steps down.

```
 before noon     ◆ 6            opacity 1.00   plain
 12:00 – 14:59   ◆ 6            opacity 0.85
 15:00 – 17:59   ◆ 6            opacity 0.75
 18:00 – 23:59   ◆ 6            opacity 0.65
 at zero         ◆              icon only (ADR 0036), no tone at any hour
 Focus quiet     ◆ 6            opacity 1.00   plain (the gate)
 Increase Contrast ◆ 6          opacity 1.00   plain
```

| State | When | Count | Accessibility label |
|---|---|---|---|
| Plain | switch off, before 12:00, at midnight, Focus quiet, Increase Contrast | 1.00 | "todz, 6 left today" (ADR 0036, unchanged) |
| Noon | 12:00 to 14:59, switch on, count above zero | 0.85 | the same |
| Afternoon | 15:00 to 17:59 | 0.75 | the same |
| Evening | 18:00 to 23:59 | 0.65 | the same |
| Icon only | count zero or unknown | no count | "todz" |
| 99+ | count above 99 | as the step, text "99+" | "todz, 120 left today" |

The text's weight and digits stay as today (`monospacedDigit()`), so the width of the item does not change between steps.

The spike (plan step 1) decides how the alpha reaches the bar: `.opacity` on the `Text`, then `.foregroundStyle(.primary.opacity(...))`, then, if the status item drops both, the glyph and the count rendered with `ImageRenderer` into one template `NSImage` with the count drawn at the step's opacity (ADR 0065 §3). The accessibility label is the same in all three. Evidence (spike of 2026-11-25, numbers in the ADR): the status item drops `.opacity` and `.foregroundStyle(.primary.opacity)`; the `ImageRenderer` template `NSImage` carries the step's alpha (peak 0.910, 0.788, 0.694, 0.616), keeps the system tint and the item's width, and Increase Contrast is read from `NSWorkspace`. The wash caps become 0.09 and 0.12 (0.18 measures 2.78:1 for the red due words in light).

### 1.2 The widget rows

An overdue open row sits on a wash behind it. The title and the checkbox are unchanged.

```
 ┌──────────────────────────────────────────┐
 │ ○ Send the invoice to Ana  Overdue · 24 November │  ← wash 0.06  (1 day overdue)
 ├──────────────────────────────────────────┤
 │ ○ Reply to the landlord    Overdue · 22 November │  ← wash 0.09  (2–6 days)
 ├──────────────────────────────────────────┤
 │ ○ Renew the passport       Overdue · 16 November │  ← wash 0.12  (7+ days)
 ├──────────────────────────────────────────┤
 │ ○ Book the dentist              Today    │  ← no wash (not overdue)
 └──────────────────────────────────────────┘
```

| State | When | Wash | Due label |
|---|---|---|---|
| Not overdue | due today or later, or no due date | none | as today |
| Overdue, 1 day | `daysOverdue == 1` | red 0.06 | the existing red words |
| Overdue, 2 to 6 days | `2...6` | red 0.09 | the existing red words (`TaskRowCopy.overdue(date:)`) |
| Overdue, 7 days or more | `>= 7` | red 0.12 | the existing red words (`TaskRowCopy.overdue(date:)`) |
| Done | the row is checked | none | as today |
| Switch off, quiet, Increase Contrast | the snapshot flag is false | none | as today |
| Empty Today | no rows | nothing to wash | the existing empty view |

The next-up card of the small widget takes the same wash for an overdue next-up task. The ring widget shows counts only, so it does not change.

Rendering modes. The wash reads `widgetRenderingMode` from the SwiftUI environment: `.fullColor` draws `Color.red.opacity(band)`; `.vibrant` (another app's window in front) and `.accented` (a tinted or monochrome widget style) draw `Color.primary.opacity(band)` at the same bands, a luminance step the system keeps, so the three bands stay distinct and never fall into a grey selection-like band. The spike captures all three modes.

Geometry. The wash is the row's full width and its own height, with no padding added and the layout unchanged, as a `RoundedRectangle(cornerRadius:)` whose radius is a constant at the top of the view. Pending rows (`WidgetPendingRow`, a next-up without a key) get no wash. On the small widget the wash sits behind `NextUpTask` only, not the header.

### 1.3 The Settings row

A fifth switch in the Settings form, under "Morning glance", with a two-line detail (the `subtitleLines` the other rows use).

| State | Shows |
|---|---|
| Off (default) | the title, the detail, the switch off |
| On | the switch on; the count and the widgets change at their next boundary or write |
| Focus quiet | the switch stays as chosen; the detail is unchanged; the tone is silent while the Focus lasts (the Focus row above already says so) |

## 2. Tokens

Constants, not style values in views. They live at the top of their files in TodzKit (`DayTemperatureStep.swift`, `OverdueWash.swift`), so the app and the widgets read one number.

| Token | Value | Use |
|---|---|---|
| `DayTemperatureStep.noonOpacity` | 0.85 | the count from 12:00 |
| `DayTemperatureStep.afternoonOpacity` | 0.75 | the count from 15:00 |
| `DayTemperatureStep.eveningOpacity` | 0.65 | the count from 18:00 |
| `DayTemperatureStep` boundaries | 12, 15, 18 (hours, Mac zone) | the steps |
| `OverdueWash.singleDayOpacity` | 0.06 | one day overdue |
| `OverdueWash.lateOpacity` | 0.09 | two to six days |
| `OverdueWash.longOverdueOpacity` | 0.12 | seven days or more |
| `OverdueWash.lateFromDays` | 2 | the band's first day |
| `OverdueWash.longOverdueFromDays` | 7 | the band's first day |
| wash colour | `Color.red` (system) in `.fullColor`; `Color.primary` in `.vibrant` and `.accented` | the existing overdue colour, dynamic in light and dark; a luminance step in the system's own modes |
| cap fallback | `lateOpacity` 0.09, `longOverdueOpacity` 0.12 | applied if the spike measures the due words below 3:1 on the 9-day row (ADR 0065 §5) |
| title colour | `.primary` | unchanged; never faded |

The count's opacity and the wash are the only new numbers. The steps' hours and the bands are constants, not literals in the views.

## 3. Copy

All owner-facing copy goes in the copy modules. No string sits inline in a view.

| Where | Key | Text (en-US, the repository's language; the product copy lang is set by a later ADR) |
|---|---|---|
| `SettingsCopy` | `dayTemperature` | Day temperature |
| `SettingsCopy` | `dayTemperatureDetail` | Dims the menu bar count through the afternoon and tints overdue widget rows. Quiet in a Focus. |

Options for the detail:

- **A:** "After noon the menu bar count fades a little, and overdue tasks get a faint red wash in the widgets. Quiet during a Focus that holds todz."
- **B:** "Dims the menu bar count through the afternoon and tints overdue widget rows. Quiet in a Focus."

**Loop's pick: B.** It is two lines in the form, names both effects, and states the Focus rule without the word "wash", which an owner may not read as a tint. No copy for the widgets or the menu bar: the overdue words already exist (`WidgetDay`, `DueLabel`), and the count is unchanged.

## 4. Accessibility

- **Increase Contrast** (`colorSchemeContrast == .increased`): the menu bar count is plain and no wash is drawn. The information is still in the count and in the words "Overdue" and "N days overdue".
- **Reduce Motion:** nothing to reduce. A step changes at once; no animation is added.
- **Reduce Transparency:** no change. The wash is a tint over the widget's own background, which the system makes opaque already; the count is text.
- **Dark and light, tinted and transparent bars:** the count is template-rendered text; the glyph is a template image, so the system colours both. The tone is alpha, so it shows as a dimmer count on every bar, and it is never the only signal: the number is there at every step.
- **Contrast of the due words on the wash:** the `.primary` title stays near 16:1 (light) and 13:1 (dark) even at 0.18. The words that suffer are the red due words ("Overdue · …", `.foregroundStyle(.red)` in `WidgetTaskRow` and `NextUpTask`), red on red, estimated near 3.5:1 at no wash falling to 2.8:1 at 0.18 in light and 4.9:1 to 4.0:1 in dark. The inspector measures the due words on the 9-day row in light and dark; pass is at least 3:1. The fallback is decided now: lower `longOverdueOpacity` to 0.12 and `lateOpacity` to 0.09, recorded in ADR 0065 Evidence. The unit tests pin the maximum.
- **VoiceOver:** the menu bar's label is unchanged (ADR 0036). The widget row's label already includes the due words; the wash adds no words.
- **Hit targets and layout:** unchanged; the wash is behind the row, not a control.

## 5. Options and the loop's pick

**O1. The menu bar tone.** Pick: count opacity steps at 0.85, 0.75, 0.65 (ADR 0065 §3). Alternatives: weight steps, a tinted glyph variant, a dot, a continuous ramp (all rejected in the ADR).

**O2. The step values.** Options: three steps (0.85, 0.75, 0.65); two steps (0.8, 0.6). **Pick: three steps.** Two steps read as a single change at 15:00; three give the afternoon a shape without any single step being loud.

**O3. Where the wash goes.** Options: the Today list rows and the next-up card; the list rows only; every row including done rows. **Pick: list rows and the next-up card.** Done rows are not overdue by definition; the ring has no rows.

**O4. The wash bands.** Options: three bands (1 day, 2 to 6, 7 and more); a single wash for any overdue row; a wash that grows every day. **Pick: three bands, capped at 0.12 (0.18 measured 2.78:1 for the red due words; ADR 0065 Evidence).** One band hides the age the owner asked for; a daily growth needs a ceiling anyway, and three bands are readable at a glance.

**O5. Reduce Transparency.** Options: the same wash; no wash. **Pick: the same wash.** The wash is a tint the system keeps opaque, so it does not depend on transparency.

**O6. The widget lane's unit target.** Options: add `TodzWidgetsTests` (a new target in `project.yml`); keep the logic in TodzKit and prove the widget by build and walk. **Pick: keep the logic in TodzKit; no new target** (the spec's open question, default). A new target is a `project.yml` change owned by the app lane; the lane split stays disjoint.

## 6. Screenshots for the PR and the README

PR evidence (`.pr-media/day-temperature/`):

1. Menu bar count, plain, light bar (before noon, switch off) and the same with the switch on at 11:00.
2. Menu bar count at each step, light bar: 12:00, 15:00, 18:00 with 6 open (scratch render), and 18:00 with zero open for the icon-only state.
3. Menu bar count at each step, dark bar: the same three.
4. Menu bar on a tinted bar at the evening step (one shot, for the glass and tinted case).
5. Widget, medium, light and dark, with overdue rows at one, three and nine days and a row not overdue; plus the same in vibrant (another app in front) and accented (monochrome widget style).
6. Widget, small (next-up card), overdue, light and dark.
7. Settings window, the new row, switch off and on.
8. Focus quiet: menu bar plain at the evening step, the Focus on (one screenshot).
9. Increase Contrast on: menu bar plain at the evening step, widget with no wash.

README (ADR 0047 keeps the story shots short): **one shot** only, if the owner's story needs it: the widget with the three overdue ages, light. The others stay in the PR.

## 7. Refusals and what the design does not do

- No tone while a Focus holds todz, in either place.
- No animation between steps.
- No new glyph, dot or badge.
- No copy in views; no new fonts; no hard-coded opacity in a view.
