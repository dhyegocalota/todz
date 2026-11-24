# Plan: Deploy ready

**Spec:** spec.md
**Tier:** 🔴
**Seam:** `apps/api/wrangler.jsonc`, the two public sign-in posts, the app's `project.yml`, a new runbook
**Assumptions (decided, owner can override):**
- ADR 0044, built while `Proposed` (the owner asked the loop to decide every call, PROMPT.md 2026-11-24).
- The branch starts from `feat/transactional-email` and takes `main` by merge once that ships.
- The lead creates the D1 database `todz-directory` (an authorized todz-only resource) before step 2, so its id lands in the PR; the deploy itself waits for `main`.

## File map

| Group | Paths owned | Developer sub-agent |
|-------|-------------|---------------------|
| G1 | `apps/api/wrangler.jsonc`, `apps/api/package.json`, `apps/api/src/**` (the limiter and its wiring only), `apps/api/test/**`, `apps/api/vitest.config.mts`, `apps/api/README.md`, `tools/repository-shape/src/api-source.test.ts`, `apps/macos/project.yml`, `apps/macos/README.md`, `docs/runbooks/deploy-the-api.md` (new), `docs/runbooks/README.md`, `docs/features/deploy-ready/tester-briefing.md` | `developer` |
| Lead | the D1 database's creation, the post-merge runbook run and its record | lead |

## Sequencing

The lead creates the database; G1 builds; tester and reviewers; merge; the lead runs the runbook from `main`.

## Steps

### G1

- [ ] **Step 1:** Red: `api-source.test.ts` pins the production config (ADR 0044 §1, §3) and the dev scripts' overrides; `test/sign-in-limiter.test.ts`: over the limit both posts answer 429 `too_many_requests` with one body, the key is `CF-Connecting-IP`, no binding skips the check; a shape test that `project.yml` sets `TODZ_API_BASE_URL` to `http://localhost:8787` for Debug and `https://api.todz.app` for Release and that `TodzAPIBaseURL` reads it. Commit failing alone.
- [ ] **Step 2:** Green: `wrangler.jsonc`, the scripts, the limiter, `project.yml`; `wrangler deploy --dry-run` builds; the full API suite, the shape suite and the macOS build stay green.
- [ ] **Step 3:** `docs/runbooks/deploy-the-api.md` (each step with an expected result and an `If it fails` line naming the token permission it needs), its README row, the READMEs (purpose only), tester briefing.

## Failure modes

| Step | What breaks | How I notice (the concrete signal) | How I back out |
|------|-------------|------------------------------------|----------------|
| 2 | Miniflare rejects the `ratelimits` binding | the workers project fails to start | inject a fake limiter in the tests' bindings |
| 2 | Production `vars` leak into a test | sign-in tests answer `link` where they expected `identity` | the Miniflare bindings override every var |
| 2 | `wrangler dev` picks the remote database | the dev script prints a remote id | `--local` is the default; the script never passes `--remote` |

**Steps with no backout:** the runbook's remote steps once run (a database and a deploy exist); their rollback is in the runbook.

## Z. Prove and ship

- [ ] **Tester briefing:** a developer wrote `tester-briefing.md`.
- [ ] **Tester run:** a fresh `tester` sub-agent executed `test-plan.md` and ticked every box with evidence.
- [ ] **Reviewer:** verdict recorded; refutations in `test-plan.md`.
- [ ] **Security reviewer:** verdict recorded.
- [ ] **/open-pr:** gates passed, learnings sweep stated, PR opened.
- [ ] **Runbook run from `main`:** each step's actual result recorded in the runbook's run log.
