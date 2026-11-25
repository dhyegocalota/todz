# Plan: Landing

**Spec:** spec.md
**Tier:** 🔴
**Seam:** `apps/api/src/index.ts`'s fetch handler, which gains a host dispatch in front of today's path dispatch; the `assets` binding; `wrangler.jsonc` routes
**Assumptions (decided, owner can override):**
- `design.md`'s recommended options are the ones built.
- `@playwright/test` joins `apps/api`'s devDependencies for the E2E (named in the PR). Playwright MCP's own browser is missing on this machine, so the E2E uses the system Chrome channel when bundled Chromium is absent.
- Development serves the API on `localhost:8787` and the site on `localhost:8788` through `dev:site` (ADR 0049 §1 as amended, spec R1).

## File map

| Group | Paths owned | Developer sub-agent |
|-------|-------------|---------------------|
| G1 | `apps/api/src/host-kind.ts`, `apps/api/src/index.ts`, `apps/api/src/env.ts`, `apps/api/src/site/site-headers.ts`, `apps/api/src/site/join-placeholder.ts`, `apps/api/wrangler.jsonc`, `apps/api/package.json` (dev script vars only), `apps/api/vitest.config.mts`, `apps/api/test/host-kind.test.ts`, `apps/api/test/site-dispatch.test.ts`, `tools/repository-shape/src/api-source.test.ts` | `developer` (worktree `../todz-landing-host`) |
| G2 | `apps/api/src/site/landing-page.ts`, `landing-copy.ts`, `site-shell.ts`, `self-host-page.ts`, `apps/api/src/site/generated/`, `apps/api/scripts/site/`, `apps/api/public/landing/`, `apps/api/package.json` (`site:*` scripts), `apps/api/test/site-pages.test.ts`, `tools/repository-shape/src/site-assets.test.ts` | `developer` (worktree `../todz-landing-pages`) |
| G3 | `apps/api/e2e/`, `apps/api/playwright.config.ts`, `apps/api/package.json` (`test:e2e`, the devDependency), `pnpm-lock.yaml` | `developer`, after G1 and G2 merge |
| Lead | `docs/runbooks/deploy-the-api.md` (DNS check and custom domains), the README hero row, `apps/api/README.md`, `tester-briefing.md`, the ADR status lines | the lead |

G1 and G2 share `apps/api/package.json`: G1 edits only the dev scripts' `--var` flags, G2 adds only the `site:*` scripts. The lead merges them.

**Amended by the plan review answers (spec R1–R17):**

- G1 also owns `apps/api/src/turnstile-page.ts` (export `sourceHash`), `apps/api/public/_headers`, the `dev:site` script, and the test files that reach `exports.default.fetch` with `https://api.todz.test` (R2).
- G2 also owns `docs/self-host.md`, `tools/repository-shape/src/self-host.test.ts`, `apps/api/test/site/`, the `site:*` aliases in the root `package.json`, `apps/api/tsconfig.json` and `tsconfig.scripts.json` (for `test/site`), `apps/api/vitest.config.mts`'s `NODE_TESTS` (after G1's binding, merged by the lead), and the `docs/self-host.md` row of `scripts/verify-gates.tsv` with its `scripts/verify.test.sh` case.
- G3 also owns the `e2e` gate: its `scripts/verify.sh` and `verify-gates.tsv` rows, its `verify.test.sh` case, the `ci-workflow.test.ts` pin, and `tsconfig.scripts.json`'s include of `e2e` and `playwright.config.ts`.

## Sequencing

G1 and G2 run in parallel. G2 builds its pages as functions `serveLandingPage({ request, env })` and `serveSelfHostPage(...)`, which G1's dispatch calls. G1 stubs them until G2 lands, and the lead wires them at the merge. G3 starts after the merge.

## Steps

### G1

- [ ] **Step 1:** Red: `host-kind.test.ts` for `hostKindOf`:
  - the API, site and `www` hosts in production and in development;
  - unknown hosts, including `workers.dev`, an IP and `evil.todz.app`;
  - `SITE_ORIGIN` absent or invalid.

  Commit it red with a throwing stub.
