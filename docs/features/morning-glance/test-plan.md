# Test plan: Morning glance

Every checkbox states the input and the exact expected outcome. A ticked box carries evidence after ` — evidence: ` (commit hash, log path, counts, screenshot path).

Pinned strings (`design.md` § 8): heading `Today` with `<N> left`; overdue `Overdue`; the rest `+<N> more`; tooltip `Open Today in todz`. VoiceOver: announcement `todz, <N> left today`; element `Today, <N> left`, hint `Opens Today in the todz window.` Settings: `Morning glance`, detail `On the first wake or unlock of each day, todz shows Today for a few seconds.`, off by default. Defaults keys: `showsMorningGlance`, `lastMorningGlanceDay`.

## The failing test first

- [ ] `MorningGlancePreferenceTests`, `MorningGlanceDwellTests`, `MorningGlanceFrontTests` and `AppModelTests+MorningGlance` at Step 1's red commit, each run alone with `--filter` — expected: each stops on `<name> is not implemented`, the texts `tester-briefing.md` records
- [ ] `MorningGlanceCoordinatorTests` and `DayCloseCoordinatorTests/isDueAndIdle…` at Step 3's red commit, run alone — expected: each stops on a stub's `… is not implemented`, as the briefing records
- [ ] The printed texts match the briefing row for row, run serially (`--no-parallel`), since a parallel run can hit a different stub first (day-close E3)

## Unit

### Preference

- [ ] Registered defaults — input: an empty suite, `registerDefaults(in:)` — expected: `isOn` false, `lastShownDay` nil
- [ ] Registering keeps a choice — input: `showsMorningGlance` true stored, then `registerDefaults(in:)` — expected: `isOn` true
- [ ] A shown day reads back — input: `markShown(day: 2026-11-25)` — expected: `lastShownDay` 2026-11-25 and the stored string `2026-11-25`
- [ ] An unreadable day — input: `lastMorningGlanceDay` = `yesterday` — expected: `lastShownDay` nil

### Content

- [ ] Not known — input: Today loading, and signed out — expected: `morningGlanceContent` nil in both
- [ ] Empty — input: Today known, no open task — expected: `openCount` 0, `rows` empty, `restCount` 0
- [ ] One — input: one open task due today — expected: one row with its title, `isOverdue` false, `restCount` 0
- [ ] Five — input: five open — expected: five rows, `restCount` 0
- [ ] Seven — input: seven open — expected: the first five in Today's order, `restCount` 2, `openCount` 7
- [ ] Overdue — input: an open task due 2026-11-24 on 2026-11-25 — expected: its row `isOverdue` true
- [ ] Pending — input: two open tasks and one pending (not saved yet) — expected: `openCount` 2, two rows, equal to `todayHeadingCount`
- [ ] Workspace — input: the active workspace `acme` — expected: `workspaceIdentifier` `acme`
- [ ] Two reads across midnight — input: a task due 2026-11-25, read at 2026-11-25 23:59 and at 2026-11-26 00:01 — expected: `isOverdue` false, then true

### Dwell

- [ ] Shown at T — expected: `fadeStart` T + 5 s
- [ ] Hovered at T + 3 s — expected: no `fadeStart` while hovered
- [ ] Left at T + 10 s — expected: `fadeStart` T + 15 s
- [ ] Hovered again at T + 12 s, left at T + 20 s — expected: `fadeStart` T + 25 s
- [ ] Hovered from T + 1 s and never left — expected: `fadeStart` T + 30 s (the cap)
- [ ] Left at T + 28 s — expected: `fadeStart` T + 30 s, not T + 33 s
- [ ] Fade — input: `fadeDuration(reducesMotion: false)` / `(reducesMotion: true)` — expected: 0.5 s / 0
- [ ] Pointer grace — expected: `pointerGrace` 0.4 s

### Front

- [ ] Every input false — expected: `isInFront` false
- [ ] `isDayCloseDue` alone, `isClosingDay` alone, `isPopoverShown` alone — expected: true each
- [ ] `isApplicationActive` alone, `hasVisibleMainCapableWindow` alone — expected: false each; both — expected: true

