# Plan: Security sweep

**Spec:** spec.md
**Tier:** 🔴
**Seam:** the owner and MCP entry points (`owner-endpoint.ts`, `mcp-endpoint.ts`), the directory inserts, the Worker's `fetch`, `_headers`, and the app's session vault
**Assumptions (decided, owner can override):**
- The caps, limits and namespaces are those of ADR 0073.
- `limit_reached` answers 409; `rate_limited` answers 429 with `Retry-After: 60`.

## File map

| Group | Paths owned | Developer sub-agent |
|-------|-------------|---------------------|
| G1 | `apps/api/`, `libs/types/src/constants.ts`, `tools/repository-shape/src/api-source.test.ts`, `apps/docs/package.json`, `package.json`, `pnpm-lock.yaml`, `AGENTS.md` | `developer` on `feat/security-sweep` |
| G2 | `apps/macos/` | `developer` on `lane/security-sweep-app` |
| G3 | `docs/features/security-sweep/`, `docs/features/README.md`, `docs/adr/0073-*.md`, `docs/adr/README.md`, `docs/learnings/` | `developer` on `feat/security-sweep` |

## Sequencing

G3 docs first. G1 and G2 run in parallel, each finding red then green on its own. The lead merges G2 into `feat/security-sweep`. Files that collide with lanes in flight: `wrangler.jsonc`, `env.ts`, `api-source.test.ts` and `email-address.ts` with `feat/day-email`; `site/waitlist-store.ts` and `site/waitlist-join.ts` with `feat/waitlist-inline`.

## Steps

### G3

- [x] **Step 1:** Spec, plan, test plan, ADR 0073 and both index rows; status `Building` at the first code commit. Evidence: d86b0bf2; `Building` in a96e0948.

### G1

- [x] **Step 2:** Red, finding 1 quotas: `test/owner-quotas.test.ts` creates the cap of workspaces, projects and live keys; the next create answers 409 `limit_reached` and the count stays at the cap. Evidence: a96e0948.
- [x] **Step 3:** Green: count-guarded `insertWorkspaceWithInbox`, `insertProject`, `insertProjectKey`; `OwnerErrorCode.LimitReached`; the caps in `libs/types`. Evidence: 83af297f.
- [x] **Step 4:** Red, finding 1 rate limits: `test/owner-rate-limit.test.ts` (owner routes keyed by owner id, MCP keyed by key digest, 429 with `Retry-After`, a missing or throwing limiter serves) and the two bindings in `api-source.test.ts`. Evidence: 31c37bb4.
- [x] **Step 5:** Green: `owner-rate-limit.ts`, `OWNER_LIMITER` 8611 and `MCP_LIMITER` 8612 in `wrangler.jsonc` and `env.ts`, the limits in `libs/types`. Evidence: 01887f15.
- [x] **Step 6:** Red, finding 2: a signed-in and a public body of 4097 bytes, and one without `Content-Length`, answer 400 `invalid_request`; siteverify is never called. Evidence: bd62f895 (`apps/api/test/owner-request.test.ts`; `owner-client.ts` now sends `Content-Length`, as real clients do).
- [x] **Step 7:** Green: `parsedBody` requires `isBoundedRequest`. Evidence: 32426a00.
- [x] **Step 8:** Red, finding 3: `api-source.test.ts` expects the policy under `/*` and its detach under `/icon.svg`. Evidence: 0ef0db2d.
- [x] **Step 9:** Green: `public/_headers`. Evidence: a7741016.
- [x] **Step 10:** Red, finding 4: `a@b.c?x`, `a@b#c.de`, `a@b%2e.cd` are refused. Evidence: 09b619c6.
- [x] **Step 11:** Green: the domain pattern in `email-address.ts`. Evidence: f4d312be.
- [x] **Step 12:** Red, finding 5: a directory that throws answers an empty 500 with the four headers. Evidence: 9373ac5c (in `security-headers.test.ts`, beside the other answers and their four headers).
- [x] **Step 13:** Green: the `try` in `index.ts`. Evidence: ce057b70.
- [x] **Step 14:** Red, finding 6: with the daily cap of joins in the last 24 hours, a join answers 503 "opens soon", keeps no row and sends no mail. Evidence: deb0c0ca.
- [x] **Step 15:** Green: the count-guarded `joinWaitlist`, its outcome mapped to opens soon. Evidence: a81d0f8b (`joinWaitlist` became `joinWaitlistWithinLimit`, so a caller that still expects a boolean fails to compile).
- [x] **Step 16:** Red, finding 10: a socket opened with a session closes when that session signs out; a socket of another session stays open. Evidence: 1b5307e7.
- [x] **Step 17:** Green: sockets tagged with the session digest; sign-out closes them in every owned project. Evidence: 50de327c.
- [x] **Step 18:** Finding 11: `mint` bumped or an override scoped to its tree; `pnpm audit --audit-level=high` exits 0. Evidence: a4c0c601 (mint 4.3.92 still pins sharp 0.33.5, so the override).
- [x] **Step 19:** Red, finding 12: `security-headers.test.ts` and `api-source.test.ts` expect `includeSubDomains`. Evidence: 1ae82739.
- [x] **Step 20:** Green: `STRICT_TRANSPORT_SECURITY` and `_headers`. Evidence: 3f466066.
- [x] **Step 21:** The dated learning with the sweep's result; `tester-briefing.md`. Evidence: `docs/learnings/2026-11-25-a-signed-in-route-with-no-quota-lets-one-tenant-fill-the-shared-directory.md`, `tester-briefing.md` (server lane section).

