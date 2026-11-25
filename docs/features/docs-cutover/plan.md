# Plan: Docs cutover

**Spec:** spec.md
**Tier:** 🟡
**Seam:** the site host's route table in `apps/api/src/site/site-endpoint.ts`, the `www` redirect in `apps/api/src/index.ts`, the site shell's links, and the two runbooks
**Assumptions (decided, owner can override):**
- The redirect drops the query string and the landing's links point at the guide on the docs, not the docs home.
- The macOS app gains no link: it has no help or guide link to repoint.

## File map

| Group | Paths owned | Developer sub-agent |
|-------|-------------|---------------------|
| G1 | `apps/api/src/`, `apps/api/scripts/site/`, `apps/api/test/`, `apps/api/e2e/landing.spec.ts`, `apps/api/package.json`, `apps/api/tsconfig.scripts.json`, `apps/api/README.md`, `package.json`, `README.md`, `scripts/verify-gates.tsv`, `scripts/verify.test.sh`, `tools/repository-shape/src/`, `docs/runbooks/`, `docs/adr/0048-*.md`, `docs/adr/0059-*.md`, `docs/features/docs-mintlify/test-plan.md`, `docs/features/docs-cutover/` | `developer` |

## Sequencing

One developer: the red tests in one commit, then the redirect and the links, then the removal of the generated guide, then the runbooks, then the docs-mintlify evidence.

## Steps

### G1

- [x] **Step 1:** Failing tests: the 301 per host and method and the kept 404s (`site-dispatch.test.ts`), the landing's links (`site-pages.test.ts`), the end-to-end link and redirect (`landing.spec.ts`), the README link (`self-host.test.ts`), step 13's expectations and the Mintlify setup (`runbooks.test.ts`), the gate map (`verify.test.sh`) — evidence: 856ff51 (10 api unit, 4 e2e, 4 shape and 2 `verify.test.sh` failures, texts in the tester briefing).
- [x] **Step 2:** `self-host-redirect.ts`, the routes, the `www` short cut and the links in the site shell — evidence: 38f14a7.
- [x] **Step 3:** Remove the generated guide, its generator, scripts, styles, copy and tests; drop the gate map row; the API README — evidence: c5b9f3e.
- [x] **Step 4:** The README link; deploy runbook step 13; the Mintlify runbook's setup, step 3 and run log; ADR 0048's status and ADR 0059's evidence — evidence: f5e102e. The Mintlify step 3 change was added here: the live footer never held the full credit sentence.
- [x] **Step 5:** The after-merge rows of `docs-mintlify`'s test plan; the tester briefing; `apps/api` unit and e2e, `repository-shape`, `pnpm verify` green — evidence: 7f02ed9; unit 1673 passed, e2e 50 passed 2 skipped, shape 311 passed; `pnpm verify` 9 gates green at 7f02ed9.

## Failure modes

| Step | What breaks | How I notice (the concrete signal) | How I back out |
|------|-------------|------------------------------------|----------------|
| 2 | `/self-host` redirects in a loop or to the wrong host | `site-dispatch.test.ts` 301 rows fail; step 13's probe shows another `location` | revert the route lines |
| 2 | other `www` paths lose their query or path | the kept `www` row of `site-dispatch.test.ts` fails | revert the `www` short cut |
| 3 | something still imports the removed page or generator | `pnpm typecheck` fails naming the import | restore the file from `main` |
| 3 | removing the guide's styles changes the landing | the landing e2e (layout, reduced motion, keyboard) fails | restore the rules |
| 4 | a runbook pin and its text disagree | `runbooks.test.ts` or `self-host.test.ts` fails | edit the text |

**Steps with no backout:** none; once deployed, browsers cache the 301, which a revert cannot recall (the docs serve the same guide, so nothing breaks).

## Z. Prove and ship

- [x] **Tester briefing:** a developer wrote `tester-briefing.md`.
- [ ] **Tester run:** a fresh `tester` sub-agent executed `test-plan.md` and ticked every box with evidence.
- [ ] **Reviewer:** a fresh `reviewer` sub-agent returned a verdict; refutation of the three riskiest claims is recorded in `test-plan.md`.
- [ ] **/check-ui:** screenshots of the landing's header and footer links and the redirect, recorded and uploaded.
- [ ] **/open-pr:** gates passed, learnings sweep stated, PR opened.
