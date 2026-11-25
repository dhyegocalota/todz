# Landing

**Status:** Approved
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
- `https://www.todz.app/…` answers 301 to `https://todz.app/…`. `api.todz.app` keeps every route it has. The site host serves only `/`, `/self-host`, its assets and `robots.txt`, and answers 404 for anything else, including `/owner` and `/mcp`.
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
- `SITE_ORIGIN` var: `https://todz.app` in `wrangler.jsonc`, and `http://127.0.0.1:8787` in the dev scripts and the tests (the API stays `http://localhost:8787`).
- `wrangler.jsonc`:
  - `routes` gains `todz.app` and `www.todz.app` as custom domains;
  - `assets.run_worker_first` keeps the API paths, and the site's pages go through the Worker by host.
- `apps/api/src/site/`: `landing-page.ts`, `landing-copy.ts`, `self-host-page.ts`, `site-shell.ts` (the shared head, CSS, header and footer), `site-headers.ts`, `join-placeholder.ts`.
- `apps/api/scripts/site/`: the Markdown-to-HTML generator and its `check`.
- `apps/api/public/landing/`: copies of the README's screenshots. `public/brand/` keeps the lockup.
- The deploy runbook gains a DNS check that `todz.app` and `www.todz.app` have no A, AAAA or CNAME record before the custom domains attach.

### Failure handling

| Case | Outcome |
|------|---------|
| A request to an unknown host (a `workers.dev` address, an IP) | 404, never the site or the API |
| `SITE_ORIGIN` absent or invalid | the site host is unknown, so it answers 404; the API keeps working |
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
