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
- [ ] A DST-change day in a zone that has one — expected: the wall-clock 18:00 that day
- [ ] Preference defaults: off and 18:00; registering keeps a stored choice
- [ ] Day-close mode with three open Today tasks — expected: the three rows; Done completes, Tomorrow sets tomorrow's date, No date clears the date (one write each)
- [ ] A due day close with nothing open — expected: nothing opens; the day is marked closed
- [ ] Held during quiet and released the same day — expected: shown then; released after midnight — expected: dropped
- [ ] `lastClosedDay` set only when the popover opened
- [ ] Leaving the mode — expected: the next opening shows the usual Today
- [ ] `swift test --package-path apps/macos/TodzKit` green, count recorded; Debug `xcodebuild` succeeds

## Prove it for real

Orca (ADR 0026), the Debug build launched with `open -g -j` against a local `wrangler dev` with a seeded workspace. The popover appears on the owner's screen: at most two openings in the whole walk.

- [ ] Settings: `Close the day` off, the time 18:00, the picker dimmed while off; turn on — expected: enabled; window height unchanged — screenshots light and dark
- [ ] Opening 1: the time set one minute ahead with three open Today tasks (one overdue) — expected: the popover opens by itself, heading `Close the day` with `3 left`, each row with `Done`, `Tomorrow`, `No date`, nothing focused, no add field; act once with each — expected: `Done`, `Due tomorrow`, `No due date` for 1 s, then the row leaves; the last one shows `Day closed` / `Nothing left for today.` and the popover closes after about 2 s — screenshot of the mode
- [ ] The server agrees: the first task done, the second due tomorrow, the third with no due date and still open
- [ ] The same day, quit and relaunch — expected: nothing opens (once a day)
- [ ] Opening 2: click the status item — expected: the usual Today, no action buttons
- [ ] Accessibility tree: the row buttons carry their labels; the announcement on opening (read from the tree or the log)
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
