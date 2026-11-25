# Test plan: Menu bar only

Every checkbox states the input and the exact expected outcome. A ticked box carries evidence after ` — evidence: ` (commit hash, log path, counts, screenshot path).

The surface is native macOS: there is no browser surface, so there is no Playwright E2E spec. The walk runs with Orca (`orca computer …`) on a scratch copy of the Debug app, never `/Applications/Todz.app`, and keeps popover openings few and short.

## The failing test first

- [ ] `apps/macos/TodzKit/Tests/TodzKitTests/ActivationPolicyRuleTests.swift` — input: every case of the rule; expected: red on the stub, green after
- [ ] Confirmed it fails for the right reason: the red commit's run stops on `ActivationPolicyRule.policy is not implemented`, and the preference's on `MenuBarOnlyPreference.isOn is not implemented`

## Unit (TodzKit)

- [ ] `ActivationPolicyRuleTests::aClosedWindowWithTheSettingOnIsAnAccessory` — input: `isSettingOn: true, visibleWindowCount: 0`; expected: `.accessory`
- [ ] `ActivationPolicyRuleTests::anOpenWindowWithTheSettingOnIsRegular` — input: `isSettingOn: true, visibleWindowCount: 1` and `2`; expected: `.regular`
- [ ] `ActivationPolicyRuleTests::theSettingOffIsAlwaysRegular` — input: `isSettingOn: false, visibleWindowCount: 0`, `1`, `2`; expected: `.regular`
- [ ] `MenuBarOnlyPreferenceTests::aFreshDomainReadsOn` — input: an empty domain; expected: `isOn == true`
- [ ] `MenuBarOnlyPreferenceTests::aStoredOffReadsOff` — input: `false` stored; expected: `isOn == false`
- [ ] `MenuBarOnlyPreferenceTests::registeringTheDefaultsRegistersOn` — expected: the key reads `true`
- [ ] `MenuBarOnlyPreferenceTests::registeringNeverOverwritesTheOwnersChoice` — input: `false` stored, then register; expected: `isOn == false`
- [ ] `MenuBarOnlyPreferenceTests::aValueOnlyInAnotherSearchedDomainIsIgnored` — input: `false` only in another suite; expected: `isOn == true`

- [ ] `OpenAppWindowTests` (5 tests) — input: visible, minimized, closed, and a panel that cannot become main; expected: visible or minimized main-capable windows count, nothing else
- [ ] `LaunchActivationTests` (3 tests) — input: `isDefaultLaunch` true, false, nil; expected: `.afterTheFirstWindowEvent`, `.atLaunch`, `.afterTheFirstWindowEvent`

## Prove it for real — the app

- [ ] Settings shows "Keep todz in the menu bar when closed" with its detail line, on for a fresh defaults domain; screenshot in light and dark
- [ ] Switch on, close the main window with ⌘W: the Dock icon goes, ⌘Tab has no todz, the menu bar item and its count stay
- [ ] Switch on, close with the red button: the same
- [ ] Hidden, the popover's "Open todz": the window opens in front, active, the Dock icon is back
- [ ] Hidden, a task row in the popover: the window opens on that task, in front, with the Dock icon
- [ ] Hidden, a widget tap: the window opens in front with the Dock icon
- [ ] Hidden, a `todz://` link (`open todz-debug://…`): the window opens in front with the Dock icon
- [ ] Hidden, open the app again from Finder: the window opens in front with the Dock icon
- [ ] Hidden, `open -a` on the running app and Spotlight: the window opens in front with the Dock icon
- [ ] Switch on, minimize the main window: the Dock icon and ⌘Tab entry stay; clicking the Dock icon brings the window back
- [ ] Switch on, ⌘H: the Dock icon stays; clicking it shows the window again
- [ ] A normal launch from Finder: the Dock icon appears once and never disappears and returns
- [ ] Hidden, the popover's "Quit todz" (ready, and signed out): todz quits
- [ ] Hidden, check a widget checkbox: the task completes and the menu bar count drops
- [ ] Hidden, run a todz Siri intent or Shortcut (where the branch has them): it answers, the app stays hidden
- [ ] Hidden, ⌘Q with the popover open quits; with a window open, ⌘Q quits
- [ ] Settings open with the main window closed: the Dock icon shows; closing Settings hides it
- [ ] Switch off, close the main window: the Dock icon and ⌘Tab entry stay (today's behaviour)
- [ ] A launch with no window shown (`open -g` or with the window closed at quit) has no Dock icon once launched

## Edge cases found during execution

Empty on purpose. The tester adds one checkbox per new case (input, exact expected outcome) and a regression test for each.

## Adversarial review

- [ ] Claim 1: a reopened window always comes to the front with the app's menu bar — attack: reopen from each entry point while another app is frontmost; result:
- [ ] Claim 2: nothing stops while hidden — attack: change a task from an agent while hidden and watch the count; result:
- [ ] Claim 3: the switch off is exactly today's behaviour — attack: diff the delegate's paths with the switch off; result:

## Coverage honesty

- The window observation and `NSApp.setActivationPolicy` are AppKit and checked by hand, not by a unit test.
