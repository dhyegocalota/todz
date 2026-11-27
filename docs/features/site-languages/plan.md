# Plan: Site languages

**Spec:** spec.md
**Tier:** 🔴
**Seam:** the site shell (`site-shell.ts`), the site router (`site-endpoint.ts`), the page builders of the admin, OAuth, sign-in, cloud queue and day-email stop pages, and the mail generator.
**Assumptions (decided, owner can override):**
- The Markdown landing (`/index.md`), `llms.txt` and the discovery files stay English.
- `fair-use-copy.ts` stays English because it renders in API errors, not on a page.

## File map

| Group | Paths owned | Developer sub-agent |
|-------|-------------|---------------------|
| G1 | `libs/types/src/language*`, `apps/api/src/site/site-language.ts`, `language-routes.ts`, `site-theme.ts`, `site-shell.ts`, `site-style.ts`, `site-endpoint.ts`, `landing-*`, `site-json-ld.ts`, `site-discovery.ts` | `developer-1` |
| G2 | `apps/api/src/site/admin-*`, `cloud-queue-*`, `apps/api/src/oauth/*`, `sign-in-page*`, `day-email/day-email-stop-*` | `developer-2` |
| G3 | `apps/api/src/emails/**`, `apps/api/scripts/emails/**`, `owner-sign-in.ts`, `apps/api/migrations/0019_owner_language.sql` | `developer-3` |

## Sequencing

G1 first (the shell and the language helpers), then G2 and G3 in parallel.

## Steps

- [ ] 1. Feature folder, ADR 0117 and ADR 0118.
- [ ] 2. Red tests: the `Language` enum, negotiation, redirects, `POST /language`, `POST /theme`, hreflang, sitemap, page language of the private pages, mail language, migration 0019, copy completeness.
- [ ] 3. `Language`, `LANGUAGE_PROFILES`, negotiation, the routes, the shell with the selector, the theme control and the hreflang set.
- [ ] 4. Copy modules assembled per language, with the seven per-language files each.
- [ ] 5. Private pages take the page language and the theme.
- [ ] 6. Mails per language, the language of each mail kind and migration 0019.
- [ ] 7. Playwright specs for the selector, the theme with no flash, the alternates and the first visit.

## Failure modes

| Step | What breaks | Signal | Back out |
|------|-------------|--------|----------|
| 3 | A redirect loop between `/` and a prefix | The first-visit test follows more than one redirect | Revert the redirect handler |
| 6 | Migration 0019 fails on the live directory | `emails` tests or sign-in return 500 | Roll the Worker back; the column is additive and harmless |
