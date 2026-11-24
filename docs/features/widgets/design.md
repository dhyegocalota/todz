# Design: widgets

**Sources:** [the approved product design](../../product/README.md) (macOS app → Widgets: "small 'Today' progress ring, small 'Next up', medium and large lists. Their checkboxes complete tasks through an App Intent without opening the app"; Sync: the widgets read what the app writes to the App Group and every local change reloads their timelines; Non-goals: agents as live actors), [the Glass mockup](../../product/mockups/glass-screens.html) ("Menu bar and widgets": `.wgrid`, `.w`, `.w-s`, `.w-m`, `.w-l`, `.w-s .lbl`, `.w-s .next`, `.w-s .cap`, `.ring`, `.w h4`, `.w .row`, `.tag`, `.done`, `.due`), [the spec](spec.md) and [ADR 0032](../../adr/0032-widgets-read-a-snapshot-in-an-app-group-that-a-team-prefix-replaces-later.md) (one snapshot of the active workspace's Today, requests through an `AppIntent`, no widget for another workspace), [the menu bar's design](../menu-bar/design.md) (Today's order, pending adds, done rows, "left" and "done today", the row click), [the shell's design](../mac-app-shell/design.md) (tokens, checkbox, due labels, contrast) and [the sync design](../mac-sync/design.md) (pending adds, no marker on a waiting change). The lead's constraints: WidgetKit, macOS 14 interactive widgets with an `AppIntent` that completes or reopens a task, the widgets show what the snapshot says and nothing else.
**Design system:** unchanged from the shell: system materials, semantic colours, text styles and the one accent `#2F5BFF`. No token is added.
**Screenshots:** none taken. Playwright MCP drives a browser, and WidgetKit draws on the desktop through the system's widget host, outside any page it can open; the menu bar's design also found its `chrome-for-testing` browser missing, so the mockup itself is not captured either. The captures this document needs are listed in section 6 under `.pr-media/widgets/design/`, taken from the built extension on the desktop by the `recorder` with the owner's OK (the widgets draw on his screen). Until they exist, each option cites the mockup element it keeps or changes.

## 1. Screens and states

Four widgets in three widget kinds, all reading the one snapshot the app writes. The app's screens do not change; the app gains one deep-link entry (§ 1.6).

### 1.1 The widgets

| Widget | Kind | Family | Gallery name | Gallery description | Mockup |
|---|---|---|---|---|---|
| Today ring | `TodayRingWidget` | `systemSmall` | `WidgetCopy.ringName` | `WidgetCopy.ringDescription` | first `.w-s` |
| Next up | `NextUpWidget` | `systemSmall` | `WidgetCopy.nextUpName` | `WidgetCopy.nextUpDescription` | second `.w-s` |
| Today list, medium | `TodayListWidget` | `systemMedium` | `MainWindowCopy.today` | `WidgetCopy.listDescription` | `.w-m` |
| Today list, large | `TodayListWidget` | `systemLarge` | (same kind) | (same kind) | `.w-l` |

No configuration: every widget follows the app's active workspace (option O10). No `systemExtraLarge`.

### 1.2 Layout, ready state

The system's content margins and container background (§ 3); no custom padding. Every count is a number formatted by the system (`count.formatted()`).

