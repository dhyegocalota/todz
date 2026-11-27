# OAuth refresh grant

**Status:** Shipped 2026-11-27
**Tier:** 🔴
**Owner approval:** approved 2026-11-27 by the owner's report to the loop that his Claude connector asked him to sign in again a few hours after he approved it
**ADRs:** [0123](../../adr/0123-a-refresh-token-retried-within-the-leeway-gets-a-fresh-pair-and-the-cap-holds-a-refresh-every-five-minutes.md), amending [0109](../../adr/0109-mcp-clients-connect-with-oauth-2-1-pkce-and-dynamic-registration-and-a-grant-is-never-more-than-the-equivalent-key.md) §8
**Not changing:** the token lifetimes, the token format and digests, the revocation of a grant whose spent refresh token comes back after the leeway

## Problem

The owner's Claude connector (account scope) was approved at 11:54 UTC, refreshed once at 12:52 UTC, and its grant was gone afterwards, so Claude asked him to sign in again. No code was replayed, the owner holds 4 grants of 20, and one refresh is far from the cap, so the grant was deleted by a second presentation of its first refresh token or by a revocation that followed one. A refresh token presented again within 30 seconds answered `invalid_grant` "without disconnecting the app", but an MCP client reads `invalid_grant` on a refresh as a revoked grant, drops its tokens and starts a new authorization; Claude refreshes from parallel requests, so one refresh racing another was enough. Separately, the cap of 1,000 refresh tokens per grant was 1.4 times an hourly client over a refresh token's 30 days, and a client refreshing early and racing itself crosses it within three weeks.

## Goals

- The leeway shrinks from 30 to 5 seconds. A refresh token spent less than 5 seconds ago, presented again by its own client, answers a new working pair on the same grant, once: a second retry inside the leeway answers `invalid_grant` without revoking.
- The leeway counts from the first spend; a retry never moves it.
- Migration 0020 adds `oauth_tokens.retried_at` and the index `oauth_tokens (grant_id, expires_at)` for the expiry sweep of a grant.
- A spent token presented after the leeway still deletes the whole grant; another client's token is still refused, inside the leeway too.
- A grant holds 10,000 unexpired refresh tokens before it is revoked, a refresh every five minutes for 30 days.
- Each project choice on the consent screen names its workspace and its project ("Personal › Inbox"), so two inboxes never read alike; it shows no counts.

## Non-goals

- Answering the same pair again, which needs the token secrets stored.
- Keeping a spent token valid until its successor is used.

## Test strategy summary

`apps/api/test/oauth/oauth-token.test.ts` pins the retry within the leeway, a second retry refused, the sweep index, two refreshes at once, the leeway counted from the first spend, a foreign client inside the leeway, a half-hourly client for 30 days under the cap, and the cap still revoking.
