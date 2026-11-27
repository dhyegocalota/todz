# 0123. A refresh token retried within the leeway gets a fresh pair, and the cap holds a refresh every five minutes

- Status: Accepted (the loop's call)
- Date: 2026-11-27
- Amended by: [0125](0125-a-refresh-token-stays-honoured-until-a-token-issued-from-it-or-a-sibling-is-used-and-every-grant-deletion-logs-its-reason.md) (lineage replaces the leeway and the single retry; the cap stays)
- Deciders: Claude (the build loop's call, under the owner's report on 2026-11-27 that his Claude connector asked him to sign in again a few hours after he approved it, and the security review of PR #137)
- Inspired by: [0109](0109-mcp-clients-connect-with-oauth-2-1-pkce-and-dynamic-registration-and-a-grant-is-never-more-than-the-equivalent-key.md), [the feature](../features/oauth-refresh-grant/spec.md)

The loop's call: a refresh token spent less than 5 seconds ago, presented again by the client its grant belongs to, is honoured once with a new pair on the same grant instead of answering `invalid_grant`. An MCP client reads `invalid_grant` on a refresh as a revoked grant: it drops its tokens and sends the owner back to sign in. Claude refreshes from parallel requests, well under a second apart, so one raced refresh disconnected the app as surely as a theft. The leeway counts from the first spend, and a retry never moves it. The same atomic statement marks the token `retried_at`, so a second retry inside the leeway answers `invalid_grant` without revoking. A spent token presented after the leeway still deletes the whole grant, and another client's token is still refused.

The accepted risk: `client_id` is public, so someone who holds a refresh token and replays it within 5 seconds of the real rotation now gets a sibling chain. Reuse detection never catches that chain; it lives until the owner disconnects the app in Settings or the grant reaches the cap. Before this change, that replay got nothing. The loop accepts the risk because the window is short and one retry is the limit. Tracking each token's parent, so that using one sibling revokes the other, is the real fix for later. Answering the same pair again was the other alternative, and it needs the token secrets stored, which ADR 0109 forbids.

A grant now keeps up to 10,000 unexpired refresh tokens: a refresh every five minutes for the 30 days a refresh token lives. The old cap of 1,000 was only 1.4 times what an hourly client uses, and a client refreshing early and racing itself crossed it within three weeks. A grant at the cap is still revoked rather than forgetting a spent token. At the cap, each refresh reads up to 10,000 index rows to count the grant's refresh tokens. The expiry sweep of the grant reads only its expired rows, through the index `oauth_tokens (grant_id, expires_at)` of migration 0020. Storage is roughly 4 MB per grant with its indexes, so about 80 MB for an owner at 20 grants, all at the cap.

This amends ADR 0109 §8.
