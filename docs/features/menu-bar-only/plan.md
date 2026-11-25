# Plan: Menu bar only

**Spec:** spec.md
**Tier:** 🟢
**Seam:** `AppDelegate` observes the app's windows and applies the activation policy; the decision is a pure TodzKit type.
**Assumptions (decided, owner can override):**
- An ordinary window is a visible window that can become main: the main window or Settings. The popover and the morning glance panel cannot.
- The switch needs no observer: flipping it happens with Settings open, so the app is regular either way until Settings closes.

## File map

| Group | Paths owned | Developer sub-agent |
|-------|-------------|---------------------|
| G1 | `apps/macos/TodzKit/Sources/TodzKit/ActivationPolicyRule.swift`, `AppActivation.swift`, `MenuBarOnlyPreference.swift`, their tests, `apps/macos/Todz/AppDelegate*.swift`, `apps/macos/Todz/TodzApp.swift`, `apps/macos/Todz/Settings/SettingsView.swift`, `apps/macos/Copy/SettingsCopy.swift`, `apps/macos/README.md`, `docs/adr/0074-*.md` | `developer` |

## Sequencing

One lane: the rule, then the preference, then the wiring.

## Steps

### G1

- [ ] **Step 1:** red: `ActivationPolicyRuleTests` for every case, against a stub that stops on `ActivationPolicyRule.policy is not implemented`.
- [ ] **Step 2:** green: the rule.
- [ ] **Step 3:** red: `MenuBarOnlyPreferenceTests` (on by default, the storage key, registering keeps the owner's choice, another searched domain is ignored), against a stub that stops on `MenuBarOnlyPreference.isOn is not implemented`.
- [ ] **Step 4:** green: the preference, registered at launch.
- [ ] **Step 5:** the app: observe windows becoming key and closing, apply the rule after launch, the Settings row and its copy.
- [ ] **Step 6:** xcodegen, Debug build, `swift test`, `pnpm verify`.

## Failure modes

| Step | What breaks | How I notice (the concrete signal) | How I back out |
|------|-------------|------------------------------------|----------------|
| 5    | A reopened window stays behind other apps or the app's menu bar is missing | The window opens without focus after "Open todz" | Turn the switch off in Settings; revert the wiring commit |
| 5    | The app is an accessory with a window open | No Dock icon while the main window shows | Turn the switch off; revert the wiring commit |

**Steps with no backout:** none

## Z. Prove and ship

- [ ] **Tester briefing:** a developer wrote `tester-briefing.md`.
- [ ] **Tester run:** a fresh `tester` sub-agent executed `test-plan.md` and ticked every box with evidence.
- [ ] **Reviewer:** a fresh `reviewer` sub-agent returned a verdict; refutation of the three riskiest claims is recorded in `test-plan.md`.
- [ ] **/check-ui:** screenshots of the Settings row recorded and uploaded.
- [ ] **/open-pr:** gates passed, learnings sweep stated, PR opened.
