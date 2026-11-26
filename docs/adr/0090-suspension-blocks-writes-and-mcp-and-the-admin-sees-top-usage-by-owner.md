# 0090. Suspension blocks writes and MCP, and the admin sees top usage by owner

- Status: Accepted
- Date: 2026-11-26
- Deciders: Claude (the build loop's call, lane `fair-use`) on the owner's brief of 2026-11-26; the owner is the only admin, signed in by a mail link ([ADR 0051](0051-the-admin-signs-in-by-a-mail-link-bound-to-the-browser-that-asked-into-a-cookie-session.md))
- Inspired by: [ADR 0088](0088-daily-writes-and-stored-text-are-counted-in-d1-by-one-conditional-statement-per-write.md); the admin panel's sign-in and CSRF checks in `apps/api/src/site/admin-session.ts`

## Context

The owner needs a way to stop an abusive account without deleting its data: the account should keep reading its own tasks, so a false positive costs little, but it must stop writing and stop reaching the server through an agent. Deciding who to stop needs a view of who is heavy, by writes and by stored text over the last week.

## Decision

- **Suspension** is a nullable `owners.suspended_at`. The admin sets and clears it; no owner can.
- **What a suspended owner loses:** every write on a session route (a route whose method is not `GET`, except sign-out, so a suspended owner can still leave), every MCP call (a suspended key answers a JSON-RPC error with the copy "suspended" and status 403, reads included), and every task write, which the quota statement of [ADR 0088](0088-daily-writes-and-stored-text-are-counted-in-d1-by-one-conditional-statement-per-write.md) also refuses.
- **What it keeps:** every `GET` on a session route, the change feed and its socket, and sign-out. A suspended owner's data is never deleted.
- The session check reads `suspended_at` once per write request; the MCP key lookup reads it in the same query that resolves the key, so MCP adds no statement.
- **Top usage** is the admin page `/admin/usage`: two tables of the owners with the most task writes and the most stored text bytes written over the last seven UTC days, read from `owner_usage`. Each row shows the owner id, the sign-in address when the owner has an email identity, the totals and the suspension state with one button to suspend or to restore.
- **The admin's actions** are `POST /admin/suspensions`, same-origin only (the existing `isSameOriginPost` check), behind the admin session ([ADR 0051](0051-the-admin-signs-in-by-a-mail-link-bound-to-the-browser-that-asked-into-a-cookie-session.md)). It takes the owner id and the target state, and redirects back to the page.
- **No MCP surface** exposes suspension, usage or the admin page.
- The admin page keeps the panel's `Cache-Control: no-store`, `noindex` and its CSP; a request without the admin session receives the sign-in card and no data.

## Alternatives considered

| Option | Pros | Cons | Why not |
|---|---|---|---|
| Delete an abusive owner's data | Frees storage | Irreversible; a false positive loses the owner's tasks | The owner asked for suspension, which reads and can be undone |
| Suspend reads too | Stops everything | Hides the owner's own data from a legitimate user wrongly suspended | The brief says a suspended account reads |
| Let owners see their own suspension state | Transparent | Gives an abuser the signal to rotate | The admin decides and tells the person |
| A separate admin host | Isolation | A second deployment and a second sign-in | The admin panel's existing session already isolates the view |

## Consequences

- The Top usage page is the first place the owner sees per-account numbers; it shows the sign-in address, which the owner already holds in the directory.
- A suspended owner's keys stop answering MCP; restoring the owner restores them without reissue.
- A check that is missed would be a bypass, so the suspension test covers every write route and every MCP write tool.

## Evidence

- `apps/api/test/owner-suspension.test.ts`: writes on each session write route answer 403 and write nothing; reads answer 200; sign-out answers; MCP answers 403 for a suspended key; restoring the owner restores writes.
- `apps/api/test/admin-usage.test.ts`: the usage page and the suspension POST refuse without the admin session, with a foreign origin, and for a non-admin email; with the admin session the page lists the top owners by writes and by bytes.

## Revisit when

- A second admin exists (the page then needs an audit trail).
- Suspension must expire on its own (a timed suspension needs a column for the end and a scheduled clear).
