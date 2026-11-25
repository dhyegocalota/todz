# Plan: Turnstile live

**Spec:** spec.md
**Tier:** 🟢
**Seam:** `vars` of `apps/api/wrangler.jsonc` and step 10 of `docs/runbooks/deploy-the-api.md`
**Assumptions (decided, owner can override):**
- The site key is public and lives in `wrangler.jsonc`; the secret is put through the wrapper from the Keychain item `todz-turnstile`.
- The run's rows go in the run log by a follow-up `docs` PR, as the runbook's step 16 says.

## File map

| Group | Paths owned | Developer sub-agent |
|-------|-------------|---------------------|
| G1 | `apps/api/wrangler.jsonc`, `tools/repository-shape/src/api-source.test.ts`, `docs/runbooks/deploy-the-api.md` step 10, `docs/features/turnstile-live/`, `docs/features/README.md` | `developer` |

## Sequencing

One group, red test first, then the key, then the runbook and docs.

## Steps

- [ ] **Step 1:** the vars pin expects `TURNSTILE_SITE_KEY`, red
- [ ] **Step 2:** the key in `vars` of `apps/api/wrangler.jsonc`, green
- [ ] **Step 3:** step 10 of the runbook names the key and the Keychain path
- [ ] **Step 4:** after the merge, put the secret and run the runbook from step 1 on `main`
- [ ] **Step 5:** record the run in the run log by a `docs` PR

## Failure modes

| Step | What breaks | How I notice (the concrete signal) | How I back out |
|------|-------------|------------------------------------|----------------|
| 2 | the secret scan flags the key | `pnpm verify` secrets gate fails | allowlist the exact string anchored in `.gitleaks.toml` |
| 4 | the secret is not put or is put wrong | `wrangler secret list` lacks `TURNSTILE_SECRET_KEY`, or the link post stays 503 | put it again; rotate it in the widget if it leaked |
| 4 | the key or secret is wrong | the junk link post answers 503 instead of 429 | fix the value and deploy again |

**Steps with no backout:** step 4 (the deploy is live; the runbook's Rollback section closes sign-in and detaches `todz.app`).

## Z. Prove and ship

- [ ] **Tester briefing:** a developer wrote `tester-briefing.md`.
- [ ] **Tester run:** a fresh `tester` sub-agent executed `test-plan.md` and ticked every box with evidence.
- [ ] **Reviewer:** a fresh `reviewer` sub-agent returned a verdict.
- [ ] **/open-pr:** gates passed, learnings sweep stated, PR opened.
