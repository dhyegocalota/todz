# Tester briefing: Day email

Written by the developer sub-agents when their steps are done, each in its own section. The developers do not run `test-plan.md` and do not declare the feature works; every "it works" below is a hypothesis for the tester.

## Server — mail out

Lane `out`, Steps 1–8 and 16 of the plan, branch `lane/day-email-out`. Commits in order:

| Hash | Subject |
|------|---------|
| `0a1b732` | test(day-email): red tests for the owner's day email setting and the own-domain refusal |
| `4556592` | feat(day-email): store the day email setting on the owner and refuse todz.app addresses |
| `8c54537` | test(day-email): red tests for the day mail and the reply-to and headers of every mail |
| `e0a27ff` | feat(day-email): render the day mail with its reply-to and auto-submitted header |
| `8e7e5f8` | test(day-email): red tests for the quarter-hour cron that mails each owner's day |
| `98baa3e` | feat(day-email): mail each owner's Today once a day from the quarter-hour cron |
| `a0b3a38` | fix(day-email): keep the self-host reply-to constant and log the run through one module |
| `fa8a333` | test(day-email): red shape tests for the two crons and Workers Logs without invocation logs |
| `1dd48f6` | feat(day-email): trigger the quarter-hour cron and keep Workers Logs without invocation logs |
| `43f58e8` | test(day-email): pin the directory and project work of a day email tick (pin) |

### What changed

