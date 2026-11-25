# Design: Menu bar ribbon

Written in the `frontend-designer` role (`.agents/roles/frontend-designer.md`). There is no design system recorded yet, so this design adds no token, colour or font: the ribbon is a template image in the system's menu bar font, tinted by the system. The surface is native, so there is no Playwright walk of today's screen; the reference is the day temperature's scratch renders of the status item (`docs/features/day-temperature/test-plan.md`, Walk) and the Settings window as shipped.

The lead records the loop's picks under **Owner decisions**: the owner asked the loop to pick (`todz-loop/STATE.md`, `proactive-day` item 8), so each pick is the loop's call and the owner may overturn it ([ADR 0071](../../adr/0071-the-menu-bar-ribbon-unfolds-what-is-next-beside-the-glyph-for-a-few-seconds-as-template-frames-behind-a-setting-off-by-default.md)).

## 1. Screens and states

### The status item

```
at rest, count on            [◫ 3]
unfolding (0.25 s)           [◫ 3 le…]          width and text alpha grow together
holding, text fits           [◫ 3 left · next: T-12 Review PR]
holding, text overflows      [◫ 3 left · next: T-12 Review the onboardi]   the 180 pt window, start of the strip
scrolling once (40 pt/s)     [◫ ext: T-12 Review the onboarding copy b]
holding at the end           [◫ ding copy before Friday's release…]   1.5 s, then fold
folding (0.25 s)             [◫ 3 …]
back at rest                 [◫ 3]
one left                     [◫ Last one: T-12 Review PR]
a task not saved yet         [◫ 3 left · next: Review PR]
Reduce Motion                [◫ 3 left · next: T-12 Review the onboard…]   jumps in, 5 s, jumps out
count off in Settings        [◫]  →  [◫ 3 left · next: T-12 Review PR]  →  [◫]
```

`◫` is the template glyph (`MenuBarGlyph`), unchanged. The count and the ribbon text share the glyph's leading spacing (`menuBarLabelSpacing`, 8 points), so the glyph never moves.

| State | What the item shows | Width |
|---|---|---|
| Empty: Today has no open task | the glyph alone (count off) or nothing new; no ribbon ever starts | unchanged |
| Loading: the count is unknown (signed out, naming the first workspace, first pull not landed) | no ribbon | unchanged |
| Error: offline | the ribbon shows from the cache, as the count does; the line is what the cache says | as any ribbon |
| Overloaded: a 200-character title, or 99+ open | the strip is cut at 420 points with an ellipsis; "99+ left" is not used: the line reads the true count ("120 left · next: …"), because it is words, not a badge | at most glyph + 180 points |
| Success | the timeline of ADR 0071 §4 | glyph + up to 180 points, for at most 9.5 s |

Light and dark bars: the image is a template, so the system draws it in the bar's own colour, as it draws the glyph and the count today. A tinted or wallpaper bar is the same. There is no light or dark variant to design.

### Settings

One row, laid out like Close the day (a control group on the trailing side, the title and the detail on the leading side), placed after Day temperature:

```
Menu bar ribbon                                   [ Every hour            ⌄ ]  (●  )
Now and then, the menu bar unfolds what's next
for a few seconds, then folds back.
```

| State | Picker | Switch | Detail |
|---|---|---|---|
| Off (default) | disabled, shows the stored cadence or "Every hour" | off | the detail line |
| On, every hour | enabled | on | the detail line |
| On, at the close of the day, Close the day off | enabled | on | the detail line |
| On, at the close of the day, Close the day on | enabled | on | "Close the day already opens todz at that time." |
| On, when an agent adds or completes a task | enabled | on | the detail line |

The detail never mentions Focus: `focus-switch-defaults` removes per-feature Focus copy in favour of one "Respect Focus" switch.

## 2. Components

- Reused: `MenuBarLabel` (`apps/macos/Todz/MenuBar/MenuBarLabel.swift`) picks what to draw; `MenuBarCountImage` (`apps/macos/Todz/MenuBar/MenuBarCountImage.swift`) is the pattern for the template rendering; the Close the day row in `SettingsView` (`apps/macos/Todz/Settings/SettingsView.swift`) is the pattern for a control plus a switch on one row.
- New, in `apps/macos/Todz/MenuBar/`: `MenuBarRibbonImage` renders the glyph and the strip once and crops a frame from it; `MenuBarRibbonLabel` is the `Equatable` view of one frame, beside `MenuBarCountLabel`.
- New, in TodzKit: the line, the timeline and the cadence are pure types so the tests read one source (named in `plan.md`).

## 3. Tokens

None added. The ribbon uses the system menu bar font as the count does (`Text` in the label, monospaced digits for the count part only where the count already uses them), the 8-point `menuBarLabelSpacing`, and alpha in the template. Every number of the motion (180, 420, 0.25 s, 5 s, 1.5 s, 40 points per second, 30 frames per second) is a TodzKit constant with the ADR pointer, not a design token, because the menu bar has no token set.

## 4. Copy

