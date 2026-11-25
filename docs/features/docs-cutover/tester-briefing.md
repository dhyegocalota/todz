# Tester briefing: Docs cutover

Written by the developer sub-agent when its steps are done. The developer does not run `test-plan.md` and does not declare the feature works.

## What changed

- `apps/api/src/site/self-host-redirect.ts` — new: `SELF_HOST_PATH`, `DOCS_SELF_HOST_URL` (`https://docs.todz.app/self-host`) and `redirectToDocs()`, a `301` with that `Location` and no body.
- `apps/api/src/site/site-endpoint.ts` — `GET` and `HEAD /self-host` route to `redirectToDocs`; every other method and `/self-host/` stay `404`.
- `apps/api/src/index.ts` — the `www` host answers `redirectToDocs()` for the path `/self-host`, any method; other `www` paths keep their `301` to the site host with path and query.
- `apps/api/src/site/site-shell.ts` — the header `.nav-link` and footer `.footer-link` point at `DOCS_SELF_HOST_URL`; labels unchanged.
- Removed: `apps/api/src/site/self-host-page.ts`, `apps/api/src/site/generated/self-host-html.ts`, `apps/api/scripts/site/` (generator, Markdown renderer, front matter helper), `apps/api/test/site/` (their tests), the `site:generate` and `site:check` scripts (root and `@todz/api`), the guide's styles (`.guide`, `.prose*`, `.back-to-top*`, `--measure-prose`, the forced-colors `.prose .code`), `LANDING_COPY.selfHost`, the `test/site` entries of both tsconfigs and the Vitest node project.
- `scripts/verify-gates.tsv` — the `apps/docs/self-host.mdx … unit docs apps/api` row is gone; the guide now maps like any `apps/docs/*` page.
- `README.md` — the self-host link is `https://docs.todz.app/self-host`.
- `docs/runbooks/deploy-the-api.md` step 13 — `/self-host` and the `www` probe expect `HTTP/2 301` with `location: https://docs.todz.app/self-host`; the `If it fails` line names a 200 as a deploy older than `docs-cutover`.
- `docs/runbooks/mintlify-publish.md` — Setup: previews not observed (`preview: false`), the GitHub app can write by design and its scope is the owner's check; step 3 expects the footer credit as the docs hold it; run log rows for 87e643f (steps 2 and 3).
- `docs/adr/0048-*.md` status and `docs/adr/0059-*.md` evidence; `docs/features/docs-mintlify/test-plan.md` after-merge rows.
- `apps/api/README.md` — the site links the guide on the docs.

## How to run

```bash
pnpm install --frozen-lockfile
pnpm --filter @todz/api test:unit
pnpm --filter @todz/api test:e2e
pnpm --filter @todz/repository-shape test:unit
bash scripts/verify.test.sh
pnpm --filter @todz/api dev:site
```

The last one serves the landing on `http://localhost:8788`; `curl -sS -D - -o /dev/null http://localhost:8788/self-host` should print `HTTP/1.1 301` and `location: https://docs.todz.app/self-host`. The e2e suite uses ports 8791 and inspector 9291; on this machine another lane's `workerd` held 9291, so the developer ran it with a scratch copy of the configuration on inspector 9391.

## Red today, green after

Red commit 856ff51; implementation 38f14a7 (redirect and links), c5b9f3e (removal), f5e102e (README and runbooks).

| Test | Red before the change because | Green after because |
|------|--------------------------------|---------------------|
| `apps/api/test/site-dispatch.test.ts` › the site host › `GET /self-host`, `HEAD /self-host`, `GET /self-host?ref=x` answers 301 to the guide on the docs, without the query | `AssertionError: expected 200 to be 301 // Object.is equality` | 38f14a7 |
| `apps/api/test/site-dispatch.test.ts` › the www host › `GET`, `HEAD`, `POST /self-host` answers 301 straight to the guide on the docs, without the query | `AssertionError: expected 'https://todz.app/self-host?ref=x' to be 'https://docs.todz.app/self-host' // Object.is equality` | 38f14a7 |
| `apps/api/test/site-pages.test.ts` › the landing › with the `none`, `opens-soon`, `joined`, `try-again` notice, the header and footer guide links open the guide on the docs | `AssertionError: expected [ '/self-host', '/self-host' ] to deeply equal [ …(2) ]` | 38f14a7 |
| `apps/api/e2e/landing.spec.ts` › self-host guide › the header and footer links open the guide on the docs (desktop, mobile) | `expect(locator).toHaveAttribute(expected) failed` / `Expected: "https://docs.todz.app/self-host"` / `Received: "/self-host"` | 38f14a7 |
| `apps/api/e2e/landing.spec.ts` › self-host guide › /self-host answers 301 to the guide on the docs (desktop, mobile) | `Expected: 301` / `Received: 200` | 38f14a7 |
| `tools/repository-shape/src/self-host.test.ts` › the root README links it on the docs site, not its file | `AssertionError: expected '<p align="center">\n  <img src="docs/…' to contain '](https://docs.todz.app/self-host)'` | f5e102e |
| `tools/repository-shape/src/runbooks.test.ts` › the smoke check expects both self-host probes to answer 301 to the guide on the docs | `AssertionError: expected '13. **Smoke check the live routes.** …' to contain '`HTTP/2 301` with `location: https://…'` | f5e102e |
| `tools/repository-shape/src/runbooks.test.ts` › the Mintlify setup says previews are off on the plan and leaves the app scope to the owner, never calling the app read-only | `AssertionError: expected '\n\nThe owner did this on 2026-11-25 …' to contain '`preview: false`'` | f5e102e |
| `tools/repository-shape/src/runbooks.test.ts` › the Mintlify check of the host expects the credit the docs footer holds | `AssertionError: expected '3. **Ask the host.** Run `curl -sS -D…' to contain '`todz is a product of`'` | f5e102e |
| `scripts/verify.test.sh` › the self-host guide | `FAIL the self-host guide: gates: expected 'gates: doctor format secrets typecheck audit shape docs', got 'gates: doctor format secrets audit shape unit docs'` and `FAIL the self-host guide: packages: expected 'packages: -', got 'packages: @todz/api'` | c5b9f3e |

