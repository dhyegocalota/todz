# 0071. The menu bar ribbon unfolds what is next beside the glyph for a few seconds, as template frames, behind a setting off by default

- Status: Accepted (the build loop's call, the owner may overturn it)
- Date: 2026-11-25
- Deciders: Claude (the build loop's call, pending the owner); Dhyego Calota (owner) chose idea 11 from the loop's `proactive-day` list, his own idea: "de tempos em tempos o menu bar pode mostrar algo discreto como se fosse uma faixa expandida ou sei lá; seja criativo"; now and then the status item briefly widens into a quiet ribbon beside the glyph, scrolls once if long, collapses back after a few seconds; the cadence is his choice (hourly, at day-close, or when an agent adds or completes a task); never during Focus; Apple-quiet, a template look on light and dark bars; a frontend-designer pass with options, the loop picks
- Inspired by: [ADR 0065](0065-the-day-temperature-steps-the-menu-bar-count-s-opacity-after-noon-and-washes-overdue-widget-rows-by-age-behind-a-setting.md) (Evidence: the status item drops SwiftUI alpha, so the label is drawn as one template `NSImage` through `ImageRenderer`), [ADR 0054](0054-the-app-learns-focus-through-a-todz-focus-filter-not-the-focus-status-api.md) (the proactive gate and its `.ribbon` kind), [ADR 0055](0055-the-day-closes-once-a-day-in-the-menu-bar-popover-at-the-owner-s-time.md) (the day close's time and its popover), [ADR 0062](0062-the-morning-glance-is-a-non-activating-glass-panel-that-shows-today-on-the-first-wake-or-unlock-of-the-day.md) (a clock-driven surface in the Mac's time zone, skipped while locked), [ADR 0036](0036-the-menu-bar-icon-counts-today-s-open-tasks-behind-a-setting.md) (the count and its accessibility label), [ADR 0031](0031-the-menu-bar-extra-is-a-swiftui-window-over-the-app-s-one-model.md) (the menu bar extra over the app's one model), [ADR 0061](0061-performance-has-written-budgets-a-fetch-based-load-harness-behind-pnpm-perf-and-work-count-budgets-in-verify.md) (work-count budgets)

## Context

The owner wants the menu bar to say, now and then and without a notification, what is left and what is next. The surface is the status item todz already owns: the template glyph, and the open count of Today beside it (ADR 0036), dimmed by the day temperature (ADR 0065).

Three facts constrain it.

1. **The label is an image.** The `MenuBarExtra` label becomes a status-item button, and the day temperature's spike measured that it drops SwiftUI alpha (`.opacity` and `.foregroundStyle(.primary.opacity)` captured identical at every step). The label is therefore drawn by `ImageRenderer` into one template `NSImage`. SwiftUI transitions and animations inside the label never run for the same reason, so any motion must be a sequence of images the app swaps itself.
2. **A wider item moves the bar.** Status items are laid out right to left. When todz widens, every item to its left shifts left by the same width, and on a crowded notched display macOS hides an item that no longer fits. The day temperature's walk found both todz items hidden under the notch on the owner's bar. Width is a cost paid by the owner's other apps, so it must be short, bounded and returned exactly.
3. **The ribbon is proactive.** It shows itself, so it passes the proactive gate (`ProactiveSurface.ribbon` already exists) and is never the first thing to speak while the owner works. The other proactive surfaces skip a locked screen and an open popover, and so does this one.

The owner's newest defaults list (relayed to the loop 2026-11-25, run 19, for `focus-switch-defaults`) turns on the pending count, the agents' mention, the morning glance, the day temperature, the day close at 18:00 and the day mail, and leaves only "Respect Focus" off. It does not name the ribbon, and his earlier rule for the whole `proactive-day` list is "every item an opt-in setting, off by default".

## Decision

1. **A switch, off by default, and a cadence.** Settings gains "Menu bar ribbon", kept in the app's defaults, off by default, beside the other proactive switches, with a cadence picker on the same row: "Every hour", "At the close of the day", "When an agent adds or completes a task". The cadence defaults to every hour. **The default is off**, the loop's call: the owner's newest defaults list names six surfaces and not this one, his standing rule for the list is opt-in, and the ribbon is the only surface that moves other apps' items and draws motion. A stored cadence the app does not know reads as no ribbon (no fallback to a default); the picker shows the default until the owner picks.
2. **What it says.** One line, built from the first open task of Today as the popover lists it, and Today's open count (the same rule as the count, ADR 0036): "3 left · next: T-12 Review PR"; with one left, "Last one: T-12 Review PR"; a task still in the outbox has no number, so its title stands alone. At zero, or while the count is unknown, there is no ribbon. The text is fixed when the ribbon starts.
3. **How it looks.** While it shows, the count is replaced by the ribbon text, drawn with the glyph into one template image (ADR 0065 §3), so the system tints it on light, dark and tinted bars, and the ribbon text is never dimmed by the day temperature. The visible text is at most 180 points wide. The full text is rendered once, at most 420 points wide with a tail ellipsis, and each frame is a crop of that one strip.
4. **How it moves.** The item unfolds over 0.25 s (8 frames at 30 per second, the visible width and the text's alpha growing together), holds, and folds back over 0.25 s. Text that fits holds for 5 s. Text that overflows the 180 points holds 1.5 s, scrolls once to its end at 40 points per second, holds 1.5 s, then folds; the strip cap bounds the scroll at 240 points, so the longest ribbon lasts 9.5 s. With Reduce Motion on, there is no unfolding, no folding and no scroll: the item jumps to its width with the text tail-truncated to 180 points, holds 5 s and jumps back. The timeline is a pure function of the text's width and Reduce Motion, in TodzKit.
5. **When it shows.** Every hour on the hour in the Mac's time zone; or once a day at the close-of-day time the owner set for Close the day (ADR 0055), skipped when Close the day is on, because its popover says the same thing louder; or when a pull applies a change from elsewhere to Today: a task an agent created that is open and due today or earlier, or a task of Today that arrives done. The agent cadence waits 3 s for a burst to settle and shows at most once every 10 minutes; a change inside that window is dropped, not queued. The first pull of a project, a pull from the start, a workspace switch and the app's own writes never count. One wait to the next boundary on the continuous clock, as `DayCloseScheduler` does; a boundary missed asleep is not replayed.
6. **When it never shows.** With the switch off; at zero; while the screen is locked; while the popover is shown; while another ribbon is showing (the new one is dropped). Opening the popover, turning the switch off, or the gate turning quiet ends a ribbon at once, without the fold. A cadence that fires while the gate is quiet asks `admit(.ribbon)`, is held, and shows once when the gate releases it (`claimRelease(.ribbon)`), with the text of that moment.
7. **Focus is the gate's, not the ribbon's.** The ribbon reads only `ProactiveGate`. It carries no Focus copy of its own. `focus-switch-defaults` replaces the per-feature Focus copy with one "Respect Focus" switch, off by default, that decides whether the gate goes quiet; under it, "never during Focus" holds while Respect Focus is on, which is the owner's newer call and governs this ADR.
8. **The fallback is decided now.** The first build step is a spike in a scratch target, not committed. If it shows that the label does not take a new image per frame at 20 per second or more, or that the frames visibly tear, the ribbon drops the motion for everyone: the Reduce Motion presentation of §4 becomes the only one. If the widened item leaves the screen on the spike's bar at a 180-point window, the window becomes 120 points. Either result amends this section with the evidence; neither supersedes the ADR.

    **Amendment, 2026-11-25 (the loop's call, after the spike):** the unfold and the fold reveal inside a fixed width. The item takes its full ribbon width in one resize when the ribbon starts (the first frame is already that wide, the glyph in place and an empty strip), the text then reveals inside that width over 0.25 s with cropped frames at growing alpha, scrolls once if long, hides inside the same width, and one resize returns the item to the count's width on the last frame. No frame changes the window's width, so the window and its image never disagree; §4's "the visible width and the text's alpha growing together" reads "the revealed text and its alpha growing together". The frame rate, the scroll, the 180 points and the Reduce Motion presentation are unchanged. The evidence is in the spike below.
9. **Accessibility.** While it shows, the item's accessibility label is the ribbon line ("todz, 3 left today. Next: T-12 Review PR"); otherwise ADR 0036's. VoiceOver is not interrupted with an announcement: the ribbon is a glance, and the popover carries the same line. Increase Contrast changes nothing, because the ribbon text is already drawn at full alpha. Reduce Motion is §4.
10. **Budgets.** A ribbon draws at most 285 frames (9.5 s at 30 per second), each a crop of one rendered strip, and renders the strip once. Between ribbons the app holds one wait. Agent changes cost one comparison per task a pull applies.

## Alternatives considered

The shape, from the frontend-designer pass (`docs/features/menu-bar-ribbon/design.md`):

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| A ribbon that unfolds beside the glyph for seconds (chosen) | the owner's own image of "uma faixa expandida"; says what is next; gone in seconds; one template image | moves the items to its left while it shows; may be hidden on a crowded notched bar | — |
| A progress sliver under the glyph | no width change; always there | says no task; a permanent bar reads as a download or a battery; a 2-point shape is below what a template keeps legible | carries no "next", and it is not "now and then" |
| A one-line ticker, always on, cycling tasks | always informative | permanent width taken from other apps; permanent motion | the opposite of Apple-quiet |
| The count morphs into the next number ("6" becomes "T-12") | almost no width | a number alone means nothing without the title | does not say what is next |

How it is drawn:

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| Template frames swapped in the `MenuBarExtra` label (chosen) | keeps ADR 0031's one menu bar extra; the same path as the day temperature; testable timeline | the app drives every frame | — |
| SwiftUI animation inside the label | declarative | the label is an image; transitions do not run (ADR 0065 Evidence) | does not work |
| An `NSStatusItem` with a Core Animation view | smooth system animation | replaces the `MenuBarExtra` and its popover, which ADR 0031 and the day close depend on | too large for a glance |
| A second, temporary status item | the todz item never changes | a new item appears at the far left of the status items, not beside the glyph | not beside the glyph |
| A panel under the menu bar | no width cost | that is the morning glance's surface (ADR 0062), not the menu bar | not the menu bar |

The default and the cadence:

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| Off, cadence hourly (chosen) | the owner's standing rule; nothing moves on his bar until he asks | he must find it | — |
| On, like the newest defaults | discoverable | his newest list does not name it, and it is the one surface that moves other apps' items | not his call yet |
| Agent changes as the default cadence | the agentic part of todz | bursty; quiet only through a cooldown | hourly is the calmer default |
| Several cadences at once | flexible | three switches on one row for a glance | one picker is enough; revisit if he asks |
| Queue an agent change inside the cooldown | nothing is missed | a ribbon arrives minutes after its cause | a stale glance is noise |

## Consequences

- For up to 9.5 s at a time, the items to the left of todz move left by the ribbon's width and return to the same place; on a crowded notched bar the todz item may be hidden while it is wide, as it may already be hidden at rest.
- A task record carries its creator but no completer, so a completion from the owner's other Mac also counts as "an agent completed a task". A `completedBy` on the server would narrow it; it is not part of this feature.
- An emoji in a title is drawn as a silhouette, because the template keeps alpha only.
- The ribbon draws in the bar's own colour; there is no accent and no brand colour in the menu bar.
- No server, sync, widget or schema change; rolling back removes the switch and its two keys stay unread in the defaults.

## Evidence

Measured on 2026-11-25 on the owner's Mac (macOS 26.6, a 14-inch notched display, 1512 points wide), by a scratch `MenuBarExtra` app outside the repository, not committed: its label swapped template `NSImage` frames of a glyph and a 420-point strip "3 left · next: T-12 Review the onboarding copy before Friday's release", on the §4 timeline (unfold, hold, scroll, hold, fold; 198 frames, 9.5 s). Three full runs of 9.5 s; two earlier launches crashed 1.5 s in, in the harness's own window lookup, before any frame. No popover was opened and no appearance, Focus or accessibility setting changed.

| Measure | Result |
|---------|--------|
| Frames handed to the label | 198 of 198 in every run |
| Images the status button held, sampled every 2 ms | 199 distinct (the 198 frames and the image at rest) in every run: none dropped |
| Images that landed during the 6 s scroll | 179 of 180, 29.9 per second |
| Window width, sampled every 2 ms | 10 distinct values from 34 (rest) to 222 (glyph, spacing and 180 points); back at 34.0 exactly after every run |
| Window right edge while it grew | fixed at 764; the left edge moved from 730 to 542, so the items to the left shift by exactly the ribbon's width |
| Torn frames, steady width | none in the captures at 1.0 s (hold) and 2.5 s (scroll): the glyph whole, the text continuous, 444 px wide; the captures from 4 s on resolved another window (the harness found the item by diffing the window list) and are discarded |
| Torn frames, while the width changes | two of two: the captures asked for at 0.09 s and 0.2 s, in the unfold, show the item's window at 199.5 and 222 points with its image shifted left, the glyph missing in one and cut at the edge in the other, while the same image sits whole in the steady captures; the window's width and its image's width were out of step for a frame |
| Item inside the screen at 180 points | the window's bounds stayed inside the screen (542 to 764 of 1512) |
| CPU over a 9.7 s run | 4.8 %, 5.0 % and 5.4 % of one core, with the harness polling the main thread at 500 Hz and the frames composed beforehand; an upper bound for the label's 30 Hz |
| Longest gap between two hand-overs | 1.5 s, the holds; 48 ms mean |

Verdict: **frame rate and the width pass, the unfold and fold are not cleared**. At least 20 frames per second land (29.9 during the scroll) and the width returns exactly; the 7.5 s of steady width (hold, scroll, hold) captured clean. The 0.5 s of unfold and fold, where the item's window changes width on every frame, showed the window and the image a frame apart in both captures taken there, and the budget of three runs is spent, so whether a person sees it is not measured. §8 is not applied by the developer: the lead decides between a bounded fourth run on the unfold alone, the Reduce Motion presentation for everyone (§8), or an unfold that sets the window to its full width once and reveals inside it, which removes the per-frame resize and keeps the scroll. The window stays 180 points. The lead chose the third: §8's amendment. The one-resize design rests on the steady-width captures, which were clean for 7.5 s of the run, and it is the same state the hold already proved; the resize at the start and at the end are the only two width changes left, each followed by a steady frame. It was not re-measured: the three runs are spent, and the walk's captures of the first and last frame check it.

What the spike could not measure, and why:

- **The item was hidden on the owner's bar.** At rest (x 730 to 764) the todz item sits inside the notch's span (about 656 to 856), and the window list flagged it not on screen at rest and at every width of the run; every item to its left was hidden too, so there was no visible neighbour to the left to compare, and the owner would see nothing of a ribbon while his bar stays this crowded. This is the situation ADR 0065's walk found. §6 keeps its consequence line; the ribbon is for a bar with room.
- **The popover's anchor** was not measured, because no popover was opened. The width and the right edge return exactly, and the anchor follows the item's frame at the click, so the plan's `end()` on the panel's show, before it anchors, stays the design and the walk checks it by hand.
- **The per-frame crop's cost** is not in the CPU figure: the frames were composed before the clock started.

## Revisit when

The owner turns the ribbon on and asks for a different line or length; the server records who completed a task; macOS stops honouring a status item's image changes at frame rate; the owner wants several cadences at once; or a design system is recorded that names a menu bar treatment.
