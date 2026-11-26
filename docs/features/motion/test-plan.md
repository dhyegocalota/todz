# Test plan: Motion

Every checkbox states the input and the exact expected outcome. A ticked box carries evidence after ` — evidence: `.

The surface is native macOS and the widgets: there is no browser surface, so there is no Playwright E2E spec. The unit tests are red first; the visual moments are walked by hand, and the GIF recorder records them later.

## The failing test first

- [ ] `apps/macos/TodzKit/Tests/TodzKitTests/MotionTokenTests.swift` — input: the token set, the ceiling and the rule; expected: red on the stubs, green after
- [ ] Confirmed it fails for the right reason: the red run stops on `MotionToken.durationMilliseconds is not implemented` and `MotionRule.token is not implemented`

## Unit (TodzKit)

- [ ] `MotionTokenTests::everyTokenFitsTheCeiling` — input: every `MotionToken`; expected: `durationMilliseconds <= 350` for all
- [ ] `MotionTokenTests::theCeilingIs350Milliseconds` — expected: `MotionTiming.ceilingMilliseconds == 350`
- [ ] `MotionTokenTests::reduceMotionTurnsEveryTokenIntoACrossfade` — input: every token, `isReduceMotionOn: true`; expected: `.crossfade` for all
- [ ] `MotionTokenTests::withReduceMotionOffEveryTokenIsKept` — input: every token, `isReduceMotionOn: false`; expected: the same token back for all
- [ ] `MotionTokenTests::theCrossfadeIsAnEaseNotASpring` — expected: `crossfade.curve` is the ease curve, never a spring
- [ ] `MotionTokenTests::everySpringHasAPositiveResponse` — expected: every spring curve has `response > 0` and `dampingFraction` in `(0, 1]`

## Walk (the app and the widgets, Debug build against a local `wrangler dev`)

Each moment is one checkbox. The walk runs with Orca on a scratch copy, keeps popover openings few and short, and never touches the owner's production Mac state.

- [ ] Complete a task in the list with a click on its circle — expected: the circle fills and the check draws in from left to right within about 250 ms, and a six-dot mint (`#8CF7D0`) burst spreads and fades once within about 300 ms — evidence:
- [ ] Complete a task with the space key — expected: the same draw and burst as the click — evidence:
- [ ] Undo a completed task — expected: the check clears at once with no burst — evidence:
- [ ] Add a task from the add field — expected: the new row springs in from slightly smaller and transparent to full size within about 320 ms — evidence:
- [ ] Add a task while the list is empty — expected: the row springs in the same way — evidence:
- [ ] Open the popover from the menu bar — expected: the content blooms from slightly smaller and dimmed to full size within about 300 ms, every time it opens — evidence:
- [ ] Open the popover twice in a row — expected: the bloom plays both times; the focus on the add field still works — evidence:
- [ ] Change the open count (complete a task in the window while the menu bar shows the text count) — expected: the number rolls to the new value within about 200 ms — evidence:
- [ ] Day temperature on (the count drawn as an image) — expected: the count swaps at once with no roll; the text and its accessibility label are unchanged — evidence:
- [ ] Sign in with a valid link — expected: the sign-in screen gives way to the main window in a short reveal within about 340 ms — evidence:
- [ ] Morning glance appears at the morning time — expected: the glance enters with a bloom within about 300 ms and its rows are unchanged — evidence:
- [ ] Day close is offered in the popover — expected: its section enters with a bloom within about 300 ms and the actions work — evidence:
- [ ] Widget count changes (an agent adds a task while the widget is on the desktop) — expected: the count in the widget updates with its content transition, no layout shift — evidence:

## Reduce Motion (System Settings → Accessibility → Display → Reduce motion on)

- [ ] Complete a task — expected: no draw and no burst; the check appears with a crossfade under 150 ms — evidence:
- [ ] Add a task — expected: the row fades in with no spring — evidence:
- [ ] Open the popover — expected: the content fades in with no scale — evidence:
- [ ] Change the count — expected: the number changes with a crossfade, no roll — evidence:
- [ ] Sign in — expected: a crossfade, no reveal motion — evidence:

## Known gaps, not walked

- [ ] Sidebar matched geometry — NOT SHIPPED in this build, see `spec.md` "Known gaps"
- [ ] The GIF for the PR and the README — recorded later by the recorder