### G2

- [ ] **Step 22:** Red, finding 7: `{"secret":"abc"` bound to the vault throws `.unreadable` and leaves the file unchanged.
- [ ] **Step 23:** Green: `FileSessionVault.bind` accepts only the secret's shape.
- [ ] **Step 24:** Red, finding 8: a loopback default and an unbound file are erased, not bound.
- [ ] **Step 25:** Green: the migration binds only to an `https` non-loopback default.
- [ ] **Step 26:** Red, finding 9: a vault double whose second read returns another origin signs out without a request.
- [ ] **Step 27:** Green: `openLaunchSession` checks the stored origin.

### G1, the security review's fixes (added at the lead's request)

- [x] **Step 28:** Red, review IMPORTANT 1: issuing and revoking a key `PROJECT_LIVE_KEYS_MAX + 1` times keeps at most `PROJECT_LIVE_KEYS_MAX` rows. Evidence: 4bae6d0f.
- [x] **Step 29:** Green: revoking deletes the key's row in the batch that deletes its MCP sessions. Evidence: b37d7ea6.
- [x] **Step 30:** Red, review IMPORTANT 2: over the daily cap a known and an unknown address get the same opens-soon answer and no mail. Evidence: 8bc3e5d5.
- [x] **Step 31:** Green: a join that inserts nothing on a full day answers `Full` whatever the address. Evidence: fc6a099d.
- [x] **Step 32:** Red, review MINOR a: a crash logs the error's name and message once, and nothing of the request. Evidence: 34cf57a8 (rated IMPORTANT by the correctness review).
- [x] **Step 33:** Green: `logCrash` before the empty 500. Evidence: 2f8bb64a (`apps/api/src/crash-log.ts`, joined to the console list of `api-source.test.ts`).

## v1.1

The security review's other MINOR findings, left for v1.1 by the owner's lighter gates:

- `apps/docs/self-host.mdx` says that a fork without the `OWNER_LIMITER` and `MCP_LIMITER` bindings runs its signed-in routes with no rate limit (ADR 0073 §3).
- Sign-out fans out one call per owned project, up to 1,000 at the caps; bound it or record the projects a session opened sockets on.
- A project create in a workspace deleted between the ownership check and the insert answers 409 `limit_reached` instead of 404 `not_found`.
- The macOS app gains its own copy for 409 `limit_reached` and 429 `rate_limited`.
- ADR 0073 records that a full waitlist day locks out every new address until the window moves, and that this is accepted.
- `MCP_LIMITER` (3,600 a minute) leaves 20% headroom over the perf harness's production run (50 a second); a test ties the two.
- An address domain label that starts or ends with `-` is refused.

## Failure modes

| Step | What breaks | How I notice (the concrete signal) | How I back out |
|------|-------------|------------------------------------|----------------|
| 3 | A cap counts the wrong rows (revoked keys, another owner's workspaces) | `owner-quotas.test.ts` cases for a revoked key and a second owner | fix the guard's subquery |
| 5 | The limiter refuses the production perf run or a busy app | 429 in `pnpm perf production` or the app's log | raise the constant in `libs/types` and redeploy |
| 5 | The namespace collides with another lane's | `api-source.test.ts` after the merge | renumber in the merge |
| 7 | A client sends a chunked body without `Content-Length` | 400 `invalid_request` for that client | the app and the MCP SDK send `Content-Length` for a string body; revert the commit |
| 9 | A static asset needs a policy the default refuses | an asset fails to render on todz.app | detach the policy for that path in `_headers` |
| 15 | The cap counts rows older than 24 hours | `waitlist-store.test.ts` with an old row | fix the window |
| 17 | Sign-out wakes every project of the owner | sign-out latency | bounded by the caps of ADR 0073; revert the commit |
| 20 | A subdomain without HTTPS becomes unreachable | a browser refuses `http://<sub>.todz.app` | drop `includeSubDomains`; browsers keep it for a year |

**Steps with no backout:** Step 20 (`includeSubDomains`, kept by browsers for the `max-age`)

## Z. Prove and ship

- [ ] **Tester briefing:** a developer wrote `tester-briefing.md`.
- [ ] **Tester run:** a fresh `tester` sub-agent executed `test-plan.md` and ticked every box with evidence.
- [ ] **Reviewer:** a fresh `reviewer` sub-agent returned a verdict; refutation of the three riskiest claims is recorded in `test-plan.md`.
- [ ] **Security reviewer:** a fresh `security-reviewer` verdict on the diff.
- [ ] **/open-pr:** gates passed, learnings sweep stated, PR opened.