### The day close's new property

- [ ] `DayCloseCoordinator.isDueAndIdle` — input: due, no click in flight / due, 2 s after a click / closed today / off — expected: true / false / false / false; `check()` behaves as before (the existing suite green)

### Coordinator (America/Sao_Paulo, the harness clock at 2026-11-25 08:00, on, 3 open, unlocked, not mirrored, not in front, unless stated)

- [ ] Off — input: the switch off, `check()` — expected: 0 attempts, `lastMorningGlanceDay` absent
- [ ] First chance — input: `check()` — expected: 1 showing, `lastMorningGlanceDay` 2026-11-25
- [ ] Once a day — input: a second `check()` at 13:00 after `dismissed()` — expected: still 1 showing
- [ ] The next day — input: `check()` at 2026-11-26 07:30 — expected: 2 showings, `lastMorningGlanceDay` 2026-11-26
- [ ] Nothing open — input: 0 open, `check()` — expected: 0 attempts, `lastMorningGlanceDay` 2026-11-25
- [ ] Today arrives in time — input: nil at 08:00 `check()`, then the fake mutated to 2 open at 08:00:30 — expected: 1 showing, marked
- [ ] Today arrives late — input: nil at 08:00 `check()`, then the fake mutated to 2 open at 08:01:01 — expected: 0 attempts, `lastMorningGlanceDay` absent (the observation continues the 08:00 chance, never a new one)
- [ ] Signed out — input: nil throughout, `check()` — expected: 0 attempts, absent
- [ ] The day close due — input: `isTodayInFront` true because the day close is due and idle, `check()` — expected: 0 attempts, marked 2026-11-25
- [ ] Today in front — input: `isTodayInFront` true, `check()` — expected: 0 attempts, marked 2026-11-25
- [ ] Mirrored — input: `isScreenMirrored` true, `check()` — expected: 0 attempts, absent; then not mirrored and `check()` — expected: 1 showing
- [ ] Locked — input: locked, `check()` — expected: 0 attempts, absent; then unlocked and `check()` — expected: 1 showing, marked
- [ ] Unlock not delivered — input: locked `check()`, then unlocked and `retryLockedChance()` — expected: 1 showing; `retryLockedChance()` with no locked chance (after "Today arrives late") — expected: 0 attempts
- [ ] Locked across midnight — input: locked `check()` at 23:50, unlocked and `check()` at 2026-11-26 07:00 — expected: 1 showing, marked 2026-11-26
- [ ] Locked inside the show — input: the fake panel locks the fake screen in `whileShowing` and answers true — expected: 1 closing, `lastMorningGlanceDay` absent, `isShowing` false
- [ ] Held — input: `gate.applyLaunchRead(isQuiet: true)`, `check()` — expected: 0 attempts, absent
- [ ] Released the same day — input: held at 08:00, `setQuiet(false)` at 09:30 — expected: 1 showing, marked 2026-11-25
- [ ] Released on a later day — input: held at 23:50, `setQuiet(false)` at 2026-11-26 00:10 with no chance on the 26th — expected: 0 attempts, `gate.released` without `.morningGlance`
- [ ] Held day moved forward — input: held at 2026-11-25 08:00, a second `check()` at 2026-11-26 07:00 still quiet, `setQuiet(false)` at 2026-11-26 09:00 — expected: 1 showing, marked 2026-11-26
- [ ] Released while locked — input: held, then locked, `setQuiet(false)` — expected: 0 attempts, absent; unlocked and `check()` — expected: 1 showing
- [ ] Released with nothing open — input: held, then the fake mutated to 0 open, `setQuiet(false)` — expected: 0 attempts, marked 2026-11-25
- [ ] Not seen — input: the panel answers false, `check()` — expected: 1 attempt, absent, `isShowing` false; the next `check()` with the panel answering true — expected: 2 attempts, marked
- [ ] Re-entrant — input: `showPanel` calls `check()` before answering — expected: 1 attempt, marked once
- [ ] On screen — input: shown, then `check()` before `dismissed()` — expected: still 1 attempt
- [ ] The popover during the show — input: `popoverShown()` called from `whileShowing`, the panel answers true — expected: 1 closing right after the answer, marked 2026-11-25, `isShowing` false
- [ ] In front during the show — input: `isTodayInFront` turns true in `whileShowing` — expected: 1 closing right after the answer, marked
- [ ] The popover shows — input: shown, `popoverShown()` — expected: 1 closing, `lastMorningGlanceDay` still 2026-11-25; with nothing shown — expected: 0 closings
- [ ] `closeNow()` (the lock and sleep observers) — input: shown, `closeNow()` — expected: 1 closing, `isShowing` false; with nothing shown — expected: 0 closings
- [ ] Signed out while shown — input: shown, the fake mutated to nil — expected: 1 closing
- [ ] Workspace switched while shown — input: shown, the fake mutated to another `workspaceIdentifier` — expected: 1 closing; the same workspace with one more task — expected: 0 closings
- [ ] Midnight during the show — input: `check()` at 23:59:59, the clock moves to 2026-11-26 00:00:01 inside `showPanel` — expected: `lastMorningGlanceDay` 2026-11-25; a `check()` after `dismissed()` — expected: 2 showings, 2026-11-26
- [ ] The zone's day — input: the instant 2026-11-25 16:00 UTC (2026-11-26 01:00 in Asia/Tokyo, 13:00 in America/Sao_Paulo), `lastMorningGlanceDay` 2026-11-25 — expected: the Tokyo harness shows 1, the São Paulo harness shows 0
- [ ] The shown content — input: 7 open — expected: `showPanel` receives `openCount` 7, 5 rows, `restCount` 2
- [ ] `swift test --package-path apps/macos/TodzKit` green, count recorded; `xcodegen generate` and Debug `xcodebuild` print `BUILD SUCCEEDED` with no `warning:` or `error:` line

