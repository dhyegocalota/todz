# Test plan: Focus aware

Every checkbox states the input and the exact expected outcome. A ticked box carries evidence after ` — evidence: ` (commit hash, log path, counts, screenshot path).

Pinned strings (`design.md` § 8): Settings row title `Quiet during Focus`; detail `todz stays quiet in any Focus with the todz filter on.`; while quiet `Quiet now, until this Focus ends.`; button `Open Focus Settings`. Filter: title `Quiet todz`; description `Keeps todz from showing anything on its own while this Focus is on.`; parameter `Keep todz quiet`; tile title `todz`, subtitle `Stays quiet` (on) or `Shows as usual` (off).

## The failing test first

- [ ] `ProactiveGateTests` at the red commit, each test run alone with `--filter` — expected: each stops on `<name> is not implemented`
- [ ] Confirmed each fails for the right reason: the texts printed match `tester-briefing.md`

## Unit

- [ ] A new gate — expected: not quiet; `admit(.dayClose)` is `.show`
- [ ] Quiet — expected: `admit(.dayClose)` is `.held`; nothing released
- [ ] Quiet, `.dayClose` twice and `.ribbon` once, then not quiet — expected: released `[.dayClose, .ribbon]`
- [ ] Not quiet twice in a row — expected: the second releases `[]`
- [ ] Quiet twice, then not quiet — expected: each held surface released once
- [ ] After a release — expected: `admit` is `.show`; a later quiet period that held nothing releases `[]`
- [ ] The filter seam: `isQuiet == true` — expected: the gate is quiet; `false` — expected: not quiet and the held surfaces released
- [ ] `swift test --package-path apps/macos/TodzKit` green, count recorded; the Debug `xcodebuild` succeeds
- [ ] The built app's App Intents metadata names `TodzFocusFilter` with the parameter "Keep todz quiet"

## Prove it for real

The app is walked with Orca (ADR 0026), launched with `open -g -j`. The owner may be at the Mac: no Focus is turned on by the tester, and System Settings is opened only for the reads below and closed after.

- [ ] Settings shows the Focus row under the two switches: `Quiet during Focus`, `todz stays quiet in any Focus with the todz filter on.` and the `Open Focus Settings` button, light and dark; the window height equals the two-switch window plus one row and does not change — screenshots
- [ ] The button — expected: System Settings opens on Focus
- [ ] System Settings → Focus → any mode → Add Filter — expected: todz is listed; its sheet titled `Quiet todz` shows `Keep todz quiet`, off — screenshot (do not save the filter)
- [ ] Unit: the Settings detail reads `Quiet now, until this Focus ends.` when the gate is quiet and the detail otherwise (through a testable copy function)
- [ ] Accessibility tree: the row's text and the button read with their labels
- [ ] Screenshots at `docs/screenshots/focus-aware/`; extra media at `.pr-media/focus-aware/`

## Edge cases found during execution

Empty on purpose. The tester adds one checkbox per new case (input, exact expected outcome) and a regression test for each.

## Adversarial review

The reviewer picks the three claims most likely to be wrong and tries to refute each.

- [ ] Claim 1: <claim> — attack: <how>; result: <refuted | held>
- [ ] Claim 2: <claim> — attack: <how>; result: <refuted | held>
- [ ] Claim 3: <claim> — attack: <how>; result: <refuted | held>

## Coverage honesty

- A real Focus turning on and off with the filter saved is not walked: it changes the owner's Focus. The intent's `perform()` path is covered by the seam's unit test and the metadata check; the owner's Human checklist runs it once.
- No proactive surface exists yet; the gate is proven by its unit tests, and each later surface adds its own walk through it.
