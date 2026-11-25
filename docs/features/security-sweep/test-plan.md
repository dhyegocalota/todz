# Test plan: Security sweep

Every checkbox states the input and the exact expected outcome. A ticked box carries evidence after ` — evidence: ` (commit hash, log path, counts, screenshot path). The red commit of each finding and the failure text it printed are in `tester-briefing.md`.

## The failing test first

Finding 1, quotas (`apps/api/test/owner-quotas.test.ts`):

- [ ] `the next workspace over the cap is refused` — input: an owner with `OWNER_WORKSPACES_MAX` workspaces, then `POST /owner/workspaces`; expected: 409 `{"error":"limit_reached"}`, `GET /owner/workspaces` lists `OWNER_WORKSPACES_MAX`
- [ ] `the next project over the cap is refused` — input: a workspace with `WORKSPACE_PROJECTS_MAX` projects, the Inbox included, then `POST /owner/workspaces/:id/projects`; expected: 409 `limit_reached`, the workspace keeps `WORKSPACE_PROJECTS_MAX` projects
- [ ] `the next live key over the cap is refused` — input: a project with `PROJECT_LIVE_KEYS_MAX` live keys, then `POST /owner/projects/:id/keys`; expected: 409 `limit_reached`, no new `project_keys` row
- [ ] `a revoked key frees its place` — input: the cap of live keys, one revoked, then one issue; expected: 201
- [ ] `another owner's workspaces do not count` — input: owner A at the cap, owner B creates a workspace; expected: 201

Finding 1, rate limits (`apps/api/test/owner-rate-limit.test.ts`, `tools/repository-shape/src/api-source.test.ts`):

- [ ] `a signed-in owner route takes the owner limiter by owner id` — input: `GET /owner/workspaces` on a public host with a recording `OWNER_LIMITER`; expected: 200 and the limiter saw one key, the owner id
- [ ] `a refused owner route answers rate limited` — input: the same with a refusing limiter; expected: 429 `{"error":"rate_limited"}`, `Retry-After: 60`
- [ ] `a missing or throwing owner limiter serves` — input: no `OWNER_LIMITER`, then one that throws; expected: 200 for each
- [ ] `a local host skips the owner limiter` — input: the same call on `http://localhost:8787` with a refusing limiter; expected: 200, the limiter saw nothing
- [ ] `/mcp takes the key limiter by key digest` — input: `POST /mcp` initialize on a public host with a recording `MCP_LIMITER`; expected: the limiter saw the key's digest, never the key
- [ ] `a refused /mcp answers 429` — input: the same with a refusing limiter; expected: 429, `Retry-After: 60`
- [ ] `the wrangler configuration limits signed-in owners and keys` — input: `apps/api/wrangler.jsonc`; expected: `OWNER_LIMITER` namespace 8611 and `MCP_LIMITER` namespace 8612, each with its shared limit and a 60 s period

Finding 2 (`apps/api/test/owner-request.test.ts`):

- [ ] `a signed-in body over the bound is refused` — input: `POST /owner/workspaces` with `Content-Length: 4097`; expected: 400 `invalid_request`, no workspace
- [ ] `a signed-in body without a length is refused` — input: a streamed body with no `Content-Length`; expected: 400 `invalid_request`
- [ ] `a public body over the bound is refused before Turnstile` — input: `POST /owner/sign-in-links` with `Content-Length: 4097`, then without one; expected: 400 `invalid_request` each, siteverify never called

Finding 3 (`tools/repository-shape/src/api-source.test.ts`):

- [ ] `every static file answers with the security headers` — input: `apps/api/public/_headers`; expected: `/*` carries `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'`, `/icon.svg` detaches it with `! Content-Security-Policy` before its own policy

Finding 4 (`apps/api/test/email-address.test.ts`):

- [ ] `a domain with a query, a fragment or an escape is refused` — input: `a@b.c?x`, `a@b#c.de`, `a@b%2e.cd`; expected: `normalizedAddress` returns `null` for each
- [ ] `a plain address still passes (pin)` — input: `Maria@Example.co.uk`; expected: `maria@example.co.uk`

Finding 5 (`apps/api/test/worker.test.ts`):

- [ ] `a crash answers an empty 500 with the four headers` — input: a request whose `DIRECTORY.prepare` throws; expected: 500, empty body, the four headers of `withSecurityHeaders`

Finding 6 (`apps/api/test/waitlist-join.test.ts`, `waitlist-store.test.ts`):

- [ ] `the join over the daily cap opens soon` — input: `WAITLIST_DAILY_JOINS_MAX` rows joined in the last 24 hours, then a solved join of a fresh address; expected: 503 opens soon, no row for the address, no mail
- [ ] `rows older than a day do not count` — input: the cap of rows joined 25 hours ago, then a join; expected: the address is kept

Finding 10 (`apps/api/test/owner-changes.test.ts`):

- [ ] `signing out closes the sockets of that session` — input: a socket opened on a project, then `DELETE /owner/sessions/current` with the same session; expected: the socket closes
- [ ] `another session's socket stays open` — input: two sessions of one owner, each with a socket, one signs out, then a task is added; expected: the other socket receives `changed`

Finding 11:

- [ ] `pnpm audit --audit-level=high` — expected: exit 0
- [ ] `pnpm security:audit` — expected: exit 0

Finding 12 (`apps/api/test/security-headers.test.ts`, `api-source.test.ts`):

- [ ] `every answer carries HSTS on subdomains` — input: each host kind of the existing table; expected: `Strict-Transport-Security: max-age=31536000; includeSubDomains`
- [ ] `the static files carry HSTS on subdomains` — input: `_headers`; expected: the same value under `/*`

Findings 7–9 (TodzKit, `lane/security-sweep-app`):

- [ ] Finding 7 — input: `{"secret":"abc"` bound; expected: throws `.unreadable`, the file unchanged
- [ ] Finding 8 — input: a loopback default server and an unbound file; expected: the file erased, nothing bound
- [ ] Finding 9 — input: a vault double whose second read returns another origin; expected: signed out, no request sent

## Prove it for real

- [ ] On `wrangler dev`: `GET /og/todz.png` and `GET /icon.svg`; expected: the first carries `default-src 'none'; frame-ancestors 'none'`, the second only its own policy
- [ ] On `wrangler dev`: the macOS Debug app signs in, creates a workspace, a project and a key, signs out; expected: each step as before, and the change socket closes at sign-out
- [ ] Console and network clean in the app's log, other than the expected refusals

## Edge cases found during execution

Empty on purpose.

## Adversarial review

- [ ] Claim 1: two concurrent creates cannot pass a cap — attack: fire `cap + 5` creates at once; result:
- [ ] Claim 2: the limiter key never carries a secret — attack: read every recorded key; result:
- [ ] Claim 3: a closed socket cannot be reopened with the signed-out session — attack: reconnect with the old token; result:

## Coverage honesty

- The real Workers rate limiter is not exercised; tests use recording doubles, as for the public limiters.
- `includeSubDomains` is proven only for the three subdomains that answered on 2026-11-25.
