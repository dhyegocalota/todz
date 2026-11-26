# Plan: Move to Applications

**Spec:** spec.md
**Tier:** 🟡
**Seam:** a pure `ApplicationsMove` decision and an `ApplicationsMoveRun` sequence over an `ApplicationsMoveSystem` protocol in TodzKit; the app-side `ApplicationsMoveOffer` asks and `LiveApplicationsMoveSystem` holds the real effects, started from `AppDelegate` beside `AppUpdater`
**Assumptions (decided, owner can override):** ADR 0105

## File map

| Group | Paths owned | Developer sub-agent |
|-------|-------------|---------------------|
| G1 | `apps/macos/TodzKit/Sources/TodzKit/ApplicationsMove*.swift`, `apps/macos/TodzKit/Tests/TodzKitTests/ApplicationsMove*Tests.swift`, `ScratchApplicationsMoveSystem.swift`, `apps/macos/Todz/Updates/ApplicationsMoveOffer.swift`, `LiveApplicationsMoveSystem.swift`, `apps/macos/Copy/UpdateCopy.swift`, the `AppDelegate` launch hook, the sandbox exception in `project.yml` and `Todz.entitlements`, `tools/repository-shape/src/applications-mover.test.ts` | the loop |

## Sequencing

G1, one lane. Red tests first, then green.

## Steps

- [x] 1. Red: `ApplicationsMoveTests` and `ApplicationsMoveRunTests` over a scratch system; the build fails on the missing types.
- [x] 2. Green: `ApplicationsMove`, `ApplicationsMoveSystem`, `ApplicationsMoveOutcome`, `ApplicationsMoveRun`.
- [x] 3. `LiveApplicationsMoveSystem` and `ApplicationsMoveOffer` with the compile-time Debug gate, copy in `UpdateCopy`.
- [x] 4. The sandbox exception for `/Applications/Todz.app/` only, with its repository-shape test.
- [x] 5. `scripts/verify-macos.sh`: TodzKit tests and the Debug build, never launched.
