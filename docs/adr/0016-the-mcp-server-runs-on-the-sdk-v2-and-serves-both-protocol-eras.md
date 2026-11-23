# 0016. The MCP server runs on the TypeScript SDK v2 and serves both protocol eras

- Status: Proposed
- Date: 2026-11-23
- Deciders: Claude (the build loop's call, pending the owner); Dhyego Calota (owner) may overturn it
- Inspired by: [the v1 product design](../product/README.md) (Streamable HTTP on the Worker, any MCP client with a single key and no installation); the `mcp-server` spike of 2026-11-23

## Context

The Worker must speak MCP over Streamable HTTP to Claude Code, Codex and Cursor. Two protocol revisions are live: the 2025 era, where a client opens with `initialize` and the server keeps a session, and the 2026-07-28 era, where every request carries its own `_meta` envelope with the client's name and capabilities and no session exists. The SDK's own client still defaults to the 2025 handshake, so the clients the owner uses may speak either. A Worker keeps no memory between requests.

## Decision

1. The server uses `@modelcontextprotocol/server` 2.4.0, pinned exactly, with `zod` 4.6.7 for tool schemas. Tests use `@modelcontextprotocol/client` 2.4.0 as the real client.
2. Every request builds a fresh `McpServer` for that request's project and actor, served by `createMcpHandler`.
3. A request the SDK classifies as modern goes to a handler with `legacy: 'reject'`. A 2025-era request goes to the SDK's stateless legacy handler, behind the session layer of [ADR 0017](0017-a-2025-era-client-is-named-by-a-session-in-the-directory.md).

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| SDK v2, both eras, a server per request (chosen) | the protocol, schemas and version negotiation come from the reference implementation; runs in workerd (spike) | a production dependency and its updates | — |
| SDK v1 (`@modelcontextprotocol/sdk` 1.32) | widely used | no 2026-07-28 era; its stateful transport keeps sessions in memory, which a Worker does not have | the stateless era is where clients are going |
| Cloudflare's `agents` package (`McpAgent`, a Durable Object per session) | sessions survive between requests | a second Durable Object class whose storage is not the project's; more moving parts than one name needs | the only state a session needs is a client name |
| JSON-RPC by hand | no dependency | the handshake, both eras, schema validation and error codes rewritten and kept current by us | a protocol is not product code |

## Consequences

- The SDK is the Worker's first runtime dependency outside the workspace; `pnpm security:audit` covers it.
- A server per request costs a few registrations per call; nothing is cached between requests.

## Evidence

The spike (scratch worktree, not committed) served `tools/list`, `tools/call` and `prompts/get` inside workerd to the v2 client in both modes: `versionNegotiation` `legacy` (the `initialize` handshake) and `{ pin: '2026-07-28' }`, whose tool handler read the client's name from `ctx.mcpReq.envelope['io.modelcontextprotocol/clientInfo']`. `tsc --noEmit` and `pnpm audit --prod --audit-level=high` were clean.

## Revisit when

- The 2025 era is no longer spoken by the clients the owner uses: drop the legacy leg and ADR 0017's sessions.
- The SDK's major version changes.
