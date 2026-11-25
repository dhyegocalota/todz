# 0073. Signed-in writes have quotas, and signed-in routes a rate limit per owner and per key

- Status: Accepted (the build loop's call, the owner may overturn it)
- Date: 2026-11-25
- Deciders: Claude (the build loop's call, pending the owner); Dhyego Calota (owner) asked for the sweep: "queremos rate limit e captcha nos endpoints públicos como send magic link; e também já faz varredura pra corrigir brechas de segurança"
- Inspired by: the `security-sweep` finding 1; [ADR 0045](0045-the-public-sign-in-routes-are-limited-three-ways-and-turnstile-guarded-failing-closed.md) (the public routes' limiters, failing closed); [ADR 0050](0050-the-waitlist-answers-alike-for-every-address-mails-once-and-is-guarded-like-sign-in.md) (the waitlist's guard); [ADR 0061](0061-performance-has-written-budgets-a-fetch-based-load-harness-behind-pnpm-perf-and-work-count-budgets-in-verify.md) (the production run sends at most 50 MCP requests a second)

## Context

Every tenant shares one D1 database, `todz-directory`: owners, sessions, workspaces, projects, keys, sign-in links and the waitlist. Signing up costs one Turnstile solve and one mail. After that, nothing bounds what an owner writes there: a loop on `POST /owner/workspaces`, `POST /owner/workspaces/:id/projects` or `POST /owner/projects/:id/keys` grows the directory until D1 refuses writes for everyone, and nothing bounds how fast a session or a key calls the Worker. The waitlist, the other public writer, is limited per client, per address and globally per minute, but not per day.

## Decision

1. **Quotas by count-guarded inserts.** Each insert carries its own cap in one statement, `INSERT … SELECT … WHERE (SELECT count(*) …) < ?`, as `insertSignInLinkWithinLimit` does, so two racing requests cannot both pass a separate count:
   - workspaces per owner: 20 (`OWNER_WORKSPACES_MAX`);
   - projects per workspace, the Inbox included: 50 (`WORKSPACE_PROJECTS_MAX`);
   - live keys per project, a revoked key not counted: 10 (`PROJECT_LIVE_KEYS_MAX`);
   - waitlist joins in the last 24 hours, across every address: 500 (`WAITLIST_DAILY_JOINS_MAX`).

   Over a cap an owner route answers 409 `{"error":"limit_reached"}` and writes nothing. Revoking a key deletes its row with its MCP sessions, so a loop of issues and revokes cannot grow the table past the cap. When the waitlist's day is full, every join answers "opens soon" and sends no mail, a known address included, so the answer never tells whether an address is on the list (ADR 0050). An owner already above a cap keeps every row and cannot add one.
2. **A rate limit on every signed-in route.** After the credential resolves, an owner route takes `OWNER_LIMITER` (namespace 8611) keyed by the owner id, 600 a minute (`OWNER_RATE_LIMIT_MAX`), and `/mcp` takes `MCP_LIMITER` (namespace 8612) keyed by the key digest, 3,600 a minute (`MCP_RATE_LIMIT_MAX`), above the 50 a second the production perf run may send (ADR 0061). A refusal answers 429 with `Retry-After: 60`, `{"error":"rate_limited"}` on owner routes and an empty body on `/mcp`. A local host skips both, as it skips the public limiters. Namespace 8610 belongs to `feat/day-email`.
3. **A signed-in limiter fails open.** When the binding is missing or the limiter throws, a signed-in request is served. The quotas are the hard bound on what reaches the directory, the limiter only the soft bound on how fast; failing closed would turn a limiter outage into an outage of every owner and agent. The public routes keep failing closed (ADR 0045), and `api-source.test.ts` pins both bindings in `wrangler.jsonc`.

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| Count-guarded inserts and per-credential limiters (chosen) | one statement per cap, no race; the rate follows the credential that pays | the caps are numbers the owner may outgrow | — |
| Count, then insert | simple to read | two concurrent requests both pass the count | the race defeats the cap |
| A rate limit only, no quotas | no new statement | a slow loop still fills the directory | the directory is the shared resource |
| Limit per client address | matches the public routes | one office shares one address; an agent on a server has a fixed one | the credential is the owner, not the address |
| Fail closed on a signed-in route | the same rule everywhere | a limiter outage takes the app and every agent down | the quotas already bound the harm |

## Consequences

- `GET /owner/workspaces` answers at most 20 workspaces of at most 50 projects.
- The app and an agent may now see 409 `limit_reached` and 429 `rate_limited`; the app shows them as it shows any refused write until it gains its own copy.
- Two new rate-limit namespaces in `wrangler.jsonc`; a deploy creates them.
- A change of `PRODUCTION_RATE_MAX` in `tools/perf` above 60 a second must raise `MCP_RATE_LIMIT_MAX` first.

## Evidence

The red tests of `security-sweep` steps 1–3 (`docs/features/security-sweep/test-plan.md`).

## Revisit when

An owner reaches a cap in real use; a paid plan sets caps per plan; the perf harness's production rate changes.
