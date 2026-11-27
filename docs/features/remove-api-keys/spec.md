# Remove API keys

**Status:** Shipped 2026-11-27
**Tier:** 🔴
**Owner approval:** approved 2026-11-27 by the owner's order in PROMPT.md, asked whether API keys stay next to OAuth: "negativo.. pode remover agora como breaking change. por favor"
**ADRs:** [0111](../../adr/0111-api-keys-are-removed-and-an-mcp-client-connects-only-through-oauth.md), superseding [0017](../../adr/0017-a-2025-era-client-is-named-by-a-session-in-the-directory.md), [0019](../../adr/0019-mcp-keys-are-prefixed-and-shown-once.md), [0034](../../adr/0034-the-key-screen-shows-a-new-key-once-inside-each-client-s-command.md) and [0101](../../adr/0101-an-owner-key-is-a-separate-off-by-default-scope-for-the-account-and-project-keys-never-gain-account-powers.md), and amending the key parts of [0108](../../adr/0108-a-move-deletes-its-source-only-if-unchanged-and-owner-keys-share-one-budget-and-count-as-writes.md) and [0109](../../adr/0109-mcp-clients-connect-with-oauth-2-1-pkce-and-dynamic-registration-and-a-grant-is-never-more-than-the-equivalent-key.md)
**Not changing:** the OAuth flow and its tables, the MCP tools, fair use and the cloud cap, the owner session of the Mac app. The Mac app's key screens are removed by the sibling lane, not here.

## Problem

An MCP client could connect with an OAuth grant or with a project key or an owner key pasted into its configuration. Two credentials meant two sets of docs, limits, telemetry and leak surfaces. The owner wants OAuth only, as a breaking change.

## Goals

- `/mcp` serves only OAuth access tokens. A bearer that is not one, which is what a former key is, answers 401 with the OAuth challenge and a JSON body that points to `https://docs.todz.app/connect-an-agent`.
- The owner API's key routes, `/owner/projects/:projectId/keys` and `/owner/keys`, are deleted and answer 404.
- Migration `0018_drop_api_keys.sql` deletes every key and every 2025-era MCP session and drops `project_keys`, `owner_keys` and `mcp_sessions`.
- The fair-use limit of live keys, its variable and its copy, the key prefixes, the key limiter semantics and the key setups of the site (landing, `llms.txt`, WebMCP, server card) are gone.
- Perf, tests and walks use OAuth access tokens or grant fixtures, never a key.
- The docs, the README, the runbooks and the scenarios lead with OAuth and carry one breaking-change note dated 2026-11-27.

## Non-goals

- Removing the Mac app's key screens (the Mac app lane).
- Allowing custom URI schemes so Cursor can use OAuth (a separate decision; the docs say it cannot connect today).

## Design

### Data flow

`serveMcp` reads the bearer. No bearer: 401 with the challenge. A bearer that starts with `todz-at_`: resolved through `oauth_tokens`, served as its grant's project or account, exactly as before. Any other bearer: 401, `WWW-Authenticate: Bearer error="invalid_token", resource_metadata=…` and `{"error":"invalid_token","error_description":"API keys were removed on 2026-11-27. …"}`. An unknown or expired access token keeps its empty 401 so a client refreshes it.

### Interfaces

Removed: the two key route groups, `directory-keys`, `directory-owner-keys`, `owner-keys`, `owner-key-routes`, `owner-keys-issuance`, `project-keys`, `mcp-sessions`, `FairUseLimit.LiveKeys`, `FAIR_USE_LIVE_KEYS_PER_PROJECT_MAX`, `PROJECT_KEY_PREFIX`, `OWNER_KEY_PREFIX`, the key limits, the Cursor setup of the site. Renamed: `KeyProject` is `GrantProject`. Added: `DOCS_CONNECT_URL`, `MCP_COPY.apiKeysRemoved`.

### Failure handling

The migration deletes before it drops, so a failed drop leaves no usable key. Rolling the Worker back past it fails on the missing tables; the tables come back only through the Time Travel bookmark of the deploy run.

## Open questions → answers

| Question | Options | Owner's answer | Date |
|----------|---------|----------------|------|
| Do the key routes answer 410 or 404? | 410 Gone or 404 | The loop's call: 404, as `/join` did | 2026-11-27 |
| How does the production perf run get a token without a key? | Keychain refresh token, a Keychain access token, an OAuth flow inside the run | The loop's call: the run authorizes in the browser and keeps the token in memory | 2026-11-27 |
| How does the local perf run get one? | Email provider and a mail reader, a grant fixture through local D1 | The loop's call: a fixture, because the fake sign-in provider cannot mail the OAuth link | 2026-11-27 |

## Test strategy summary

Red-first: `/mcp` answers 401 with the docs pointer for both former key prefixes and keeps the empty 401 for unknown access tokens, the key routes answer 404, migration 0018 drops the three tables and keeps the OAuth ones, and no current source, doc or test reads a dropped table or names a key outside the breaking-change notes. The MCP, isolation, fair-use, rate-limit and deletion suites run on seeded OAuth grants.
