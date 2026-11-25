# 0056. The app keeps its server URL as a setting, and switching it starts clean

- Status: Accepted (the build loop's call, the owner may overturn it)
- Date: 2026-11-25
- Deciders: Claude (the build loop's call, pending the owner); Dhyego Calota (owner) asked on 2026-11-25: "self host não precisa que a pessoa faça deploy do app macOS.. simplesmente deixe a pessoa mudar o server URL, e obviamente dê o server URL de forma simples no log.. mas por padrão o server URL é o prod cloud"
- Inspired by: [ADR 0044](0044-the-wrangler-configuration-is-production-on-api-todz-app-and-development-overrides-it.md) §5 and §9 (the build setting and the two apps), [ADR 0025](0025-the-session-secret-lives-in-a-private-file-until-the-app-has-a-team.md), [ADR 0027](0027-the-app-caches-each-owner-s-data-as-json-files-in-its-own-container-until-it-has-a-team.md), [ADR 0046](0046-the-app-solves-the-challenge-in-a-web-view-and-the-link-page-solves-it-for-the-sign-in.md), [ADR 0048](0048-the-self-host-guide-is-one-markdown-file-that-the-landing-serves.md)

## Context

A self-hoster must edit `apps/macos/project.yml` and rebuild the app to point it at their server, because the base URL is a build setting read once at launch (ADR 0044 §5). Every consumer reads it directly: the owner API, the change socket, the sign-in check's web view and the server URL that Connect an Agent shows. The cache, the outbox, the widget snapshot and the session all belong to one server; carrying any of them to another would mix two servers' tasks.

## Decision

1. **A setting with the build's default.** The app keeps a server URL in its defaults. When none is stored, it uses the build setting `TODZ_API_BASE_URL`, which stays: Release defaults to `https://api.todz.app`, Debug to `http://localhost:8787`. The build setting is now only the default, so a self-hoster never edits it.
2. **One place reads it.** The app model owns the server in use. The owner API, the change socket, the sign-in check and Connect an Agent read it from the model, never from the bundle.
3. **A checked address.** `https://` with a host, or `http://` only for `localhost`, `127.0.0.1` or `[::1]`; no path (a trailing slash is the only ending), query, fragment or credentials. The scheme's default port (443 for https, 80 for http) is dropped from the origin, so the origin is what the probe compares. Surrounding spaces are trimmed and the host is lower-cased. Anything else is refused with a reason before any request. Both apps allow loopback HTTP (`NSAllowsLocalNetworking`), so a self-hoster can run `wrangler dev` against a Release app.
4. **A probe before the switch.** `GET <url>/health` must answer `{"service":"todz","origin":"<the origin typed>"}` within the probe timeout (10 seconds, a named constant). The probe does not follow redirects: a redirect answers `notTodz`. A server that does not answer it is refused, and nothing changes. The Worker answers `/health` on every host, before the host is classified, so a probe is never refused by the host it reaches.
5. **Switching starts clean, in one order.** Before anything is erased, the app captures the session of the old server. It then erases, in this order: the stored session, the cache with its outbox, the pending sign-in link, the sign-in method. Each of these must throw and stop the switch before the owner service is rebuilt; the widget snapshot and the in-memory state follow. After that the phase becomes signed out, the owner service and the change socket are rebuilt for the new address, the address is stored, and no await sits between the erase and the store. The sign-out at the old server is sent last, detached and best effort, with the captured session; it needs no time limit, because nothing waits for it. Unsynced changes are lost, so the confirmation says how many are waiting.
6. **Where the owner changes it.** A Server row in Settings, and a quiet "Server" disclosure on the sign-in screen that shows the host in use. "Use todz cloud" puts the default back through the same switch.
7. **The server names itself.** `GET /health` on every host answers `{"service":"todz","origin":PUBLIC_ORIGIN}`, no-store; the site's host answers the API origin too, so the origin names the server, not the host that was asked. A deploy script runs `wrangler deploy` and ends with one plain line: `todz server ready: <PUBLIC_ORIGIN>  →  paste it in todz › Settings › Server`.

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| A stored setting, the build as default (chosen) | no rebuild; development keeps its localhost default | the model must swap its service at run time | — |
| Drop the build setting, hard-code the cloud | one source | Debug would point at production | the separate Debug app exists to keep production apart (ADR 0044 §9) |
| Keep the data per server | switching back is instant | caches and outboxes per server, the widgets would need to know which | more state for a rare move; the owner asked that no data crosses |
| Probe `/owner/sign-in-method` | already exists | does not say which origin the server believes it is | `/health` also catches a proxy or a typo that lands on another server |
| A restart after switching | no live swap | a quit the owner has to do | a menu bar app should not ask for a relaunch |

## Consequences

- Connect an Agent's commands follow the server, so a self-hoster's agent gets their own MCP URL.
- `docs/self-host.md` stops telling anyone to rebuild the app.
- The production API gains one public, unauthenticated route that reveals only what DNS already does.

## Evidence

Run 17's research: the base URL is read in `AppConfiguration.baseURL` and consumed by `OwnerAPI`, `SocketChangeSignals`, `KeyScreen` and `ChallengeView`; `signOut()` already erases the session, the cache, the outbox and the widgets, and returns early when signed out; `ChallengeNavigation` already accepts any base URL; Release blocks loopback HTTP because `NSAllowsLocalNetworking` is on in Debug only.

## Revisit when

The owner wants to keep several servers' data side by side, or the app gains a second account.
