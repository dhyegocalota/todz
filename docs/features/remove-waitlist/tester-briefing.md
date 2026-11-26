# Tester briefing: Remove waitlist

Written by the developer. The developer does not run `test-plan.md` and does not declare the feature works.

## What changed

- `apps/api/src/site/site-endpoint.ts`, `site-shell.ts` — the join route and its path constant are gone, so `/join` falls through to the 404.
- `apps/api/src/site/admin-routes.ts`, `admin-answer.ts`, `admin-page.ts`, `admin-store.ts`, `admin-copy.ts`, `admin-paths.ts`, `admin-metrics.ts` — no list, no export, no failed confirmations; `GET /admin` redirects a signed-in owner to the metrics; `AdminNotice` lives in `admin-notice.ts`.
- `apps/api/src/emails`, `apps/api/scripts/emails`, `email-slot.ts`, `generated/email-templates.ts` — the confirmation and digest mails and their slots are gone; the templates were regenerated.
- `apps/api/wrangler.jsonc`, `src/env.ts`, `src/turnstile.ts`, `libs/types/src/constants.ts` — three limiters, their constants, the Turnstile action and the join cap are gone; the remaining limiters take `8604` to `8615`.
- `apps/api/migrations/0014_drop_waitlist.sql` — drops the index and the table.
- `docs/runbooks/deploy-the-api.md` step 6 — the one-time export before the migration; `production-smoke-walk.md` steps 6, 12, 13 and 16.
- `docs/adr/0097-…`, the status lines of 0049, 0050, 0051, 0052, 0060, 0061, 0067, 0073 and the ADR index.

## How to run

```bash
pnpm --filter @todz/api exec vitest run test/waitlist-removed.test.ts
pnpm --filter @todz/repository-shape exec vitest run src/waitlist-removed.test.ts src/api-source.test.ts
pnpm verify
```

## Red today, green after

| Test | Red before the change because | Green after because |
|------|--------------------------------|---------------------|
| `apps/api/test/waitlist-removed.test.ts::the join route` | `expected 303 to be 404` for GET and `expected 410 to be 404` for POST | the route is deleted |
| `…::GET /admin sends a signed-in owner to the metrics` | `expected 200 to be 303` | the panel path redirects |
| `…::GET /admin/export.csv answers 404 even with a session` | `expected 200 to be 404` | the export route is deleted |
| `…::the metrics page keeps working and names no waitlist` | the page matched `/waitlist/` through its back link and title | the copy and the link are gone |
| `…::the migration that drops the waitlist` | `no migration named 0014_drop_waitlist.sql` | the migration exists |
| `tools/repository-shape/src/waitlist-removed.test.ts` | 22 failures: the files existed, the sources named the waitlist, the wrangler file held `WAITLIST_*` | the files are deleted and nothing names it |
| `tools/repository-shape/src/api-source.test.ts::the wrangler configuration limits …` | the file still listed three waitlist limiters | the list is fifteen limiters |

## Hypotheses to attack

1. Hypothesis: every admin path outside the removed ones keeps its answer. Break it by: walking sign-in, the mailed link, the session, sign-out and the metrics CSV in a browser, signed in and out.
2. Hypothesis: renumbering the namespaces changes nothing but the counters. Break it by: hitting the admin sign-in limiter on a local stack and reading the three refusals.
3. Hypothesis: nothing else read the `waitlist` table. Break it by: searching the repository for the table name outside the migrations.
4. Hypothesis: the export step is safe to copy and paste. Break it by: running its four lines against a local D1 with `--local` in place of `--remote` and comparing the count with the length.

## Known gaps

- The admin stylesheet still holds the table, badge and empty-card rules the list used; they match no element now. Left for a styling pass, because the page tests pin the stylesheet hash only through the whole string.
- Migration `0014` follows the numbers the lead assigned to `fair-use` (`0012`) and `signin-polish` (`0013`); `main` has a gap until they land.
- The `fair-use` lane's links to "Top usage" from the admin panel will need a home on the metrics page: the panel is now a redirect.
- Production was not touched: the loop's deploy runs the export and the migration.
