# Test plan: Morning glance

Every checkbox states the input and the exact expected outcome. A ticked box carries evidence after ` — evidence: ` (commit hash, log path, counts, screenshot path).

Pinned strings (`design.md` § 8): heading `Today` with `<N> left`; overdue `Overdue`; the rest `+<N> more`; tooltip `Open Today in todz`. VoiceOver: announcement `todz, <N> left today`; element `Today, <N> left`, hint `Opens Today in the todz window.` Settings: `Morning glance`, detail `On the first wake or unlock of each day, todz shows Today for a few seconds.`, off by default. Defaults keys: `showsMorningGlance`, `lastMorningGlanceDay`.

## The failing test first

- [ ] `MorningGlancePreferenceTests`, `MorningGlanceDwellTests` and `AppModelTests+MorningGlance` at Step 1's red commit, each run alone with `--filter` — expected: each stops on `<name> is not implemented`, the texts `tester-briefing.md` records
- [ ] `MorningGlanceCoordinatorTests` at Step 3's red commit, run alone — expected: each test stops on a `MorningGlanceCoordinator` stub's `… is not implemented`, as the briefing records
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

### Dwell

- [ ] Shown at T — expected: `fadeStart` T + 5 s
- [ ] Hovered at T + 3 s — expected: no `fadeStart` while hovered
- [ ] Left at T + 10 s — expected: `fadeStart` T + 15 s
- [ ] Hovered again at T + 12 s, left at T + 20 s — expected: `fadeStart` T + 25 s

### Coordinator (São Paulo, the harness clock at 2026-11-25 08:00 unless stated)

- [ ] Off — input: the switch off, 3 open, `check()` — expected: 0 showings, `lastMorningGlanceDay` absent
- [ ] First chance — input: on, 3 open, `check()` — expected: 1 showing, `lastMorningGlanceDay` 2026-11-25
- [ ] Once a day — input: a second `check()` at 13:00 — expected: still 1 showing
- [ ] The next day — input: `check()` at 2026-11-26 07:30 — expected: 2 showings, `lastMorningGlanceDay` 2026-11-26
- [ ] Nothing open — input: 0 open, `check()` — expected: 0 showings, `lastMorningGlanceDay` 2026-11-25
- [ ] Today arrives in time — input: nil at 08:00 `check()`, then 2 open at 08:00:30 — expected: 1 showing, marked
- [ ] Today arrives late — input: nil at 08:00 `check()`, then 2 open at 08:01:01 — expected: 0 showings, `lastMorningGlanceDay` absent
- [ ] Signed out — input: nil throughout, `check()` — expected: 0 showings, absent
- [ ] Locked — input: locked, `check()` — expected: 0 showings, absent; then unlocked and `check()` — expected: 1 showing, marked
- [ ] Unlock not delivered — input: locked `check()`, then unlocked and `retryLockedChance()` — expected: 1 showing; and `retryLockedChance()` with no locked chance (Today arrived late, unmarked) — expected: 0 showings
- [ ] Held — input: `gate.applyLaunchRead(isQuiet: true)`, `check()` — expected: 0 showings, absent
- [ ] Released the same day — input: held at 08:00, `setQuiet(false)` at 09:30 — expected: 1 showing, marked 2026-11-25
- [ ] Released on a later day — input: held at 23:50, `setQuiet(false)` at 2026-11-26 00:10 — expected: 0 showings, `gate.released` without `.morningGlance`
- [ ] Today in front — input: `isTodayInFront` true, `check()` — expected: 0 showings, marked 2026-11-25
- [ ] Not seen — input: the panel answers false, `check()` — expected: 1 attempt, absent; the next `check()` with the panel seen — expected: 2 attempts, marked
- [ ] Re-entrant — input: `showPanel` calls `check()` before answering — expected: 1 showing, marked once
- [ ] On screen — input: shown, then `check()` before `dismissed()` — expected: still 1 showing
- [ ] The popover shows — input: shown, `popoverShown()` — expected: 1 closing, `lastMorningGlanceDay` still 2026-11-25; with nothing shown — expected: 0 closings
- [ ] Midnight during the show — input: `check()` at 23:59:59, the clock moves to 2026-11-26 00:00:01 inside `showPanel` — expected: `lastMorningGlanceDay` 2026-11-25; a `check()` after `dismissed()` — expected: 2 showings, 2026-11-26
- [ ] The zone's day — input: the instant 2026-11-25 16:00 UTC (2026-11-26 01:00 in Asia/Tokyo, 13:00 in America/Sao_Paulo), `lastMorningGlanceDay` 2026-11-25 — expected: the Tokyo harness shows 1, the São Paulo harness shows 0
- [ ] The shown content — input: 7 open — expected: `showPanel` receives `openCount` 7, 5 rows, `restCount` 2
- [ ] `swift test --package-path apps/macos/TodzKit` green, count recorded; `xcodegen generate` and Debug `xcodebuild` print `BUILD SUCCEEDED` with no `warning:` or `error:` line

