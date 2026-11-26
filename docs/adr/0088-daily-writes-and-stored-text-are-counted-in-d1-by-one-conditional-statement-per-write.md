# 0088. Daily writes and stored text are counted in D1 by one conditional statement per write

- Status: Accepted
- Date: 2026-11-26
- Deciders: Claude (the build loop's call, lane `fair-use`)
- Inspired by: [ADR 0087](0087-fair-use-limits-are-fixed-numbers-sized-against-workers-paid-allowances-and-configurable-per-server.md); the daily reply cap that `metrics-store.ts` and the reply cap already spend in D1; the sign-in limiter's "fail closed" rule in [ADR 0045](0045-the-public-sign-in-routes-are-limited-three-ways-and-turnstile-guarded-failing-closed.md)

## Context

A write to a project lands in one Durable Object, but the limits belong to the owner, who may have many projects and many MCP keys. The Worker's rate-limit bindings cannot do a day: their periods are seconds or minutes. The owner's daily count and stored text therefore live in the shared directory (D1), and the check has to be atomic: two concurrent writes must not both pass the last unit of quota.

## Decision

- One table, `owner_usage`, holds one row per owner per UTC day with the task writes and the UTF-8 bytes written that day. Its primary key is `(owner_id, day)`.
- A write reserves its share in one statement. An `INSERT ... SELECT` from `owners` only yields a row when the owner is not suspended, the day's writes plus this request stay within the daily cap and the owner's total bytes plus this request stay within the stored-text cap. An `ON CONFLICT ... DO UPDATE ... WHERE` repeats the same two checks against the existing row, so the statement either adds the whole reservation or none of it. `RETURNING` tells the caller whether it did.
- A refusal is diagnosed by one read afterwards (suspended, daily, or stored), so the caller can say which limit was reached. The diagnosis is not part of the decision: the decision is the statement.
- The reservation happens after the request body is validated and before the Durable Object is called. A write that the Durable Object then refuses for a rule (a title too long, an unknown task) has spent its reservation; the cost is bounded to the owner's own day and the next validation error is refused earlier, so this is accepted.
- Stored text is the sum of `bytes` over the owner's rows. It is an upper bound that never decreases: every added task, every edit (its new text in full) and every completion note adds its UTF-8 bytes, and a delete or a shrinking edit subtracts nothing, because the Worker does not know the old size without a Durable Object call per write. An agent that rewrites the same note many times therefore fills the counter. The admin's Top usage page has a per-owner "Reset stored text" action that zeroes the owner's counter (the writes of the day stay); the operator uses it after looking at the account. An exact counter needs a byte ledger in the Durable Object and is listed under Revisit when.
- The reservation for the owner's MCP writes is the same statement, reached through the key's owner.

Reads are never counted and never refused for quota. A suspended owner's reads pass; see [ADR 0090](0090-suspension-blocks-writes-and-mcp-and-the-admin-sees-top-usage-by-owner.md).

## Alternatives considered

| Option | Pros | Cons | Why not |
|---|---|---|---|
| A counter in the owner's Durable Object | No cross-store statement | The owner's writes span many project objects; a per-owner object serialises every write | Hot object and a single point of contention for one owner |
| Rate-limit bindings with a 60-second period | Existing bindings | Periods are seconds or minutes, not a day | Cannot express a daily cap |
| Read the sum, then write, in two statements | Simple to read | Two concurrent writes both pass the last unit | Not atomic; the owner's test for concurrent writes would fail |
| Store the byte total on the `owners` row | One read for the storage check | Needs the daily row and the total in one update, and two statements to keep them consistent | The single upsert keeps both in one row and one statement |

## Consequences

- Each write costs one D1 statement plus one read on refusal. D1 rows written grow by one per write request, inside the allowance of [ADR 0087](0087-fair-use-limits-are-fixed-numbers-sized-against-workers-paid-allowances-and-configurable-per-server.md).
- The storage sum reads the owner's rows by primary key; rows are one per active day, so the sum stays small for years.
- `owner_usage` is also the source of the admin's Top usage view ([ADR 0090](0090-suspension-blocks-writes-and-mcp-and-the-admin-sees-top-usage-by-owner.md)).

## Evidence

- Migration `apps/api/migrations/0012_fair_use.sql` (added with this change).
- Concurrency test: `apps/api/test/owner-write-quota.test.ts` sends concurrent writes at the last unit of the daily cap and counts accepted writes.

## Revisit when

- Writes per request rise sharply (a bulk import tool), when the per-write D1 statement becomes the cost driver.
- Deletion exists, when stored text becomes exact.
