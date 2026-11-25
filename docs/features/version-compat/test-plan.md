# Test plan: Version compatibility

Every checkbox states the input and the exact expected outcome. A ticked box carries evidence after ` — evidence: ` (commit hash, log path, counts, screenshot path). The failure texts below are the expected ones; the tester replaces each with the text the red run actually printed.

## The failing test first

- [ ] `apps/api/test/app-version.test.ts` red commit — every row fails with `Error: isAppVersionAccepted is not implemented`
- [ ] `apps/api/test/app-version-gate.test.ts` red commit — `GET /owner/sign-in-method` with no header fails with `expected 200 to be 426`; `POST /owner/sign-in-links` with the pre-ADR-0058 body (no `app_link_scheme`) and no header fails with `expected 400 to be 426`
- [ ] `apps/api/test/server-version.test.ts` and `health.test.ts` red commit — `expected null to be '2026.11.25+0000000'` on the header rows; the health body diff names `version` and `minimum_app_version`
- [ ] `apps/api/test/server/version-stamp.test.ts` and `ready.test.ts` red commit — `Error: versionStamp is not implemented`; the ready-line string diff
- [ ] `VersionCompatibilityTests.swift` red commit — `Expectation failed: (VersionCompatibility.of(…) → .serverUnknown(app: "0.2.0")) == …` on every row that is not unknown
- [ ] `OwnerRequestTests.swift`, `OwnerAPIHealthTests.swift`, `OwnerAPITests.swift` red commit — the header rows fail with `→ nil) == "0.2.0"`; the `app_too_old` row fails with `.unexpected(status: 426)`
- [ ] `AppModelTests+Version.swift` red commit — `(model.compatibility → nil) == .compatible(…)` and the outbox count diff
- [ ] Each red commit sits alone before its green commit in `git log`, and a throwaway worktree at each red hash prints the recorded text

## Unit

### Version rule (server, `isAppVersionAccepted`, minimum `0.2.0`)

- [ ] `0.2.0` → accepted; `0.2` → accepted; `1` → accepted; `0.10.0` → accepted; `1.0.0` → accepted
- [ ] `0.1.9` → refused; `0.1` → refused; `0` → refused
- [ ] Numeric, not lexical: `0.10.0` accepted and `0.9.9` refused against minimum `0.10.0`
- [ ] Malformed → refused: `''`, `v0.2.0`, `0.2.0-beta`, `0.2.0.1`, `0..2`, ` 0.2.0`, `0.2.0 `, `١.٠` (non-ASCII digits), a 200-character string of digits and dots
- [ ] `null` (no header) → refused

### Gate (server, through the Worker)

- [ ] No header, `0.1.9`, `v0.2.0` on `GET /owner/sign-in-method` → `426`, header `Upgrade: todz-app/0.2.0`, body exactly `{"error":"app_too_old","minimum_app_version":"0.2.0"}`
- [ ] Pre-0058 sign-in-link body with no header → `426` with that body, not `400`
- [ ] Signed in, `GET /owner` with `0.1.0` → `426`; the session is not touched (a later call with `0.2.0` and the same token → `200`)
- [ ] `GET /owner/projects/:id/socket` with an upgrade request and no app header → `426` with the todz body, not the store's bare WebSocket `426`
- [ ] `0.2.0`, `0.2`, `1.0.0` → the route's own answer, unchanged from before this feature
- [ ] `GET /owner/nope` with no header → `404`, no body
- [ ] A `426` costs no sign-in limiter budget: the limiter count is zero after ten refused sign-in requests
- [ ] `POST /mcp` with no app header → its usual answer, never `426`; `GET /health` with no app header → `200`; `GET /sign-in` → its page

### Header and health (server)

