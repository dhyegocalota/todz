# Tester briefing: Landing digest

Branch `feat/landing-digest`. Commits in order: red `b409645` / green `a480c1c` (facts query), red `83313a1` / green `38b4aa2` (mail and templates), red `ea11368` / green `be2d534` (scheduled run), red `c9396c7` / green `491c603` (cron trigger).

## What changed

- `apps/api/src/site/admin-store.ts`: `waitlistDigestFacts({ database, since, until })`, `DIGEST_ADDRESSES_MAX = 50`, the `WaitlistDigestFacts` type. Two statements in one `database.batch`: the counts (`joined`, `total`, `failed_confirmations`) and the newest-first addresses, sharing the panel's `ORDER BY joined_at DESC, rowid DESC` fragment (`NEWEST_FIRST`).
- `apps/api/src/site/waitlist-digest.ts`: `DigestCron`, `DigestMissingPiece`, the record `RUN_OF_CRON`, `runScheduled({ controller, env })`.
- `apps/api/src/index.ts`: the default export gains `scheduled`.
- Mail: `src/emails/waitlist-digest-mail.ts`, five new `EmailSlot` members, an optional `subject` on `filledEmailOf`, templates `WaitlistDigest` and `WaitlistDigestEmpty` (`scripts/emails/waitlist-digest-template.ts`, `waitlist-digest-email-copy.ts`), `generated-emails.ts`, the preview values in `cli.ts`, the regenerated `src/emails/generated/email-templates.ts`.
- `apps/api/wrangler.jsonc`: `"triggers": { "crons": ["0 11 * * *"] }`.
- `tools/repository-shape/src/api-source.test.ts`: `triggers` type, the cron pin, the `DigestCron` against `wrangler.jsonc` check.

## How to run

- `pnpm --filter @todz/api typecheck`
- `pnpm --filter @todz/api exec vitest run test/admin-store.test.ts test/waitlist-digest-mail.test.ts test/waitlist-digest.test.ts test/emails`
- `pnpm --filter @todz/api emails:check`
- `pnpm --filter @todz/repository-shape test:unit`
- Whole API suite: `pnpm --filter @todz/api exec vitest run` (63 files, 1621 tests, green at `491c603`).
- Local scheduled check (R9, not run by the developer): `pnpm --filter @todz/api exec wrangler dev --test-scheduled` with the dev site variables on its own port and a console sender, then `curl "http://localhost:<port>/__scheduled?cron=0+11+*+*+*"`. Whether that route answers ahead of the assets is the tester's to prove; the console sender line carries `to` and the text of the digest.

## Red tests and their printed failure

| Test | Red failure text | Green |
|------|------------------|-------|
| `admin-store.test.ts` > the waitlist digest facts (6 cases) | `Error: waitlistDigestFacts is not implemented` | `a480c1c` |
| `emails/waitlist-digest-email.test.ts` (10 failing of 11 on the digest and empty template, 19 of 20 with the mail tests) | `AssertionError: expected '' to be 'Your todz waitlist: {{joined}} new'`, `expected '' to be 'Your todz waitlist: no one new'`, `expected '' to contain '{{addresses}}'`, `expected '' to contain '{{total}} on the list in all.'`, `expected '' to contain 'Failed confirmations: {{failed}}.'`, `expected '' to contain 'Open the admin'`, `expected '' to match /<a [^>]*href="\{\{link\}\}"...` | `38b4aa2` |
| `waitlist-digest-mail.test.ts` (9 cases) | `Error: waitlistDigestMail is not implemented` | `38b4aa2` |
| `waitlist-digest.test.ts` (13 cases) | `AssertionError: expected [Function] to throw error including 'admin_email' but got 'runScheduled is not implemented'` (likewise for `site_origin`, `email_sender`, the unknown cron, `the directory is down`, `the mail service is down`) and `Error: runScheduled is not implemented` | `be2d534` |
| `api-source.test.ts` > triggers the waitlist digest | `AssertionError: expected undefined to deeply equal { crons: [ '0 11 * * *' ] }` | `491c603` |
| `api-source.test.ts` > the digest cron the worker runs | `TypeError: Cannot read properties of undefined (reading 'crons')` | `491c603` |

Pins (green when they landed): `email-slot.test.ts` slot list (the new enum members landed with the red stub so types stay green), and the empty template's "holds no slot for joins, addresses or more" case (an empty stub holds no slot).

## Deviations to know

- The red stub of step 2 is an empty `{ subject: '', html: '', text: '' }` template, not a throwing one: a throwing generator would turn every existing template test red.
- R5 says three reads in one batch; the batch holds two statements, the counts (window joins, total, window failures in one `SELECT`) and the addresses.
- R11 passes an execution context to `worker.scheduled`; the handler is declared with two parameters, so TypeScript rejects a third argument and the tests call `worker.scheduled(controller, env)` without `waitOnExecutionContext`. The handler awaits the run itself and uses no `waitUntil`.
- If `SITE_ORIGIN` is unusable the sender cannot be built either, so the error lists `site_origin, email_sender`.

## Hypotheses for the tester

- A cron fire at 11:00 UTC sends exactly one mail to `ADMIN_EMAIL` from `noreply@todz.app`, subject `Your todz waitlist: N new` or `Your todz waitlist: no one new`.
- A join exactly at `scheduledTime` is in that day's digest, a join exactly at `scheduledTime - 24 h` is in the previous one, so consecutive digests neither overlap nor gap; the total counts rows up to `scheduledTime`.
- A confirmation failure recorded in the window is counted even when the join was earlier.
- Fifty addresses show with no "and N more"; fifty-one show fifty and "and 1 more.".
- An address with `'` or `&` shows escaped in the html and raw in the text; the addresses keep one per line.
- The button opens `<SITE_ORIGIN>/admin`; the lockup loads from `<SITE_ORIGIN>/brand/todz-lockup.png`.
- A missing or invalid `ADMIN_EMAIL`, an unusable `SITE_ORIGIN`, no mail binding or `EMAIL_SENDER=console` with `SITE_ORIGIN=https://todz.app` fails the invocation with `the waitlist digest is missing <pieces>`, never an address, sends nothing and logs nothing.
- An unknown cron string fails the invocation; a D1 or send error fails it too.
- R7: how to stop the cron (`crons: []` and deploy; `wrangler rollback` keeps the schedule) is the tester's to prove.

## Gaps

- No end-to-end run through a real Workers runtime cron or the Cloudflare Email Service; only the Workers test pool with a recording binding.
- The preview (`pnpm --filter @todz/api exec tsx scripts/emails/cli.ts preview`) writes `.pr-media/emails/waitlist-digest*.html`; no screenshot of the mail was taken.
- The runbook, the self-host guide and the README are the lead's.
