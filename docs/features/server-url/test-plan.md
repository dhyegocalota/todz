# Test plan: Server URL

Every checkbox states the input and the exact expected outcome. A ticked box carries evidence after ` — evidence: ` (commit hash, log path, counts, screenshot path).

Pinned strings: every string of `design.md` § 9 appears verbatim in the app. The refusal messages below are not in the design; the loop wrote them for `ServerAddressIssue+Copy.swift` and the owner may change them, and the walk checks them as written:

| Issue or state | The message |
|---|---|
| `empty` | `Enter an address like https://todz.example.com.` |
| `missingScheme`, `unsupportedScheme` | `Start the address with https://.` |
| `insecureRemoteHost` | `Use https://. Plain http:// works only for localhost.` |
| `missingHost` | `Add the server's name after https://.` |
| `hasPath` | `The address has no path. Enter the server's root address.` |
| `hasQuery` | `Remove the part from ? on.` |
| `hasFragment` | `Remove the part from # on.` |
| `hasCredentials` | `Remove the name and password before @.` |
| probe `notTodz`, or unreachable | `No todz server answered at that address.` |
| probe `answersAs(origin:)` | `That server answers as {origin}. Enter that address instead.` |
| sign-out failed, erase failed | `ErrorCopy.serverSwitchFailed`: `This Mac's copy could not be erased, so todz stayed on {server}.` |

## The failing test first

- [ ] `apps/api/test/health.test.ts` at its red commit — input: `GET http://localhost:8787/health`; expected: fails `expected 404 to be 200` on the API host, and on the site-host and unknown-host cases, which must answer 200 with the API origin (ADR 0056 § 4); the POST and trailing-slash cases pass as pins (404 already)
- [ ] `tools/repository-shape/src/api-source.test.ts` at its red commit — input: the current `apps/api/wrangler.jsonc`; expected: fails on the `ASSETS_PATTERN` pin, which now names `"/health"` in `run_worker_first`
- [ ] `apps/api/test/server-ready.test.ts` at its red commit — input: `readyLine({ publicOrigin: 'https://api.example.com' })`; expected: fails with `readyLine is not implemented`
- [ ] `tools/repository-shape/src/self-host.test.ts` and `runbooks.test.ts` at their red commit — input: the current guide and runbook; expected: fail on `server:deploy` missing from the guide and on the `/health` curl missing from step 13, not on a broken fixture
- [ ] `ServerAddressTests` and `ServerPreferenceTests` at their red commit, each run alone with `--filter` — expected: each stops on `ServerAddress.checked(text:) is not implemented` or `ServerPreference … is not implemented` (`preconditionFailure`)
- [ ] `OwnerAPIHealthTests`, `ServerProbeOutcomeTests`, `ServerSwitchFlowTests` and `tools/repository-shape/src/app-transport.test.ts` at their red commit — expected: each stops on its stub or fails its assertion; the app-transport test fails on `TODZ_ALLOWS_LOCAL_NETWORKING` being `"NO"` in Release
- [ ] `AppModelTests+Server` at its red commit — expected: each test stops on `switchServer(to:) is not implemented` or on a missing member, never on the harness
- [ ] The printed texts match the developer's `tester-briefing.md` row for row — evidence: (to be recorded)

## Unit: the Worker (Lane S)