## Prove it for real

Orca (ADR 0026), the Debug build against a local `wrangler dev` with a seeded workspace, the app folders backed up with `ditto` and `shasum` listings first and restored after. The trigger is a launch: `open -g -j` after deleting `lastMorningGlanceDay` from the app container's defaults. **The panel lands on the owner's screen: at most two showings in the whole walk** (Showing 1 and Showing 2); every other launch below must show nothing, and a panel where none is expected is a FAIL that ends the walk. Read the frontmost app (`orca computer list-apps --json` or `System Events`) before each launch.

- [ ] Settings, fresh defaults — expected: `Morning glance` off with its detail; turned on — expected: `showsMorningGlance = 1`, no panel appears; the window height unchanged; screenshots light and dark
- [ ] No-show, off — input: the switch off, 3 open, `lastMorningGlanceDay` absent, hidden launch — expected: no panel in 15 s, `lastMorningGlanceDay` still absent
- [ ] No-show, nothing open — input: on, Today empty, hidden launch — expected: no panel in 15 s, `lastMorningGlanceDay` today
- [ ] Showing 1 — input: on, seven open Today tasks (one overdue, one with a title longer than the row), `lastMorningGlanceDay` absent, another app frontmost with a text field focused, hidden launch — expected: within 5 s of Today loading a panel 280 wide at the top right under the menu bar; heading `Today` with `7 left`; five rows, the overdue one ending `Overdue`, the long one truncated on one line; `+2 more`; screenshot
- [ ] Showing 1, focus — expected: the frontmost app the same before, during and after; Orca's focused element belongs to that app, never to todz; todz not active; a key typed into the focused field during the show lands there
- [ ] Showing 1, the end — expected: the panel gone between 5 and 7 s after it appeared (no pointer over it); `lastMorningGlanceDay` today; the app still running; no new crash report
- [ ] The same day, relaunch — input: quit, hidden launch — expected: no panel in 15 s
- [ ] Showing 2 — input: `lastMorningGlanceDay` deleted, three open, hidden launch; the pointer moved onto the panel within 3 s and held there 8 s — expected: still shown after 8 s; then a click on it — expected: the panel gone at once, todz active, the main window frontmost with Today selected, `lastMorningGlanceDay` today. If Orca cannot hold a hover, the click alone, and the hover goes to the Human checklist
- [ ] Accessibility tree of Showing 1 — expected: one element `Today, 7 left` with the five titles in its value and the hint `Opens Today in the todz window.`; the announcement itself is BLOCKED unless VoiceOver runs, recorded as such
- [ ] Screenshots at `docs/screenshots/morning-glance/` (the glance, and Settings); extra media at `.pr-media/morning-glance/`

## Human checklist (the owner, on his own Mac, not walked by an agent)

- [ ] The first unlock of a morning with the switch on and open tasks shows the glance once (proves `com.apple.screenIsUnlocked` reaches the sandboxed app, or the app switch retry)
- [ ] A wake from sleep without a password shows it; with a password it waits for the unlock
- [ ] A Focus with the todz filter at the first chance holds it; ending the Focus the same day shows it once
- [ ] With Reduce Motion on, the panel disappears without a fade
- [ ] With VoiceOver on, `todz, <N> left today` is spoken when it shows
- [ ] The Mac's time zone changed to one where it is already tomorrow, then a lock and unlock — the glance shows for the new day
- [ ] The day close due on the same wake: only the popover remains on screen

## Edge cases found during execution

Empty on purpose. The tester adds one checkbox per new case (input, exact expected outcome) and a regression test for each.

## Adversarial review

The reviewer picks the three claims most likely to be wrong and tries to refute each.

- [ ] Claim 1: <claim> — attack: <how>; result: <refuted | held>
- [ ] Claim 2: <claim> — attack: <how>; result: <refuted | held>
- [ ] Claim 3: <claim> — attack: <how>; result: <refuted | held>

## Coverage honesty

- A real lock, unlock and wake are not walked: they would lock the owner's Mac. The unit tests cover the decisions; the Human checklist covers the signals.
- A real Focus is not walked: it would change the owner's Focus. The gate's and the coordinator's tests cover it.
- The macOS 14 and 15 material fallback is built but not seen: the only Mac runs macOS 26 or later.
- Several displays, full-screen apps and Stage Manager are not walked.
- The fade's look is seen once in Showing 1; Reduce Motion is a Human checklist row.
