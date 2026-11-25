# Landing SEO

**Status:** Building
**Tier:** 🟡
**Owner approval:** approved 2026-11-25 by the owner's request to the loop, `todz-loop/PROMPT.md` "Landing SEO" ("landing page tem que ter SEO, JSON-LD, favicon, GEO, OpenGraph, tudo otimizado.. WebMCP, ajusta tudo aí.. faz em paralelo"): a title and description per page, a canonical URL, `robots.txt` and `sitemap.xml`, one `h1` and landmarks, `lang` and `theme-color` for both schemes; Lighthouse SEO, Best Practices and Accessibility at 100 and Performance at 95 or more on mobile; JSON-LD `SoftwareApplication`, `Organization` (Logic Bit, from `libs/types`) and `WebSite`, validated in a test; icons from `todz-loop/brand/` (`favicon.ico` 16/32/48, an SVG favicon with a dark variant, the 180 `apple-touch-icon`, a `site.webmanifest` with the 192 and 512 icons, maskable); Open Graph and Twitter tags with a 1200×630 image of the lockup and a real app shot, generated and committed; `llms.txt` and `llms-full.txt`, quotable copy, `robots.txt` allowing the AI crawlers; WebMCP tools behind feature detection (read-only: what todz is, the MCP setup for a client, open the docs; `join_waitlist` through the Turnstile token the page obtains, no bypass, no new unauthenticated path) and an MCP server card describing the server on `api.todz.app`; the spec researched first and cited in an ADR; a strict CSP; tests for every tag, file and block, Lighthouse run locally on a phone profile with the numbers recorded, and the production URLs checked after the deploy. The shape is the loop's call in [ADR 0060](../../adr/0060-the-landing-describes-itself-from-the-copy-modules-and-offers-webmcp-tools-over-its-own-turnstile-form.md).
**ADRs:** [0060](../../adr/0060-the-landing-describes-itself-from-the-copy-modules-and-offers-webmcp-tools-over-its-own-turnstile-form.md), [0049](../../adr/0049-todz-app-is-served-by-the-same-worker-dispatched-by-host-in-three-features.md), [0050](../../adr/0050-the-waitlist-answers-alike-for-every-address-mails-once-and-is-guarded-like-sign-in.md), [0046](../../adr/0046-the-app-solves-the-challenge-in-a-web-view-and-the-link-page-solves-it-for-the-sign-in.md), [0038](../../adr/0038-the-brand-sources-are-svgs-in-docs-brand-and-the-app-s-assets-are-generated-from-them.md)
**Not changing:** the landing's sections, layout, visible copy and design; the waitlist route, its Turnstile check, its three limits and its answers; the admin (its two pages only declare themselves private to the shell); the MCP server and its tools; the sign-in pages; `apps/api/public/_headers` (owned by `security-fixes`); the macOS app

## Problem

todz.app tells a person what todz is and tells nobody else. A search engine finds no canonical, no sitemap and no structured data; a chat app pasting the link shows no card; an answer engine has no `llms.txt` to quote; a browser agent finds no tool; the tab shows no icon. Lighthouse on production (mobile, 2026-11-25) scores Performance 92, Accessibility 100, Best Practices 88, SEO 92 and Agentic browsing 50, failing on `/favicon.ico` 404, a CSP console error from Cloudflare's injected analytics beacon, the dark window shot's aspect ratio, `robots-txt`, `llms-txt` and `ard-schema` (ADR 0060 → Evidence).

## Goals