- `libs/types/src/constants.ts`: a `DAY_EMAIL_*` block (default and last minute, catch-up, sends per tick, projects per owner, lines, retention, reply address lifetime), pinned in `constants.test.ts`.
- `apps/api/migrations/0008_day_email.sql`: `owners.day_email`, `owners.day_email_minutes`, `day_emails`, `day_email_reply_addresses`, `day_email_replies`, with the checks and indexes of the spec. `test/worker.test.ts` lists fourteen directory tables now.
- Owner API: `directory-owners.ts` (`storeOwnerChanges` takes both fields and, in the same batch, deletes the owner's reply addresses on `day_email: false`), `owner-account.ts` (the schema, at least one of four fields), `owner-json.ts`, `owner-records.ts`, `owner-sign-in.ts` (the defaults of a new owner).
- `isOwnDomainAddress` in `email-address.ts`, used by `sign-in-links.ts` and `site/waitlist-join.ts`. The refusal answers what an invalid address already answers: 400 `invalid_request` on the link request, the try-again page (429, `Retry-After`) on the join, before Turnstile and the limiters of the join. This is my reading of "their usual generic answers"; say so if the owner meant 202 and the joined page.
- Mail: `EmailMessage.replyTo` required and `headers` optional; `filledEmailOf` defaults `replyTo` to `REPLY_TO_ADDRESS` (still declared in `email-sender.ts`, where the self-host guide names it); Cloudflare sender passes both; console sender logs `{to, replyTo, text}`; slots `{{count}}`, `{{tasks}}`, `{{workspace}}`, `{{time}}`; `scripts/emails/day-email-{copy,template}.ts`; `src/emails/day-mail{,-copy}.ts`; the generated module regenerated.
- `src/scheduled.ts`: `ScheduledCron` (`0 11 * * *` digest, `*/15 * * * *` day email), `RUN_OF_CRON`, `runScheduled`. `DigestCron` is gone; `waitlist-digest.ts` exports `runWaitlistDigest` and uses the new shared `emailSenderForOrigin` of `email-sender.ts`.
- `src/day-email/`: `day-email-due.ts` (the window), `day-email-store.ts` (candidates, claim, mark, prune, reply address), `day-email-today.ts` (`listTasks` per project), `day-email-reply-address.ts` (issues `reply+<32 hex>@todz.app`, stores the digest), `day-email-run.ts` (the run), `day-email-log.ts` (the only module that logs; a `DayEmailEvent` enum).
- `project-routing.ts`: `ScheduledOwner` (WeakSet-branded), `listDayEmailCandidates`, `listScheduledWorkspaces`. `credential-secret.ts`: `generateReplySecret`.
- `wrangler.jsonc`: the second cron and `observability: { enabled: true, logs: { invocation_logs: false } }`.
- Pinned in `tools/repository-shape/src/api-source.test.ts`: both crons, each `ScheduledCron` value equal to one trigger, the observability block, and `day-email-log.ts` as the second file that names `console`.
- Budget rows (Step 16): `DAY_EMAIL_TICK_BUDGET` and `DAY_EMAIL_OWNER_BUDGET` in `test/budgets/budget-limits.ts`, used in `work-budgets.test.ts`. The reply's add row belongs to the reply lane.

### How to run

```bash
pnpm install --frozen-lockfile
pnpm verify
pnpm --filter @todz/api test:unit
pnpm --filter @todz/api exec vitest run --project workers test/day-email test/scheduled.test.ts
pnpm --filter @todz/api exec vitest run --project workers test/budgets
pnpm exec vitest run --root tools/repository-shape src/api-source.test.ts
pnpm --filter @todz/api emails:check
```

`pnpm verify` printed `verify: 8 gates green at 43f58e8 (product)`.

Local stack (a hypothesis, I did not walk it): `pnpm --filter @todz/api dev:email` signs in with email links and mails through the console sender. A fake-provider owner has no `email` identity and is never due, so sign in by link (the console prints it), then `PATCH /owner` with `{"day_email": true, "day_email_minutes": <local minute now>}` and a bearer session token, create a workspace, and run `curl "http://localhost:8787/cdn-cgi/handler/scheduled?cron=*/15+*+*+*+*&time=<ms>"` with the time inside the window. The console sender then prints one line with `to`, `replyTo` and `text`. Whether `wrangler dev` 4.167.0 serves that route without `--test-scheduled` is untested.

### Red today, green after

Failure text as the red run printed it (`pnpm exec vitest run` in `apps/api`, or in `tools/repository-shape`):

| Test | Red commit | Printed |
|------|-----------|---------|
| `owner-day-email.test.ts` (seeds, columns, PATCH) | `0a1b732` | `D1_ERROR: no such column: day_email: SQLITE_ERROR`; `expected [Function] to throw error matching /CHECK constraint failed/ but got 'D1_ERROR: no such column: day_email: …'`; `D1_ERROR: no such table: day_email_reply_addresses: SQLITE_ERROR`; `AssertionError: expected 400 to be 200` (a PATCH with `day_email` alone) |
| `owner-sign-in.test.ts`, `owner-day-email.test.ts` (answers) | `0a1b732` | `AssertionError: expected { owner: { …(3) } } to deeply equal { owner: { …(5) } }` |
| `owner-json.test.ts` | `0a1b732` | `AssertionError: expected { id: 'owner-1', …(2) } to deeply equal { id: 'owner-1', …(4) }` |
| `sign-in-links.test.ts` (`x@todz.app`, `X@TODZ.APP`, `reply+abc@todz.app`, `hello+1@todz.app`) | `0a1b732` | `AssertionError: expected 202 to be 400` |
| `waitlist-join.test.ts` (same four) | `0a1b732` | `AssertionError: expected 200 to be 429` |
| `email-address.test.ts` (`isOwnDomainAddress`) | `0a1b732` | `Error: isOwnDomainAddress is not implemented for x@todz.app` |
| `day-mail.test.ts` (16 tests) | `8c54537` | `Error: dayMail is not implemented for maria@example.com` |
| `mail-reply-to.test.ts` (five builders) | `8c54537` | `AssertionError: expected undefined to be 'hello@todz.app'` |
| `email-sender.test.ts` | `8c54537` | `AssertionError: expected [ 'hello@todz.app' ] to deeply equal [ Array(1) ]`; `AssertionError: expected [ undefined ] to deeply equal [ Array(1) ]`; `AssertionError: expected [ { to: 'maria@example.com', …(1) } ] to deeply equal [ { to: 'maria@example.com', …(2) } ]` |
| `email-slot.test.ts` | `8c54537` | `AssertionError: expected [ '{{link}}', '{{email}}', …(6) ] to deeply equal [ '{{link}}', '{{email}}', …(10) ]` |
| `day-email-run.test.ts` (30 tests), `scheduled.test.ts` (day email cron) | `8e7e5f8` | `Error: runDayEmails is not implemented at <scheduledTime>` |
| `day-email-run.test.ts` (rejection and missing sender tests) | `8e7e5f8` | `AssertionError: expected [Function] to throw error including 'the day email failed for 1 owner' but got 'runDayEmails is not implemented at 17…'`; `… including 'email_sender' but got 'runDayEmails is not implemented at 17…'` |
| `scheduled-owner.test.ts` | `8e7e5f8` | `Error: listDayEmailCandidates is not implemented for object`; `Error: listScheduledWorkspaces is not implemented for <owner id>` |
| `api-source.test.ts` (crons, dispatch, observability) | `fa8a333` | `AssertionError: expected { crons: [ '0 11 * * *' ] } to deeply equal { crons: [ '0 11 * * *', …(1) ] }`; `AssertionError: expected [ '*/15 * * * *', '0 11 * * *' ] to deeply equal [ '0 11 * * *' ]`; `AssertionError: expected undefined to deeply equal { enabled: true, logs: { …(1) } }` |

Pins (green when they landed): `constants.test.ts` day email block, the Cloudflare sender passing the reply-to `hello@todz.app`, the digest tests moved to `ScheduledCron`, an unknown cron rejecting, the digest cron sending no day mail, the `todz.app.example` cases of the sign-in link and the join, and the budget rows of `43f58e8`. `generateReplySecret` (`credential-secret.test.ts`) was written beside its implementation in `98baa3e`, not red first.

### Hypotheses for the tester

- A migrated owner reads `day_email: false`, `day_email_minutes: 420`; the columns refuse 2, -1 and 1440; `GET /owner`, `PATCH /owner` and sign-in answer five fields; a partial PATCH leaves the others alone; the invalid bodies answer 400 and store nothing; `PATCH {day_email: false}` deletes only that owner's reply addresses.
- `x@todz.app`, `X@TODZ.APP`, `reply+abc@todz.app` and `hello+1@todz.app` send no sign-in mail, store no link and add no waitlist row; `x@todz.app.example` is handled as before.
- With the flag on, one `email` identity and a workspace, an owner gets exactly one mail on a local date inside `[chosen, chosen + 180)` minutes, at the tick that first sees them due, and never a second one for the same date, under sequential and concurrent ticks.
- The zone cases of `day-email-run.test.ts` (Sao Paulo, Kolkata, midnight, both New York DST days, an unresolvable zone) hold with the real Intl of workerd.
- The mail lists open tasks due today or overdue across every workspace in the directory's order, `Workspace / Project` only with more than one workspace, at most 20 lines then `and N more.`, subject `Your day: N due` or `Your day: nothing due`; titles are escaped in the HTML and literal in the text; `reply-to` is `reply+<32 hex>@todz.app`; `Auto-Submitted: auto-generated` is set on the message.
- Each send leaves one `day_emails` row: `sent_at`, or `failed_at` with `read_failed`, `too_many_projects` or `send_failed`; a failed owner does not stop the others; the run rejects with `the day email failed for N owner(s)` and no id or address; no sender configured claims nothing and rejects naming `email_sender`.
- The reply address digest is stored for seven days from the tick and the secret is stored nowhere; rows older than 30 days and expired addresses are pruned on a tick.
- The run's one log line is `{event, due, sent, failed}` and carries no address; invocation logs are off in `wrangler.jsonc`. Whether Cloudflare really drops `rcptTo` and `mailFrom` with that block is Step 15 and 23, not covered here.

### Gaps and merge notes

- Not mine, left out: the `email` export, `ReplyOwner`, `openReplyInbox`, `DAY_EMAIL_REPLY_LIMITER`, Steps 9–15 and the reply's budget row.
- The reply address local part and domain are private constants of `day-email-reply-address.ts`; the reply lane's recipient parser will name them too, so the lead may share one.
- `day-email-log.ts` is the only module of the lane that names `console`; the reply lane should log through it (its `DayEmailEvent` needs a `Reply` member) or the shape test that names the console files needs its own line.
- Merge points with `in-pure`: `libs/types/src/constants.ts` (my block follows `ADMIN_GLOBAL_RATE_LIMIT_MAX`), `libs/types/src/constants.test.ts` (imports and a final `describe`).
- `AGENTS.md`'s shared helpers line may name `isOwnDomainAddress` (`apps/api/src/email-address.ts`) and `emailSenderForOrigin` (`apps/api/src/email-sender.ts`); the docs lane decides. The self-host guide is untouched.
- The failing-owner tests use a binding that throws for one address; they do not exercise a D1 outage in the middle of a run (the claim, the mark and the prune are not covered by a failure test).