## Prove it for real

Orca (ADR 0026), the Debug build against a local `wrangler dev` with a seeded workspace, the app folders backed up with `ditto` and `shasum` listings first and restored after. The trigger is a launch: `open -g -j` after deleting `lastMorningGlanceDay` from the app container's defaults.

**Budget: at most two panel showings per walk** (Showing 1 and Showing 2). Every other launch below must show nothing; a panel where none is expected is a FAIL that ends the walk. A re-walk after a fix is a new walk with a fresh budget of two. Before each launch, record the frontmost app.

Two background samplers, scripts in the scratchpad, started before each showing and stopped after: one writes the frontmost app's bundle identifier every 100 ms (`lsappinfo front` or `NSWorkspace.shared.frontmostApplication` from a scratch Swift script); one writes todz's windows from `CGWindowListCopyWindowInfo` every 50 ms (layer, bounds, `kCGWindowIsOnscreen`, alpha).

- [ ] Settings, fresh defaults — expected: `Morning glance` off with its detail, after the Close the day row; the window grows by exactly one row with two reserved detail lines against `main` (the Close the day row's height again), nothing clipped; turned on — expected: `showsMorningGlance = 1`, no panel appears, the height unchanged; screenshots light and dark
- [ ] No-show, off — input: the switch off, 3 open, `lastMorningGlanceDay` absent, hidden launch — expected: no panel in 15 s, `lastMorningGlanceDay` still absent
- [ ] No-show, nothing open — input: on, Today empty, hidden launch — expected: no panel in 15 s, `lastMorningGlanceDay` today
- [ ] Showing 1 — input: on, seven open Today tasks (one overdue, one with a title longer than the row), `lastMorningGlanceDay` absent, another app frontmost, hidden launch, the pointer away from the top right — expected: a panel 280 wide at the top right of the screen with the menu bar, under it; heading `Today` with `7 left`; five rows, the overdue one ending `Overdue`, the long one truncated on one line; `+2 more`; one screenshot
- [ ] Showing 1, the window — expected from the window sampler: one todz window at layer 25 (the status bar level), from its first listing to `kCGWindowIsOnscreen` true within 1 s (the occlusion timing, recorded in milliseconds for ADR 0062's Evidence), gone between 5 and 7 s after it went on screen, its alpha stepping down over about 0.5 s before it goes
- [ ] Showing 1, focus — expected from the frontmost sampler: the same bundle identifier on every line from before the launch to after the panel is gone; todz never frontmost
- [ ] Showing 1, the mark — expected: `lastMorningGlanceDay` today; the app still running; no new crash report
- [ ] The same day, relaunch — input: quit, hidden launch — expected: no panel in 15 s
- [ ] Showing 2 — input: `lastMorningGlanceDay` deleted, three open, a scratch TextEdit document frontmost with its text focused, hidden launch; the pointer moved onto the panel within 3 s of it showing and held there — expected: at 8 s still shown (the hover)
- [ ] Showing 2, accessibility — with the pointer held — expected: Orca reads the panel as one element `Today, 3 left` with the three titles in its value and the hint `Opens Today in the todz window.`; its window's subrole recorded as read (a floating or system floating window, never a standard window); todz's focused window is none; the announcement itself is BLOCKED unless VoiceOver runs, recorded as such
- [ ] Showing 2, a typed key — with the pointer held — expected: `x` typed lands in the TextEdit document; the frontmost sampler shows TextEdit throughout
- [ ] Showing 2, the click — input: a click on the panel — expected: the panel gone at once, todz frontmost, the main window with Today selected, `lastMorningGlanceDay` today. Afterwards the tester re-activates the app that was frontmost before the walk and records it. If Orca cannot hold a hover, the click alone, and the hover goes to the Human checklist
- [ ] Screenshots at `docs/screenshots/morning-glance/` (the glance, and Settings); extra media and the sampler logs at `.pr-media/morning-glance/`

## Human checklist (the owner, on his own Mac, not walked by an agent)

- [ ] The first unlock of a morning with the switch on and open tasks shows the glance once (proves `com.apple.screenIsUnlocked` reaches the sandboxed app, or the app switch retry)
- [ ] A wake from sleep without a password shows it; with a password it waits for the unlock
- [ ] Locking the screen while the panel shows: after the unlock it is gone
- [ ] A Focus with the todz filter at the first chance holds it; ending the Focus the same day shows it once
- [ ] With Reduce Motion on, the panel disappears without a fade
- [ ] With VoiceOver on, `todz, <N> left today` is spoken when it shows
- [ ] The Mac's time zone changed to one where it is already tomorrow, then a lock and unlock — the glance shows for the new day
- [ ] The day close due on the same wake: only the popover appears
- [ ] Mirroring the display to a projector, then a lock and unlock: no glance; after mirroring ends, the next unlock shows it
- [ ] A click on the app beneath the exact moment the panel appears lands in that app

## Edge cases found during execution

Empty on purpose. The tester adds one checkbox per new case (input, exact expected outcome) and a regression test for each.

## Adversarial review

The reviewer picks the three claims most likely to be wrong and tries to refute each.

- [ ] Claim 1: <claim> — attack: <how>; result: <refuted | held>
- [ ] Claim 2: <claim> — attack: <how>; result: <refuted | held>
- [ ] Claim 3: <claim> — attack: <how>; result: <refuted | held>

## Coverage honesty

- The panel's traits (never key or main, non-activating, the status bar level, the occlusion wait, the pointer grace, the tracking area) live in the app target, which has no unit tests: they are proven only by the walk's samplers and the accessibility read, once each.
- A real lock, unlock and wake are not walked: they would lock the owner's Mac. The unit tests cover the decisions; the Human checklist covers the signals.
- A real Focus and a real mirror set are not walked: they would change the owner's Focus and displays. The coordinator's tests cover them.
- The macOS 14 and 15 material fallback is built but not seen: the only Mac runs macOS 26 or later.
- Several displays, full-screen apps and Stage Manager are not walked.
- The fade's look is seen once in Showing 1; Reduce Motion is a Human checklist row.
