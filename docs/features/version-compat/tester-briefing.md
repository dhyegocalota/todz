# Tester briefing: Version compatibility

## G1 server (branch `lane/version-compat-g1`)

### What changed and where

- `libs/types/src/constants.ts`: `MINIMUM_APP_VERSION` (`0.2.0`), `API_VERSION_HEADER` (`Todz-Api-Version`), `APP_VERSION_HEADER` (`Todz-App-Version`), pinned in `constants.test.ts`.
- `apps/api/src/app-version.ts`: `isAppVersionAccepted({ candidate, minimum })`. `^\d+(\.\d+){0,2}$`, padded to three parts, compared numerically with an `Intl.Collator` set to numeric; `null` is refused.
- `apps/api/src/owner-endpoint.ts`: after `matchOwnerRoute` and before the public or session dispatch, `appVersionRefusal(request)` returns `appTooOldResponse()`. `apps/api/src/owner-errors.ts` holds `OwnerErrorCode.AppTooOld` (`426`) and `appTooOldResponse()` (`Upgrade: todz-app/0.2.0`, body `{"error":"app_too_old","minimum_app_version":"0.2.0"}`). `HttpHeader.Upgrade` is new.
- `apps/api/src/server-version.ts` (`SERVER_VERSION`, the only read of the `TODZ_SERVER_VERSION` global declared in `server-version-global.d.ts`, and `withServerVersion`), wired in `index.ts` inside `withSecurityHeaders`. `health.ts` adds `version` and `minimum_app_version`. `wrangler.jsonc` defines `TODZ_SERVER_VERSION` as `null`; `vitest.config.mts` defines it as `2026.11.25+0000000` for the Workers project.
- `apps/api/scripts/server/`: `version-stamp.ts`, `deploy-arguments.ts`, `ready-line.ts` (three fields), `cli.ts` (reads git, runs `wrangler deploy --define`, prints the ready line). `server:deploy` is `tsx scripts/server/cli.ts`.
- Callers outside the app now send the header: `apps/api/test/owner-client.ts`, `worker.test.ts`, `site-dispatch.test.ts`, `tools/perf/src/owner-scenario.ts` (`APP_VERSION_HEADERS`) and `tools/perf/src/socket-signals.ts`.
- Docs: `docs/runbooks/deploy-the-api.md` (steps 8 and 13), `apps/docs/self-host.mdx`, `apps/api/README.md`, the helpers line of `AGENTS.md`. Two pins outside the File map moved with them: `tools/repository-shape/src/runbooks.test.ts` and `self-host.test.ts`.

### How to run

- `pnpm --filter @todz/api test:unit` (Workers project and Node project), `pnpm --filter @todz/perf test:unit`, `pnpm --filter @todz/repository-shape test:unit` (or `cd tools/repository-shape && pnpm exec vitest run`), `pnpm typecheck`.
- Nothing here was deployed. `server:deploy` was never run: it would deploy for real. Its pieces are covered by unit tests; its git commands were run by hand (`TZ=UTC git log -1 --format=%cd --date=format-local:%Y-%m-%d` printed `2026-11-25`).

### Red commits, in order, and the text each run printed

| Step | Red commit | Green commit | Text the red run printed |
|---|---|---|---|
| 1 | `05ba4d3d` | `722722b4` | `Error: isAppVersionAccepted is not implemented` on every row of `app-version.test.ts` (19 failed). The constants pins in the same commit are green on landing (pin). |
| 3 | `c350cd87` | `77072c92` | `AssertionError: expected 200 to be 426` (no header, `0.1.9`, `v0.2.0` on `GET /owner/sign-in-method`; a signed-in `GET /owner` with `0.1.0`); `expected 400 to be 426` (the sign-in link body before ADR 0058, no header); `expected 101 to be 426` (the socket, no header); `expected [ 503, 503, … ] to deeply equal [ 426, 426, … ]` (the limiter row, whose guarded environment answers `503` before the gate exists). 7 failed, 6 passed. The passing rows are the unchanged ones (`0.2.0`, `0.2`, `1.0.0`, `/owner/nope`, `/mcp`, `/health`). |
| 5 | `69fd01c9` | `d31c7229` | `AssertionError: expected null to be '2026.11.25+0000000'` on every header row; `expected { service: 'todz', …(1) } to deeply equal { service: 'todz', …(3) }` on the health rows. 17 failed, 19 passed. The `withServerVersion` rows for `null` and for the `101` pass against the stub (pin). |
| 7 | `2d66ef31` | `9f7497fb` | `Error: versionStamp is not implemented`; `expected [Function] to throw error including 'Cannot stamp the server version' but got 'versionStamp is not implemented'`; `Error: deployArguments is not implemented`; the ready line fails on a string diff (`expected 'todz server ready: https://api.exampl…' to be 'todz server ready: https://api.exampl…'`); `expected 'wrangler deploy && tsx scripts/server…' to be 'tsx scripts/server/cli.ts'`. 11 failed, 4 passed. |

