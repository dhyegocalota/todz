# Tester briefing: Security fixes

Written by the developer sub-agents when their steps are done. The developers do not run `test-plan.md` and do not declare the feature works. Each lane keeps its own section.

## Lane W

### What changed

- Lane W fills this in.

### How to run

Lane W fills this in.

### Red today, green after

| Test | Red before the change because | Green after because |
|------|--------------------------------|---------------------|
| Lane W fills this in. |  |  |

### Hypotheses to attack

1. Lane W fills this in.

### Known gaps

- Lane W fills this in.

## Lane M

### What changed

- Commits: red `2cd8679`, green `806a3ef` (TodzKit), `be11717` (project, plists, app, widgets), `bc1d487` (day close), `f799eed` (observer move, a behaviour change).
- `AppLinkScheme` (`release` = `todz`, `debug` = `todz-dev`) reads `TodzLinkScheme` from an `Info.plist` (`of(info:)`, `of(bundle:)`). `SignInLink`, `WidgetLink` and `IncomingLink` take the scheme and refuse the other build's; `WidgetLink.url(scheme:)` writes it. `OwnerService.requestSignInLink(…linkScheme:)` sends `app_link_scheme`; `AppModel` takes `linkScheme` at init and passes it inside the `askedServer` guard.
- `project.yml`: `TODZ_URL_SCHEME` (`todz-dev` Debug, `todz` Release); app `CFBundleURLSchemes` is `$(TODZ_URL_SCHEME)`; `TodzLinkScheme` in both plists (regenerated and committed). `AppConfiguration.linkScheme` and `WidgetLinkConfiguration.linkScheme` call `fatalError` when the key is missing or unknown. The plan named the file `WidgetConfiguration.swift`; `WidgetConfiguration` is SwiftUI's protocol, so the type and file are `WidgetLinkConfiguration`.
- `DayCloseCoordinator` takes `closePopover`; `popoverShown()` of an unengaged stale mode whose show answers the click (within `popoverShowWait`) ends the mode and closes the panel once. `AppDelegate` passes `panel.close()` (wired in `be11717` so the app target compiled).
- The `onChange(of: model.activeWorkspaceIdentifier)` observer moved from `MenuBarToday` to `MenuBarPopover`.

### How to run

- `swift test --package-path apps/macos/TodzKit` (842 tests in 58 suites, green).
- `pnpm --filter @todz/repository-shape test:unit -- macos-identities`.
- `cd apps/macos && xcodegen generate`, then `xcodebuild build -project Todz.xcodeproj -scheme Todz -configuration Debug|Release -derivedDataPath build` (both succeed, no warnings). Built plists read with `plutil -extract`: Debug app `CFBundleURLSchemes.0` `todz-dev`, `TodzLinkScheme` `todz-dev`, widgets `TodzLinkScheme` `todz-dev`; Release prints `todz` in all three.
- `pnpm verify`: 7 gates green at `f799eed` (product).

### Red today, green after

Red run (`2cd8679`): `842 tests in 58 suites failed after 1.6 seconds with 18 issues`; the shape test `2 failed | 5 passed`.

