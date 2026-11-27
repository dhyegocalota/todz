# Tester briefing: Site languages

Written by the developer sub-agent when its steps are done. The developer does not run `test-plan.md` and does not declare the feature works.

## What changed

- `libs/types/src/language.ts` — the `Language` enum and `LANGUAGE_PROFILES`.
- `apps/api/src/language-negotiation.ts`, `page-preferences.ts` — Accept-Language negotiation, the cookies, the theme.
- `apps/api/src/site/language-paths.ts`, `language-routes.ts`, `site-endpoint.ts` — a URL per language, the first-visit redirect, `POST /language`, `POST /theme`.
- `apps/api/src/site/site-shell.ts`, `site-controls.ts`, `site-style.ts`, `site-switch-script.ts` — the selector, the theme control, hreflang, `data-theme` and `color-scheme` rendered by the server.
- `apps/api/src/site/*`, `oauth/*`, `sign-in-page*.ts`, `day-email/day-email-stop-*` — each page takes its language and theme; the stop page takes the owner's stored language and has no selector.
- `apps/api/scripts/emails/**`, `src/emails/**` — mails generated per language; `migrations/0019_owner_language.sql` and the owner language refresh.
- `*-copy-<language>.ts` — the seven translations of every copy module.

## How to run

```bash
pnpm --filter @todz/api dev:site
# open http://localhost:8788/, /pt-br/, /ja/ and /cloud-queue; send Accept-Language: ja with curl
```

## Red today, green after

| Test | Red before the change because | Green after because |
|------|--------------------------------|---------------------|
| `apps/api/test/site-languages.test.ts` | no negotiation, no `/language`, no `/theme` | the routes, the head and the cookies exist |
| `apps/api/test/copy-completeness.test.ts` | every locale was an English copy | the seven translations landed |
| `apps/api/test/private-pages-language.test.ts` | private pages were English only | they take the cookie, then Accept-Language |
| `apps/api/e2e/site-languages.spec.ts` | pin: written after the implementation | selector, theme and first visit in a browser |

## Hypotheses to attack

1. Hypothesis: `POST /language` and `POST /theme` cannot redirect off the host. Break it by: `return` of `//evil.example`, `/\evil.example`, `https://evil.example`, `javascript:`, an encoded slash.
2. Hypothesis: a crawler is never redirected. Break it by: unusual crawler user agents, a request with no user agent and `Accept-Language: ja`.
3. Hypothesis: the stop token never appears in the stop page. Break it by: the page source of GET, POST and the gone page.
4. Hypothesis: the first paint is right with no script. Break it by: JavaScript off, a dark cookie on a light system and the reverse.
5. Hypothesis: an owner's language changes at most once per change. Break it by: alternating `Accept-Language` on authenticated requests and counting updates.
6. Hypothesis: every mail kind is sent in the right language. Break it by: an app sign-in with `Accept-Language: ko`, an admin and an OAuth sign-in with the cookie set.

## Known gaps

- The cloud-queue invite, warning, fallback and digest mails and the fair-use API messages stay English by decision.
- `llms.txt`, `index.md`, MCP and WebMCP stay English.
- The header controls wrap on very narrow widths rather than collapsing.
