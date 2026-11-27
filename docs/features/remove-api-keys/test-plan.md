# Remove API keys: test plan

## Unit

- [ ] `/mcp` with a bearer starting `todz_` and one starting `todz-owner_` answers 401 with `error="invalid_token"` and a JSON body whose `error_description` holds `https://docs.todz.app/connect-an-agent`.
- [ ] `/mcp` with an access token that was never issued, revoked or expired answers 401 with an empty body.
- [ ] `GET`, `POST` and `DELETE` on `/owner/keys` and on `/owner/projects/:projectId/keys` answer 404 for a signed-in owner.
- [ ] Migration `0018_drop_api_keys.sql` over a database holding an owner key leaves no `project_keys`, `owner_keys` or `mcp_sessions` table and keeps the OAuth tables.
- [ ] Deleting a project or a workspace revokes the grants of its projects at once.
- [ ] A project grant and an owner grant keep the tools, quotas, limiter keys and history names the keys had.
- [ ] No current source, script, doc or test reads a dropped table or names a key outside the breaking-change notes; `tools/perf` mints a local token, authorizes through a loopback receiver and never reads a Keychain item.

## End to end

- [ ] `oauth.spec.ts`: register, sign in by link, consent, exchange, tools, refresh, revoke.
- [ ] `landing-seo.spec.ts`: the WebMCP setup answers the OAuth Codex block.

## Edge cases

- [ ] A bearer with surrounding whitespace, in another scheme or blank answers 401 and addresses no Durable Object.
- [ ] An initialize over the 2025 era opens no session and sends no `Mcp-Session-Id`.

## Adversarial review

- [ ] Search the repository for the dropped table names and the key prefixes in current code: only the migrations, the breaking-change notes and the gitleaks placeholders name them.
