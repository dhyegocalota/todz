# Plan: Focus aware

**Spec:** spec.md
**Tier:** 🟡
**Seam:** a `ProactiveGate` in `TodzKit` owned by the `AppDelegate` beside the `AppModel`, fed by `TodzFocusFilter` (an App Intent in the app target) and read by future proactive surfaces; the Settings scene gains one row
**Assumptions (decided, owner can override):**
- `design.md`'s recommendations are the loop's calls; its copy is the copy.
- The gate is its own `@MainActor @Observable` type, not more state on `AppModel`: it has no server, session or cache concern, and later surfaces read only it.
- `perform()` reaches the app's gate through `AppDependencyManager` (App Intents, macOS 13+, the app targets 14.0), registered by the `AppDelegate` at launch; when the system runs the intent with the app not running, the app's launch read of `TodzFocusFilter.current` covers it (ADR 0054 §3).
- `current` failing at launch means not quiet.

## Plan review answers (2026-11-25)

R1 the gate delivers releases itself (`released`, `claimRelease`) · R2 an intent launch is stated in the spec and ADR 0054 and checked by hand · R3 registration in `AppDelegate.init` · R4 intent strings are literals, only the tile reads `FocusCopy` · R5 no intent seam; `FocusQuietNotice` in TodzKit carries the Settings state · R6 the Settings scene gets the gate, unconditionally · R7 `do`/`catch` launch read, `perform()` wins · R8 the metadata `grep` · R9 the Debug build named in the walk · R10 window heights from Orca · R11 coverage honesty names the "Quiet now" walk · R12 `Todz/FocusFilter/`.

## File map

| Group | Paths owned | Developer sub-agent |
|-------|-------------|---------------------|
| G1 app | `apps/macos/TodzKit/Sources/TodzKit/{ProactiveGate,ProactiveSurface,GateDecision,FocusQuietNotice}.swift` (new), `apps/macos/TodzKit/Tests/TodzKitTests/{ProactiveGateTests,FocusQuietNoticeTests}.swift` (new), `apps/macos/Todz/FocusFilter/` (new: `TodzFocusFilter.swift`), `apps/macos/Copy/FocusCopy.swift` (new), `apps/macos/Copy/SettingsCopy.swift`, `apps/macos/Todz/Settings/SettingsView.swift`, `apps/macos/Todz/AppDelegate.swift`, `apps/macos/Todz/TodzApp.swift`, `apps/macos/project.yml` (only if the new folders need it), `docs/features/focus-aware/tester-briefing.md` | `developer` (Opus) |
| Lead | `apps/macos/README.md`, `docs/product/README.md`, `README.md` (walk), `docs/screenshots/focus-aware/` | lead |

## Sequencing

One lane: every file is in the app, and the gate's type is what the intent and Settings read.

## Steps

### G1 app

