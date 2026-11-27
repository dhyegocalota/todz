# 0111. API keys are removed and an MCP client connects only through OAuth

- Status: Accepted
- Date: 2026-11-27
- Deciders: Dhyego Calota (owner); Claude (advisor, the loop's call). The owner's order of 2026-11-27, asked whether keys stay next to OAuth: "negativo.. pode remover agora como breaking change. por favor".
- Inspired by: [0109](0109-mcp-clients-connect-with-oauth-2-1-pkce-and-dynamic-registration-and-a-grant-is-never-more-than-the-equivalent-key.md), which made a grant the equivalent of a key and left both in place
- Supersedes: [0017](0017-a-2025-era-client-is-named-by-a-session-in-the-directory.md), [0019](0019-mcp-keys-are-prefixed-and-shown-once.md), [0034](0034-the-key-screen-shows-a-new-key-once-inside-each-client-s-command.md) and [0101](0101-an-owner-key-is-a-separate-off-by-default-scope-for-the-account-and-project-keys-never-gain-account-powers.md); amends the key parts of [0108](0108-a-move-deletes-its-source-only-if-unchanged-and-owner-keys-share-one-budget-and-count-as-writes.md) and [0109](0109-mcp-clients-connect-with-oauth-2-1-pkce-and-dynamic-registration-and-a-grant-is-never-more-than-the-equivalent-key.md)

## Decision

Project keys and owner keys are removed from the Worker, the Mac app, the docs, the landing and the self-host guide, as a breaking change: every MCP client, whichever scope, connects only through OAuth, and an access token is served exactly as 0109 says, project scope or owner scope, with the same limits, quotas and history naming the registered app. A migration deletes every stored key and every 2025-era MCP session bound to one, then drops the three tables. The owner API's key routes (`/owner/projects/:projectId/keys`, `/owner/keys`) are deleted and answer 404 like any unknown path, as `/join` did after 0097, and the fair-use limit of live keys per project is gone. A request to `/mcp` whose bearer is not an OAuth access token, which is what a former key is, answers 401 with the `WWW-Authenticate` challenge of 0109 and a short JSON body that points to `https://docs.todz.app/connect-an-agent`; an expired or unknown access token keeps its empty 401. Perf, tests and walks use access tokens issued through the OAuth flow or seeded as grants, never a key path.

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| Keep keys as a fallback for clients without OAuth | No client is left out | Two credentials to document, limit, audit and leak; a key sits in a config file | Every client we target supports OAuth, and the owner ordered the removal |
| Answer the owner API's key routes with 410 | An old Mac app learns why | A route and a handler kept for a dead path | The Mac app drops its key screens in the same release; 404 is what 0097 chose |
| Leave the key tables and stop reading them | No migration | Stored credential digests nothing uses | A schema that outlives its feature, holding secrets' digests |

## Consequences

- Every existing agent configuration with a key stops working at the deploy and must reconnect: `claude mcp add --transport http todz https://api.todz.app/mcp`, then authenticate. The docs, the changelog and the release notes say so.
- Rolling the Worker back past the migration fails on the missing tables; the tables come back only through the deploy run's Time Travel bookmark.
- `mcp_sessions` is dropped with the keys: an OAuth client is named by its registration in both protocol eras.

## Evidence

`apps/api/test/api-keys-removed.test.ts`, `tools/repository-shape/src/api-keys-removed.test.ts`, `apps/api/test/oauth/oauth-mcp.test.ts`.

## Revisit when

A client the owner needs cannot do OAuth.
