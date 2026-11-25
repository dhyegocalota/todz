# Tester briefing: Security sweep

Written by the developer sub-agent when its steps are done. The developer does not run `test-plan.md` and does not declare the feature works.

## Server lane (`feat/security-sweep`, findings 1–6 and 10–12)

### What changed

- `apps/api/src/directory-workspaces.ts`, `apps/api/src/directory.ts`, `apps/api/src/project-keys.ts`, `apps/api/src/owner-workspaces.ts`, `apps/api/src/owner-keys.ts` — workspace, project and key inserts carry their cap in one statement; over a cap the route answers 409 `limit_reached` (`OwnerErrorCode.LimitReached`). `issueProjectKey` answers `null` at the cap.
- `apps/api/src/signed-in-limiter.ts` (new, `isSignedInRateLimited`, joined to the `AGENTS.md` helper line), `apps/api/src/owner-endpoint.ts`, `apps/api/src/mcp-endpoint.ts` — `OWNER_LIMITER` by owner id after the session resolves, `MCP_LIMITER` by key digest after the key resolves; a refusal is 429 with `Retry-After: 60` (`{"error":"rate_limited"}` on owner routes, an empty body on `/mcp`); a missing or throwing limiter serves; a local host skips.
- `apps/api/wrangler.jsonc`, `apps/api/src/env.ts`, `libs/types/src/constants.ts` — `OWNER_LIMITER` 8611 (600 a minute), `MCP_LIMITER` 8612 (3,600 a minute), the caps (20 workspaces, 50 projects, 10 live keys, 500 waitlist joins a day).
- `apps/api/src/owner-request.ts` — `parsedBody` (and so `parsedPublicBody`) returns `null` unless `isBoundedRequest`.
- `apps/api/public/_headers` — `/*` carries `default-src 'none'; frame-ancestors 'none'`; `/icon.svg` detaches it with `! Content-Security-Policy` before its own policy; HSTS gains `includeSubDomains`.
- `apps/api/src/email-address.ts` — the domain is `[a-z0-9-]+(\.[a-z0-9-]+)+`.
- `apps/api/src/index.ts`, `apps/api/src/http-status.ts` — a rejection of `serveHost` answers an empty 500 through `withSecurityHeaders`.
- `apps/api/src/site/waitlist-store.ts`, `apps/api/src/site/waitlist-join.ts` — `joinWaitlist` is replaced by `joinWaitlistWithinLimit`, answering `WaitlistJoin.Claimed | Known | Full`; `Full` maps to opens soon, `Known` to joined.
- `apps/api/src/project-store.ts`, `apps/api/src/owner-changes.ts`, `apps/api/src/project-routing.ts`, `apps/api/src/owner-account.ts`, `apps/api/src/http-header.ts` — the socket route passes the session digest in `Todz-Session-Digest` (always set by the Worker, overriding any client value); the store tags the socket with it and refuses an upgrade without it (400); sign-out closes the tagged sockets in every project of the owner, in `waitUntil`.
- `apps/api/src/http-header.ts` — `STRICT_TRANSPORT_SECURITY` is `max-age=31536000; includeSubDomains` (`http://docs.todz.app`, `http://api.todz.app/health` and `http://www.todz.app/` each answered 301 to `https` on 2026-11-25).
- `package.json`, `pnpm-lock.yaml` — `pnpm.overrides` `@mintlify/cli>sharp` 0.35.5 and `@mintlify/package-builder>js-yaml` 4.3.2; `mint validate` still passes.
- Tests: `owner-quotas.test.ts`, `owner-rate-limit.test.ts`, `owner-request.test.ts` (new); `owner-client.ts` now sends `Content-Length`; `directory-seed.ts` gains `issuedKeyOf`; `waitlist-client.ts` gains `seedJoins` and `deleteSeededJoins`.
- Docs: `apps/api/README.md`, `apps/docs/self-host.mdx` (the eleven bindings), `docs/runbooks/deploy-the-api.md` (the HSTS rollback sentence), ADR 0073, the dated learning.

### How to run

```bash
pnpm install --frozen-lockfile
pnpm --filter @todz/api exec vitest run --project workers test/owner-quotas.test.ts test/owner-rate-limit.test.ts test/owner-request.test.ts test/email-address.test.ts test/security-headers.test.ts test/waitlist-store.test.ts test/waitlist-join.test.ts test/owner-changes.test.ts test/project-changes.test.ts
pnpm --filter @todz/repository-shape exec vitest run src/api-source.test.ts
pnpm audit --audit-level=high
pnpm --filter @todz/api dev
```

### Red today, green after

