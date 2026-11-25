# Tester briefing: day-email

## App

**Changed (`apps/macos/`):** `Owner.dayEmail` and `Owner.dayEmailMinutes` (decoded when present, `nil` otherwise); `OwnerService.updateDayEmail(session:isEnabled:)` and `updateDayEmailMinutes(session:minutes:)` on `PATCH /owner` through `DayEmailBody`; `AppModel+DayEmail.swift` (both values, saving, not saved, notice, the two setters with revert); `AgentNudgeNotice` renamed `OwnerSettingNotice`; the Settings row `Email me my day` after Morning glance; `SettingsCopy` shares the offline and signed-out lines (`ownerSettingOffline`, `ownerSettingSignedOut`, `ownerSettingSubtitle(notice:detail:)`); `DayCloseSchedule.minutesPerHour` became public for the row's placeholder time while the value is unknown.

**Run:** `swift test --package-path apps/macos/TodzKit`; in `apps/macos`, `xcodegen generate` then `xcodebuild -project Todz.xcodeproj -scheme Todz -configuration Debug build`. The developer never launched the app.

**Red today and green after** (red commit `2a63e27`, green `b490496`; run serially, a stub's `fatalError` ends the run, so only the first one hit prints):

| Test | Red text as printed | Green |
|---|---|---|
| `OwnerAPITests/readOwnerDecodesTheDayEmail` (`2a63e27`) | `Expectation failed: owner.dayEmail == true` and `Expectation failed: owner.dayEmailMinutes == storedMinutes` | the two coding keys |
| `OwnerAPITests/updateDayEmailPatchesOnlyTheDayEmail` (`2a63e27`) | `OwnerAPI.swift:159: Fatal error: OwnerAPI.updateDayEmail is not implemented` | the PATCH with `{"day_email":true}` |
| `OwnerAPITests/updateDayEmailMinutesPatchesOnlyTheMinutes` (`2a63e27`) | `OwnerAPI.swift:163: Fatal error: OwnerAPI.updateDayEmailMinutes is not implemented` | the PATCH with `{"day_email_minutes":450}` |
| `AppModelTests` day email tests (`2a63e27`) | `AppModel+DayEmail.swift:3: Fatal error: AppModel.canChangeDayEmail is not implemented` | the model states of design 1.1 |

Pins (green when they landed): `OwnerAPITests/readOwnerOfAServerWithoutTheDayEmailLeavesItUnknown`; the agent nudge tests after the rename.

Result at `d9b1768`: `swift test` 996 tests in 75 suites passed; Debug `xcodebuild` BUILD SUCCEEDED.

**Hypotheses for the tester:**
- With the owner answer `day_email: false`, the row shows the switch off and the time dimmed; turning it on sends exactly `{"day_email":true}` and enables the time.
- Changing the time while on sends exactly `{"day_email_minutes":N}`, N the minute of the day in the model's time zone; the picker shows that minute back.
- While a save is in flight both controls are disabled; a failed save (network, 5xx, 400) puts both values back and the subtitle reads "Your change wasn't saved." until the next change or the window closes.
- Offline with known values: both controls disabled, last values shown, subtitle "Can't reach todz. You can change this when it's back."; signed out: off, 07:00, disabled, "Sign in to change this."
- A server that answers no `day_email` leaves the row unknown and disabled.
- The Settings window grows by one row; no test pins its height.

**Gaps:** no UI test drives the row (the recorder captures it, ADR 0026); the 07:00 placeholder of the unknown state lives in `SettingsView` and is not read from the server's default; the picker's VoiceOver label is not asserted.

## Server — reply parsers

Lane `in-pure`. Pure modules only; no handler, no storage, no `Env`.

### What changed

- `apps/api/package.json`, `pnpm-lock.yaml`: `postal-mime` 4.2.1 as a runtime dependency.
- `apps/api/src/day-email/`: `reply-recipient.ts`, `reply-automatic.ts`, `reply-authentication.ts`, `reply-sender.ts`, `reply-title.ts`, and the shared `reply-headers.ts`.
- `libs/types/src/constants.ts`: `REPLY_SECRET_LENGTH`, `REPLY_ADDRESS_DOMAIN`, `REPLY_ATTRIBUTION_ADDRESS`, in their own block at the end of the file.
- Tests in `apps/api/test/day-email/reply-*.test.ts`; helpers in `apps/api/test/fixtures/day-email/raw-message.ts` (raw MIME built with CRLF, parsed by `postal-mime`, so every case runs over its real header list).

### How to run

`pnpm --filter @todz/api exec vitest run test/day-email` (all five files run in the `workers` project).

### Red today, green after

Red commit `0cdc4db` (stubs throwing `<name> is not implemented`), 111 failing tests, texts as printed:

| File | Failure text as printed |
|---|---|
| `reply-recipient.test.ts` | `Error: replySecretOf is not implemented` |
| `reply-automatic.test.ts` | `Error: isAutomaticReply is not implemented` |
| `reply-authentication.test.ts` | `Error: authenticationOf is not implemented` |
| `reply-sender.test.ts` | `Error: senderOf is not implemented` |
| `reply-title.test.ts` | `Error: replyTitleOf is not implemented` |

Green commit `f143fcf`: 111 passing. One expectation was corrected after the first green run, without weakening a refusal: `From: not-an-address` is `address_invalid` (the parser reads it as a mailbox that fails address normalization), not `mailbox_not_single`.

### Hypotheses for the tester

- `replySecretOf`: only `reply+<32 hex>@todz.app` in any case yields the secret, lowercased; any other shape, padding or suffix yields none.
- `isAutomaticReply`: `Auto-Submitted` other than `no` (parameters after `;` ignored), `X-Autoreply`, `X-Autorespond`, and `Precedence` of `bulk`, `junk`, `list`, `auto_reply` in any case are automatic; nothing else is.
- `authenticationOf` passes only when the first `Authentication-Results` header of the message is the only one whose authserv-id is exactly `mx.cloudflare.net` (case-insensitive), has exactly one `dmarc` result that is `pass` with exactly one `header.from`, and some `dkim=pass` has `header.d` equal to that domain. The tokenizer drops comments and keeps quoted strings whole, so a result smuggled in either is never read. `ARC-Authentication-Results` is never read. A result whose first token is not `method=result` refuses the header (`malformed_service_header`). The verdict is an enum, never header text.
- `senderOf` refuses anything but exactly one `From` header (name trimmed and lowercased, so `From :` counts; a folded continuation line is not a header) holding exactly one mailbox on domain D; it returns the normalized address, and the caller compares it with the owner's identity.
- `replyTitleOf` takes `text` from `postal-mime`, stops at the first paragraph whose joined lines contain `noreply@todz.app` or at the first quote, signature or Outlook rule line, takes the first non-blank line above it, collapses whitespace and cuts at `TASK_TITLE_MAX_LENGTH` code points; control characters (except tab), U+2028 and U+2029 give `invalid_title`.

### Gaps

- Cloudflare's real header shape is unproven (Step 9 spike not run); fixtures follow the documented `mx.cloudflare.net` form with `header.from` and `header.d`. Production walk confirms.
- `format=flowed` unwrap is done by `postal-mime` itself per `text/plain` part, not by `replyTitleOf` (a second unwrap would corrupt plain text). Pinned by `reply-title.test.ts` over parsed messages.
- Wide-character cut counts code points, so a ZWJ emoji sequence at the cut can lose its tail.
- Header size is bounded only by the handler's `rawSize` cap (1 MiB); the tokenizer is linear in the header length.
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
- `isOwnDomainAddress` in `email-address.ts`, used by `sign-in-links.ts` and `site/waitlist-join.ts`. Per the lead (R15) an own-domain address gets the answer any valid address gets (202 `{}` on the link request, the joined page on the join, both after Turnstile and the limiters) and nothing is mailed or stored. Red `d4c9159`, green in the commit after it; it replaces the 400 and try-again answers of `0a1b732` and `4556592`.
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

## Server — reply in

Lane `reply`, Steps 11–15 and the reply row of Step 16, branch `lane/day-email-reply`. Commits in order:

| Hash | Subject |
|------|---------|
| `70fcfc3` | test(day-email): red tests for the reply handler that adds one task from the owner's own authenticated address |
| `917e046` | feat(day-email): a reply from the owner's own authenticated address adds one task to the Inbox |
| `f2d4492` | test(day-email): red shape test for the one per-owner reply limiter |
| `7064f61` | feat(day-email): bind the per-owner reply limiter |
| `c4d0c38` | test(day-email): pin the work budget of a reply (pin) |

### What changed

- `apps/api/src/day-email/day-email-reply.ts`: `handleReply` and the `ReplyOutcome` enum. One function per check of ADR 0064 §3 in its order (recipient, one digest read, per-owner limiter, size, parse, automatic, authentication, identity and sender, addressing, daily maximum, title, Inbox). Every refusal returns an outcome; none calls `setReject`, `forward` or `reply`. Any thrown failure logs `failed` and rejects with `the day email reply failed`, never carrying text from the message or the cause.
- `apps/api/src/day-email/reply-addressing.ts` (new, pure): exactly one `To` header, the recipient named in `To` or `Cc` (groups unwrapped), exactly one non-blank `Message-ID`; verdict enum `AddressingVerdict`.
- `apps/api/src/day-email/reply-recipient.ts`: `replyAddressOf(secret)` beside `replySecretOf`; `day-email-reply-address.ts` now issues the address through it, so the local part (`REPLY_ADDRESS_LOCAL_PART` in `libs/types`) and the domain have one definition.
- `apps/api/src/day-email/day-email-store.ts`: `findReplyAddressOwner` (unexpired digest), `findOwnerEmailIdentities` (zone and `email` identities in one read), `countRepliesSince`, `findFirstInboxId`, `insertReply`.
- `apps/api/src/project-routing.ts`: `ReplyOwner` (WeakSet-branded, made only by `replyOwnerOf`, called by the handler after the addressing check) and `openReplyInbox`, which looks up the first workspace's Inbox itself.
- `apps/api/src/index.ts`: the `email` export; `env.ts`: `DAY_EMAIL_REPLY_LIMITER?: RateLimit`; `day-email-log.ts`: `DayEmailEvent.Reply`; `wrangler.jsonc`: the limiter, namespace 8610, 5 per 60 seconds.
- `libs/types/src/constants.ts`: `REPLY_ADDRESS_LOCAL_PART`, `REPLY_SIZE_MAX_BYTES` (1 MiB), `REPLY_RATE_LIMIT_MAX` (5), `REPLY_RATE_LIMIT_PERIOD_SECONDS` (60), `REPLY_DAILY_MAX` (20), pinned in `constants.test.ts`.
- Budget row: `DAY_EMAIL_REPLY_BUDGET` (5 round trips, 5 statements, 1 project call) in `test/budgets/budget-limits.ts`, used in `work-budgets.test.ts`, plus a row for a stranger's address (one read, no project call).
- Order of work on an accepted reply: the add runs first (idempotent through `mail:` and the digest of the `Message-ID`), then the `day_email_replies` row is inserted `ON CONFLICT DO NOTHING`. A project store that throws leaves no row, and a redelivery adds once.

### How to run

```bash
pnpm --filter @todz/api exec vitest run --project workers test/day-email test/budgets
pnpm exec vitest run --root tools/repository-shape src/api-source.test.ts
pnpm verify
pnpm security:audit
```

Posting a fixture by hand: start `pnpm --filter @todz/api dev:email` (add `--test-scheduled` is not needed for mail), seed an owner with one `email` identity, a workspace with its Inbox and a `day_email_reply_addresses` row whose digest is the SHA-256 of a 32-hex secret, then `curl -X POST "http://localhost:8787/cdn-cgi/handler/email?from=<envelope>&to=reply%2B<secret>%40todz.app" --data-binary @reply.eml`. The fixture must carry its own `Authentication-Results: mx.cloudflare.net; … dkim=pass header.d=<domain> … dmarc=pass header.from=<domain>` line, a `From` of the owner's identity, a `To` naming the reply address and one `Message-ID`; local Email Routing adds no header. `Worker successfully processed email` with a `day_email_reply` log line `{"event":"day_email_reply","outcome":"added"}` is the happy answer.

`pnpm verify` at `c4d0c38` is red at the `shape` gate on one test only, `self-host.test.ts` "the rate-limit namespaces it names are the configured ones" (the guide still says `8601` to `8609`; the lead's Docs lane owns the guide and the runbook line). The gates before it (doctor, format, secrets, typecheck, audit) were green, and the gates after it did not run, so I ran them by hand: `pnpm --filter @todz/api test:unit` printed 89 files and 2182 tests passed, and `tools/repository-shape` printed 332 passed and that one failure. `pnpm security:audit` printed `No known vulnerabilities found`.

### Red today, green after

| Test | Red commit | Printed |
|------|-----------|---------|
| `day-email-reply.test.ts` (34 tests: the happy reply, every refusal of ADR 0064 §3, the replay, strangers, owner B, redelivery, the throwing store, the daily maximum) | `70fcfc3` | `Error: handleReply is not implemented` (all 34, at `src/day-email/day-email-reply.ts:22`, reached through `Object.email src/index.ts:77`) |
| `api-source.test.ts` (the ten limiters) | `f2d4492` | `AssertionError: expected [ …(9) ] to deeply equal [ …(10) ]`, the missing entry being `DAY_EMAIL_REPLY_LIMITER` with namespace `8610`, limit 5, period 60 |
| `api-source.test.ts` (one reply limiter, no global one) | `f2d4492` | `AssertionError: expected [] to deeply equal [ 'DAY_EMAIL_REPLY_LIMITER' ]` |

Green: `917e046` (247 passing in `test/day-email`), `7064f61` (28 passing in `api-source.test.ts`).

Pins (green when they landed): the constants pin in `70fcfc3`; `reply-addressing.test.ts` and the `replyAddressOf` round trip in `917e046`; the budget rows of `c4d0c38`.

### Local Workers Logs check (Step 15)

Run on `wrangler dev` with the repository's `wrangler.jsonc` (production `observability` block), port 8791, its own persisted state in the scratchpad, `EMAIL_SENDER:cloudflare`, `--test-scheduled`: one reply posted to `/cdn-cgi/handler/email`, one tick at `/cdn-cgi/handler/scheduled?cron=*/15+*+*+*+*` for 2026-11-25T00:00Z. Results: the reply answered `Worker successfully processed email`; the tick answered `ok`; the reply's task made the day mail's subject `Your day: 1 due`. The Worker's captured console logs were exactly `{"event":"day_email_reply","outcome":"added"}` and `{"event":"day_email_run","due":1,"sent":1,"failed":0}`. A case-insensitive search of the local observability store (`logs` and `spans`, read through `/cdn-cgi/local/explorer/api/local/observability/query`) for `rcptTo`, `mailFrom`, the owner's address, the reply address and its secret, the `Message-ID`, the envelope sender, the title's sentinel and `noreply` found nothing in either table. Two lines of wrangler's own terminal output do name addresses (its warning that the envelope sender differs from the `From` header, and its dump of the simulated `send_email` call); they are the dev tool's output, not the Worker's, and Cloudflare's production Workers Logs are only checked by Step 23.

### Hypotheses for the tester

- Only a message whose envelope recipient is `reply+<32 hex>@todz.app` with an unexpired stored digest reaches anything past one indexed read; a stranger's message spends no limiter (the 100-message test records no key) and does not stop the owner's reply of the same minute.
- An accepted reply adds exactly one task, titled with the first line above the quote, to the Inbox of the owner's first workspace by creation, due the owner's local today, created by the owner, and records one `day_email_replies` row holding the SHA-256 of the `Message-ID`, never the `Message-ID`.
- Each refusal adds no task and no row, calls none of `setReject`, `forward` and `reply`, sends no mail, and logs one JSON line with `event` and `outcome` only (`unauthenticated` adds `verdict`).
- The same `Message-ID` twice leaves one task and one row; a project store that throws on the first add leaves no row, rejects the handler with `the day email reply failed` and no header text, and the redelivery adds once.
- A reply address of owner A with owner B's `From` and authentication adds to neither owner's projects; an owner with two `email` identities or none is refused as `not_owner`.
- The 21st reply in 24 hours is `daily_cap`; replies older than the retention do not count (they are pruned, and the count is over the last 24 hours).
- Fails closed: an unbound `DAY_EMAIL_REPLY_LIMITER` or a limiter that throws is `limited`, so a missing binding refuses every reply.

### Gaps

- Cloudflare's real header shape and what Email Routing does with a thrown handler stay unproven until Steps 22 and 23 (ADR 0064's amendment); the fixtures follow the documented `mx.cloudflare.net` form. A real header without `header.from` or `header.d` makes the owner's real reply `unauthenticated`, never a forged task.
- The cap is read before the add and the row written after it, so two concurrent distinct replies could both pass the count at 19; the per-owner limiter bounds that to a few. The row insert is not atomic with the add: a crash between them leaves a task without a counted row (the redelivery repairs it through the idempotency key).
- The `unparseable` test uses a raw stream that errors; a malformed-but-readable body parses leniently in `postal-mime` and is handled by the later checks (no title, no `Message-ID`).
- The handler's `rawSize` check trusts the platform's size; a body over 1 MiB with a small `rawSize` is not re-measured.
- The pure modules of lane `in-pure` were not touched except `reply-recipient.ts` (the added `replyAddressOf`).
- `apps/docs/self-host.mdx` and `docs/runbooks/deploy-the-api.md` still name nine rate-limit bindings (`8601` to `8609`); they are the lead's Docs lane, and `self-host.test.ts` stays red until both say ten and `8610`.
