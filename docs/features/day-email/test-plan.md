# Test plan: Day email

Every checkbox states the input and the exact expected outcome. A ticked box carries evidence after ` — evidence: ` (commit hash, log path, counts, screenshot path).

## The failing test first

- [ ] Server, the setting (Step 1): `apps/api/test/owner-account.test.ts` (or the file that holds the `PATCH /owner` cases) — input: `GET /owner` after migration 0008; expected red: the answer lacks `day_email`; failure text as printed: `<record>`
- [ ] Server, the mail (Step 3): `apps/api/test/day-mail.test.ts` — input: a Today of one task; expected red on the missing `DAY_EMAIL` template; failure text as printed: `<record>`
- [ ] Server, the cron (Step 5): `apps/api/test/day-email-run.test.ts` — input: one due owner at the 10:00 UTC tick; expected red: `runDayEmails is not implemented`; failure text as printed: `<record>`
- [ ] Server, the reply (Steps 9–10): `reply-title.test.ts`, `reply-authentication.test.ts`, `reply-recipient.test.ts`, `day-email-reply.test.ts` — expected red: `<name> is not implemented`; failure texts as printed: `<record>`
- [ ] App (Step 13): `OwnerAPITests`, `AppModelTests+DayEmail` — expected red: decode mismatch and `<name> is not implemented`; failure texts as printed: `<record>`
- [ ] Each red commit sits alone before its green commit in `git log` (hashes recorded).

## Unit

### The setting

- [ ] New owner → `GET /owner` answers `day_email: false`, `day_email_minutes: 420`.
- [ ] `PATCH {day_email: true}` → 200, `day_email: true`; `time_zone`, `agent_nudge`, `day_email_minutes` unchanged.
- [ ] `PATCH {day_email_minutes: 0}` and `{day_email_minutes: 1439}` → 200, stored.
- [ ] `PATCH {day_email_minutes: 1440}`, `-1`, `7.5`, `"07:00"`, `null` → 400 `invalid_request`, nothing stored.
- [ ] `PATCH {day_email: "yes"}`, `1`, `null` → 400 `invalid_request`, nothing stored.
- [ ] `PATCH {}` → 400 `invalid_request`.
- [ ] Sign-in of an owner with `day_email` on at 450 → the answer carries `true` and `450`.
- [ ] Owner A's PATCH never changes owner B's row.
- [ ] The columns reject `day_email = 2`, `day_email_minutes = -1` and `1440` at the SQL level.

### The due rule and the run

- [ ] `America/Sao_Paulo`, 07:00: tick 09:45 UTC → no mail, no row; tick 10:00 UTC → one mail, one row with `sent_at`.
- [ ] `America/Sao_Paulo`, 07:10: tick 10:00 UTC → nothing; tick 10:15 UTC → one mail.
- [ ] Catch-up: unclaimed 07:00 owner at tick 12:45 UTC → one mail; at tick 13:00 UTC → none, no row.
- [ ] `Asia/Kolkata`, 07:00 → one mail at tick 01:30 UTC.
- [ ] `America/New_York`, 01:30 on 2026-11-01 (the hour repeats) → exactly one mail that local date across all ticks of the day.
- [ ] Chosen 23:00, tick at 01:00 the next local day → nothing for either day.
- [ ] Flag off → nothing; no `email` identity → nothing; no workspace → nothing.
- [ ] The same tick run twice in a row → one mail, one row.
- [ ] The same tick run twice concurrently (`Promise.all`) → one mail, one row.
- [ ] Sender throws for owner A, B also due → B mailed; A's row `failed_at` set, `failure = 'send_failed'`; the run rejects with `the day email failed for 1 owner`; the message names no id or address.
- [ ] A project read fails → no mail; row `read_failed`; the run rejects.
- [ ] 51 due owners → 50 mails; the 51st on the next tick.
- [ ] Rows older than 30 days and reply addresses past `expires_at` are gone after a tick; newer ones stay.
- [ ] No sender configured → nothing claimed; the run rejects naming `email_sender`.
- [ ] The digest cron still sends the digest and no day mail; the `*/15` cron never sends the digest; an unknown cron rejects.
- [ ] The run's summary log line is `{"event":"day_email_run","due":…,"sent":…,"failed":…}` and contains no address or title.

