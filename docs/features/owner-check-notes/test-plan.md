# Test plan: The owner's checklist notes

Every checkbox states the input and the exact expected outcome. A ticked box carries evidence after ` — evidence: ` (commit hash, log path, counts, screenshot path).

## The failing test first

- [ ] `HistoryFailureTests` — input: the red commit, each test run alone with `--filter`; expected: fails on the stub `HistoryFailure is not implemented`
- [ ] Confirmed it fails for the right reason: the failure text recorded from the red run

## Unit

- [ ] Offline — input: `HistoryFailure.of(isOffline: true)`; expected: `.offline`
- [ ] Online — input: `HistoryFailure.of(isOffline: false)`; expected: `.failed`
- [ ] `swift test --package-path apps/macos/TodzKit`: every suite green, count recorded

## Prove it for real — the app (ADR 0026)

- [ ] Offline history: signed in, stop `wrangler dev`, select a task whose history was never loaded; expected: the inspector's history reads "History shows when todz is back online." in secondary colour (not red), with Try Again; screenshot
- [ ] Back online: start `wrangler dev`, press Try Again; expected: the history lines load
- [ ] Online failure keeps the red line: with the server up, make the history route fail (a proxy answering 500 or the task's project removed); expected: "Couldn't load the history." in red with Try Again
- [ ] Sign out, then type at once without clicking; expected: the typed text lands in the identity field
- [ ] Launch signed out from cold, type at once; expected: the typed text lands in the identity field
- [ ] Popover ⌘2: bring another app to the front, open the popover from the status item, press ⌘2 with a real key event; expected: the popover shows the second workspace. If the developer's note says it already worked before the change, the same result at HEAD
- [ ] Popover open does not steal the front app's typing beyond the popover itself: after closing the popover, the previous app gets its key focus back
- [ ] Window minimum: drag the main window to its smallest; expected: 976 × 532 with every column shown, as the design now says; screenshot

## Edge cases found during execution

## Adversarial review

- [ ] Claim 1: the offline line never shows while online — attack: a failure that arrives as the app goes offline, then back online; result: <refuted | held>
- [ ] Claim 2: the identity field takes focus after every sign-out path — attack: Sign Out from the menu, a session ended by the server (401); result: <refuted | held>
- [ ] Claim 3: the popover shortcut works with a real key — attack: the owner's own key press, not a synthetic one; result: <refuted | held>

## Coverage honesty

- The focus and popover keys are proven with synthetic key events from System Events; the owner's hand is the last check.
