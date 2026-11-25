# Landing

**Status:** In review
**Tier:** 🔴 (a new public host and a DNS change)
**Owner approval:** approved 2026-11-24 by the owner's request in PROMPT.md "Landing" ("cria uma landing page hiper mega simples com fila de espera, painel admin, digest etc igual zapbip … pra ser um prod ready mesmo"; "faz a landing page ser mais curta e objetiva que a do zapbip mas tão sexy quanto"). The split, the host dispatch and the rendering are the loop's calls in [ADR 0049](../../adr/0049-todz-app-is-served-by-the-same-worker-dispatched-by-host-in-three-features.md).
**ADRs:** [0049](../../adr/0049-todz-app-is-served-by-the-same-worker-dispatched-by-host-in-three-features.md), [0048](../../adr/0048-the-self-host-guide-is-one-markdown-file-that-the-landing-serves.md), [0044](../../adr/0044-the-wrangler-configuration-is-production-on-api-todz-app-and-development-overrides-it.md), [0042](../../adr/0042-emails-are-react-email-templates-rendered-at-build-time-into-a-generated-module.md)
**Not changing:** the API host's routes; the waitlist storage, Turnstile and limits (`landing-waitlist`); the admin and the digest (`landing-admin`)

## Problem

`todz.app` shows nothing. The owner wants a short, polished page that says what todz is and collects a waitlist. Strangers who want their own server need the self-host guide on the web (ADR 0048).

## Goals

- `https://todz.app` serves one page, about one screen plus a short scroll:
  1. **Hero:** the logo, the promise "Your tasks, shared with your agents.", a hero shot of the app, and the waitlist form.
  2. **Three benefit rows:** agents add tasks over MCP; the menu bar and the widgets; offline sync.
  3. **"How it works":** one strip showing `claude mcp add …` and a Claude Code tool call adding a task.
  4. **A final call to action** and a minimal footer, with a link to the self-host guide and the GitHub repository.
- The look is polished in the Liquid Glass direction:
  - the app's cobalt accent, translucent materials and the system font stack;
  - light and dark;
  - phone width (375) and desktop (1280);
  - motion that respects `prefers-reduced-motion`.
- The screenshots are real shots of the build, copied from `docs/screenshots/`; a shape test proves each served copy is byte-identical to its source.
- `https://todz.app/self-host` renders `docs/self-host.md`. The HTML is generated at build time (`pnpm --filter @todz/api site:generate`); `site:check` fails when the generated module is stale, as `emails:check` does.
- `https://www.todz.app/…` answers 301 to `https://todz.app/…`. `api.todz.app` keeps every route it has. The site host serves only `/`, `/self-host`, and its assets, and answers 404 for anything else, including `/owner` and `/mcp`.
- The waitlist form posts to `/join`. Until `landing-waitlist` ships, `/join` answers the page re-rendered with "The waitlist opens soon.", and the page sends no request elsewhere.
- Security headers on every site page:
  - a hashed CSP: `default-src 'none'`, `img-src 'self'`, `form-action 'self'`, `frame-ancestors 'none'`, `base-uri 'none'`;
  - HSTS;
  - `X-Content-Type-Options` and `Referrer-Policy`.

## Non-goals

- Storage, Turnstile and limits for the waitlist; the admin; the digest; referral codes; a welcome mail; more pages; localization.

## Design

The screens, components, tokens and copy are in [`design.md`](design.md), written by the `frontend-designer`.

### Data flow

```
GET https://todz.app/            ─▶ hostKindOf(request) = Site ─▶ landing page (template strings, hashed CSP)
GET https://todz.app/self-host   ─▶ Site ─▶ generated self-host HTML in the same shell
GET https://todz.app/landing/*   ─▶ assets binding (screenshots, logo)
POST https://todz.app/join       ─▶ Site ─▶ page with "The waitlist opens soon." (until landing-waitlist)
GET https://www.todz.app/x       ─▶ WwwRedirect ─▶ 301 https://todz.app/x
GET https://api.todz.app/…       ─▶ Api ─▶ today's ROUTE_OF_PATH and /owner
any other host                   ─▶ 404
```

### Interfaces

- `apps/api/src/host-kind.ts`: `enum HostKind { Api, Site, WwwRedirect }` and `hostKindOf({ request, env })`.
  - The kind comes from comparing the request's host with `PUBLIC_ORIGIN`'s, `SITE_ORIGIN`'s and `www.` plus `SITE_ORIGIN`'s.
  - An unknown host answers `null`, then 404.
  - `index.ts` dispatches from a `Record<HostKind, Handler>`.
- `SITE_ORIGIN` var: `https://todz.app` in `wrangler.jsonc`, and `http://localhost:8788` in the dev scripts and the tests (the API stays `http://localhost:8787`; R1).
- `wrangler.jsonc`:
  - `routes` gains `todz.app` and `www.todz.app` as custom domains;
  - `assets.run_worker_first` keeps the API paths, and the site's pages go through the Worker by host.
