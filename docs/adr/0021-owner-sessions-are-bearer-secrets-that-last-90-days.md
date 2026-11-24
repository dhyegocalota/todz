# 0021. Owner sessions are bearer secrets that last 90 days

- Status: Proposed
- Date: 2026-11-23
- Deciders: Claude (the build loop's call, pending the owner); Dhyego Calota (owner) may overturn it
- Inspired by: [ADR 0014](0014-credentials-are-stored-as-sha-256-digests.md) (digests of 256-bit secrets), [ADR 0017](0017-a-2025-era-client-is-named-by-a-session-in-the-directory.md) (sessions capped per key), the `sessions` table of `project-store`

## Context

After sign-in the app needs a credential for every owner route and for the "changed" WebSocket. The macOS app is a long-lived desktop client: asking for Sign in with Apple again every few days would be noise, but a credential that never ends cannot be bounded if a Mac is lost. Sign-in is unauthenticated, so the session table must not grow without limit.

## Decision

1. Sign-in answers a session secret: 256 random bits, base64url (`generateCredentialSecret`), shown once and stored as its SHA-256 digest in `sessions` (ADR 0014). It travels as `Authorization: Bearer <secret>`, parsed exactly as the MCP endpoint parses a key.
2. A session lasts `OWNER_SESSION_LIFETIME_MS`, 90 days from sign-in, fixed, never extended. The app signs in again when a route answers 401.
3. An owner keeps at most `OWNER_SESSIONS_PER_OWNER_MAX` (20) sessions: storing one deletes, in the same D1 batch, the owner's expired sessions and the oldest beyond the cap, never the one just stored.
4. `DELETE /owner/sessions/current` deletes the row of the session that sent it. An open WebSocket is not closed by it: the socket carries no task data, and every pull it triggers needs a live session.

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| 90 days, fixed, capped at 20 (chosen) | bounded; one sign-in a quarter | a lost Mac stays signed in until sign-out from another device exists | — |
| Sliding expiry, extended on use | never expires for an active app | a stolen secret never expires either; a write on every read | unbounded |
| 30 days, as MCP sessions | shorter exposure | a monthly Apple prompt in a desktop app | friction for no data gain |
| Access plus refresh tokens | short-lived access | two secrets, a refresh route and rotation rules for one client | more machinery than v1 needs |

## Consequences

- Signing out everywhere, and listing sessions, are not in v1; the cap bounds what a lost device can hold.
- The app treats 401 on any owner route as "sign in again".

## Evidence

The `owner-api` tests pin the expiry at sign-in plus 90 days, the 401 after it, the cap of 20 and sign-out.

## Revisit when

- An iPhone app or a web app adds devices the owner cannot see.
- The owner asks for "sign out of every Mac".