- [x] **Step 1:** Red: `ProactiveGateTests`: a new gate is not quiet and `admit(.dayClose)` is `.show`; after `setQuiet(true)`, `admit(.dayClose)` is `.held` and `released` is empty; asking `.dayClose` twice and `.ribbon` once while quiet, then `setQuiet(false)`, makes `released` `[.dayClose, .ribbon]`; `claimRelease(.dayClose)` is true once, then false, and `released` becomes `[.ribbon]`; `claimRelease(.morningGlance)` (never held) is false; a second `setQuiet(false)` adds nothing; `setQuiet(true)` twice then `setQuiet(false)` releases each held kind once; after release, `admit` is `.show` again; a later quiet period that held nothing adds nothing; `applyLaunchRead(isQuiet: true)` quiets a fresh gate, but after `setQuiet(false)` a late `applyLaunchRead(isQuiet: true)` is ignored. `FocusQuietNoticeTests`: not quiet → `.notQuiet`, quiet → `.quietNow`. Commit alone with stubs that `fatalError("<name> is not implemented")`. — evidence: `5c930c9`; 12 tests, each run alone with `swift test --filter`, stop on `Fatal error: <isQuiet | setQuiet | applyLaunchRead | FocusQuietNotice> is not implemented` (texts in `tester-briefing.md`); one more test than listed, `aKindHeldAgainBeforeItsReleaseIsClaimedIsReleasedOnce`
- [x] **Step 2:** Green: `ProactiveSurface`, `GateDecision`, `FocusQuietNotice`, `ProactiveGate`. — evidence: `d7ae04d`; `ProactiveGateTests` and `FocusQuietNoticeTests` pass
- [x] **Step 3:** `Todz/FocusFilter/TodzFocusFilter.swift`: `SetFocusFilterIntent` with `@Parameter(title: "Keep todz quiet", default: false) var isQuiet`; the title `Quiet todz` and the description as literals in the intent (as `ToggleTaskIntent` does); `displayRepresentation` from `FocusCopy.swift` (`todz`, `Stays quiet` / `Shows as usual`); `perform()` calls the gate's `setQuiet(isQuiet)` on the main actor through `@Dependency`. The `AppDelegate` owns one `ProactiveGate`, registers it with `AppDependencyManager.shared.add` in its `init` (before any intent can run), and at launch reads `TodzFocusFilter.current` in a `do`/`catch` with an early return (a throw means not quiet; no `??`), passing the value to `applyLaunchRead`. — evidence: `2f2c9b1`; `project.yml` unchanged (the `Todz` target's `sources: [Todz, Copy]` takes the new folder)
- [x] **Step 4:** Settings: the row from `design.md` (`LabeledContent` after the two switches, the detail from `FocusQuietNotice` with two lines reserved, the push button opening `x-apple.systempreferences:com.apple.Focus-Settings.extension`); copy in `SettingsCopy.swift` as a switch over `FocusQuietNotice`; `TodzApp`'s `Settings` scene gets the gate in its environment and `SettingsView` reads `@Environment(ProactiveGate.self)`. — evidence: `2e18842`
- [x] **Step 5:** `swift test --package-path apps/macos/TodzKit` green with its count; `xcodegen` and an `xcodebuild` Debug build succeed; `grep -c TodzFocusFilter` and `grep -c "Keep todz quiet"` on `Todz.app/Contents/Resources/Metadata.appintents/extract.actionsdata` each at least 1. Tester briefing. — evidence: at `2e18842`, `Test run with 688 tests in 48 suites passed`; `** BUILD SUCCEEDED **`; both greps `1` (the file is one line; `TodzFocusFilter` occurs 3 times, and the action carries `systemProtocols: [com.apple.link.systemProtocol.FocusConfiguration]`); `tester-briefing.md`

### Lead

- [ ] **Step 6:** The app README names the Focus filter (purpose only); the product design names Focus quiet beside the nudge exception; the README walk gains the Settings row and the filter in System Settings, from the tester's real screenshots.

## Failure modes

| Step | What breaks | How I notice (the concrete signal) | How I back out |
|------|-------------|------------------------------------|----------------|
| 3 | The system does not list the todz filter | System Settings → Focus → Add Filter shows no todz | Check the intent metadata in the built app; the intent must be in the app target, not TodzKit |
| 3 | `AppDependencyManager` has no gate when `perform()` runs | the app crashes on a Focus change (an unregistered `@Dependency` traps) | Register in `AppDelegate.init`, before any intent can run (R3) |
| 3 | A Focus change launches todz with its main window | a window appears when a Focus starts with todz quit | Human checklist; if it does, open no window on an intent launch, struck here with the reason (R2) |
| 3 | `current` throws at every launch | the gate never starts quiet | treated as not quiet by design; the next `perform()` corrects it |
| 4 | The Focus pane URL does not open on macOS 26 | the button does nothing | fall back to opening System Settings at its root, struck in the plan with the reason |

**Steps with no backout:** none.

## Z. Prove and ship

- [ ] **Tester briefing:** the developer wrote `tester-briefing.md`.
- [ ] **Tester run:** a fresh `tester` sub-agent executed `test-plan.md` and ticked every box with evidence.
- [ ] **Reviewer:** a verdict; refutation recorded in `test-plan.md`.
- [ ] **Security reviewer:** a verdict.
- [ ] **/check-ui:** the Settings row and the todz filter in System Settings, from real builds (ADR 0026: Orca).
- [ ] **/open-pr:** gates passed, learnings sweep stated, PR opened.
