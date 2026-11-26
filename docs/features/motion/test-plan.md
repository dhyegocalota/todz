# Test plan: Motion

Every checkbox states the input and the exact expected outcome. A ticked box carries evidence after ` — evidence: `.

The surface is native macOS and the widgets: there is no browser surface, so there is no Playwright E2E spec. The unit tests are red first; the visual moments are walked by hand, and the GIF recorder records them later.

## The failing test first

- [x] `apps/macos/TodzKit/Tests/TodzKitTests/MotionTokenTests.swift` — input: the token set, the ceiling and the rule; expected: red on the stubs, green after — evidence: 817ea00a checked out in a throwaway worktree (removed after): `swift test --filter MotionTokenTests` crashed on the stubs with signal 5; green on 01a6e813 in the full run (1326 tests in 104 suites passed)
- [x] Confirmed it fails for the right reason: the red run stops on `MotionToken.durationMilliseconds is not implemented` and `MotionRule.token is not implemented` — evidence: the 817ea00a run printed `MotionRule.token is not implemented` (MotionRule.swift:4), `MotionToken.durationMilliseconds is not implemented` (MotionToken.swift:23) and `MotionToken.curve is not implemented` (MotionToken.swift:27). Red-first of 510a5591 and 66613930 was not re-run by the tester

## Unit (TodzKit)

- [x] `MotionTokenTests::everyTokenFitsTheCeiling` — input: every `MotionToken`; expected: `durationMilliseconds <= 350` for all — evidence: green in the full run on 01a6e813 (1326 tests in 104 suites)
- [x] `MotionTokenTests::theCeilingIs350Milliseconds` — expected: `MotionTiming.ceilingMilliseconds == 350`. A pin: it passes at the red commit 817ea00a, so it guards the number rather than proving new behaviour — evidence: green on 01a6e813; it printed a pass inside the 817ea00a red run too, confirming the pin
- [x] `MotionTokenTests::everySpringSettlesWithinItsOwnDuration` — expected: each spring's `Spring(response:dampingRatio:).settlingDuration` is at most its token's `durationMilliseconds`; red at 66613930, green after a72a9b49 — evidence: green on 01a6e813
- [x] `MotionBloomTests` (5 tests) — expected: a resting bloom is fully visible and unscaled; a dimmed bloom is hidden and scaled to 0.96; Reduce Motion never scales; red at 510a5591, green at f206e8be — evidence: green on 01a6e813
- [x] `MotionTokenTests::reduceMotionTurnsEveryTokenIntoACrossfade` — input: every token, `isReduceMotionOn: true`; expected: `.crossfade` for all — evidence: green on 01a6e813
- [x] `MotionTokenTests::withReduceMotionOffEveryTokenIsKept` — input: every token, `isReduceMotionOn: false`; expected: the same token back for all — evidence: green on 01a6e813
- [x] `MotionTokenTests::theCrossfadeIsAnEaseNotASpring` — expected: `crossfade.curve` is the ease curve, never a spring — evidence: green on 01a6e813
- [x] `MotionTokenTests::everySpringHasAPositiveResponse` — expected: every spring curve has `response > 0` and `dampingFraction` in `(0, 1]` — evidence: green on 01a6e813

## Walk (the app and the widgets, Debug build against a local `wrangler dev`)

Each moment is one checkbox. The walk runs with Orca on a scratch copy, keeps popover openings few and short, and never touches the owner's production Mac state.

- [ ] Complete a task in the list with a click on its circle — expected: the circle fills and the check draws in from left to right within about 250 ms, and a six-dot mint (`#8CF7D0`) burst spreads and fades once within about 300 ms — evidence: FAIL on 01a6e813 (Reduce Motion off, read back false): across three completions by click the disc and check change inside two captured frames (about 33 ms), with no draw and no dots, `.pr-media/motion/complete-head-frames.png`, `complete-head2-frames.png`, `complete-head3-frames.png` and the clips `complete-head*.mov`. On efdfdaf8 the same click showed the disc fill and the dots spread and fade over about 280 ms (`complete-draw-burst-frames.png`, `complete-draw-burst.mov`), so aa4fb8db (the sparkle fix, the row signature change) looks like the regression
- [ ] Complete a task with the space key — expected: the same draw and burst as the click — evidence: ran on efdfdaf8 only (disc, check and dots, `.pr-media/motion/complete-space-frames.png`); not re-walked on 01a6e813, where the click path failed
- [x] Undo a completed task — expected: the check clears at once with no burst — evidence: on efdfdaf8, from the Done list: the row left at once with no burst (`.pr-media/motion/undo-clears-frames.png`); the cleared check itself is not visible because the row is removed in the same frame. Not re-walked on 01a6e813
- [ ] Add a task from the add field — expected: the new row springs in from slightly smaller and transparent to full size within about 320 ms — evidence: on 01a6e813 the row is complete in about three captured frames (50 ms) with no visible scale or fade, `.pr-media/motion/add-head-frames.png`, `add-head.mov`: List appears to ignore the row transition. On efdfdaf8 the first frame showed the row small and unselected, full size within about 190 ms (`add-spring-in-frames.png`)
- [ ] Add a task while the list is empty — expected: the row springs in the same way — evidence: same as above, 01a6e813 `add-head.mov` was an empty Inbox: no visible spring
- [x] Open the popover from the menu bar — expected: the content blooms from slightly smaller and dimmed to full size within about 300 ms, every time it opens — evidence: 01a6e813 fixes the blank popover: the content showed on every opening (`.pr-media/motion/popover-head-open1.jpg`, `popover-head-open2.jpg`; the efdfdaf8 build was blank 4 of 5 times, `popover-fourth-open.jpg`). The bloom itself lasts under one captured frame at 25 fps (`popover-bloom-head-frames.png`): visible content, no dim stage seen
- [x] Open the popover twice in a row — expected: the bloom plays both times; the focus on the add field still works — evidence: 01a6e813, two openings in a row, both showed the content with the add-field caret blinking (`.pr-media/motion/popover-head-open1.jpg`, `popover-head-open2.jpg`)
- [x] Change the open count (complete a task in the window while the menu bar shows the count) — expected: the number changes at once, no roll (the roll is a known gap); the text and its accessibility label are unchanged — evidence: on efdfdaf8 the count went 2 to 1 inside a single 20 ms frame (`.pr-media/motion/count-roll-frames.png`, `count-roll.mov`); the accessibility label was not read; not re-walked on 01a6e813, which only removes the unused animation
- [ ] Day temperature on (the count drawn as an image) — expected: the count swaps at once with no roll; the text and its accessibility label are unchanged — evidence: BLOCKED: not walked, day temperature stayed off to spare the owner's settings
- [ ] Sign in with a valid link — expected: the sign-in screen gives way to the main window in a short reveal within about 340 ms — evidence: BLOCKED: not walked, the Debug app started from a stored session and no sign-in link was driven
- [ ] Morning glance appears at the morning time — expected: the glance enters with a bloom within about 300 ms and its rows are unchanged — evidence: BLOCKED: not triggered, the briefing names no way to force the morning time
- [ ] Day close is offered in the popover — expected: its section enters with a bloom within about 300 ms and the actions work — evidence: BLOCKED: not triggered, no day close was offered during the walk
- [ ] Widget count changes (an agent adds a task while the widget is on the desktop) — expected: the count in the widget updates with its content transition, no layout shift — evidence: BLOCKED: the Debug widgets were not placed on the owner's desktop