1. **Head tags on every public page** (`/`, `/self-host`; the admin pages are private and get only the title and the favicon links, never a canonical, Open Graph, Twitter, touch icon, manifest or JSON-LD): title, meta description, `link rel=canonical` on `https://todz.app`, `og:title`, `og:description`, `og:url`, `og:type` `website`, `og:site_name` `todz`, `og:image` (absolute, with `og:image:width` 1200, `og:image:height` 630, `og:image:alt`), `twitter:card` `summary_large_image`, the icon links (`/favicon.ico` `sizes="48x48"`, `/icon.svg` `type="image/svg+xml"`, `/apple-touch-icon.png`), `link rel=manifest` `/site.webmanifest`, `lang="en"`, `theme-color` light `#F2F4FA` and dark `#070812` (as today). One `h1` per page; `header`, `nav`, `main`, `footer` (as today, pinned by a test).
2. **JSON-LD**: one `<script type="application/ld+json">` per page holding an `@graph`: `Organization` (`@id` `https://todz.app/#publisher`, `name` `COMPANY.tradeName`, `legalName` `COMPANY.legalName`, `url` `COMPANY.website`, `logo` `COMPANY.logo`, a new fact: `https://www.logicbit.com.br/favicon/apple-touch-icon.png`, the studio's own 180×180 PNG, answering 200 on 2026-11-25), `WebSite` (`@id` `https://todz.app/#website`, `name` `todz`, `url` `https://todz.app/`, `inLanguage` `en`, `publisher` → the organization) and, on the landing, `SoftwareApplication` (`@id` `https://todz.app/#app`, `name` `todz`, `description` the landing's meta description, `url`, `image` the Open Graph image, `operatingSystem` `macOS 14 or later`, `applicationCategory` `BusinessApplication`, `applicationSubCategory` `Productivity`, `publisher` → the organization, `offers` one `Offer` with `price` `0`, `priceCurrency` `USD`, `availability` `https://schema.org/PreOrder`, `url` `https://todz.app/#join`). Validated in a test against a shape table of required and allowed properties per type, each row citing its source: schema.org's type pages (https://schema.org/Organization, https://schema.org/WebSite, https://schema.org/SoftwareApplication, https://schema.org/Offer) for what is allowed, Google's structured data guides (https://developers.google.com/search/docs/appearance/structured-data/organization, https://developers.google.com/search/docs/appearance/structured-data/software-app) for what is required or recommended.
3. **Icons**, generated from `docs/brand` (byte copies of `todz-loop/brand`) and committed under `apps/api/public`: `favicon.ico` (16, 32, 48, each cropped to the squircle, no transparent margin), `icon.svg` with a dark-scheme rule, `apple-touch-icon.png` (180×180, the brand gradient full-bleed with the mark at about 80 %, like the maskable icons), `icon-192.png`, `icon-512.png`, `icon-maskable-192.png`, `icon-maskable-512.png`. A committed lock of SHA-256 hashes of the generator's inputs proves the outputs current without a browser in the gate.
4. **`site.webmanifest`**: `name` `todz`, `short_name` `todz`, `description`, `start_url` `/`, `scope` `/`, `display` `browser`, `background_color` and `theme_color` `#070812`, icons 192 and 512 with `purpose` `any` and the maskable pair with `purpose` `maskable`; served as `application/manifest+json`.
5. **Open Graph image**: `og/todz.png`, 1200×630 PNG, the owner's lockup render (`docs/brand/todz-lockup.png`) above a real app shot from `apps/api/public/landing`, on the dark theme colour, under 600 KB.
6. **GEO**:
   - `robots.txt`: `User-agent: *` `Allow: /`, a group per named crawler (`Googlebot`, `Bingbot`, `GPTBot`, `OAI-SearchBot`, `ChatGPT-User`, `ClaudeBot`, `Claude-SearchBot`, `Claude-User`, `PerplexityBot`, `Perplexity-User`, `Google-Extended`, `Applebot-Extended`) with `Allow: /`, and `Sitemap: https://todz.app/sitemap.xml` and `Sitemap: https://docs.todz.app/sitemap.xml`.
   - `sitemap.xml`: `https://todz.app/` and `https://todz.app/self-host`.
   - `llms.txt` (llmstxt.org): `# todz`; `> ` one-sentence summary; facts: what todz is, status (in development, macOS app coming soon, waitlist open), pricing (not announced; joining the waitlist is free), publisher (Logic Bit, Brazil); `## Connect an agent` with the exact `claude mcp add --transport http todz 'https://api.todz.app/mcp' --header 'Authorization: Bearer <key>'` line and where the key comes from (**Connect an Agent** in the app, one key per project); `## MCP tools`, one line per `McpToolName` with its `MCP_COPY.tools` text; `## Docs` (`https://docs.todz.app` Introduction, Quickstart, Connect an agent, MCP tools, Self-host); `## Optional` (the self-host guide on todz.app, `llms-full.txt`).
   - `llms-full.txt`: `llms.txt`'s content with the Codex and Cursor setups in full (as `AgentCommand.swift` builds them, `<key>` in place of the key) and each tool's parameters from `MCP_COPY.fields`.
   - The landing's visible copy stays; the facts above are the crisp, quotable statements, written once in a copy module the three files and the overview tool share.
7. **WebMCP** on the landing (ADR 0060 § 5): `get_todz_overview`, `get_mcp_setup`, `open_docs` (`readOnlyHint`) and `join_waitlist` (`consequentialHint`), registered on `document.modelContext`, else `navigator.modelContext`, only when one exists.
8. **MCP server card** (ADR 0060 § 4) at `https://api.todz.app/mcp/server-card` and `https://todz.app/.well-known/mcp/server-card.json` (same bytes), and the ARD catalog at `https://todz.app/.well-known/ard.json`.
9. **CSP stays strict**: `script-src` lists the hashes of the page script, the JSON-LD block and the WebMCP script (and the Turnstile origin, as today, when the widget is on); `manifest-src 'self'` is added; nothing else widens. Site pages send `Cache-Control: no-cache, no-transform`.
10. **Scores**: Lighthouse 13.6.0, mobile, the median of three runs, on `wrangler dev` before the PR and on production after the deploy, numbers recorded in the test plan and the run log. Acceptance is on production: SEO, Best Practices and Accessibility 100, Performance ≥ 95, and every Agentic browsing audit on the landing green. A production Performance under 95 opens the follow-up fix PR `fix/landing-performance` (plan step 26) instead of holding this one.
11. **Landing shots as WebP** at their displayed widths, generated with the icons, so the page's image bytes shrink whatever the trace says.

## Non-goals

- A redesign or new visible copy on the landing; visible changes are limited to the tab icon and what a fix for a Lighthouse failure needs, each named in the PR's visual explainer.
- WebMCP on `/self-host` or the admin.
- The Chrome origin trial token for WebMCP: an owner step (Blockers), a follow-up adds the token.
- `docs.todz.app`'s own SEO, sitemap and `llms.txt` (Mintlify generates them; `docs-mintlify`).
- The `/self-host` redirect and its removal from the sitemap (`docs-cutover`).
- `robots.txt` or discovery files on `api.todz.app` other than the server card.
- Analytics; Core Web Vitals budgets beyond this page's Lighthouse targets (`performance`).
- An `ETag` or rate limit on the server card: fixed public bytes behind Cloudflare's cache with `max-age=3600`.

## Design

### Data flow

```
LANDING_COPY ─┐
MCP_COPY ─────┤                      ┌─▶ <head> tags + JSON-LD (hash → CSP) ──▶ GET / , /self-host
COMPANY ──────┼─▶ site discovery ────┼─▶ robots.txt, sitemap.xml, llms.txt, llms-full.txt, site.webmanifest
agent setup ──┤   copy (one source)  ├─▶ /.well-known/ard.json ──▶ card URL
SITE URLs ────┘                      ├─▶ server card ──▶ api.todz.app/mcp/server-card
                                     │                └▶ todz.app/.well-known/mcp/server-card.json
                                     └─▶ WebMCP script (hash → CSP) ──▶ document.modelContext.registerTool × 4

join_waitlist(email) ─▶ #join-email.value ─▶ form.requestSubmit() ─▶ page submit handler waits for the Turnstile token
   ─▶ POST /join (email, cf-turnstile-response) ─▶ unchanged: limits, siteverify, alike answer ─▶ 303 /#join notice

docs/brand/*.svg, todz-lockup.png, public/landing/*.png ─▶ pnpm site:assets (Playwright Chromium) ─▶ apps/api/public/{favicon.ico, icon*.png, icon.svg, apple-touch-icon.png, og/todz.png, landing/**/*.webp}
                                                       └▶ site-assets.lock.json (SHA-256 of every input) ◀── site:assets:check (no browser)
```

### Interfaces

- `apps/api/src/site/site-urls.ts`: `SITE_URL` `https://todz.app`, `MCP_URL` `https://api.todz.app/mcp`, `DOCS_URL` `https://docs.todz.app`, an enum of discovery paths. Pinned by a test.
- `apps/api/src/site/site-icons.ts`: each icon's path, pixel size, type and purpose, and the Open Graph image's path, size and alt. Shared by the head, the manifest, the card and the asset script.
- `SiteDocument` becomes a union discriminated by `kind`: `SitePageKind.Public` with `path` and `structuredData`, `SitePageKind.Private` with neither. Its `script: string | null` becomes `scripts: string[]`, written in list order, the text between each pair of tags being exactly the string hashed; `siteContentSecurityPolicy`'s `script: string | null` becomes the same `scripts: string[]`, and it adds `manifest-src 'self'`. `admin-page.ts` and `admin-link-page.ts` move to the list shape and pass `kind: SitePageKind.Private`, and change nothing else.
- `discovery-copy.ts` holds one docs page list (slug, title, path); `open_docs`'s enum and `llms.txt`'s docs links both read it; once `apps/docs` is on `main`, a shape test pins it to the `apps/docs/*.mdx` pages (`introduction` ↔ `index.mdx`).
- Site routes (GET and HEAD): `/robots.txt` `text/plain; charset=utf-8`; `/sitemap.xml` `application/xml; charset=utf-8`; `/llms.txt` and `/llms-full.txt` `text/plain; charset=utf-8` (Markdown inside, shown inline by every browser); `/site.webmanifest` `application/manifest+json`; `/.well-known/ard.json` `application/json`; `/.well-known/mcp/server-card.json` `application/mcp-server-card+json`. API route: `GET /mcp/server-card` with the same card.
- Card and catalog headers: `Access-Control-Allow-Origin: *`, `Access-Control-Allow-Methods: GET`, `Cache-Control: public, max-age=3600`. Text files: `Cache-Control: public, max-age=3600`.
- WebMCP tool schemas: `type: "object"`, named `properties`, `required`, `additionalProperties: false`; `get_todz_overview` takes `{}`; outputs are text.
- `pnpm --filter @todz/api site:assets` and `site:assets:check`.

### Failure handling

- No `modelContext`: the script returns before touching anything; no console output.
- `registerTool` rejects (a name taken, a schema refused): the rejection is caught per tool and the others still register; no console error.
- `join_waitlist` while the form is already submitting (its button `aria-disabled="true"`): the tool answers "already submitting" and does nothing. With an address the field's validity refuses: it answers "invalid" and submits nothing. With no Turnstile site key: the form posts and the page shows "The waitlist opens soon." as for a person. The widget asking for interaction: the person solves it; the tool already answered.
- `open_docs` with a page outside the enum: refused by the schema; the script answers that the page is unknown.
- A discovery route on the API host: 404 as today, except `/mcp/server-card`.
- A stale icon or Open Graph image: `site:assets:check` fails the unit gate with the regenerate command.
- Cloudflare prepending its managed content-signals block to `robots.txt`: comments only, so the file stays valid; the deploy run reads it. If the preamble carries directives (`User-agent`, `Disallow`, `Content-Signal`), or the analytics beacon survives `no-transform`, the zone's managed `robots.txt`, content signals and Web Analytics automatic setup are turned off: by the loop through `scripts/todz-cloudflare.sh` when its allowlist and the token's permission cover the setting, otherwise as an owner step (runbook step 16).

## Open questions → answers

| Question | Options | Owner's answer | Date |
|----------|---------|----------------|------|
| `navigator.modelContext`, as written, or the draft's `document.modelContext`? | navigator; document; both | the loop's call: `document` first, `navigator` as a fallback (ADR 0060 § 5) | 2026-11-25 |
| Where is the server card? | `/.well-known/mcp/server-card.json`; SEP-2127's `/mcp/server-card` | the loop's call: both, same bytes, plus ARD (ADR 0060 § 4) | 2026-11-25 |
| What does the `SoftwareApplication` offer say while pricing is unknown? | omit; price 0 for the waitlist; invent a price | the loop's call: the free waitlist (`0` `USD`, `PreOrder`); it changes with the pricing copy | 2026-11-25 |
| Category "Productivity" is not in Google's list | `ProductivityApplication`; `BusinessApplication` + subcategory | the loop's call: `BusinessApplication` with `applicationSubCategory` `Productivity` | 2026-11-25 |
| The SVG favicon's dark variant | same icon; a lifted gradient | the loop's call: the gradient lifted to `#6F89FF` → `#3446C8` under `prefers-color-scheme: dark`, the check and spark unchanged | 2026-11-25 |
| `display` in the manifest | `standalone`; `browser` | the loop's call: `browser`, the landing is not an app to install | 2026-11-25 |
| Cloudflare's analytics beacon | allow it in the CSP; stop the injection | the loop's call: `no-transform` (ADR 0060 § 7) | 2026-11-25 |
| The beacon survives `no-transform`, or the managed `robots.txt` adds directives | live with it; turn the zone settings off | the loop's call: off, through the wrapper when it can, else an owner step (ADR 0060 § 7) | 2026-11-25 |
| The touch icon's look | transparent corners like the favicon; full-bleed | the loop's call: full-bleed gradient, mark at about 80 % | 2026-11-25 |
| `Organization.logo` | none; todz's icon; Logic Bit's own | the loop's call: Logic Bit's own 180 PNG, as `COMPANY.logo` | 2026-11-25 |
| What decides "done" for the scores | local; production | the loop's call: production, median of three; under 95 Performance → `fix/landing-performance` | 2026-11-25 |

## Test strategy summary

Unit (workers project): the head tags of both pages, the JSON-LD shapes and references, the CSP hashes and `manifest-src`, every discovery file's exact body and headers, the card against SEP-2127's rules and the catalog against ARD's, the WebMCP tool definitions against the copy, no inline handler anywhere. Unit (node project): every generated asset's format and size, the ICO directory, the maskable safe zone, `site:assets:check`. Repository shape: the agent setup commands match `AgentCommand.swift`. E2E (desktop and mobile): the icons, manifest and image answer; zero console errors and CSP violations in both schemes; every image at its natural ratio; the four WebMCP tools through a recording `modelContext` stub, `join_waitlist` reaching the joined notice through the Turnstile stub and `POST /join` with the token. Lighthouse locally and on production. Details in `test-plan.md`.
