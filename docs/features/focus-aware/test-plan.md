# Test plan: Focus aware

Every checkbox states the input and the exact expected outcome. A ticked box carries evidence after ` — evidence: ` (commit hash, log path, counts, screenshot path).

Pinned strings (`design.md` § 8): Settings row title `Quiet during Focus`; detail `todz stays quiet in any Focus with the todz filter on.`; while quiet `Quiet now, until this Focus ends.`; button `Open Focus Settings`. Filter: title `Quiet todz`; description `Keeps todz from showing anything on its own while this Focus is on.`; parameter `Keep todz quiet`; tile title `todz`, subtitle `Stays quiet` (on) or `Shows as usual` (off).

## The failing test first

- [ ] `ProactiveGateTests` at the red commit, each test run alone with `--filter` — expected: each stops on `<name> is not implemented`
- [ ] Confirmed each fails for the right reason: the texts printed match `tester-briefing.md`

## Unit

- [ ] A new gate — expected: not quiet; `admit(.dayClose)` is `.show`
- [ ] Quiet — expected: `admit(.dayClose)` is `.held`; `released` empty
- [ ] Quiet, `.dayClose` twice and `.ribbon` once, then not quiet — expected: `released` `[.dayClose, .ribbon]`
- [ ] `claimRelease(.dayClose)` — expected: true, then false; `released` `[.ribbon]`; `claimRelease(.morningGlance)` never held — expected: false
- [ ] Not quiet twice in a row — expected: the second adds nothing
- [ ] Quiet twice, then not quiet — expected: each held kind released once
- [ ] After a release — expected: `admit` is `.show`; a later quiet period that held nothing adds nothing
- [ ] Launch read: `applyLaunchRead(isQuiet: true)` on a fresh gate — expected: quiet; after `setQuiet(false)`, a late `applyLaunchRead(isQuiet: true)` — expected: ignored, not quiet
- [ ] `FocusQuietNotice`: not quiet — expected: `.notQuiet`; quiet — expected: `.quietNow`
- [ ] `swift test --package-path apps/macos/TodzKit` green, count recorded; the Debug `xcodebuild` succeeds
- [ ] `grep -c TodzFocusFilter` and `grep -c "Keep todz quiet"` on the Debug build's `Todz.app/Contents/Resources/Metadata.appintents/extract.actionsdata` — expected: each at least 1

## Prove it for real

The app is walked with Orca (ADR 0026), launched with `open -g -j`. The owner may be at the Mac: no Focus is turned on by the tester, and System Settings is opened only for the reads below and closed after.

- [ ] Settings shows the Focus row under the two switches: `Quiet during Focus`, `todz stays quiet in any Focus with the todz filter on.` and the `Open Focus Settings` button, light and dark; the window frame height from Orca `get-app-state` recorded for `main`'s build and for this branch, and unchanged while open — screenshots
- [ ] The button — expected: System Settings opens on Focus
- [ ] System Settings → Focus → any mode → Add Filter, with the Debug build (`dev.todz.Todz.debug`) registered — expected: one todz entry per installed todz app; the Debug one's sheet titled `Quiet todz` shows `Keep todz quiet`, off — screenshot (do not save the filter)
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

- A real Focus turning on and off with the filter saved is not walked: it changes the owner's Focus. So the `Quiet now, until this Focus ends.` detail and `perform()` are proven by the gate's and the notice's unit tests and the metadata check only; the PR's Human checklist runs them: add the filter to a Focus with the switch on, turn the Focus on (expect `Quiet now…` in Settings), off (expect the detail back), and with todz quit (expect todz launched in the menu bar; note whether a window opens).
- No proactive surface exists yet; the gate is proven by its unit tests, and each later surface adds its own walk through it.
