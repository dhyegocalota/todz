# Plan: The menu bar shows the pending count

**Spec:** spec.md
**Tier:** 🟡
**Seam:** `MenuBarLabel`, the status item's view over the app's one model, and a new `Settings` scene in `TodzApp`
**Assumptions (decided, owner can override):**
- The design's O1–O8 are taken as recommended (`design.md` § 7), the loop's calls.
- The toggle is a `UserDefaults` boolean read through `@AppStorage`, its key and default in one constant (ADR 0036).

## File map

| Group | Paths owned | Developer sub-agent |
|-------|-------------|---------------------|
| G1 | `apps/macos/TodzKit/Sources/TodzKit/MenuBarBadge.swift`, `apps/macos/TodzKit/Tests/TodzKitTests/MenuBarBadgeTests.swift` | `developer` |
| G2 | `apps/macos/Todz/MenuBar/MenuBarLabel.swift`, `apps/macos/Todz/Settings/` (new), `apps/macos/Todz/TodzApp.swift`, `apps/macos/Copy/` (the copy files `design.md` names), `apps/macos/README.md`, `README.md` (the gallery cell), `docs/screenshots/menu-bar-count/` | `developer` |

## Sequencing

G1 then G2, one developer: G2 reads G1's type.

## Steps

### G1

- [x] **Step 1 (evidence: 756958f, red text `MenuBarBadge is not implemented`; plan-review additions cbc8ba7 for `todayHeadingCount` and the registered default):** Red: `MenuBarBadgeTests`: the text for an open count and the toggle: off → `nil`; on and 0 → `nil`; 1 → "1"; 12 → "12"; 99 → "99"; 100 → "99+"; a negative count → `nil`. Commit the failing tests alone with a stub that fails with `MenuBarBadge is not implemented`.
- [x] **Step 2 (evidence: 60de2c2, cc3e6f7; `swift test` 488 tests pass):** Green: `MenuBarBadge` with the cap 99 and the overflow text as constants; the toggle's `UserDefaults` key and its default (on) as constants in the same type.

### G2

- [x] **Step 3 (evidence: cc3e6f7; the count is `AppModel.todayHeadingCount`, the heading's own number, after O4 was overturned; the label limits of design.md § 2 need a running app and go to the tester as hypotheses, not ticks):** `MenuBarLabel` shows the template icon, then the badge text when there is one, from `openCount(of: .today)` (O4) and the toggle through `@AppStorage`; the accessibility label per `design.md` (O6). Verify in a build the label limits `design.md` § 2 lists; strike through any that do not hold, with what was done instead.
- [x] **Step 4 (evidence: cc3e6f7, Debug build succeeds; ⌘, behaviour left to the tester):** A `Settings` scene with `SettingsView`: one switch in a grouped Form with its subtitle (O5, O7, O8); copy in the `*Copy.swift` file `design.md` names. ⌘, and the app menu's "Settings…" open it.
- [x] **Step 5 (evidence: the docs commit; the gallery cell is left to the lead, who adds the README cells):** Docs: the app's README names the count and the Settings window (purpose only). The root README's gallery gains a menu bar cell with the count (`docs/screenshots/menu-bar-count/01-count.png`, a real build, light, a fictional workspace), following ADR 0030 and `product-screenshots.test.ts`. Tester briefing.

## Failure modes

| Step | What breaks | How I notice (the concrete signal) | How I back out |
|------|-------------|------------------------------------|----------------|
| 3 | The status item renders only the image, dropping the text | The built app's menu bar shows the icon with no number while Today has open tasks | Render icon and number into one template `NSImage`, recorded in the plan as a struck step |
| 3 | The count lags the popover | Complete a task in the popover: the heading moves, the item does not | Read the same observable value the popover reads |
| 4 | `@AppStorage` in the label does not refresh when Settings changes | The toggle off leaves the number on until relaunch | Observe `UserDefaults` through the model |

**Steps with no backout:** none

## Z. Prove and ship

- [ ] **Tester briefing:** a developer wrote `tester-briefing.md`.
- [ ] **Tester run:** a fresh `tester` sub-agent executed `test-plan.md` and ticked every box with evidence.
- [ ] **Reviewer:** a fresh `reviewer` sub-agent returned a verdict; refutation of the three riskiest claims is recorded in `test-plan.md`.
- [ ] **/check-ui:** screenshots of the menu bar item and the Settings window from the real build (ADR 0026: Orca, not Playwright).
- [ ] **/open-pr:** gates passed, learnings sweep stated, PR opened.
