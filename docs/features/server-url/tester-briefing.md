# Tester briefing: Server URL

Written by the developer sub-agents when their steps are done. The developers do not run `test-plan.md` and do not declare the feature works. Each lane keeps its own section.

## Lane A (the macOS app)

### What changed

- `TodzKit/ServerAddress`, `ServerAddressIssue`, `ServerName`, `ServerPreference` — the checked address (https, loopback http, no path/query/fragment/credentials, default port dropped), its display name and the `serverURL` defaults key; `hasUnreadableValue` tells a present but unparseable value from none.
- `TodzKit/OwnerAPI.health()`, `ServerHealthAnswer`, `ServerProbeOutcome`, `ServerTiming` — `GET /health`, 10 s `timeoutInterval`, redirects refused (a `URLSessionTaskDelegate` answers `nil`), anything but `{"service":"todz","origin":…}` is `notTodz`; `OwnerAPI.probe(typedAddress:)` maps a transport failure to `unreachable`.
- `TodzKit/ServerSwitchFlow` — the pure reducer behind the form (`idle`, `checking`, `refused`, `notTodz`, `answersAs`, `alreadyInUse`, `confirming`, `switching`, `switched`, `failed`); it ignores outcomes outside `checking`.
- `TodzKit/AppModel`, `AppModel+Server` — `init(defaultURL:preference:connect:probe:…)`, `serverURL`, `isSwitchingServer`, `isSignedIn`, `isOnDefaultServer`, `probeServer(_:)`, `switchServer(to:)`; `ServerConnection` holds the rebuilt owner service and change signals; `eraseLocalData()` is shared by `signOut()` and the switch; `openSession`, `requestSignInLink` and `loadSignInMethod` drop answers that arrive after the server changed (a session they opened is signed out at the service that issued it); an unparseable stored value erases session, cache, outbox, pending link and widgets at init and clears the value (when an erase throws, the launch stays signed out with `sessionUnreadable` and never reads the vault).
- `apps/macos/project.yml` — Release `TODZ_ALLOWS_LOCAL_NETWORKING` is `"YES"`; `tools/repository-shape/src/macos-identities.test.ts` pins it.
- `Todz/Server/ServerAddressForm.swift`, `ServerDisclosure.swift` — one form for both surfaces (`row` in Settings, `column` on sign-in) that owns the flow, the confirmation dialog and `Use todz cloud`; the disclosure is the sign-in `Server: <host> ›` line.
- `Todz/Settings/SettingsView.swift`, `Todz/SignIn/{SignInScreen,AddressSlot,CredentialSlot,ChallengeView}.swift`, `Todz/MainWindow/KeyScreen/KeyScreen.swift`, `Todz/AppDelegate.swift`, `Todz/AppConfiguration.swift` — the consumers read the model; `.task(id: model.serverURL)` reloads the sign-in method; the slots keep focus off themselves while the server form is open.
- `Copy/{SettingsCopy,SignInCopy,ErrorCopy,AccessibilityCopy,KeyScreenCopy}.swift`, `Copy/ServerAddressIssue+Copy.swift` — design §§ 4 and 9, word for word. `ErrorCopy.serverSwitchFailed(server:)` is the plan review's string ("This Mac's copy could not be erased, so todz stayed on {server}."); design § 9's ErrorCopy list still carries an older "Try again." line, the plan's Global Constraints say the review string wins.

### How to run

Two Workers on different ports (Lane S supplies `/health`; merge both lanes first):

```bash
pnpm --filter @todz/api exec wrangler dev --port 8787
pnpm --filter @todz/api exec wrangler dev --port 8791 --var PUBLIC_ORIGIN:http://localhost:8791
cd apps/macos && xcodegen generate
xcodebuild build -project Todz.xcodeproj -scheme Todz -configuration Debug -derivedDataPath build
open build/Build/Products/Debug/Todz.app
```

The Release bundle is `apps/macos/build/Build/Products/Release/Todz.app` (same command with `-configuration Release`); read the Release container before the walk (test plan preflight). Unit tests: `swift test --package-path apps/macos/TodzKit`.

### Red today, green after

