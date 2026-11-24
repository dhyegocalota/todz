# A failed MCP initialize answers HTTP 200, so a status check does not prove the handshake succeeded
- Date: 2026-11-23
- Inspired by: `mcp-server` tester run (`apps/api/test/mcp-endpoint.test.ts`, red d53ee22, fixed 9a85ae4), [ADR 0017](../adr/0017-a-2025-era-client-is-named-by-a-session-in-the-directory.md)
- Revisited: 2026-11-23 — still true with `@modelcontextprotocol/server` 2.4.0

## Signal
A 2025-era `initialize` with a malformed `params.protocolVersion` or no `capabilities` comes back as `200` with an SSE `error` frame (`-32603`). Code that wraps the SDK's answer and trusts `response.ok` stores a session for a handshake that never happened.

## Cause
The SDK's streamable HTTP transport reports a JSON-RPC failure inside the body. HTTP statuses are reserved for transport-level refusals: a wrong `Content-Type` gets 415, an oversized body 413.

## Do
Gate on the request first: store anything only when the body passes the SDK's `isInitializeRequest`. Then also require `response.ok`, which catches the transport refusals. Never derive success from the status alone, and never parse the SSE body to find out.

## Anchor
- `apps/api/src/mcp-endpoint.ts` (`isAcceptedInitialize`)
- `apps/api/test/mcp-endpoint.test.ts`: the cases that check an `initialize` the SDK answers with an error opens no session; the reviewer's attack on the same branch showed a `text/plain` `initialize` gets 415 with no row
- commits d53ee22 (red), 9a85ae4 (fix)
