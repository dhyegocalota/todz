# Tester briefing: MCP over OAuth

## What changed

The Worker is now an OAuth 2.1 authorization server for its own `/mcp` (ADR 0109): metadata, dynamic registration, authorize with PKCE S256, a magic-link browser sign-in, a consent screen, tokens with rotation and reuse detection, revocation, Connected apps in the owner API and in Settings of the Mac app. Docs lead with OAuth for Claude Code, Claude.ai and Codex.

## How to run it

- Unit: `npx vitest run` in `apps/api` (workers and node projects), and `npx vitest run test/oauth` for the OAuth cases only.
- E2E: `npx playwright test e2e/oauth.spec.ts` in `apps/api`; the whole suite with `npx playwright test`. The config starts a third Worker on port 8795 with the email provider; its log, holding the mailed links, is `oauth-server.log` in the persist folder.
- Shape: `npx vitest run` in `tools/repository-shape`; types: `npx vitest run` in `libs/types`; `pnpm typecheck` at the root.
- Mac: `swift test` in `apps/macos/TodzKit`. Never touch `/Applications`; never open the menu bar popover.
- Secret rules: `bash .github/scripts/secret-rules-probe.sh /opt/homebrew/bin/gitleaks`.

## Red and green

- Red: 7346b719, 128 failures on the stubs, 404s and the plain challenge.
- Green: e26bf2d6, then the review fixes in 6c1100a3 and the e2e in b585ad0d.

## Hypotheses to attack

- Nothing in `/oauth/authorize` redirects before the client and its exact redirect URI are known.
- A grant reaches exactly what the equivalent key reaches.
- A stolen refresh token rotated twice is still caught; a racing retry does not disconnect the app.
- One sign-in serves one consent.
- The consent form cannot be posted from another site, session or request.
