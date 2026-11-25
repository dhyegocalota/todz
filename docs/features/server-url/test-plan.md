# Test plan: Server URL

Every checkbox states the input and the exact expected outcome. A ticked box carries evidence after ` — evidence: ` (commit hash, log path, counts, screenshot path).

Pinned strings: copied word for word from `design.md` § 4 (the address issues) and § 9 (every other string). The empty field is not a refusal: it disables Switch… with the reason `serverEmpty`.

| Issue, state or copy | The string (design) |
|---|---|
| `invalid` (not a URL at all) | `Enter an address like https://todz.example.com.` |
| `missingScheme`, `unsupportedScheme` | `Start the address with https://.` |
| `insecureRemoteHost` | `Use https://. Plain http:// works only for localhost.` |
| `missingHost` | `Add the server's name after https://.` |
| `hasPath` | `The address has no path. Enter the server's root address.` |
| `hasQuery` | `Remove the part from ? on.` |
| `hasFragment` | `Remove the part from # on.` |
| `hasCredentials` | `Remove the name and password before @.` |
| empty field (disabled reason) | `Enter a server address.` (`serverEmpty`) |
| same address as in use | `todz already uses this server.` (`serverInUse`) |
| probe `notTodz`, `unreachable` | `No todz server answered at that address.` |
| probe `answersAs(origin:)` | `That server answers as {origin}. Enter that address instead.` |
| erase failed | `ErrorCopy.serverSwitchFailed`: `This Mac's copy could not be erased, so todz stayed on {server}.` (added by the plan review; the owner may change it) |
| switched | `Switched to {server}. Sign in from the todz window.` |
| switch confirmation, signed in, nothing waiting | title `Switch to {new}?`; message `You'll be signed out, and this Mac's copy of your tasks is erased. Your tasks stay on {old}.` |
| switch confirmation with changes waiting | title `Switch to {new} and lose {count} change(s)?`; message `They haven't reached {old} yet. Switching signs you out and erases them from this Mac.` (signed in) or `They haven't reached {old} yet. Switching erases them from this Mac.` (signed out) |

## The failing test first

- [ ] `apps/api/test/health.test.ts` at its red commit — input: `GET http://localhost:8787/health`, `GET http://localhost:8788/health`, `GET http://localhost:8799/health`; expected: fails `expected 404 to be 200` on each host, since the route does not answer yet; the `POST` and the `/health/` cases pass as pins (404 already)
- [ ] `tools/repository-shape/src/api-source.test.ts` at its red commit — input: the current `apps/api/wrangler.jsonc`; expected: fails on the `ASSETS_PATTERN` pin, which now names `"/health"` in `run_worker_first`
- [ ] `apps/api/test/server/ready.test.ts` at its red commit, run in the node pool — input: `readyLine({ publicOrigin: 'https://api.example.com' })`; expected: fails with `readyLine is not implemented`, not with a pool or type error
- [ ] `tools/repository-shape/src/self-host.test.ts` and `runbooks.test.ts` at their red commit — expected: fail on `server:deploy` missing from the guide and on the `/health` curl and "fourteen" missing from the runbook's step 13
- [ ] `ServerAddressTests`, `ServerPreferenceTests` and `ServerNameTests` at their red commit, each run alone with `--filter` — expected: each stops on `… is not implemented` (`preconditionFailure`)
- [ ] `OwnerAPIHealthTests`, `ServerProbeOutcomeTests` and `ServerSwitchFlowTests` at their red commit — expected: each stops on its stub or fails its assertion
- [ ] `tools/repository-shape/src/macos-identities.test.ts` at the A3 red commit — expected: fails on line 63, which now expects Release `TODZ_ALLOWS_LOCAL_NETWORKING` to be `'YES'` against the current `NO`
- [ ] `AppModelTests+Server` at the A5 red commit, with the init, the harness and the throwing stubs landed — expected: each test stops on `switchServer(to:) is not implemented` or on its assertion, never on a build error
- [ ] The printed texts match the developer's `tester-briefing.md` row for row — evidence: (to be recorded)

