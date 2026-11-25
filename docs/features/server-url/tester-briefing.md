# Tester briefing: Server URL

Written by the developer sub-agents when their steps are done. The developers do not run `test-plan.md` and do not declare the feature works.

## Lane S (server and docs)

### What changed

- `apps/api/src/health.ts` (new): `serveHealth` answers `{"service":"todz","origin":<PUBLIC_ORIGIN>}` as JSON with `cache-control: no-store` for GET; any other method, or a Worker without `PUBLIC_ORIGIN`, gets the empty 404. The service name `todz` is a constant in this file (the plan said `libs/types`, which Lane S does not own; the lead may move it).
- `apps/api/src/index.ts`: `fetch` checks `/health` before `hostKindOf`, so the API host, the site host and an unknown host all answer the API origin.
- `apps/api/wrangler.jsonc`: `/health` joins `assets.run_worker_first`.
- `apps/api/src/http-header.ts`, `turnstile-page.ts`, `site/admin-paths.ts`: one `NO_STORE` constant replaces the literals.
- `apps/api/scripts/server/ready-line.ts` (pure) and `cli.ts` (the one file that reads the disk): print `todz server ready: <PUBLIC_ORIGIN>  →  paste it in todz › Settings › Server`. `apps/api/package.json`: `server:deploy` is `wrangler deploy && tsx scripts/server/cli.ts`.
- `apps/api/vitest.config.mts`, `tsconfig.json`, `tsconfig.scripts.json`: `test/server/**` runs in the node pool and is typechecked with the scripts.
- `docs/self-host.md`: step 4 and step 6 and Updating use `server:deploy`; step 4's checks gain the `/health` curl; step 7 drops the `TODZ_API_BASE_URL` bullet and ends with paste-in-Settings; Updating says server first, then app. `apps/api/src/site/generated/self-host-html.ts` regenerated.
- `docs/runbooks/deploy-the-api.md` step 13: a `/health` curl and expected body, "When all fourteen pass".
- `apps/api/README.md`: one purpose sentence.
- Tests: `apps/api/test/health.test.ts`, `apps/api/test/server/ready.test.ts`, and pins in `tools/repository-shape/src/{api-source,self-host,runbooks}.test.ts`.

### How to run

```bash
pnpm --filter @todz/api exec vitest run --project workers test/health.test.ts
pnpm --filter @todz/api exec vitest run --project node test/server
pnpm --filter @todz/api typecheck
pnpm --filter @todz/api site:check
pnpm --filter @todz/repository-shape exec vitest run src/api-source.test.ts src/self-host.test.ts src/runbooks.test.ts
pnpm --filter @todz/api dev
curl -sS -i http://localhost:8787/health
```

### Red today, green after

| Test | Red commit | Printed failure | Green commit |
|------|------------|-----------------|--------------|
| `apps/api/test/health.test.ts` (API host, site host, unknown host, query string) | 97324da | `AssertionError: expected 404 to be 200 // Object.is equality` (4 failed, 4 passed: the `/`, trailing slash and POST cases are pins that were green) | 6b0b1fe |
| `tools/repository-shape/src/api-source.test.ts` the static assets never answer before the Worker on an API path | 97324da | `expect(configuration).toMatch(ASSETS_PATTERN)` failed against the unchanged `run_worker_first` list | 6b0b1fe |
| `apps/api/test/server/ready.test.ts` (4 tests) | e6badb8 | `Error: readyLine is not implemented`, `Error: publicOriginOf is not implemented` and `expected [Function] to throw error including 'PUBLIC_ORIGIN is missing from the Wra…' but got 'publicOriginOf is not implemented'` | 56c5ca2 |
| `self-host.test.ts` deploy step and Updating deploy with the script | e6badb8 | `AssertionError: expected '\n\n```bash\npnpm --filter @todz/api …' to contain 'pnpm --filter @todz/api server:deploy'` | 56c5ca2 |
| `self-host.test.ts` never asks a fork to rebuild | e6badb8 | `AssertionError: expected '# Self-host todz\n\nRun your own todz…' not to contain 'TODZ_API_BASE_URL'` | 56c5ca2 |
| `self-host.test.ts` Updating updates the server before the app | e6badb8 | `AssertionError: expected '\n\nPull from upstream, then run:\n\n…' to contain 'Update the server first, then the app'` | 56c5ca2 |
| `runbooks.test.ts` smoke check counts the health route | e6badb8 | `AssertionError: expected '13. **Smoke check the live routes.** …' to contain 'curl -sS https://api.todz.app/health'` | 56c5ca2 |

