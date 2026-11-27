# 0101. An owner key is a separate, off-by-default scope for the account, and project keys never gain account powers

- Status: Superseded by [0111](0111-api-keys-are-removed-and-an-mcp-client-connects-only-through-oauth.md); was: Accepted
- Date: 2026-11-26
- Deciders: Dhyego Calota (owner); Claude (advisor). The loop's call under the owner's standing instruction to decide every call, and the owner's request of 2026-11-26: every action the app takes, an agent takes over MCP.
- Inspired by: [ADR 0019](0019-mcp-keys-are-prefixed-and-shown-once.md), [ADR 0014](0014-credentials-are-stored-as-sha-256-digests.md), [ADR 0093](0093-deleting-a-workspace-or-project-is-a-hard-delete-behind-a-typed-name-confirmation.md), [ADR 0073](0073-signed-in-writes-have-quotas-and-signed-in-routes-a-rate-limit-per-owner-and-per-key.md)

## Context

A project key reaches one project. The app does more than a project key can: it creates, renames and deletes workspaces and projects, and it changes the account settings. The owner wants an agent able to do everything the app does, without opening the UI. Those account actions are powerful (a delete is permanent), and the key that carries them must not be one that already sits in a `.mcp.json` of a repository.

## Decision

1. **A second credential, the owner key.** It is `todz-owner_` followed by the unpadded base64url encoding of 32 random bytes, kept in its own table `owner_keys` (migration 0015) as a SHA-256 digest with a four-character hint, shown once, at most five live per owner. The prefix cannot be the start of a project key (`todz_`), so the scope is readable in a diff and a scanner needs one more pattern.
2. **Off by default.** No owner key exists until the owner creates one with `POST /owner/keys` with a signed-in session. `GET /owner/keys` lists the live keys apart from the project keys, `DELETE /owner/keys/:keyId` revokes one. An owner key is never accepted on `/owner/*`, so it cannot create or revoke an owner key, nor a project key.
3. **One endpoint, two tool sets.** `/mcp` reads the prefix of the bearer secret: `todz-owner_` is looked up in `owner_keys` only, anything else in `project_keys` only. An owner key sees nine account tools (`workspaces`, `create_workspace`, `rename_workspace`, `delete_workspace`, `create_project`, `rename_project`, `delete_project`, `settings`, `update_settings`) and no task tool. A project key sees eleven task tools and no account tool. The server for each is built from separate code, so a project key has no path to an account tool even by naming it.
4. **The account is reached through one owner.** An owner key resolves to the single owner of its row and then goes through the same `SessionOwner` brand and the same owner-scoped queries as a signed-in session. The account actions are one module shared by the owner routes and the owner tools, so the two cannot drift.
5. **A delete names its target.** `delete_workspace`, `delete_project` and the project key's `delete` take `confirm`, which must equal the current name (the title, for a task) after trimming. A mismatch deletes nothing and says so. The target is looked up through the owner (or the key's project) first, so a target of another tenant answers the same "not found" an absent id answers, whatever `confirm` holds.
6. **The project key gains task powers only.** `reopen`, `delete`, `move`, `projects`, `show` and `history` act inside the key's workspace: `move` accepts only another project of the workspace the key's project belongs to, found through the workspace id of the key row, never a client-supplied workspace.
7. **Fair use applies.** Both servers sit behind the per-key MCP rate limiter keyed on the digest. Creating a workspace or a project goes through the same conditional insert that caps the owner's workspaces and a workspace's projects. The reservation of daily writes of the fair-use lane is called at the one seam each write tool has (see the spec).

## Threat model

| Threat | Control | Residual |
|--------|---------|----------|
| A leaked project key escalates to account actions | Separate table, separate prefix, separate tool set; the project server registers no account tool | none |
| A leaked owner key wipes the account | Off by default, listed and revocable in Settings, at most five, prefix a scanner can match, every delete names its target, the stored digest is useless alone | The holder can delete every workspace until the key is revoked: the same accepted risk as a stolen session in ADR 0093 |
| An owner key reaches another owner | The key row names one owner; every statement joins that owner; a foreign id answers like an absent one | none found |
| An agent reads names of another tenant through error text | One "not found" sentence for absent and foreign ids; the name compared is the owner's own | none |
| Prompt injection in a task makes an agent delete things | An owner key cannot read tasks; a project key can delete only a task, and only with its exact title | An injected "delete T-3 with title X" works if the agent obeys it; the destructive hint lets a client ask the person first |
| A project key plants text in a sibling project: `add` in A, `move` to B, and B's agent reads it from `next` (cross-project prompt injection) | `move` reaches only the workspace of the key; the arrival's history says "Moved from <project>" and `show` and `history` print it; a delete and a move name their target | A leaked or injected project key's reach is the whole workspace, not one project: writing into a sibling was impossible before `move`. Accepted for one owner's workspace; a per-key opt-out of `move` is the revisit |
| A move leaves a task in both projects or in neither | Add to the destination under a key naming the source task, then delete the source; a retry converges | A failure between the steps leaves a visible duplicate, never a loss |
| Owner key brute force | 256 random bits; unknown secrets answer 401 with an empty body; the per-key limiter runs after the lookup, and the sign-in style IP limiter is not needed for a 256-bit secret | none |

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| Scopes on project keys | One credential type | Every existing key in every `.mcp.json` would be one flag away from deleting the account; the blast radius of a leak grows for people who never asked | Project keys must never gain account powers |
| An "allow account tools" switch per project key | No new table | Same blast radius once on; the key still lives in a repository | Same |
| Reuse the app session as the MCP credential | No new table | Sessions expire, close with sign-out and cannot be revoked apart from the app | An agent needs a credential the owner can revoke alone |
| OAuth for MCP clients | The standard consent screen | A large surface for a single-owner app | Revisit when a client needs it |
| Tools for keys (issue, revoke) in the owner scope | An agent could bootstrap a project end to end | An owner key able to mint credentials widens a leak into a permanent foothold | Credentials stay a human act; listed as not over MCP in the parity table |

## Consequences

- The Mac app needs a Settings section for owner keys (a follow-up lane): create, copy once, list, revoke. The contract is in the spec.
- The docs MCP tools page lists every tool with its scope, and a repository-shape test maps every owner route of the app to a tool or to a stated reason, so a new app action without an MCP answer fails the gate.
- `POST /owner/keys` is not subject to the project key limit; its own cap is `OWNER_LIVE_KEYS_MAX`.

## Evidence

- `apps/api/test/mcp-owner-tools.test.ts`, `apps/api/test/owner-key-routes.test.ts`, `apps/api/test/mcp-project-tools.test.ts` and `tools/repository-shape/src/mcp-parity.test.ts`.

## Revisit when

- A client needs OAuth, a second owner per account exists, or a key needs an expiry or a narrower scope than the whole account.
