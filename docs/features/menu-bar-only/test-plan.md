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

Walk on 8537dd62: scratch Debug build (bundle `dev.todz.Todz.menubaronlywalk`, installed in ~/Applications, removed and unregistered after) against a local `wrangler dev` on 8841 with its own `--persist-to`, fake sign-in, workspace `acme`. Media in `.pr-media/menu-bar-only/`. The system appearance is dark; light was not captured (no appearance change on the owner's Mac).

- [ ] Settings shows "Keep todz in the menu bar when closed" with its detail line, on for a fresh defaults domain; screenshot in light and dark — evidence: second row under the pending count, switch on, detail "With no window open, todz leaves the Dock and ⌘Tab. The menu bar, widgets and Siri keep working." (.pr-media/menu-bar-only/settings-dark.png). NOT TICKED: light not captured
- [x] Switch on, close the main window with ⌘W: the Dock icon goes, ⌘Tab has no todz, the menu bar item and its count stay — evidence: `lsappinfo` Foreground before, UIElement after, Orca lists no window, System Events status menu item still `todz, 3 left today`
- [x] Switch on, close with the red button: the same — evidence: red button clicked with Settings open too stayed Foreground (see Settings row); with Settings closed ⌘W/red both ended UIElement, item and count stay
- [ ] Hidden, the popover's "Open todz": the window opens in front, active, the Dock icon is back — FAIL: with a real mouse click (cliclick) and with an accessibility press, twice, the window was shown (onscreen, over the browser) but `lsappinfo` stayed UIElement, the owner's own Todz stayed frontmost with its menu bar, no Dock icon; a click inside the window then flipped it to Foreground (.pr-media/menu-bar-only/defect-popover-open-todz-window-shown-but-accessory.png)
- [ ] Hidden, a task row in the popover: the window opens on that task, in front, with the Dock icon — NOT RUN: shares the popover route of the FAIL above, not exercised to spare the owner's screen
- [ ] Hidden, a widget tap: the window opens in front with the Dock icon — BLOCKED: no widget instance can be placed and tapped without the owner's desktop
- [x] Hidden, a `todz://` link (`open todz-dev://…`): the window opens in front with the Dock icon — evidence: `open -a <scratch> todz-dev://today` while hidden: frontmost became the scratch app, Foreground, window listed
- [x] Hidden, open the app again from Finder: the window opens in front with the Dock icon — evidence: `open -a <scratch>` while hidden: Foreground, frontmost true, menu bar File Edit View Task Window Help
- [ ] Hidden, `open -a` on the running app and Spotlight: the window opens in front with the Dock icon
- [ ] Switch on, minimize the main window: the Dock icon and ⌘Tab entry stay; clicking the Dock icon brings the window back
- [ ] Switch on, ⌘H: the Dock icon stays; clicking it shows the window again — NOT RUN (minimize was run instead, see edge cases)
- [ ] A normal launch from Finder: the Dock icon appears once and never disappears and returns — PARTIAL: a launch that restores no window read Foreground for 27 of 30 immediate `lsappinfo` samples, then UIElement (the Dock icon shows, then goes). A launch showing a window was Foreground in all 12 samples. Not a flicker for a window launch; present for a no-window launch
- [x] Hidden, the popover's "Quit todz" (ready, and signed out): todz quits — evidence: signed in, hidden, "Quit todz" pressed: process gone. Signed-out case not run
- [x] Fix round 1, hidden, the popover's "Open todz" and a popover row: the app turns regular and active before the window opens, so `lsappinfo` reads Foreground with the window in front — evidence: re-walk on 2db66de2 (scratch build, Finder frontmost, real clicks): "Open todz" gave Foreground, `lsappinfo info` "in front", System Events frontmost true; a popover row gave Foreground and in front. The first FAIL above is fixed
- [ ] Hidden, check a widget checkbox: the task completes and the menu bar count drops — BLOCKED: no widget to tap; the hidden reload itself passed (next row)
- [x] Hidden, widget reload and count: an agent-style add through the local API while hidden — evidence: `widget-snapshot.json` mtime 17:34:03 to 17:35:21, holds "Hidden agent task", menu bar item `todz, 4 left today`, app still UIElement
- [ ] Hidden, run a todz Siri intent or Shortcut (where the branch has them): it answers, the app stays hidden — BLOCKED: no helper shortcut for the scratch bundle exists and building a signed one was out of the time box
- [ ] Hidden, ⌘Q with the popover open quits; with a window open, ⌘Q quits — PARTIAL: with the popover open ⌘Q (Orca, system-shortcut allowed) ended with the process gone; ⌘Q with a window open not run
- [x] Settings open with the main window closed: the Dock icon shows; closing Settings hides it — evidence: red button on the main window with Settings open stayed Foreground and listed only Settings; ⌘W on Settings then UIElement, no window
- [x] Switch off, close the main window: the Dock icon and ⌘Tab entry stay (today's behaviour) — evidence: switch read 0, ⌘W on the main window left no window and `lsappinfo` Foreground (.pr-media/menu-bar-only/settings-switch-off.png)
- [x] A launch with no window shown (`open -g` or with the window closed at quit) has no Dock icon once launched — evidence: quit hidden, `open -g` relaunch: no window listed, UIElement after launch; eight immediate reads right after launch still said Foreground, so the icon shows briefly before the policy flips

## Edge cases found during execution

- [x] Minimize the window with the switch on, then open the popover — FIXED, re-walked on fe0dd7fe: Foreground before and after opening the popover with the window minimized (isMinimized true). Earlier FAIL on 2db66de2: `lsappinfo` read Foreground right after the minimize, then UIElement once the popover opened (the minimized window does not count as visible), so the Dock icon, which holds the minimized window, disappears. Expected: the Dock icon stays. Regression test needed (the rule or its window count must treat a miniaturized window as present). Reopening with `open -a` brought it back

- [x] The popover's "Open todz" while hidden leaves the app an accessory: the window is shown but the app is not activated (see the FAIL above); the policy waits for the window to become key and an inactive app's window never does until clicked. Regression needed: the open-window path from the popover must activate the app (or the policy must flip when the window is shown, not when it becomes key). — FIXED, re-walked on fe0dd7fe: hidden, Finder frontmost, real click on "Open todz": Foreground, in front; "Quit todz" quits (process gone)
- [ ] A fresh launch briefly shows as Foreground before flipping to accessory when no window opens — observed for the first reads after `open -g`; settles to UIElement.

## Adversarial review

- [ ] Claim 1: a reopened window always comes to the front with the app's menu bar — attack: reopen from each entry point while another app is frontmost; result: REFUTED for the popover's "Open todz" (window shown, app not active, not regular); held for a `todz-dev://` link and a Finder reopen
- [ ] Claim 2: nothing stops while hidden — attack: change a task from an agent while hidden and watch the count; result: held, count 3 to 4 and widget snapshot rewritten while UIElement
- [ ] Claim 3: the switch off is exactly today's behaviour — attack: diff the delegate's paths with the switch off; result:

## Coverage honesty

- The window observation and `NSApp.setActivationPolicy` are AppKit and checked by hand, not by a unit test.
