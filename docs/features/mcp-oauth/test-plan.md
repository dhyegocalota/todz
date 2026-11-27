# Test plan: MCP over OAuth

Every checkbox states the input and the exact expected outcome. A ticked box carries evidence after ` — evidence: ` (commit hash, log path, counts, screenshot path).

## The failing test first

- [ ] `apps/api/test/oauth/*.test.ts` committed alone, run against stubs that throw `… is not implemented`; expected: every new case fails on the stub or on a 404
- [ ] Confirmed it fails for the right reason: the recorded red output names the missing behaviour, not a broken test

## Unit (vitest, `apps/api/test/oauth`)

### Metadata and challenge
- [ ] `GET /.well-known/oauth-protected-resource` and `/.well-known/oauth-protected-resource/mcp`; expected: 200 JSON with `resource` `http://localhost:8787/mcp`, `authorization_servers` `["http://localhost:8787"]`, `scopes_supported` `["project","owner"]`, `bearer_methods_supported` `["header"]`
- [ ] `GET /.well-known/oauth-authorization-server`; expected: issuer, the four endpoints, `code`, both grants, `S256`, `none`, both scopes, `authorization_response_iss_parameter_supported: true`
- [ ] `POST /mcp` with no credential; expected: 401 `WWW-Authenticate: Bearer resource_metadata="http://localhost:8787/.well-known/oauth-protected-resource/mcp"`
- [ ] `POST /mcp` with an unknown `todz-at_` token; expected: 401 with `error="invalid_token"` and the same `resource_metadata`
- [ ] A project key still lists its tools; an owner key still lists the owner tools

### Registration
- [ ] A valid public client with a loopback and an https redirect URI; expected: 201 with `client_id`, `client_name`, `redirect_uris`, `token_endpoint_auth_method: "none"`, `grant_types`, `response_types`
- [ ] Each refusal answers 400 `invalid_redirect_uri` or `invalid_client_metadata`: no redirect URIs, six, a non-string, `http://example.com/cb`, `myapp://cb`, a fragment, user information, `client_secret_basic`, a `client_credentials` grant, a `token` response type, no `client_name`, a 65-character name, a name with a control character, a body that is not JSON, a body over the bound
- [ ] The registration limiter refuses; expected: 429 with `Retry-After`; no limiter on a public host: 503

### Authorize
- [ ] Unknown `client_id`, missing `redirect_uri`, an unregistered `redirect_uri` (another path, another host, a query added); expected: 400 HTML error page, no `Location`
- [ ] A loopback URI registered on port 33418 asked on port 51000; expected: accepted
- [ ] An https URI with another port; expected: refused with the error page
- [ ] After the redirect URI is valid: `response_type=token`, no `code_challenge`, `code_challenge_method=plain`, a `resource` of another server; expected: 303 to the redirect URI with `error` (`unsupported_response_type`, `invalid_request`, `invalid_request`, `invalid_target`), the `state` and `iss`
- [ ] No session cookie; expected: the email form page with Turnstile and the request carried
- [ ] A valid session; expected: the consent page with the escaped client name, the redirect host, one radio per project, the first checked, and the owner option unchecked with its warning
- [ ] `scope=project` only; expected: no owner option

### Browser sign-in
- [ ] The email form posted cross-origin; expected: 403 refusal page, no mail
- [ ] A valid email form; expected: the inbox page, a challenge cookie (`__Secure-todz_oauth_challenge`, `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/oauth`) and one OAuth sign-in mail whose link is `/oauth/sign-in#token=…&request=…`
- [ ] A full cloud for a new address; expected: the same inbox page, the queue mail, no link
- [ ] `POST /oauth/sessions` without the challenge cookie, with another browser's cookie, with a spent token; expected: 401, no session cookie
- [ ] `POST /oauth/sessions` with the token and its cookie; expected: 201 and `__Secure-todz_oauth` with `HttpOnly; Secure; SameSite=Lax; Path=/oauth` and `Max-Age=1800`, the challenge cookie cleared
- [ ] A new address under a full cloud at spend time; expected: 403 `cloud_full`, no owner created

### Consent
- [ ] Approve without the form token, with a token of another session, with a token of another request, cross-origin; expected: refused, no code
- [ ] Approve a project of another owner; expected: refused, no code
- [ ] Approve a project; expected: 303 to the redirect URI with `code`, `state` and `iss`
- [ ] Deny; expected: 303 with `error=access_denied` and the `state`

### Token
- [ ] The code with the right verifier; expected: 200 `access_token` `todz-at_…`, `refresh_token` `todz-rt_…`, `token_type` `Bearer`, `expires_in` 3600, `scope` `project:<id>`, `Cache-Control: no-store`; only digests in D1
- [ ] A wrong verifier, another `redirect_uri`, another `client_id`, an expired code (61 s), a `resource` of another server; expected: 400 `invalid_grant` (or `invalid_target`), and the code is spent
- [ ] The same code twice; expected: the second is `invalid_grant` and the tokens of the first stop working
- [ ] Refresh; expected: a new pair, the old access token refused, the old refresh token now spent
- [ ] The spent refresh token again; expected: `invalid_grant` and the whole grant gone (the newest tokens refused)
- [ ] An expired access token (one hour later); expected: `/mcp` 401
- [ ] An unknown client; expected: 401 `invalid_client`; an unsupported grant type: `unsupported_grant_type`

### Revoke
- [ ] Revoke the refresh token; expected: 200 and both tokens refused
- [ ] Revoke an access token of another client, an unknown token; expected: 200 and nothing deleted

### Scope enforcement on `/mcp`
- [ ] A `project:A` token lists the task tools and reads A; `move` to a project of another workspace fails like a key's; it cannot name a project of another owner
- [ ] An `owner` token lists only the owner tools, and only the owner's workspaces
- [ ] A suspended owner's token; expected: the suspension refusal
- [ ] The read throttle and the daily write quota apply to an OAuth token as to a key
- [ ] Deleting the project deletes the grant; its token answers 401

### Connected apps
- [ ] `GET /owner/connected-apps`; expected: the owner's grants with client name, redirect host, scope, project name, created and last used
- [ ] `DELETE /owner/connected-apps/:id` of the owner; expected: 204, its tokens refused; another owner's id: 404 and nothing deleted

## MCP SDK client handshake

- [ ] `apps/api/test/oauth/oauth-sdk-handshake.test.ts`: the official `@modelcontextprotocol/client` with an `OAuthClientProvider` discovers, registers, authorizes (the browser steps driven against the Worker), exchanges with PKCE and calls `tools/list`; expected: the project tools

## E2E (Playwright, `apps/api/e2e/oauth.spec.ts`)

- [ ] Register a client, open authorize, ask for a link, open it from the server log, choose a project, approve, read the code on a loopback page, exchange it, call `tools/list`, refresh, revoke; expected: each step answers as above and the revoked token answers 401
- [ ] Desktop 1280 and narrow 375 screenshots of the email, inbox, consent and error pages

## Mac app (swift test)

- [ ] Decoding both scopes and a null `last_used_at`; the OwnerAPI paths, methods and bearer; the list model loads newest first, disconnect removes the row, a 404 removes it, a failure keeps it

## Edge cases found during execution

Empty on purpose. The tester adds one checkbox per new case (input, exact expected outcome) and a regression test for each.

## Adversarial review

- [ ] Security reviewer attacks CSRF, open redirect, token leakage, code injection, client impersonation and scope escalation; verdict recorded in the PR body