- [ ] **Step 2:** Green: `host-kind.ts`, plus `SITE_ORIGIN` in `env.ts`.
- [ ] **Step 3:** Red: `site-dispatch.test.ts`, red against the stubbed pages:
  - `todz.app` serves `/` and `/self-host`;
  - `/owner`, `/mcp` and `/sign-in` on `todz.app` answer 404;
  - `api.todz.app/` answers 404 as today;
  - `www.todz.app/x?y=1` answers 301 to `https://todz.app/x?y=1`;
  - an unknown host answers 404;
  - `POST todz.app/join` answers the "opens soon" page.
- [ ] **Step 4:** Green:
  - the `Record<HostKind, Handler>` dispatch in `index.ts`;
  - `site-headers.ts`: HSTS, `nosniff`, the Referrer-Policy, and a CSP builder from hashes that allows `img-src 'self'` and `form-action 'self'`;
  - `join-placeholder.ts`;
  - the `wrangler.jsonc` routes and the `SITE_ORIGIN` var;
  - the dev scripts' `--var SITE_ORIGIN:http://localhost:8788` and a `dev:site` script on port 8788 with `--local-upstream localhost:8788` (R1);
  - the Miniflare binding;
  - `api-source.test.ts` pins the routes and `SITE_ORIGIN`.

### G2

- [ ] **Step 5:** Red: `site-pages.test.ts`:
  - the landing page has the design's sections in order;
  - every visible string comes from `LANDING_COPY`;
  - each CSP hash matches its inline block;
  - no external origin appears;
  - images point at `/landing/…`;
  - the self-host page holds the generated HTML of `docs/self-host.md` inside the shell.
- [ ] **Step 6:** Green:
  - `site-shell.ts`, `landing-copy.ts`, `landing-page.ts` and `self-host-page.ts` per `design.md`;
  - `scripts/site/` renders `docs/self-host.md` into `src/site/generated/self-host-html.ts` (`site:generate`, `site:check`). Use a small renderer for the Markdown the guide uses (headings, paragraphs, lists, fenced code, inline code, links, bold), or `marked` as a devDependency if that is shorter, named in the briefing.
- [ ] **Step 7:** `public/landing/` copies the design's screenshots byte for byte; `site-assets.test.ts` pins the equality with `docs/screenshots/`.

### G3

- [ ] **Step 8:** `playwright.config.ts` boots `pnpm dev:email` on its own port and runs desktop (1280) and mobile (375) projects. `e2e/landing.spec.ts` covers:
  - the first fold, with the logo, the promise, the shot and the form;
  - the three rows, the strip, the CTA and the footer;
  - light and dark;
  - reduced motion leaves no animation;
  - the form answers "The waitlist opens soon.";
  - `/self-host` renders;
  - no console error and no request to another origin.

### Lead

- [ ] **Step 9:**
  - the runbook: a DNS check for `todz.app` and `www.todz.app` before step 8, the custom domains in step 8's expectation, and the site smoke checks in step 13;
  - `apps/api/README.md` names the site's purpose;
  - the root README's hero row gains the landing.

## Failure modes

| Step | What breaks | How I notice (the concrete signal) | How I back out |
|------|-------------|------------------------------------|----------------|
| 4 | the API host stops answering a route | the existing route tests fail | revert the dispatch commit |
| 4 | an unknown host gets the API | the `site-dispatch` test for `workers.dev` | the dispatch answers 404 by default |
| 6 | the CSP blocks the page's own CSS or script | the E2E console shows a CSP violation | recompute the hashes from the served text |
| 6 | the generated self-host page drifts | `site:check` fails | `pnpm site:generate` |
| 9 | an existing apex record blocks the custom domain at deploy | the runbook's DNS check | the owner removes the record; the API host is unaffected |

**Steps with no backout:** none in code. At deploy, attaching `todz.app` is reversed by detaching the custom domain.

## Z. Prove and ship

- [ ] **Plan review:** a `reviewer` sub-agent on this plan and the test plan.
- [ ] **Tester briefing:** written from the developers' reports.
- [ ] **Tester run:** a fresh `tester` sub-agent executed `test-plan.md`.
- [ ] **Reviewer and security reviewer:** fresh sub-agents returned verdicts.
- [ ] **/check-ui:** screenshots and video attached.
- [ ] **/open-pr:** gates passed, PR opened.
