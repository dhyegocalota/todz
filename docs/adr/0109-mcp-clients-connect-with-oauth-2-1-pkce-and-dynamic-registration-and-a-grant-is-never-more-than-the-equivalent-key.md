# 0109. MCP clients connect with OAuth 2.1, PKCE and dynamic registration, and a grant is never more than the equivalent key

- Status: Accepted
- Date: 2026-11-26
- Deciders: Dhyego Calota (owner); Claude (advisor). The loop's call under the owner's standing instruction to decide every call, and the owner's order of 2026-11-27 ("quero MCP por OAuth").
- Inspired by: the [MCP authorization specification, revision 2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization); RFC 9728, RFC 8414, RFC 7591, RFC 7636, RFC 7009, RFC 8707, RFC 8252, RFC 9207 and the OAuth 2.1 draft; [ADR 0014](0014-credentials-are-stored-as-sha-256-digests.md), [ADR 0017](0017-a-2025-era-client-is-named-by-a-session-in-the-directory.md), [ADR 0040](0040-the-owner-signs-in-with-an-email-link-bound-to-the-mac-that-asked-for-it.md), [ADR 0051](0051-the-admin-signs-in-by-a-mail-link-bound-to-the-browser-that-asked-into-a-cookie-session.md), [ADR 0099](0099-the-todz-cloud-admits-at-most-fifty-active-accounts-and-a-monthly-budget-guard-stops-heavy-writes-before-any-included-quota-runs-out.md), [ADR 0101](0101-an-owner-key-is-a-separate-off-by-default-scope-for-the-account-and-project-keys-never-gain-account-powers.md)

## Context

Connecting an agent today means creating a project key in the app and pasting it into the client's configuration, where it lives in a file. Claude Code, Claude.ai connectors, Codex and Cursor can instead add a URL and sign in through the browser, following the MCP authorization specification. The owner wants that, with a consent screen that names the app and lets the owner pick one project or the whole account, revocation in Settings, and every limit of today still applying. The server is a Worker with D1 and no signing secret; the owner already signs in with a magic link.

## Decision

1. **One origin is both the protected resource and the authorization server.** The resource is `<PUBLIC_ORIGIN>/mcp` and the issuer is `PUBLIC_ORIGIN` (`https://api.todz.app` on the cloud, the server's own origin when self-hosted); every URL is derived from it. Without a valid `PUBLIC_ORIGIN` the OAuth routes answer 404 and `/mcp` keeps its plain `Bearer` challenge.
2. **Discovery.** `/.well-known/oauth-protected-resource` and `/.well-known/oauth-protected-resource/mcp` serve RFC 9728 metadata (`resource`, `authorization_servers`, `scopes_supported` `["project","owner"]`, `bearer_methods_supported` `["header"]`). `/.well-known/oauth-authorization-server` serves RFC 8414 metadata: the four endpoints, `code` only, `authorization_code` and `refresh_token`, `S256` only, `none` client authentication, the two scopes, and `authorization_response_iss_parameter_supported: true`. Every 401 from `/mcp` carries `WWW-Authenticate: Bearer resource_metadata="<origin>/.well-known/oauth-protected-resource/mcp"`, plus `error="invalid_token"` when a credential was sent. The challenge names no `scope`: the consent screen, not the client, picks it.
3. **Dynamic client registration only.** `POST /oauth/register` (RFC 7591) registers public clients: `token_endpoint_auth_method` absent or `none`, grant and response types inside what the server supports, one to five `redirect_uris` that are each `https` on any host or `http` on a loopback host (`127.0.0.1`, `localhost`, `[::1]`), with no fragment and no user information, and a `client_name` the history can carry as an agent's name (the core's `agentActor` rule: at most 64 characters, no control characters). Custom URI schemes are refused, as the MCP specification requires. The client id is 32 random bytes; a registration with no grant and no token issued for 30 days is unknown to every endpoint and deleted by the nightly run. Registration has its own limiter per client address and no Turnstile, since it is a machine call. Client ID Metadata Documents are not offered: the Worker would fetch URLs a stranger names, and every client we target falls back to registration.
4. **Authorize validates the client before anything can redirect.** `GET /oauth/authorize` first finds the client and matches `redirect_uri` byte for byte against a registered one, except that a loopback URI may change its port (RFC 8252 §7.3). Until both pass, every problem renders an error page and nothing redirects, so the endpoint is never an open redirect. After that, `response_type` other than `code`, a missing `code_challenge`, a method other than `S256`, a `resource` other than the MCP resource (RFC 8707) and a malformed `state` redirect back with the RFC 6749 error and the state.
5. **Sign-in is the owner's magic link, in the same browser.** With no OAuth browser session, the page asks for the email address behind Turnstile (`request_link`), and the request goes through the app sign-in's limiters and mail budget; a full cloud mails the queue message instead of a link, as today. The answer sets a challenge cookie and mails a link to `/oauth/sign-in#token=…&request=…`. That page reads the fragment, posts the token and the browser's time zone, and the server spends the link only with the challenge cookie, then admits the address through the same path as the app sign-in (the cloud cap, the daily sign-up limit per client and the disposable-address refusal), so a new account is created exactly as today. The session is a 30-minute cookie `__Secure-todz_oauth`: `HttpOnly`, `Secure`, `SameSite=Lax`, host-only, `Path=/oauth`, stored as a digest in `oauth_sessions`. It is not an owner API session and opens nothing outside `/oauth`. The page then returns to `/oauth/authorize` with the same query, built from a fixed path, so the fragment cannot steer it elsewhere. OAuth sign-in needs the email sign-in provider; with the fake one it is unavailable.
6. **Consent names the app and grants one thing.** The screen shows the registered name (escaped), the redirect host, a radio choice of one project of one of the owner's workspaces (the first project is preselected) and, when the client asked for it or asked for nothing, "Your whole account (owner scope)", never preselected, with a warning line. Approve and Deny post back to `/oauth/authorize` with every request parameter, a form token that is the HMAC of the request under the session secret, and must pass the same-origin check of ADR 0051 against `PUBLIC_ORIGIN`. The page forbids framing and allows forms only to itself and the redirect URI's origin. Deny redirects with `error=access_denied`. Granted scope never exceeds the requested one; unknown requested scope words are ignored, as RFC 6749 §3.3 allows.
7. **Codes.** 256 random bits, stored as a SHA-256 digest, valid 60 seconds, bound to the client, the redirect URI, the challenge, the chosen scope and the owner. Exchanging spends the row first, so a wrong verifier also burns it. Presenting a spent code deletes the grant it produced and every token of it.
8. **Tokens.** Access and refresh tokens are `todz-at_` and `todz-rt_` followed by 32 random bytes in unpadded base64url, stored only as SHA-256 digests in `oauth_tokens`. The dash keeps them apart from a project key, `todz_` plus random characters, which could otherwise begin with `at_`. Access tokens live one hour and refresh tokens 30 days. Every refresh rotates: it spends the presented refresh token, issues a new pair and deletes the grant's other access tokens. Presenting a spent refresh token deletes the whole grant (the family). Only the latest spent refresh token is kept for that check: an older one is simply unknown, and grants nothing. Every token answer carries `Cache-Control: no-store`. A grant's and its client's last use is written when a token is issued, never on an MCP call.
9. **Revocation.** `POST /oauth/revoke` (RFC 7009) takes either token type with the client id and deletes the whole grant when the token belongs to that client; it answers 200 for an unknown token. `GET /owner/connected-apps` lists the owner's grants (id, client name, redirect host, scope, project, created and last used) and `DELETE /owner/connected-apps/:id` deletes one with its tokens; another owner's id answers 404. The Mac app shows them in Settings › Connected apps, next to Account keys.
10. **A grant is the equivalent key, never more.** `project:<id>` resolves to the same `KeyProject` a project key of that project does: its workspace reach, its tools, the per-credential MCP limiter (keyed on the grant), the read throttle, the daily writes and the suspension refusal. `owner` resolves to the same `SessionOwner` an owner key does, with the owner tools only. The token reaches `/mcp` only; `/owner/*` never accepts it. The history names the app by its registered name in both protocol eras, so OAuth needs no MCP session rows. An owner keeps at most 20 grants; a new one evicts the least recently used.
11. **Deletion.** Grants cascade from their owner, project and client, tokens from their grant, so deleting a project or a workspace takes its connected apps with it and never fails on them.
12. **CORS** is only on the metadata documents; the endpoints serve non-browser clients.