Step 2, 4, 6 and 8 are the greens of those rows. Step 9 has no red.

### Hypotheses for the tester

1. A request to any matched `/owner/*` route with no `Todz-App-Version`, a malformed one (`v0.2.0`, `0.2.0-beta`, ` 0.2.0`, `0.2.0.1`) or a lower one answers `426` with the exact body above and `Upgrade: todz-app/0.2.0`, on every route kind: public (`/owner/sessions`, `/owner/sign-in-method`, `/owner/sign-in-links`), session routes and the socket route (a todz body, not the store's bare `426`).
2. The refusal spends no sign-in limiter budget and touches no session: a later call with the same token and `0.2.0` answers `200`.
3. `0.2.0`, `0.2`, `1`, `0.10.0` and `1.0.0` reach the route and answer as before; an unmatched `/owner/...` path still answers `404` with no body whatever the header.
4. `/mcp`, `/health`, `/sign-in` and the site never check the app version.
5. `Todz-Api-Version` is on every answer the Worker writes (owner, MCP, health GET and HEAD, `404`s, site pages) when stamped, on none when unstamped, and not on a `101`.
6. `GET /health` answers `{"service","origin","version","minimum_app_version"}`; `HEAD /health` has the same headers. Unstamped builds say `"version":null`.
7. `versionStamp` names the commit, not the machine: UTC date, seven hash characters, the same for the same commit. A git failure throws `Cannot stamp the server version: …` before wrangler runs.
8. A deploy through `server:deploy` prints the ready line with the stamp; `curl -sS https://api.todz.app/health` shows the same stamp after the lead's deploy (G3).

### Gaps and deviations

- `server:deploy` itself (the git calls, `spawnSync` of wrangler, the exit code, the printed line) has no automated test: only `versionStamp`, `deployArguments`, `readyLine` and the `package.json` script are asserted. A test would deploy or need a wrangler fake. The tester can run it against a throwaway worktree only with a Cloudflare token, so the lead's deploy is its first real run.
- `HttpHeader` has no `ApiVersion` or `AppVersion` member: TS18055 rejects an enum member that takes an imported constant. The call sites use the `libs/types` constants. `HttpHeader.Upgrade` landed in step 4, not step 6.
- `cli.ts` reads the commit date and hash with two git calls instead of one with `%n`, so each stays a plain string without an index access.
- The ready line's `accepts app` value is `MINIMUM_APP_VERSION` read in `cli.ts` from `libs/types`.
- The gate test builds its own requests (`new Request`) instead of `owner-client.ts`, because the client sends the header by default after step 4 and the gate test needs to omit it.
- The test-plan row "`OPTIONS /owner` → `404` with the header and no `Access-Control-*`" and "a site-host page and `404`" are in `server-version.test.ts`; the Playwright assertion in `landing.spec.ts` (test plan, E2E) was not added: it needs a stamped dev server and is outside the G1 paths named in the plan. The lead or tester decides.
- Runbook step 13 now has eighteen answers (the owner route without the header is new). Every owner curl in steps 13 to 15 that expects the route's own answer sends `Todz-App-Version: 0.2.0`; without it the gate would answer `426` there. No run of the runbook was made.
## G2 app (`lane/version-compat-g2`)

### What changed and where

All under `apps/macos/`. The wire contract was coded from the spec (`Todz-App-Version`, the `/health` fields `version` and `minimum_app_version`, the `426` body), never from G1's code.

TodzKit (`TodzKit/Sources/TodzKit/`):

- `VersionCompatibility.swift`: the pure rule, `of(app:server:refusal:)`, and `minimumServerVersion = "2026.11.25"`. `DottedVersion.swift` compares versions part by part as numbers, a missing part is zero. `ServerStamp.swift` cuts the date off a stamp. `ServerVersions.swift` holds the two things `/health` says.
- `AppVersion.swift`: the bundle's `CFBundleShortVersionString`; a bundle without it is a launch-time `preconditionFailure` naming the key (`AppConfiguration.appVersion`).
- `OwnerRequest.transportRequest(baseURL:appVersion:)` sets `Todz-App-Version`; `OwnerAPI` and `SocketChangeSignals` take `appVersion` in their initialisers (the health probe, every owner call and the socket upgrade go through it).
- `OwnerAPI.health()` decodes both versions into `ServerHealthAnswer.todz(origin:versions:)`; `OwnerService` gained `health()`.
- `OwnerErrorCode.appTooOld`, `OwnerErrorBody.minimumAppVersion`, `OwnerAPIError.appTooOld(minimum: String?)`. Any `426`, with a todz body, no body or an undecodable one, is `appTooOld` (the minimum is nil when the body names none); the lead's later requirement, commits `ca17ac0` (red) and the green after it. The socket's refused upgrade maps `426` the same way.
- `AppModel`: `compatibility` (starts as `serverUnknown`), `isUpdateNeeded`, `refreshCompatibility()` (a stored task, read at launch, after a server switch and whenever a `VersionLine` appears), `recordRefusal(of:)` (an owner call, a sign-in or a sign-in-link request answered `app_too_old` flips the state at once). A signed-in `updateNeeded` raises `AppBanner.updateNeeded`; leaving it dismisses that banner and resumes the outbox.
- Outbox: `SendOutcome.updateNeeded` keeps the change and ends the flush; `startSending` does nothing while `isUpdateNeeded`; it never counts as a refusal and the server counts as having answered.
- `SignInError.appTooOld`.

App target:

- `Todz/Server/VersionLine.swift` (one line, symbol per state, tooltip, accessibility label, Download button while update is needed), `Todz/Server/DownloadButton.swift`, `Copy/VersionCopy.swift` (all the words; `https://todz.app` is `downloadAddress`).
- Shown as the footer of the Server section in `SettingsView`, inside `ServerDisclosure` when it is open (and under the closed line while update is needed), and under the header on `KeyScreen`.
- `BannerActionButton` shows Download for `.updateNeeded` and no Dismiss; `ErrorBanner` uses a calm `arrow.down.circle` for it. Banner and sign-in error strings are in `ErrorCopy` and `SignInCopy`.
- `project.yml`: `MARKETING_VERSION` `0.2.0` for the app and the widgets. `apps/macos/README.md` names the line.

### How to run

```
cd apps/macos/TodzKit && swift test
cd apps/macos && xcodegen && xcodebuild -project Todz.xcodeproj -scheme Todz -configuration Debug -derivedDataPath <scratch> CODE_SIGNING_ALLOWED=NO build
```

`swift test` printed `Test run with 1062 tests in 85 suites passed`. The Debug build printed `** BUILD SUCCEEDED **`; the built `Info.plist` of the app and of `TodzWidgets.appex` both read `0.2.0`.

### Red today, green after (each run alone with `swift test --filter 'Suite/test'`)

| Commit | Test | Red text as printed |
|---|---|---|
| `d5ea73c5` | all ten of `VersionCompatibilityTests` (`aServerThatAcceptsTheAppAndIsNewEnoughIsCompatible`, `aServerWhoseMinimumIsAboveTheAppNeedsAnUpdate`, `aRecordedRefusalWinsOverACompatibleAnswer`, `aRecordedRefusalWithoutAnAnswerNeedsAnUpdate`, `aServerOlderThanTheOneTheAppExpectsIsBehind`, `aServerThatStatesNoVersionIsBehind`, `aServerThatHasNotAnsweredIsUnknown`, `aServerOfTheSameDayOrLaterIsCompatible`, `versionsCompareAsNumbersNotAsText`, `aServerStampThatDoesNotParseIsBehindWithoutACrash`) | each: `TodzKit/VersionCompatibility.swift:8: Fatal error: VersionCompatibility.of is not implemented` (the process exits with signal 5, so each runs alone) |
| `ff067371` | `OwnerRequestTests/aTransportRequestCarriesTheAppVersion` | `Expectation failed: request.value(forHTTPHeaderField: appVersionHeader) == OwnerFixtures.appVersion` |
| `ff067371` | `OwnerRequestTests/theSocketUpgradeSendsTheAppVersion` | the same expectation |
| `ff067371` | `OwnerAPITests/anOwnerCallSendsTheAppVersion` | `Expectation failed: sent.appVersion == OwnerFixtures.appVersion` |
| `ff067371` | `OwnerAPIHealthTests/theRequestCarriesTheAppVersion` | `Expectation failed: request.value(forHTTPHeaderField: "Todz-App-Version") == OwnerFixtures.appVersion` |
| `ff067371` | `OwnerAPIHealthTests/aTodzAnswerStatesItsVersionAndTheOldestAppItAccepts` | `Expectation failed: answer == .todz(origin: "https://x.example.com", versions: ServerVersions(server: "2026.11.25+3f9c2ab", minimumApp: "0.2.0"))` |
| `ff067371` | `OwnerAPIHealthTests/aTodzAnswerWithANullVersionHasNoServerVersion` | `Expectation failed: answer == .todz(origin: "https://x.example.com", versions: ServerVersions(server: nil, minimumApp: "0.2.0"))` |
| `ff067371` | `OwnerAPITests/mapsEachRowOfTheErrorTable` (row 426 with the minimum) | `expected error ".appTooOld(minimum: "0.3.0")" of type OwnerAPIError, but ".unexpected(status: 426)" of type OwnerAPIError was thrown instead` |
| `1495632b` | `AppModelTests/launchWithACompatibleHealthAnswerIsCompatible` | `Expectation failed: harness.model.compatibility == .compatible(app: OwnerFixtures.appVersion, server: compatibleStamp)` |
| `1495632b` | `AppModelTests/aRefreshThatAnswersALaterMinimumNeedsAnUpdate` | `TodzKit/AppModel+Version.swift:3: Fatal error: AppModel.refreshCompatibility is not implemented` |
| `1495632b` | `AppModelTests/aServerSwitchRecomputesFromTheNewServer` | `Expectation failed: harness.model.compatibility == .serverBehind(app: OwnerFixtures.appVersion, server: nil)` then `== .compatible(app: OwnerFixtures.appVersion, server: compatibleStamp)` |
| `1495632b` | `AppModelTests/anOwnerCallRefusedAsTooOldNeedsAnUpdateAtOnce` | `Expectation failed` on `compatibility == .updateNeeded(...)` and on `banner == .updateNeeded` |
| `1495632b` | `AppModelTests/aQueuedAddRefusedAsTooOldStaysAndWaitsForTheUpdatedApp` | `Expectation failed: harness.model.banner == .updateNeeded`, `Expectation failed: harness.service.routes().filter { $0 == .addTasks }.count == 1`, then the `refreshCompatibility` fatal error |
| `1495632b` | `AppModelTests/aSignInRefusedAsTooOldSaysSoAndNeedsAnUpdate` | `Expectation failed: harness.model.signInError == .appTooOld` and `compatibility == .updateNeeded(...)` |

Pins (green when they landed):

- `AppModelTests/threeConsecutiveRefusalsKeepEveryQueuedChangeUncountedAndUnannounced` (three `426` answers leave the outbox value identical, so no attempt is counted, no refusal banner) and `afterTheAnswerIsNoLongerARefusalTheQueueFlushesInOrder` pin the pause-and-keep rule, which `0a420d31` already implemented; `aRefusalThatNamesNoMinimumNeedsAnUpdate` too.
- Red in `ca17ac0`, run alone: `OwnerAPITests/mapsEachRowOfTheErrorTable` rows `426` with an empty body, with `{"error":"app_too_old"}` and with an html body: `expected error ".appTooOld(minimum: nil)" of type OwnerAPIError, but ".unexpected(status: 426)" of type OwnerAPIError was thrown instead`. The model-level undecodable-426 case is not tested: before the fix it would wait on a held pause forever.
- Pins from the plan review: `VersionCompatibilityTests` rows for a server minimum of `x`, `99999999999999999999.0`, `0.2.0-beta`, empty and `1..2` (ignored), and stamps that overflow or are malformed (`serverBehind`, no crash). The v1.1 rows are listed in `plan.md`.
- The Debug app against a local unstamped `wrangler dev` always reads "Server older · Server needs an update"; use a stamped `--define` for walks and shots.
- The earlier spec line "a `426` with no todz body stays `unexpected`" is superseded by the lead's requirement; the spec still says it.
- `AppModelTests/aServerThatDoesNotAnswerLeavesTheAppAlone` (`serverUnknown` is the starting state).
- `AppVersionTests` and `ServerStampTests` landed with their code, not red-first.

The red commit `1495632b` adds a scaffold in `SendOutcome` that ends the flush on `app_too_old` as a session end. The real outcome, `.updateNeeded`, would have waited on the held pause forever and hung the run; its green is `0a420d31`.

### Hypotheses for the tester (not claims)

1. Settings › Server shows `App 0.2.0 · Server 2026.11.25 · Compatible` against a stamped Worker, with the full stamp in the tooltip (`Server build 2026.11.25+3f9c2ab`); against a Worker whose `MINIMUM_APP_VERSION` is `0.3.0` it shows `… · Update todz to keep syncing` with a Download button that opens `https://todz.app`; against an unstamped `wrangler dev` it shows `App 0.2.0 · Server older · Server needs an update`; against a stub with `version: "2026.11.20+aaaaaaa"` it shows `Server 2026.11.20`.
2. The same line shows inside the open sign-in Server disclosure and on Connect an Agent, under the header. While update is needed it also shows under the closed disclosure line.
3. Signing in against a Worker that refuses the app shows `Update todz to sign in.`, flips the line to update needed, and never shows "Something went wrong".
4. Signed in, a Worker that starts refusing raises the banner `Update todz to keep syncing` / `Your changes wait here until then.` / Download (no Dismiss). A task added then stays on the Mac and lands once a probe answers compatible (switch the server back, or reopen Settings so the line refreshes), and the banner disappears.
5. A queued change is never dropped and never counted as refused by `app_too_old`.
6. Switching the server starts clean: the line is the app alone until the new server answers, then the new server's state.
7. The line refreshes whenever a `VersionLine` appears (opening Settings, expanding the disclosure, opening Connect an Agent) and at launch. A server that stops answering reads as the app alone, unless a refusal was recorded.
8. The widgets' bundle reads `0.2.0` too.

### Gaps I know about

- Screenshots are renders of the app's own views offscreen (`NSHostingView` in a scratch program, the model driven by a fake owner service), light and dark, in `.pr-media/version-compat/`: `settings-*`, `sign-in-*`, `sign-in-closed-update-needed-*`, `connect-an-agent-*` for `compatible`, `update-needed`, `server-behind` and `server-older`, and `banner-update-needed-*`. The Connect an Agent picker is empty and the Settings address field shows its placeholder in those renders because the screens' own `.task` and project state do not run offscreen. They are not an Orca walk of a real window against a Worker; test-plan "Prove it for real" is still the tester's.
- `AppModel.raise` still lets a later banner replace `.updateNeeded` (for example a failed load's `.server`). The load and write failure paths treat `appTooOld` as already handled and raise nothing, so I found no path that does it, but no test pins the sticky banner.
- A load that fails with `app_too_old` before the first workspace list (a signed-in launch with a stored session) takes the existing failure screen path; `compatibility` flips and the banner is raised, but I did not exercise that screen.
- `AppVersion.required` crashes the app at launch when the bundle has no short version; no test builds a bundle without one.
- The version line is localised in English only, as the rest of `Copy/`.
- `README.md` at the root shows Settings screenshots owned by other features; I did not touch them. Whether any shows the Server section is the lead's call.
- `tester-briefing.md` is also written by G1 in its own lane; the two sections merge by keeping both.
