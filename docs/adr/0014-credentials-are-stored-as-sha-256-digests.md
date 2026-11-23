# 0014. Credentials are stored as SHA-256 digests

- Status: Proposed
- Date: 2026-11-23
- Deciders: Claude (the build loop's call, pending the owner); Dhyego Calota (owner) may overturn it
- Inspired by: [the v1 product design](../product/README.md) (the key is shown once when created and stored as a digest; the directory holds sessions and MCP key digests)

## Context

The directory resolves an MCP key or an app session to a project or an owner on every request. It must find the row from the secret alone, and a copy of the directory must not hand out working credentials.

## Decision

1. The directory stores the lowercase hexadecimal SHA-256 of a credential's secret, never the secret, and finds the row by that digest.
2. Every secret the API issues, MCP key or session, carries at least 256 bits from the runtime's cryptographic random source. `mcp-server` and `owner-api` issue them; `project-store` only digests and looks up.
3. A secret is compared only through its digest's primary-key lookup; it is never logged, and neither is its digest.

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| Plain SHA-256 of a 256-bit secret (chosen) | one indexed lookup; Web Crypto in the Worker; no secret to manage | a leaked directory plus a guessable secret would fall | issued secrets are not guessable: 256 random bits defeat brute force without a slow hash |
| HMAC-SHA-256 with a server-side pepper | a leaked directory alone is useless | a Worker secret to provision, rotate and keep out of tests; a deploy step v1 does not have | the secret's entropy already gives that property |
| A slow salted hash (bcrypt, scrypt, Argon2) | right for passwords people choose | a per-row salt forbids lookup by digest; CPU cost on every request | there are no human-chosen secrets |

## Consequences

- A test can seed a credential by inserting the digest of a known secret.
- Rotating the scheme later means a new digest column and a dual lookup during the move.

## Evidence

The `project-store` routing tests resolve keys and sessions through digests the tests computed with the same function.

## Revisit when

- A credential is chosen by a person.
- A security review asks for a pepper.
