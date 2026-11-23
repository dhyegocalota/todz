# 0017. A 2025-era client is named by a session in the directory

- Status: Proposed
- Date: 2026-11-23
- Deciders: Claude (the build loop's call, pending the owner); Dhyego Calota (owner) may overturn it
- Inspired by: [the v1 product design](../product/README.md) (each history line names its actor: the MCP client name sent at connection); [ADR 0016](0016-the-mcp-server-runs-on-the-sdk-v2-and-serves-both-protocol-eras.md)

## Context

A history line says "via Claude Code". A 2026-07-28 client sends its name on every request. A 2025-era client sends it once, in `initialize`, and every later request carries only an `Mcp-Session-Id` header. A Worker forgets everything between requests, so the name has to be stored somewhere the next request can find it.

## Decision

1. On a 2025-era `initialize`, the Worker validates the client's name with the core's `agentActor`, issues a session id of 256 random bits, and stores its SHA-256 digest ([ADR 0014](0014-credentials-are-stored-as-sha-256-digests.md)) in a directory table `mcp_sessions` with the digest of the key it came with, the client's name, and an expiry 30 days after creation. The id goes back in the `Mcp-Session-Id` header.
2. Every other 2025-era request must carry that header. Its session must exist, be unexpired, and belong to the key the request carries; otherwise the answer is 404 and the client opens a new session, as the protocol prescribes. A request without the header is a 400.
3. A modern request names its client from its envelope and touches no session.
4. A revoked key ends its sessions, because the key is checked before the session.

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| Session rows in the directory, bound to the key (chosen) | one more directory lookup next to the key's; the name survives any Worker instance | a table that grows by one row per client start | rows are tiny; expiry bounds what a stolen id is worth |
| Session rows in the project's Durable Object | the session sits with the project | every tool call needs an extra RPC and every RPC a session argument | the key lookup already runs in the directory |
| A client name chosen per key in the app | no sessions | not the name the client sends, contrary to the product design | the design names the client, not the key |
| Refuse the 2025 era | no sessions at all | Claude Code, Codex or Cursor may still speak it, and then todz does not work there | the product must work in all three |
| A session id signed with a Worker secret (HMAC) | no table | a secret to provision and rotate, which v1 has no deploy step for | same reason ADR 0014 rejected a pepper |

## Consequences

- The directory gains `mcp_sessions`, which holds no task data.
- Expired rows stay until a cleanup job exists; v1 has none.

## Evidence

The `mcp-server` endpoint tests: a session from another key, an expired session and an unknown id each answer 404; a missing header answers 400.

## Revisit when

- The 2025 era is dropped (ADR 0016).
- The table's size matters.