- [ ] `GET /health` on the API host, origin `http://localhost:8787` — expected: 200, body exactly `{"service":"todz","origin":"http://localhost:8787"}`, `content-type: application/json`, `cache-control: no-store` — evidence: (to be recorded)
- [ ] `GET /health?probe=1` on the API host — expected: the same 200 and body (the query is ignored)
- [ ] `GET /health/` (trailing slash) on the API host — expected: 404, empty body
- [ ] `POST /health` on the API host — expected: 404, empty body; no body is read
- [ ] `GET /health` on the site host `http://localhost:8788` — expected: 200, body `{"service":"todz","origin":"http://localhost:8787"}` (the API origin, not the host asked)
- [ ] `GET /health` on an unknown host `http://localhost:8799` — expected: 200, the same body with the API origin
- [ ] `POST /health` on the site host — expected: 404, empty body
- [ ] A Worker with no `PUBLIC_ORIGIN` — expected: `hostKindOf` is null for the API host, so `/health` is 404 and no origin is ever invented
- [ ] `GET /` on the API host — expected: still 404 (the runbook's landing pin holds)
- [ ] `apps/api/wrangler.jsonc` — expected (the asset pin of `api-source.test.ts`): `assets.run_worker_first` lists `/owner`, `/owner/*`, `/mcp`, `/sign-in`, `/sign-in/challenge`, `/health`, in that order, and nothing else changes
- [ ] `readyLine({ publicOrigin: 'https://api.example.com' })` — expected: exactly `todz server ready: https://api.example.com  →  paste it in todz › Settings › Server`
- [ ] `publicOriginOf(text)` on the current `wrangler.jsonc` text (trailing commas present) — expected: `https://api.todz.app`
- [ ] `publicOriginOf` on JSONC without `PUBLIC_ORIGIN` — expected: throws `PUBLIC_ORIGIN is missing from the Wrangler configuration`
- [ ] `server:deploy` in `apps/api/package.json` — expected: the value is `wrangler deploy && tsx scripts/server/ready.ts`; a failed deploy (`wrangler` exits non-zero) prints no ready line (the `&&` order is the pin)
- [ ] The production `pnpm --filter @todz/api test:e2e` — expected: passes unchanged at the merged head (the lead runs it once)
- [ ] `docs/self-host.md` — expected: step 4 and Updating run `pnpm --filter @todz/api server:deploy`; step 7 names no `TODZ_API_BASE_URL`; the guide's `curl …/health` answers `{"service":"todz","origin":"https://api.example.com"}`
- [ ] `apps/api/src/site/generated/self-host-html.ts` — expected: `generated-site.test.ts` and `pnpm --filter @todz/api site:check` pass at the merged head
- [ ] `docs/runbooks/deploy-the-api.md` step 13 — expected: still thirteen steps, and its curl `https://api.todz.app/health` expects the body above; `runbooks.test.ts` passes

## Unit: TodzKit (Lane A)

- [ ] `ServerAddress` `" https://Todz.Example.com/ "` — expected: accepted, `origin` `https://todz.example.com`
- [ ] `https://todz.example.com` — expected: accepted, `origin` `https://todz.example.com`
- [ ] `http://localhost:8787` — expected: accepted, `origin` `http://localhost:8787`
- [ ] `http://127.0.0.1:8787` — expected: accepted, `origin` `http://127.0.0.1:8787`
- [ ] `http://[::1]:8787` — expected: accepted, `origin` `http://[::1]:8787`
- [ ] `http://todz.example.com` — expected: refused `insecureRemoteHost`, message from the table above
- [ ] `todz.example.com` — expected: refused `missingScheme`
- [ ] `ftp://todz.example.com` — expected: refused `unsupportedScheme`
- [ ] `https://` — expected: refused `missingHost`
- [ ] `https://todz.example.com/?a=1` — expected: refused `hasQuery`
- [ ] `https://todz.example.com/#top` — expected: refused `hasFragment`
- [ ] `https://user:secret@todz.example.com` — expected: refused `hasCredentials`; the message names no part of the credentials
- [ ] `https://example.com/todz` — expected: refused `hasPath`
- [ ] `   ` (spaces only) — expected: refused `empty`
- [ ] `https://todz.example.com:443` — expected: accepted, `origin` `https://todz.example.com` (the scheme's default port is dropped)
- [ ] `https://todz.example.com:8443` — expected: accepted, `origin` `https://todz.example.com:8443` (a non-default port is kept)
- [ ] `ServerPreference` with nothing stored — expected: `storedAddress()` is nil; the model starts on the default
- [ ] `ServerPreference` with the stored text `not a url` — expected: `storedAddress()` is nil; no crash; the model starts on the default
- [ ] `ServerPreference` after `store(https://todz.example.com)` then `clear()` — expected: `storedAddress()` is nil
- [ ] `OwnerAPI.health()` against a stub answering 200 `{"service":"todz","origin":"https://x.example.com"}` — expected: `.todz(origin: "https://x.example.com")`; the request is `GET <base>/health` with no session header
- [ ] `OwnerAPI.health()` against 200 `{"service":"other","origin":"https://x.example.com"}` — expected: `.notTodz`
- [ ] `OwnerAPI.health()` against 200 `<html>…</html>` — expected: `.notTodz`
- [ ] `OwnerAPI.health()` against 404 with an empty body — expected: `.notTodz`
- [ ] `OwnerAPI.health()` against 301 with `location: https://elsewhere.example.com/health` — expected: `.notTodz`, and the redirect is not followed (the stub records one request)
- [ ] `OwnerAPI.health()` against 200 `{"service":"todz"}` with no origin — expected: `.notTodz`
- [ ] `OwnerAPI.health()` when the transport throws `URLError(.cannotConnectToHost)` — expected: throws `OwnerAPIError.unreachable`
- [ ] The probe request's `timeoutInterval` — expected: equals `ServerTiming.probeSeconds`; the test never waits for the timeout
- [ ] `ServerProbeOutcome.of(answer: .todz(origin: "https://todz.example.com"), typedAddress: "https://todz.example.com/")` — expected: `.matches`
- [ ] `ServerProbeOutcome.of(answer: .todz(origin: "http://localhost:8787"), typedAddress: "http://127.0.0.1:8787")` — expected: `.answersAs(origin: "http://localhost:8787")`
- [ ] `ServerProbeOutcome.of(answer: .notTodz, …)` — expected: `.notTodz`
- [ ] `ServerProbeOutcome.of(unreachable)` — expected: `.unreachable`, which the flow shows with the same message as `.notTodz`
- [ ] `ServerSwitchFlow`: idle, submit `todz.example.com` (no scheme) — expected: `refused(.missingScheme)`, no probe started
- [ ] `ServerSwitchFlow`: idle, submit a valid address — expected: `checking`
- [ ] `ServerSwitchFlow`: checking, probe `.matches`, signed out, nothing waiting — expected: `switching` (no confirmation)
- [ ] `ServerSwitchFlow`: checking, probe `.matches`, signed in, nothing waiting — expected: `confirming(losing: 0, signedIn: true)`
- [ ] `ServerSwitchFlow`: checking, probe `.matches`, signed out, two changes waiting — expected: `confirming(losing: 2, signedIn: false)`
- [ ] `ServerSwitchFlow`: checking, probe `.matches`, the address equal to the one in use — expected: `alreadyInUse`; the copy `todz already uses this server.` is shown
- [ ] `ServerSwitchFlow`: checking, probe `.notTodz` or `.unreachable` — expected: `notTodz`
- [ ] `ServerSwitchFlow`: checking, probe `.answersAs(origin:)` — expected: `answersAs(origin:)`; no switch
- [ ] `ServerSwitchFlow`: checking, Cancel — expected: `idle`, the typed text kept, no message
- [ ] `ServerSwitchFlow`: switching, a second submit — expected: ignored; the state stays `switching`
- [ ] `ServerSwitchFlow`: switching, the model reports an erase failure — expected: `failed(.eraseFailed)`, and the address in use is unchanged
- [ ] `AppModel.switchServer(to:)` signed in with one task in the outbox — expected: sign-out is called once at the old service with the old session; the store, the outbox, the widget snapshot, the pending link and the sign-in method are erased; the factory is called once with the new address; the phase is `signedOut`; the address is stored; returns `true`
- [ ] `AppModel.switchServer(to:)` signed out, nothing waiting — expected: sign-out is not called; the switch completes; returns `true`
- [ ] `AppModel.switchServer(to:)` where the old service's sign-out throws — expected: the switch completes; the old session is erased locally; returns `true`
- [ ] `AppModel.switchServer(to:)` where the store's erase throws — expected: returns `false`; the address in use is unchanged; the factory is never called; the preference is never written; the error is `ErrorCopy.serverSwitchFailed`
- [ ] `AppModel.switchServer(to:)` with the same address as in use — expected: returns `false`; sign-out, erase and factory are never called
- [ ] Call order of a successful switch — expected: erase of the session, cache, pending link and sign-in method, then the factory, then the preference write, with the detached sign-out last (recorded by the fakes); no other call sits between the erase and the preference write
- [ ] A vault or pending-link erase that throws — expected: the switch stops before the factory; `switchServer` returns `false`; the old address is kept; the error is `ErrorCopy.serverSwitchFailed`
- [ ] The old service's sign-out held by a waiter — expected: `switchServer` returns `true` while the sign-out is still held; the waiter's release afterwards records the sign-out with the captured session
- [ ] A switch while the change socket watches the old server — expected: the old watch task is cancelled before the factory is called; the fake signals record one cancellation
- [ ] A new `AppModel` built with a stored address `https://todz.example.com` — expected: `serverURL` is that address; the factory was called with it once
- [ ] A new `AppModel` built with an unreadable stored value — expected: `serverURL` is the default; no crash
- [ ] The existing `AppModelTests` sign-out cases after the extraction in Step A6 — expected: pass unchanged; the count printed in the evidence equals the count before the step

## Repository shape (Lane A)

- [ ] `apps/macos/project.yml` — expected: Release `TODZ_ALLOWS_LOCAL_NETWORKING` is `"YES"`, Debug stays `"YES"`
- [ ] `apps/macos/Todz/Todz.entitlements` — expected: still contains `com.apple.security.network.client`
- [ ] `apps/macos/project.yml` `TodzAPIBaseURL` — expected: still reads `$(TODZ_API_BASE_URL)` in the generated Info.plist (the build setting stays as the default; `api-source.test.ts`'s pins still pass)

## E2E

No Playwright spec: the app is native (ADR 0026). The Worker's Playwright suite is the existing one, run unchanged (see Unit: the Worker).

## Prove it for real — Orca walk (ADR 0026)

Setup, recorded in the tester briefing with the commands:

- [ ] Worker A (seeded): `pnpm --filter @todz/api dev` on port 8787, default local state; sign in once with the fake provider and add one task in the app so the state holds an owner, a workspace and a project. Expected: `curl -sS http://localhost:8787/health` answers `{"service":"todz","origin":"http://localhost:8787"}`.
- [ ] Worker B (unseeded): migrate the scratch copy with `pnpm --filter @todz/api exec wrangler d1 migrations apply todz-directory --local --persist-to <scratchpad>/worker-b`, then `pnpm --filter @todz/api exec wrangler dev --port 8791 --local-upstream localhost:8791 --persist-to <scratchpad>/worker-b --var SIGN_IN_PROVIDER:fake --var EMAIL_SENDER:console --var PUBLIC_ORIGIN:http://localhost:8791 --var SITE_ORIGIN:http://localhost:8792 --var ADMIN_EMAIL:admin@todz.test --var TURNSTILE_SITE_KEY:1x00000000000000000000AA --var TURNSTILE_SECRET_KEY:1x0000000000000000000000000000000AA`. Expected: `curl -sS http://localhost:8791/health` answers `{"service":"todz","origin":"http://localhost:8791"}`.
- [ ] A listener that accepts and never answers: `nc -l 8798` in a scratch shell. Expected: a request to it hangs until the probe timeout.
- [ ] The site Worker of Worker A: `pnpm --filter @todz/api dev:site` on port 8788. Expected: `curl -sS -o /dev/null -w '%{http_code}' http://localhost:8788/health` prints `404`.
- [ ] Nothing listens on port 8799. Expected: a probe of `http://localhost:8799` is refused at once.

Release preflight (before W26 and W27): read the Release app's defaults (`defaults read dev.todz.Todz`) and its Application Support folder. If either holds a session, a pending change or any state of an owner, the Release rows are BLOCKED: record the reason, never switch the owner's real app, and leave them for the Human checklist. If both are empty, the Release rows run, and W29 ends them.

The walk, in the Debug app unless a step says Release. Each step's screenshots are light and dark and go to `.pr-media/server-url/` (the design § 6 names):

- [ ] W1 Fresh Debug launch, no stored address — input: open Settings › Server; expected: the row reads `localhost:8787`, `Use todz cloud` is disabled because the default is in use, and the group shows the detail `Where your tasks are kept. Switching signs you out and erases this Mac's copy.`
- [ ] W2 Address without scheme — input: `localhost:8791`, Switch…; expected: refused with `Start the address with https://.`; no request reaches Worker B (its log is empty)
- [ ] W3 Plain http to a remote host — input: `http://todz.example.com`; expected: refused with the `insecureRemoteHost` message; no request
- [ ] W4 Address with a path — input: `http://localhost:8791/todz`; expected: refused with `The address has no path. Enter the server's root address.`
- [ ] W5 Address with a query — input: `http://localhost:8791/?x=1`; expected: refused with `The address has no query or fragment.`
- [ ] W6 Address with credentials — input: `http://user:pw@localhost:8791`; expected: refused with `The address has no username or password.`, and `pw` appears nowhere on screen
- [ ] W7 Refused address leaves the field — input: after W2 to W6; expected: the field keeps the typed text, the in-use address stays `localhost:8787`
- [ ] W8 Nothing listens — input: `http://localhost:8799`; expected: `Checking the server…` then `No todz server answered at that address.`; the address in use is unchanged
- [ ] W9 The site Worker answers — input: `http://localhost:8788`; expected: `That server answers as http://localhost:8787. Enter that address instead.` (its `/health` answers the API origin, ADR 0056 § 4), and the address in use is unchanged
- [ ] W10 Origin mismatch — input: `http://127.0.0.1:8787`; expected: `That server answers as http://localhost:8787. Enter that address instead.`; the address in use is unchanged; Switch… is still offered for the typed address
- [ ] W11 Probe cancelled — input: `http://localhost:8798`, then Escape during `Checking the server…`; expected: back to the idle form with the typed text, no message, no request left open (the listener logs one connection)
- [ ] W12 Probe times out — input: `http://localhost:8798`, no action; expected: after the probe timeout (10 seconds) `No todz server answered at that address.`
- [ ] W13 Switch with an unsynced change and an unreachable old server — input: sign in to Worker A, add a task, stop Worker A, then Settings › Server to `http://localhost:8791`; expected: confirmation `Switch to localhost:8791 and lose 1 change?` with `They haven't reached localhost:8791 yet. Switching signs you out and erases them from this Mac.`; the sign-out at Worker A fails and the switch goes on
- [ ] W14 Cancel is the default button — input: in W13's dialog press Return; expected: the dialog closes, the app stays on Worker A signed in, the change is still waiting (Worker A restarted to check)
- [ ] W15 Confirm the switch — input: W13 again, click Switch Server; expected: the phase becomes signed out, the sign-in screen is shown, Settings reads `localhost:8791`, and Settings shows `Switched to localhost:8791. Sign in from the todz window.` under the field
- [ ] W16 Sign-in on Worker B — input: sign in with the fake provider on Worker B; expected: the sign-in completes and the main window shows the owner's empty Today
- [ ] W17 Connect an Agent on the new server — input: open Connect an agent; expected: the Server URL block reads `http://localhost:8791/mcp`, the caption `The server in use. Change it in Settings › Server.` shows under it, and the Claude Code command names `localhost:8791`
- [ ] W18 The sign-in disclosure — input: signed out, click the `Server` control on the sign-in screen; expected: collapsed on each new appearance; expanded shows the host `localhost:8791` and the form; the sign-in method reloads and the slot does not read `Getting ready…`
- [ ] W19 Switch from the sign-in disclosure while signed out with nothing waiting — input: `http://localhost:8787`; expected: no confirmation dialog; the switch completes; the disclosure reads `localhost:8787`
- [ ] W20 Use todz cloud (Debug default) — input: with `localhost:8791` in use, press Use todz cloud; expected: the same switch path; the row reads `localhost:8787` and the Use todz cloud control is disabled again
- [ ] W21 Relaunch keeps the address — input: quit the Debug app with `localhost:8791` in use and start it again; expected: Settings reads `localhost:8791` and the app starts signed out
- [ ] W22 Double submit — input: double-click Switch… on a valid address; expected: one check and at most one switch; the second click shows nothing new (`Wait until sign-in or the switch finishes.` appears only on the other surface while a switch runs)
- [ ] W23 Narrow window at the minimum (760 by 480) with the sign-in disclosure expanded and a refusal shown — expected: the expanded form and the footnote do not overlap; nothing is clipped
- [ ] W24 Light and dark — expected: the Settings Server group, the expanded sign-in disclosure and Connect an agent with the caption match the design § 6 captures; no token or secret is visible in any capture
- [ ] W25 Accessibility tree — input: Orca's `get-app-state` after W15; expected: the switched message is in the tree as a status text, the Server row has the title `Server` and the address as its value, and the refusal messages are present as text
- [ ] W26 Release build, local server (BLOCKED when the Release preflight fails) — input: `xcodebuild -configuration Release` (its default is `https://api.todz.app`); type `http://localhost:8791` and Switch…; expected: the probe reaches Worker B and the form offers the switch (ADR 0056 § 3); no `App Transport Security` error. The Release app must not sign in to production during this walk
- [ ] W27 Release build, IP literal (BLOCKED when the Release preflight fails) — input: `http://127.0.0.1:8791`; expected: the same as W26. If ATS refuses the IP literal, that is the failure the plan's backout names; record the exact message
- [ ] W28 Worker logs during the walk — expected: Worker A and B logs contain no session token and no key; the health requests appear as GET `/health` only

- [ ] W29 Both walks end on the default — input: after W26 and W27 (or after the Debug walk when the Release rows are BLOCKED), press Use todz cloud in the Debug app and quit the Release app; run `defaults delete dev.todz.Todz serverURL` for the Release app; expected: `defaults read dev.todz.Todz serverURL` reports that the key does not exist, and the Debug row reads `localhost:8787`

Human checklist (sensitive PR): the owner runs these before merging; the agent writes them in the PR body and never ticks them.

- [ ] Clean Release build of the app from `main` plus this branch; signing with the owner's team. Open Settings › Server; expected: `api.todz.app`, and `Use todz cloud` disabled.
- [ ] A real self-hosted deploy from the new guide (steps 1 to 4, 6 and 7 with a domain the owner controls). Run `pnpm --filter @todz/api server:deploy` once; expected: the last line is `todz server ready: https://<domain>  →  paste it in todz › Settings › Server`.
- [ ] `curl -sS https://<domain>/health` — expected: `{"service":"todz","origin":"https://<domain>"}`; `curl -sI https://<domain>/health` shows `cache-control: no-store`.
- [ ] Before any app build that expects `/health` ships, deploy the API from the same commit with `server:deploy` — expected: the last line of its log is the ready line; the app build is not installed until that line is seen.
- [ ] Paste `https://<domain>` — expected: the switch confirms, sign-in mails a link, and the link signs in.
- [ ] Switch back with Use todz cloud — expected: `api.todz.app` answers `{"method":"link"}` on `/owner/sign-in-method` and the switch completes.
- [ ] Production `wrangler deploy` of this head, with step 13's new `/health` line of the deploy runbook — expected: `curl -sS https://api.todz.app/health` answers the body above, and `curl -sS https://api.todz.app/` still answers 404.

## Edge cases found during execution

Empty on purpose. The tester adds one checkbox per new case (input, exact expected outcome) and a regression test for each.

## Adversarial review

The reviewer picks the three claims most likely to be wrong and tries to refute each.

- [ ] Claim 1: a Release app reaches `http://localhost` and `http://127.0.0.1` under `NSAllowsLocalNetworking` — attack: W26 and W27 on a Release build, and read the ATS answer for an IP literal; result: refuted | held
- [ ] Claim 2: the erase precedes the store, so a crash between them never leaves the new address with the old data — attack: read `switchServer` for any `await` between the erase and the store that can throw after the erase but before the store, and the call-order test; result: refuted | held
- [ ] Claim 3: `/health` reaches the Worker and not the static assets — attack: `curl` `/health` on `wrangler dev` with `run_worker_first` as shipped, and the `run_worker_first` pin; result: refuted | held

## Coverage honesty

What is not tested and why.

- Production DNS, certificates and the Workers Paid account — not testable by an agent; the Human checklist covers them with a real domain.
- The real widget extension's snapshot — the erase is unit-tested against the fake widget store; the walk does not look at the widgets.
- The real session file's erase — the fake vault is unit-tested; the existing `FileSessionVaultTests` cover the file itself and are not repeated.
- A real process kill mid-switch — the call-order test proves the order; no process is killed in the walk.
- A real network hang beyond the probe timeout — W11 and W12 use a listener that never answers; a host that drops packets behaves the same to the app but is not walked.
- VoiceOver speech — W25 reads the accessibility tree; the spoken output is not heard.
- The double-submit race between the two surfaces — the flow's `switching` state is unit-tested; W22 is best effort because a double click cannot be timed reliably through Orca.
- The deploy script against a real Cloudflare account — not run; `readyLine` and `publicOriginOf` are unit-tested and the `&&` order is pinned, but no `wrangler deploy` runs in this feature's checks.
- Views (`ServerAddressForm`, `SettingsView`, `SignInScreen`, `KeyScreen`) — no unit test, by repository practice for SwiftUI views; their behaviour is the walk above and the state they render is unit-tested in `ServerSwitchFlow`.
- The README walk: this feature adds no row and no committed screenshot (plan, Lead L3); its captures travel with the PR as media (ADR 0006).