## Reduce Motion (System Settings → Accessibility → Display → Reduce motion on)

- [x] Complete a task — expected: no draw and no burst; the check appears with a crossfade under 150 ms — evidence: 01a6e813 with Reduce motion on (read back true): the disc faded in over about six frames (about 100 ms), no dots, no draw, `.pr-media/motion/reduce-motion-head-frames.png`, `reduce-motion-head.mov`. The efdfdaf8 build also showed no dots and an instant disc (`reduce-motion-complete-frames.png`)
- [x] Add a task — expected: the row fades in with no spring — evidence: efdfdaf8 with Reduce motion on: the row appeared with no scale step (`.pr-media/motion/reduce-motion-add-frames.png`, `reduce-motion-walk.mov`); not re-recorded on 01a6e813
- [x] Open the popover — expected: the content fades in with no scale — evidence: 01a6e813 with Reduce motion on: the content showed fully with the add-field caret (`.pr-media/motion/reduce-motion-head-popover.jpg`); the fade itself was not captured
- [ ] Change the count — expected: the number changes at once, as without Reduce Motion (no roll exists) — evidence: BLOCKED: no due-today task was open during the Reduce Motion pass, so the count was hidden
- [ ] Sign in — expected: a crossfade, no reveal motion — evidence: BLOCKED: not walked, see the sign-in box
- [ ] Select a sidebar item (Inbox, then a project) — expected: the item's title in the sidebar flies to the list header's title within about 320 ms, and the header's text is the same string and font after the move — evidence: FAIL on 01a6e813 (Reduce Motion off): the flight plays (the Today label lifts out of the sidebar row and settles as the header in about eight captured frames, `.pr-media/motion/sidebar-flight-frames.png`, `sidebar-flight.mov`), but the selected sidebar row is left blank (no icon, title or count) afterwards, and on a later selection the Today row vanished from the list. The header is also empty on first launch before any selection (`n1` state: Inbox title missing while rows are listed)
- [ ] Reduce Motion on, select a sidebar item — expected: the header changes with a crossfade, no flight — evidence: BLOCKED: not walked on 01a6e813 before Reduce motion was restored

## Known gaps, not walked

- [ ] The GIF for the PR and the README — recorded later by the recorder — evidence: BLOCKED: recorded later by the recorder; the raw clips and frames are in `.pr-media/motion/` (git-ignored)

## Edge cases found during execution

- Sidebar rows blank or vanish after selection: the selected row loses its icon, title and count after a selection, and the Done row (efdfdaf8) or the Today row (01a6e813) vanished from the list while the accessibility tree still listed them (`.pr-media/motion/sidebar-check.png`, `sidebar-flight-frames.png`). Outcome: defect on both heads; on efdfdaf8 the sidebar had no motion code, so it may predate the lane (not compared against main)
- Completing a task removes it from Inbox about 1 s later, so undo is walked from Done. Outcome: passes
- Synthetic key and value input from the computer-use tool did not reach the Debug app; the walk used real pointer and key events. A stale system prompt from another session's probe sat on the window and was denied once. Outcome: tooling note
- Reduce motion was switched on in System Settings, Accessibility, Motion, twice for about two minutes in all, and restored each time (read back false); no other setting changed

## Walk summary

Heads: unit run, popover, Reduce Motion complete and popover, sidebar flight on 01a6e813; the first walk (complete, space, undo, add, count, Reduce Motion add) on efdfdaf8. Of 31 boxes, 17 ticked, 9 blocked (day temperature, sign-in, morning glance, day close, widget, Reduce Motion count, Reduce Motion sign-in, Reduce Motion sidebar, the GIF) and 5 not ticked (complete draw and burst, space key not re-walked, the two add springs, the sidebar flight). Not ready for review: the completion draw and mint burst no longer play on 01a6e813, rows do not visibly spring in, and the sidebar blanks its selected row.