| Widget | Top to bottom |
|---|---|
| Today ring | label `MainWindowCopy.today` (option O13); the ring, centred, a named diameter and line width (the mockup's 54 points and its 4-in-36 stroke), the progress arc from twelve o'clock clockwise in the accent over a track in `.fill.tertiary`, round caps; caption `WidgetCopy.progress(done:total:)` (option O7) |
| Next up | label `WidgetCopy.nextUp` (option O13); the checkbox leading the task title, up to three lines, tail truncation; caption line 1: the due label, `TaskRowCopy.overdue(date:)` in red or `WidgetCopy.dueToday` in `.secondary`; caption line 2: the project tag and, when an agent added it, `TaskRowCopy.via(client:)`, one line, tail truncation (option O6) |
| Medium | header: leading `MainWindowCopy.today`, trailing `MenuBarCopy.left(count:)` in `.secondary` (option O1); up to three rows (option O4), separated by `Divider()` |
| Large | header: leading the workspace name, tail truncation, trailing `MenuBarCopy.left(count:)` in `.secondary` (option O1); up to seven rows (option O4), separated by `Divider()` |

Rows are top-aligned: a list with fewer rows than slots leaves the space under them empty.

**Which rows, in which order** (medium and large): the snapshot's order, which is the popover's: open tasks in Today's order (overdue first, then by due date, then manual order), then pending adds, then the tasks done today, newest first. The first N fill the slots; done rows show only in the slots the open and pending rows leave (option O3). The header count is the open total, so it states what the slots cut (option O4).

### 1.3 States

"Prompt" below is one shared state: the widget's label or header (`MainWindowCopy.today`, or `WidgetCopy.nextUp` for Next up; the large shows `MainWindowCopy.today` because the workspace is unknown), and under it `WidgetCopy.noSnapshot` in `.secondary`, `Font.subheadline`, vertically centred; the ring keeps its empty track above the line so the widget stays recognisable. No checkbox, no count. A tap opens the app on Today (§ 1.6).

| State | Today ring | Next up | Medium | Large |
|---|---|---|---|---|
| Placeholder (the system's first draw, before the timeline answers) | the sample entry (§ 1.8) drawn `.redacted(reason: .placeholder)`: track and arc as grey shapes, caption as a bar; the label stays unredacted | redacted sample; label unredacted | redacted sample: header bar, three checkbox circles and title bars; header text unredacted | the same with seven rows |
| Gallery preview | the snapshot if one exists, else the sample entry, not redacted (option O12) | same | same | same |
| No snapshot: never opened, signed out (the snapshot is erased), naming the first workspace, the shared folder missing, an unreadable snapshot | prompt | prompt | prompt | prompt |
| Snapshot older than today (the app was quit across midnight) | prompt (option O9) | prompt | prompt | prompt |
| Switching to a workspace whose Today is not loaded yet (first load, or load failed with no cache) | prompt: the app erases the snapshot and writes the new one once Today is known (minor call) | prompt | prompt | prompt |
| Today empty, nothing done today | track only; caption `MainWindowCopy.todayEmptyTitle` | label; `MainWindowCopy.todayEmptyTitle` in `.secondary` where the title goes; no checkbox, no caption | header `MainWindowCopy.today`, no count; `MainWindowCopy.todayEmptyTitle` and, under it in `.subheadline`, `MainWindowCopy.todayEmptyBody`, both `.secondary`, centred in the row area | header with the workspace name, no count; the same two lines |
| All done (nothing open, some done today) | full ring; caption `progress(done: n, total: n)` | label; `WidgetCopy.allDone` in `.secondary` where the title goes; caption `MenuBarCopy.doneToday(count:)` | header with `left(count: 0)`; the done rows, newest first, in the slots | same, up to seven done rows |
| One task open | `progress(done: 0, total: 1)`, empty arc | that task | header `1 left`; one row | same |
| Many (more open than slots) | `progress` over the totals | the first open task | three rows; header states the total, e.g. `9 left`; no overflow line (option O4) | seven rows; header states the total |
| Open and done, fewer open than slots (the mockup's large) | arc at done of total | the first open task | open rows, then done rows in the slots left | same (the mockup: five open, two done) |
| Overdue tasks | counted as open | an overdue task comes first in Today's order; caption line 1 `TaskRowCopy.overdue(date:)` in red | the row's trailing slot shows `TaskRowCopy.overdue(date:)` in red (option O5) | same, in place of the project tag |
| Pending adds (the app added a task offline or a blink before confirming) | not counted until confirmed, as the popover's "left" (option O7) | shown only when no confirmed task is open: `circle.dashed` in `.secondary` in place of the checkbox, caption `TaskRowCopy.pending` | the shell's pending look after the open rows: `circle.dashed`, not a button, title `.primary`, no trailing slot | same |
| A checkbox tapped, until the app's next snapshot | caption and arc move at once (the done count +1) | the next open task replaces it at once (minor call); undo is in a list widget or the app | the row turns done in place: filled accent check, title `.secondary` with strikethrough; the header count drops by one; tapping again reopens it (option O8) | same |
| A checkbox tapped while the app is quit | as above, for as long as the app stays quit; no marker (as mac-sync O5) | as above | as above; the row stays done in place until the app's next launch reorders it | same |
| A request the app drops (its task left the snapshot meanwhile) | the app's fresh snapshot redraws the task as it really is | same | the row returns to open on the next snapshot | same |
| Offline (the app is running, cannot reach todz) | no marker: the snapshot is the app's cache view; the popover and the window carry the offline item (minor call) | same | same | same |
| The day changes with the app running | the app writes the new day's snapshot at once; the timeline's midnight entry shows the prompt for at most the moment between the two | same | same | same |

### 1.4 Rows (medium and large)

- One line: checkbox, title in `Font.body` `.primary` with tail truncation, then a trailing slot (option O5). Trailing slot: `TaskRowCopy.overdue(date:)` in red on an overdue row; otherwise, in the large only, the project tag (`Font.subheadline`, `.secondary` on `.fill.quaternary`, as the shell's tag); otherwise empty. No "via", no `T-{number}`: those stay in the popover and the window, and "via Claude Code" stays a creator label wherever it shows (Next up's caption).
- Open row: `circle` in `.secondary`. Done row: `checkmark.circle.fill` in the accent, title `.secondary` with strikethrough, no trailing slot. The same symbols as the shell's `TaskCheckbox`.
- Pending row: `circle.dashed` in `.secondary`, not a button, no trailing slot, no link.
- Each confirmed row is a `Link` to its task (§ 1.6); the checkbox is a `Button(intent:)` inside it and takes its own tap.

### 1.5 The checkbox

A `Button(intent:)` running `ToggleTaskIntent` with the task's project and number and the target state (done for an open row, open for a done row). What the owner sees: the system dims the checkbox and the counts marked `.invalidatableContent()` for the instant the intent runs; the intent rewrites the snapshot with that task's state flipped and reloads the timelines, so the widget redraws with the row done in place and the counts moved (option O8). With the app running, the app takes the request within a second or two and writes the real snapshot, which moves the done row into the done group with WidgetKit's own transition. The checkbox is absent in the prompt and empty states, so a stale or missing snapshot never sends a request.

### 1.6 Taps and deep links (option O2)

| Where | Opens |
|---|---|
| Today ring, anywhere | the main window on Today (`widgetURL`) |
| Next up, outside the checkbox | the main window on Today with that task selected and the inspector shown (`widgetURL`), as the popover's row click (menu bar O2) |
| Medium and large, a row outside its checkbox | the same, for that row's task (`Link`) |
| Medium and large, the header or the empty space | the main window on Today (`widgetURL`) |
| A pending row | the main window on Today (the row is not a link; the widget's URL applies) |
| Any widget in the prompt state | the main window on Today; the window shows whatever phase the app is in (sign in, naming, loading) |

A link opens the app if it is quit, then opens or raises the main window and activates the app, as `MenuBarCopy.openWindow` does. A task the window no longer has in Today (completed elsewhere, or another workspace became active) opens Today with no selection (minor call). The URL scheme is the plan's.

### 1.7 Appearance and rendering modes

| Mode | What changes |
|---|---|
| Light | the system widget background; text in `.primary` and `.secondary`; arc and checked checks in the accent; overdue in red |
| Dark | the same semantic colours switch with the system; nothing is set per mode |
| Vibrant (macOS 14 on: the desktop is not focused, the widgets fade into the wallpaper) | the system draws everything in monochrome vibrancy and removes the container background. Meaning survives without hue: the arc is full opacity over a `.fill.tertiary` track, a done check is a filled symbol against an outline, overdue carries the word "Overdue", done carries the strikethrough and the filled check |
| Accented (the tinted widget appearance of macOS 26, when the Mac runs it) | the ring arc, the checked checks and the Next up checkbox carry `.widgetAccentable()` and take the tint; the rest takes the system's primary tint. Behind an availability check, nothing else changes |

### 1.8 The sample entry

Used for the placeholder and for the gallery when no snapshot exists (option O12): the workspace `WidgetSampleCopy.workspace`, five open tasks and two done today, titles and tags from `WidgetSampleCopy` (the mockup's own rows), all due today, none overdue, no pending add. The ring reads `progress(done: 2, total: 7)`.

## 2. Components

| Component | Folder | Change |
|---|---|---|
| `TodzWidgetBundle` (new) | `TodzWidgets` | the extension's `@main`: the three kinds |
| `TodayRingWidget`, `NextUpWidget`, `TodayListWidget` (new) | `TodzWidgets` | one kind each, § 1.1; a `StaticConfiguration` over one timeline provider |
| `TodayTimelineProvider` (new) | `TodzWidgets` | reads the snapshot; entries now and at the next midnight of the snapshot's time zone; the placeholder and gallery entries of § 1.8 |
| `TodayRing` (new) | `TodzWidgets/Views` | the ring and its caption |
| `NextUpView`, `TodayListView`, `WidgetHeader`, `WidgetTaskRow`, `WidgetPendingRow`, `WidgetPrompt`, `WidgetEmptyToday` (new) | `TodzWidgets/Views` | § 1.2 to § 1.4; `WidgetPrompt` is the one prompt of § 1.3 for all four |
| `WidgetCheckbox` (new) | `TodzWidgets/Views` | `Button(intent:)` with the shell's two symbols; the shell's `TaskCheckbox` cannot be reused because it acts on `AppModel` and `MainWindowState`, which the extension does not have |
| `ToggleTaskIntent` (new) | `TodzWidgets` | the `AppIntent` of § 1.5; its title and parameters are not shown to the owner (the widget is its only caller) |
| `WidgetCopy`, `WidgetSampleCopy` (new) | `Copy` (option O11) | section 8 |
| `Copy` folder | `Todz/Copy` → `Copy`, compiled into both targets (option O11) | moved unchanged; `AccessibilityCopy` gains one member |
| `DueLabel.text(dueDate:today:timeZone:)`, `DayFormat` | `MainWindow/TaskList`, `Shared` | the overdue label's text is computed the same way in the extension; the plan moves the static text function and `DayFormat` beside the copy, or gives the extension the same function through `TodzKit`; the view `DueLabel` stays in the app |
| `TodzApp` | app | handles the deep link of § 1.6 with the popover's reveal path (`model.reveal(task:)`, inspector shown, the window opened or raised) |

System components only: `Widget`, `WidgetBundle`, `StaticConfiguration`, `TimelineProvider`, `Button(intent:)`, `Link`, `widgetURL`, `containerBackground`, `Circle` strokes for the ring (not `Gauge`, minor call), `Divider`, `Image(systemName:)`, `.redacted`, `.unredacted`, `.invalidatableContent`, `.widgetAccentable`, `.contentTransition(.numericText())`.

## 3. Tokens

All from the shell's § 3; nothing new.

| Use | Token |
|---|---|
| Widget background | `.containerBackground(.background, for: .widget)`: the system background, which the system removes in vibrant and accented modes |
| Content margins | the system's default widget content margins |
| Ring arc, checked checkbox | `Color.accentColor` = `#2F5BFF`; the extension's asset catalog carries the same `AccentColor` (the app's colour set, shared, not a second value) |
| Ring track | `.fill.tertiary` |
| Small labels, headers, row titles, Next up title, ring numbers | `.primary` (option O13) |
| Header counts, captions, prompt, empty lines, done titles, unchecked ring, pending symbol | `.secondary` |
| Done row title | `.secondary` with strikethrough |
| Overdue label | `Color.red` |
| Project tag fill | `.fill.quaternary` |
| Small labels, list headers | `Font.headline` (the mockup's 13 and 12.5 semibold) |
| Next up title | `Font.title3` semibold (the mockup's 15 semibold) |
| Row title | `Font.body` (the mockup's 12.5) |
| Captions, header count, tag, prompt, empty body | `Font.subheadline` |
| Ring diameter and line width, rows per family (3, 7), Next up title lines (3) | named constants beside the widget views; spacing and radius stay system defaults |

The mockup's `.glass` card (white at 62 % with a blur and shadow) is the system's widget chrome on macOS; it is not drawn.

## 4. Copy

New strings are in section 8. Reused unchanged: `MainWindowCopy.today` (the ring's label, the medium's header, the large's header in the prompt, the list's gallery name), `MainWindowCopy.todayEmptyTitle`, `MainWindowCopy.todayEmptyBody`, `MenuBarCopy.left(count:)`, `MenuBarCopy.doneToday(count:)`, `TaskRowCopy.overdue(date:)`, `TaskRowCopy.via(client:)`, `TaskRowCopy.pending`, `AccessibilityCopy.checkboxOpen(title:)`, `checkboxDone(title:)`, `rowValueOpen`, `rowValueDone`, `rowOpensWindow`. They become readable by the extension through option O11. Counts go through `InflectedCopy`, as the popover's.

## 5. Interaction and accessibility

**Pointer:** the checkbox toggles; every other point opens the app as § 1.6 says. No hover state: the system draws none on desktop widgets.

**Keyboard:** desktop widgets take no keyboard focus on macOS. The keyboard path to every widget action is the popover and the main window, which show the same Today.

**VoiceOver**
- Today ring: one element, label `AccessibilityCopy.todayIn(workspace:)`, value the characters of `WidgetCopy.progress(done:total:)`; in the empty state the value is `MainWindowCopy.todayEmptyTitle`.
- Next up: the label `WidgetCopy.nextUp` read as a header, then the checkbox, then one element for the title and caption with the hint `AccessibilityCopy.rowOpensWindow`.
- Medium header: one element, label `AccessibilityCopy.todayIn(workspace:)`, value `MenuBarCopy.left(count:)`. Large header: the workspace name and the count read as one element.
- Checkbox: label `AccessibilityCopy.checkboxOpen(title:)` or `checkboxDone(title:)`, the toggle trait, as the shell's.
- Row link: label the title, value `rowValueOpen` or `rowValueDone` then the trailing slot's text, hint `rowOpensWindow`.
- Pending row: label the title, value `TaskRowCopy.pending`; no actions.
- Prompt: the line read as text, the widget's link as its action.

**Motion:** WidgetKit's own transition on each reload; counts use `.contentTransition(.numericText())`; the checkbox and the counts use `.invalidatableContent()` while the intent runs. Reduce Motion is the system's.

**Contrast:** the shell's figures hold. `.primary` about 16:1 and `.secondary` about 4:1 on the light widget background; the accent is used for the arc and the filled checks, never for text, because it is about 3.4:1 as text on the dark background (shell O8; option O13). Red is about 3.5:1, so an overdue row always carries the word. In the vibrant and accented modes the system sets the contrast; Increase Contrast and Reduce Transparency are the system's.

## 6. Options

Captures to take from the built extension on the default desktop picture, light and dark, into `.pr-media/widgets/design/`, each as `<widget>-<state>-<appearance>.png` with `<widget>` one of `ring`, `next-up`, `medium`, `large` and `<appearance>` `light` or `dark`; `<state>`: `placeholder`, `prompt` (no snapshot), `stale-day`, `empty`, `all-done`, `one`, `many`, `mixed` (open and done, the mockup's case), `overdue`, `pending`, `checked` (just after a tap, app running), `checked-app-quit`. Then `desktop-vibrant.png` (all four with a window in front), `desktop-accented.png` (macOS 26 tinted, if the Mac runs it), `gallery.png` (the three kinds in the widget gallery), `main-window-from-row.png` (after a row tap) and `main-window-from-ring.png`, and one annotated copy per option (`o1-…png` to `o13-…png`). Once the browser is installed, `mockup-widgets.png` from the mockup's "Menu bar and widgets" block at 1280.

**O1. The list headers** (mockup: `.w-m h4` "Today · 5 left", `.w-l h4` "todz · Monday")
- A. The mockup: medium "Today" and the open count; large the workspace name and the weekday. Faithful, but the large never states how many are open, so a cut list reads as complete, and the weekday repeats the menu bar clock.
- B. Both lists "Today" and the open count. One rule, but no list ever says whose Today it is, and the owner keeps several companies.
- C. Medium "Today" and the open count (the mockup); large the workspace name and the open count. Each list states the total its slots cut; the large, with the room, names the workspace.
- **Recommendation: C.** The medium's VoiceOver label still names the workspace (`todayIn(workspace:)`).

**O2. What a tap on the widget opens**
- A. The ring and every header or empty space: the main window on Today. Next up and each list row: the main window on Today with that task selected and the inspector shown, as the popover's row click. One meaning for "a task was tapped" across the popover and the widgets.
- B. Everything opens the main window on Today. One link, but tapping a task to read its notes lands on a list.
- C. Everything opens the popover. Closest to a glance, but macOS 14 has no public call that opens a `.window` menu bar extra (menu bar § 2), so it is unbuildable today.
- **Recommendation: A.**

**O3. Rows done today in the medium and large** (mockup: two `.row.done` after five open rows in `.w-l`; none in `.w-m`, whose three slots are full)
- A. After the open and pending rows, only in the slots they leave, newest first; their checkbox reopens. The mockup, the popover's O3, and a mis-tap stays undoable from the widget.
- B. Never; the ring and the popover carry them. More room for open tasks, but a task checked by mistake vanishes from every list widget.
- C. One slot always reserved for the newest done task. A constant reminder of progress, but it costs an open slot in the medium, a third of its list.
- **Recommendation: A.**

**O4. Rows per family and the overflow** (mockup: three rows in `.w-m` with "5 left"; seven in `.w-l`)
- A. Medium three, large seven, the mockup's; no overflow line; the header's open count states the total the slots cut (O1 = C). Every slot is a task.
- B. The same counts with the last slot replaced by `{count} more` when the list overflows, linking to Today. Explicit, but the medium shows two tasks out of nine, and one more string.
- C. Fill the height the system gives (about four and ten). More tasks, but the count varies by display, and the mockup's spacing is lost.
- **Recommendation: A.**

**O5. What a widget row shows** (mockup: `.w-m .row` the title only; `.w-l .row` the title and `.tag`)
- A. One line: checkbox, title, a trailing slot: the overdue label in red when overdue, else the project tag in the large, else nothing. The mockup's density; "via" and the id stay in the popover and the window.
- B. The shell's two-line row (sub-line with tag, due label, via; trailing id). One row everywhere, but the medium fits two tasks and the large five.
- C. One line in the medium, two lines in the large. The large tells who added each task, but two row designs to keep in step.
- **Recommendation: A.** Overdue wins the slot over the tag because the word is the only way an overdue row reads without colour.

**O6. Next up** (mockup: `.w-s .next` a title, `.cap.due` "due today", no checkbox)
- A. The first row of Today that is not done (the first open task in Today's order, else the first pending add), with a checkbox before the title; caption the due label, then the tag and "via". Checking it shows the next task at once: a small widget that works through the day.
- B. The same task without a checkbox; a tap opens it. The mockup exactly, but the one widget named for action cannot act, against the product line "their checkboxes complete tasks".
- C. The first overdue task, else the first due today, ignoring manual order. Sharper urgency, but a second order to explain next to the popover's.
- **Recommendation: A.** The mockup's "due today" in red becomes `WidgetCopy.dueToday` in `.secondary`: red stays the overdue colour (shell O8).

**O7. The ring's numbers** (mockup: "3 of 8 done", the arc at about three eighths)
- A. Done today of (done today + open in Today); pending adds count once confirmed, as the popover's "left" and the window's badge. The spec's line, and the ring agrees with the popover.
- B. The same with pending adds in the total. Counts a task the moment it is typed, but disagrees with the popover's count.
- C. The open count in the centre ("5 left") with the arc as done of total. Says what is left, but the ring's label and caption then compete in 158 points.
- **Recommendation: A.**

**O8. A tapped checkbox until the app's next snapshot**
- A. The row turns done in place (filled check, strikethrough), the counts move at once, a second tap reopens it; the app's snapshot then moves it into the done group. Feedback where the pointer is, undo for free, and a truthful trace while the app is quit.
- B. The row moves into the done group at once and the next task slides up. Matches the window's end state, but the row leaves from under the pointer and, with full slots, drops out of sight: a mis-tap cannot be undone from the widget.
- C. A dimmed "sending" row until the app confirms. Honest about the round trip, but a third row look, and it would stay dimmed for as long as the app is quit.
- **Recommendation: A.**

**O9. A snapshot of an earlier day** (the app was quit across midnight)
- A. The prompt, as with no snapshot: `WidgetCopy.noSnapshot`, no checkbox. The snapshot cannot recompute today: tasks due today that were "upcoming" yesterday are not in it.
- B. Yesterday's list dimmed under a "Yesterday" label. Shows something, but a wrong Today with one more string.
- C. Yesterday's list as is. The widget lies until the app runs.
- **Recommendation: A.** ADR 0032 already makes the checkboxes do nothing there.

**O10. Which workspace** (the spec's non-goal: no widget for another workspace than the active one)
- A. Always the app's active workspace; no configuration. One snapshot, as ADR 0032 writes it; ⌘1 to ⌘9 move the widgets with the popover.
- B. An `AppIntentConfiguration` with a workspace picker per widget. One widget per company on the desktop, but a snapshot per workspace, the cache of every workspace loaded, and the spec reopened.
- **Recommendation: A.** Listed for completeness; the spec has it.

**O11. Where the strings both targets show live** (today: `apps/macos/Todz/Copy`, compiled into the app only)
- A. Move the whole `Todz/Copy` folder to `apps/macos/Copy` and list it in the `sources` of both targets in `project.yml`; `WidgetCopy` and `WidgetSampleCopy` join it. One folder for every string of the macOS app, no `public`, no new import, the files move unchanged (they depend only on `Foundation` and `TodzKit`, which the extension links).
- B. A `TodzCopy` library target in the `TodzKit` package that both targets import. A real module boundary, but every enum and member turns `public`, every view adds an import, and the package's purpose (rules and I/O) gains presentation.
- C. A `WidgetCopy` in the extension that repeats the strings it needs. No move, but two sources for "Nothing due today" and "{count} left".
- **Recommendation: A.**

**O12. The widget gallery preview**
- A. The owner's real snapshot when one exists, else the sample of § 1.8. The gallery shows the owner's own day; before the first launch it still shows the mockup's look.
- B. Always the sample. Predictable, and no task title shows in the gallery during a screen share, but the preview never looks like the owner's widget.
- C. The redacted placeholder when there is no snapshot. No sample strings, but grey bars in the gallery, which reads as broken.
- **Recommendation: A.**

**O13. The small widgets' labels** (mockup: `.w-s .lbl` "Today" and "Next up" in the accent)
- A. The accent, as the mockup. The small widgets' one touch of colour, but the accent as text is about 3.4:1 on the dark background, under the shell's rule "the accent is used for fills and symbols, never for text" (shell O8).
- B. `.primary` in `Font.headline`, the same as the list headers. One header style for the four widgets; the accent stays on the arc and the checks, which carry it in every mode.
- C. `.secondary`. Quieter, but the label is the widget's name and reads as a caption.
- **Recommendation: B.**

**Minor calls made by the loop** (reversible; listed for the owner)

| Call | Choice |
|---|---|
| Widget kinds | three: the ring and Next up small only, the list medium and large |
| Gallery names | "Today's Progress", "Next Up", "Today" (Title Case, the gallery's convention); labels inside the widgets stay sentence case, as the mockup |
| Extra-large family | none |
| Signed out, never opened, naming, group missing, unreadable snapshot | one prompt state: the snapshot cannot tell them apart and the app's window says which |
| Switching to a workspace with no Today yet | the app erases the snapshot (prompt) and writes the new one once Today is known, so a widget never shows another workspace's tasks under the active one |
| Next up after its checkbox | moves on to the next task at once; undo lives in a list widget or the app |
| Offline, or a request waiting for a quit app | no marker in the widgets |
| A deep link to a task no longer in Today | Today with no selection |
| Placeholder labels | `.unredacted()`, so a loading widget still says what it is |
| Ring | two `Circle` strokes, not `Gauge`, so the arc keeps its look in the vibrant and accented modes |
| Titles | one line in the lists, three in Next up, tail truncation |

## 7. Owner decisions

The owner asked the build loop to take every call (2026-11-24, "take every decision and do not stop, I review later"). Each answer below is the loop's call, listed in the loop's questions for the owner, who may overturn it in review.

| Option | Answer | Date |
|---|---|---|
| O1 | C: medium "Today · N left"; large the workspace name and "N left" | 2026-11-24 |
| O2 | A: the ring, headers and empty space open the main window on Today; Next up and a row open that task in the inspector | 2026-11-24 |
| O3 | A: done-today rows fill the slots left, newest first, reopenable | 2026-11-24 |
| O4 | A: medium 3 rows, large 7, no overflow line | 2026-11-24 |
| O5 | A: one line: checkbox, title, the overdue label or (large) the project tag | 2026-11-24 |
| O6 | A: the first open task in Today's order, with checkbox, due caption, tag and "via" | 2026-11-24 |
| O7 | A: done today of (done today + open); pending adds do not count | 2026-11-24 |
| O8 | A: the row turns done in place, counts change at once; a second tap reopens | 2026-11-24 |
| O9 | A: a snapshot of an earlier day shows the "Open todz" prompt | 2026-11-24 |
| O10 | A: always the active workspace, no picker | 2026-11-24 |
| O11 | A: `apps/macos/Todz/Copy` moves to `apps/macos/Copy`, compiled into both targets | 2026-11-24 |
| O12 | A: the gallery shows the real snapshot, else the sample | 2026-11-24 |
| O13 | B: the small widgets' labels in `.primary`, not the accent (contrast; the shell's rule) — the one departure from the mockup | 2026-11-24 |
| Minor calls | as listed in § 6 | 2026-11-24 |

## 8. Every new copy string

**WidgetCopy** (new, `apps/macos/Copy/WidgetCopy.swift`): nextUp "Next up" · dueToday "Due today" · allDone "All done for today" · noSnapshot "Open todz to see what's due today." · progress(done:total:) "**{done} of {total}** done" (Markdown; the strong run is drawn `.primary` and bold, the rest `.secondary`, as the mockup's caption; VoiceOver reads the characters) · ringName "Today's Progress" · ringDescription "How much of today is done." · nextUpName "Next Up" · nextUpDescription "The next task due today, ready to check off." · listDescription "Today's tasks, ready to check off."

**AccessibilityCopy:** todayIn(workspace:) "Today in {workspace}"

**WidgetSampleCopy** (new, `apps/macos/Copy/WidgetSampleCopy.swift`; the gallery and placeholder sample of § 1.8, never shown beside real data): workspace "Personal" · firstTitle "Write tests for OAuth token refresh" · secondTitle "Review the sync conflict PR" · thirdTitle "Renew Apple Developer membership" · fourthTitle "Move the widget timeline to the App Group" · fifthTitle "Draft the launch post" · firstDoneTitle "Record the build-in-public video" · secondDoneTitle "Fix the flaky sign-in test" · apiTag "api" · syncTag "sync" · macAppTag "mac app" · launchTag "launch"