### Today and the mail

- [ ] Open tasks due today and overdue appear; done, upcoming and undated tasks never.
- [ ] Order: workspaces by creation, the Inbox first then projects by creation, tasks in manual order.
- [ ] One workspace → `T-12 Title · Project`; two workspaces → `T-12 Title · Workspace / Project`; overdue → ends ` · overdue`.
- [ ] 21 due → 20 lines then `and 1 more.`; the subject says `Your day: 21 due`.
- [ ] Empty Today → subject `Your day: nothing due`, heading `Nothing due today`, the reply hint, no list.
- [ ] Owner B's tasks never appear in owner A's mail.
- [ ] Title `<script>alert(1)</script>` → escaped in the HTML, literal in the text; title `{{link}}` → literal in both.
- [ ] `{{time}}` → `07:00` for 420, `00:05` for 5; `{{workspace}}` → the first workspace's name.
- [ ] The day mail's `replyTo` is `reply+<32 lowercase hex>@todz.app`; its digest is stored with `expires_at` 7 days later; the secret is stored nowhere in D1.
- [ ] Every other mail (sign-in, welcome, waitlist, admin sign-in, digest) keeps `replyTo: hello@todz.app`.
- [ ] `pnpm emails:check` passes; the import guard still proves no React reaches `src/`.

### The reply

- [ ] Title extraction: each input of plan Step 9 → its expected title or none.
- [ ] Authentication: each header case of plan Step 9 → pass or refuse as listed.
- [ ] Recipient: each address of plan Step 9 → the secret or none.
- [ ] Happy fixture → one task `Buy milk` in the first workspace's Inbox, due the owner's today, `created_by` owner, one `day_email_replies` row, log `{"event":"day_email_reply","outcome":"added"}`.
- [ ] Each refusal (`limited` global, `limited` per owner, `unknown_recipient`, `too_large`, expired address, `unauthenticated`, `not_owner`, the display-name trick, two From addresses, `no_message_id`, `daily_cap` at the 21st reply in 24 hours, `empty`, HTML only, `no_inbox`) → no task, no row, no `setReject`, `forward` or `reply` call, no mail sent, one log line with its outcome.
- [ ] Owner A's reply address with owner B's From and DMARC pass → `not_owner`, nothing in either owner's projects.
- [ ] The same `Message-ID` delivered twice → one task.
- [ ] The project store throws on add → the handler rejects; redelivery adds exactly one task.
- [ ] No captured log argument contains the sender address, the owner address, the subject or the title.

### Shape

- [ ] `triggers.crons` equals `["0 11 * * *", "*/15 * * * *"]` and every `ScheduledCron` value is one of them.
- [ ] `ratelimits` gains `DAY_EMAIL_REPLY_LIMITER` (8610) and `DAY_EMAIL_REPLY_GLOBAL_LIMITER` (8611) with the shared limits, period 60.
- [ ] `observability` equals `{ enabled: true }`.
- [ ] `postal-mime` is pinned exactly in `apps/api/package.json`; `pnpm security:audit` prints no high or critical.

### App

- [ ] `Owner` decodes `day_email`/`day_email_minutes` when present and `nil` when absent.
- [ ] `updateDayEmail(isEnabled: true)` sends exactly `{"day_email":true}`; `updateDayEmailMinutes(minutes: 450)` exactly `{"day_email_minutes":450}`.
- [ ] Every state row of `design.md` § 1.1 has an `AppModel` test with its switch, time and notice.
- [ ] A second change while saving makes no call; a failure reverts both values and sets not saved; signing out mid-save drops the answer.
- [ ] The agent nudge tests pass unchanged with `OwnerSettingNotice`.
- [ ] `swift test --package-path apps/macos/TodzKit` green with its count; `xcodebuild` Debug succeeds.

## E2E (Playwright specs)

- [ ] Not applicable: no browser surface changes. The mail previews are checked as rendered HTML files in the walk below.

## Prove it for real

Local stack: `pnpm --filter @todz/api dev:email` (email sign-in, console sender), the Debug app pointed at it (Settings → Server), driven with computer use (ADR 0026). Few, short openings of the app's windows; the popover is not involved.

