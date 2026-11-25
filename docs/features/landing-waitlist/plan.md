# Plan: Landing waitlist

**Spec:** spec.md
**Tier:** 🔴
**Seam:** `apps/api/src/site/site-endpoint.ts`'s `POST /join` route, which today answers the "opens soon" page without reading the body
**Assumptions (decided, owner can override):**
- ADR 0050's choices are the ones built.
- The owner's Turnstile widget does not exist yet, so production keeps answering "opens soon" after this ships; the E2E and the walk use Cloudflare's dummy keys on a local site host.

## File map

| Group | Paths owned | Developer sub-agent |
|-------|-------------|---------------------|
| G1 (store and guard) | `apps/api/migrations/0005_waitlist.sql`, `apps/api/src/site/waitlist-store.ts`, `apps/api/src/site/waitlist-limiter.ts`, `apps/api/src/site/waitlist-join.ts`, `apps/api/src/site/site-endpoint.ts`, `apps/api/src/turnstile.ts` (the enum member), `apps/api/src/env.ts`, `apps/api/wrangler.jsonc`, `apps/api/test/waitlist-*.test.ts`, `apps/api/test/site-dispatch.test.ts`, `tools/repository-shape/src/api-source.test.ts` | `developer` (worktree `../todz-waitlist-store`) |
| G2 (page and mail) | `apps/api/src/site/landing-page.ts`, `landing-copy.ts`, `site-headers.ts`, `site-style.ts`, `apps/api/src/emails/waitlist-mail.ts`, `apps/api/scripts/emails/waitlist-*.ts`, `apps/api/scripts/emails/generated-emails.ts`, `apps/api/src/emails/generated/`, `apps/api/test/site-pages.test.ts`, `apps/api/test/emails/`, `apps/api/e2e/landing.spec.ts` | `developer` (worktree `../todz-waitlist-page`) |
| Lead | `docs/self-host.md` and `site:generate`, `tools/repository-shape/src/self-host.test.ts`, `docs/runbooks/deploy-the-api.md`, `apps/api/README.md`, `tester-briefing.md`, the ADR status lines | the lead |

G1 calls G2's `serveLandingPage({ notice, form, siteKey })` and `waitlistMail({ to, origin })` through stubs with those exact signatures until the merge.

**Amended by the plan review answers (spec R1–R18), which win over the lines above and the steps below:**

- The page's signature is `serveLandingPage({ notice, siteKey })`, with no `form` (R7).
- G1 also owns:
  - `src/index.ts` (R2);
  - `src/local-origin.ts` (`isLocalSiteHost`, R4);
  - a new `src/email-address.ts`, with `sign-in-links.ts` importing it (R6);
  - `src/turnstile-page.ts` (the two exports);
  - `libs/types/src/constants.ts` (the three limit constants);
  - the "through the Worker" block of `site-pages.test.ts` (R3).
- On a conflict, the lead keeps G2's `landing-page.ts`, `waitlist-mail.ts` and the generated email module. Nobody edits `package.json`.
- G2 also owns `apps/api/e2e/` with the Turnstile stub (R1).
- The lead also owns:
  - the `e2e` rows for `wrangler.jsonc` and `migrations/*` in `scripts/verify-gates.tsv`, with their `verify.test.sh` case (R16);
  - the ADR 0049 amendment (R9);
  - the AGENTS.md helper line (R6);
  - the runbook and guide changes (R17).

## Sequencing

G1 and G2 run in parallel; the lead merges G2 into G1's result, then runs the E2E once more.

## Steps

### G1

- [x] **Step 1:** Red: `waitlist-store.test.ts`: an insert keeps a normalised row; a second join keeps one row; only the first join claims the confirmation; a failure is recorded. Then green with the migration and the store. Evidence: red 649d83d, green bfdb2f0; the directory-tables pin follows in ce8653f.
- [x] **Step 2:** Red: `waitlist-limiter.test.ts`: each limit refuses; a missing binding or client address is unguarded; a local site host skips. Then green. Evidence: red 4536123, green 3d3ba18.
- [x] **Step 3:** Red: `waitlist-join.test.ts`, one test per row of the spec's failure table, with a counting limiter, a stub siteverify `fetcher` and a recording email sender; assert the D1 rows and the mails each time. Then green, with `TurnstileAction.Waitlist`, the bindings in `env.ts` and `wrangler.jsonc`, and the route in `site-endpoint.ts`. Evidence: red 527c6b5, green 58b8879; `env.ts` landed in 4536123, `wrangler.jsonc` and the route in f3151ff.
- [x] **Step 4:** `api-source.test.ts` pins the three bindings and namespaces; `site-dispatch.test.ts` moves its `POST /join` cases to the new answers. Evidence: red d8bdf6d, green f3151ff.

### G2

- [x] **Step 5:** Red: `site-pages.test.ts`: the `Joined` and `TryAgain` notices ~~under the posting form only~~ under both forms (R7); the widget with `data-action="waitlist"` and the site key in both forms only when a key is given; the CSP gains the challenges origin only then; still no `style=` attribute and one hash each. Then green. Red `9aa20c5`, green `5b9ed78`.
- [x] **Step 6:** Red: the waitlist mail template's tests beside the sign-in and welcome ones; then the template, its copy, `EmailTemplateName.Waitlist`, `waitlist-mail.ts` and `pnpm emails:generate`. Red `c229693`, green `a67aed7`.
- [x] **Step 7:** The E2E: a join with the dummy keys answers "You're on the list." under the posting form, focused; a second join of the same address answers the same. `694678b`; the four join tests carry `test.fail` until G1's route lands (R1).

### Lead

- [ ] **Step 8:** The guide, the runbook (six limiters at step 8, a waitlist smoke check after step 13), the API README, the briefing.

## Failure modes

| Step | What breaks | How I notice (the concrete signal) | How I back out |
|------|-------------|------------------------------------|----------------|
| 1 | the migration fails in production | runbook step 7's apply prints an error | the migration only adds a table; fix it in a PR |
| 3 | a guard fails open | the failure-table tests | revert the route to the "opens soon" handler |
| 5 | the widget's script is blocked by the CSP | the E2E console shows a CSP violation | recompute the policy from the rendered page |
| 6 | the mail is stale | `emails:check` fails | `pnpm emails:generate` |

**Steps with no backout:** the migration once applied in production (it only adds a table; a later migration may drop it).

## Z. Prove and ship

- [ ] **Plan review:** a `reviewer` sub-agent on this plan and the test plan.
- [ ] **Tester briefing:** written from the developers' reports.
- [ ] **Tester run:** a fresh `tester` sub-agent executed `test-plan.md`.
- [ ] **Reviewer and security reviewer:** fresh sub-agents returned verdicts.
- [ ] **/check-ui:** screenshots and video attached.
- [ ] **/open-pr:** gates passed, PR opened.
