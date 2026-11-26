# The 0.2.4 Mac app: deletes, friendly refusals and account keys

**Status:** Shipped 2026-11-26
**Tier:** 🟡 (sync, the owner API client, one Settings section)
**Owner approval:** the loop's call under the owner's 2026-11-24 instruction to decide every call, from the app-lane contract of [mcp-parity](../mcp-parity/spec.md) and the fair-use follow-up of [fair-use](../fair-use/spec.md)
**ADRs:** none new; [0102](../../adr/0102-deleting-a-task-leaves-a-scrubbed-tombstone-for-sync-and-a-move-adds-to-the-destination-before-it-deletes-the-source.md) and [0101](../../adr/0101-an-owner-key-is-a-separate-off-by-default-scope-for-the-account-and-project-keys-never-gain-account-powers.md) decided the contracts this app reads
**Not changing:** the server's routes and tools, the key screen's project keys, the outbox rules for every other refusal

## Problem

The server now deletes and moves tasks for agents, refuses writes past a fair-use limit with a readable message, and issues account keys; the app reads none of it. A task an agent deleted stays on the board, in the widgets and in the cache; a refused change reads "Your change wasn't saved."; an account key can only be made over the API.

## Change

1. The change feed's `deleted_numbers` removes those tasks from the board, which feeds the cache and the widgets snapshot. The server's `MINIMUM_APP_VERSION` is 0.2.4, so an older app is refused with the existing "Update todz to keep syncing" line.
2. `limit_reached`, `account_suspended` and `sign_up_refused` carrying a `message` decode to one refusal that the banner and the sign-in error show verbatim. A queued change that meets one is dropped like any refusal, never retried. `limit_reached` without a message (the five-key cap) is its own case. The title limit is 500, as on the server.
3. Settings has an "Account keys" section, as written in the mcp-parity spec: none exist until the owner creates one; create shows the secret once in a sheet with Copy key and the `claude mcp add` line; the list shows the hint and the created date; revoke asks first. Connect an Agent keeps listing project keys only.

## Test list

TodzKit: the feed's pages join their deleted numbers; a pull drops deleted tasks from the board, the cache file and the widgets snapshot; the error table decodes the three codes and the bare cap; the send outcome drops a refusal once; a refused write and a refused sign-in show the message; the owner key routes and the model's create, list, revoke, failure and forget paths; the issued-key decoder accepts the `todz-owner_` prefix only with a base64url body. Server: the `/health` pin and the version gate at 0.2.4. Repository shape: the first release may be older than the oldest app accepted.
