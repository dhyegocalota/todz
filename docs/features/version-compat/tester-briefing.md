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