| Test | Red commit | Red before the change because (printed) | Green after |
|------|-----------|------------------------------------------|-------------|
| `owner-quotas.test.ts` (4 of 7; the other-owner, revoked-key and second-workspace cases are pins) | a96e0948 | `AssertionError: expected 201 to be 409 // Object.is equality`; concurrent: `expected [ Response{}, Response{}, …(23) ] to have a length of 20 but got 25` | 83af297f |
| `owner-rate-limit.test.ts` (4 of 9; missing, down and local-host cases are pins) | 31c37bb4 | `AssertionError: expected [] to deeply equal [ Array(1) ]` (owner and key limiter); `AssertionError: expected 200 to be 429 // Object.is equality` (both refusals) | 01887f15 |
| `api-source.test.ts::the wrangler configuration limits … signed-in owners and keys` | 31c37bb4 | `AssertionError: expected [ …(9) ] to deeply equal [ …(11) ]` | 01887f15 |
| `owner-request.test.ts` (4 of 5; the exact-bound case is a pin) | bd62f895 | `AssertionError: expected 201 to be 400 // Object.is equality` (signed-in), `AssertionError: expected 429 to be 400 // Object.is equality` (public, the body read and refused by Turnstile) | 32426a00 |
| `api-source.test.ts::every static file answers with … a policy that allows nothing and no framing …` | 0ef0db2d | `AssertionError: expected '/*\n  X-Content-Type-Options: nosniff…' to match /…/` | a7741016 |
| `email-address.test.ts` (5 new cases) | 09b619c6 | `AssertionError: expected 'a@b.c?x' to be null`, the same for `'a@b#c.de'`, `'a@b%2e.cd'`, `'a@b_c.de'` and `'a@b..cd'` | f4d312be |
| `security-headers.test.ts::a crash answers an empty 500 with the four headers` | 9373ac5c | `Error: the directory is down` (the rejection escaped `fetch`) | ce057b70 |
| `waitlist-store.test.ts` (3 new) and `waitlist-join.test.ts::a join over the daily cap …` | deb0c0ca | store: `Error: joinWaitlistWithinLimit is not implemented` (the red stub); join: `AssertionError: expected 200 to be 503 // Object.is equality` | a81d0f8b |
| `owner-changes.test.ts::signing out closes the sockets that session opened` (the other-session case is a pin) | 1b5307e7 | `AssertionError: expected 'changed' to be 'closed' // Object.is equality` | 50de327c |
| HSTS in `security-headers`, `site-pages`, `site-discovery`, `mcp-server-card` tests, `landing.spec.ts` (E2E) and `api-source.test.ts` | 1ae82739 | `AssertionError: expected 'max-age=31536000' to be 'max-age=31536000; includeSubDomains' // Object.is equality` (37 workers tests); the `_headers` pattern mismatch | 3f466066 |
| `pnpm audit --audit-level=high` | — | 4 high (sharp ×3, js-yaml) | a4c0c601, `No known vulnerabilities found` |

### Hypotheses to attack

1. Two racing creates cannot pass a cap. Break it by firing `cap + n` creates of workspaces, projects or keys at once against `wrangler dev`, and counting rows.
2. A revoked key frees its place and nothing else does. Break it by revoking and re-issuing at the cap, and by issuing on a project of another owner.
3. No limiter key carries a secret: the owner limiter sees the owner id, the key limiter the key digest. Break it by recording every key in a run of the whole suite.
4. A signed-in route never fails closed because of the limiter. Break it by removing the binding or throwing from it on a public host.
5. Every owner body without `Content-Length` or above 4096 bytes is refused before it is read, public or signed-in, and the macOS app and the perf harness still send `Content-Length`. Break it by driving the Debug app through sign-in, workspace, project, key and task writes on `wrangler dev`, and by a chunked request.
6. `GET /icon.svg` carries only its own policy and every other static file `default-src 'none'; frame-ancestors 'none'`. Break it on `wrangler dev` with `curl -sSI` on `/icon.svg`, `/og/todz.png`, `/brand/todz-lockup.png`, `/favicon.ico`.
7. A crash anywhere in `serveHost` answers an empty 500 with the four headers and leaks no message.
8. The waitlist answers alike over the cap for a known address (joined) and opens soon for a new one, and sends no mail over the cap.
9. Signing out closes only that session's sockets; a socket opened with the old token after sign-out is refused 401. Break it with two Macs or two sessions of one owner.
10. A client cannot pick another session's tag: the Worker always overwrites `Todz-Session-Digest`. Break it by sending the header yourself on the socket upgrade.

### Known gaps

- **Collisions with lanes in flight.** `apps/api/wrangler.jsonc`, `apps/api/src/env.ts`, `tools/repository-shape/src/api-source.test.ts`, `apps/docs/self-host.mdx` (line 33), `apps/api/src/email-address.ts` and `apps/api/src/index.ts` with `feat/day-email`; `apps/api/src/site/waitlist-store.ts`, `apps/api/src/site/waitlist-join.ts` and `apps/api/test/waitlist-join.test.ts` with `feat/waitlist-inline`, whose `joinNoticeOf` still calls `joinWaitlist` and compares a boolean: the merge fails to compile until it calls `joinWaitlistWithinLimit` and maps `Full` to opens soon and `Known` to joined.
- **Red on this branch alone:** `tools/repository-shape/src/self-host.test.ts::the rate-limit namespaces it names are the configured ones` needs one contiguous range of namespace ids; 8610 belongs to `feat/day-email`, so it is green only after that merge, with line 33 of the guide reading "`8601` to `8612`" and twelve bindings.
- A session expiry or the eviction of an owner's 21st session does not close its sockets; only sign-out does.
- The crash 500 no longer surfaces as an uncaught exception in the Workers logs.
- The macOS app shows `limit_reached` and `rate_limited` as any refused write; it has no copy of its own for them.
- The real Workers rate limiter is not exercised; the tests use recording doubles.

## App lane (`lane/security-sweep-app`, findings 7–9)

Written by its own developer.
