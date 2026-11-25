# Server URL

**Status:** Approved
**Tier:** 🔴 (the server the app talks to, a wipe of local data, a public route)
**Owner approval:** approved 2026-11-25 by the owner's request to the loop, PROMPT.md "Self-host, docs and credits" item 1 ("self host não precisa que a pessoa faça deploy do app macOS.. simplesmente deixe a pessoa mudar o server URL, e obviamente dê o server URL de forma simples no log.. mas por padrão o server URL é o prod cloud"). The shape is the loop's call in [ADR 0056](../../adr/0056-the-app-keeps-its-server-url-as-a-setting-and-switching-it-starts-clean.md).
**ADRs:** [0056](../../adr/0056-the-app-keeps-its-server-url-as-a-setting-and-switching-it-starts-clean.md), [0044](../../adr/0044-the-wrangler-configuration-is-production-on-api-todz-app-and-development-overrides-it.md), [0046](../../adr/0046-the-app-solves-the-challenge-in-a-web-view-and-the-link-page-solves-it-for-the-sign-in.md), [0048](../../adr/0048-the-self-host-guide-is-one-markdown-file-that-the-landing-serves.md)
**Not changing:** the server's data model, sign-in, the MCP tools, the widgets' reading of the snapshot, the landing

## Problem

A self-hoster has to edit `apps/macos/project.yml` and rebuild the app to point it at their own server, and nothing tells them which URL to use when their deploy ends.

## Goals

- Settings has a Server row with the URL in use, and the sign-in screen a quiet "Server" disclosure showing the host; both change it, and "Use todz cloud" restores the default.
- The default is the build's `TODZ_API_BASE_URL`: `https://api.todz.app` in Release, `http://localhost:8787` in Debug.
- A new URL is checked (https, or http only for loopback), probed at `/health`, then the app signs out, erases its local data and reconnects. Persisted across launches.
- Connect an Agent shows the MCP URL of the server in use.
- `GET /health` on every host answers `{"service":"todz","origin":PUBLIC_ORIGIN}` with `cache-control: no-store`.
- A deploy script ends its log with `todz server ready: <PUBLIC_ORIGIN>  →  paste it in todz › Settings › Server`, and `docs/self-host.md` uses it and drops the rebuild.

## Non-goals

- Several servers' data side by side, per-workspace servers, discovering servers, a URL from the sign-in link.

## Design

### Data flow

```
Settings / sign-in disclosure: text → ServerAddress.check → issue? show it, stop
   → probe GET <url>/health → not {"service":"todz","origin":url}? show "No todz server answered at that address.", stop
   → confirm (signed in, or changes waiting: "Switching signs you out and clears N unsynced changes")
   → model.switchServer(to:): capture the old session
        → erase session, cache + outbox, pending link, sign-in method (each throws → stop, the old server stays, show the error)
        → widget snapshot, in-memory state, phase = signed out, rebuild the owner API and the change socket, serverURL, store the URL (no await from the erase to the store)
        → sign out at the old server with the captured session, detached, best effort
Connect an Agent, the sign-in check: read model.serverURL
deploy: pnpm --filter @todz/api <script> → wrangler deploy → "todz server ready: <PUBLIC_ORIGIN>  →  …"
```

### Interfaces

- `TodzKit`: `ServerAddress` (parse and check, an issue enum), `ServerPreference` (the defaults key, the stored URL or none), `AppModel.serverURL` and `switchServer(to:)`, a server-connection factory injected into the model so the owner API and the socket are rebuilt for a URL, a health probe on the owner service.
- App: the Server row in Settings, the disclosure on the sign-in screen, the confirmation, copy in `SettingsCopy`, `SignInCopy` and `ErrorCopy`; `AppConfiguration.baseURL` becomes the default only; `NSAllowsLocalNetworking` on in Release too.
- API: `GET /health` on the API host; a deploy script in `apps/api` (not named `deploy`, a pnpm built-in).
- Docs: `docs/self-host.md` step 4 runs the script and step 7 becomes "paste it in Settings › Server"; `self-host.test.ts` follows.

### Failure handling

| Case | Effect |
|---|---|
| not https, or http to a non-loopback host, or a path, query, fragment or credentials | refused before any request, with the reason; a path reads "The address has no path. Enter the server's root address." |
| the scheme's default port (`:443` on https, `:80` on http) | dropped from the origin; the origin is compared without it |
| the probe times out (10 seconds), errors, redirects, or answers anything else | "No todz server answered at that address.", nothing changes |
| the probe's origin differs from the origin typed | refused with "That server answers as <origin>. Enter that address instead." (design.md O5 B) |
| sign-out at the old server fails or hangs (offline) | the switch has already happened; the sign-out is detached and its failure is ignored |
| erasing the session, the cache, the outbox or the pending link fails | no switch, the error shows, the old server stays |
| the same URL as in use | nothing happens, no probe |
| "Use todz cloud" | switches without a probe: the default comes from the build |
| the stored URL is unreadable at launch | the default is used |
| the app quits mid-switch | the erase runs before the address is stored, so the next launch is on the old server, signed out with the erased data |

### Rollback

Revert the app change: the stored key stays unread and the build's default applies. Revert the API change: `/health` answers 404 again, and an app that probes it refuses a switch.

## Open questions → answers

| Question | Options | Owner's answer | Date |
|----------|---------|----------------|------|
| Keep `TODZ_API_BASE_URL`? | keep as the default; remove | the loop's call: keep as the default (ADR 0056 §1) | 2026-11-25 |
| What does the probe hit? | `/health`; `/owner/sign-in-method` | the loop's call: `/health`, which names its origin (§4) | 2026-11-25 |
| Keep data per server? | wipe; keep per server | the owner's words: no data crosses; wipe (§5) | 2026-11-25 |

## Test strategy summary

Swift tests for `ServerAddress` (https, loopback http, refused schemes and hosts, query, fragment, credentials, trailing slash), `ServerPreference`, `switchServer` on the model (signed in, signed out, an erase failure, the same URL, sign-out failing offline, the new service in use after), the probe's decoding. Worker tests for `/health` on every host (the origin of the API, a 404 for other methods and paths). Repository-shape tests for the self-host guide's new commands. An Orca walk: Settings shows the URL, a bad address is refused, a switch to a second local Worker signs out and the sign-in screen's disclosure shows the new host; Connect an Agent shows the new MCP URL; screenshots of the Server row and the disclosure.
