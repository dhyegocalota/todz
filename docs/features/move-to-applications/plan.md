# Plan: Move to Applications

**Spec:** spec.md
**Tier:** 🟡
**Seam:** a pure `ApplicationsMove` in TodzKit decides; an app-side `ApplicationsMover` in `apps/macos/Todz/Updates/` asks and moves, started from `AppDelegate` beside `AppUpdater`
**Assumptions (decided, owner can override):** ADR 0078

## File map

| Group | Paths owned | Developer sub-agent |
|-------|-------------|---------------------|
| G1 | `apps/macos/TodzKit/Sources/TodzKit/ApplicationsMove.swift`, `apps/macos/TodzKit/Tests/TodzKitTests/ApplicationsMoveTests.swift`, `apps/macos/Todz/Updates/ApplicationsMover.swift`, `apps/macos/Copy/UpdateCopy.swift`, the `AppDelegate` launch hook, `apps/macos/README.md` if it lists the updates | `developer` |

## Sequencing

G1, one developer. Red commit (the tests), then green.

## Steps

1. Red: `ApplicationsMoveTests` for `shouldOffer(bundlePath:isTranslocated:homeDirectory:currentVersion:declinedVersion:hasUpdateFeed:)`, the destination path, and the declined-version record and read in `UserDefaults(suiteName:)`.
2. Green: `ApplicationsMove` in TodzKit, matching `UpdateNote`'s shape (an enum of static functions and storage keys).
3. `ApplicationsMover` (MainActor): at launch, if `ApplicationsMove.shouldOffer`, an `NSAlert` with `UpdateCopy` strings; Move copies, strips quarantine, trashes the original (translocation original through `SecTranslocateCreateOriginalPathForURL`, loaded with `dlsym`), opens the new copy with `NSWorkspace.openApplication(at:configuration:)` with `createsNewApplicationInstance`, then `NSApp.terminate`; Not now records the version.
4. Build the app (`xcodegen` + `xcodebuild`), run TodzKit tests, `pnpm verify`.