- [ ] Happy path: sign in by email link; Settings shows "Email me my day" off with 07:00 and the picker dimmed; turn it on → the switch stays on, the picker enables; set 07:15 → `GET /owner` answers `day_email: true`, `day_email_minutes: 435`.
- [ ] Scheduled: `curl "http://localhost:8787/cdn-cgi/handler/scheduled?cron=*/15+*+*+*+*&time=<ms of 07:15 in the Mac's zone>"` → the console prints one `{to, replyTo, text}` line with the Today lines; a second identical call prints nothing.
- [ ] Empty: with no task due, the same call on a new day → the `nothing due` text.
- [ ] Single: one overdue task → one line ending ` · overdue`.
- [ ] Many: 25 due across two workspaces → 20 lines with `Workspace / Project`, then `and 5 more.`
- [ ] Reply: post the happy fixture with the printed `replyTo` and the signed-in address to `http://localhost:8787/cdn-cgi/handler/email?from=<address>&to=<replyTo>` → the task appears in the app's Today, in the first workspace's Inbox, within the change feed's delay.
- [ ] Rejected input: the same fixture with another From → no task; the dev console shows `not_owner` and no address.
- [ ] Offline: stop the server → the row dims and reads "Can't reach todz. You can change this when it's back."; restart → enabled.
- [ ] Save failed: answer 500 for `PATCH /owner` (stop the server mid-change) → the switch reverts and the subtitle reads "Your change wasn't saved."
- [ ] Signed out: sign out → the row reads "Sign in to change this.", dimmed.
- [ ] Two Macs or two sessions: change the time in one, reopen Settings in the other after its owner confirmation → the same time.
- [ ] Mail previews: `pnpm emails:preview` → `day-email.html` and `day-email-empty.html` in `.pr-media/emails/` look right in light and dark at 600 and 375 px wide (headless Chrome screenshots).
- [ ] Console and network clean: no app error banner; the server log shows no unexpected 4xx or 5xx other than the deliberate ones above.
- [ ] Screenshots at `.pr-media/day-email/` (Settings off, on, offline, failed, signed out, light and dark; both mail previews).

### Production (plan Steps 18–20)

- [ ] Routing: `GET /zones/<zone>/email/routing` answers `support_subaddress: true`; the rules list has `reply@todz.app` → worker `todz-api`, enabled; `hello@` and `support@` unchanged.
- [ ] The first real send: a `day_emails` row for the owner's date with `sent_at` set and no `failure`; Workers Logs shows the run's summary line.
- [ ] The first real reply adds exactly one task in the first workspace's Inbox, due today; one `day_email_replies` row.

## Edge cases found during execution

Empty on purpose. The tester adds one checkbox per new case (input, exact expected outcome) and a regression test for each.

## Adversarial review

The reviewer and the security reviewer pick the claims most likely to be wrong and try to refute each.

- [ ] Claim 1: only the owner's own mailbox can add a task (forged From, a sender-supplied `Authentication-Results`, a leaked reply address, another owner's address) — attack: craft each fixture; result: <refuted | held>
- [ ] Claim 2: no owner ever gets two day mails on one local date (overlapping ticks, DST, a time change after the send) — attack: concurrent runs and a PATCH between ticks; result: <refuted | held>
- [ ] Claim 3: no log line or error carries an address, a subject or a title — attack: grep every `console.*` and `throw` in the diff, run every refusal; result: <refuted | held>
- [ ] Claim 4: the routing extension never opens a project outside the reply owner's first Inbox — attack: read `openReplyInbox` and its callers; result: <refuted | held>

## Coverage honesty

- Real Email Routing behaviour (the header Cloudflare actually prepends, subaddressing preserving the detail, delivery to the Worker) is proven only in production by the owner's one reply; local runs post fixtures that carry the header themselves.
- Deliverability (spam folders) and how each mail client quotes a reply are not tested beyond the fixtures of English and pt-BR Gmail and Outlook separators.
- Cron timing in production is proven by the first `day_emails` row, not by a test of Cloudflare's scheduler.
- The 50-per-tick cap is tested with a fake sender; real subrequest limits at that scale are not measured.