| Test | Red before the change because | Green after because |
|------|--------------------------------|---------------------|
| `AppLinkSchemeTests.theKeyNamesTheScheme(text:expected:)` | `Expectation failed: AppLinkScheme.of(info: [linkSchemeKey: text]) == expected` (both cases) | `of(info:)` reads `TodzLinkScheme` |
| `SignInLinkTests.aDebugLinkIsASignInLinkOfTheDebugApp` | `Expectation failed: link?.token == token` | the parser compares `scheme.rawValue` |
| `SignInLinkTests.aReleaseLinkIsNotASignInLinkOfTheDebugApp` | `Expectation failed: try SignInLink(url: url("todz://sign-in?token=…"), scheme: .debug) == nil` | same |
| `SignInLinkTests.aDebugLinkIsNotASignInLinkOfTheReleaseApp` | pin: refused by the old `todz` check (green on arrival) | same |
| `WidgetLinkTests.aDebugLinkIsWrittenInTheDebugScheme` | `Expectation failed: WidgetLink.today.url(scheme: .debug).scheme == "todz-dev"` and `….absoluteString == "todz-dev://today"` | `url(scheme:)` builds from the scheme |
| `WidgetLinkTests.aDebugLinkIsReadByTheDebugAppAndNotByTheReleaseApp` | `Expectation failed: WidgetLink(url: url, scheme: .debug) == .today` | the parser compares `scheme.rawValue` |
| `WidgetLinkTests.aReleaseLinkIsNotReadByTheDebugApp` | `Expectation failed: WidgetLink(url: try #require(URL(string: "todz://today")), scheme: .debug) == nil` | same |
| `OwnerAPITests.requestSignInLinkPosts…TheAppsScheme…(linkScheme:)` | `Expectation failed: sent == body as NSDictionary` (both schemes) | the body carries `app_link_scheme` |
| `OwnerCodingTests.signInLinkRequestBodyPinsItsJson` | `Expectation failed: try encodedText(body) == #"{"app_link_scheme":"todz-dev","email":…}"#` | `appLinkScheme` is encoded |
| `AppModelTests+SignInLink` and `+SignInChallenge` (5 tests: `askingForALinkSendsTheChallengeOfAFreshVerifierAndKeepsThePendingLink`, `sendingAgainWithinTheLifetimeReusesTheVerifierAndMovesTheExpiry`, `askingSendsTheHeldChallengeTokenThenClearsItAndAdvancesTheRound`, `sendingAgainAfterTheLifetimeMakesANewVerifier`, `askingForAnotherAddressMakesANewVerifier`) | `Expectation failed: harness.service.calls == [.requestSignInLink(…, linkScheme: harnessLinkScheme)]`; the red model sent `.release`, the harness model is `.debug` | the model passes its own `linkScheme` |
| `DayCloseCoordinatorTests.aShowAfterMidnightThatAnswersTheClickEndsTheUnengagedModeAndClosesThePopoverOnce` | `Expectation failed: harness.popover.closings == 1` | `popoverShown()` calls `closePopover` |
| `DayCloseCoordinatorTests.anOpeningThatCrossesMidnightEndsTheUnengagedModeAndClosesThePopoverOnce` | `Expectation failed: harness.popover.closings == 1` | same, through `check()` → `open()` |
| `DayCloseCoordinatorTests.pinAShowAfterMidnightOfAnEngagedModeEndsItAndClosesNothing` | pin: green on arrival | stays green |
| `DayCloseCoordinatorTests.pinAShowAfterTheClickWaitEndsTheModeAndClosesNothing` | pin: green on arrival (guards the in-flight condition) | stays green |
| `ChallengeNavigationTests` (`todz-dev://sign-in?…` in both refused lists) | pin: green on arrival | stays green |
| `macos-identities.test.ts` `each configuration registers its own link scheme, and Release keeps todz` | `AssertionError: expected undefined to be 'todz-dev'` | `TODZ_URL_SCHEME` per configuration |
| `macos-identities.test.ts` `the app registers the configuration scheme and both plists name it for the code to read` | `AssertionError: expected 'name: Todz\noptions:…' not to contain 'CFBundleURLSchemes: [todz]'` | `project.yml` and both plists reference `$(TODZ_URL_SCHEME)` |

### Hypotheses to attack

1. A Debug build registers only `todz-dev` and a Release build only `todz`: open `todz://sign-in?…` and `todz-dev://sign-in?…` with both installed (after the LaunchServices cleanup in the spec's human checklist); each opens only its own app.
2. A sign-in link requested from the Debug app (to a local or production Worker) is mailed with `&app=todz-dev` once Lane W lands; the Release app's with `&app=todz`.
3. Widget taps in a Debug build open the Debug app (`todz-dev://today`, `todz-dev://task/…`) and Release's open Release.
4. The widget extension does not crash at launch: its built `Info.plist` carries `TodzLinkScheme` in both configurations.
5. A day close opened at 23:59 whose show lands after midnight closes the popover once and leaves no mode on; a popover the owner opens himself after midnight is never closed by the stale mode.
6. Moving the workspace observer closes nothing outside a day close, including while signed out, loading or naming.

### Known gaps

- The SwiftUI path of the observer move (step 15) has no automated test; only `DayCloseCoordinator.workspaceChanged()` is covered.
- `AppConfiguration.linkScheme` and `WidgetLinkConfiguration.linkScheme` (`fatalError` on a missing key) are not unit tested; the built-plist `plutil` reads are their proof.
- `AppDelegate`'s `closePopover` wiring (`panel.close()`) is exercised only through a real show after midnight, not by a test.
- A Release app built before Lane W deploys works only until the Worker requires `app_link_scheme`; the Release rebuild follows the deploy (spec, human checklist).
- `swift test` ran once green (842 tests); the flaky `macos` gate of item 9 belongs to Lane T.

## Lane T

### What changed

- Lane T fills this in.

### How to run

Lane T fills this in.

### Red today, green after

| Test | Red before the change because | Green after because |
|------|--------------------------------|---------------------|
| Lane T fills this in. |  |  |

### Hypotheses to attack

1. Lane T fills this in.

### Known gaps

- Lane T fills this in.
