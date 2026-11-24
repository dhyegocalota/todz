# 0024. The macOS app is an XcodeGen project over a local Swift package

- Status: Proposed
- Date: 2026-11-24
- Deciders: Claude (the build loop's call, pending the owner); Dhyego Calota (owner) may overturn it
- Inspired by: [the v1 product design](../product/README.md) (macOS app; Stack: `apps/macos`, an Xcode project generated from a checked-in XcodeGen spec), the `mac-app-shell` spike of 2026-11-24, [ADR 0005](0005-the-local-gate-runs-what-the-diff-can-break.md)

## Context

The product design fixes SwiftUI, macOS 14 and a checked-in XcodeGen spec, and names three later surfaces that share the same code: the main window, the menu bar extra and the widgets. It leaves open how the Swift code is cut, how it is tested, how it is signed while the owner has no signing identity, and how the local gate runs it. The machine has Xcode 27.2, XcodeGen 2.48.0 and no codesigning identity.

## Decision

1. `apps/macos/project.yml` is the only project file in git; the generated `Todz.xcodeproj` is ignored. The app target `Todz` holds only SwiftUI views, the app entry and the copy enums.
2. Everything that is not a view lives in the local Swift package `apps/macos/TodzKit`: the JSON models, the owner API client, the session vault, the view rules (Inbox, Today, Upcoming, Done, project) and the observable app model. The menu bar extra and the widgets link the same package later.
3. Tests use Swift Testing in `TodzKit`'s test target and run with `swift test`. The app target is proven by building it; its walk is the tester's ([ADR 0026](0026-a-native-app-is-walked-with-computer-use-and-recorded-from-its-screenshots.md)).
4. Swift files follow the platform's convention: one type per file, named after the type in PascalCase. Copy lives in `…Copy.swift` enums, the Swift form of the `*-copy.ts` rule.
5. Until a team exists, the app builds with an ad-hoc signature (`CODE_SIGN_IDENTITY = "-"`), sandboxed, with `com.apple.security.network.client` and `NSAllowsLocalNetworking` so it reaches `wrangler dev` on localhost. The spike proved such a build launches and gets the Worker's 401.
6. `scripts/verify.sh` gains a `macos` gate, mapped from `apps/macos/*`: `swift test` in `TodzKit`, then `xcodegen generate` and an `xcodebuild build` of the `Todz` scheme into a git-ignored derived data folder. It fails with the doctor's fix line when `xcodebuild` or `xcodegen` is missing, as the secrets gate does for gitleaks.

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| XcodeGen app over a local Swift package (chosen) | `swift test` runs headless in seconds; the widget and menu bar targets reuse the package; the app target stays thin | two build systems to keep in step | — |
| Everything in the app target, tested with an Xcode unit-test bundle | one target | tests need a host app and `xcodebuild test`; the widget extension cannot link the code | slower and does not share |
| An Xcode project checked in by hand | no XcodeGen | merge conflicts in `project.pbxproj`; contradicts the product design | the design names XcodeGen |
| A `package.json` for `apps/macos` so the pnpm gates run it | no change to `verify.sh` | `pnpm -r typecheck` on Linux CI would fail | breaks the hosted checks |

## Consequences

- A change under `apps/macos/` runs the `macos` gate and nothing from pnpm but the always-on gates.
- `TodzKit` mirrors the enum values of `libs/types` by hand; a value added there must be added here.
- The App Group, Sign in with Apple and the Keychain wait for a signing team ([ADR 0025](0025-the-session-secret-lives-in-a-private-file-until-the-app-has-a-team.md)).

## Evidence

The spike (scratchpad, not committed): `xcodegen generate`, `swift test` with Swift Testing, and an ad-hoc signed sandboxed build that reached `http://localhost:8787/owner` and got 401.

## Revisit when

- The owner adds a signing team: switch to automatic signing with the Personal Team.
- A second app target (menu bar, widgets) lands: confirm the package split still holds.