The `PROJECT_KEYS` change in `self-host.test.ts` (drops `TODZ_API_BASE_URL`) is a pin: green when it landed.

### Hypotheses to attack

1. Hypothesis: `/health` answers from the Worker, never from the static assets, on the deployed host. Break it by: `curl -sS -i https://api.todz.app/health` after a deploy, and by deleting `"/health"` from `run_worker_first` to see the pin fail.
2. Hypothesis: every host answers the API origin, including the site host and an unknown host. Break it by: `curl -sS --resolve` style requests with another `Host`, or `wrangler dev` on 8788 with `PUBLIC_ORIGIN` of 8787.
3. Hypothesis: only GET answers. Break it by: POST, HEAD, OPTIONS, `/health/`, `/Health`, `/health.json`.
4. Hypothesis: a Worker with no `PUBLIC_ORIGIN` answers the empty 404, not a body with `undefined`. Break it by: running the Worker with the variable removed (no test pins this; the code path is `serveHealth`'s second guard).
5. Hypothesis: `server:deploy` prints the ready line only after a successful deploy. Break it by: running it with a bad `account_id` and checking that nothing prints.
6. Hypothesis: the ready line's two spaces on each side of `→` match the Swift copy and the guide. Break it by: diffing the printed line against the design's string.
7. Hypothesis: the self-host page on `todz.app/self-host` shows the new guide. Break it by: `pnpm --filter @todz/api site:check` and opening the page.

### Known gaps

- `pnpm verify` is red on the branch from before this lane: `tools/repository-shape/src/document-indexes.test.ts` "lists every record once, in number order, with the title, status and date the record states" fails because the `docs/adr/README.md` row of ADR 0044 reads `Proposed, partly superseded by [0056](…) § 3` while the test expects the status the record states without that suffix. It fails with this lane's changes stashed too. `docs/adr` belongs to the lead.
- No test covers a Worker without `PUBLIC_ORIGIN` (hypothesis 4).
- `serveHealth` is not exercised by a deployed Worker here; the walk does it.
- The service name constant lives in `health.ts`, not `libs/types`.
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

## Fix round 1

The lead's round: security S1 to S5, review R1 to R11, tester defects D1 to D4. Every red commit was run before its green one; the text below is what the red run printed.

### Per item

| Item | Change | Red commit and printed failure | Green commit |
|------|--------|--------------------------------|--------------|
| S1 (worker) | `apps/api/src/sign-in-page.ts`: the hand-off adds `&origin=` + `encodeURIComponent(location.origin)`, read by the script at run time, so the script stays one fixed source and its CSP hash holds. `test/page-script.ts` gives the fake page `location.origin` (`TEST_PAGE_ORIGIN`) | f7c82ce: `AssertionError: expected [ 'replace /sign-in', 'focus', …(1) ] to deeply equal [ 'replace /sign-in', 'focus', …(1) ]` and `AssertionError: expected 'navigate todz://sign-in?token=AAAAAAA…' to match /&origin=http%3A%2F%2Flocalhost%3A8787$/` (4 failed, 44 passed in the two page files) | a11ae17 |
| S1 (app) | `SignInLink` requires a non-empty `origin` (three query items: `token`, `turnstile`, `origin`); a link without it is not a sign-in link, so the app ignores it as it ignores any malformed one. `redeem` refuses with `linkNotRequested` before any request when `signInLink.origin != serverURL.origin`, and keeps the pending link | 3fb2db7: `Expectation failed: SignInLink(url: url)` (every test that builds a link with `&origin=`), `Expectation failed: try SignInLink(url: url(text)) == nil` for the link without `origin`, `Expectation failed: link?.origin == origin`; 43 issues in 365 tests across the four suites | 569a7b9 |
| S2 (domain) | `ServerPreference(defaults:domainName:)` reads only `persistentDomain(forName:)`; `AppDelegate` passes `AppConfiguration.defaultsDomain` (the bundle identifier). Writing still goes through `set`, which lands in the app's own domain | 7f92505: `Expectation failed: domain.preference.storedAddress() == nil` (the value in another searched domain) and `Expectation failed: !domain.preference.hasUnreadableValue` (`not a url` there) | 4110e03 |
| S2 (session) | `SessionVault` keeps a `StoredSession(secret:origin:)`; `FileSessionVault` writes it as JSON; a file that is the secret alone (an earlier build) throws `SessionVaultError.unbound`. `AppModel.init` runs `eraseDataOfAnotherServer()`: an unreadable preference, a session bound to another origin or an unbound session erases the session, the cache with its outbox, the pending link and the widgets before launch; the preference is cleared only when it is the unreadable one; an erase that throws launches with `sessionUnreadable` and never reads the vault. `keep(secret:)` binds to `serverURL` | 40c15bc: `TodzKit/FileSessionVault.swift:22: Fatal error: FileSessionVault.read of a bound session is not implemented` (`FileSessionVaultTests` run alone); `AppModelTests`: `Expectation failed: harness.vault.secret == nil` (then `store.owner`, `store.outbox`, `pendingLinks.link`, `phase == .signedOut(notice: nil)`, `service.calls == []`), `phase == .signedOut(notice: .sessionUnreadable)` and `harness.vault.origin == storedText`; 14 issues | f87b383 |
| S3 | `ServerProbeOutcome.of` puts the answered origin through `ServerAddress.checked`; one that fails is `notTodz`, another one shows only its normalized origin | 0b6cd01: `Expectation failed: outcome == .answersAs(origin: "https://other.example.com")` and six `Expectation failed: ServerProbeOutcome.of(answer: .todz(origin: origin), typedAddress: typed) == .notTodz` | b46b80a |
| S4 | `ServerAddress.checked` refuses as `invalid` an address whose `percentEncodedHost` differs from `host` (`%2E`, `%41`, `local%68ost`, `exämple.com`) | 849c293: four `Expectation failed: ServerAddress.checked(text: text) == .failure(issue)` | dc59a24 |
| R1, R11 (S5) | One shared `OwnerAPI.probeTransport` built from `probeConfiguration(deadline: ServerTiming.probeSeconds)`, which sets `timeoutIntervalForResource`; `AppDelegate`'s probe uses it. `health()` streams the body and answers `notTodz` past 4 096 bytes (`healthBodyLimit`) | 6e76052: `Expectation failed: OwnerAPI.probeTransport.configuration.timeoutIntervalForResource == ServerTiming.probeSeconds`, `Expectation failed: outcome == .unreachable` (the drip ran its whole 4.26 s and decoded as `notTodz`), `Expectation failed: answer == .notTodz` | cda7211 |
| R2 | `apps/macos/README.md`: the build only picks the default server; Settings › Server changes it | n/a (docs) | 08f5ba4 |
| R3 | `switchServer(to:)` returns `ServerSwitchResult` (`switched`, `busy`, `alreadyInUse`, `eraseFailed`); `ServerSwitchFlow.finish(result:)` maps busy to `failed(.busy)`, already in use to `alreadyInUse`; the form shows `ErrorCopy.serverSwitchBusy(server:)`, "Sign-in was still in progress, so todz stayed on {server}." (design § 9; it sits in `ErrorCopy` beside `serverSwitchFailed`, where the form's other refusals live) | 40108e9: `Expectation failed: result == .busy` (twice), `Expectation failed: result == .alreadyInUse`, `Expectation failed: flow.state == expected` for `.busy` and `.alreadyInUse` | a16a09f |
| R4 | `isSwitchingServer` dropped from the model and the form; plan R5 row and step A6, design § 2 and § 7 note 1 struck with the reason | refactor | b53f639 |
| R5 | the two hand-set race tests are `aRedeemWhoseSigningInFlagWasLostFinishingAfterASwitchIsDroppedAndSignedOutAtItsService` and `aLinkRequestWhoseRequestingFlagWasLostFinishingAfterASwitchKeepsNoPendingLink` (Lane A's names above are the old ones) | rename | e0553b8 |
| R6 | `serveHealth` answers only `publicOriginOf(env.PUBLIC_ORIGIN)`; `null` is the empty 404 | 2675bbf: `AssertionError: expected 200 to be 404 // Object.is equality` (1 failed, 8 passed) | b8b2847 |
| R7 | `publicOriginInWranglerText` strips `//` line comments, keeping slashes inside strings, before the trailing commas and `JSON.parse` | 3ad993e (also the rename): `SyntaxError: Expected property name or '}' in JSON at position 4 (line 2 column 3)` (1 failed, 4 passed) | 100e16f |
| R8 | `HEALTH_SERVICE_NAME` in `libs/types` with a pin; `health.ts` uses it. TodzKit keeps its own `todzServiceName` (Swift cannot import the TypeScript package); the pin names the shared value | pin | 97937d9 |
| R9, R10 | `ServerDisclosure`'s chevrons are file constants; `ServerAddress: Equatable` | refactor | 6b69ef3 |
| D1 | the field's title is `serverAddressLabel`, hidden with `.labelsHidden()`, and `serverPlaceholder` is its `prompt` | walk row (no view test target) | 9ab42fd |
| D2 | the Cancel button shown while checking has `.keyboardShortcut(.cancelAction)`, so Escape cancels while the field is disabled | walk row; the flow's `cancel()` is already pinned by `cancellingTheCheckGoesBackToIdle` | 1248d4f |
| D3, D4 | `ServerSwitchFlow.close()` returns every state but `switching` to idle; the form calls it, with the check cancelled, on `onDisappear` | 1ee2e6f (`close()` landed empty): `Expectation failed: closedStates.allSatisfy { $0 == .idle }` | d1c6c30 |
| D4 | `.switched` carries no name; the form names `model.serverURL` when the line shows | pin (the state changed shape) | 1b4fde3 |
| Migration (lead, after S2) | `SessionVault.bind(to:)`: `FileSessionVault` reads the bare secret an earlier build wrote and writes it back as a `StoredSession`. At init, an unbound session with no server value in the persistent domain (`ServerPreference.hasValue` false) is bound to the default's origin, keeping the session, cache, outbox and pending link; with a stored value (readable or not) it is erased as before; a bind that throws falls back to the erase | ebb73d4 (`bind` landed empty, the model did not call it): `Caught error: .unbound` (`FileSessionVaultTests` bind test), `Expectation failed: harness.vault.secret == harness.session`, `harness.vault.origin == harnessDefaultServer`, `harness.vault.eraseCount == 0`, `harness.store.owner != nil`, `harness.store.outbox != nil`, `harness.pendingLinks.link != nil`, `harness.model.isSignedIn` (8 issues); the stored-server case is a pin, green in the red commit | db93b2a |
| ADRs | ADR 0046 § 2 and ADR 0056 §§ 3 and 5 amended in their text (link origin, persistent-domain read, percent-encoded host, probe origin check, session bound to its origin with the migration, total probe deadline and 4 KB); statuses unchanged | docs | 141f935 |

### Counts

- `swift test --package-path apps/macos/TodzKit`: 812 tests in 57 suites before the round, 825 after the first pass, 828 after the migration, all passing.
- `pnpm --filter @todz/api test:unit`: 1686 tests in 66 files, all passing; `pnpm --filter @todz/api typecheck` clean. `@todz/types`: 18 tests.
- `xcodebuild clean build` Debug and Release: `BUILD SUCCEEDED`, no warning.
- `pnpm verify`: 8 gates green at 08f5ba4 (product).

### Walk rows to re-check

- W1 and W24: the Settings Server row shows the field filling the row with `https://todz.example.com` as its prompt only when empty, and no label to its left, light and dark (D1).
- W11: `http://localhost:8798` (never answers), Return, then Escape during `Checking the server…`: back to idle with the typed text and no line (D2).
- D3: `localhost:8791`, Return (refusal), close Settings, ⌘,: the field holds the address in use and no line shows.
- D4: switch from Settings, close and reopen: no `Switched to …` line; with Settings open, switch from the sign-in disclosure: the Settings line, if any, names the server in use.
- A sign-in link from another origin: with the app on `http://localhost:8791`, ask for a link there, then open `todz://sign-in?token=<43>&turnstile=<token>&origin=http%3A%2F%2Flocalhost%3A8787`: `Open the link on the Mac that asked for it, or send a new one.`, no `POST /owner/sessions` on either Worker, and a link with the right origin still signs in. A link without `origin` does nothing.
- S2 at launch: `defaults write -g serverURL https://example.com` and launching with `-serverURL https://example.com` leave the app on its stored server; a session file from another origin launches signed out with the cache, outbox and pending link gone. Delete the global key after.
- Upgrade: with no `serverURL` stored, replace the session file with the bare secret (an earlier build's format) and launch: the owner stays signed in with the cache and any waiting changes, and the file now holds `{"secret":…,"origin":<the default>}`. With a `serverURL` stored, the same file launches signed out with the cache, outbox and pending link gone.

### Hypotheses to attack

1. A relayed link cannot sign in: the origin in the link is the page's `location.origin`, which only the real server's page can produce. Break it by: serving a copy of the page from another origin and checking which origin it hands over.
2. The probe never runs past 10 s in total, whatever the server drips, and never holds more than 4 KB.
3. Nothing in the argument or global domain can move the app to another server.

### Known gaps

- A session file that is not JSON for any reason counts as an earlier build's bare secret: with no stored server it is bound to the default and sent there as a session (a garbled one gets 401 and ends the session); with a stored server it is erased.
- The app gives no message for a sign-in link without `origin`; it ignores it like any malformed link.
- D1, D2 and the `onDisappear` half of D3 and D4 have no automated test: the app target has no test target. Whether `onDisappear` fires when the Settings window closes is for the walk.
