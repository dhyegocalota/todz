# Test plan: Day close

Every checkbox states the input and the exact expected outcome. A ticked box carries evidence after ` — evidence: ` (commit hash, log path, counts, screenshot path).

Pinned strings (`design.md` § 8): heading `Close the day` with `<N> left`; row actions `Done`, `Tomorrow`, `No date` (help `Removes the due date. The task stays open. (N)`); results `Due tomorrow`, `No due date`; end state `Day closed` / `Nothing left for today.`; VoiceOver `Close the day, <N> left`, `Move <title> to tomorrow`, `Remove the due date from <title>`. Settings: `Close the day`, detail `At this time each day, todz opens on what's left of Today.`, picker label `Time to close the day`, default 18:00.

## The failing test first

- [ ] `DayCloseScheduleTests` and `DayClosePreferenceTests` at the red commit, each run alone with `--filter` — expected: each stops on `<name> is not implemented`
- [ ] `AppModelTests+DayClose` at its red commit — expected: each stops on its stub or fails on its assertion, as `tester-briefing.md` records
- [ ] The printed texts match the briefing row for row

## Unit

- [ ] Off — expected: `.off`
- [ ] On, 17:00 with the time 18:00 — expected: `.notYet` with next today 18:00
- [ ] 18:00 and 21:00, not closed today — expected: `.due`
- [ ] Closed today, 21:00 — expected: `.doneToday` with next tomorrow 18:00
- [ ] Missed: 23:59 not closed — expected: `.due`; 00:01 the next day — expected: `.notYet` (yesterday's is not carried over)
- [ ] The time moved to 20:00 after closing today at 18:00 — expected: `.doneToday`
- [ ] Turned on at 19:00, not closed today — expected: `.due`
- [ ] DST in America/New_York: 2026-03-08 and 2026-11-01 with the time 18:00 — expected: due at the wall-clock 18:00 each day; the time 02:30 on 2026-03-08 (inside the spring-forward gap) — expected: due at 03:30, the first instant after it
- [ ] Preference defaults: off and 1080 minutes (18:00); registering keeps a stored choice
- [ ] Coordinator, due with the count nil (loading) — expected: nothing opens, nothing marked; the count becomes 2 — expected: opens, `lastClosedDay` today
- [ ] Coordinator, due while signed out — expected: nothing opens, nothing marked
- [ ] Coordinator, due with 0 open — expected: nothing opens; `lastClosedDay` today
- [ ] Coordinator, the opener returns false — expected: nothing marked, the mode cleared; a later check that day opens
- [ ] Coordinator, quiet from the launch read, due at 18:00 — expected: held; released at 18:20 — expected: opens, marked; released at 00:10 the next day — expected: nothing opens, `claimRelease(.dayClose)` consumed it
- [ ] Linger: Tomorrow and No date — expected: the row shows `Due tomorrow` / `No due date` for 1 s, then leaves (red-first in `CompletionLingers`' tests)
- [ ] Pins (green when they land): the mode's Done completes, Tomorrow sets tomorrow's date, No date clears the date, one write each
- [ ] Day closed — expected: shows when the mode is on, Today's open list is empty and nothing lingers; "Done today" hidden in the mode
- [ ] Leaving the mode (the popover window not visible) — expected: the next opening shows the usual Today
- [ ] Many: 12 open Today tasks — expected: `12 left`, the list scrolls inside the 360-wide popover
- [ ] Offline at the time with 2 open in the cache — expected: opens on the cached rows; an action is queued and shows its result
- [ ] `swift test --package-path apps/macos/TodzKit` green, count recorded; Debug `xcodebuild` succeeds

## Prove it for real

Orca (ADR 0026), the Debug build launched with `open -g -j` against a local `wrangler dev` with a seeded workspace. The popover appears on the owner's screen: at most two openings in the whole walk.

- [ ] Settings: `Close the day` off, the time 18:00, the picker dimmed while off; turn on — expected: enabled; window height unchanged — screenshots light and dark
- [ ] Opening 1: the time set one minute ahead with three open Today tasks (one overdue) — expected: the popover opens by itself, heading `Close the day` with `3 left`, each row with `Done`, `Tomorrow`, `No date`, nothing focused, no add field; act once with each — expected: `Done`, `Due tomorrow`, `No due date` for 1 s, then the row leaves; the last one shows `Day closed` / `Nothing left for today.` and the popover closes after about 2 s — screenshot of the mode
- [ ] The server agrees: the first task done, the second due tomorrow, the third with no due date and still open
- [ ] The same day, quit and relaunch — expected: nothing opens (once a day)
- [ ] Opening 2: click the status item — expected: the usual Today, no action buttons
- [ ] The launch in the walk is hidden (`open -g -j`) — expected: the popover still becomes visible at the time (`unhideWithoutActivation`)
- [ ] Keys in the mode, during opening 1: D on a focused row — expected: done; Escape — expected: the popover closes; ⌘N — expected: nothing
- [ ] Accessibility tree: each row's buttons read `Mark <title> as done` (the design's label for Done), `Move <title> to tomorrow`, `Remove the due date from <title>`; the opening announcement is not readable from the tree: BLOCKED unless VoiceOver runs, and recorded as such
- [ ] Screenshots at `docs/screenshots/day-close/`; extra media at `.pr-media/day-close/`

## Edge cases found during execution

Empty on purpose. The tester adds one checkbox per new case (input, exact expected outcome) and a regression test for each.

## Adversarial review

The reviewer picks the three claims most likely to be wrong and tries to refute each.

- [ ] Claim 1: <claim> — attack: <how>; result: <refuted | held>
- [ ] Claim 2: <claim> — attack: <how>; result: <refuted | held>
- [ ] Claim 3: <claim> — attack: <how>; result: <refuted | held>

## Coverage honesty

- A day close held by a real Focus is proven by the gate's unit tests, not walked: it would change the owner's Focus.
- Sleep through the time is proven by the schedule's tests and the wake re-check, not by sleeping the owner's Mac.