## Threat model

| Threat | Control | Residual |
|--------|---------|----------|
| CSRF on consent | `SameSite=Lax` cookie, same-origin check, a form token bound to the session and the request | none found |
| Login CSRF (an attacker's link signs the victim in) | the link spends only with the challenge cookie of the browser that asked | none |
| Open redirect | nothing redirects before the client and the exact redirect URI match; the link page returns to a fixed path | none |
| Code interception | PKCE S256 only, 60-second single-use codes bound to client and redirect URI, replay revokes | none |
| Token leakage | digests at rest, prefixes a scanner matches, header only, `no-store`, short access lifetime, rotation with reuse detection, Settings revocation | a stolen refresh token works until the owner disconnects the app or the real client refreshes once |
| Client impersonation (a stranger registers "Claude Code") | the consent screen shows the redirect host; loopback hosts are labelled as this computer | an owner who approves a lookalike name on a lookalike host grants it, as with any OAuth provider |
| Scope escalation | the grant resolves to the same key objects; granted scope never exceeds requested; owner scope is never preselected | none found |
| Code or markup injection through client metadata | client name and host escaped in every page, length-capped, control characters refused | none |
| Clickjacking | `frame-ancestors 'none'` | none |
| Registration flood | a per-address limiter, a 30-day expiry for unused registrations, nightly deletion | rows written stay inside the D1 quota at the limiter's rate |

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| Self-contained signed tokens (JWT) | no lookup per call | a signing secret to provision and rotate, no instant revocation | ADR 0014's reason, and Settings must revoke at once |
| Client ID Metadata Documents | the 2026 specification prefers them | the Worker fetches stranger URLs (SSRF, slow hosts) | registration is still allowed and every target client supports it; revisit when one drops it |
| Accept custom URI schemes | some desktop clients use them | the specification forbids them, another app can claim the scheme | a client that needs one keeps using a project key |
| Name the client from `initialize` with MCP session rows | the same as keys | sessions are bound to project keys by a foreign key; a client could rename itself per request | the registered name is the one the owner approved |
| Reuse the app's owner session for the browser | no new table | the cookie would be a full `/owner` credential | a 30-minute `/oauth` session holds far less |

## Consequences

- Migration 0017 adds `oauth_clients`, `oauth_sessions`, `oauth_codes`, `oauth_grants` and `oauth_tokens`; none holds task data.
- Two rate limiter bindings: `OAUTH_LIMITER` for every `/oauth` route and `OAUTH_REGISTER_LIMITER` for registration, both per client address, failing closed on a public host like the sign-in limiters.
- Project keys and owner keys work unchanged.

## Evidence

The `oauth-*` unit tests in `apps/api/test/oauth`, the MCP SDK client handshake test, and the Playwright walk `apps/api/e2e/oauth.spec.ts`.

## Revisit when

A client we target requires Client ID Metadata Documents or a custom scheme, the owner wants per-tool scopes, or grants need a lifetime shorter than the refresh token's.