Ready for the Swift copy modules in `apps/macos/Copy/` (the app's equivalent of `*-copy.ts`):

| Where | Key | String |
|---|---|---|
| `MenuBarCopy` | `ribbonRemaining(left:next:)` | `"\(left) left · next: \(next)"`, e.g. "3 left · next: T-12 Review PR" |
| `MenuBarCopy` | `ribbonLast(next:)` | `"Last one: \(next)"` |
| `MenuBarCopy` | `ribbonTask(number:title:)` | `"\(TaskRowCopy.shortId(number:)) \(title)"`; a task with no number is its title alone |
| `AccessibilityCopy` | `menuBarRibbonRemaining(left:next:)` | `"todz, \(left) left today. Next: \(next)"` (inflected like `menuBarCount`) |
| `AccessibilityCopy` | `menuBarRibbonLast(next:)` | `"todz, last one today: \(next)"` |
| `SettingsCopy` | `menuBarRibbon` | "Menu bar ribbon" |
| `SettingsCopy` | `menuBarRibbonDetail` | "Now and then, shows what's next beside the menu bar icon for a few seconds." |
| `SettingsCopy` | `menuBarRibbonCadence` | "When the ribbon shows" (the picker's hidden label, read by VoiceOver) |
| `SettingsCopy` | `menuBarRibbonHourly` | "Every hour" |
| `SettingsCopy` | `menuBarRibbonDayClose` | "At the close of the day" |
| `SettingsCopy` | `menuBarRibbonAgentChange` | "When an agent adds or completes a task" |
| `SettingsCopy` | `menuBarRibbonDayCloseOverlap` | "Close the day already opens todz at that time." |

"left" uses the `InflectedCopy` path `MenuBarCopy.left(count:)` already uses, so one rule pluralises both.

## 5. Interaction and accessibility

- The ribbon takes no input. A click on the item during a ribbon opens the popover as always, and the ribbon ends at once, so the popover anchors to the item at rest.
- Focus order and keyboard: the item is unchanged; Settings adds the picker before the switch, in reading order, as Close the day's picker precedes its switch.
- VoiceOver: while it shows, the item reads the ribbon line (§4); otherwise ADR 0036's label. No announcement is posted.
- Disabled reason: the picker is disabled while the switch is off, as Close the day's time is; the detail line says what the row does.
- Motion: Reduce Motion removes the unfolding, the scroll and the folding (`NSWorkspace.shared.accessibilityDisplayShouldReduceMotion`, observed through `accessibilityDisplayOptionsDidChangeNotification`, the day temperature's pattern for contrast).
- Contrast: the ribbon text is drawn at full alpha in the template, so it has the contrast of the glyph on every bar; the day temperature's dimming applies to the count only, never to the ribbon. Increase Contrast changes nothing because nothing is dimmed.
- Duration: at most 9.5 s, and at most once an hour or once in ten minutes for agent changes.

## 6. Options

The owner asked for options and for the loop to pick. Mockups are the ASCII renders above; the build's scratch renders replace them under `docs/screenshots/menu-bar-ribbon/` for the README and the PR.

### 6.1 The shape

| Option | Picture | Trade-offs |
|---|---|---|
| **A. Ribbon (recommended)** | `[◫ 3 left · next: T-12 Review PR]` for seconds, then `[◫ 3]` | his image of "uma faixa expandida"; says what is next; moves the items to its left while it shows |
| B. Progress sliver | `[◫ 3]` with a 2-point bar under the glyph filling as Today empties | no width change; says no task; reads as a download bar; too thin for a template to stay legible |
| C. One-line ticker | `[◫ T-12 Review PR ▸]` always, cycling | always informative; takes width from other apps forever and never stops moving |

### 6.2 The motion

| Option | Trade-offs |
|---|---|
| **Unfold, hold, scroll once if long, fold (recommended)** | the owner's "scrolls once in a marquee if long"; bounded at 9.5 s |
| Cross-fade the count into the line, no width animation | simpler; the jump in width reads abrupt; kept as the Reduce Motion form and as the fallback |
| Typewriter reveal | playful; louder than the bar should be |

### 6.3 The line

| Option | Trade-offs |
|---|---|
| **"3 left · next: T-12 Review PR", "Last one: …" (recommended)** | the owner's own example; the count is in words, so it survives the count being off |
| The title alone | shorter; loses "how many" |
| Who changed it ("Claude added T-14") for agent changes | tells the cause; a second line shape, and the ribbon is about the day, not the agent |

## 7. Owner decisions

The owner delegated the picks to the loop (`proactive-day` item 8, "seja criativo … a frontend-designer pass with options, and the loop picks"). Recorded by the lead on 2026-11-25:

| Choice | The loop's pick | Why |
|---|---|---|
| Shape | A, the ribbon | the owner's own image, and the only option that says what is next |
| Motion | unfold, hold, scroll once if long, fold; Reduce Motion jumps and truncates | the owner's words; bounded |
| Line | "N left · next: T-n title", "Last one: …" | the owner's example |
| Default | off, cadence every hour | ADR 0071 §1 |
| Agent cadence | settle 3 s, at most once in 10 minutes, drop inside the window | quiet under bursts |
