# MCP over OAuth

**Status:** Shipped 2026-11-27
**Tier:** 🔴
**Owner approval:** approved 2026-11-26, by inheritance from [the product design](../../product/README.md) (approved 2026-11-23) and the owner's order to the loop on 2026-11-27 ~00:30 UTC ("quero MCP por OAuth")
**ADRs:** [0109](../../adr/0109-mcp-clients-connect-with-oauth-2-1-pkce-and-dynamic-registration-and-a-grant-is-never-more-than-the-equivalent-key.md)
**Not changing:** project keys, owner keys, the app sign-in, the MCP tools themselves, fair use and the cloud cap rules

## Problem

Connecting an agent means creating a key in the app and pasting it into a configuration file. MCP clients can add a URL and sign in through the browser instead, but todz speaks no OAuth.

## Goals

- Claude Code (`claude mcp add --transport http todz https://api.todz.app/mcp`), Claude.ai connectors, Codex, and Cursor once it uses a loopback or https redirect, add `https://api.todz.app/mcp` with no key, following the MCP authorization specification (revision 2026-07-28); a client with a custom-scheme redirect keeps using a project key.
- Discovery: protected-resource metadata (RFC 9728) and authorization-server metadata (RFC 8414); a 401 from `/mcp` points at the former.
- Dynamic client registration (RFC 7591) for public clients; authorization code with PKCE S256 only; exact redirect URIs (https, or loopback with any port).
- Sign-in is the existing magic link, in the same browser, with Turnstile and the app sign-in's limiters, mail budget, cloud cap and sign-up limits.
- A consent screen in the todz look: the app's name and redirect host, one project (the first one preselected), or the whole account (owner scope), never preselected and with a warning.
- Short-lived hashed access tokens, rotating refresh tokens with reuse detection, revocation (RFC 7009), and Settings › Connected apps in the Mac app (0.2.7).
- A grant behaves exactly like the equivalent project key or owner key, never more.
- Self-hosted servers work the same with their own origin as the issuer.

## Non-goals

- Client ID Metadata Documents, custom URI schemes, per-tool scopes, confidential clients, CORS on the token endpoint, a web dashboard of grants.

## Design

The whole design and its threat model are ADR 0109. In short:

### Data flow

```mermaid
sequenceDiagram
  participant C as MCP client
  participant B as Browser
  participant S as todz server
  C->>S: POST /mcp (no token)
  S-->>C: 401 WWW-Authenticate resource_metadata
  C->>S: GET /.well-known/oauth-protected-resource/mcp, /.well-known/oauth-authorization-server
  C->>S: POST /oauth/register
  C->>B: open /oauth/authorize?client_id&redirect_uri&code_challenge&state&resource
  B->>S: email + Turnstile (POST /oauth/sign-in-links)
  S-->>B: challenge cookie; mail with /oauth/sign-in#token
  B->>S: POST /oauth/sessions (token, time zone, challenge cookie)
  S-->>B: __Host-todz_oauth session cookie
  B->>S: GET /oauth/authorize (consent), POST approve with form token
  S-->>B: 303 redirect_uri?code&state&iss
  B->>C: code on the loopback redirect
  C->>S: POST /oauth/token (code, code_verifier)
  S-->>C: access + refresh tokens
  C->>S: POST /mcp Authorization: Bearer todz-at_…
```

### Interfaces

- `GET /.well-known/oauth-protected-resource/mcp`, `GET /.well-known/oauth-authorization-server`
- `POST /oauth/register`, `GET|POST /oauth/authorize`, `POST /oauth/sign-in-links`, `GET /oauth/sign-in`, `POST /oauth/sessions`, `POST /oauth/token`, `POST /oauth/revoke`
- `GET /owner/connected-apps`, `DELETE /owner/connected-apps/:id`
- D1 migration 0017: `oauth_clients`, `oauth_sessions`, `oauth_codes`, `oauth_grants`, `oauth_tokens`
- Rate limiters `OAUTH_LIMITER`, `OAUTH_REGISTER_LIMITER` and `OAUTH_REGISTER_GLOBAL_LIMITER`

### Failure handling

- Unknown client or unregistered redirect URI: an error page, never a redirect.
- Every other authorize error: a redirect with the RFC 6749 error and the state.
- Token errors: RFC 6749 JSON errors with `no-store`; `invalid_client` for an unknown client, `invalid_grant` for a bad, expired, spent or foreign code or refresh token.
- A spent code, or a refresh token spent more than 30 seconds ago, presented again deletes the grant.
- Missing limiters or client address on a public host: the OAuth routes answer unavailable, like sign-in.

## Open questions → answers

| Question | Options | Owner's answer | Date |
|----------|---------|----------------|------|
| Every remaining call | — | The loop decides (standing instruction); recorded in ADR 0109 | 2026-11-26 |

## Test strategy summary

Unit tests in `apps/api/test/oauth` for each endpoint and refusal, the MCP scope enforcement and the Connected apps tenancy; a handshake with the official MCP SDK client and its OAuth provider; a Playwright walk of the browser flow against the local Worker; Swift tests for the Connected apps decoding and list model.