| Test | Red before the change because (text the red run printed) | Green after because |
|------|------------------------------------------------------------|----------------------|
| `ServerAddressTests`, `ServerNameTests`, `ServerPreferenceTests` (red 78b8a79, green 6783e40) | each run alone stops with `TodzKit/ServerAddress.swift:9: Fatal error: ServerAddress.checked is not implemented` (the name and preference tests build their address through `checked`, so they never reach their own stub; the preference stubs read `ServerPreference.hasUnreadableValue is not implemented`) | `checked`, `ServerName.of` and `ServerPreference` implemented; 8 tests pass |
| `OwnerAPIHealthTests` (red 6ea69ce, green 49a34b9) | `TodzKit/OwnerAPI.swift:75: Fatal error: OwnerAPI.health is not implemented` | `health()` and `probe(typedAddress:)` implemented; 7 tests pass. The green commit also fixes the redirect stub of the test (after `wasRedirectedTo` it now delivers the redirect response, as the real transport does when the task refuses the redirect); the red run never reached it |
| `ServerProbeOutcomeTests` | `TodzKit/ServerProbeOutcome.swift:10: Fatal error: ServerProbeOutcome.of is not implemented` | `of(answer:typedAddress:)` implemented |
| `ServerSwitchFlowTests` | `TodzKit/ServerSwitchFlow.swift:24: Fatal error: ServerSwitchFlow.submit is not implemented` (the `useDefault` case stops on `ServerSwitchFlow.useDefault is not implemented`) | the reducer implemented |
| `tools/repository-shape/src/macos-identities.test.ts` "local networking is allowed in Debug and Release" | `AssertionError: expected 'NO' to be 'YES'` | `project.yml` Release flag is `"YES"` |
| `AppModelTests+Server` (red 57e7100, green 4020b35) | the suite stops at its first switch: `TodzKit/AppModel+Server.swift:13: Fatal error: AppModel.switchServer is not implemented`; the two unreadable-stored-address tests, which never switch, fail on assertions: `Expectation failed: harness.vault.secret == nil` (also `store.owner`, `store.outbox`, `pendingLinks.link`, then `phase == .signedOut(notice: nil)`, `service.calls == []`, `!preference.hasUnreadableValue`) and `phase == .signedOut(notice: .sessionUnreadable)` | `switchServer(to:)` and the init erase implemented |
| `AppModelTests+Server` `aNewModel…`, `probingAsksTheInjectedProbe…` | pins: green when they landed in the red commit (the init and `probeServer` are part of it) | n/a |
| `theModelSaysWhetherItIsSignedInAndWhetherItIsOnTheDefaultServer` | pin: lands with its two computed properties in A7 (b7a43ab) | n/a |

Counts: `swift test` was 690 tests in 48 suites before; it is 748 tests in 54 suites after (the existing `signOut` tests pass unchanged after the `eraseLocalData()` extraction).

Mutation checks I ran: refusing the redirect (`completionHandler(nil)` → `completionHandler(request)`) turns `aRedirectIsNotFollowedAndIsNotTodz` red; inverting the stale-session guard in `openSession` turns `aRedeemFinishingAfterASwitchIsDroppedAndSignedOutAtItsService` red.

### Hypotheses to attack

1. Hypothesis: the switch erases the vault, the store, the pending link and every sign-in field before the factory is called, and an erase that throws leaves the old server in place. Break it by: making the Application Support folder read-only mid-walk, then switching; the field must stay on the old URL with `This Mac's copy could not be erased, so todz stayed on {server}.`
2. Hypothesis: nothing from the old server reaches the new one. Break it by: starting a sign-in link request and trying to switch (refused, `Wait until sign-in or the switch finishes.`), opening a stale `todz://sign-in?token=…` after a switch (`Open the link on the Mac that asked for it, or send a new one.`), and holding the old Worker's responses with a slow network.
3. Hypothesis: `http://localhost:<port>` and `http://127.0.0.1:<port>` pass App Transport Security in a Release build, because the Info.plist holds `NSAllowsLocalNetworking` as the string `YES` (as Debug has since ADR 0044; `plutil -p` on the built Release plist prints `"NSAllowsLocalNetworking" => "YES"`). Break it by: W26 on the A3 commit (flag still `NO`) and again on this head.
4. Hypothesis: typing `127.0.0.1:8787` for a Worker whose `PUBLIC_ORIGIN` is `http://localhost:8787` is refused naming the origin; `https://example.com/path`, `http://example.com`, `localhost:8787` (no scheme) and `ftp://x` are refused before any request; a redirecting host answers `No todz server answered at that address.`
5. Hypothesis: the confirmation dialog's destructive button switches and Cancel, Escape and click-away leave everything as it was. Break it by: dismissing the dialog three ways, then pressing Switch… again; the destructive action relies on SwiftUI running the button action before it sets `isPresented` to false.
6. Hypothesis: while the sign-in server field is open and focused, the email and identity fields do not take focus back (window deactivate and reactivate; a refused address). Break it by: switching windows with the field expanded.
7. Hypothesis: after a switch from Settings the sign-in screen leaves `Getting ready…` for the new server's method, and its collapsed line names the new host.
8. Hypothesis: a stored `serverURL` that does not parse (`defaults write dev.todz.Todz.debug serverURL "not a url"`) launches signed out on the default with no session file, cache, outbox or pending link left, and the value is gone after the launch.

### Known gaps

- The redeem and link-request "answer after a switch" tests clear `isSigningIn` / `isRequestingLink` by hand, because a switch refuses while either is true; the guard is defence in depth for a flag that was lost, and no public sequence reaches it. The reachable race (a method load) is tested without that trick.
- `isSwitchingServer` is set and cleared inside one synchronous stretch of `switchServer`, so no view can observe it as `true`; the form shows `Switching…` from its own flow state, and `isSwitchingServer` guards re-entry only.
- The probe does not check the `cache-control: no-store` header of `/health` (the plan's test cases do not list it); it checks the body's `service` and `origin`.
- The Release Turnstile web view on loopback is not walked (plan R12).
- `ServerAddressForm` has no unit test (it is a SwiftUI view in the app target, which has no test target); its logic lives in `ServerSwitchFlow` and the model, and the walk covers the rest.
- `ServerAddress.checked` treats any whitespace inside the text as `invalid` (`not a url`), since `URLComponents` otherwise accepts it as a relative path.
- The switched line is kept by the form's `@State`; whether it clears when Settings closes depends on SwiftUI discarding the Settings scene content, which the walk must check.
