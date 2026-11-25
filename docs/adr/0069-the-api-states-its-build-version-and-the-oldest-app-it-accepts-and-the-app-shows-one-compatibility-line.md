# 0069. The API states its build version and the oldest app it accepts, and the app shows one compatibility line

- Status: Accepted (the build loop's call, the owner may overturn it)
- Date: 2026-11-25
- Deciders: Claude (the build loop's call, pending the owner); Dhyego Calota (owner) asked for it on 2026-11-25: "make sure de mostrar a versão da API vs a versão do app de forma sucinta/curta/friendly, que ambas são compatíveis", with the API's version and the oldest app version it accepts on `/health` and in a header on every answer, the app's version on every request, one short line in Settings › Server and the sign-in Server disclosure, and a clear refusal instead of a bare 400 for a too-old app
- Inspired by: [ADR 0058](0058-the-app-tells-the-server-its-own-link-scheme-and-the-sign-in-link-carries-it-back.md) (a Release app built before it gets a bare `400 invalid_request` from `POST /owner/sign-in-links`, because its body lacks `app_link_scheme`), [ADR 0056](0056-the-app-keeps-its-server-url-as-a-setting-and-switching-it-starts-clean.md) (the server is a setting, probed through `/health`), [ADR 0028](0028-the-app-s-task-writes-are-optimistic-and-go-through-a-persisted-outbox.md) (a todz error body with a refusal code drops a queued change; a bare status never does)

## Context

The app and the Worker ship on their own schedules. The Worker deploys from `main` in minutes; the owner's Release app is rebuilt by hand, and a self-hosted server may run an older Worker than the app expects. Nothing says which pair is talking. When ADR 0058 made `app_link_scheme` required, the owner's older Release app got a bare `400 invalid_request` on sign-in, and the sign-in screen showed a generic server error with no hint that the app was the part to update.

Today every Mac build is `0.1.0` (build `1`): `MARKETING_VERSION` never moved. The Worker has no version at all: `/health` answers `{ service, origin }`, and the deploy prints only the ready line of `apps/api/scripts/server/ready-line.ts`. The owner API (`/owner/*`) has one client, the Mac app; agents use `/mcp`; a browser uses `/sign-in` and the site.

## Decision

1. **The app's version is its bundle's `CFBundleShortVersionString`, and nothing else.** It comes from `MARKETING_VERSION` in `apps/macos/project.yml`, which moves from `0.1.0` to `0.2.0` in this feature, for the app and the widgets alike. The app reads it once from its main bundle. The build number (`CFBundleVersion`) is not part of compatibility.
2. **The Worker's version is its source commit, stamped at deploy.** The stamp is `YYYY.MM.DD+<short hash>`: the UTC date of the deployed commit and its seven-character hash, for example `2026.11.25+3f9c2ab`. `server:deploy` computes it from git and passes it to `wrangler deploy --define TODZ_SERVER_VERSION:"…"`; `wrangler.jsonc` defines it as `null`, so a local `wrangler dev` or a plain `wrangler deploy` is an unstamped build. One module reads the global; every other function takes the version as a parameter. The same commit always gets the same stamp.
3. **The oldest app the Worker accepts is one constant**, `MINIMUM_APP_VERSION` in `libs/types`, `0.2.0` today. It moves only in the change that makes an older app unable to work.
4. **Every answer the Worker writes carries `Todz-Api-Version: <stamp>`**, next to the security headers in `index.ts`, on every host. An unstamped build sends no header. A WebSocket `101` is left as it is (`withSecurityHeaders` does the same). Static assets served by the asset layer before the Worker are not Worker answers and carry none.
5. **`/health` states both**: `{ service, origin, version, minimum_app_version }`, where `version` is the stamp or `null` for an unstamped build. `/health` is never refused for the app's version, so a too-old app can still read why.
6. **The app sends `Todz-App-Version: <short version>` on every request it builds**, through `OwnerRequest.transportRequest`, which builds the health probe, every owner call and the change socket's upgrade.
7. **Only the owner API checks the app's version.** After an `/owner/*` route matches and before any handler runs, including the public sign-in routes and the change socket, a request whose `Todz-App-Version` is missing, malformed or lower than `MINIMUM_APP_VERSION` gets `426 Upgrade Required` with `{"error":"app_too_old","minimum_app_version":"0.2.0"}` and `Upgrade: todz-app/0.2.0`. An unmatched path still gets `404`. `/mcp`, `/health`, `/sign-in` and the site never check it: agents and browsers are not the app. A missing header counts as too old because every build that lacks it predates the check and is exactly the build that breaks.
8. **Versions compare as numbers, part by part.** An app version is one to three dot-separated integers; a missing part is zero (`0.2` equals `0.2.0`). A server stamp compares by its date part only; two deploys on the same day compare equal.
9. **The app expects a server at least as new as `minimumServerVersion`**, a TodzKit constant, `2026.11.25` today: the first Worker that states a version. A server that states no version is older than that.
10. **The app shows one line, from one pure rule.** `VersionCompatibility.of(app:server:minimumApp:)` returns one of `compatible`, `updateNeeded`, `serverBehind` or `serverUnknown` (not yet answered or unreachable). Settings › Server, the sign-in Server disclosure and the Connect an Agent screen show it; `updateNeeded` also shows a main-window banner with a Download link while signed in. The words are in `design.md`, and no version jargon beyond the two numbers.
11. **A refusal flips the state at once.** A `426 app_too_old` body becomes `OwnerAPIError.appTooOld(minimum:)`; the model records `updateNeeded` with that minimum without waiting for the next health probe. A `426` without that body stays `unexpected(status: 426)`. `app_too_old` is not one of ADR 0028's refusal codes: the outbox keeps every queued change, stops flushing while the state is `updateNeeded`, and sends them from the updated app, because the server never judged the change itself.
12. **The deploy says both versions.** The ready line becomes `todz server ready: <origin> · server <stamp> · accepts app <minimum> or later  →  paste it in todz › Settings › Server`.

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| The server version as a `--var` in the Worker's env | testable per request through `env`, like `PUBLIC_ORIGIN` | the self-host guide says never to pass `--var`; a dashboard edit could change it; it is configuration, not a build fact | a version describes the code, so it belongs to the build |
| A semantic version for the Worker in `package.json` | familiar | someone must bump it by hand on every deploy; it drifts from the code the moment they forget | the commit already names the code |
| The deploy date instead of the commit date | "when it went live" | the same code deployed twice gets two versions; a rollback looks newer | the stamp must name the code, so a rollback reads older |
| Refuse a too-old app with `400` and the new code | no new status | `400` is what the old app gets today for any malformed body; a log line or a proxy cannot tell them apart | `426` says the client must change, and the app reads the body either way |
| `426` with no `Upgrade` header | shorter | RFC 9110 requires `Upgrade` on a `426` | the token `todz-app/<minimum>` is valid and says what to upgrade to |
| Allow a request without `Todz-App-Version` | old builds keep working where they still can | every such build predates the check, and the one they break on (sign-in) gives the owner no clue | the refusal is the clue the owner asked for |
| Check the version on `/mcp` too | one rule everywhere | agents are not the app and never send the header; every MCP client would break | the check guards the app's own API |
| Read `Todz-Api-Version` from every answer in the app | no extra probe | one more parser in the transport, and the line would flicker during a deploy | `/health` at launch and on a server switch, plus the refusal, are enough |

## Consequences

- A too-old app says what to do in plain words instead of "Something went wrong with the server".
- The owner reads both versions in one glance in Settings, in the sign-in disclosure and in Connect an Agent, and in the deploy log.
- Every owner-API caller outside the app must send the header: the API's test client (`apps/api/test/owner-client.ts`) and the perf harness (`tools/perf`) send `MINIMUM_APP_VERSION`.
- The owner's current Release app (`0.1.0`, no header) is refused on every owner route from the deploy on, until todz-6f rebuilds it. That is the point; the deploy and the rebuild run the same evening.
- A deploy that bypasses `server:deploy` serves no version, and every app shows "Server needs an update"; the deploy runbook uses `server:deploy` for that reason.
- Raising `MINIMUM_APP_VERSION` is now the one lever for a breaking owner-API change, and its PR says so.

## Evidence

- `apps/api/src/sign-in-links.ts`: `RequestBodySchema` requires `app_link_scheme`; `parsedPublicBody` returns `null` and the route answers `errorResponse(OwnerErrorCode.InvalidRequest)`, a `400`.
- `apps/macos/project.yml`: `MARKETING_VERSION: "0.1.0"` and `CURRENT_PROJECT_VERSION: "1"` for both targets.
- `apps/macos/TodzKit/Sources/TodzKit/OwnerRequest.swift`: `transportRequest(baseURL:)` builds every request, including `health()` and `SocketChangeSignals.socketRequest`.
- `apps/api/src/index.ts`: every answer passes through `withSecurityHeaders` in `fetch`.
- ADR 0028 §2: a todz error body with a refusal code drops the queued change; an unexpected answer keeps it and waits.

## Revisit when

- The app ships through a channel with its own update mechanism (Sparkle, the App Store): the Download link becomes that channel's update action.
- A second owner-API client appears (a web app, a CLI): the version check names which clients it guards.
- The Worker needs a breaking change for older servers' apps: `minimumServerVersion` moves, and the server-behind words may need an action.
