# 0065. The day temperature steps the menu bar count's opacity after noon and washes overdue widget rows by age, behind a setting

- Status: Accepted (the build loop's call, the owner may overturn it); amended by [0068](0068-one-respect-focus-switch-decides-for-every-proactive-surface-and-untouched-settings-follow-the-defaults.md) (§1 on by default; §6 the gate silences the tone only with Respect Focus on, and the row no longer mentions Focus)
- Date: 2026-11-25
- Deciders: Claude (the build loop's call, pending the owner); Dhyego Calota (owner) chose idea 6 from the loop's `proactive-day` list: the menu bar count shifts tone as the afternoon advances while Today is still full, and overdue tasks age visually in the widgets (fade or tint); subtle, the template glyph, legible in light and dark; opt-in, off by default, no push notifications, through the shared Focus gate
- Inspired by: [ADR 0036](0036-the-menu-bar-icon-counts-today-s-open-tasks-behind-a-setting.md) (what the count is and that zero shows the icon only), [ADR 0054](0054-the-app-learns-focus-through-a-todz-focus-filter-not-the-focus-status-api.md) (the proactive gate, quiet during a Focus that holds it), [ADR 0055](0055-the-day-closes-once-a-day-in-the-menu-bar-popover-at-the-owner-s-time.md) (an app-local preference with a default off), [ADR 0062](0062-the-morning-glance-is-a-non-activating-glass-panel-that-shows-today-on-the-first-wake-or-unlock-of-the-day.md) (the Mac's time zone decides the day for a clock-driven surface), [ADR 0032](0032-widgets-read-a-snapshot-in-an-app-group-that-a-team-prefix-replaces-later.md) (widgets read the app's snapshot), [ADR 0031](0031-the-menu-bar-extra-is-a-swiftui-window-over-the-app-s-one-model.md) (the label reads the app's one model)

## Context

The owner wants the day to show its time without a notification: as the afternoon goes on with Today still full, the menu bar count should look a little different, and an overdue task should look older the longer it waits, in the widgets he keeps on the desktop. The change must stay quiet. Three constraints shape it.

The menu bar item is a template image. The app's glyph (`MenuBarGlyph`) is a template, and the system renders a template in the bar's own colour, on light and dark bars and on a tinted or transparent one. A template carries no colour of its own, so a tone can only come from alpha, weight or extra shape. The count is text the app renders inside the same status item, so its alpha is the one lever that does not change the item's width.

Widgets are passive, drawn by WidgetKit from a timeline. A widget row's title must keep its contrast whatever the age, so the age cannot be shown by fading the title.

The proactive gate holds every surface the owner did not ask to see during a Focus that holds todz, and this feature is a proactive surface in the owner's list, so it follows the same rule.

## Decision

1. **An app-local switch, off by default.** "Day temperature" in Settings, kept in the app's defaults with a default of off, as the morning glance and the day close are (ADR 0055 §1, ADR 0062 §1). Turning it on changes nothing until the next step boundary or the next snapshot write, which the app makes at once. *Amended on 2026-11-25 by [ADR 0068](0068-one-respect-focus-switch-decides-for-every-proactive-surface-and-untouched-settings-follow-the-defaults.md):* on by default; a Mac where the owner never flipped the switch takes it, one where the owner turned it off keeps it off.
2. **The steps are the Mac's clock, not a continuous ramp.** The day is divided at local times in the Mac's current time zone: before 12:00 is plain; 12:00 to 14:59 is the first step; 15:00 to 17:59 the second; 18:00 to 23:59 the third; midnight returns to plain. The steps do not move between minutes; each one is a single change.
3. **Tone is alpha on the count, and nothing else.** The count text's opacity steps down: plain 1.0, first step 0.85, second step 0.75, third step 0.65. The template glyph is never tinted, reshaped or duplicated, and its width does not change. The count keeps its weight and its monospaced digits, so the item does not move. A `MenuBarExtra` label becomes a status-item button title and image, and SwiftUI styling on it is commonly dropped, so the fallback is decided now: if the spike shows the label drops `.opacity` on the `Text`, `MenuBarLabel` renders the glyph and the count with `ImageRenderer` into one `NSImage` with `isTemplate = true`, the count drawn at the step's opacity. A template image keeps its alpha channel, so the tone survives and the glyph stays a template; the accessibility label is unchanged. The spike tries, in order, `.opacity` on the `Text`, `.foregroundStyle(.primary.opacity(...))`, then the rendered template image, and the first that shows a measured difference wins. This amends this section with the evidence; it never supersedes the ADR.
4. **"Today still full" means the count is above zero.** The tone applies while the menu bar shows a count (the open count of Today of the active workspace, ADR 0036). At zero, the item shows the icon only, as before, so a cleared Today is plain. The tone does not read the share of the day finished: that would need the done count and a stored snapshot of the morning, and a count that fell by half would then hide the tone the owner asked to see.
5. **Overdue rows wash, they do not fade.** A row of an open, overdue task in the widgets sits on a wash of the system red at 0.06 opacity for one day overdue, 0.12 for two to six days, 0.18 from seven days on. The title stays `.primary` at full contrast, the due label keeps its existing red and its words ("Overdue", the day count), and a row that is done or not overdue gets no wash. The wash is a constant set in TodzKit, so the widgets and the tests read one number. The wash reads `widgetRenderingMode`: `.fullColor` draws the system red; `.vibrant` and `.accented` draw `Color.primary` at the same bands, a luminance step the system keeps, because vibrant desaturates colour and accented puts it in the primary group. The contrast measured is the red due words ("Overdue · …") on the wash, not the `.primary` title, which stays near 16:1 in light and 13:1 in dark even at 0.18. Pass is at least 3:1 on the 9-day row, light and dark; the fallback is decided now: `lateOpacity` 0.09 and `longOverdueOpacity` 0.12, recorded in Evidence. The geometry: the row's full width and own height, no padding added, a corner radius from a constant; pending rows get no wash; on the small widget the wash sits behind `NextUpTask` only.
6. **Focus silences the tone, in both places.** The gate decides, not the surfaces. `AppModel` holds `showsDayTemperature` (observable) and `showDayTemperature(_:)`; the flag is `DayTemperatureTone.isShown(isSettingOn:isQuiet:)`, set by `AppDelegate` after `readFocusFilter()` settles, on defaults changes and on `gate.isQuiet` changes, so the existing snapshot observation writes once and reloads once per change and nothing is written when the state does not change. The menu bar reads the gate for the count. When a Focus that holds todz turns on, the menu bar drops to the plain count and the snapshot is rewritten with the flag off, which reloads the widgets; when it ends, the tone returns at once. No surface shows a tone during a quiet Focus, and nothing is pushed when the Focus ends. *Amended on 2026-11-25 by [ADR 0068](0068-one-respect-focus-switch-decides-for-every-proactive-surface-and-untouched-settings-follow-the-defaults.md):* a Focus quiets the tone only while Respect Focus is on; the Settings detail no longer says "Quiet in a Focus."
7. **Widgets read the setting from the snapshot.** The snapshot's encoding gains one required key, `showsDayTemperature`. It is not defaulted on decode: a snapshot without it fails to read, and the widget shows its existing prompt until the app writes the new snapshot, which it does at launch. An older build ignores the key, so a rollback needs no migration.
8. **The clock wakes the app only when a step changes.** `DayTemperatureClock` in TodzKit (`@MainActor @Observable`, with an injected `now` and `pause`) holds the step and one wait to the next step boundary on the continuous clock, as `DayCloseScheduler` does, so sleep is counted. `DayTemperatureScheduler` calls `refresh()` on wake, unlock, time zone, system clock and calendar day changes and on defaults changes; the count does not re-arm the clock, because the step does not depend on it. At most four boundaries fall in a day. The widgets need no new timeline entries: the wash changes only with the day, and the existing midnight entry covers it.
9. **Accessibility turns the tone off, not the count.** When Increase Contrast is on (read as the spike decides: `colorSchemeContrast`, or `NSWorkspace.shared.accessibilityDisplayShouldIncreaseContrast` with its notification), the count is plain and the wash is not drawn; the count and the widget's words are the same. Reduce Motion has nothing to skip, because a step changes at once. Reduce Transparency changes nothing: the wash is a tint over the widget's own background, and the system already makes that background opaque. The menu bar's accessibility label stays the one ADR 0036 names, so the tone is never the only signal: the count is text, the overdue is in words.
10. **Time zones.** The steps follow the Mac's current time zone, as the morning glance and the day close do; the widget's overdue age follows the snapshot's zone, as the widget's "today" already does. The snapshot's zone is the Mac's zone, so after a zone change the steps follow the new zone at once and the wash follows the snapshot's day until the next write.

## Alternatives considered

Tone on the menu bar:

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| Count opacity steps (chosen) | keeps the template glyph and the width; subtle; works on light, dark and tinted bars as alpha | a colour-less tone: the owner sees a dimmer count, not a warm one | — |
| Count weight steps | visible without colour | the width changes, so the item jitters; heavier reads louder, not calmer | the opposite of subtle |
| A tinted non-template glyph variant | colour | loses the system's tinting on a transparent or tinted bar; two assets per appearance; breaks "uses the template glyph" | the owner asked for the template glyph |
| A dot or sliver beside the count | very visible | an extra shape that reads as a notification badge, adds width | not subtle; reads as an alert |
| A continuous ramp of alpha by minute | smooth | changes every minute, so the item redraws every minute, and the owner reads it as noise | steps are the subtle version |
| The owner's day-close time as the curve | ties the tone to his day | the day close is off by default and can be any time; a 18:00 default would make the tone start at the day's end | the tone should follow the afternoon, not the close |

Overdue rows in the widgets:

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| A wash behind the row (chosen) | visible at a glance; the title keeps full contrast; works on light and dark through the system red | a faint red field the owner must learn | — |
| Fade the whole row | the most literal "age" | the title falls below the contrast the widget needs at its floor | legibility |
| Fade only the title | keeps the row's shape | the same contrast loss on the words the owner reads | legibility |
| A stronger red for the due label | uses the existing colour | red is already the overdue colour, so it does not age | no change in age |
| A leading bar that thickens | structural | adds a shape the widget does not have; competes with the checkbox | not subtle |

Setting and Focus:

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| One Settings switch, the snapshot carries it (chosen) | matches the other proactive switches; one place | the widget reads a new snapshot key | — |
| A per-widget configuration | the owner picks per widget | needs an intent UI per widget and a second place to switch it on | more UI than the owner asked |
| Widgets ignore Focus | simpler | the widgets would show a tone during a Focus the owner set to silence | the gate decides for every surface |
| Tone during Focus | always visible | breaks "stays silent during a Focus" (ADR 0054) | excluded |

## Consequences

- The menu bar item looks the same at zero and before noon, and a little dimmer after noon while Today has tasks; the owner can read the change without a badge.
- The widgets keep their size and layout; a row with a wash is taller by nothing, and the wash is behind the same text.
- Each boundary is one wait in the app and no entry in the widgets; at most four per day, so the count of wakes stays fixed and the performance budgets of ADR 0061 are unaffected.
- The snapshot gains a key; an older build reads the snapshot and ignores it, and an older snapshot reads as the prompt until the app writes once.
- Two Macs each show their own steps, from their own clock.
- The contrast of the wash is not measured by a unit test: the test pins the maximum alpha, and the walk measures the red due words against the wash with Accessibility Inspector in light and dark.

## Evidence

Not measured yet. The first build step is a spike in a scratch worktree, not committed: a `MenuBarExtra` label with a `Text` count at opacities 1.0, 0.85, 0.75 and 0.65 on a light, a dark and a wallpaper-tinted bar, tried as `.opacity`, then `.foregroundStyle(.primary.opacity(...))`, then the `ImageRenderer` template image. Pass when the mean luminance of the count's pixels differs from the plain capture at every step on all three bars and the evening count measures at least 3:1 against the bar; the spike also confirms `colorSchemeContrast` updates in the label. The wash is captured in `.fullColor`, `.vibrant` and `.accented`, and the due words on the 9-day row are measured in light and dark (pass at least 3:1; otherwise the caps become 0.09 and 0.12). The lead commits the evidence here as `docs(day-temperature): record the spike`: recorded below.

Spike run on 2026-11-25 on the owner's Mac (macOS 26, a notched display, the menu bar in Dark appearance over the wallpaper), a scratch SwiftUI `MenuBarExtra` with a `checklist` glyph and a `6`, each variant launched alone, its status item window captured by window number with `screencapture -l` and the alpha channel of the count's pixels (the right 45% of the item) measured. Appearance was not switched, because that repaints the owner's whole screen; the light bar is the same capture composited over a light bar in linear light, and the tinted bar is the live wallpaper-tinted bar.

| Variant | 1.0 | 0.85 | 0.75 | 0.65 |
|---|---|---|---|---|
| `.opacity(x)` on the `Text`: peak alpha of the count | 0.910 | 0.910 | 0.910 | 0.910 |
| `.foregroundStyle(.primary.opacity(x))`: peak alpha | 0.910 | 0.910 | 0.910 | 0.910 |
| `ImageRenderer` template `NSImage`: peak alpha | 0.910 | 0.788 | 0.694 | 0.616 |
| `ImageRenderer` template: mean alpha of the count's pixels | 0.569 | 0.496 | 0.442 | 0.401 |
| `ImageRenderer` template: contrast on the dark bar | 13.86 | 10.68 | 8.57 | 7.03 |
| `ImageRenderer` template: contrast on a light bar | 15.24 | 10.77 | 7.67 | 5.75 |

- **The status item drops both SwiftUI alphas**: `.opacity` and `.foregroundStyle(.primary.opacity)` captured identical to the plain label at every step. The `ImageRenderer` template image is the first that differs at every step, so **the path G1 builds is the template `NSImage`** (ADR §3 amended by this evidence, not superseded).
- The template image kept the system's tint (the glyph and the count rendered light on the dark bar) and the item's window width did not change between steps (98 by 66 pixels at every step).
- Pass: the mean luminance and alpha of the count differ from the plain capture at every step, and the evening count measures 7.03:1 on the dark bar and 5.75:1 on a light bar, above 3:1.
- **Increase Contrast**: not toggled, because it repaints the owner's screen. Because the template image is drawn by the app, the label must be redrawn when contrast changes, so it reads `NSWorkspace.shared.accessibilityDisplayShouldIncreaseContrast` and observes `NSWorkspace.accessibilityDisplayOptionsDidChangeNotification` (the plan's decided fallback), never `colorSchemeContrast`.
- **The wash**, computed in linear light (the widget could not be placed on the owner's desktop for the spike; Accessibility Inspector is left to the walk), system red (255, 59, 48) light and (255, 69, 58) dark over a white and a 0x1E1E1E widget background:

| Wash | Due words, light | Due words, dark | Title, light | Title, dark |
|---|---|---|---|---|
| none | 3.55:1 | 4.89:1 | 21.00:1 | 16.67:1 |
| 0.06 | 3.28:1 | 4.62:1 | 19.39:1 | 15.72:1 |
| 0.09 | 3.15:1 | 4.46:1 | 18.62:1 | 15.20:1 |
| 0.12 | 3.02:1 | 4.30:1 | 17.88:1 | 14.65:1 |
| 0.18 | 2.78:1 | 3.97:1 | 16.47:1 | 13.52:1 |

- **0.18 fails 3:1 for the due words in light (2.78:1)**, so the decided fallback applies: `lateOpacity` 0.09 and `longOverdueOpacity` 0.12 (3.15:1 and 3.02:1 in light). The bands are 0.06 for one day, 0.09 for two to six, 0.12 from seven.
- `.vibrant` and `.accented` draw `Color.primary` at the same bands; there the due words are not red (the system recolours them), the title stays at 9.36:1 or more in dark and 13.77:1 or more in light at the top band, so the red-words measure does not apply.

## Revisit when

The owner asks for colour in the menu bar; the system stops honouring text alpha in a status item; the owner wants the tone to follow his day close; or the widgets gain a per-widget setting the owner wants.