- `apps/api/src/site/`: `landing-page.ts`, `landing-copy.ts`, `self-host-page.ts`, `site-shell.ts` (the shared head, CSS, header and footer), `site-headers.ts`, `site-endpoint.ts` (the method-and-path router that took the place of `join-placeholder.ts`).
- `apps/api/scripts/site/`: the Markdown-to-HTML generator and its `check`.
- `apps/api/public/landing/`: copies of the README's screenshots. `public/brand/` keeps the lockup.
- The deploy runbook gains a DNS check that `todz.app` and `www.todz.app` have no A, AAAA or CNAME record before the custom domains attach.

### Failure handling

| Case | Outcome |
|------|---------|
| A request to an unknown host (a `workers.dev` address, an IP) | 404, never the site or the API |
| `SITE_ORIGIN` absent or invalid | the site host is unknown, so it answers 404; the API keeps working |
| `PUBLIC_ORIGIN` absent or invalid | the API host is unknown, so it answers 404; production always sets it in `wrangler.jsonc` |
| `/owner`, `/mcp` or `/sign-in` on `todz.app` | 404 |
| A stale generated self-host page | `site:check` fails the gate |
| A served screenshot that differs from the README's | the shape test fails |
| An existing apex record when the domain attaches | the runbook stops before the deploy, with the owner's step to remove it |

## Open questions → answers

| Question | Options | Owner's answer | Date |
|----------|---------|----------------|------|
| Hosting | same Worker by host / second Worker / Pages | Loop's call (ADR 0049): same Worker, by host | 2026-11-24 |
| Rendering | template strings / Hono JSX / static build | Loop's call (ADR 0049): template strings | 2026-11-24 |
| Scope of one PR | everything / three features | Loop's call (ADR 0049): three features, this is the first | 2026-11-24 |
| Admin auth | magic link into a cookie / password and TOTP | Loop's call (ADR 0049): magic link, in `landing-admin` | 2026-11-24 |

## Plan review answers

The run-13 plan review answered NO with two CRITICAL findings. Run 14 answers each finding; where an answer changes a Goal or an Interface above, the answer wins.

- **R1 (development mapping).** A spike in a scratch Worker proved it: under `wrangler dev`, `request.url` and the `Host` header always carry the upstream host (`--local-upstream localhost:8788` turns `127.0.0.1`, `localhost` and `Host: todz.app` all into `localhost:8788`; without the flag, all three become `api.todz.app`). So one `wrangler dev` cannot serve both hosts. Development tells the hosts apart by port: the API stays `http://localhost:8787` (`dev`, `dev:email`, `dev:email:cloudflare`), and a new `dev:site` script runs a second instance on `http://localhost:8788` with `--local-upstream localhost:8788`. Every dev script and the Miniflare bindings carry `SITE_ORIGIN=http://localhost:8788`. `api-source.test.ts` pins both. ADR 0049 §1 is amended.
- **R2 (the suite).** G1 moves the seven files the review names (`mcp-client.ts`, `worker.test.ts`, `sign-in-page.test.ts`, `sign-in-challenge-page.test.ts`, `mcp-tools.test.ts`, `owner-sign-in.test.ts`, `owner-keys.test.ts`), and any other file that reaches `exports.default.fetch` with `https://api.todz.test`, to the configured `PUBLIC_ORIGIN`. A file that needs a public, non-local host calls the default export with an env whose `PUBLIC_ORIGIN` is that host. `site-dispatch.test.ts` uses `{ ...env, PUBLIC_ORIGIN: 'https://api.todz.app', SITE_ORIGIN: 'https://todz.app' }`.
- **R3 (the comparison).** `hostKindOf` compares `new URL(request.url).host` with `new URL(origin).host`. `TODZ.APP` → `Site`; `todz.app:443` → `Site`; `todz.app.` → null; `api.todz.app:8443` → null; `evil.todz.app` → null. When the `PUBLIC_ORIGIN` host equals the `SITE_ORIGIN` host, `Api` wins (the existing service is never shadowed). `PUBLIC_ORIGIN` absent or invalid → the API host is unknown and answers 404: production always sets it, and the failure table gains the row.
- **R4 (assets on every host).** The assets binding stays as it is, because the emails load `/brand/todz-lockup.png` from `PUBLIC_ORIGIN`. The spec's host claims cover **pages**, not static files: `/landing/*` and `/brand/*` answer on every host, and `www…/landing/x.png` answers 200. `public/_headers` gives every static file `X-Content-Type-Options: nosniff`; `api-source.test.ts` pins it.
- **R5 (`robots.txt`).** Dropped. No `robots.txt` means crawlers may index the site, which is what a landing wants, and the API has nothing a robots file would protect.
- **R6 (`site:check` in the gate).** `test/site/generated-site.test.ts` joins `NODE_TESTS`, `tsconfig.scripts.json`'s include and `tsconfig.json`'s exclude, as `test/emails` does. `verify-gates.tsv` gains `docs/self-host.md	product	unit` above `docs/*.md`, with a `verify.test.sh` case. Owner: G2.
- **R7 (relative links).** The generator turns every repository-relative link of `docs/self-host.md` into its plain text while the repository is private; anchors to `https://` and `#` fragments stay links. Test: no relative `href` in the generated HTML. Owner: G2.
- **R8 (self-hosters).** `docs/self-host.md` says to replace the three `routes` and `SITE_ORIGIN` with their own domain; `self-host.test.ts` adds `SITE_ORIGIN` to its names; `site:generate` runs after. Owner: G2.
- **R9 (the E2E in the gate).** An `e2e` gate runs `pnpm --filter @todz/api test:e2e` when `apps/api/src/site/*`, `apps/api/public/*`, `apps/api/e2e/*` or `apps/api/playwright.config.ts` change, recorded in HARNESS 0.7's gate table through `verify-gates.tsv`, with a `verify.test.sh` case. ~~and the `ci-workflow.test.ts` pin~~: `verify.yml` runs its own steps rather than `pnpm verify`, with no browser job, as for the `macos` gate, and `ci-workflow.test.ts` enumerates no gates, so there is nothing to pin; the E2E runs in the local gate, which is the gate of record (ADR 0005). The doctor already requires Chromium. `e2e/` and `playwright.config.ts` join `tsconfig.scripts.json`. Owner: G3.
- **R10 (methods and paths).** On the site host:

  | Request | Answer |
  |---|---|
  | `GET` or `HEAD` `/` and `/self-host` | the page, 200 |
  | `POST /join` | the landing with the "opens soon" notices, 200; the body is never read |
  | `GET /join` | 303 to `/` |
  | anything else, including `/self-host/`, `POST /`, `/owner`, `/mcp`, `/sign-in` | 404 (`noRouteResponse`) |

  Tests: a POST of `email=<script>alert(1)</script>` never echoes it; posting from the final form lands on `/join#final` with that form's notice focused (E2E).
