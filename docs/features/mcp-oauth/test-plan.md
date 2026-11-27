# Test plan: MCP over OAuth

Every checkbox states the input and the exact expected outcome. A ticked box carries evidence after ` — evidence: ` (commit hash, log path, counts, screenshot path).

## The failing test first

- [ ] `apps/api/test/oauth/*.test.ts` committed alone in 7346b719, run against stubs that throw `… is not implemented`; expected: every new case fails on the stub, on a 404 or on a plain `Bearer` challenge
- [ ] Confirmed it fails for the right reason: the red run printed 128 failures, each `serveOAuth is not implemented`, `serveOAuthMetadata is not implemented`, `expected 404 to be 200` on a well-known path or `expected 'Bearer' to be 'Bearer resource_metadata=…'`
- [ ] The review findings' regression tests landed with their fixes in 6c1100a3 (stated in the commit), not red-first

## Unit (vitest, `apps/api/test/oauth`)

### Metadata and challenge
- [ ] `GET /.well-known/oauth-protected-resource/mcp`; expected: 200 JSON with `resource` `http://localhost:8787/mcp`, `authorization_servers` `["http://localhost:8787"]`, `scopes_supported` `["project","owner"]`, `bearer_methods_supported` `["header"]`, `resource_name` `todz`, `Access-Control-Allow-Origin: *`
- [ ] `GET /.well-known/oauth-protected-resource` (root); expected: 404
- [ ] `GET /.well-known/oauth-authorization-server`; expected: issuer, the four endpoints, `code`, `query`, both grants, `S256`, `none` twice, both scopes, `authorization_response_iss_parameter_supported: true`
- [ ] A server whose `PUBLIC_ORIGIN` is not an origin; expected: the metadata answers 404 and `/mcp` answers a plain `Bearer`
- [ ] `POST /mcp` with no credential; expected: 401 `WWW-Authenticate: Bearer resource_metadata="http://localhost:8787/.well-known/oauth-protected-resource/mcp"`
- [ ] `POST /mcp` with an unknown `todz-at_` token or an unknown project key; expected: 401 with `error="invalid_token"` and the same `resource_metadata`
- [ ] The existing project-key and owner-key MCP suites stay green

### Registration
- [ ] A public client with a loopback and an https redirect URI; expected: 201 with a 43-character `client_id`, `client_name`, `redirect_uris`, `token_endpoint_auth_method: "none"`, both grant types, `code`, no secret, `no-store`
- [ ] `localhost`, `[::1]` and a loopback with no port; expected: 201
- [ ] Each refusal answers 400 `invalid_redirect_uri`: no URIs, six, a non-string, `http://example.com/…`, `myapp://…`, a fragment, user information, a relative URI, `127.0.0.1.example.com`, `https://*/…`, `https://a;sandbox/…`, `https://a$'b/…`, over 512 characters
- [ ] Each refusal answers 400 `invalid_client_metadata`: `client_secret_basic`, `client_credentials`, `token`, no name, a blank name, 65 characters, a control character, U+202E, U+200B, a non-string name, a body that is not JSON
- [ ] A body over 4,096 bytes; expected: 400 before it is read
- [ ] The per-address registration limiter refuses; expected: 429 with `Retry-After: 60`; the global registration limiter refuses; expected: 429
- [ ] A public host without its limiters or without the client address; expected: 503
- [ ] The limiters' keys; expected: `/oauth:<address>`, `/oauth/register:<address>` and `/oauth/register`

### Authorize
- [ ] Unknown client, no client, no redirect URI, another path, another host, an added query, an https URI on another port, `http` for an https URI, a repeated `client_id`; expected: 400 HTML error page "This link can't be used to connect an app", no `Location`, `frame-ancestors 'none'`
- [ ] A loopback URI registered on port 33418 asked on port 51000; expected: accepted (200)
- [ ] After the redirect URI is valid: `response_type=token`, no `response_type`, no challenge, a short challenge, `plain`, no method, another `resource`, only unknown scope words; expected: 303 to the named redirect URI with `unsupported_response_type`, `invalid_request` ×5, `invalid_target`, `invalid_scope`, the `state` and `iss`
- [ ] No session cookie; expected: the email form with the hidden `request`, the Turnstile widget (`request_link`) and the escaped client name
- [ ] A valid session; expected: consent with the client name, `127.0.0.1` "an app on this computer", one radio per project (first checked), the owner radio unchecked with its warning, the workspace-reach line, and `form-action 'self' http://127.0.0.1:33418`
- [ ] `scope=project`; expected: no owner radio; `scope=owner`; expected: only the owner radio, unchecked

### Browser sign-in
- [ ] A valid email form; expected: the inbox page, `__Host-todz_oauth_challenge` (`HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`, no `Domain`) and one mail whose link is `<origin>/oauth/sign-in#token=…&request=<the request>`
- [ ] Cross-site; expected: 403, no cookie, no mail. Unknown client; expected: 400, no mail. Malformed address; expected: 400 with the form, no mail
- [ ] A full cloud for a new address; expected: the same inbox page and no OAuth link mailed
- [ ] The email provider off; expected: 503 "Signing in to connect apps is not available on this server."
- [ ] `POST /oauth/sessions` with the token and its cookie; expected: 201, `__Host-todz_oauth` (`HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=1800`), the challenge cookie cleared
- [ ] Without the challenge cookie, with another browser's, or a spent link; expected: 401, no session cookie
- [ ] A new address; expected: an owner in the browser's time zone. A new address under a full cloud at spend time; expected: 403 `cloud_full`, no owner
- [ ] The session secret as an owner API bearer; expected: 401. Thirty minutes later; expected: the email form again
- [ ] `GET /oauth/sign-in`; expected: a static page with `connect-src 'self'` whose script returns to `/oauth/authorize?` + the request

