# Tester briefing: day-temperature

## G2 (widgets, Step 19)

### What changed and where

- `apps/macos/TodzWidgets/Views/OverdueWashBackground.swift`: a view modifier (`overdueWash(task:widgetDay:isShown:)`) that draws a `RoundedRectangle` behind a view. The opacity comes from `OverdueWash.opacity(of:on:isShown:isContrastIncreased:)`; the colour is `Color.red` in `.fullColor` and `Color.primary` in `.vibrant` and `.accented`.
- `TodayListView` applies it to `WidgetTaskRow` only (rows with a key); `WidgetPendingRow` is untouched.
- `NextUpTask` applies it to its own content only (the header stays outside), and only when the task has a key.
- `TodayEntry.showsDayTemperature` reads the snapshot flag; no new timeline entries, `TodayTimelineProvider` unchanged.
- No new TodzKit code and no new unit tests: the wash logic is `OverdueWash`, already covered by G1's tests. Nothing is red today and green after.

### Hypotheses for the tester

1. With the snapshot flag true, an open overdue row in the medium and large Today list shows a wash the full row width and the row's height, with the layout unmoved.
2. The wash deepens by days overdue: 1 day 0.06, 2 to 6 days 0.09, 7 days or more 0.12 (the bands of `OverdueWash`).
3. Done rows, open rows not overdue and pending rows show no wash.
4. With the flag false, no row shows a wash.
5. With Increase Contrast on, no wash is drawn.
6. In `.fullColor` the wash is red; in `.vibrant` and `.accented` it is `Color.primary` at the same opacity and never reads as a grey band that hides the title.
7. On the small widget the wash sits behind the task block only, not behind the "Next up" header; a pending next-up task has none.
8. The due words stay legible over the 7-day-or-older wash.

### Seeing the wash without the owner's desktop

Do not place widgets on the desktop. Render the views offscreen: in the scratchpad, a scratch target or test host that builds `TodayListView(entry:)` and `NextUpView(entry:)` with a `TodayEntry` whose snapshot has `showsDayTemperature: true` and overdue open tasks (see `TodayEntry+Sample.swift`), wraps them with `.environment(\.widgetRenderingMode, ...)` and `.environment(\.colorSchemeContrast, ...)`, and saves an `ImageRenderer` PNG for each mode. `OverdueWashBackground` can also be rendered alone over a fixed row for the three modes.

### Gaps

- No automated proof of the drawing: the build and the walk are the proof (plan Step 19, no unit target).
- I did not render any capture; the hypotheses above are unverified.
- The corner radius (8) is a constant in `OverdueWashBackground.swift`; the spec gives no value, so the tester judges it against the row.
