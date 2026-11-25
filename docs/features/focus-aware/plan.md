# Plan: Focus aware

**Spec:** spec.md
**Tier:** 🟡
**Seam:** a `ProactiveGate` in `TodzKit` owned by the `AppDelegate` beside the `AppModel`, fed by `TodzFocusFilter` (an App Intent in the app target) and read by future proactive surfaces; the Settings scene gains one row
**Assumptions (decided, owner can override):**
- `design.md`'s recommendations are the loop's calls; its copy is the copy.
- The gate is its own `@MainActor @Observable` type, not more state on `AppModel`: it has no server, session or cache concern, and later surfaces read only it.
- `perform()` reaches the app's gate through `AppDependencyManager` (App Intents, macOS 13+, the app targets 14.0), registered by the `AppDelegate` at launch; when the system runs the intent with the app not running, the app's launch read of `TodzFocusFilter.current` covers it (ADR 0054 §3).
- `current` failing at launch means not quiet.

## File map

| Group | Paths owned | Developer sub-agent |
|-------|-------------|---------------------|
| G1 app | `apps/macos/TodzKit/Sources/TodzKit/{ProactiveGate,ProactiveSurface,GateDecision}.swift` (new), `apps/macos/TodzKit/Tests/TodzKitTests/ProactiveGateTests.swift` (new), `apps/macos/Todz/Focus/` (new: `TodzFocusFilter.swift`), `apps/macos/Copy/FocusCopy.swift` (new), `apps/macos/Copy/SettingsCopy.swift`, `apps/macos/Todz/Settings/SettingsView.swift`, `apps/macos/Todz/AppDelegate.swift`, `apps/macos/Todz/TodzApp.swift`, `apps/macos/project.yml` (only if the new folders need it), `docs/features/focus-aware/tester-briefing.md` | `developer` (Opus) |
| Lead | `apps/macos/README.md`, `docs/product/README.md`, `README.md` (walk), `docs/screenshots/focus-aware/` | lead |

## Sequencing

One lane: every file is in the app, and the gate's type is what the intent and Settings read.

## Steps

### G1 app

- [ ] **Step 1:** Red: `ProactiveGateTests`: a new gate is not quiet and `admit(.dayClose)` is `.show`; after `setQuiet(true)`, `admit(.dayClose)` is `.held` and nothing is released; asking `.dayClose` twice and `.ribbon` once while quiet, then `setQuiet(false)`, releases `[.dayClose, .ribbon]` (each once, in the order first held); a second `setQuiet(false)` releases `[]`; `setQuiet(true)` twice then `setQuiet(false)` releases what was held once; after release, `admit` is `.show` again; a held surface released once is not released by a later quiet period that held nothing. Commit alone with stubs that `fatalError("<name> is not implemented")`.
- [ ] **Step 2:** Green: `ProactiveSurface`, `GateDecision`, `ProactiveGate`.
- [ ] **Step 3:** `TodzFocusFilter: SetFocusFilterIntent` with `@Parameter` "Keep todz quiet" default `false`, the title, description and display representation from `FocusCopy.swift` (`design.md`); `perform()` sets the gate's quiet state through `AppDependencyManager`; the `AppDelegate` owns one `ProactiveGate`, registers it, and at launch reads `TodzFocusFilter.current` (`isQuiet`), treating a throw as not quiet. Unit-test what is testable without the system: a seam that maps a filter value to `setQuiet` (for example a static `apply(isQuiet:to:)` the intent calls) with a test that `true` quiets and `false` releases.
- [ ] **Step 4:** Settings: the row from `design.md` (copy in `SettingsCopy.swift`), with the button opening the Focus settings pane; the gate reaches the Settings scene through the environment if the design shows the live state.
- [ ] **Step 5:** `swift test --package-path apps/macos/TodzKit` green with its count; `xcodegen` and an `xcodebuild` Debug build succeed; the built app's `Contents/Resources/Metadata.appintents` (or the extracted metadata) names `TodzFocusFilter`. Tester briefing.

### Lead

- [ ] **Step 6:** The app README names the Focus filter (purpose only); the product design names Focus quiet beside the nudge exception; the README walk gains the Settings row and the filter in System Settings, from the tester's real screenshots.

## Failure modes

| Step | What breaks | How I notice (the concrete signal) | How I back out |
|------|-------------|------------------------------------|----------------|
| 3 | The system does not list the todz filter | System Settings → Focus → Add Filter shows no todz | Check the intent metadata in the built app; the intent must be in the app target, not TodzKit |
| 3 | `AppDependencyManager` has no gate when `perform()` runs | the intent throws, the gate never quiets | Register in `applicationWillFinishLaunching`, before any intent can run |
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