- [ ] `Todz-Api-Version: 2026.11.25+0000000` on: a signed-in owner `200`, an owner `426`, a `POST /mcp` answer, `GET /health`, `HEAD /health`, an api-host `404`, a site-host page, the site's `404`
- [ ] `withServerVersion({ response, version: null })` → no `Todz-Api-Version` header
- [ ] A `101` WebSocket answer passes through untouched (same object, no header)
- [ ] `GET /health` body: `{"service":"todz","origin":"http://localhost:8787","version":"2026.11.25+0000000","minimum_app_version":"0.2.0"}`; `HEAD /health` has the same headers and no body
- [ ] `OPTIONS /owner` → `404` with the header and no `Access-Control-*` header

### Stamp and ready line (server scripts)

- [ ] `versionStamp({ commitDate: '2026-11-25', commitHash: '3f9c2ab8d1e0' })` → `2026.11.25+3f9c2ab`
- [ ] A short hash (`3f9c2a`), a non-hex hash, a date `2026-1-5` → throws `Cannot stamp the server version: …`
- [ ] `readyLine({ publicOrigin: 'https://api.todz.app', serverVersion: '2026.11.25+3f9c2ab', minimumAppVersion: '0.2.0' })` → `todz server ready: https://api.todz.app · server 2026.11.25+3f9c2ab · accepts app 0.2.0 or later  →  paste it in todz › Settings › Server`
- [ ] `server:deploy` in `package.json` is `tsx scripts/server/cli.ts`, and `cli.ts` passes `--define TODZ_SERVER_VERSION:"<stamp>"` to `wrangler deploy` (asserted by a test over the argument builder, no deploy)

### Compatibility rule (app, `VersionCompatibility.of`)

- [ ] App `0.2.0`, server `2026.11.25+3f9c2ab`, minimum `0.2.0` → `compatible(app: "0.2.0", server: "2026.11.25+3f9c2ab")`
- [ ] App `0.2.0`, server minimum `0.3.0` → `updateNeeded(app: "0.2.0", server: …, minimum: "0.3.0")`
- [ ] App `0.2.0`, a recorded `appTooOld(minimum: "0.3.0")` with a compatible health answer → `updateNeeded` (the refusal wins)
- [ ] Server `2026.11.20+aaaaaaa` → `serverBehind(app: "0.2.0", server: "2026.11.20+aaaaaaa")`
- [ ] Server answered with no `version` → `serverBehind(app: "0.2.0", server: nil)`
- [ ] No answer, or unreachable → `serverUnknown(app: "0.2.0")`
- [ ] Same-day server `2026.11.25+bbbbbbb` → `compatible`; `2026.12.01+ccccccc` → `compatible`
- [ ] App `0.10.0` against minimum `0.9.0` → `compatible` (numeric)
- [ ] A server stamp that does not parse (`banana`) → `serverBehind(server: nil)`, never a crash

### Transport and decoding (app)

- [ ] Every request from `OwnerRequest.transportRequest` carries `Todz-App-Version: 0.2.0`: an owner call, `health()`, and `SocketChangeSignals.socketRequest`
- [ ] `/health` with both fields → `.todz(origin:versions:)` with `server` and `minimumApp` set; without them → both nil; with `version: null` → `server` nil
- [ ] `426` + `{"error":"app_too_old","minimum_app_version":"0.3.0"}` → `OwnerAPIError.appTooOld(minimum: "0.3.0")`
- [ ] `426` + empty body → `.unexpected(status: 426)`; `426` + `{"error":"app_too_old"}` → `.unexpected(status: 426)`

### Model (app)

- [ ] Launch with a compatible health answer → `model.compatibility == .compatible(…)`
- [ ] A server switch to a server without `version` → `serverBehind(server: nil)`; switching back → `compatible`
- [ ] Any owner call failing with `appTooOld` → `updateNeeded`, `banner == .updateNeeded`
- [ ] A queued add answered `appTooOld` → still in the outbox (count unchanged), no refusal notice, no further flush while `updateNeeded`; after a compatible probe the flush resumes and the add lands
- [ ] A sign-in refused with `appTooOld` → the sign-in error is `.appTooOld`, and `compatibility` is `updateNeeded`
- [ ] The app bundle's `CFBundleShortVersionString` and the widgets' both read `0.2.0` in the built `Info.plist`