Pins (green when they landed): the `www` host keeps `/?ref=x` → `https://todz.app/?ref=x` (the old row used `/self-host?ref=x`); `site-pages.test.ts` › the landing links only to this site, a fragment or an https address (moved from the removed guide page, c5b9f3e).

Developer's own runs on f5e102e plus the uncommitted test-plan ticks: `@todz/api` unit 64 files, 1673 tests passed; e2e 50 passed, 2 skipped; `tools/repository-shape` 311 passed; `scripts/verify.test.sh` exit 0; `pnpm typecheck` exit 0. `pnpm verify`: `verify: 9 gates green at 7f02ed9 (product)` (doctor, format, secrets, typecheck, audit, unit 181s, e2e 50 passed, macos 828 tests, docs 32 passed 6 skipped); the first run failed at `e2e` only because the `security-fixes` lane's `workerd` held inspector port 9291, and the second run, after the port was free, was green.

## Hypotheses to attack

1. Hypothesis: no request input reaches the redirect's `Location`. Break it by: `/self-host?x=%0d%0aSet-Cookie:a=b`, `/self-host#frag`, `HEAD`, a `www` request with a query.
2. Hypothesis: every other route on the site and `www` hosts answers exactly as before. Break it by: the full `site-dispatch.test.ts`, then step 13's fourteen probes against `http://localhost:8788` with `Host` headers.
3. Hypothesis: nothing still reads the removed generator, page, scripts or styles. Break it by: `git grep` for `site:generate`, `site:check`, `SELF_HOST_HTML`, `serveSelfHostPage`, `guideMarkdown`, `markdownHtml`, `.prose`, `--measure-prose`; `pnpm verify all`.
4. Hypothesis: the landing looks the same: the two links keep their labels, focus rings and positions at 1280 and 375, light and dark. Break it by: the walk and screenshots against `main`.
5. Hypothesis: a click on either link opens `https://docs.todz.app/self-host` in the same tab, and Back returns to the landing.

## Known gaps

- `site:check` no longer exists, so it was not run; its job (the landing's copy matches the guide) ended with the copy.
- The macOS app has no help, guide or docs link (`apps/macos/Copy/*.swift`), so it is unchanged; adding one is UI for a feature of its own.
- `docs-mintlify`'s after-merge step 4 row (the Playwright walk of `docs.todz.app` at 1280 and 375) stays open: nobody has walked the published site yet.
- The live `todz.app/self-host` answers 200 until the next deploy of the Worker runs step 13.
- The deploy runbook's `If it fails` line says to deploy again from `main` when `/self-host` answers 200; that assumes the run deploys after this merge.

## Review round 1

Red commit d785b32, then 03b5292 (Cache-Control) and the docs commit after it.

| Test | Red before the change because | Green after because |
|------|--------------------------------|---------------------|
| `apps/api/test/site-dispatch.test.ts` › the site host › `GET /self-host`, `HEAD /self-host`, `GET /self-host?ref=x` … cached for an hour; the www host › `GET`, `HEAD`, `POST /self-host` … cached for an hour | `AssertionError: expected null to be 'max-age=3600' // Object.is equality` (6 failed) | 03b5292 |
| `apps/api/e2e/landing.spec.ts` › self-host guide › /self-host answers 301 to the guide on the docs (desktop, mobile) | `Expected: "max-age=3600"` / `Received: undefined` | 03b5292 |
| `tools/repository-shape/src/runbooks.test.ts` › the Mintlify setup says branch protection cannot be enforced on this plan and names the owner options, and neither it nor ADR 0059 claims a required pull request | `AssertionError: expected '\n\nThe owner did this on 2026-11-25 …' to contain 'cannot be enforced'` | the docs commit |
| `tools/repository-shape/src/runbooks.test.ts` › after each docs deploy, a step lists the commits under apps/docs since the previous deploy and expects the owner alone | `TypeError: actual value must be number or bigint, received "undefined"` (no such step) | the docs commit |

Hypotheses to attack:

1. Hypothesis: the new step 5 of `mintlify-publish.md`, run against the deploy of 87e643f from `03beab9~1`, prints only lines naming `Dhyego Calota` twice. Break it by: running it, then a scratch commit under `apps/docs` with another author in a throwaway clone.
2. Hypothesis: `Cache-Control: max-age=3600` reaches the browser unchanged through `withSecurityHeaders` after the merge of `main`. Break it by: `curl -sS -D - -o /dev/null` on the local site.
