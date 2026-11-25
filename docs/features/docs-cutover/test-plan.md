# Test plan: Docs cutover

Every checkbox states the input and the exact expected outcome. A ticked box carries evidence after ` — evidence: ` (commit hash, log path, counts, screenshot path).

Runs against: the Workers pool of `@todz/api` for unit tests, the local site on `http://localhost:8788` (`pnpm --filter @todz/api dev:site`) for the end-to-end suite and the walk. `docs.todz.app` is read only, never written.

## The failing test first

- [ ] Red commit — the tester checks out the red commit in a throwaway worktree, runs `apps/api` unit, the landing e2e, `tools/repository-shape` and `scripts/verify.test.sh`, and records the failure texts the tester briefing lists
- [ ] Confirmed each red fails for the right reason: the assertion on the status, the `Location`, the `href` or the runbook text, never an import or type error

## Unit (`apps/api`)

- [ ] `site-dispatch.test.ts` — input: `GET` and `HEAD` `https://todz.app/self-host`; expected: `301`, `Location` `https://docs.todz.app/self-host`, empty body
- [ ] `site-dispatch.test.ts` — input: `GET https://todz.app/self-host?ref=x`; expected: `301`, `Location` `https://docs.todz.app/self-host` (no `?ref=x`)
- [ ] `site-dispatch.test.ts` — input: `GET` and `POST` `https://www.todz.app/self-host?ref=x`; expected: `301`, `Location` `https://docs.todz.app/self-host`
- [ ] `site-dispatch.test.ts` — input: `GET https://www.todz.app/?ref=x`; expected: `301`, `Location` `https://todz.app/?ref=x`
- [ ] `site-dispatch.test.ts` — input: `GET /self-host/`, `POST /self-host`, `DELETE /self-host`, `GET /self-host/../owner/sign-in-method` on `todz.app`; expected: `404`, empty body
- [ ] `site-dispatch.test.ts` — input: `GET https://api.todz.app/self-host`; expected: `404`
- [ ] `site-pages.test.ts` — input: the landing with every notice; expected: the header's `.nav-link` and the footer's `.footer-link` each have `href="https://docs.todz.app/self-host"`, and no `href="/self-host"` remains
- [ ] `site-pages.test.ts` — input: the landing; expected: every word still comes from `LANDING_COPY`, the CSP and headers tests unchanged and green
- [ ] Edge: nothing imports the removed modules — input: `pnpm typecheck`; expected: exit 0 with `self-host-page.ts`, `generated/self-host-html.ts` and `scripts/site/` gone

## End-to-end (`apps/api/e2e/landing.spec.ts`)

- [ ] `self-host guide` — steps: open `/`; expected: `.site-footer .footer-link` and `.site-header .nav-link` have `href` `https://docs.todz.app/self-host`
- [ ] `self-host guide` — steps: request `/self-host` without following redirects; expected: status `301`, `location` `https://docs.todz.app/self-host`
- [ ] `credit` — steps: open `/`; expected: the credit line and link as before (the `/self-host` row is gone)
- [ ] `console and network` — steps: open `/` and `/join`; expected: no console error, no foreign request other than Turnstile
- [ ] `keyboard` and `keyboard in the footer` — steps: as before; expected: the guide link still takes focus with a ring

## Shape (`tools/repository-shape`) and gate map

- [ ] `self-host.test.ts` — input: `README.md`; expected: holds `](https://docs.todz.app/self-host)` and no `](apps/docs/self-host.mdx)`
- [ ] `runbooks.test.ts` — input: `deploy-the-api.md` step 13; expected: holds `HTTP/2 301` with `location: https://docs.todz.app/self-host` for the landing's guide and for the `www` probe, and no `location: https://todz.app/self-host?from=runbook`
- [ ] `runbooks.test.ts` — input: `mintlify-publish.md` `## Setup`; expected: holds `preview: false` and `Only select repositories`, and no `read-only`
- [ ] `scripts/verify.test.sh` — input: a change to `apps/docs/self-host.mdx`; expected: class `product`, the gates of `apps/docs/*`, no `@todz/api` package
- [ ] `pnpm verify` — expected: every gate the plan selects is green

## Prove it for real — Playwright MCP

- [ ] Happy path: open `http://localhost:8788/`, click "Self-host guide" in the header, Back, click it in the footer; expected: each click lands on `https://docs.todz.app/self-host` titled `Self-host todz - todz`, Back returns to the landing
- [ ] Redirect: open `http://localhost:8788/self-host?from=walk`; expected: the address bar ends at `https://docs.todz.app/self-host` with no query, the guide shown
- [ ] Unknown neighbours: open `http://localhost:8788/self-host/`; expected: the empty `404`
- [ ] Console and network: zero console errors on the landing, the only foreign requests the Turnstile script and, after the click, `docs.todz.app`
- [ ] Desktop width 1280, light and dark: the header and footer links show "Self-host guide" as before
- [ ] Narrow width 375, light and dark: the header link shows "Self-host", the footer link "Self-host guide", no horizontal scroll
- [ ] Screenshots at `.pr-media/docs-cutover/`; video at `.pr-media/docs-cutover/`

## Edge cases found during execution

Empty on purpose. The tester adds one checkbox per new case (input, exact expected outcome) and a regression test for each.

## Adversarial review

- [ ] Claim 1: no request input reaches the `Location` of the docs redirect — attack: `/self-host?x=%0d%0aSet-Cookie:a=b`, `//self-host`, `/self-host#x`, a `www` host with a port; result: <refuted | held>
- [ ] Claim 2: nothing else read the removed generator or page — attack: grep the tree for `site:generate`, `site:check`, `SELF_HOST_HTML`, `serveSelfHostPage`, `guideMarkdown`, `markdownHtml`; run `pnpm verify all`; result: <refuted | held>
- [ ] Claim 3: every other `www` and site route answers as before — attack: rerun the full `site-dispatch.test.ts` and the step 13 list against the local site; result: <refuted | held>

## Coverage honesty

- The live `todz.app/self-host` keeps answering 200 until the next deploy runs step 13; the unit and e2e suites prove the code, not the deploy.
- `docs.todz.app` itself is not under test here; `mintlify-publish` checks it.
- The macOS app is unchanged: it has no link to repoint.
