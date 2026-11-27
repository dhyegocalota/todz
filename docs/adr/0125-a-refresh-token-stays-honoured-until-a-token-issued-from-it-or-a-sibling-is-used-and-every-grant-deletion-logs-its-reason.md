# 0125. A refresh token stays honoured until a token issued from it or a sibling is used, and every grant deletion logs its reason

- Status: Accepted (the loop's call)
- Date: 2026-11-27
- Deciders: Claude (the build loop's call, after the owner's claude.ai grant disappeared and the cause could not be read back from production)
- Inspired by: [0109](0109-mcp-clients-connect-with-oauth-2-1-pkce-and-dynamic-registration-and-a-grant-is-never-more-than-the-equivalent-key.md), [0123](0123-a-refresh-token-retried-within-the-leeway-gets-a-fresh-pair-and-the-cap-holds-a-refresh-every-five-minutes.md)

The loop's call: every refresh token records the refresh token it was issued from (`oauth_tokens.parent_digest`). A refresh token, spent or not, is honoured with a new pair while no token issued from it and no sibling of it (another token issued from the same parent) has been spent. Once one has, presenting it deletes the whole grant. This replaces the 5-second leeway and the single retry of ADR 0123. A retry or a stale replica that comes back minutes later no longer disconnects the app, and any number of racing refreshes all succeed; a third racing request refused by the single retry would have sent the client back to sign in. The gap ADR 0123 accepted is closed: a replay of a stolen token before the real client moves on creates a sibling, and the first use of either sibling makes the other a reuse that revokes the family.

What is left: a spent token stays usable until the client uses its successor, which is the same exposure as stealing that successor, and detection waits for the real client's next refresh. Siblings add rows, still bounded by the cap of 10,000 and the per-address limiter. Each refresh now looks up the parent and the siblings through the index `oauth_tokens (parent_digest)`.

Migration 0021 adds the column and its index and drops `retried_at`. It links the tokens issued before it by matching a token's `created_at` to its parent's `spent_at`, which is exact for every rotation because one request spends and issues at the same instant.

Every grant deletion now writes one log line, `{"event":"oauth_grant_deleted","reason":…,"client_name":…}`, with the reason `replayed_code`, `eviction`, `reuse_after_rotation`, `cap`, `client_revoke`, `settings_disconnect` or `cascade`. The line never carries a token, a digest, an address or an owner id. When telemetry is on, the reason is also counted in `metrics_daily`, so the next deletion can be explained. The privacy page lists both the log line and the count.
