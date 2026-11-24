# 0019. MCP keys are prefixed and shown once

- Status: Proposed
- Date: 2026-11-23
- Deciders: Claude (the build loop's call, pending the owner); Dhyego Calota (owner) may overturn it
- Inspired by: [the v1 product design](../product/README.md) (the key is shown once when created and stored as a digest; a repository's `.mcp.json` points at its project's key); [ADR 0014](0014-credentials-are-stored-as-sha-256-digests.md)

## Context

A key will sit in a `.mcp.json` file or in an agent's configuration, where it can be committed or pasted by mistake. Whoever finds one should be able to tell what it is, and a secret scanner should be able to match it.

## Decision

1. A key is `todz_` followed by the unpadded base64url encoding of 32 random bytes: 48 characters.
2. `issueProjectKey` generates it, stores only its digest in `project_keys`, and returns the secret once to its caller. Nothing can read the secret back afterwards.
3. Session ids (ADR 0017) and app sessions carry no prefix: they never leave the client's memory.

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| `todz_` and base64url (chosen) | recognisable in a diff; one regular expression for a scanner; short | the prefix tells an attacker what the key unlocks | the key's 256 bits do the protecting |
| Bare hexadecimal | no hint | 64 characters; looks like any hash, so scanners cannot tell it from one | harder to catch when leaked |
| A UUID | familiar | 122 random bits, below ADR 0014's 256 | not enough entropy |

## Consequences

- A gitleaks rule for `todz_` keys can be added once the repository is public; it is a question for the owner.

## Evidence

The `project-keys` tests: the secret matches `^todz_[A-Za-z0-9_-]{43}$`, two issues differ, and the directory row holds its digest and no column holds the secret.

## Revisit when

- Keys get scopes or expiry.