- **R11 (HSTS).** `Strict-Transport-Security: max-age=31536000`, with no `includeSubDomains` and no `preload`, so it covers only `todz.app` and is reversed by serving `max-age=0`. The value is a constant in `site-headers.ts` and the runbook's rollback names it.
- **R12 (ownership).** The Markdown renderer is a small one with no dependency (G2), so only G3 touches `pnpm-lock.yaml`. `apps/api/package.json`: G1 edits the dev scripts and adds `dev:site`, G2 adds `site:generate` and `site:check` and the root `site:*` aliases, G3 adds `test:e2e` and the devDependency; the lead merges. `sourceHash` is exported from `turnstile-page.ts`, which becomes a G1 file. `docs/self-host.md`, `self-host.test.ts`, the `docs/self-host.md` row of `verify-gates.tsv` and its `verify.test.sh` case are G2's; the `e2e` rows are G3's.
- **R13 (CSP).** The landing's CSP adds `script-src` and `style-src` with one hash each; the self-host page has no script and no `script-src`. Tests: no `style=` attribute anywhere, including the inline SVG glyphs and the generated guide, and no `<style>` inside inline SVG.
- **R14 (local predicates).** `src/site/` imports nothing from `local-origin.ts`, pinned in `site-pages.test.ts`. For `landing-waitlist`: its Turnstile local predicate keys on `SITE_ORIGIN`.
- **R15 (assets test, README shot).** `site-assets.test.ts` compares each file in `public/landing/` with the file at the same relative path under `docs/screenshots/`. The README's landing shot, `docs/screenshots/landing/01-landing-light.png`, meets `product-screenshots.test.ts` (≤ 1600 px, ≤ 1 MB) and gets its own story cell.
- **R16 (runbook).** Step 9 checks `workers/domains?hostname=` once per host; the deploy's expected output names three custom domains; the smoke checks `/`, `/self-host`, `www` → 301 and `todz.app/owner` → 404; the rollback names `DELETE …/workers/domains/{id}` per site host; step 11's apex MX and TXT comparison is re-run after the attach. `www` answers **301**: the forms post to the apex, so no form ever posts to `www`.
- **R18 (no GitHub link yet).** The footer's GitHub link in the Goals is left out while the repository is private, because it would answer 404 to strangers (design.md, "Owner decisions"). `shell.githubLabel` and `shell.footerGithub` stay in `LANDING_COPY`, unused, until the change that makes the repository public.
- **R19 (the `.env.example` row).** The package column of R6 also fixes the `.env.example` row, which named no package and ran an empty `--filter`; it now runs `apps/api`'s unit suite.
- **R17 (E2E isolation).** The Playwright web server runs `wrangler dev` on its own port (8791) with `--persist-to` in a fresh temporary folder.

## Test strategy summary

- **Red first:** `hostKindOf` for each host and for unknown ones.
- **The dispatch:** the site never serves `/owner`, `/mcp` or `/sign-in`, and the API host never serves `/`.
- **The `www` redirect** keeps the path and the query.
- **The page:**
  - headers and a CSP whose hashes match;
  - every copy string comes from `landing-copy.ts`;
  - the self-host page matches `docs/self-host.md`;
  - `site:check`.
- **Shape:** the custom domains, `SITE_ORIGIN`, and the screenshot copies byte-identical to their sources.
- **E2E:** Playwright against `wrangler dev` at 1280 and 375, light and dark, with reduced motion, from first paint to the footer and the "opens soon" answer.
- **The tester's walk** with screenshots for the PR and the README hero row.
