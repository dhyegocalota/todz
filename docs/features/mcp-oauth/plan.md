# Plan: MCP over OAuth

The design is [spec.md](spec.md) and ADR 0109. One lead builds the server; one developer builds the Mac section on `feat/mcp-oauth-app`, merged into this branch.

## Steps

- [ ] 1. Migration 0017 and the directory queries of the five OAuth tables (`apps/api/migrations/0017_oauth.sql`, `apps/api/src/oauth/oauth-store.ts`)
- [ ] 2. Metadata documents and the `/mcp` challenge (`oauth-metadata.ts`, `bearer-secret.ts`, `mcp-endpoint.ts`)
- [ ] 3. Dynamic client registration and the redirect URI rules (`oauth-register.ts`, `oauth-redirect-uri.ts`)
- [ ] 4. Authorize validation, browser sign-in by magic link, the consent screen and its form token (`oauth-authorization-request.ts`, `oauth-sign-in.ts`, `oauth-browser-session.ts`, `oauth-authorize.ts`, `oauth-pages.ts`, `oauth-link-page.ts`, `oauth-copy.ts`, the OAuth sign-in mail)
- [ ] 5. Codes, tokens, rotation, reuse detection and revocation (`oauth-pkce.ts`, `oauth-tokens.ts`, `oauth-token-endpoint.ts`, `oauth-revoke.ts`)
- [ ] 6. `/mcp` accepts OAuth access tokens as the equivalent key (`mcp-endpoint.ts`, `project-routing.ts`)
- [ ] 7. Connected apps owner routes (`owner-connected-apps.ts`, `owner-routes.ts`, `owner-endpoint.ts`) and the nightly cleanup (`scheduled.ts`)
- [ ] 8. Wrangler bindings, `run_worker_first`, the shape tests, `.gitleaks.toml`
- [ ] 9. The MCP SDK client handshake test and the Playwright walk
- [ ] 10. Mac app: Settings › Connected apps (developer, `apps/macos/**`)
- [ ] 11. Docs: Connect an agent, MCP tools, self-host, `llms.txt`, the API README

## Failure modes

| Step | What breaks | Signal | Backout |
|------|-------------|--------|---------|
| 1 | a cascade or foreign key blocks a project or workspace delete | the delete tests fail with a constraint error | the migration only adds tables: revert the code, leave the tables |
| 2 | a client stops trying the project key path | the existing `/mcp` key tests fail | revert the challenge header |
| 4 | the consent form posts but Chrome blocks the redirect (CSP `form-action`) | the Playwright walk never sees the loopback code | widen `form-action` to the redirect origin |
| 5 | a client refreshes twice in a race and loses its grant | reconnect needed in the client | documented; the strict rule is the spec |
| 6 | a project-scoped token reaches another project | the scope enforcement tests fail | revert step 6; OAuth tokens then answer 401 |

Steps with no backout: none; every table is new and dropping the code leaves keys working.