### Consent
- [ ] Approve a project; expected: 303 with a 43-character `code`, the `state` and `iss`, and the session cookie cleared
- [ ] Deny; expected: 303 with `access_denied` and the `state`; the session row is gone (its cookie replayed gets the email form)
- [ ] A project of another owner; the owner scope when only `project` was asked; expected: 400, no `Location`
- [ ] No form token, another session's token, another state, cross-site; expected: 403
- [ ] No session cookie; expected: the email form. `decision=toString`; expected: 400

### Token
- [ ] The code with the right verifier; expected: 200 `todz-at_…` and `todz-rt_…` (43 characters each), `Bearer`, 3600, `project:<id>`, `no-store`; D1 holds the digest, not the token
- [ ] A wrong verifier, another redirect URI, no verifier, another resource; expected: 400 `invalid_grant`, `invalid_grant`, `invalid_request`, `invalid_target`, and the code is spent
- [ ] Another client's code; a code at 60 seconds; expected: `invalid_grant`
- [ ] The same code twice; expected: the second is `invalid_grant` and the first's tokens answer 401; two at once leave no working token
- [ ] An unknown client; expected: 401 `invalid_client`. `password`; expected: `unsupported_grant_type`. A JSON body; expected: `invalid_request`
- [ ] Refresh; expected: a new pair; the old access token still answers 200 within its hour
- [ ] The spent refresh token 31 seconds later; expected: `invalid_grant` and the whole grant gone
- [ ] A thief refreshes twice, then the real client presents the first token; expected: the grant is gone
- [ ] The spent token again within 30 seconds; expected: `invalid_grant`, and the winner's tokens keep working
- [ ] Another client's refresh token; expected: `invalid_grant` and the token is not spent
- [ ] A refresh token at 30 days, an access token at one hour; expected: refused

### Revoke
- [ ] Either token with its client; expected: 200 and both tokens refused
- [ ] Another client's token or an unknown one; expected: 200 and nothing revoked. No token; expected: 400 `invalid_request`

### Scope enforcement on `/mcp` (both protocol eras)
- [ ] A project token lists exactly the task tools; writes land in its project; the history names the registered app, not the `initialize` name
- [ ] `move` to another workspace's project or another owner's; expected: "not in this workspace" and the task stays; `projects` lists the sibling
- [ ] An owner token lists exactly the account tools and only the owner's workspaces
- [ ] A suspended owner's token; expected: 403. Deleting the project or the workspace; expected: the grant is gone and the token answers 401
- [ ] An access token on `/owner/*`, a refresh token on `/mcp`; expected: 401

### Connected apps and cleanup
- [ ] `GET /owner/connected-apps`; expected: the owner's grants with client name, redirect host, scope, project, created and last used; none of another owner's
- [ ] `DELETE` of the owner's grant; expected: 204 and its tokens refused; another owner's; expected: 404 and nothing deleted
- [ ] A 21st grant; expected: the least recently used is evicted
- [ ] A registration never used; expected: known for a day, unknown after; the nightly run deletes it and keeps a connected client; a disconnected client can authorize again within 30 days of its last token

## MCP SDK client handshake

- [ ] `apps/api/test/oauth/oauth-sdk-handshake.test.ts`: `@modelcontextprotocol/client` 2.4.0 with an `OAuthClientProvider` gets 401, discovers, registers, sends S256 and the resource, completes in the browser steps, `finishAuth` with `iss`, connects and lists the project tools

## E2E (Playwright, `apps/api/e2e/oauth.spec.ts`)

- [ ] The full walk on desktop and mobile: `/mcp` challenge, registration, email form, inbox, mailed link, owner consent, `create_workspace` over MCP, project consent, the code on a real loopback listener (`state`, `iss`), exchange (`no-store`), `tools/list`, refresh, revoke, 401
- [ ] An unknown app at 1280 and 375; expected: 400 error page, never redirected
- [ ] Screenshots at `apps/api/.pr-media/oauth-*-{desktop,mobile}.png`
- [ ] The rest of the API e2e suite stays green with the third Worker

## Mac app (`swift test` in `apps/macos/TodzKit`)

- [ ] Decoding both scopes; a missing `last_used_at` and an unknown scope are refused; the OwnerAPI paths, methods and bearer; the list loads newest first; disconnect removes the row; a 404 removes it; a failure keeps it with the failure line
- [ ] The Todz Debug app builds into its own derived data

## Edge cases found during execution

Empty on purpose. The tester adds one checkbox per new case (input, exact expected outcome) and a regression test for each.

## Adversarial review

- [ ] Security reviewer attacks CSRF, open redirect, token leakage, code injection, client impersonation and scope escalation; verdict recorded in the PR body