## Unit: the Worker (Lane S)

- [ ] `GET /health` on the API host, origin `http://localhost:8787` — expected: 200, body exactly `{"service":"todz","origin":"http://localhost:8787"}`, `content-type: application/json`, `cache-control: no-store` — evidence: (to be recorded)
- [ ] `GET /health?probe=1` on the API host — expected: the same 200 and body (the query is ignored)
- [ ] `GET /health` on the site host `http://localhost:8788` — expected: 200, the same body with the API origin `http://localhost:8787`, because the Worker answers `/health` on every host (ADR 0056 § 4)
- [ ] `GET /health` on an unknown host `http://localhost:8799` — expected: 200, the same body with the API origin
- [ ] `POST /health` on the API host and on the site host — expected: 404, empty body
- [ ] `GET /health/` (trailing slash) on the API host — expected: 404, empty body
- [ ] `GET /` on the API host — expected: still 404 (the runbook's landing pin holds)
- [ ] A Worker with no `PUBLIC_ORIGIN` — expected: `GET /health` answers 404, empty body; no origin is ever invented
- [ ] The `no-store` value — expected: `NO_STORE` in `apps/api/src/http-header.ts` is the one literal; the health answer, the Turnstile page and the admin paths all send it (a grep finds no other `'no-store'` literal in `apps/api/src`)
- [ ] `apps/api/wrangler.jsonc` — expected (the asset pin of `api-source.test.ts`): `assets.run_worker_first` lists `/owner`, `/owner/*`, `/mcp`, `/sign-in`, `/sign-in/challenge`, `/health`, in that order, and nothing else changes
- [ ] `readyLine({ publicOrigin: 'https://api.example.com' })`, in the node pool — expected: exactly `todz server ready: https://api.example.com  →  paste it in todz › Settings › Server`
- [ ] `publicOriginOf(text)` on the current `wrangler.jsonc` text (trailing commas present) — expected: `https://api.todz.app`
- [ ] `publicOriginOf` on JSONC without `PUBLIC_ORIGIN` — expected: throws `PUBLIC_ORIGIN is missing from the Wrangler configuration`
- [ ] `server:deploy` in `apps/api/package.json` — expected: the value is `wrangler deploy && tsx scripts/server/cli.ts`; a failed deploy (`wrangler` exits non-zero) prints no ready line (the `&&` order is the pin)
- [ ] The Workers test pool and the node pool — expected: `test/server/**` runs only in the node pool, and `pnpm --filter @todz/api typecheck` passes with `test/server/**` excluded from `tsconfig.json` and included in `tsconfig.scripts.json`
- [ ] The production `pnpm --filter @todz/api test:e2e` — expected: passes unchanged at the merged head (the lead runs it once)
- [ ] `docs/self-host.md` — expected: step 4 and Updating run `pnpm --filter @todz/api server:deploy`; step 6 says to deploy again with the same script; step 7 names no `TODZ_API_BASE_URL`; the guide's `curl …/health` answers `{"service":"todz","origin":"https://api.example.com"}`; the Updating section puts the server before the app
- [ ] `apps/api/src/site/generated/self-host-html.ts` — expected: `generated-site.test.ts` and `pnpm --filter @todz/api site:check` pass at the merged head
- [ ] `docs/runbooks/deploy-the-api.md` step 13 — expected: its curl `https://api.todz.app/health` expects the body above, its sentence reads "When all fourteen pass", and `runbooks.test.ts` passes; the runbook's step count is unchanged

## Unit: TodzKit (Lane A)

- [ ] `ServerAddress` `" https://Todz.Example.com/ "` — expected: accepted, `origin` `https://todz.example.com`
- [ ] `https://todz.example.com` — expected: accepted, `origin` `https://todz.example.com`
- [ ] `HTTP://LOCALHOST:8787` — expected: accepted, `origin` `http://localhost:8787` (the scheme and host are lower-cased)
- [ ] `http://localhost:8787` — expected: accepted, `origin` `http://localhost:8787`
- [ ] `http://127.0.0.1:8787` — expected: accepted, `origin` `http://127.0.0.1:8787`
- [ ] `http://[::1]:8787` — expected: accepted, `origin` `http://[::1]:8787`
- [ ] `http://localhost.evil.example` — expected: refused `insecureRemoteHost`; a loopback name is matched exactly, never as a prefix
- [ ] `http://127.0.0.2:8787` — expected: refused `insecureRemoteHost`; only `127.0.0.1` is loopback
- [ ] `http://todz.example.com` — expected: refused `insecureRemoteHost`, string from the table above
- [ ] `todz.example.com` — expected: refused `missingScheme`
- [ ] `ftp://todz.example.com` — expected: refused `unsupportedScheme`
- [ ] `https://` — expected: refused `missingHost`
- [ ] `https://todz.example.com/?a=1` — expected: refused `hasQuery`
- [ ] `https://todz.example.com/#top` — expected: refused `hasFragment`
- [ ] `https://user:secret@todz.example.com` — expected: refused `hasCredentials`; the message names no part of the credentials
- [ ] `https://example.com/todz` — expected: refused `hasPath`
- [ ] `   ` (spaces only) — expected: refused `invalid` from `checked(text:)`; the form never calls it, because the empty field disables Switch… with `serverEmpty`
- [ ] `not a url` — expected: refused `invalid`
- [ ] `https://todz.example.com:443` — expected: accepted, `origin` `https://todz.example.com` (the scheme's default port is dropped)
- [ ] `http://localhost:80` — expected: accepted, `origin` `http://localhost` (the default port for http is dropped)
- [ ] `https://todz.example.com:8443` — expected: accepted, `origin` `https://todz.example.com:8443` (a non-default port is kept)
- [ ] `ServerName.of(address:)` — expected: `api.todz.app` for `https://api.todz.app`, `localhost:8787` for `http://localhost:8787`, `[::1]:8787` for `http://[::1]:8787`
- [ ] `ServerPreference` with nothing stored — expected: `storedAddress()` is nil; the model starts on the default
- [ ] `ServerPreference` with the stored text `not a url` — expected: `storedAddress()` is nil; no crash; the model starts on the default
- [ ] `ServerPreference` after `store(https://todz.example.com)` then `clear()` — expected: `storedAddress()` is nil
- [ ] `OwnerAPI.health()` against a stub answering 200 `{"service":"todz","origin":"https://x.example.com"}` — expected: `.todz(origin: "https://x.example.com")`; the request is `GET <base>/health` with no session header
- [ ] `OwnerAPI.health()` against 200 `{"service":"other","origin":"https://x.example.com"}` — expected: `.notTodz`
- [ ] `OwnerAPI.health()` against 200 `<html>…</html>` — expected: `.notTodz`
- [ ] `OwnerAPI.health()` against 404 with an empty body — expected: `.notTodz`
- [ ] `OwnerAPI.health()` against 429 and against 503 — expected: `.notTodz` for each
- [ ] `OwnerAPI.health()` against 301 with `location: https://elsewhere.example.com/health` — expected: `.notTodz`, and the redirect is not followed (the stub records one request)
- [ ] `OwnerAPI.health()` against 200 `{"service":"todz"}` with no origin — expected: `.notTodz`
- [ ] `OwnerAPI.health()` when the transport throws `URLError(.cannotConnectToHost)` — expected: throws `OwnerAPIError.unreachable`
- [ ] The probe request's `timeoutInterval` — expected: equals `ServerTiming.probeSeconds` (10); the test never waits for the timeout
- [ ] `ServerProbeOutcome.of(answer: .todz(origin: "https://todz.example.com"), typedAddress: "https://todz.example.com/")` — expected: `.matches`
- [ ] `ServerProbeOutcome.of(answer: .todz(origin: "http://localhost:8787"), typedAddress: "http://127.0.0.1:8787")` — expected: `.answersAs(origin: "http://localhost:8787")`
- [ ] `ServerProbeOutcome.of(answer: .notTodz, …)` — expected: `.notTodz`
- [ ] `ServerProbeOutcome.of(unreachable)` — expected: `.unreachable`, which the flow shows with the same string as `.notTodz`
- [ ] `ServerSwitchFlow`: idle, submit `todz.example.com` (no scheme) — expected: `refused(.missingScheme)`, no probe started
- [ ] `ServerSwitchFlow`: idle, submit a valid address — expected: `checking`
- [ ] `ServerSwitchFlow`: idle, submit the address equal to `serverURL` in use — expected: `alreadyInUse`, decided before any probe (the probe count is zero)
- [ ] `ServerSwitchFlow`: checking, probe `.matches`, signed out, nothing waiting — expected: `switching` (no confirmation)
- [ ] `ServerSwitchFlow`: checking, probe `.matches`, signed in, nothing waiting — expected: `confirming(losing: 0, signedIn: true)`
- [ ] `ServerSwitchFlow`: checking, probe `.matches`, signed out, two changes waiting — expected: `confirming(losing: 2, signedIn: false)`
- [ ] `ServerSwitchFlow`: checking, probe `.notTodz` or `.unreachable` — expected: `notTodz`
- [ ] `ServerSwitchFlow`: checking, probe `.answersAs(origin:)` — expected: `answersAs(origin:)`; no switch
- [ ] `ServerSwitchFlow`: checking, Cancel — expected: `idle`, the typed text kept, no message
- [ ] `ServerSwitchFlow`: idle after Cancel, a late `.unreachable` (the cancelled probe's `URLError.cancelled` mapped) arrives — expected: stays `idle`, no message; outcomes outside `checking` are ignored
- [ ] `ServerSwitchFlow`: switching, a second submit — expected: ignored; the state stays `switching`
- [ ] `ServerSwitchFlow`: switching, the model reports an erase failure — expected: `failed(.eraseFailed)`, and the address in use is unchanged
- [ ] `ServerSwitchFlow`: after the model finishes a switch — expected: `switched(server: "localhost:8791")`
- [ ] `AppModel.switchServer(to:)` signed in with one task in the outbox — expected: the captured session is signed out at the old service after the switch; the store, the outbox, the widget snapshot, the pending link and the sign-in state are erased; the factory is called once with the new address; the phase is `.signedOut(nil)`; the address is stored; returns `true`
- [ ] `AppModel.switchServer(to:)` signed out, nothing waiting — expected: sign-out is not called; the switch completes; returns `true`
- [ ] `AppModel.switchServer(to:)` where the old service's sign-out throws — expected: the switch completes; the old session is erased locally; returns `true`
- [ ] `AppModel.switchServer(to:)` where the store's erase throws — expected: returns `false`; the address in use is unchanged; the factory is never called; the preference is never written; the error is `ErrorCopy.serverSwitchFailed`
- [ ] `AppModel.switchServer(to:)` with the same address as in use — expected: returns `false`; the probe, sign-out, erase and factory are never called
- [ ] A vault erase that throws (`aThrowingVaultEraseStopsTheSwitchBeforeTheFactory`) — expected: returns `false`; the factory is not called (count zero); the preference is not written; the old address is kept
- [ ] A pending-link erase that throws (`aThrowingPendingLinkEraseStopsTheSwitchBeforeTheFactory`) — expected: the same as the vault case
- [ ] Sign-in state after a successful switch — expected: the challenge token is nil, the sign-in method and its error are nil, the sign-in error and the last identity are nil, the challenge round is one more than before, `keys == nil` and `issuedKey == nil`
- [ ] A sign-in link arriving after the switch from the old server's mail (`todz://sign-in?token=…`) — expected: `.linkNotRequested`; neither the old nor the new fake service records a `signIn`
- [ ] A switch while `isSigningIn` is true, or while `isRequestingLink` is true — expected: `switchServer(to:)` returns `false`; the probe, sign-out, erase and factory are never called
- [ ] A redeem held at the old service (`HeldCallWaiter`) while the switch happens, then released (`aRedeemFinishingAfterASwitchIsDroppedAndSignedOutAtItsService`) — expected: no call carries the old token to the new fake; the session the redeem returned is signed out at the old service; the new service's `updateOwner` is never called
- [ ] A method load held past the switch, then its task cancelled (`aMethodLoadFinishingAfterASwitchIsDropped`) — expected: the new screen's sign-in method is nil and the old method is not set; no `Can't reach todz` message appears (the `URLError.cancelled` is dropped, not mapped to `.unreachable`)
- [ ] Call order of a successful switch — expected: erase of the session, cache, pending link and sign-in state, then the factory, then the preference write, with the detached sign-out last (recorded by the fakes); no other call sits between the erase and the preference write
- [ ] The old service's sign-out held by a waiter — expected: `switchServer` returns `true` while the sign-out is still held; the waiter's release afterwards records the sign-out with the captured session
- [ ] A switch while the change socket watches the old server — expected: the old watch task is cancelled before the factory is called; the fake signals record one cancellation
- [ ] A new `AppModel` built with a stored address `https://todz.example.com` — expected: `serverURL` is that address; the factory was called with it once
- [ ] A new `AppModel` built with a stored value that does not parse (`not a url`) and a session in the vault — expected: the vault is empty, the cache and outbox are empty, the phase is `.signedOut`, the factory was called once with the default, and no call carries the session (`anUnreadableStoredAddressErasesTheSessionBeforeLaunch`)
- [ ] The factory and the probe counts — expected: the factory is called once in `init` and once per successful switch; the probe is called once per check; a refused or same-address check calls the probe zero times
- [ ] The existing `AppModelTests` sign-out cases after the extraction in Step A6 — expected: pass unchanged; the count printed in the evidence equals the count before the step

## Repository shape (Lane A)

- [ ] `tools/repository-shape/src/macos-identities.test.ts` line 63 — expected: Release `TODZ_ALLOWS_LOCAL_NETWORKING` is `'YES'` after A4; Debug stays `'YES'`
- [ ] `apps/macos/project.yml` — expected: Release `TODZ_ALLOWS_LOCAL_NETWORKING` is `"YES"`, Debug stays `"YES"`
- [ ] `apps/macos/Todz/Todz.entitlements` — expected: still contains `com.apple.security.network.client`
- [ ] `apps/macos/project.yml` `TodzAPIBaseURL` — expected: still reads `$(TODZ_API_BASE_URL)` in the generated Info.plist (the build setting stays as the default; `api-source.test.ts`'s pins still pass)
- [ ] The built Release `Info.plist` (`plutil -p`), at A4 and A9 — expected: the `NSAllowsLocalNetworking` value is one ATS reads as YES; the value is recorded in the tester briefing; if it is not, the step stops and asks the owner

## E2E

No Playwright spec: the app is native (ADR 0026). The Worker's Playwright suite is the existing one, run unchanged (see Unit: the Worker).

## Prove it for real — Orca walk (ADR 0026)

Setup, recorded in the tester briefing with the commands:

- [ ] Worker A (seeded): `pnpm --filter @todz/api dev` on port 8787, default local state; sign in once with the fake provider and add one task in the app so the state holds an owner, a workspace and a project. Expected: `curl -sS http://localhost:8787/health` answers `{"service":"todz","origin":"http://localhost:8787"}`.
- [ ] Worker B (unseeded): migrate the scratch copy with `pnpm --filter @todz/api exec wrangler d1 migrations apply todz-directory --local --persist-to <scratchpad>/worker-b`, then `pnpm --filter @todz/api exec wrangler dev --port 8791 --local-upstream localhost:8791 --persist-to <scratchpad>/worker-b --var SIGN_IN_PROVIDER:fake --var EMAIL_SENDER:console --var PUBLIC_ORIGIN:http://localhost:8791 --var SITE_ORIGIN:http://localhost:8792 --var ADMIN_EMAIL:admin@todz.test --var TURNSTILE_SITE_KEY:1x00000000000000000000AA --var TURNSTILE_SECRET_KEY:1x0000000000000000000000000000000AA`. Expected: `curl -sS http://localhost:8791/health` answers `{"service":"todz","origin":"http://localhost:8791"}`.
- [ ] A listener that accepts and never answers: `nc -l 8798` in a scratch shell. Expected: a request to it hangs until the probe timeout.
- [ ] The site Worker of Worker A: `pnpm --filter @todz/api dev:site` on port 8788. Expected: `curl -sS http://localhost:8788/health` answers the origin of Worker A (`http://localhost:8787`), since `/health` answers on every host.
- [ ] Nothing listens on port 8799. Expected: a probe of `http://localhost:8799` is refused at once.

Release preflight (before W26 and W27): read the Release app's defaults (`defaults read dev.todz.Todz`) and its Application Support folder. If either holds a session, a pending change or any state of an owner, the Release rows are BLOCKED: record the reason, never switch the owner's real app, and leave them for the Human checklist. If both are empty, the Release rows run, and W29 ends them.

The walk, in the Debug app unless a step says Release. Each step's screenshots are light and dark and go to `.pr-media/server-url/` (the design § 6 names):

- [ ] W1 Fresh Debug launch, no stored address — input: open Settings › Server; expected: the row reads `localhost:8787`; `Use todz cloud` is absent, because the default is in use (design § 1.1); the group shows the detail `Where your tasks are kept. Switching signs you out and erases this Mac's copy.`
- [ ] W2 Address without scheme — input: `localhost:8791`, Switch…; expected: refused with `Start the address with https://.`; no request reaches Worker B (its log is empty)
- [ ] W3 Plain http to a remote host — input: `http://todz.example.com`; expected: refused with `Use https://. Plain http:// works only for localhost.`; no request
- [ ] W4 Address with a path — input: `http://localhost:8791/todz`; expected: refused with `The address has no path. Enter the server's root address.`
- [ ] W5 Address with a query — input: `http://localhost:8791/?x=1`; expected: refused with `Remove the part from ? on.`
- [ ] W6 Address with credentials — input: `http://user:pw@localhost:8791`; expected: refused with `Remove the name and password before @.`, and `pw` appears nowhere on screen
- [ ] W7 Refused address leaves the field — input: after W2 to W6; expected: the field keeps the typed text, the in-use address stays `localhost:8787`
- [ ] W8 Nothing listens — input: `http://localhost:8799`; expected: `Checking the server…` then `No todz server answered at that address.`; the address in use is unchanged
- [ ] W9 The site Worker answers — input: `http://localhost:8788`; expected: `That server answers as http://localhost:8787. Enter that address instead.` (its `/health` answers the API origin, ADR 0056 § 4), and the address in use is unchanged
- [ ] W10 Origin mismatch — input: `http://127.0.0.1:8787`; expected: `That server answers as http://localhost:8787. Enter that address instead.`; the address in use is unchanged; Switch… is still offered for the typed address; focus returns to the server field, and a sign-in slot does not take it
- [ ] W11 Probe cancelled — input: `http://localhost:8798`, then Escape during `Checking the server…`; expected: back to the idle form with the typed text, no message, no request left open (the listener logs one connection); a late timeout message does not appear
- [ ] W12 Probe times out — input: `http://localhost:8798`, no action; expected: after the probe timeout (10 seconds) `No todz server answered at that address.`
- [ ] W13 Switch with an unsynced change and an unreachable old server — input: sign in to Worker A, add a task, stop Worker A, then Settings › Server to `http://localhost:8791`; expected: confirmation `Switch to localhost:8791 and lose 1 change?` with `They haven't reached localhost:8787 yet. Switching signs you out and erases them from this Mac.`; the sign-out at Worker A fails and the switch goes on
- [ ] W14 Cancel is the default button — input: in W13's dialog press Return; expected: the dialog closes, the app stays on Worker A signed in, the change is still waiting (Worker A restarted to check)
- [ ] W15 Confirm the switch — input: W13 again, click Switch Server; expected: the phase becomes signed out, the sign-in screen is shown, Settings reads `localhost:8791`, and Settings shows `Switched to localhost:8791. Sign in from the todz window.` under the field
- [ ] W16 Sign-in on Worker B — input: sign in with the fake provider on Worker B; expected: the sign-in completes and the main window shows the owner's empty Today
- [ ] W17 Connect an Agent on the new server — input: open Connect an agent; expected: the Server URL block reads `http://localhost:8791/mcp`, the caption `The server in use. Change it in Settings › Server.` shows under it, and the Claude Code command names `localhost:8791`
- [ ] W18 Sign out, then the sign-in disclosure — input: sign out in the app, then look at the sign-in screen; expected: the line `Server: localhost:8791 ›` shows collapsed; expanding it shows the form with the host `localhost:8791`; the sign-in method loads and the slot does not read `Getting ready…`
- [ ] W19 Relaunch keeps the address — input: quit the Debug app with `localhost:8791` in use and start it again; expected: Settings reads `localhost:8791` and the app starts signed out
- [ ] W20 Use todz cloud (Debug default) — input: with `localhost:8791` in use, press Use todz cloud; expected: the same switch path; the row reads `localhost:8787`; `Use todz cloud` is absent again
- [ ] W21 Switch from the sign-in disclosure while signed out with nothing waiting — input: `http://localhost:8791` typed in the disclosure; expected: no confirmation dialog; the switch completes; the line reads `Server: localhost:8791 ›`
- [ ] W22 Double submit — input: double-click Switch… on a valid address; expected: one check and at most one switch; the second click shows nothing new (`Wait until sign-in or the switch finishes.` appears only on the other surface while a switch runs)
- [ ] W23 Narrow window at the minimum (760 by 480) with the sign-in disclosure expanded and a refusal shown — expected: the expanded form and the footnote do not overlap; nothing is clipped
- [ ] W24 Light and dark — expected: the Settings Server group, the expanded sign-in disclosure and Connect an agent with the caption match the design § 6 captures; no token or secret is visible in any capture
- [ ] W25 Accessibility tree — input: Orca's `get-app-state` after W15; expected: the switched message is in the tree as a status text, the Server row has the title `Server` and the address as its value, and the refusal messages are present as text
- [ ] W26a Release build on the A3 commit (still `NO`, BLOCKED when the Release preflight fails) — input: `xcodebuild -configuration Release` (its default is `https://api.todz.app`); type `http://localhost:8791` and Switch…; expected: the answer ATS gives is recorded verbatim in the tester briefing, whether the probe succeeds or fails. The Release app must not sign in to production during this walk
- [ ] W26b The same walk on the A4 commit (after the flag is YES) — expected: the probe reaches Worker B and the form offers the switch (ADR 0056 § 3); no `App Transport Security` error. Compare with W26a in the briefing
- [ ] W27 Release build, IP literal (BLOCKED when the Release preflight fails) — input: `http://127.0.0.1:8791`, on the A4 commit; expected: the same as W26b. If ATS refuses the IP literal, that is the failure the plan's backout names; record the exact message
- [ ] W28 Worker logs during the walk — expected: Worker A and B logs contain no session token and no key; the health requests appear as GET `/health` only
- [ ] W29 Both walks end on the default — input: after W26b and W27 (or after the Debug walk when the Release rows are BLOCKED), press Use todz cloud in the Debug app and quit the Release app; run `defaults delete dev.todz.Todz serverURL` for the Release app; expected: `defaults read dev.todz.Todz serverURL` reports that the key does not exist, and the Debug row reads `localhost:8787`

Human checklist (sensitive PR): the owner runs these before merging; the agent writes them in the PR body and never ticks them.

- [ ] Clean Release build of the app from `main` plus this branch; signing with the owner's team. Open Settings › Server; expected: `api.todz.app`, and `Use todz cloud` absent.
- [ ] A real self-hosted deploy from the new guide (steps 1 to 4, 6 and 7 with a domain the owner controls). Run `pnpm --filter @todz/api server:deploy` once; expected: the last line is `todz server ready: https://<domain>  →  paste it in todz › Settings › Server`.
- [ ] `curl -sS https://<domain>/health` — expected: `{"service":"todz","origin":"https://<domain>"}`; `curl -sI https://<domain>/health` shows `cache-control: no-store`.
- [ ] Before any app build that expects `/health` ships, deploy the API from the same commit with `server:deploy` — expected: the last line of its log is the ready line; the app build is not installed until that line is seen.
- [ ] Paste `https://<domain>` — expected: the switch confirms, sign-in mails a link, and the link signs in. The Release Turnstile web view on that real origin is walked here, because the Orca walk's Worker B uses the fake provider.
- [ ] Switch back with Use todz cloud — expected: `api.todz.app` answers `{"method":"link"}` on `/owner/sign-in-method` and the switch completes.
- [ ] Production `wrangler deploy` of this head, with step 13's new `/health` line of the deploy runbook — expected: `curl -sS https://api.todz.app/health` answers the body above, and `curl -sS https://api.todz.app/` still answers 404.

## Edge cases found during execution

Empty on purpose. The tester adds one checkbox per new case (input, exact expected outcome) and a regression test for each.

## Adversarial review

The reviewer picks the three claims most likely to be wrong and tries to refute each.

- [ ] Claim 1: a Release app reaches `http://localhost` and `http://127.0.0.1` under `NSAllowsLocalNetworking`, and the `<string>` form of the key is read as YES — attack: W26a and W26b on the two commits, and `plutil -p` on the built plist; result: refuted | held
- [ ] Claim 2: the erase precedes the store, and no answer from the old server can open a session on the new one — attack: read `switchServer` for any `await` between the erase and the store, and the race tests (the redeem and the method load); result: refuted | held
- [ ] Claim 3: `/health` reaches the Worker and not the static assets, on every host — attack: `curl` `/health` on `wrangler dev` with `run_worker_first` as shipped, on the API, site and unknown hosts, and the `run_worker_first` pin; result: refuted | held

## Coverage honesty

What is not tested and why.

- Production DNS, certificates and the Workers Paid account — not testable by an agent; the Human checklist covers them with a real domain.
- The Release Turnstile web view on `http://localhost` — the Orca walk's Worker B uses the fake provider, so the challenge page is never shown on loopback in Release; the Human checklist covers it on a real origin.
- The real widget extension's snapshot — the erase is unit-tested against the fake widget store; the walk does not look at the widgets.
- The real session file's erase — the fake vault is unit-tested; the existing `FileSessionVaultTests` cover the file itself and are not repeated.
- A real process kill mid-switch — the call-order test proves the order; no process is killed in the walk.
- A real network hang beyond the probe timeout — W11 and W12 use a listener that never answers; a host that drops packets behaves the same to the app but is not walked.
- VoiceOver speech — W25 reads the accessibility tree; the spoken output is not heard.
- The double-submit race between the two surfaces — the flow's `switching` state is unit-tested; W22 is best effort because a double click cannot be timed reliably through Orca.
- The sign-in answers that race a switch — unit-tested with `HeldCallWaiter` and fakes; the walk cannot time them.
- The deploy script against a real Cloudflare account — not run; `readyLine` and `publicOriginOf` are unit-tested and the `&&` order is pinned, but no `wrangler deploy` runs in this feature's checks.
- Views (`ServerAddressForm`, `SettingsView`, `SignInScreen`, `KeyScreen`, `AddressSlot`, `CredentialSlot`) — no unit test, by repository practice for SwiftUI views; their behaviour is the walk above and the state they render is unit-tested in `ServerSwitchFlow`.
- The README walk: this feature adds no row and no committed screenshot (plan, Lead L3); its captures travel with the PR as media (ADR 0006).
