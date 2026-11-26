# Plan: Owner settings refresh

**Spec:** spec.md
**Tier:** 🟢
**Seam:** `AppModel` in `apps/macos/TodzKit/Sources/TodzKit/`, called from `AppDelegate.applicationDidBecomeActive` and `SettingsView`
**Assumptions (decided, owner can override):**
- A read is skipped, not queued, while another is in flight: activation and the Settings window often fire together.
- A save wins over a read by a per-setting count of saves started, compared before and after the read, so a read that began before a save never lands after it.

## File map

| Group | Paths owned | Developer sub-agent |
|-------|-------------|---------------------|
| G1 | `apps/macos/TodzKit/Sources/TodzKit/AppModel+OwnerSettingsRefresh.swift` (new), `AppModel.swift`, `AppModel+AgentNudge.swift`, `AppModel+DayEmail.swift`, `apps/macos/TodzKit/Tests/TodzKitTests/AppModelTests+OwnerSettingsRefresh.swift` (new), `FakeOwnerService.swift` | `developer` |
| G2 | `apps/macos/Todz/AppDelegate.swift`, `apps/macos/Todz/Settings/SettingsView.swift`, `docs/features/owner-settings-refresh/tester-briefing.md` | `developer` |

## Sequencing

G1 then G2, one developer.

## Steps

### G1

- [ ] **Step 1:** Red: the spec's model tests in `AppModelTests+OwnerSettingsRefresh.swift`, with a stub `refreshOwnerSettings()` that does nothing, committed alone.
- [ ] **Step 2:** Green: `refreshOwnerSettings()` and the per-setting save counts (`swift test` green).

### G2

- [ ] **Step 3:** The app calls the refresh on activation and when Settings appears (`xcodebuild` build green).
- [ ] **Step 4:** Tester briefing.

## Failure modes

| Step | What breaks | How I notice (the concrete signal) | How I back out |
|------|-------------|------------------------------------|----------------|
| 2 | A read lands after a save and flips the toggle back | the save-during-read tests | revert the commit |
| 2 | The refresh sends the time-zone `PATCH` or reads while signed out | the `service.calls` assertions | revert the commit |
| 3 | Every activation hammers `GET /owner` | the in-flight test; the walk counts requests | revert the commit |

**Steps with no backout:** none

## Z. Prove and ship

- [ ] **Tester briefing:** a developer wrote `tester-briefing.md`.
- [ ] **Tester run:** a fresh `tester` sub-agent executed `test-plan.md` and ticked every box with evidence.
- [ ] **Reviewer:** a fresh `reviewer` sub-agent returned a verdict.
- [ ] **/open-pr:** gates passed, learnings sweep stated, PR opened.