## E2E (Playwright specs)

- [ ] No browser surface changes: the sign-in page and the site keep their specs green (`pnpm --filter @todz/api test:e2e`), and each answer they load carries `todz-api-version` when stamped (one assertion in `landing.spec.ts` on the page response)

## Prove it for real

The app is native: the walk runs with Orca against a local Worker (`wrangler dev` with `--define`) and a stub server, never against production, and opens the popover only when a state needs it (the owner is disturbed by popover walks).

- [ ] Compatible: a stamped local Worker; Settings › Server shows `✓ App 0.2.0 · Server 2026.11.25 · Compatible`; the tooltip shows the full stamp; light and dark screenshots
- [ ] Compatible in the sign-in disclosure (signed out, disclosure open) and on Connect an Agent; light and dark
- [ ] Update needed: a local Worker built with `MINIMUM_APP_VERSION` `0.3.0`; signing in shows `Update todz to sign in.` and the line `App 0.2.0 · Server … · Update todz to keep syncing` with `Download` under the closed disclosure; `Download` opens `https://todz.app`; light and dark
- [ ] Update needed, signed in: the banner `Update todz to keep syncing` / `Your changes wait here until then.` / `Download`; a task added stays local and lands after switching back to a compatible Worker; light and dark
- [ ] Server behind: an unstamped `wrangler dev`; the line reads `App 0.2.0 · Server older · Server needs an update`; a stub `/health` with `version: "2026.11.20+aaaaaaa"` reads `Server 2026.11.20`; light and dark
- [ ] Unreachable: a stopped Worker; the line reads `App 0.2.0` alone, no symbol
- [ ] VoiceOver reads each state's sentence from design.md §1, and `Download todz` on the link
- [ ] The narrowest Settings width: the line wraps to two lines at most, nothing truncates the state words
- [ ] The production deploy: the ready line printed by `server:deploy`; `curl -sS https://api.todz.app/health` shows `version` equal to the stamp of `main`'s head; `curl -sSI https://api.todz.app/health` shows `todz-api-version`; `curl -sS https://api.todz.app/owner/sign-in-method` shows the `426` body
- [ ] Screenshots at `.pr-media/version-compat/`

## Edge cases found during execution

Empty on purpose. The tester adds one checkbox per new case (input, exact expected outcome) and a regression test for each.

## Adversarial review

The reviewer picks the three claims most likely to be wrong and tries to refute each.

- [ ] Claim 1: no owner route answers before the gate, so no too-old request reaches a handler or the limiter — attack: list every early return in `serveOwner` and `servePublic` and send a too-old request to each route kind; result: <refuted | held>
- [ ] Claim 2: `app_too_old` never drops a queued change — attack: queue several changes of each kind, answer the first with `426 app_too_old`, inspect the outbox file after a relaunch; result: <refuted | held>
- [ ] Claim 3: every production answer carries the stamp of the deployed commit — attack: compare `/health`'s `version` with `git log -1` of the deployed ref, and check a site page, an MCP answer and a `404`; result: <refuted | held>

## Coverage honesty

- The Download link opens `https://todz.app`, which has no download yet; the owner gets the update from todz-6f's rebuild. Accepted until a release page exists (ADR 0069 Revisit).
- The owner's current Release app (`0.1.0`) cannot read `app_too_old`: between the deploy and todz-6f's rebuild it shows the generic server error. Accepted for one evening.
- A real `wrangler deploy --define` is proven only by the production deploy in G3; the tests cover the argument builder.
- Static assets served before the Worker carry no `Todz-Api-Version`; not tested because the Worker never sees them.
